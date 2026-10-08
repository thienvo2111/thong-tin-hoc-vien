import * as ExcelJS from 'exceljs';
import {
  BieuMauDangKyTruyCap,
  CAP_BIEU_MAU,
  CanDonDocDong,
  ChatLuongHoSoResult,
  CapKey,
  DemDkTc,
  DOI_TUONG_BIEU_MAU,
  DoiTuongKey,
  DongHoSoHocVien,
  MoTaBieuMau,
  TienDoTruongDong,
} from '../../thong-ke/thong-ke.types';
import { mucThieuHoSo } from '../../thong-ke/ho-so-thieu';
import { DOI_TUONG_LABEL } from '../../thong-bao/mau-email/mau-email';
import {
  CAP_GIANG_DAY,
  KHONG_XAC_DINH,
  KET_QUA_HOC,
  CHUA_CO_KET_QUA,
  DieuKienDanhGiaRow,
  MUC_NANG_LUC,
  SuaTruongMoetRow,
  ThamGiaHocRow,
  TRANG_THAI_DANG_KY,
  TRANG_THAI_HO_SO,
  TongHopDiaBanRow,
  TongHopDonViRow,
  TongHopKhoaRow,
  TongHopResult,
  TongQuanResult,
  VanHanhResult,
  XacNhanRow,
  XuatChoVleRow,
} from '../bao-cao.types';

/** 0 lượt điểm danh -> '—'; ngược lại "92,3%" (1 chữ số thập phân). */
function tiLeCoMat(row: ThamGiaHocRow): string {
  const mau = row.co_mat + row.vang_co_phep + row.vang;
  if (mau === 0) return '—';
  return `${((row.co_mat / mau) * 100).toFixed(1).replace('.', ',')}%`;
}

const NHAN_TRANG_THAI_XAC_NHAN: Record<string, string> = {
  chua_dang_nhap: 'Chưa đăng nhập',
  dang_bo_sung: 'Đang bổ sung',
  da_xac_nhan: 'Đã xác nhận',
};

const NHAN_TRANG_THAI_HO_SO: Record<string, string> = {
  nhap: 'Nháp',
  cho_duyet: 'Chờ duyệt',
  da_duyet: 'Đã duyệt',
  tu_choi: 'Từ chối',
  loi: 'Lỗi',
};

export const NHAN_CAP_GIANG_DAY: Record<string, string> = {
  mam_non: 'Mầm non',
  tieu_hoc: 'Tiểu học',
  thcs: 'THCS',
  thpt: 'THPT',
  trung_cap_nghe: 'Trung cấp nghề',
  [KHONG_XAC_DINH]: 'Không xác định',
};

const NHAN_TRANG_THAI_DANG_KY: Record<string, string> = {
  cho_duyet: 'Chờ duyệt',
  da_duyet: 'Đã duyệt',
  tu_choi: 'Từ chối',
  da_phan_lop: 'Đã phân lớp',
};

const NHAN_KET_QUA: Record<string, string> = {
  dang_hoc: 'Đang học',
  dat: 'Đạt',
  khong_dat: 'Không đạt',
  vang: 'Vắng',
  [CHUA_CO_KET_QUA]: 'Chưa có kết quả',
};

const NHAN_MUC_NANG_LUC: Record<string, string> = {
  co_ban: 'Cơ bản',
  thanh_thao: 'Thành thạo',
  nang_cao: 'Nâng cao',
  [KHONG_XAC_DINH]: 'Không xác định',
};

