import * as ExcelJS from 'exceljs';
import {
  CAP_GIANG_DAY,
  KHONG_XAC_DINH,
  KET_QUA_HOC,
  CHUA_CO_KET_QUA,
  TRANG_THAI_DANG_KY,
  TRANG_THAI_HO_SO,
  TongHopDiaBanRow,
  TongHopDonViRow,
  TongHopKhoaRow,
  TongHopResult,
} from '../bao-cao.types';

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
    'Đơn vị tổ chức',
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
      row.don_vi_to_chuc,
      row.trang_thai_khoa,
      row.tong_dang_ky,
      ...TRANG_THAI_DANG_KY.map((t) => row.theo_trang_thai_dang_ky[t] ?? 0),
      ...KET_QUA_HOC.map((k) => row.theo_ket_qua[k] ?? 0),
      row.theo_ket_qua[CHUA_CO_KET_QUA] ?? 0,
    ]);
  }
}
