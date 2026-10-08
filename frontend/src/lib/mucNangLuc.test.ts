import { describe, expect, it } from 'vitest';
import { cacMucDuocChon, mucHocHieuLuc, nhanMucNangLuc } from './mucNangLuc';

describe('cacMucDuocChon', () => {
  it('nâng cao -> cả 3 mức', () => {
    expect(cacMucDuocChon('nang_cao')).toEqual(['co_ban', 'thanh_thao', 'nang_cao']);
  });

  it('thành thạo -> cơ bản, thành thạo (không có nâng cao)', () => {
    expect(cacMucDuocChon('thanh_thao')).toEqual(['co_ban', 'thanh_thao']);
  });

  it('cơ bản -> chỉ cơ bản', () => {
    expect(cacMucDuocChon('co_ban')).toEqual(['co_ban']);
  });

  it('chưa có kết quả -> rỗng', () => {
    expect(cacMucDuocChon(null)).toEqual([]);
  });
});

describe('mucHocHieuLuc', () => {
  it('chưa tự chọn -> theo mức đánh giá', () => {
    expect(mucHocHieuLuc({ muc_dau_vao: 'nang_cao', muc_hoc_chon: null })).toBe('nang_cao');
  });

  it('đã tự chọn -> theo mức đã chọn', () => {
    expect(mucHocHieuLuc({ muc_dau_vao: 'nang_cao', muc_hoc_chon: 'co_ban' })).toBe('co_ban');
  });
});

describe('nhanMucNangLuc', () => {
  it('null -> "Chưa có kết quả"', () => {
    expect(nhanMucNangLuc(null)).toBe('Chưa có kết quả');
    expect(nhanMucNangLuc('thanh_thao')).toBe('Thành thạo');
  });
});
