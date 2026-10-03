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
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Mật khẩu tạm');
  sheet.addRow(['Mã đơn vị', 'Tên đơn vị', 'Tên đăng nhập', 'Mật khẩu tạm', 'Cách cấp']);
  sheet.getRow(1).font = { bold: true };
  for (const r of rows) {
    sheet.addRow([
      r.ma_don_vi,
      r.ten_don_vi,
      r.ten_dang_nhap,
      r.mat_khau_tam ?? '',
      r.cach_cap === 'email' ? 'Email kích hoạt' : 'Mật khẩu tạm',
    ]);
  }
  [16, 40, 24, 16, 18].forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
    sheet.getColumn(i + 1).numFmt = '@';
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
