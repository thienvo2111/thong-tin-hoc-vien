import { themSchemeNeuThieu } from './lien-ket.util';

describe('themSchemeNeuThieu', () => {
  it('thêm https:// khi chưa có scheme', () => {
    expect(themSchemeNeuThieu('google.com')).toBe('https://google.com');
    expect(themSchemeNeuThieu('zalo.me/g/abc')).toBe('https://zalo.me/g/abc');
  });

  it('giữ nguyên khi đã có scheme http/https', () => {
    expect(themSchemeNeuThieu('https://zalo.me/g/x')).toBe('https://zalo.me/g/x');
    expect(themSchemeNeuThieu('http://example.com')).toBe('http://example.com');
  });

  it('giữ nguyên scheme khác (sẽ bị @IsUrl chặn sau đó)', () => {
    expect(themSchemeNeuThieu('javascript:alert(1)')).toBe('javascript:alert(1)');
  });

  it('cắt khoảng trắng đầu/cuối', () => {
    expect(themSchemeNeuThieu('  google.com  ')).toBe('https://google.com');
  });

  it('chuỗi rỗng/chỉ khoảng trắng -> rỗng', () => {
    expect(themSchemeNeuThieu('')).toBe('');
    expect(themSchemeNeuThieu('   ')).toBe('');
  });

  it('giá trị không phải string (undefined) -> giữ nguyên', () => {
    expect(themSchemeNeuThieu(undefined)).toBeUndefined();
  });
});
