import { describe, expect, it } from 'vitest';
import { cacMucDuocChon, mucHocHieuLuc, nhanKetQuaHeThong, nhanMucNangLuc, nhuCauMucHoc } from './mucNangLuc';

describe('nhanKetQuaHeThong', () => {
  it('M1 – Chưa đạt -> kèm mức quy đổi Cơ bản', () => {
    expect(nhanKetQuaHeThong({ muc_he_thong: 'co_ban', nhan_muc_goc_danh_gia: 'M1 – Chưa đạt' })).toBe(
      'M1 – Chưa đạt (quy đổi: Cơ bản)',
    );
  });

  it('nhãn trùng tên mức -> chỉ nhãn gốc', () => {
    expect(nhanKetQuaHeThong({ muc_he_thong: 'nang_cao', nhan_muc_goc_danh_gia: 'M4 – Nâng cao' })).toBe('M4 – Nâng cao');
  });

  it('thiếu nhãn gốc -> tên mức quy đổi; chưa có kết quả -> null', () => {
    expect(nhanKetQuaHeThong({ muc_he_thong: 'thanh_thao', nhan_muc_goc_danh_gia: null })).toBe('Thành thạo');
    expect(nhanKetQuaHeThong({ muc_he_thong: null, nhan_muc_goc_danh_gia: null })).toBeNull();
  });
});

describe('cacMucDuocChon', () => {
  it('nâng cao -> thành thạo, nâng cao (không có cơ bản — chỉ thấp hơn 1 mức)', () => {
    expect(cacMucDuocChon('nang_cao')).toEqual(['thanh_thao', 'nang_cao']);
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

// ADR 0006: chỉ mức chốt dùng để xếp lớp.
describe('mucHocHieuLuc', () => {
  it('đã chốt -> đúng mức chốt', () => {
    expect(mucHocHieuLuc({ muc_dau_vao: 'thanh_thao' })).toBe('thanh_thao');
  });

  it('chưa chốt -> null', () => {
    expect(mucHocHieuLuc({ muc_dau_vao: null })).toBeNull();
  });
});

describe('nhuCauMucHoc', () => {
  it('đã tự chọn -> mức đã chọn', () => {
    expect(nhuCauMucHoc({ muc_hoc_chon: 'co_ban', muc_he_thong: 'thanh_thao' })).toBe('co_ban');
  });

  it('chưa chọn -> theo kết quả hệ thống; không có gì -> null', () => {
    expect(nhuCauMucHoc({ muc_hoc_chon: null, muc_he_thong: 'nang_cao' })).toBe('nang_cao');
    expect(nhuCauMucHoc({ muc_hoc_chon: null, muc_he_thong: null })).toBeNull();
  });
});

describe('nhanMucNangLuc', () => {
  it('null -> "Chưa có kết quả"', () => {
    expect(nhanMucNangLuc(null)).toBe('Chưa có kết quả');
    expect(nhanMucNangLuc('thanh_thao')).toBe('Thành thạo');
  });
});
