import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { Prisma, loai_danh_muc_import } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DiaDanhService } from '../danh-muc/dia-danh/dia-danh.service';
import { DonViCongTacService } from '../danh-muc/don-vi-cong-tac/don-vi-cong-tac.service';
import { MonHocService } from '../danh-muc/mon-hoc/mon-hoc.service';
import { HocVienService } from '../hoc-vien/hoc-vien.service';
import { KhoaBoiDuongService } from '../khoa-boi-duong/khoa-boi-duong.service';
import { CreateDiaDanhDto } from '../danh-muc/dto/dia-danh.dto';
import { CreateDonViCongTacDto } from '../danh-muc/dto/don-vi-cong-tac.dto';
import { CreateMonHocDto } from '../danh-muc/dto/mon-hoc.dto';
import { HoSoNhanSuMoetRowDto } from '../hoc-vien/dto/import-moet-row.dto';
import { PhanLopHocVienRowDto } from '../khoa-boi-duong/dto/phan-lop-row.dto';
import {
  ConflictAppException,
  NotFoundAppException,
  ValidationException,
  toRowErrorMessage,
} from '../common/exceptions/app.exceptions';
import { paginate } from '../common/dto/pagination-query.dto';
import {
  RowBuildResult,
  SupportedImportType,
  isSupportedImportType,
} from './import.types';
import {
  buildLoiWorkbook,
  buildTemplateWorkbook,
  readWorkbookRows,
} from './util/excel.util';
import {
  docFileGoc,
  docFileLoi,
  docKetQua,
  luuFileGoc,
  luuFileLoi,
  luuKetQua,
} from './util/import-storage.util';
import { buildValidatedDto } from './util/dto-validate.util';
import { LichSuImportQueryDto } from './dto/lich-su-import-query.dto';

