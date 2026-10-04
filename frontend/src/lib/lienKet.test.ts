import { describe, expect, it } from 'vitest';
import { chuanHoaLienKet } from './lienKet';

describe('chuanHoaLienKet', () => {
  it('giữ nguyên link http/https đầy đủ', () => {
    expect(chuanHoaLienKet('http://example.com')).toBe('http://example.com');
    expect(chuanHoaLienKet('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
  });

  it('giữ nguyên scheme viết hoa (HTTPS)', () => {
    expect(chuanHoaLienKet('HTTPS://example.com')).toBe('HTTPS://example.com');
  });

  it('thêm https:// cho domain trần', () => {
    expect(chuanHoaLienKet('google.com')).toBe('https://google.com');
  });

  it('thêm https:// cho domain có đường dẫn', () => {
    expect(chuanHoaLienKet('zalo.me/g/abc')).toBe('https://zalo.me/g/abc');
  });

  it('thêm https:// cho domain có tiền tố www', () => {
    expect(chuanHoaLienKet('www.vle.edu.vn/khoa')).toBe('https://www.vle.edu.vn/khoa');
  });

  it('thêm https:// cho domain có query string', () => {
    expect(chuanHoaLienKet('meet.google.com/x?y=1')).toBe('https://meet.google.com/x?y=1');
  });

  it('chuyển link protocol-relative (//host) thành https:', () => {
    expect(chuanHoaLienKet('//cdn.example.com/a.js')).toBe('https://cdn.example.com/a.js');
  });

  it('chặn scheme javascript:', () => {
    expect(chuanHoaLienKet('javascript:alert(1)')).toBeNull();
  });

  it('chặn scheme data:', () => {
    expect(chuanHoaLienKet('data:text/html,<script>1</script>')).toBeNull();
  });

  it('chặn scheme mailto:', () => {
    expect(chuanHoaLienKet('mailto:a@b.com')).toBeNull();
  });

  it('chặn scheme ftp: (chỉ cho http/https)', () => {
    expect(chuanHoaLienKet('ftp://example.com')).toBeNull();
  });

  it('địa điểm bằng chữ không phải link -> null', () => {
    expect(chuanHoaLienKet('Hội trường A, THPT Long Xuyên')).toBeNull();
    expect(chuanHoaLienKet('Phòng 3.2')).toBeNull();
  });

  it('rỗng/khoảng trắng/null/undefined -> null', () => {
    expect(chuanHoaLienKet('')).toBeNull();
    expect(chuanHoaLienKet('   ')).toBeNull();
    expect(chuanHoaLienKet(null)).toBeNull();
    expect(chuanHoaLienKet(undefined)).toBeNull();
  });
});
