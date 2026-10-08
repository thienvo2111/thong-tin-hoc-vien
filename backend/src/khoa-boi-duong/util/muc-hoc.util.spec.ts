import { THU_TU_MUC, duocChonMuc, mucHocHieuLuc } from './muc-hoc.util';

describe('THU_TU_MUC', () => {
  it('co_ban < thanh_thao < nang_cao', () => {
    expect(THU_TU_MUC.co_ban).toBeLessThan(THU_TU_MUC.thanh_thao);
    expect(THU_TU_MUC.thanh_thao).toBeLessThan(THU_TU_MUC.nang_cao);
  });
});

describe('mucHocHieuLuc', () => {
  it('chưa chọn -> theo mức đánh giá', () => {
    expect(mucHocHieuLuc({ muc_dau_vao: 'nang_cao', muc_hoc_chon: null })).toBe(
      'nang_cao',
    );
  });

  it('đã chọn -> theo mức đã chọn', () => {
    expect(
      mucHocHieuLuc({ muc_dau_vao: 'nang_cao', muc_hoc_chon: 'co_ban' }),
    ).toBe('co_ban');
  });

  it('chưa có kết quả đánh giá -> null', () => {
    expect(mucHocHieuLuc({ muc_dau_vao: null, muc_hoc_chon: null })).toBeNull();
  });
});

describe('duocChonMuc', () => {
  it('thấp hơn mức đánh giá -> được', () => {
    expect(duocChonMuc('nang_cao', 'thanh_thao')).toBe(true);
    expect(duocChonMuc('nang_cao', 'co_ban')).toBe(true);
    expect(duocChonMuc('thanh_thao', 'co_ban')).toBe(true);
  });

  it('bằng mức đánh giá -> được', () => {
    expect(duocChonMuc('co_ban', 'co_ban')).toBe(true);
    expect(duocChonMuc('thanh_thao', 'thanh_thao')).toBe(true);
    expect(duocChonMuc('nang_cao', 'nang_cao')).toBe(true);
  });

  it('cao hơn mức đánh giá -> không được', () => {
    expect(duocChonMuc('co_ban', 'thanh_thao')).toBe(false);
    expect(duocChonMuc('co_ban', 'nang_cao')).toBe(false);
    expect(duocChonMuc('thanh_thao', 'nang_cao')).toBe(false);
  });

  it('chưa có mức đánh giá hoặc mức chọn null -> không được', () => {
    expect(duocChonMuc(null, 'co_ban')).toBe(false);
    expect(duocChonMuc('nang_cao', null)).toBe(false);
    expect(duocChonMuc(null, null)).toBe(false);
  });
});
