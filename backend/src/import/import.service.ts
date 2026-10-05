import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { Prisma, loai_danh_muc_import } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DiaDanhService } from '../danh-muc/dia-danh/dia-danh.service';
import { DonViCongTacService } from '../danh-muc/don-vi-cong-tac/don-vi-cong-tac.service';
import { MonHocService } from '../danh-muc/mon-hoc/mon-hoc.service';
import { HocVienService } from '../hoc-vien/hoc-vien.service';
import {
  BoNhoPhanLop,
  KhoaBoiDuongService,
  taoBoNhoPhanLop,
} from '../khoa-boi-duong/khoa-boi-duong.service';
import { DotXacNhanService } from '../dot-xac-nhan/dot-xac-nhan.service';
import { CreateDiaDanhDto } from '../danh-muc/dto/dia-danh.dto';
import { CreateDonViCongTacDto } from '../danh-muc/dto/don-vi-cong-tac.dto';
import { CreateMonHocDto } from '../danh-muc/dto/mon-hoc.dto';
import { HoSoNhanSuMoetRowDto } from '../hoc-vien/dto/import-moet-row.dto';
import { PhanLopHocVienRowDto } from '../khoa-boi-duong/dto/phan-lop-row.dto';
import { KetQuaDanhGiaRowDto } from '../khoa-boi-duong/dto/ket-qua-danh-gia-row.dto';
import { LopVaLichHocRowDto } from '../khoa-boi-duong/dto/lop-va-lich-hoc-row.dto';
import { NhanSuLopRowDto } from '../khoa-boi-duong/dto/nhan-su-lop-row.dto';
import { DiemDanhRowDto } from '../khoa-boi-duong/dto/diem-danh-row.dto';
import { KetQuaGiaiDoanRowDto } from '../khoa-boi-duong/dto/ket-qua-giai-doan-row.dto';
import { TaiKhoanVleRowDto } from './dto/tai-khoan-vle-row.dto';
import { TaiKhoanDonViRowDto } from './dto/tai-khoan-don-vi-row.dto';
import { TaiKhoanDonViService } from '../nguoi-dung/tai-khoan-don-vi.service';
import { chuanHoaTenDangNhap } from '../nguoi-dung/tai-khoan-don-vi.util';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  TaiKhoanDonViDaTao,
  buildMatKhauTamWorkbook,
} from './util/tai-khoan-don-vi-excel.util';
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
  readPhanLopWorkbook,
  tieuDeCotGiaiDoan,
  valuesTheoTieuDe,
} from './util/phan-lop-excel.util';
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
import { KetQuaKhaoSatService } from '../sso/ket-qua-khao-sat.service';
import { ThangMucService } from '../sso/thang-muc.service';
import {
  LOAI_KHAO_SAT,
  LoaiKhaoSat,
  MUC_NANG_LUC,
  MucNangLuc,
  chuanHoaMucGoc,
  TRANG_THAI_BAO_VE,
  TrangThaiBaoVe,
} from '../sso/dto/ket-qua-khao-sat.dto';
import { parseVnDateTime } from '../common/utils/vn-datetime.util';

