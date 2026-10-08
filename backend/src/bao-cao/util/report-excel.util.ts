import * as ExcelJS from 'exceljs';
import { CanDonDocDong, TienDoTruongDong } from '../../thong-ke/thong-ke.types';
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

const NHAN_CAP_GIANG_DAY: Record<string, string> = {
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
  const doRong = [6, 45, 35, 12, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 12, 12];
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
