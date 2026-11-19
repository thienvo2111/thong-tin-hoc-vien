import { describe, expect, it } from 'vitest';
import { chuoiSangNgay, dinhDangNgayLich, dinhDangTien, docNgayGo, ngaySangChuoi } from './ngayLich';

describe('ngayLich', () => {
  it('ngaySangChuoi dùng ngày giờ máy, không lệch qua UTC', () => {
    expect(ngaySangChuoi(new Date(2026, 11, 31))).toBe('2026-12-31');
    expect(ngaySangChuoi(new Date(2026, 0, 1, 0, 0, 0))).toBe('2026-01-01');
  });

  it('chuoiSangNgay khứ hồi với ngaySangChuoi; null/sai dạng/ngày không có thật → null', () => {
    expect(ngaySangChuoi(chuoiSangNgay('2028-02-29') as Date)).toBe('2028-02-29');
    expect(chuoiSangNgay(null)).toBeNull();
    expect(chuoiSangNgay('31/12/2026')).toBeNull();
    expect(chuoiSangNgay('2026-02-30')).toBeNull();
  });

  it('docNgayGo đọc d/m/yyyy, chưa gõ đủ hoặc ngày không có thật → null', () => {
    expect(ngaySangChuoi(docNgayGo('31/12/2026') as Date)).toBe('2026-12-31');
    expect(ngaySangChuoi(docNgayGo(' 1/3/2026 ') as Date)).toBe('2026-03-01');
    expect(docNgayGo('31/12/202')).toBeNull();
    expect(docNgayGo('30/02/2026')).toBeNull();
    expect(docNgayGo('')).toBeNull();
  });

  it('dinhDangNgayLich YYYY-MM-DD → dd/mm/yyyy', () => {
    expect(dinhDangNgayLich('2026-03-01')).toBe('01/03/2026');
  });

  it('dinhDangTien theo vi-VN', () => {
    expect(dinhDangTien(1500000)).toBe('1.500.000 đ');
    expect(dinhDangTien(0)).toBe('0 đ');
  });
});