interface KetQuaKhaoSatRowDto {
  hoc_vien_id: string;
  loai: LoaiKhaoSat;
  trang_thai: TrangThaiBaoVe;
  /** ISO — dto được dựng lại ở bước xác nhận, giữ dạng chuỗi cho chắc. */
  thoi_diem?: string;
  muc?: MucNangLuc;
  diem?: number;
  diem_toi_da?: number;
  muc_goc?: string;
  url_ket_qua?: string;
}
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
    private readonly dotXacNhanService: DotXacNhanService,
    private readonly taiKhoanDonViService: TaiKhoanDonViService,
    private readonly ketQuaKhaoSatService: KetQuaKhaoSatService,
    private readonly thangMucService: ThangMucService,
  ) {}

  assertSupported(loai: string): SupportedImportType {
    if (!isSupportedImportType(loai)) {
      throw new ValidationException(
        `Loại import "${loai}" chưa được hỗ trợ ở phiên bản hiện tại (chỉ hỗ trợ: dia_danh, don_vi_cong_tac, mon_hoc, ho_so_nhan_su_moet, phan_lop_hoc_vien, tai_khoan_vle, ket_qua_danh_gia, lop_va_lich_hoc, diem_danh, ket_qua_giai_doan, nhan_su_lop, tai_khoan_don_vi, ket_qua_khao_sat)`,
      );
    }
    return loai;
  }

  async taiMauExcel(
    loaiRaw: string,
    maKhoa?: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const loai = this.assertSupported(loaiRaw);
    if (loai === 'phan_lop_hoc_vien') {
      const { khoa, columns } = await this.cotPhanLop(maKhoa);
      const buffer = await buildTemplateWorkbook(
        columns,
        await this.ghiChuCotPhanLop(khoa),
      );
      return { buffer, filename: `mau-${loai}-${khoa.ma_khoa}.xlsx` };
    }
    const columns = this.getColumns(loai);
    const buffer = await buildTemplateWorkbook(
      columns,
      this.getColumnNotes(loai),
    );
    return { buffer, filename: `mau-${loai}.xlsx` };
  }

  // phan_lop_hoc_vien (spec 2026-10-02 mục 4.1): cột phụ thuộc giai đoạn
  // ACTIVE của khóa -> bắt buộc ma_khoa cho cả tải mẫu, tải lên và xác nhận.
  private async cotPhanLop(maKhoaRaw?: string) {
    const maKhoa = maKhoaRaw?.trim();
    if (!maKhoa) {
      throw new ValidationException(
        'Import phân lớp học viên bắt buộc chọn khóa (tham số ma_khoa)',
        [{ field: 'ma_khoa', message: 'Bắt buộc' }],
      );
    }
    const khoa = await this.prisma.khoa_boi_duong.findUnique({
      where: { ma_khoa: maKhoa },
      include: {
        giai_doan: {
          where: { trang_thai: 'active' },
          orderBy: { thu_tu: 'asc' },
        },
      },
    });
    if (!khoa) throw new NotFoundAppException(`Khóa "${maKhoa}" không tồn tại`);
    const columns = [
      'so_dinh_danh_ca_nhan',
      'ma_dinh_danh_moet',
      ...khoa.giai_doan.map(tieuDeCotGiaiDoan),
      'ten_cum',
    ];
    return {
      khoa,
      columns,
      thuTuHopLe: new Set(khoa.giai_doan.map((g) => g.thu_tu)),
    };
  }

  // Ghi chú ô tiêu đề mẫu phân lớp: quy ước ô + gợi ý lớp có buổi trong
  // từng giai đoạn.
  private async ghiChuCotPhanLop(khoa: {
    id: string;
    giai_doan: { id: string; thu_tu: number; ten_giai_doan: string }[];
  }): Promise<Record<string, string>> {
    const notes = this.getColumnNotes('phan_lop_hoc_vien');
    for (const gd of khoa.giai_doan) {
      const lops = await this.prisma.lop_hoc.findMany({
        where: {
          khoa_id: khoa.id,
          lich_hoc: { some: { giai_doan_id: gd.id } },
        },
        select: { ten_lop: true },
        orderBy: { ten_lop: 'asc' },
      });
      const goiY = lops.length
        ? `Lớp có buổi trong giai đoạn này: ${lops.map((l) => l.ten_lop).join(', ')}.`
        : 'Chưa có lớp nào có buổi trong giai đoạn này.';
      notes[tieuDeCotGiaiDoan(gd)] =
        `Ô trống = giữ nguyên lớp hiện có; "-" = gỡ khỏi lớp của giai đoạn; tên lớp = gán/thay. ${goiY}`;
    }
    return notes;
  }

  async taoImport(
    loaiRaw: string,
    file: Express.Multer.File | undefined,
    nguoiImportId: string,
    maKhoaMacDinh?: string,
  ) {
    const loai = this.assertSupported(loaiRaw);
    if (!file || !file.buffer?.length) {
      throw new ValidationException('Thiếu file tải lên', [
        { field: 'file', message: 'Bắt buộc' },
      ]);
    }
    // phan_lop_hoc_vien: cột sinh theo giai đoạn của khóa, đọc bằng
    // readPhanLopWorkbook; file lỗi dùng đúng tiêu đề người dùng đã nộp.
    const phanLop =
      loai === 'phan_lop_hoc_vien'
        ? await this.cotPhanLop(maKhoaMacDinh)
        : undefined;
    let columns = this.getColumns(loai);
    const maKhoa = phanLop
      ? undefined
      : await this.kiemTraMaKhoaMacDinh(columns, maKhoaMacDinh);

    let rows: Awaited<ReturnType<typeof readWorkbookRows>>;
    try {
      if (phanLop) {
        const doc = await readPhanLopWorkbook(file.buffer, phanLop.thuTuHopLe);
        columns = doc.headers;
        rows = doc.rows;
      } else {
        rows = await this.readRows(loai, file.buffer, columns);
      }
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
    // T6: phát hiện 2 dòng trùng nhau trong CÙNG FILE — lop_va_lich_hoc dùng
    // key (lớp, giai đoạn, buổi) (xem
    // KhoaBoiDuongService.resolveLopVaLichHocRow); T4d (2026-09-30):
    // ho_so_nhan_su_moet dùng key theo ma_dinh_danh_moet/so_dinh_danh_ca_nhan
    // (xem HocVienService.checkValidMoetImportRow) — reset mỗi lượt gọi
    // taoImport()/xacNhan() (không dùng chung giữa 2 lượt preview/xác nhận
    // vì mỗi lượt đọc lại toàn bộ file từ đầu).
    const dupKeys = new Set<string>();
    // phan_lop_hoc_vien: tra lớp/cảnh báo 1 lần cho cả lượt (xem BoNhoPhanLop).
    const boNho = taoBoNhoPhanLop();

    for (const row of rows) {
      const apDung = this.apDungMaKhoaMacDinh(row.values, maKhoa);
      if ('error' in apDung) {
        danhSachLoi.push({ dong: row.dong, ly_do: apDung.error });
        continue;
      }
      const { dto, error, canhBao } = await this.buildDto(
        loai,
        apDung.values,
        dupKeys,
        phanLop?.khoa,
        boNho,
      );
      if (error || !dto) {
        danhSachLoi.push({
          dong: row.dong,
          ly_do: error ?? 'Không dựng được dữ liệu dòng',
        });
        continue;
      }
      if (canhBao) danhSachCanhBao.push({ dong: row.dong, ly_do: canhBao });
      const checkErr = await this.checkValid(loai, dto, dupKeys);
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
      ma_khoa_mac_dinh: phanLop?.khoa.ma_khoa ?? maKhoa,
    });
    if (danhSachLoi.length > 0) {
      const rowsByDong = new Map(rows.map((r) => [r.dong, r.values]));
      const buffer = await buildLoiWorkbook(
        columns,
        danhSachLoi.map((l) => ({
          dong: l.dong,
          values: this.redactChoFileLoi(
            loai,
            phanLop
              ? valuesTheoTieuDe(columns, rowsByDong.get(l.dong) ?? {})
              : (rowsByDong.get(l.dong) ?? {}),
          ),
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
      so_hoc_vien_chua_co_email: ketQua?.so_hoc_vien_chua_co_email ?? 0,
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
    return (await this.xacNhanVoiFile(id)).nhat_ky;
  }

  // Tài khoản đơn vị (ADR 0002): loại tai_khoan_don_vi trả thêm file Excel
  // mật khẩu tạm (chỉ trong response, không lưu); loại khác file_mat_khau
  // luôn undefined.
  async xacNhanVoiFile(id: string) {
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

    let columns = this.getColumns(loai);
    const fileGoc = await docFileGoc(id);
    const phanLop =
      loai === 'phan_lop_hoc_vien'
        ? await this.cotPhanLop(ketQuaCu.ma_khoa_mac_dinh)
        : undefined;
    let rows: Awaited<ReturnType<typeof readWorkbookRows>>;
    if (phanLop) {
      const doc = await readPhanLopWorkbook(fileGoc, phanLop.thuTuHopLe);
      columns = doc.headers;
      rows = doc.rows;
    } else {
      rows = await this.readRows(loai, fileGoc, columns);
    }
    const rowsByDong = new Map(rows.map((r) => [r.dong, r.values]));

    const danhSachLoiMoi = [...ketQuaCu.danh_sach_loi];
    const danhSachCanhBaoMoi = [...(ketQuaCu.danh_sach_canh_bao ?? [])];
    let soDongThanhCong = 0;
    // T3 (mo-rong-nls-an-giang.md, QĐ6): chỉ tăng khi commitRow() báo
    // hocVienChuaCoEmail=true (phan_lop_hoc_vien, nhánh gán lop_id thực sự).
    let soHocVienChuaCoEmail = 0;
    // T6: xem ghi chú dupKeys ở taoImport() — reset riêng cho lượt xác nhận
    // này (đọc lại file từ đầu).
    const dupKeys = new Set<string>();
    // phan_lop_hoc_vien: tra lớp/cảnh báo 1 lần cho cả lượt (xem BoNhoPhanLop).
    const boNho = taoBoNhoPhanLop();
    const taiKhoanDaTao: TaiKhoanDonViDaTao[] = [];

    for (const dong of ketQuaCu.dong_hop_le) {
      const values = rowsByDong.get(dong);
      if (!values) {
        danhSachLoiMoi.push({
          dong,
          ly_do: 'Không đọc lại được dòng từ file gốc',
        });
        continue;
      }
      const apDung = this.apDungMaKhoaMacDinh(
        values,
        phanLop ? undefined : ketQuaCu.ma_khoa_mac_dinh,
      );
      if ('error' in apDung) {
        danhSachLoiMoi.push({ dong, ly_do: apDung.error });
        continue;
      }
      const { dto, error } = await this.buildDto(
        loai,
        apDung.values,
        dupKeys,
        phanLop?.khoa,
        boNho,
      );
      if (error || !dto) {
        danhSachLoiMoi.push({
          dong,
          ly_do: error ?? 'Không dựng được dữ liệu dòng',
        });
        continue;
      }
      try {
        const { hocVienChuaCoEmail, taiKhoanDonVi } = await this.commitRow(
          loai,
          dto,
          id,
          nhatKy.nguoi_import_id,
          dupKeys,
        );
        if (hocVienChuaCoEmail) soHocVienChuaCoEmail++;
        if (taiKhoanDonVi) taiKhoanDaTao.push(taiKhoanDonVi);
        soDongThanhCong++;
      } catch (e) {
        danhSachLoiMoi.push({ dong, ly_do: toRowErrorMessage(e) });
      }
    }

    await luuKetQua(id, {
      danh_sach_loi: danhSachLoiMoi,
      dong_hop_le: [],
      danh_sach_canh_bao: danhSachCanhBaoMoi,
      so_hoc_vien_chua_co_email: soHocVienChuaCoEmail,
    });
    if (danhSachLoiMoi.length > 0) {
      const buffer = await buildLoiWorkbook(
        columns,
        danhSachLoiMoi.map((l) => ({
          dong: l.dong,
          values: this.redactChoFileLoi(
            loai,
            phanLop
              ? valuesTheoTieuDe(columns, rowsByDong.get(l.dong) ?? {})
              : (rowsByDong.get(l.dong) ?? {}),
          ),
          ly_do: l.ly_do,
        })),
      );
      await luuFileLoi(id, buffer);
    }

    const nhatKyMoi = await this.prisma.nhat_ky_import.update({
      where: { id },
      data: {
        so_dong_thanh_cong: soDongThanhCong,
        so_dong_loi: danhSachLoiMoi.length,
        trang_thai: 'hoan_thanh',
        file_loi_url:
          danhSachLoiMoi.length > 0 ? `/import/${id}/file-loi` : null,
      },
    });
    return {
      nhat_ky: nhatKyMoi,
      file_mat_khau:
        loai === 'tai_khoan_don_vi'
          ? await buildMatKhauTamWorkbook(taiKhoanDaTao)
          : undefined,
    };
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
        // Phân lớp theo giai đoạn (spec 2026-10-02): chỉ là các cột CỐ ĐỊNH —
        // cột "GĐ<n> - <tên>" sinh theo giai đoạn của khóa, xem cotPhanLop().
        return ['so_dinh_danh_ca_nhan', 'ma_dinh_danh_moet', 'ten_cum'];
      case 'ho_so_nhan_su_moet':
        // Nguyên văn cột theo docs/api-contract.md mục 2 "Luồng import nhân
        // sự từ CSDL MOET". "Mã đơn vị" thêm ở T4 (mo-rong-nls-an-giang.md) —
        // tùy chọn, chỉ dùng để phân biệt khi 2 trường trùng tên sau sáp
        // nhập An Giang – Kiên Giang. "Mã định danh (CDSL moet)" và "Số định
        // danh cá nhân" đều tùy chọn ở cấp file từ T4b (2026-09-29) — mỗi
        // DÒNG vẫn phải có ít nhất 1 (xem getColumnNotes). Đọc file thật qua
        // readMoetWorkbookRows (không phụ thuộc thứ tự cột trong mảng này) —
        // mảng này chỉ dùng để sinh file mẫu/file lỗi.
        return [
          'Đơn vị',
          'Mã đơn vị',
          'Mã định danh (CDSL moet)',
          'Số định danh cá nhân',
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
      case 'ket_qua_khao_sat':
        // 2026-10-04: file kết quả xuất từ hệ thống khảo sát (dự phòng cho
        // POST /sso/ket-qua). Cùng quy tắc gộp với API.
        return [
          'so_dinh_danh_ca_nhan',
          'ma_dinh_danh_moet',
          'loai',
          'trang_thai',
          'thoi_diem',
          'muc',
          'diem',
          'diem_toi_da',
          'muc_goc',
          'url_ket_qua',
        ];
      case 'ket_qua_danh_gia':
        // T5 (mo-rong-nls-an-giang.md): mã học viên dùng chung HocVienResolver
        // (mục 2 quy tắc #3, cả 2 cột tùy chọn — xem getColumnNotes). ma_khoa
        // phải đã có dang_ky_hoc cho học viên đó (ghi danh T3 trước). loai =
        // "dau_vao"|"dau_ra", muc = "co_ban"|"thanh_thao"|"nang_cao".
        return [
          'so_dinh_danh_ca_nhan',
          'ma_dinh_danh_moet',
          'ma_khoa',
          'loai',
          'muc',
        ];
      case 'lop_va_lich_hoc':
        // T6 (mo-rong-nls-an-giang.md): mỗi dòng = 1 buổi học. ma_diem_hoc
        // TÙY CHỌN — T10 (điểm học) chưa làm, chưa có bảng nào để lưu, đọc
        // cột nhưng bỏ qua (xem KhoaBoiDuongService.resolveLopVaLichHocRow),
        // KHÔNG báo lỗi vì cột lạ. loai_lop thêm ở QĐ10 (2026-09-30) — TÙY
        // CHỌN, mặc định "truc_tiep" nếu để trống (lop_hoc.loai_lop nay bắt
        // buộc NOT NULL).
        return [
          'ma_khoa',
          'ten_lop',
          'loai_lop',
          'nhom_hoc_vien',
          'muc_nang_luc',
          'si_so_toi_da',
          'giai_doan_thu_tu',
          'buoi_so',
          'bat_dau',
          'ket_thuc',
          'dia_diem_hoac_link',
          'ma_diem_hoc',
        ];
      case 'diem_danh':
        // T12 (mo-rong-nls-an-giang.md): điểm danh nhập qua IMPORT EXCEL
        // (không có giao diện chấm tay từng buổi). loai_lop BẮT BUỘC (khác
        // lop_va_lich_hoc dùng loai_lop tùy chọn) — điểm danh gắn với 1 buổi
        // cụ thể của 1 lớp cụ thể, không có mặc định an toàn để suy đoán
        // (xem KhoaBoiDuongService.resolveDiemDanhRow). ghi_chu tùy chọn
        // NHƯNG bắt buộc khi buổi thuộc lớp khác lớp học viên đang được gán
        // (học bù).
        return [
          'so_dinh_danh_ca_nhan',
          'ma_dinh_danh_moet',
          'ma_khoa',
          'ten_lop',
          'loai_lop',
          'giai_doan_thu_tu',
          'buoi_so',
          'trang_thai',
          'nguon',
          'ghi_chu',
        ];
      case 'ket_qua_giai_doan':
        // T12 (mo-rong-nls-an-giang.md): tiến độ/kết quả theo từng giai đoạn
        // (vd tiến độ VLE, điểm đánh giá giai đoạn). ty_le_hoan_thanh/diem
        // đều tùy chọn.
        return [
          'so_dinh_danh_ca_nhan',
          'ma_dinh_danh_moet',
          'ma_khoa',
          'giai_doan_thu_tu',
          'ty_le_hoan_thanh',
          'diem',
        ];
      case 'tai_khoan_don_vi':
        return ['ma_don_vi', 'ten_dang_nhap', 'ho_ten', 'email'];
      case 'nhan_su_lop':
        // Mỗi dòng = 1 nhân sự (giảng viên/hỗ trợ) của 1 lớp ĐÃ TỒN TẠI (xem
        // KhoaBoiDuongService.resolveNhanSuLopRow).
        return [
          'ma_khoa',
          'ten_lop',
          'loai_lop',
          'ho_ten',
          'vai_tro',
          'so_dien_thoai',
        ];
    }
  }

  // ?ma_khoa= (import từ trang chi tiết khóa): chỉ hợp lệ với loại có cột
  // ma_khoa, và khóa phải tồn tại — báo lỗi cả lượt ngay, không để mọi dòng
  // cùng lỗi "Khóa không tồn tại".
  private async kiemTraMaKhoaMacDinh(
    columns: string[],
    maKhoaRaw?: string,
  ): Promise<string | undefined> {
    const maKhoa = maKhoaRaw?.trim();
    if (!maKhoa) return undefined;
    if (!columns.includes('ma_khoa')) {
      throw new ValidationException(
        'Loại import này không có cột "ma_khoa", không dùng được tham số ma_khoa',
        [{ field: 'ma_khoa', message: 'Không áp dụng cho loại import này' }],
      );
    }
    const khoa = await this.prisma.khoa_boi_duong.findUnique({
      where: { ma_khoa: maKhoa },
    });
    if (!khoa) {
      throw new NotFoundAppException(`Khóa "${maKhoa}" không tồn tại`);
    }
    return maKhoa;
  }

  // Dòng để trống ma_khoa -> gán khóa mặc định; dòng ghi khóa KHÁC -> lỗi
  // dòng (chặn import nhầm sang khóa khác từ trang chi tiết khóa). Không có
  // khóa mặc định -> giữ nguyên hành vi cũ.
  private apDungMaKhoaMacDinh(
    values: Record<string, string>,
    maKhoa?: string,
  ): { values: Record<string, string> } | { error: string } {
    if (!maKhoa) return { values };
    const maTrongDong = values.ma_khoa?.trim();
    if (!maTrongDong) return { values: { ...values, ma_khoa: maKhoa } };
    if (maTrongDong !== maKhoa) {
      return {
        error: `Dòng thuộc khóa "${maTrongDong}", khác khóa đang import "${maKhoa}"`,
      };
    }
    return { values };
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
        so_dinh_danh_ca_nhan:
          'Tùy chọn — phải có ít nhất 1 trong 2 cột so_dinh_danh_ca_nhan/ma_dinh_danh_moet để xác định học viên. Có cả 2 thì phải trỏ cùng 1 hồ sơ.',
        ma_dinh_danh_moet: 'Tùy chọn — xem ghi chú cột so_dinh_danh_ca_nhan.',
        ten_cum:
          'Tùy chọn — tên cụm học viên (nhóm Zalo hỗ trợ). Để trống = giữ nguyên cụm hiện có.',
      };
    }
    if (loai === 'ho_so_nhan_su_moet') {
      return {
        'Mã đơn vị':
          'Tùy chọn — chỉ cần điền khi tên đơn vị ở cột "Đơn vị" trùng với đơn vị khác trong danh mục (vd cùng địa danh sau sáp nhập). Nếu có giá trị, hệ thống khớp theo mã này thay vì tên.',
        'Mã định danh (CDSL moet)':
          'Tùy chọn — phải có ít nhất 1 trong 2 cột "Mã định danh (CDSL moet)"/"Số định danh cá nhân" (T4b, 2026-09-29 — 2 mã không giả định trùng nhau). Có giá trị sẽ ưu tiên dùng làm tên đăng nhập.',
        'Số định danh cá nhân':
          'Tùy chọn — xem ghi chú cột "Mã định danh (CDSL moet)". Đúng 12 chữ số khi có giá trị.',
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
    if (loai === 'ket_qua_danh_gia') {
      return {
        so_dinh_danh_ca_nhan:
          'Tùy chọn — phải có ít nhất 1 trong 2 cột so_dinh_danh_ca_nhan/ma_dinh_danh_moet để xác định học viên. Có cả 2 thì phải trỏ cùng 1 hồ sơ.',
        ma_dinh_danh_moet: 'Tùy chọn — xem ghi chú cột so_dinh_danh_ca_nhan.',
        ma_khoa:
          'Học viên phải đã được ghi danh vào khóa này (import phan_lop_hoc_vien, T3) trước — nếu chưa, dòng sẽ báo lỗi.',
        loai: 'Bắt buộc — chỉ nhận "dau_vao" hoặc "dau_ra".',
        muc: 'Bắt buộc — chỉ nhận "co_ban", "thanh_thao" hoặc "nang_cao". Chạy lại file với giá trị mới sẽ ghi đè giá trị cũ.',
      };
    }
    if (loai === 'ket_qua_khao_sat') {
      return {
        so_dinh_danh_ca_nhan:
          'Tùy chọn — phải có ít nhất 1 trong 2 cột so_dinh_danh_ca_nhan/ma_dinh_danh_moet để xác định học viên. Có cả 2 thì phải trỏ cùng 1 hồ sơ.',
        ma_dinh_danh_moet: 'Tùy chọn — xem ghi chú cột so_dinh_danh_ca_nhan.',
        loai: 'Bắt buộc — "khao-sat" (phiếu khảo sát kĩ năng số), "danh-gia" (phiếu đánh giá năng lực số) hoặc "dau-ra".',
        trang_thai:
          'Bắt buộc — "dang_lam" hoặc "hoan_thanh". "dang_lam" không ghi đè bài đã hoàn thành.',
        thoi_diem:
          'Tùy chọn — "dd/mm/yyyy hh:mm", giờ Việt Nam; để trống = lúc import. Dòng hoàn thành cũ hơn kết quả đã có sẽ bị bỏ qua.',
        muc: 'Tùy chọn — "co_ban", "thanh_thao" hoặc "nang_cao". Chỉ để hiển thị, KHÔNG đổi mức đầu vào của học viên (dùng import ket_qua_danh_gia).',
        diem: 'Tùy chọn — số từ 0 đến 9999, tối đa 2 chữ số thập phân. Chỉ quản trị xem được.',
        muc_goc:
          'Tùy chọn — mã mức theo thang mức quản trị cấu hình (mặc định "M1" Chưa đạt, "M2" Cơ bản, "M3" Thành thạo, "M4" Nâng cao). Học viên thấy nhãn tương ứng.',
        url_ket_qua:
          'Tùy chọn — đường dẫn trang kết quả chi tiết, phải thuộc tên miền hệ thống khảo sát.',
        diem_toi_da:
          'Tùy chọn — điểm tối đa của bài (vd 44), lớn hơn 0 và không nhỏ hơn diem. Để hiển thị "điểm / tối đa (%)".',
      };
    }
    if (loai === 'lop_va_lich_hoc') {
      return {
        ma_khoa:
          'Bắt buộc — có thể để trống khi import từ trang chi tiết khóa (hệ thống tự gán khóa đang xem).',
        loai_lop:
          'Tùy chọn — "truc_tiep", "zoom" hoặc "vle". Mặc định "truc_tiep" nếu để trống.',
        nhom_hoc_vien: 'Tùy chọn — số nguyên từ 1 đến 20.',
        muc_nang_luc:
          'Tùy chọn — "co_ban", "thanh_thao" hoặc "nang_cao". Dùng để cảnh báo khi phân lớp nếu khác mức đầu vào của học viên.',
        si_so_toi_da: 'Tùy chọn — số nguyên dương.',
        bat_dau: 'Bắt buộc — định dạng "dd/mm/yyyy hh:mm", giờ Việt Nam.',
        ket_thuc:
          'Bắt buộc — định dạng "dd/mm/yyyy hh:mm", giờ Việt Nam, phải lớn hơn bat_dau.',
        dia_diem_hoac_link: 'Tùy chọn — tối đa 500 ký tự.',
        ma_diem_hoc:
          'Tùy chọn — CHƯA sử dụng ở phiên bản hiện tại (chờ T10), điền vào sẽ bị bỏ qua.',
      };
    }
    if (loai === 'diem_danh') {
      return {
        so_dinh_danh_ca_nhan:
          'Tùy chọn — phải có ít nhất 1 trong 2 cột so_dinh_danh_ca_nhan/ma_dinh_danh_moet để xác định học viên. Có cả 2 thì phải trỏ cùng 1 hồ sơ.',
        ma_dinh_danh_moet: 'Tùy chọn — xem ghi chú cột so_dinh_danh_ca_nhan.',
        loai_lop:
          'Bắt buộc — "truc_tiep", "zoom" hoặc "vle". Dùng để xác định đúng lớp khi có nhiều lớp trùng tên khác loại trong cùng khóa.',
        trang_thai: 'Bắt buộc — chỉ nhận "co_mat", "vang" hoặc "vang_co_phep".',
        nguon: 'Bắt buộc — chỉ nhận "zoom", "ky_ten", "qr" hoặc "thu_cong".',
        ghi_chu:
          'Tùy chọn — BẮT BUỘC nếu buổi điểm danh thuộc lớp KHÁC lớp học viên đang được gán (học bù), thiếu sẽ báo lỗi.',
      };
    }
    if (loai === 'ket_qua_giai_doan') {
      return {
        so_dinh_danh_ca_nhan:
          'Tùy chọn — phải có ít nhất 1 trong 2 cột so_dinh_danh_ca_nhan/ma_dinh_danh_moet để xác định học viên. Có cả 2 thì phải trỏ cùng 1 hồ sơ.',
        ma_dinh_danh_moet: 'Tùy chọn — xem ghi chú cột so_dinh_danh_ca_nhan.',
        ty_le_hoan_thanh: 'Tùy chọn — số từ 0 đến 100.',
        diem: 'Tùy chọn — điểm số.',
      };
    }
    if (loai === 'tai_khoan_don_vi') {
      return {
        ma_don_vi:
          'Bắt buộc — mã đơn vị trong danh mục (Sở GD&ĐT, Phòng VHXH hoặc Trường đang hoạt động). Mỗi đơn vị chỉ 1 tài khoản.',
        ten_dang_nhap:
          'Tùy chọn — tên gợi nhớ (vd sgd-angiang): chữ thường không dấu, số, . _ - (3–50 ký tự). Để trống = dùng mã đơn vị viết thường.',
        ho_ten: 'Tùy chọn — người phụ trách. Để trống = dùng tên đơn vị.',
        email:
          'Tùy chọn — có email: hệ thống gửi link kích hoạt (72 giờ). Không email: mật khẩu tạm nằm trong file kết quả tải về 1 lần khi xác nhận nạp.',
      };
    }
    if (loai === 'nhan_su_lop') {
      return {
        ma_khoa:
          'Bắt buộc — có thể để trống khi import từ trang chi tiết khóa (hệ thống tự gán khóa đang xem).',
        ten_lop:
          'Bắt buộc — lớp phải đã tồn tại (tạo qua import lop_va_lich_hoc hoặc giao diện trước).',
        loai_lop:
          'Bắt buộc — "truc_tiep", "zoom" hoặc "vle". Dùng để xác định đúng lớp khi có nhiều lớp trùng tên khác loại.',
        ho_ten:
          'Bắt buộc — chạy lại file cùng họ tên trong cùng lớp sẽ cập nhật vai trò/SĐT, không tạo trùng.',
        vai_tro: 'Bắt buộc — chỉ nhận "giang_vien" hoặc "ho_tro".',
        so_dien_thoai:
          'Tùy chọn — tối đa 20 ký tự. Để trống khi chạy lại file sẽ giữ nguyên số cũ.',
      };
    }
    return {};
  }

  // Rule #24/#36e: "Chuyên môn" có thể nhiều giá trị/dòng, phân tách bằng ";".
  // T4c: raw có thể undefined (cột trống, dòng import_moet thiếu chuyên môn).
  private splitChuyenMon(raw?: string): string[] {
    return (raw ?? '')
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private async buildDto(
    loai: SupportedImportType,
    raw: Record<string, string>,
    dupKeys?: Set<string>,
    khoaPhanLop?: Parameters<KhoaBoiDuongService['resolvePhanLopRow']>[1],
    boNho?: BoNhoPhanLop,
  ): Promise<
    RowBuildResult<
      | CreateDiaDanhDto
      | CreateDonViCongTacDto
      | CreateMonHocDto
      | HoSoNhanSuMoetRowDto
      | PhanLopHocVienRowDto
      | TaiKhoanVleRowDto
      | KetQuaDanhGiaRowDto
      | LopVaLichHocRowDto
      | DiemDanhRowDto
      | KetQuaGiaiDoanRowDto
      | NhanSuLopRowDto
      | TaiKhoanDonViRowDto
      | KetQuaKhaoSatRowDto
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
        if (!khoaPhanLop) {
          return { error: 'Thiếu khóa (ma_khoa) cho import phân lớp' };
        }
        return this.khoaBoiDuongService.resolvePhanLopRow(
          raw,
          khoaPhanLop,
          dupKeys,
          boNho,
        );
      case 'ho_so_nhan_su_moet':
        return this.buildHoSoMoetDto(raw);
      case 'tai_khoan_vle':
        return this.buildTaiKhoanVleDto(raw);
      case 'ket_qua_danh_gia': {
        const resolved = await this.khoaBoiDuongService.resolveKetQuaDanhGiaRow(
          {
            so_dinh_danh_ca_nhan: raw.so_dinh_danh_ca_nhan,
            ma_dinh_danh_moet: raw.ma_dinh_danh_moet,
            ma_khoa: raw.ma_khoa,
            loai: raw.loai,
            muc: raw.muc,
          },
        );
        if (resolved.error || !resolved.dto) return resolved;
        const ma =
          raw.so_dinh_danh_ca_nhan?.trim() || raw.ma_dinh_danh_moet?.trim();
        const canhBao = await this.canhBaoLachCongDanhGia(
          resolved.dto.hoc_vien_id,
          ma ?? '',
        );
        return { dto: resolved.dto, canhBao };
      }
      case 'lop_va_lich_hoc':
        return this.khoaBoiDuongService.resolveLopVaLichHocRow(
          {
            ma_khoa: raw.ma_khoa,
            ten_lop: raw.ten_lop,
            loai_lop: raw.loai_lop,
            nhom_hoc_vien: raw.nhom_hoc_vien,
            muc_nang_luc: raw.muc_nang_luc,
            si_so_toi_da: raw.si_so_toi_da,
            giai_doan_thu_tu: raw.giai_doan_thu_tu,
            buoi_so: raw.buoi_so,
            bat_dau: raw.bat_dau,
            ket_thuc: raw.ket_thuc,
            dia_diem_hoac_link: raw.dia_diem_hoac_link,
          },
          dupKeys,
        );
      case 'diem_danh':
        return this.khoaBoiDuongService.resolveDiemDanhRow(
          {
            so_dinh_danh_ca_nhan: raw.so_dinh_danh_ca_nhan,
            ma_dinh_danh_moet: raw.ma_dinh_danh_moet,
            ma_khoa: raw.ma_khoa,
            ten_lop: raw.ten_lop,
            loai_lop: raw.loai_lop,
            giai_doan_thu_tu: raw.giai_doan_thu_tu,
            buoi_so: raw.buoi_so,
            trang_thai: raw.trang_thai,
            nguon: raw.nguon,
            ghi_chu: raw.ghi_chu,
          },
          dupKeys,
        );
      case 'ket_qua_giai_doan':
        return this.khoaBoiDuongService.resolveKetQuaGiaiDoanRow({
          so_dinh_danh_ca_nhan: raw.so_dinh_danh_ca_nhan,
          ma_dinh_danh_moet: raw.ma_dinh_danh_moet,
          ma_khoa: raw.ma_khoa,
          giai_doan_thu_tu: raw.giai_doan_thu_tu,
          ty_le_hoan_thanh: raw.ty_le_hoan_thanh,
          diem: raw.diem,
        });
      case 'tai_khoan_don_vi':
        return this.buildTaiKhoanDonViDto(raw, dupKeys);
      case 'ket_qua_khao_sat':
        return this.buildKetQuaKhaoSatDto(raw, dupKeys);
      case 'nhan_su_lop':
        return this.khoaBoiDuongService.resolveNhanSuLopRow(
          {
            ma_khoa: raw.ma_khoa,
            ten_lop: raw.ten_lop,
            loai_lop: raw.loai_lop,
            ho_ten: raw.ho_ten,
            vai_tro: raw.vai_tro,
            so_dien_thoai: raw.so_dien_thoai,
          },
          dupKeys,
        );
    }
  }

  // T5 (mo-rong-nls-an-giang.md mục 2 dòng 247, cùng đoạn spec với T15 — cách
  // B "chặn mềm" nghĩa là tài khoản VLE tồn tại cho MỌI học viên bất kể đủ
  // điều kiện hay không): học viên có kết quả đánh giá (import
  // ket_qua_danh_gia thành công) nhưng KHÔNG đủ điều kiện làm đánh giá đầu
  // vào (cùng 2 điều kiện dùng bởi HocVienService.danhGiaDauVaoCuaToi: có
  // xác nhận CÒN HIỆU LỰC ở đợt xac_nhan_truoc_danh_gia VÀ day_du=true, cả 2
  // TẠI THỜI ĐIỂM IMPORT) -> cảnh báo 🟡 không chặn dòng, giúp N1 phát hiện
  // trường hợp lách cổng (dùng VLE dù chưa được phép).
  private async canhBaoLachCongDanhGia(
    hocVienId: string,
    ma: string,
  ): Promise<string | undefined> {
    const hocVien = await this.prisma.hoc_vien.findUnique({
      where: { id: hocVienId },
      include: { chuyen_mon: true },
    });
    if (!hocVien) return undefined;
    const [{ day_du }, daXacNhan] = await Promise.all([
      this.hocVienService.danhGiaDayDu(hocVien),
      this.dotXacNhanService.coXacNhanTruocDanhGiaConHieuLuc(hocVienId),
    ]);
    if (day_du && daXacNhan) return undefined;
    return `Học viên "${ma}" có kết quả đánh giá nhưng CHƯA đủ điều kiện làm đánh giá đầu vào tại thời điểm import (chưa xác nhận đợt xác nhận trước đánh giá hoặc hồ sơ chưa đầy đủ) — kiểm tra khả năng lách cổng`;
  }

  // Tài khoản đơn vị (ADR 0002): tra đơn vị theo ma_don_vi (trim, không phân
  // biệt hoa/thường), chặn trùng mã/tên đăng nhập/email TRONG FILE, rồi chạy
  // cùng bộ quy tắc với POST /nguoi-dung/don-vi (chuanBiTao).
  private async buildTaiKhoanDonViDto(
    raw: Record<string, string>,
    dupKeys?: Set<string>,
  ): Promise<RowBuildResult<TaiKhoanDonViRowDto>> {
    const ma = (raw.ma_don_vi ?? '').trim();
    if (!ma) return { error: 'Thiếu ma_don_vi' };
    const donVi = await this.prisma.don_vi_cong_tac.findFirst({
      where: { ma_don_vi: { equals: ma, mode: 'insensitive' } },
    });
    if (!donVi) return { error: `Không tìm thấy đơn vị có mã "${ma}"` };

    const tenNhap = raw.ten_dang_nhap?.trim() || undefined;
    const hoTen = raw.ho_ten?.trim() || undefined;
    const email = raw.email?.trim().toLowerCase() || undefined;
    const khoa: [string, string][] = [
      [`tkdv-ma:${donVi.id}`, 'mã đơn vị'],
      [
        `tkdv-ten:${chuanHoaTenDangNhap(tenNhap ?? donVi.ma_don_vi)}`,
        'tên đăng nhập',
      ],
    ];
    if (email) khoa.push([`tkdv-email:${email}`, 'email']);
    const trung = khoa.find(([k]) => dupKeys?.has(k));
    if (trung) return { error: `Trùng ${trung[1]} với dòng khác trong file` };
    khoa.forEach(([k]) => dupKeys?.add(k));

    const { loi } = await this.taiKhoanDonViService.chuanBiTao({
      don_vi_id: donVi.id,
      ten_dang_nhap: tenNhap,
      ho_ten: hoTen,
      email,
      cach_cap: email ? 'email' : 'mat_khau_tam',
    });
    if (loi.length > 0) return { error: loi.map((l) => l.message).join('; ') };
    return {
      dto: {
        ma_don_vi: donVi.ma_don_vi,
        ten_don_vi: donVi.ten_don_vi,
        don_vi_id: donVi.id,
        ten_dang_nhap: tenNhap,
        ho_ten: hoTen,
        email,
      },
    };
  }

  private async checkValid(
    loai: SupportedImportType,
    dto:
      | CreateDiaDanhDto
      | CreateDonViCongTacDto
      | CreateMonHocDto
      | HoSoNhanSuMoetRowDto
      | PhanLopHocVienRowDto
      | TaiKhoanVleRowDto
      | KetQuaDanhGiaRowDto
      | LopVaLichHocRowDto
      | DiemDanhRowDto
      | KetQuaGiaiDoanRowDto
      | NhanSuLopRowDto
      | TaiKhoanDonViRowDto
      | KetQuaKhaoSatRowDto,
    dupKeys?: Set<string>,
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
      } else if (loai === 'ket_qua_danh_gia') {
        // Không cần kiểm tra thêm: resolveKetQuaDanhGiaRow() (buildDto) đã
        // tra cứu học viên + khóa + dang_ky_hoc đã tồn tại rồi.
      } else if (loai === 'lop_va_lich_hoc') {
        // Không cần kiểm tra thêm: resolveLopVaLichHocRow() (buildDto) đã
        // tra cứu FK + validate định dạng + trùng lặp trong file rồi.
      } else if (loai === 'diem_danh') {
        // Không cần kiểm tra thêm: resolveDiemDanhRow() (buildDto) đã tra
        // cứu FK + quy tắc học bù + trùng lặp trong file rồi.
      } else if (loai === 'ket_qua_giai_doan') {
        // Không cần kiểm tra thêm: resolveKetQuaGiaiDoanRow() (buildDto) đã
        // tra cứu FK + phạm vi giá trị rồi.
      } else if (loai === 'tai_khoan_don_vi') {
        // Không cần kiểm tra thêm: buildTaiKhoanDonViDto() đã chạy
        // TaiKhoanDonViService.chuanBiTao() (cùng quy tắc với POST tạo lẻ).
      } else if (loai === 'ket_qua_khao_sat') {
        // Không cần kiểm tra thêm: buildKetQuaKhaoSatDto() đã tra học viên +
        // validate giá trị + trùng lặp trong file rồi.
      } else if (loai === 'nhan_su_lop') {
        // Không cần kiểm tra thêm: resolveNhanSuLopRow() (buildDto) đã tra
        // cứu lớp + validate + trùng lặp trong file rồi.
      } else {
        const d = dto as HoSoNhanSuMoetRowDto;
        await this.hocVienService.checkValidMoetImportRow(
          {
            ma_dinh_danh_moet: d.ma_dinh_danh_moet,
            so_dinh_danh_ca_nhan: d.so_dinh_danh_ca_nhan,
            ho_ten: d.ho_ten,
            ngay_sinh: d.ngay_sinh,
            thang_sinh: d.thang_sinh,
            nam_sinh: d.nam_sinh,
            so_dien_thoai_lien_he: d.so_dien_thoai_lien_he,
            chuyen_mon: this.splitChuyenMon(d.chuyen_mon_raw),
            don_vi_cong_tac_id: d.don_vi_cong_tac_id,
          },
          dupKeys,
        );
      }
      return undefined;
    } catch (e) {
      return toRowErrorMessage(e);
    }
  }

  // Trả về hocVienChuaCoEmail (T3, QĐ6) — chỉ phan_lop_hoc_vien có ý nghĩa
  // (xem KhoaBoiDuongService.commitPhanLop); các loại khác luôn {} (undefined
  // ~ không tính), để xacNhan() đếm so_hoc_vien_chua_co_email.
  private async commitRow(
    loai: SupportedImportType,
    dto:
      | CreateDiaDanhDto
      | CreateDonViCongTacDto
      | CreateMonHocDto
      | HoSoNhanSuMoetRowDto
      | PhanLopHocVienRowDto
      | TaiKhoanVleRowDto
      | KetQuaDanhGiaRowDto
      | LopVaLichHocRowDto
      | DiemDanhRowDto
      | KetQuaGiaiDoanRowDto
      | NhanSuLopRowDto
      | TaiKhoanDonViRowDto
      | KetQuaKhaoSatRowDto,
    importId: string,
    nguoiImportId: string,
    dupKeys?: Set<string>,
  ): Promise<{
    hocVienChuaCoEmail?: boolean;
    taiKhoanDonVi?: TaiKhoanDonViDaTao;
  }> {
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
      const { hocVienChuaCoEmail } =
        await this.khoaBoiDuongService.commitPhanLop(
          dto as PhanLopHocVienRowDto,
        );
      return { hocVienChuaCoEmail };
    } else if (loai === 'tai_khoan_vle') {
      await this.commitTaiKhoanVle(dto as TaiKhoanVleRowDto, importId);
    } else if (loai === 'ket_qua_khao_sat') {
      const d = dto as KetQuaKhaoSatRowDto;
      await this.ketQuaKhaoSatService.ghiKetQua(
        d.hoc_vien_id,
        {
          loai: d.loai,
          trang_thai: d.trang_thai,
          thoi_diem: d.thoi_diem ? new Date(d.thoi_diem) : undefined,
          muc: d.muc,
          diem: d.diem,
          diem_toi_da: d.diem_toi_da,
          muc_goc: d.muc_goc,
          url_ket_qua: d.url_ket_qua,
        },
        'import',
      );
    } else if (loai === 'ket_qua_danh_gia') {
      await this.khoaBoiDuongService.commitKetQuaDanhGia(
        dto as KetQuaDanhGiaRowDto,
      );
    } else if (loai === 'lop_va_lich_hoc') {
      await this.khoaBoiDuongService.commitLopVaLichHoc(
        dto as LopVaLichHocRowDto,
      );
    } else if (loai === 'diem_danh') {
      await this.khoaBoiDuongService.commitDiemDanh(
        dto as DiemDanhRowDto,
        importId,
      );
    } else if (loai === 'ket_qua_giai_doan') {
      await this.khoaBoiDuongService.commitKetQuaGiaiDoan(
        dto as KetQuaGiaiDoanRowDto,
        importId,
      );
    } else if (loai === 'tai_khoan_don_vi') {
      const d = dto as TaiKhoanDonViRowDto;
      const kq = await this.taiKhoanDonViService.taoTaiKhoan(
        {
          don_vi_id: d.don_vi_id,
          ten_dang_nhap: d.ten_dang_nhap,
          ho_ten: d.ho_ten,
          email: d.email,
          cach_cap: d.email ? 'email' : 'mat_khau_tam',
        },
        { id: nguoiImportId } as AuthenticatedUser,
      );
      return {
        taiKhoanDonVi: {
          ma_don_vi: d.ma_don_vi,
          ten_don_vi: d.ten_don_vi,
          ten_dang_nhap: kq.tai_khoan.ten_dang_nhap,
          mat_khau_tam: kq.mat_khau_tam,
          cach_cap: kq.mat_khau_tam ? 'mat_khau_tam' : 'email',
        },
      };
    } else if (loai === 'nhan_su_lop') {
      await this.khoaBoiDuongService.commitNhanSuLop(dto as NhanSuLopRowDto);
    } else {
      const d = dto as HoSoNhanSuMoetRowDto;
      await this.hocVienService.createFromMoetImport(
        {
          ma_dinh_danh_moet: d.ma_dinh_danh_moet,
          so_dinh_danh_ca_nhan: d.so_dinh_danh_ca_nhan,
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
        dupKeys,
      );
    }
    return {};
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
      ma_dinh_danh_moet: raw['Mã định danh (CDSL moet)']?.trim() || undefined,
      so_dinh_danh_ca_nhan: raw['Số định danh cá nhân']?.trim() || undefined,
      ho_ten: raw['Họ và tên'],
      ngay_sinh: raw['Ngày'],
      thang_sinh: raw['Tháng'],
      nam_sinh: raw['Năm'],
      chuc_vu: raw['Chức vụ'] || undefined,
      chuyen_mon_raw: raw['Chuyên môn'],
      // T4c: cột trống -> '' (suaSoDienThoaiThieuSo0) — đổi undefined để
      // @IsOptional() ở HoSoNhanSuMoetRowDto bỏ qua @MinLength(1), không báo
      // lỗi "phải có ít nhất 1 ký tự" cho dòng THIẾU SĐT hợp lệ.
      so_dien_thoai_lien_he: sdt || undefined,
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

  // 2026-10-04: import kết quả khảo sát (dự phòng cho POST /sso/ket-qua).
  private async buildKetQuaKhaoSatDto(
    raw: Record<string, string>,
    dupKeys?: Set<string>,
  ): Promise<RowBuildResult<KetQuaKhaoSatRowDto>> {
    const loai = raw.loai?.trim() ?? '';
    if (!(LOAI_KHAO_SAT as readonly string[]).includes(loai)) {
      return {
        error: 'Cột "loai" chỉ nhận "khao-sat", "danh-gia" hoặc "dau-ra"',
      };
    }
    const trangThai = raw.trang_thai?.trim() ?? '';
    if (!(TRANG_THAI_BAO_VE as readonly string[]).includes(trangThai)) {
      return {
        error: 'Cột "trang_thai" chỉ nhận "dang_lam" hoặc "hoan_thanh"',
      };
    }
    let thoiDiem: string | undefined;
    if (raw.thoi_diem?.trim()) {
      const d = parseVnDateTime(raw.thoi_diem);
      if (!d) {
        return {
          error: 'Cột "thoi_diem" sai định dạng — phải là "dd/mm/yyyy hh:mm"',
        };
      }
      thoiDiem = d.toISOString();
    }
    const muc = raw.muc?.trim() || undefined;
    if (muc && !(MUC_NANG_LUC as readonly string[]).includes(muc)) {
      return {
        error: 'Cột "muc" chỉ nhận "co_ban", "thanh_thao" hoặc "nang_cao"',
      };
    }
    let diem: number | undefined;
    if (raw.diem?.trim()) {
      diem = Number(raw.diem.trim().replace(',', '.'));
      const haiSoLe = Math.abs(Math.round(diem * 100) - diem * 100) < 1e-6;
      if (!Number.isFinite(diem) || diem < 0 || diem > 9999 || !haiSoLe) {
        return {
          error:
            'Cột "diem" phải là số từ 0 đến 9999, tối đa 2 chữ số thập phân',
        };
      }
    }

    let diemToiDa: number | undefined;
    if (raw.diem_toi_da?.trim()) {
      diemToiDa = Number(raw.diem_toi_da.trim().replace(',', '.'));
      if (!Number.isFinite(diemToiDa) || diemToiDa <= 0 || diemToiDa > 9999) {
        return { error: 'Cột "diem_toi_da" phải là số lớn hơn 0, tối đa 9999' };
      }
      if (diem !== undefined && diem > diemToiDa) {
        return { error: 'Cột "diem" lớn hơn "diem_toi_da"' };
      }
    }

    const mucGoc = (chuanHoaMucGoc(raw.muc_goc ?? '') as string) || undefined;
    if (mucGoc) {
      const thang = await this.thangMucService.thang();
      if (!thang.some((m) => m.ma === mucGoc)) {
        return {
          error: `Cột "muc_goc" chỉ nhận: ${thang.map((m) => m.ma).join(', ')}`,
        };
      }
    }
    const urlKetQua = raw.url_ket_qua?.trim() || undefined;

    const resolved = await resolveHocVienImportRow(this.prisma, {
      so_dinh_danh_ca_nhan: raw.so_dinh_danh_ca_nhan,
      ma_dinh_danh_moet: raw.ma_dinh_danh_moet,
    });
    if (resolved.error || !resolved.hocVien) {
      return { error: resolved.error ?? 'Không xác định được học viên' };
    }
    const khoaTrung = `${resolved.hocVien.id}|${loai}`;
    if (dupKeys?.has(khoaTrung)) {
      return { error: 'Trùng học viên + loại bài với một dòng phía trên' };
    }
    dupKeys?.add(khoaTrung);

    return {
      dto: {
        hoc_vien_id: resolved.hocVien.id,
        loai: loai as LoaiKhaoSat,
        trang_thai: trangThai as TrangThaiBaoVe,
        thoi_diem: thoiDiem,
        muc: muc as MucNangLuc | undefined,
        diem,
        diem_toi_da: diemToiDa,
        muc_goc: mucGoc,
        url_ket_qua: urlKetQua,
      },
    };
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
