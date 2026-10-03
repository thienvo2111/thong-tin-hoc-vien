import { describe, expect, it } from 'vitest';
import { matKhauLanDau } from './matKhauLanDau';

describe('matKhauLanDau', () => {
  it('đệm số 0 ở ngày và tháng', () => {
    expect(matKhauLanDau(8, 12, 1983)).toBe('08121983');
  });

  it('ngày/tháng đã đủ 2 chữ số thì giữ nguyên', () => {
    expect(matKhauLanDau(25, 3, 1990)).toBe('25031990');
  });

  it('cả ngày và tháng đều cần đệm số 0', () => {
    expect(matKhauLanDau(1, 1, 1978)).toBe('01011978');
  });
});
