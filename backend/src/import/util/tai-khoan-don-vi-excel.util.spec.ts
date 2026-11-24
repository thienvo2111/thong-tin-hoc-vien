import * as ExcelJS from 'exceljs';
import {
  TaiKhoanDonViDaTao,
  buildMatKhauTamTruongWorkbook,
  buildMatKhauTamWorkbook,
} from './tai-khoan-don-vi-excel.util';

// Dữ liệu bịa — không có mật khẩu/đơn vị thật.
const DS: TaiKhoanDonViDaTao[] = [
  {
    ma_don_vi: '00123',
    ten_don_vi: 'Trường Bịa Một',
    ten_dang_nhap: '00123',
    mat_khau_tam: 'Abcdef2345',
    cach_cap: 'mat_khau_tam',
  },
  {
    ma_don_vi: 'TR-BIA-2',
    ten_don_vi: 'Trường Bịa Hai',
    ten_dang_nhap: 'tr-bia-2',
    cach_cap: 'email',
  },
];

async function moSheet(buf: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  expect(wb.worksheets).toHaveLength(1);
  return wb.worksheets[0];
}

describe('buildMatKhauTamWorkbook (import tai_khoan_don_vi — giữ nguyên)', () => {
  it('cột và dòng như trước', async () => {
    const sh = await moSheet(await buildMatKhauTamWorkbook(DS));
    expect(sh.name).toBe('Mật khẩu tạm');
    expect(sh.getRow(1).values).toEqual([
      undefined,
      'Mã đơn vị',
      'Tên đơn vị',
      'Tên đăng nhập',
      'Mật khẩu tạm',
      'Cách cấp',
    ]);
    expect(sh.getRow(1).font?.bold).toBe(true);
    expect(sh.getRow(2).values).toEqual([
      undefined,
      '00123',
      'Trường Bịa Một',
      '00123',
      'Abcdef2345',
      'Mật khẩu tạm',
    ]);
    expect(sh.getRow(3).values).toEqual([
      undefined,
      'TR-BIA-2',
      'Trường Bịa Hai',
      'tr-bia-2',
      '',
      'Email kích hoạt',
    ]);
    expect(sh.getColumn(1).numFmt).toBe('@');
  });
});

describe('buildMatKhauTamTruongWorkbook (cấp tài khoản trường của đợt)', () => {
  it('STT, Mã trường, Tên trường, Tên đăng nhập, Mật khẩu tạm, Ghi chú đổi mật khẩu', async () => {
    const sh = await moSheet(await buildMatKhauTamTruongWorkbook([DS[0]]));
    expect(sh.name).toBe('Mật khẩu tạm');
    expect(sh.rowCount).toBe(2);
    expect(sh.getRow(1).values).toEqual([
      undefined,
      'STT',
      'Mã trường',
      'Tên trường',
      'Tên đăng nhập',
      'Mật khẩu tạm',
      'Ghi chú',
    ]);
    expect(sh.getRow(2).values).toEqual([
      undefined,
      '1',
      '00123',
      'Trường Bịa Một',
      '00123',
      'Abcdef2345',
      'Đổi mật khẩu ở lần đăng nhập đầu tiên',
    ]);
    expect(sh.getColumn(2).numFmt).toBe('@');
  });
});
