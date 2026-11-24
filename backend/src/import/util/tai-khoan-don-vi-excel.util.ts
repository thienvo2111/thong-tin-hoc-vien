import * as ExcelJS from 'exceljs';

export interface TaiKhoanDonViDaTao {
  ma_don_vi: string;
  ten_don_vi: string;
  ten_dang_nhap: string;
  mat_khau_tam?: string;
  cach_cap: 'mat_khau_tam' | 'email';
}

// Tài khoản đơn vị (ADR 0002): file kết quả trả 1 lần trong response xác nhận
// nạp — KHÔNG ghi ra storage/import (mật khẩu tạm không được lưu ở đâu).
export async function buildMatKhauTamWorkbook(
  rows: TaiKhoanDonViDaTao[],
): Promise<Buffer> {
  return ghiFileMatKhau(
    ['Mã đơn vị', 'Tên đơn vị', 'Tên đăng nhập', 'Mật khẩu tạm', 'Cách cấp'],
    rows.map((r) => [
      r.ma_don_vi,
      r.ten_don_vi,
      r.ten_dang_nhap,
      r.mat_khau_tam ?? '',
      r.cach_cap === 'email' ? 'Email kích hoạt' : 'Mật khẩu tạm',
    ]),
    [16, 40, 24, 16, 18],
  );
}

// ADR 0015 T4: "Cấp tài khoản cho trường của đợt" — cùng cách dựng file (1 sheet, cột Text, trả 1 lần
// trong response, không lưu), cột theo trường + ghi chú đổi mật khẩu. Chỉ có tài khoản mật khẩu tạm.
export async function buildMatKhauTamTruongWorkbook(
  rows: TaiKhoanDonViDaTao[],
): Promise<Buffer> {
  return ghiFileMatKhau(
    [
      'STT',
      'Mã trường',
      'Tên trường',
      'Tên đăng nhập',
      'Mật khẩu tạm',
      'Ghi chú',
    ],
    rows.map((r, i) => [
      String(i + 1),
      r.ma_don_vi,
      r.ten_don_vi,
      r.ten_dang_nhap,
      r.mat_khau_tam ?? '',
      'Đổi mật khẩu ở lần đăng nhập đầu tiên',
    ]),
    [6, 16, 40, 24, 16, 40],
  );
}

async function ghiFileMatKhau(
  tieuDe: string[],
  dong: string[][],
  doRong: number[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Mật khẩu tạm');
  sheet.addRow(tieuDe);
  sheet.getRow(1).font = { bold: true };
  for (const d of dong) sheet.addRow(d);
  doRong.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
    sheet.getColumn(i + 1).numFmt = '@';
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
