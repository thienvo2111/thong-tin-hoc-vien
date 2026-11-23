import { describe, expect, it } from 'vitest';
import { hanRiengSchema } from './hanRieng';

// Issue #66: form Gia hạn riêng — lý do bắt buộc, ngày bắt buộc trừ khi bỏ hạn riêng.
const loi = (v: unknown) => {
  const kq = hanRiengSchema.safeParse(v);
  return kq.success ? {} : Object.fromEntries(kq.error.issues.map((i) => [i.path.join('.'), i.message]));
};

describe('hanRiengSchema', () => {
  it('có ngày + lý do → hợp lệ (lý do được trim)', () => {
    const kq = hanRiengSchema.parse({ bo_han_rieng: false, han_rieng: new Date(2026, 11, 20), ly_do: '  Bịa  ' });
    expect(kq.ly_do).toBe('Bịa');
  });

  it('thiếu lý do / chỉ khoảng trắng → lỗi ly_do', () => {
    expect(loi({ bo_han_rieng: false, han_rieng: new Date(2026, 11, 20), ly_do: '   ' })).toEqual({
      ly_do: 'Nhập lý do gia hạn',
    });
  });

  it('lý do 501 ký tự → lỗi; 500 → được', () => {
    const d = new Date(2026, 11, 20);
    expect(loi({ bo_han_rieng: false, han_rieng: d, ly_do: 'x'.repeat(501) })).toEqual({
      ly_do: 'Lý do tối đa 500 ký tự',
    });
    expect(loi({ bo_han_rieng: false, han_rieng: d, ly_do: 'x'.repeat(500) })).toEqual({});
  });

  it('chưa chọn ngày → lỗi han_rieng; bỏ hạn riêng thì không cần ngày', () => {
    expect(loi({ bo_han_rieng: false, han_rieng: null, ly_do: 'Bịa' })).toEqual({ han_rieng: 'Chọn ngày hạn riêng' });
    expect(loi({ bo_han_rieng: true, han_rieng: null, ly_do: 'Bịa' })).toEqual({});
  });
});
