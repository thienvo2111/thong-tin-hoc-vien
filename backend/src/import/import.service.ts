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
import { TaiKhoanVleRowDto } from './dto/tai-khoan-vle-row.dto';
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
import { readMoetWorkbookRows } from './util/moet-excel.util';
import {
  docFileGoc,
  docFileLoi,
  docKetQua,
  luuFileGoc,
  luuFileLoi,
  luuKetQua,
} from './util/import-storage.util';
import { buildValidatedDto } from './util/dto-validate.util';
import { resolveHocVienImportRow } from './util/hoc-vien-resolver.util';
import { encryptVleMatKhau } from '../common/utils/vle-crypto.util';
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
        `Loại import "${loai}" chưa được hỗ trợ ở phiên bản hiện tại (chỉ hỗ trợ: dia_danh, don_vi_cong_tac, mon_hoc, ho_so_nhan_su_moet, phan_lop_hoc_vien, tai_khoan_vle)`,
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
      rows = await this.readRows(loai, file.buffer, columns);
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
    const danhSachCanhBao: { dong: number; ly_do: string }[] = [];
    const dongHopLe: number[] = [];

    for (const row of rows) {
      const { dto, error, canhBao } = await this.buildDto(loai, row.values);
      if (error || !dto) {
        danhSachLoi.push({
          dong: row.dong,
          ly_do: error ?? 'Không dựng được dữ liệu dòng',
        });
        continue;
      }
      if (canhBao) danhSachCanhBao.push({ dong: row.dong, ly_do: canhBao });
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
      danh_sach_canh_bao: danhSachCanhBao,
    });
    if (danhSachLoi.length > 0) {
      const rowsByDong = new Map(rows.map((r) => [r.dong, r.values]));
      const buffer = await buildLoiWorkbook(
        columns,
        danhSachLoi.map((l) => ({
          dong: l.dong,
          values: this.redactChoFileLoi(loai, rowsByDong.get(l.dong) ?? {}),
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
      danh_sach_canh_bao: ketQua?.danh_sach_canh_bao ?? [],
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
    const rows = await this.readRows(loai, fileGoc, columns);
    const rowsByDong = new Map(rows.map((r) => [r.dong, r.values]));

    const danhSachLoiMoi = [...ketQuaCu.danh_sach_loi];
    const danhSachCanhBaoMoi = [...(ketQuaCu.danh_sach_canh_bao ?? [])];
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

    await luuKetQua(id, {
      danh_sach_loi: danhSachLoiMoi,
      dong_hop_le: [],
      danh_sach_canh_bao: danhSachCanhBaoMoi,
    });
    if (danhSachLoiMoi.length > 0) {
      const buffer = await buildLoiWorkbook(
        columns,
        danhSachLoiMoi.map((l) => ({
          dong: l.dong,
          values: this.redactChoFileLoi(loai, rowsByDong.get(l.dong) ?? {}),
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

  // T4 (mo-rong-nls-an-giang.md): ho_so_nhan_su_moet dùng parser riêng, chịu
  // được file thực tế (dòng tiêu đề phía trên, tiêu đề gộp ô 2 tầng, cột số
  // lưu dạng number) — 4 loại còn lại giữ nguyên readWorkbookRows (khớp cột
  // CHÍNH XÁC ở dòng 1, đúng thứ tự) để không đổi hành vi đã ổn định.
  private async readRows(
    loai: SupportedImportType,
    buffer: Buffer,
    columns: string[],
  ): Promise<{ dong: number; values: Record<string, string> }[]> {
    if (loai === 'ho_so_nhan_su_moet') {
      return readMoetWorkbookRows(buffer);
    }
    return readWorkbookRows(buffer, columns);
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
        // sự từ CSDL MOET". "Mã đơn vị" thêm ở T4 (mo-rong-nls-an-giang.md) —
        // tùy chọn, chỉ dùng để phân biệt khi 2 trường trùng tên sau sáp
        // nhập An Giang – Kiên Giang. Đọc file thật qua readMoetWorkbookRows
        // (không phụ thuộc thứ tự cột trong mảng này) — mảng này chỉ dùng để
        // sinh file mẫu/file lỗi.
        return [
          'Đơn vị',
          'Mã đơn vị',
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
      case 'tai_khoan_vle':
        // T15 (mo-rong-nls-an-giang.md): file Phòng CNTT trả về sau khi tạo
        // tài khoản VLE cho toàn bộ học viên. Mã học viên dùng chung
        // HocVienResolver (mục 2 quy tắc #3) — cả 2 cột đều "tùy chọn" theo
        // nghĩa từng cột, nhưng phải có ÍT NHẤT 1 (xem
        // resolveHocVienImportRow). mat_khau_tam tùy chọn — không phải học
        // viên nào cũng có mật khẩu tạm riêng (vd SSO).
        return [
          'so_dinh_danh_ca_nhan',
          'ma_dinh_danh_moet',
          'ten_dang_nhap_vle',
          'mat_khau_tam',
          'duong_dan',
        ];
    }
  }

  // T15: "không bao giờ trả mật khẩu... trong file lỗi import" — file lỗi
  // (buildLoiWorkbook) re-export NGUYÊN VĂN giá trị dòng gốc cho từng cột
  // (để người dùng sửa và nộp lại), nên phải xóa riêng mat_khau_tam ở đây
  // TRƯỚC khi ghi ra Excel — các loại import khác không có cột nhạy cảm nào
  // tương tự nên trả nguyên values.
  private redactChoFileLoi(
    loai: SupportedImportType,
    values: Record<string, string>,
  ): Record<string, string> {
    if (loai === 'tai_khoan_vle' && values.mat_khau_tam) {
      return { ...values, mat_khau_tam: '(đã ẩn)' };
    }
    return values;
  }

  private getColumnNotes(loai: SupportedImportType): Record<string, string> {
    if (loai === 'phan_lop_hoc_vien') {
      return {
        ten_lop:
          'Tùy chọn — để trống nếu chỉ muốn ghi danh vào khóa, chưa phân lớp. Có thể chạy lại import sau với ten_lop để phân lớp cho học viên đã ghi danh.',
      };
    }
    if (loai === 'ho_so_nhan_su_moet') {
      return {
        'Mã đơn vị':
          'Tùy chọn — chỉ cần điền khi tên đơn vị ở cột "Đơn vị" trùng với đơn vị khác trong danh mục (vd cùng địa danh sau sáp nhập). Nếu có giá trị, hệ thống khớp theo mã này thay vì tên.',
      };
    }
    if (loai === 'tai_khoan_vle') {
      return {
        so_dinh_danh_ca_nhan:
          'Tùy chọn — phải có ít nhất 1 trong 2 cột so_dinh_danh_ca_nhan/ma_dinh_danh_moet để xác định học viên. Có cả 2 thì phải trỏ cùng 1 hồ sơ.',
        ma_dinh_danh_moet: 'Tùy chọn — xem ghi chú cột so_dinh_danh_ca_nhan.',
        mat_khau_tam:
          'Tùy chọn — để trống nếu học viên không có mật khẩu tạm riêng. Được mã hóa trước khi lưu, không bao giờ hiển thị lại qua API hay file lỗi import.',
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
      | TaiKhoanVleRowDto
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
      case 'tai_khoan_vle':
        return this.buildTaiKhoanVleDto(raw);
    }
  }

  private async checkValid(
    loai: SupportedImportType,
    dto:
      | CreateDiaDanhDto
      | CreateDonViCongTacDto
      | CreateMonHocDto
      | HoSoNhanSuMoetRowDto
      | PhanLopHocVienRowDto
      | TaiKhoanVleRowDto,
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
      } else if (loai === 'tai_khoan_vle') {
        // Không cần kiểm tra thêm: buildTaiKhoanVleDto() (buildDto) đã tra
        // cứu học viên qua resolveHocVienImportRow() rồi — upsert theo PK
        // hoc_vien_id nên không có ràng buộc trùng nào khác cần kiểm tra.
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
      | PhanLopHocVienRowDto
      | TaiKhoanVleRowDto,
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
    } else if (loai === 'tai_khoan_vle') {
      await this.commitTaiKhoanVle(dto as TaiKhoanVleRowDto, importId);
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

  // T15: upsert theo PK hoc_vien_id — chạy lại file (vd Phòng CNTT gửi file
  // cập nhật) ghi đè tài khoản cũ. mat_khau_tam KHÔNG có trong dòng (tùy
  // chọn) -> giữ nguyên mật khẩu mã hóa cũ (undefined trong data Prisma =
  // không đụng tới cột), KHÔNG tự xóa về NULL.
  private async commitTaiKhoanVle(
    dto: TaiKhoanVleRowDto,
    importId: string,
  ): Promise<void> {
    // Cast qua unknown: @types/node gõ Buffer.concat() là Buffer<ArrayBufferLike>
    // nhưng Prisma Client (Bytes field) đòi Uint8Array<ArrayBuffer> — không
    // lệch runtime (Buffer luôn là Uint8Array), chỉ lệch generic parameter.
    const matKhauMaHoa = dto.mat_khau_tam
      ? (encryptVleMatKhau(dto.mat_khau_tam) as unknown as Buffer<ArrayBuffer>)
      : undefined;
    await this.prisma.tai_khoan_vle.upsert({
      where: { hoc_vien_id: dto.hoc_vien_id },
      create: {
        hoc_vien_id: dto.hoc_vien_id,
        ten_dang_nhap_vle: dto.ten_dang_nhap_vle,
        mat_khau_tam_ma_hoa: matKhauMaHoa,
        duong_dan: dto.duong_dan,
        nguon_import_id: importId,
      },
      update: {
        ten_dang_nhap_vle: dto.ten_dang_nhap_vle,
        mat_khau_tam_ma_hoa: matKhauMaHoa,
        duong_dan: dto.duong_dan,
        nguon_import_id: importId,
        cap_nhat_luc: new Date(),
      },
    });
  }

  // SĐT lưu dạng number mất số 0 đầu (T4): đúng 9 chữ số, bắt đầu 3/5/7/8/9
  // -> tự thêm "0" + cảnh báo 🟡 (không chặn dòng). Các sai định dạng khác
  // (thiếu số khác, sai đầu số...) vẫn là lỗi 🔴 theo rule #20 như cũ, xử lý
  // bởi HoSoNhanSuMoetRowDto/checkValidMoetImportRow ở bước sau.
  private static readonly SDT_MAT_SO_0_REGEX = /^[35789]\d{8}$/;

  private suaSoDienThoaiThieuSo0(sdtRaw: string): {
    sdt: string;
    canhBao?: string;
  } {
    const sdt = sdtRaw?.trim() ?? '';
    if (ImportService.SDT_MAT_SO_0_REGEX.test(sdt)) {
      return {
        sdt: `0${sdt}`,
        canhBao: `Số điện thoại "${sdt}" thiếu số 0 đầu (9 chữ số) — đã tự thêm thành "0${sdt}"`,
      };
    }
    return { sdt };
  }

  // Rule #36e: khớp cột "Đơn vị" với don_vi_cong_tac.ten_don_vi — không khớp
  // được hoặc khớp nhiều hơn 1 kết quả -> dòng lỗi (không tự đoán). T4: nếu
  // có cột "Mã đơn vị" (tùy chọn) thì khớp theo mã này TRƯỚC (ưu tiên hơn
  // tên) — cần thiết sau sáp nhập An Giang – Kiên Giang vì tên trường dễ
  // trùng giữa 2 tỉnh cũ. Phạm vi quyền "trong phạm vi quyền của người chạy
  // import" (api-contract.md) không cần lọc thêm ở đây vì toàn bộ
  // ImportController đã @Roles('quan_tri') — scope của quan_tri luôn là
  // 'ALL' (xem ScopeService) nên không có gì để thu hẹp; flagged trong
  // self-review.
  private async buildHoSoMoetDto(
    raw: Record<string, string>,
  ): Promise<RowBuildResult<HoSoNhanSuMoetRowDto>> {
    const maDonVi = raw['Mã đơn vị']?.trim();
    let donViId: string;

    if (maDonVi) {
      const donVi = await this.prisma.don_vi_cong_tac.findUnique({
        where: { ma_don_vi: maDonVi },
      });
      if (!donVi) {
        return {
          error: `Mã đơn vị "${maDonVi}" không tồn tại trong danh mục đơn vị công tác`,
        };
      }
      donViId = donVi.id;
    } else {
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
        const dsMa = matches
          .map((m) => m.ma_don_vi ?? `(id ${m.id})`)
          .join(', ');
        return {
          error: `Đơn vị "${donViTen}" khớp nhiều hơn 1 đơn vị công tác trong danh mục (${dsMa}) — thêm cột "Mã đơn vị" để phân biệt`,
        };
      }
      donViId = matches[0].id;
    }

    const { sdt, canhBao } = this.suaSoDienThoaiThieuSo0(raw['Số điện thoại']);

    const ketQua = await buildValidatedDto(HoSoNhanSuMoetRowDto, {
      ma_dinh_danh_moet: raw['Mã định danh (CDSL moet)'],
      ho_ten: raw['Họ và tên'],
      ngay_sinh: raw['Ngày'],
      thang_sinh: raw['Tháng'],
      nam_sinh: raw['Năm'],
      chuc_vu: raw['Chức vụ'] || undefined,
      chuyen_mon_raw: raw['Chuyên môn'],
      so_dien_thoai_lien_he: sdt,
      ghi_chu: raw['Ghi chú'] || undefined,
      don_vi_cong_tac_id: donViId,
    });
    if (ketQua.error || !ketQua.dto) return ketQua;
    return { dto: ketQua.dto, canhBao };
  }

  // T15 — dùng HocVienResolver dùng chung (mục 2 quy tắc #3) để xác định
  // hoc_vien_id từ so_dinh_danh_ca_nhan/ma_dinh_danh_moet, rồi validate các
  // trường còn lại (TaiKhoanVleRowDto). mat_khau_tam KHÔNG được validate nội
  // dung (bất kỳ chuỗi nào Phòng CNTT sinh ra) — chỉ giới hạn độ dài, mã hóa
  // ngay khi commit (commitTaiKhoanVle), không log ở bất kỳ bước nào.
  private async buildTaiKhoanVleDto(
    raw: Record<string, string>,
  ): Promise<RowBuildResult<TaiKhoanVleRowDto>> {
    const resolved = await resolveHocVienImportRow(this.prisma, {
      so_dinh_danh_ca_nhan: raw.so_dinh_danh_ca_nhan,
      ma_dinh_danh_moet: raw.ma_dinh_danh_moet,
    });
    if (resolved.error || !resolved.hocVien) {
      return { error: resolved.error ?? 'Không xác định được học viên' };
    }
    return buildValidatedDto(TaiKhoanVleRowDto, {
      hoc_vien_id: resolved.hocVien.id,
      ten_dang_nhap_vle: raw.ten_dang_nhap_vle,
      mat_khau_tam: raw.mat_khau_tam || undefined,
      duong_dan: raw.duong_dan,
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
