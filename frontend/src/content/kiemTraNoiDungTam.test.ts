import { describe, expect, it, vi } from 'vitest';
import { baoCacKhoiTam } from './kiemTraNoiDungTam';

describe('kiemTraNoiDungTam (dev-only, M0 § Nghiệm thu: "Chế độ dev in danh sách khối tam:true")', () => {
  it('in ra console danh sách khối còn tam:true mà không ném lỗi', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    expect(() => baoCacKhoiTam()).not.toThrow();
    expect(spy).toHaveBeenCalled();
    const [, danhSach] = spy.mock.calls[0];
    expect(Array.isArray(danhSach) || danhSach === '(không có)').toBe(true);
    spy.mockRestore();
  });
});