// exceljs ghi buffer .xlsx (OOXML/zip), nội dung XML bên trong luôn UTF-8 —
// không cần xử lý BOM thủ công như CSV. Round-trip tiếng Việt được xác minh
// trong report-excel.util.spec.ts (đọc lại buffer, assert nguyên văn dấu).
export async function buildTongHopWorkbook(
  result: TongHopResult,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const ten_sheet =
    result.theo === 'don_vi'
      ? 'Theo đơn vị'
      : result.theo === 'dia_ban'
        ? 'Theo địa bàn'
        : 'Theo khóa bồi dưỡng';
  const sheet = workbook.addWorksheet(ten_sheet);

  if (result.theo === 'don_vi') {
    buildDonViOrDiaBanSheet(
      sheet,
      'Đơn vị',
      result.rows as TongHopDonViRow[],
      (r) => r.ten_don_vi,
    );
  } else if (result.theo === 'dia_ban') {
    buildDonViOrDiaBanSheet(
      sheet,
      'Địa bàn',
      result.rows as TongHopDiaBanRow[],
      (r) => r.ten_dia_ban,
    );
  } else {
    buildKhoaSheet(sheet, result.rows as TongHopKhoaRow[]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function buildDonViOrDiaBanSheet<
  T extends {
    tong_so: number;
    theo_trang_thai: Record<string, number>;
    theo_cap_giang_day: Record<string, number>;
  },
>(
  sheet: ExcelJS.Worksheet,
  cotDauLabel: string,
  rows: T[],
  getTen: (r: T) => string,
): void {
  const header = [
    cotDauLabel,
    'Tổng số',
    ...TRANG_THAI_HO_SO.map((t) => NHAN_TRANG_THAI_HO_SO[t]),
    ...CAP_GIANG_DAY.map((c) => NHAN_CAP_GIANG_DAY[c]),
    NHAN_CAP_GIANG_DAY[KHONG_XAC_DINH],
  ];
  sheet.addRow(header);
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    sheet.addRow([
      getTen(row),
      row.tong_so,
      ...TRANG_THAI_HO_SO.map((t) => row.theo_trang_thai[t] ?? 0),
      ...CAP_GIANG_DAY.map((c) => row.theo_cap_giang_day[c] ?? 0),
      row.theo_cap_giang_day[KHONG_XAC_DINH] ?? 0,
    ]);
  }
}

function buildKhoaSheet(
  sheet: ExcelJS.Worksheet,
  rows: TongHopKhoaRow[],
): void {
  const header = [
    'Mã khóa',
    'Tên khóa',
    'Đơn vị đặt hàng',
    'Trạng thái khóa',
    'Tổng đăng ký',
    ...TRANG_THAI_DANG_KY.map((t) => NHAN_TRANG_THAI_DANG_KY[t]),
    ...KET_QUA_HOC.map((k) => NHAN_KET_QUA[k]),
    NHAN_KET_QUA[CHUA_CO_KET_QUA],
  ];
  sheet.addRow(header);
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    sheet.addRow([
      row.ma_khoa,
      row.ten_khoa,
      row.don_vi_dat_hang,
      row.trang_thai_khoa,
      row.tong_dang_ky,
      ...TRANG_THAI_DANG_KY.map((t) => row.theo_trang_thai_dang_ky[t] ?? 0),
      ...KET_QUA_HOC.map((k) => row.theo_ket_qua[k] ?? 0),
      row.theo_ket_qua[CHUA_CO_KET_QUA] ?? 0,
    ]);
  }
}

// T14 — GET /bao-cao/xac-nhan/xuat-excel.
export async function buildXacNhanWorkbook(
  rows: XacNhanRow[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Tiến độ xác nhận');
  sheet.addRow([
    'Mã định danh CSDL MOET',
    'Họ và tên',
    'Đơn vị công tác',
    'Đăng nhập lần cuối',
    'Trạng thái',
  ]);
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) {
    sheet.addRow([
      row.ma_dinh_danh_moet ?? '',
      row.ho_ten,
      row.don_vi_cong_tac_ten,
      row.dang_nhap_lan_cuoi ? row.dang_nhap_lan_cuoi.toISOString() : '',
      NHAN_TRANG_THAI_XAC_NHAN[row.trang_thai] ?? row.trang_thai,
    ]);
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// T14 — GET /bao-cao/sua-truong-moet/xuat-excel.
export async function buildSuaTruongMoetWorkbook(
  rows: SuaTruongMoetRow[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sửa trường gốc MOET');
  sheet.addRow([
    'Mã định danh CSDL MOET',
    'Họ và tên học viên',
    'Trường',
    'Giá trị cũ',
    'Giá trị mới',
    'Người sửa',
    'Vai trò người sửa',
    'Sửa lúc',
  ]);
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) {
    sheet.addRow([
      row.ma_dinh_danh_moet ?? '',
      row.ho_ten_hoc_vien,
      row.truong,
      row.gia_tri_cu ?? '',
      row.gia_tri_moi ?? '',
      row.nguoi_sua,
      row.vai_tro_nguoi_sua,
      row.sua_luc.toISOString(),
    ]);
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// T14 — GET /bao-cao/xuat-cho-vle (file chuyển Phòng CNTT tạo tài khoản VLE).
export async function buildXuatChoVleWorkbook(
  rows: XuatChoVleRow[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Xuất cho VLE');
  sheet.addRow([
    'Mã định danh CSDL MOET',
    'Họ và tên',
    'Email',
    'Đơn vị',
    'Trạng thái đợt 1',
  ]);
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) {
    sheet.addRow([
      row.ma_dinh_danh_moet ?? '',
      row.ho_ten,
      row.email ?? '',
      row.don_vi,
      row.trang_thai_dot_1 === 'da_xac_nhan' ? 'Đã xác nhận' : 'Chưa xác nhận',
    ]);
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// T7 — GET /bao-cao/van-hanh/xuat-excel. Dòng cuối "Tổng cộng" cộng dồn
// result.tong (đã tính sẵn ở BaoCaoService, chỉ trong phạm vi kết quả lọc).
export async function buildVanHanhWorkbook(
  result: VanHanhResult,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Báo cáo vận hành');
  sheet.addRow([
    'Tên lớp',
    'Nhóm học viên',
    'Mức năng lực lớp',
    'Sĩ số',
    'Số có email',
    'Số hồ sơ đầy đủ',
    ...MUC_NANG_LUC.map((m) => `Mức đầu vào: ${NHAN_MUC_NANG_LUC[m]}`),
    `Mức đầu vào: ${NHAN_MUC_NANG_LUC[KHONG_XAC_DINH]}`,
  ]);
  sheet.getRow(1).font = { bold: true };

  for (const row of result.rows) {
    sheet.addRow([
      row.ten_lop,
      row.nhom_hoc_vien ?? '',
      row.muc_nang_luc ? (NHAN_MUC_NANG_LUC[row.muc_nang_luc] ?? '') : '',
      row.si_so,
      row.so_co_email,
      row.so_ho_so_day_du,
      ...MUC_NANG_LUC.map((m) => row.theo_muc_dau_vao[m] ?? 0),
      row.theo_muc_dau_vao[KHONG_XAC_DINH] ?? 0,
    ]);
  }

  sheet.addRow([
    'Tổng cộng',
    '',
    '',
    result.tong.si_so,
    result.tong.so_co_email,
    result.tong.so_ho_so_day_du,
    ...MUC_NANG_LUC.map((m) => result.tong.theo_muc_dau_vao[m] ?? 0),
    result.tong.theo_muc_dau_vao[KHONG_XAC_DINH] ?? 0,
  ]);
  sheet.getRow(sheet.rowCount).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// Dashboard "Tổng quan hệ thống" (thêm 2026-09-30) — GET
// /bao-cao/tong-quan/xuat-excel — 3 sheet: tổng quan, khảo sát, kết quả theo
// hình thức.
export async function buildTongQuanWorkbook(
  result: TongQuanResult,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  const sheetTongQuan = workbook.addWorksheet('Tổng quan');
  sheetTongQuan.addRow(['Chỉ số', 'Giá trị']);
  sheetTongQuan.getRow(1).font = { bold: true };
  sheetTongQuan.addRow(['Học viên tham gia', result.tong_hoc_vien_tham_gia]);
  sheetTongQuan.addRow(['Đã đăng nhập', result.da_dang_nhap]);
  sheetTongQuan.addRow(['Đã chỉnh sửa hồ sơ', result.da_chinh_sua_ho_so]);

  // Thứ bậc hiện theo thang quản trị cấu hình (union mã của đầu vào/đầu ra,
  // giữ đúng thứ tự xuất hiện) — không còn 3 bậc cứng co_ban/thanh_thao/nang_cao.
  const sheetKhaoSat = workbook.addWorksheet('Khảo sát');
  const maDanhSach: string[] = [];
  const nhanTheoMa = new Map<string, string>();
  for (const m of [
    ...result.khao_sat.dau_vao.theo_muc,
    ...result.khao_sat.dau_ra.theo_muc,
  ]) {
    if (!nhanTheoMa.has(m.ma)) {
      nhanTheoMa.set(m.ma, m.nhan);
      maDanhSach.push(m.ma);
    }
  }
  sheetKhaoSat.addRow([
    'Đợt khảo sát',
    'Đã làm',
    ...maDanhSach.map((ma) => `${ma} – ${nhanTheoMa.get(ma)}`),
    'Chưa xếp mức',
  ]);
  sheetKhaoSat.getRow(1).font = { bold: true };
  for (const [ten, row] of [
    ['Đầu vào', result.khao_sat.dau_vao],
    ['Đầu ra', result.khao_sat.dau_ra],
  ] as const) {
    const soLuongTheoMa = new Map(row.theo_muc.map((m) => [m.ma, m.so_luong]));
    sheetKhaoSat.addRow([
      ten,
      row.da_lam,
      ...maDanhSach.map((ma) => soLuongTheoMa.get(ma) ?? 0),
      row.chua_xep_muc,
    ]);
  }

  const sheetThamGiaHoc = workbook.addWorksheet('Tham gia học');
  sheetThamGiaHoc.addRow([
    'Khóa',
    'Giai đoạn',
    'Số buổi đã điểm danh',
    'Có mặt',
    'Vắng có phép',
    'Vắng',
    'Tỉ lệ có mặt',
  ]);
  sheetThamGiaHoc.getRow(1).font = { bold: true };
  for (const row of result.tham_gia_hoc) {
    sheetThamGiaHoc.addRow([
      row.ma_khoa,
      `GĐ${row.thu_tu} – ${row.ten_giai_doan}`,
      row.so_buoi,
      row.co_mat,
      row.vang_co_phep,
      row.vang,
      tiLeCoMat(row),
    ]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// T15 — GET /bao-cao/dieu-kien-danh-gia/xuat-excel.
export async function buildDieuKienDanhGiaWorkbook(
  rows: DieuKienDanhGiaRow[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Điều kiện đánh giá đầu vào');
  sheet.addRow([
    'Mã định danh CSDL MOET',
    'Họ và tên',
    'Đơn vị công tác',
    'Đủ điều kiện',
    'Lý do (nếu không đủ)',
    'Đã xem thông tin VLE',
  ]);
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) {
    sheet.addRow([
      row.ma_dinh_danh_moet ?? '',
      row.ho_ten,
      row.don_vi_cong_tac_ten,
      row.du_dieu_kien ? 'Đủ điều kiện' : 'Không đủ điều kiện',
      row.ly_do.join('; '),
      row.da_xem_vle ? 'Đã xem' : 'Chưa xem',
    ]);
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// Dashboard thống kê — GET /thong-ke/can-don-doc/xuat-excel.
export async function buildCanDonDocWorkbook(
  rows: CanDonDocDong[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Cần đôn đốc');
  sheet.addRow(['STT', 'Họ tên', 'Đơn vị', 'Khóa', 'SĐT', 'Email', 'Chi tiết']);
  sheet.getRow(1).font = { bold: true };
  rows.forEach((row, i) => {
    sheet.addRow([
      i + 1,
      row.ho_ten,
      row.ten_don_vi,
      row.ten_khoa,
      row.so_dien_thoai ?? '',
      row.email ?? '',
      row.chi_tiet,
    ]);
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// Tỷ lệ 0..1 -> số 0..100 làm tròn 1 chữ số; null để ô trống.
const phanTram = (v: number | null): number | null =>
  v === null ? null : Math.round(v * 1000) / 10;

export async function buildTienDoTruongWorkbook(
  rows: TienDoTruongDong[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Tiến độ theo trường');
  sheet.addRow([
    'STT',
    'Trường',
    'Đơn vị quản lý',
    'Số HV',
    'Đã truy cập',
    '% Truy cập',
    'Đã làm KS kĩ năng số',
    '% KS kĩ năng số',
    'Đã làm đánh giá NLS đầu vào',
    '% Đánh giá NLS đầu vào',
    'Đã làm đánh giá NLS đầu ra',
    '% Đánh giá NLS đầu ra',
    'Lượt điểm danh',
    'Lượt có mặt',
    '% Có mặt',
    'HV có dữ liệu VLE',
    'HV VLE ≥ 50%',
    '% VLE ≥ 50%',
    'Lượt đăng ký',
    'Đạt',
    '% Đạt',
  ]);
  sheet.getRow(1).font = { bold: true };
  const doRong = [
    6, 45, 35, 12, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14,
    12, 12,
  ];
  doRong.forEach((width, i) => {
    sheet.getColumn(i + 1).width = width;
  });
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  rows.forEach((row, i) => {
    sheet.addRow([
      i + 1,
      row.ten_don_vi,
      row.ten_don_vi_cha ?? '',
      row.so_hv,
      row.so_truy_cap,
      phanTram(row.ty_le_truy_cap),
      row.so_ky_nang_so,
      phanTram(row.ty_le_ky_nang_so),
      row.so_dau_vao,
      phanTram(row.ty_le_dau_vao),
      row.so_dau_ra,
      phanTram(row.ty_le_dau_ra),
      row.so_luot_diem_danh,
      row.so_luot_co_mat,
      phanTram(row.ty_le_co_mat),
      row.so_hv_co_vle,
      row.so_hv_vle_dat,
      phanTram(row.ty_le_vle_dat),
      row.so_dang_ky,
      row.so_dat,
      phanTram(row.ty_le_dat),
    ]);
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// Biểu mẫu "Thống kê đăng ký và truy cập hệ thống" — 3 sheet, header 2 tầng.
const NHAN_CHUA_XAC_DINH = 'Chưa xác định';
const NHAN_CAP_BIEU_MAU = (c: CapKey): string =>
  c === 'chua_xac_dinh' ? NHAN_CHUA_XAC_DINH : NHAN_CAP_GIANG_DAY[c];
const NHAN_DOI_TUONG_BIEU_MAU = (d: DoiTuongKey): string =>
  d === 'chua_xac_dinh' ? NHAN_CHUA_XAC_DINH : DOI_TUONG_LABEL[d];

const BORDER_MONG: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};
const NEN_HEADER: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE7E6E6' },
};
const CON_DK_TC = ['ĐK', 'Đã truy cập', 'Tỷ lệ (%)'];

type NhomCot = { nhan: string; dem: (hang: HangBieuMau) => DemDkTc };
interface HangBieuMau {
  nhan: (string | number)[]; // các ô nhãn đầu dòng (STT, trường... hoặc tên đối tượng)
  tong?: boolean;
  tong_dem: DemDkTc;
  theo_doi_tuong: Record<DoiTuongKey, DemDkTc>;
  theo_cap: Record<CapKey, DemDkTc>;
}

const cong = (a: DemDkTc, b: DemDkTc): DemDkTc => ({
  dk: a.dk + b.dk,
  tc: a.tc + b.tc,
});
const KHONG: DemDkTc = { dk: 0, tc: 0 };

const phanTramDkTc = (d: DemDkTc): number | null =>
  d.dk === 0 ? null : Math.round((d.tc / d.dk) * 1000) / 10;

function ngayXuatVn(d: Date): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

/** 4 dòng tiêu đề gộp ô: tên biểu mẫu, Khóa, Phạm vi · Đối tượng, Ngày xuất. */
function themTieuDeBieuMau(
  sheet: ExcelJS.Worksheet,
  tieuDe: string,
  moTa: MoTaBieuMau,
  tongCot: number,
): void {
  const dong: [string, Partial<ExcelJS.Font>?][] = [
    [tieuDe, { bold: true, size: 14 }],
    [`Khóa: ${moTa.khoa}`],
    [`Phạm vi: ${moTa.pham_vi} · Đối tượng: ${moTa.doi_tuong}`],
    [`Ngày xuất: ${ngayXuatVn(moTa.ngay_xuat)}`],
  ];
  dong.forEach(([chu, font], i) => {
    const r = i + 1;
    sheet.mergeCells(r, 1, r, tongCot);
    const o = sheet.getCell(r, 1);
    o.value = chu;
    if (font) o.font = font as ExcelJS.Font;
    o.alignment = { horizontal: 'center', vertical: 'middle' };
  });
}

function themSheetBieuMau(
  workbook: ExcelJS.Workbook,
  ten: string,
  cotDau: { nhan: string; rong: number }[],
  nhom: NhomCot[],
  hang: HangBieuMau[],
  moTa: MoTaBieuMau,
  codinhCot: number,
): void {
  const sheet = workbook.addWorksheet(ten);
  const soCotDau = cotDau.length;
  const tongCot = soCotDau + nhom.length * 3;
  themTieuDeBieuMau(
    sheet,
    'BIỂU THỐNG KÊ SỐ LƯỢNG ĐĂNG KÝ VÀ TRUY CẬP HỆ THỐNG',
    moTa,
    tongCot,
  );

  // Header 2 tầng (dòng 6-7; dòng 5 để trống).
  cotDau.forEach((c, i) => {
    sheet.mergeCells(6, i + 1, 7, i + 1);
    sheet.getCell(6, i + 1).value = c.nhan;
    sheet.getColumn(i + 1).width = c.rong;
  });
  nhom.forEach((n, g) => {
    const dau = soCotDau + g * 3 + 1;
    sheet.mergeCells(6, dau, 6, dau + 2);
    sheet.getCell(6, dau).value = n.nhan;
    CON_DK_TC.forEach((con, k) => {
      sheet.getCell(7, dau + k).value = con;
      sheet.getColumn(dau + k).width = k === 1 ? 13 : 10;
    });
  });
  for (let r = 6; r <= 7; r++) {
    for (let c = 1; c <= tongCot; c++) {
      const o = sheet.getCell(r, c);
      o.font = { bold: true };
      o.fill = NEN_HEADER;
      o.border = BORDER_MONG;
      o.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true,
      };
    }
  }

  hang.forEach((h, i) => {
    const r = 8 + i;
    h.nhan.forEach((chu, c) => {
      sheet.getCell(r, c + 1).value = chu;
    });
    nhom.forEach((n, g) => {
      const d = n.dem(h);
      const dau = soCotDau + g * 3 + 1;
      sheet.getCell(r, dau).value = d.dk;
      sheet.getCell(r, dau + 1).value = d.tc;
      const pt = phanTramDkTc(d);
      if (pt !== null) sheet.getCell(r, dau + 2).value = pt;
    });
    for (let c = 1; c <= tongCot; c++) {
      const o = sheet.getCell(r, c);
      o.border = BORDER_MONG;
      if (h.tong) o.font = { bold: true };
    }
  });
  sheet.views = [
    { state: 'frozen', xSplit: codinhCot, ySplit: 7 } as ExcelJS.WorksheetView,
  ];
}

export async function buildBieuMauDangKyTruyCapWorkbook(
  data: BieuMauDangKyTruyCap,
  moTa: MoTaBieuMau,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const cotTheoCap = (): NhomCot[] =>
    CAP_BIEU_MAU.map((c) => ({
      nhan: NHAN_CAP_BIEU_MAU(c),
      dem: (h) => h.theo_cap[c],
    }));
  const nhomTong: NhomCot = { nhan: 'Tổng', dem: (h) => h.tong_dem };

  const tongTheoDoiTuong = (c: CapKey): DemDkTc =>
    DOI_TUONG_BIEU_MAU.reduce((s, d) => cong(s, data.ma_tran[d][c]), KHONG);
  const tongHang = (cap: Record<CapKey, DemDkTc>): DemDkTc =>
    CAP_BIEU_MAU.reduce((s, c) => cong(s, cap[c]), KHONG);

  // Sheet 1: đối tượng × cấp.
  const hangDoiTuong: HangBieuMau[] = DOI_TUONG_BIEU_MAU.map((d) => {
    const cap = data.ma_tran[d];
    return {
      nhan: [NHAN_DOI_TUONG_BIEU_MAU(d)],
      tong_dem: tongHang(cap),
      theo_doi_tuong: {} as Record<DoiTuongKey, DemDkTc>,
      theo_cap: cap,
    };
  });
  const capCuaTong = Object.fromEntries(
    CAP_BIEU_MAU.map((c) => [c, tongTheoDoiTuong(c)]),
  ) as Record<CapKey, DemDkTc>;
  hangDoiTuong.push({
    nhan: ['Tổng cộng'],
    tong: true,
    tong_dem: data.tong,
    theo_doi_tuong: {} as Record<DoiTuongKey, DemDkTc>,
    theo_cap: capCuaTong,
  });
  themSheetBieuMau(
    workbook,
    'Tổng hợp',
    [{ nhan: 'Đối tượng', rong: 20 }],
    [...cotTheoCap(), nhomTong],
    hangDoiTuong,
    moTa,
    1,
  );

  // Sheet 2/3: theo trường.
  const hangTruong = (): HangBieuMau[] => {
    const hang: HangBieuMau[] = data.theo_truong.map((t, i) => ({
      nhan: [i + 1, t.ten_don_vi, t.ten_don_vi_cha ?? ''],
      tong_dem: t.tong,
      theo_doi_tuong: t.theo_doi_tuong,
      theo_cap: t.theo_cap,
    }));
    const tongDt = Object.fromEntries(
      DOI_TUONG_BIEU_MAU.map((d) => [d, tongHang(data.ma_tran[d])]),
    ) as Record<DoiTuongKey, DemDkTc>;
    hang.push({
      nhan: ['', 'Tổng cộng', ''],
      tong: true,
      tong_dem: data.tong,
      theo_doi_tuong: tongDt,
      theo_cap: capCuaTong,
    });
    return hang;
  };
  const cotDauTruong = [
    { nhan: 'STT', rong: 6 },
    { nhan: 'Trường', rong: 45 },
    { nhan: 'Đơn vị quản lý', rong: 35 },
  ];
  themSheetBieuMau(
    workbook,
    'Theo đối tượng',
    cotDauTruong,
    [
      nhomTong,
      ...DOI_TUONG_BIEU_MAU.map((d) => ({
        nhan: NHAN_DOI_TUONG_BIEU_MAU(d),
        dem: (h: HangBieuMau) => h.theo_doi_tuong[d],
      })),
    ],
    hangTruong(),
    moTa,
    3,
  );
  themSheetBieuMau(
    workbook,
    'Theo cấp',
    cotDauTruong,
    [nhomTong, ...cotTheoCap()],
    hangTruong(),
    moTa,
    3,
  );
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// Báo cáo chất lượng hồ sơ — sheet 1 theo trường, sheet 2 danh sách HV cần bổ sung.
const TIEU_DE_CHAT_LUONG = 'BÁO CÁO CHẤT LƯỢNG HỒ SƠ HỌC VIÊN';
const HANG_DAU_CHAT_LUONG = 6;

function themSheetChatLuong(
  workbook: ExcelJS.Workbook,
  ten: string,
  cot: { nhan: string; rong: number }[],
  hang: { o: (string | number | null)[]; tong?: boolean }[],
  moTa: MoTaBieuMau,
  codinhCot: number,
): void {
  const sheet = workbook.addWorksheet(ten);
  themTieuDeBieuMau(sheet, TIEU_DE_CHAT_LUONG, moTa, cot.length);
  cot.forEach((c, i) => {
    const o = sheet.getCell(HANG_DAU_CHAT_LUONG, i + 1);
    o.value = c.nhan;
    o.font = { bold: true };
    o.fill = NEN_HEADER;
    o.border = BORDER_MONG;
    o.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    sheet.getColumn(i + 1).width = c.rong;
  });
  hang.forEach((h, i) => {
    h.o.forEach((v, c) => {
      const o = sheet.getCell(HANG_DAU_CHAT_LUONG + 1 + i, c + 1);
      if (v !== null) o.value = v;
      o.border = BORDER_MONG;
      if (h.tong) o.font = { bold: true };
    });
  });
  sheet.views = [
    {
      state: 'frozen',
      xSplit: codinhCot,
      ySplit: HANG_DAU_CHAT_LUONG,
    } as ExcelJS.WorksheetView,
  ];
}

export async function buildChatLuongHoSoWorkbook(
  data: ChatLuongHoSoResult,
  canBoSung: DongHoSoHocVien[],
  moTa: MoTaBieuMau,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const dongDem = (d: ChatLuongHoSoResult['tong']) => [
    d.so_hv,
    d.thieu_doi_tuong,
    d.thieu_cap,
    d.thieu_email,
    d.thieu_sdt,
    d.du_ho_so,
    phanTram(d.ty_le_du),
  ];
  themSheetChatLuong(
    workbook,
    'Theo trường',
    [
      { nhan: 'STT', rong: 6 },
      { nhan: 'Trường', rong: 45 },
      { nhan: 'Đơn vị quản lý', rong: 35 },
      { nhan: 'Số HV', rong: 10 },
      { nhan: 'Thiếu đối tượng', rong: 14 },
      { nhan: 'Thiếu cấp giảng dạy', rong: 14 },
      { nhan: 'Thiếu email', rong: 12 },
      { nhan: 'Thiếu SĐT', rong: 12 },
      { nhan: 'Đủ hồ sơ', rong: 12 },
      { nhan: 'Tỷ lệ đủ (%)', rong: 14 },
    ],
    [
      ...data.theo_truong.map((t, i) => ({
        o: [i + 1, t.ten_don_vi, t.ten_don_vi_cha ?? '', ...dongDem(t)],
      })),
      { o: ['Tổng cộng', '', '', ...dongDem(data.tong)], tong: true },
    ],
    moTa,
    3,
  );

  const sapXep = [...canBoSung].sort(
    (a, b) =>
      a.ten_don_vi.localeCompare(b.ten_don_vi, 'vi') ||
      a.ho_ten.localeCompare(b.ho_ten, 'vi'),
  );
  themSheetChatLuong(
    workbook,
    'Cần bổ sung',
    [
      { nhan: 'STT', rong: 6 },
      { nhan: 'Họ tên', rong: 30 },
      { nhan: 'Trường', rong: 45 },
      { nhan: 'Đơn vị quản lý', rong: 35 },
      { nhan: 'Đối tượng', rong: 16 },
      { nhan: 'Cấp giảng dạy', rong: 16 },
      { nhan: 'Email', rong: 30 },
      { nhan: 'SĐT', rong: 16 },
      { nhan: 'Còn thiếu', rong: 34 },
    ],
    sapXep.map((r, i) => ({
      o: [
        i + 1,
        r.ho_ten,
        r.ten_don_vi,
        r.ten_don_vi_cha ?? '',
        r.doi_tuong
          ? (DOI_TUONG_LABEL[r.doi_tuong as keyof typeof DOI_TUONG_LABEL] ??
            r.doi_tuong)
          : '',
        r.cap_giang_day
          ? (NHAN_CAP_GIANG_DAY[r.cap_giang_day] ?? r.cap_giang_day)
          : '',
        r.email ?? '',
        r.so_dien_thoai ?? '',
        mucThieuHoSo(r).join('; '),
      ],
    })),
    moTa,
    2,
  );
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
