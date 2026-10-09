import { describe, expect, it } from 'vitest';
import { cacMucDuocChon, ghiChuXepLopTheoKhaoSat, mucHocHieuLuc, nhanMucNangLuc } from './mucNangLuc';

describe('ghiChuXepLopTheoKhaoSat', () => {
  const dk = (nguon: 'chot' | 'khao_sat' | null, nhan: string | null) => ({
    muc_danh_gia: 'co_ban' as const,
    nguon_muc_danh_gia: nguon,
    nhan_muc_goc_danh_gia: nhan,
  });

  it('khảo sát M1 – Chưa đạt -> ghi chú xếp lớp Cơ bản', () => {
    expect(ghiChuXepLopTheoKhaoSat(dk('khao_sat', 'M1 – Chưa đạt'))).toBe('xếp lớp Cơ bản theo kết quả M1 – Chưa đạt');
  });

  it('nhãn trùng tên mức lớp, mức chốt hoặc thiếu nhãn -> null', () => {
    expect(ghiChuXepLopTheoKhaoSat(dk('khao_sat', 'M2 – Cơ bản'))).toBeNull();
    expect(ghiChuXepLopTheoKhaoSat(dk('chot', 'M1 – Chưa đạt'))).toBeNull();
    expect(ghiChuXepLopTheoKhaoSat(dk('khao_sat', null))).toBeNull();
  });
});

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
    expect(mucHocHieuLuc({ muc_danh_gia: 'nang_cao', muc_hoc_chon: null })).toBe('nang_cao');
  });

  it('đã tự chọn -> theo mức đã chọn', () => {
    expect(mucHocHieuLuc({ muc_danh_gia: 'nang_cao', muc_hoc_chon: 'co_ban' })).toBe('co_ban');
  });
});

describe('nhanMucNangLuc', () => {
  it('null -> "Chưa có kết quả"', () => {
    expect(nhanMucNangLuc(null)).toBe('Chưa có kết quả');
    expect(nhanMucNangLuc('thanh_thao')).toBe('Thành thạo');
  });
});