// Dịch vụ Import — docs/api-contract.md mục 5. Cả 5 loại đã triển khai:
// dia_danh / don_vi_cong_tac / mon_hoc / ho_so_nhan_su_moet (lượt trước) +
// phan_lop_hoc_vien (lượt này, xem KhoaBoiDuongService).
//
// Cột file Excel cho dia_danh/don_vi_cong_tac/mon_hoc KHÔNG được
// api-contract.md định nghĩa chi tiết — tự thiết kế ở đây (flag lại trong
// self-review): dùng "mã" (ma/ma_don_vi) làm khóa tham chiếu giữa các dòng
// thay vì UUID nội bộ, vì người nhập liệu thực tế không biết UUID. Cột của
// ho_so_nhan_su_moet và phan_lop_hoc_vien THÌ được định nghĩa rõ trong
// api-contract.md ("Luồng import nhân sự từ CSDL MOET" mục 2, mục 5 ghi chú
// riêng cho phan_lop_hoc_vien) — dùng đúng nguyên văn.
@Injectable()
export class ImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly diaDanhService: DiaDanhService,
    private readonly donViCongTacService: DonViCongTacService,
    private readonly monHocService: MonHocService,
    private readonly hocVienService: HocVienService,
    private readonly khoaBoiDuongService: KhoaBoiDuongService,
  ) {}

  assertSupported(loai: string): SupportedImportType {
    if (!isSupportedImportType(loai)) {
      throw new ValidationException(
        `Loại import "${loai}" chưa được hỗ trợ ở phiên bản hiện tại (chỉ hỗ trợ: dia_danh, don_vi_cong_tac, mon_hoc, ho_so_nhan_su_moet, phan_lop_hoc_vien)`,
      );
    }
    return loai;
  }

  async taiMauExcel(
    loaiRaw: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const loai = this.assertSupported(loaiRaw);
    const columns = this.getColumns(loai);
    const buffer = await buildTemplateWorkbook(
      columns,
      this.getColumnNotes(loai),
    );
    return { buffer, filename: `mau-${loai}.xlsx` };
  }

  async taoImport(
    loaiRaw: string,
    file: Express.Multer.File | undefined,
    nguoiImportId: string,
  ) {
    const loai = this.assertSupported(loaiRaw);
    if (!file || !file.buffer?.length) {
      throw new ValidationException('Thiếu file tải lên', [
        { field: 'file', message: 'Bắt buộc' },
      ]);
    }
    const columns = this.getColumns(loai);

    let rows: Awaited<ReturnType<typeof readWorkbookRows>>;
    try {
      rows = await readWorkbookRows(file.buffer, columns);
    } catch (e) {
      await this.prisma.nhat_ky_import.create({
        data: {
          id: randomUUID(),
          loai_danh_muc: loai,
          ten_file_goc: file.originalname,
          nguoi_import_id: nguoiImportId,
          tong_so_dong: 0,
          so_dong_thanh_cong: 0,
          so_dong_loi: 0,
          trang_thai: 'loi',
        },
      });
      throw e;
    }

    const importId = randomUUID();
    const danhSachLoi: { dong: number; ly_do: string }[] = [];
    const dongHopLe: number[] = [];

    for (const row of rows) {
      const { dto, error } = await this.buildDto(loai, row.values);
      if (error || !dto) {
        danhSachLoi.push({
          dong: row.dong,
          ly_do: error ?? 'Không dựng được dữ liệu dòng',
        });
        continue;
      }
      const checkErr = await this.checkValid(loai, dto);
      if (checkErr) {
        danhSachLoi.push({ dong: row.dong, ly_do: checkErr });
        continue;
      }
      dongHopLe.push(row.dong);
    }

    await luuFileGoc(importId, file.buffer);
    await luuKetQua(importId, {
      danh_sach_loi: danhSachLoi,
      dong_hop_le: dongHopLe,
    });
    if (danhSachLoi.length > 0) {
      const rowsByDong = new Map(rows.map((r) => [r.dong, r.values]));
      const buffer = await buildLoiWorkbook(
        columns,
        danhSachLoi.map((l) => ({
          dong: l.dong,
          values: rowsByDong.get(l.dong) ?? {},
          ly_do: l.ly_do,
        })),
      );
      await luuFileLoi(importId, buffer);
    }

    await this.prisma.nhat_ky_import.create({
      data: {
        id: importId,
        loai_danh_muc: loai,
        ten_file_goc: file.originalname,
        nguoi_import_id: nguoiImportId,
        tong_so_dong: rows.length,
        so_dong_thanh_cong: dongHopLe.length,
        so_dong_loi: danhSachLoi.length,
        trang_thai: 'dang_xu_ly',
        file_loi_url:
          danhSachLoi.length > 0 ? `/import/${importId}/file-loi` : null,
      },
    });

    return { import_id: importId, trang_thai: 'dang_xu_ly' as const };
  }

  async xemKetQua(id: string) {
    const nhatKy = await this.prisma.nhat_ky_import.findUnique({
      where: { id },
    });
    if (!nhatKy) throw new NotFoundAppException('Không tìm thấy lượt import');
    const ketQua = await docKetQua(id);
    return {
      id: nhatKy.id,
      loai_danh_muc: nhatKy.loai_danh_muc,
      ten_file_goc: nhatKy.ten_file_goc,
      trang_thai: nhatKy.trang_thai,
      tong_so_dong: nhatKy.tong_so_dong,
      so_dong_thanh_cong: nhatKy.so_dong_thanh_cong,
      so_dong_loi: nhatKy.so_dong_loi,
      thoi_gian_import: nhatKy.thoi_gian_import,
      danh_sach_loi: ketQua?.danh_sach_loi ?? [],
    };
  }

  async taiFileLoi(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const nhatKy = await this.prisma.nhat_ky_import.findUnique({
      where: { id },
    });
    if (!nhatKy) throw new NotFoundAppException('Không tìm thấy lượt import');
    const buffer = await docFileLoi(id);
    if (!buffer) {
      throw new NotFoundAppException('Lượt import này không có dòng lỗi nào');
    }
    return { buffer, filename: `loi-${id}.xlsx` };
  }

  async xacNhan(id: string) {
    const nhatKy = await this.prisma.nhat_ky_import.findUnique({
      where: { id },
    });
    if (!nhatKy) throw new NotFoundAppException('Không tìm thấy lượt import');
    if (nhatKy.trang_thai === 'hoan_thanh') {
      throw new ConflictAppException(
        'Lượt import này đã được xác nhận trước đó',
      );
    }
    if (nhatKy.trang_thai === 'loi') {
      throw new ValidationException(
        'Lượt import bị lỗi khi đọc file, không thể xác nhận',
      );
    }
    const loai = this.assertSupported(nhatKy.loai_danh_muc);

    const ketQuaCu = await docKetQua(id);
    if (!ketQuaCu) {
      throw new ValidationException(
        'Không tìm thấy dữ liệu xem trước — vui lòng import lại file',
      );
    }

    const columns = this.getColumns(loai);
    const fileGoc = await docFileGoc(id);
    const rows = await readWorkbookRows(fileGoc, columns);
    const rowsByDong = new Map(rows.map((r) => [r.dong, r.values]));

    const danhSachLoiMoi = [...ketQuaCu.danh_sach_loi];
    let soDongThanhCong = 0;

    for (const dong of ketQuaCu.dong_hop_le) {
      const values = rowsByDong.get(dong);
      if (!values) {
        danhSachLoiMoi.push({
          dong,
          ly_do: 'Không đọc lại được dòng từ file gốc',
        });
        continue;
      }
      const { dto, error } = await this.buildDto(loai, values);
      if (error || !dto) {
        danhSachLoiMoi.push({
          dong,
          ly_do: error ?? 'Không dựng được dữ liệu dòng',
        });
        continue;
      }
      try {
        await this.commitRow(loai, dto, id, nhatKy.nguoi_import_id);
        soDongThanhCong++;
      } catch (e) {
        danhSachLoiMoi.push({ dong, ly_do: toRowErrorMessage(e) });
      }
    }

    await luuKetQua(id, { danh_sach_loi: danhSachLoiMoi, dong_hop_le: [] });
    if (danhSachLoiMoi.length > 0) {
      const buffer = await buildLoiWorkbook(
        columns,
        danhSachLoiMoi.map((l) => ({
          dong: l.dong,
          values: rowsByDong.get(l.dong) ?? {},
          ly_do: l.ly_do,
        })),
      );
      await luuFileLoi(id, buffer);
    }

    return this.prisma.nhat_ky_import.update({
      where: { id },
      data: {
        so_dong_thanh_cong: soDongThanhCong,
        so_dong_loi: danhSachLoiMoi.length,
        trang_thai: 'hoan_thanh',
        file_loi_url:
          danhSachLoiMoi.length > 0 ? `/import/${id}/file-loi` : null,
      },
    });
  }

  async lichSu(query: LichSuImportQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const where: Prisma.nhat_ky_importWhereInput = {};
    if (query.loai) where.loai_danh_muc = query.loai as loai_danh_muc_import;
    if (query.tu_ngay || query.den_ngay) {
      where.thoi_gian_import = {
        ...(query.tu_ngay ? { gte: new Date(query.tu_ngay) } : {}),
        ...(query.den_ngay ? { lte: new Date(query.den_ngay) } : {}),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.nhat_ky_import.findMany({
        where,
        orderBy: { thoi_gian_import: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.nhat_ky_import.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  private getColumns(loai: SupportedImportType): string[] {
    switch (loai) {
      case 'dia_danh':
        return ['ma', 'ten', 'cap', 'parent_ma'];
      case 'don_vi_cong_tac':
        return [
          'ma_don_vi',
          'ten_don_vi',
          'loai_don_vi',
          'dia_ban_ma',
          'don_vi_cha_ma',
        ];
      case 'mon_hoc':
        return ['ten_mon', 'cap_hoc'];
      case 'phan_lop_hoc_vien':
        // Nguyên văn cột theo docs/api-contract.md mục 5, ghi chú riêng cho
        // phan_lop_hoc_vien. ten_lop TÙY CHỌN (đã sửa 2026-09-25) — để trống
        // = chỉ ghi danh, có giá trị = ghi danh + phân lớp (xem getColumnNotes
        // cho ghi chú hiển thị trên file mẫu Excel).
        return ['so_dinh_danh_ca_nhan', 'ma_khoa', 'ten_lop'];
      case 'ho_so_nhan_su_moet':
        // Nguyên văn cột theo docs/api-contract.md mục 2 "Luồng import nhân
        // sự từ CSDL MOET".
        return [
          'Đơn vị',
          'Mã định danh (CDSL moet)',
          'Họ và tên',
          'Ngày',
          'Tháng',
          'Năm',
          'Chức vụ',
          'Chuyên môn',
          'Số điện thoại',
          'Ghi chú',
        ];
    }
  }

  private getColumnNotes(loai: SupportedImportType): Record<string, string> {
    if (loai === 'phan_lop_hoc_vien') {
      return {
        ten_lop:
          'Tùy chọn — để trống nếu chỉ muốn ghi danh vào khóa, chưa phân lớp. Có thể chạy lại import sau với ten_lop để phân lớp cho học viên đã ghi danh.',
      };
    }
    return {};
  }

  // Rule #24/#36e: "Chuyên môn" có thể nhiều giá trị/dòng, phân tách bằng ";".
  private splitChuyenMon(raw: string): string[] {
    return raw
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private async buildDto(
    loai: SupportedImportType,
    raw: Record<string, string>,
  ): Promise<
    RowBuildResult<
      | CreateDiaDanhDto
      | CreateDonViCongTacDto
      | CreateMonHocDto
      | HoSoNhanSuMoetRowDto
      | PhanLopHocVienRowDto
    >
  > {
    switch (loai) {
      case 'dia_danh':
        return this.buildDiaDanhDto(raw);
      case 'don_vi_cong_tac':
        return this.buildDonViDto(raw);
      case 'mon_hoc':
        return buildValidatedDto(CreateMonHocDto, {
          ten_mon: raw.ten_mon,
          cap_hoc: raw.cap_hoc,
        });
      case 'phan_lop_hoc_vien':
        return this.khoaBoiDuongService.resolvePhanLopRow({
          so_dinh_danh_ca_nhan: raw.so_dinh_danh_ca_nhan,
          ma_khoa: raw.ma_khoa,
          ten_lop: raw.ten_lop,
        });
      case 'ho_so_nhan_su_moet':
        return this.buildHoSoMoetDto(raw);
    }
  }

  private async checkValid(
    loai: SupportedImportType,
    dto:
      | CreateDiaDanhDto
      | CreateDonViCongTacDto
      | CreateMonHocDto
      | HoSoNhanSuMoetRowDto
      | PhanLopHocVienRowDto,
  ): Promise<string | undefined> {
    try {
      if (loai === 'dia_danh') {
        const d = dto as CreateDiaDanhDto;
        await this.diaDanhService.checkValid({
          ma: d.ma,
          cap: d.cap,
          parent_id: d.parent_id ?? null,
        });
      } else if (loai === 'don_vi_cong_tac') {
        const d = dto as CreateDonViCongTacDto;
        await this.donViCongTacService.checkValid({
          ma_don_vi: d.ma_don_vi,
          dia_ban_id: d.dia_ban_id,
          don_vi_cha_id: d.don_vi_cha_id ?? null,
        });
      } else if (loai === 'mon_hoc') {
        const d = dto as CreateMonHocDto;
        await this.monHocService.checkValid({
          ten_mon: d.ten_mon,
          cap_hoc: d.cap_hoc,
        });
      } else if (loai === 'phan_lop_hoc_vien') {
        // Không cần kiểm tra thêm: resolvePhanLopRow() (buildDto) đã tra
        // cứu/validate toàn bộ FK + trạng thái hồ sơ cho dòng này rồi.
      } else {
        const d = dto as HoSoNhanSuMoetRowDto;
        await this.hocVienService.checkValidMoetImportRow({
          ma_dinh_danh_moet: d.ma_dinh_danh_moet,
          ho_ten: d.ho_ten,
          ngay_sinh: d.ngay_sinh,
          thang_sinh: d.thang_sinh,
          nam_sinh: d.nam_sinh,
          so_dien_thoai_lien_he: d.so_dien_thoai_lien_he,
          chuyen_mon: this.splitChuyenMon(d.chuyen_mon_raw),
          don_vi_cong_tac_id: d.don_vi_cong_tac_id,
        });
      }
      return undefined;
    } catch (e) {
      return toRowErrorMessage(e);
    }
  }

  private async commitRow(
    loai: SupportedImportType,
    dto:
      | CreateDiaDanhDto
      | CreateDonViCongTacDto
      | CreateMonHocDto
      | HoSoNhanSuMoetRowDto
      | PhanLopHocVienRowDto,
    importId: string,
    nguoiImportId: string,
  ): Promise<void> {
    if (loai === 'dia_danh') {
      await this.diaDanhService.create(dto as CreateDiaDanhDto, importId);
    } else if (loai === 'don_vi_cong_tac') {
      await this.donViCongTacService.create(
        dto as CreateDonViCongTacDto,
        importId,
      );
    } else if (loai === 'mon_hoc') {
      await this.monHocService.create(dto as CreateMonHocDto, importId);
    } else if (loai === 'phan_lop_hoc_vien') {
      await this.khoaBoiDuongService.commitPhanLop(dto as PhanLopHocVienRowDto);
    } else {
      const d = dto as HoSoNhanSuMoetRowDto;
      await this.hocVienService.createFromMoetImport(
        {
          ma_dinh_danh_moet: d.ma_dinh_danh_moet,
          ho_ten: d.ho_ten,
          ngay_sinh: d.ngay_sinh,
          thang_sinh: d.thang_sinh,
          nam_sinh: d.nam_sinh,
          chuc_vu: d.chuc_vu,
          don_vi_cong_tac_id: d.don_vi_cong_tac_id,
          so_dien_thoai_lien_he: d.so_dien_thoai_lien_he,
          ghi_chu: d.ghi_chu,
          chuyen_mon: this.splitChuyenMon(d.chuyen_mon_raw),
        },
        nguoiImportId,
      );
    }
  }

  // Rule #36e: khớp cột "Đơn vị" với don_vi_cong_tac.ten_don_vi — không khớp
  // được hoặc khớp nhiều hơn 1 kết quả -> dòng lỗi (không tự đoán). Phạm vi
  // quyền "trong phạm vi quyền của người chạy import" (api-contract.md) không
  // cần lọc thêm ở đây vì toàn bộ ImportController đã @Roles('quan_tri') —
  // scope của quan_tri luôn là 'ALL' (xem ScopeService) nên không có gì để
  // thu hẹp; flagged trong self-review.
  private async buildHoSoMoetDto(
    raw: Record<string, string>,
  ): Promise<RowBuildResult<HoSoNhanSuMoetRowDto>> {
    const donViTen = raw['Đơn vị']?.trim();
    if (!donViTen) {
      return { error: 'Thiếu cột "Đơn vị"' };
    }
    const matches = await this.prisma.don_vi_cong_tac.findMany({
      where: { ten_don_vi: donViTen },
    });
    if (matches.length === 0) {
      return {
        error: `Đơn vị "${donViTen}" không khớp với đơn vị công tác nào trong danh mục`,
      };
    }
    if (matches.length > 1) {
      return {
        error: `Đơn vị "${donViTen}" khớp nhiều hơn 1 đơn vị công tác trong danh mục`,
      };
    }

    return buildValidatedDto(HoSoNhanSuMoetRowDto, {
      ma_dinh_danh_moet: raw['Mã định danh (CDSL moet)'],
      ho_ten: raw['Họ và tên'],
      ngay_sinh: raw['Ngày'],
      thang_sinh: raw['Tháng'],
      nam_sinh: raw['Năm'],
      chuc_vu: raw['Chức vụ'] || undefined,
      chuyen_mon_raw: raw['Chuyên môn'],
      so_dien_thoai_lien_he: raw['Số điện thoại'],
      ghi_chu: raw['Ghi chú'] || undefined,
      don_vi_cong_tac_id: matches[0].id,
    });
  }

  private async buildDiaDanhDto(
    raw: Record<string, string>,
  ): Promise<RowBuildResult<CreateDiaDanhDto>> {
    let parent_id: string | undefined;
    if (raw.parent_ma) {
      const parent = await this.prisma.dia_danh.findUnique({
        where: { ma: raw.parent_ma },
      });
      if (!parent) {
        return {
          error: `parent_ma "${raw.parent_ma}" không tồn tại trong danh mục địa danh`,
        };
      }
      parent_id = parent.id;
    }
    return buildValidatedDto(CreateDiaDanhDto, {
      ma: raw.ma,
      ten: raw.ten,
      cap: raw.cap,
      parent_id,
    });
  }

  private async buildDonViDto(
    raw: Record<string, string>,
  ): Promise<RowBuildResult<CreateDonViCongTacDto>> {
    const diaBan = await this.prisma.dia_danh.findUnique({
      where: { ma: raw.dia_ban_ma },
    });
    if (!diaBan) {
      return {
        error: `dia_ban_ma "${raw.dia_ban_ma}" không tồn tại trong danh mục địa danh`,
      };
    }
    let don_vi_cha_id: string | undefined;
    if (raw.don_vi_cha_ma) {
      const cha = await this.prisma.don_vi_cong_tac.findUnique({
        where: { ma_don_vi: raw.don_vi_cha_ma },
      });
      if (!cha) {
        return { error: `don_vi_cha_ma "${raw.don_vi_cha_ma}" không tồn tại` };
      }
      don_vi_cha_id = cha.id;
    }
    return buildValidatedDto(CreateDonViCongTacDto, {
      ma_don_vi: raw.ma_don_vi || undefined,
      ten_don_vi: raw.ten_don_vi,
      loai_don_vi: raw.loai_don_vi,
      dia_ban_id: diaBan.id,
      don_vi_cha_id,
    });
  }
}
