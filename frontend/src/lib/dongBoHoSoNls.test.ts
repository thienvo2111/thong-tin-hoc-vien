import { describe, expect, it } from 'vitest';
import { giaTriCaNhanTu, hienThiTruongCaNhan, maGioiTinh, truongKhacHoSo, type HoSoHocVienNls } from './dongBoHoSoNls';

// Issue #69 / ADR 0015 Y2 — dữ liệu bịa.
const HO_SO: HoSoHocVienNls = {
  hoc_vien_id: 'hv-1',
  ho_ten: 'Trần Thị Bịa',
  ngay_sinh: '1991-03-04',
  gioi_tinh: 'nu',
  don_vi: { id: 'tr-1', ten: 'Trường Bịa Một' },
};

describe('maGioiTinh', () => {
  it.each([
    ['Nam', 'nam'],
    [' NỮ ', 'nu'],
    ['nu', 'nu'],
    ['Khác', 'khac'],
  ])('%p → %p', (vao, ra) => expect(maGioiTinh(vao)).toBe(ra));

  it.each([null, undefined, '', 'Ông'])('%p → null', (v) => expect(maGioiTinh(v)).toBeNull());
});

describe('truongKhacHoSo', () => {
  it('chỉ trả trường khác hồ sơ, giá trị mới đã chuẩn hóa', () => {
    expect(
      truongKhacHoSo(HO_SO, {
        ho_ten: '  Trần   Thị Bịa ',
        ngay_sinh: '1990-12-31',
        gioi_tinh: 'Nam',
        don_vi_id: 'tr-2',
      }),
    ).toEqual([
      { truong: 'ngay_sinh', cu: '1991-03-04', moi: '1990-12-31' },
      { truong: 'gioi_tinh', cu: 'nu', moi: 'nam' },
      { truong: 'don_vi_id', cu: 'tr-1', moi: 'tr-2' },
    ]);
  });

  it('giống hồ sơ (kể cả "Nữ" so với mã nu, tên NFD) → rỗng', () => {
    expect(
      truongKhacHoSo(HO_SO, { ho_ten: 'Trần Thị Bịa'.normalize('NFD'), gioi_tinh: 'Nữ', don_vi_id: 'tr-1' }),
    ).toEqual([]);
  });

  it('giá trị mới trống không xóa hồ sơ → bỏ qua', () => {
    expect(truongKhacHoSo(HO_SO, { ngay_sinh: null, gioi_tinh: '' })).toEqual([]);
  });

  it('hồ sơ chưa có ngày sinh hợp lệ → đồng bộ', () => {
    expect(truongKhacHoSo({ ...HO_SO, ngay_sinh: null }, { ngay_sinh: '1991-02-28' })).toEqual([
      { truong: 'ngay_sinh', cu: null, moi: '1991-02-28' },
    ]);
  });
});

describe('giaTriCaNhanTu', () => {
  it('bỏ giai đoạn, suất, lớp, ghi chú, mã gốc', () => {
    expect(
      giaTriCaNhanTu({ ho_ten: 'A', giai_doan: 'chi_gd1', ty_le_suat: 0.5, lop: 'x', ghi_chu: null, ngay_sinh: null }),
    ).toEqual({ ho_ten: 'A', ngay_sinh: null });
  });
});

describe('hienThiTruongCaNhan', () => {
  it('ngày, giới tính, trường, trống', () => {
    expect(hienThiTruongCaNhan('ngay_sinh', '1990-12-31')).toBe('31/12/1990');
    expect(hienThiTruongCaNhan('gioi_tinh', 'nu')).toBe('Nữ');
    expect(hienThiTruongCaNhan('gioi_tinh', 'Ông')).toBe('Ông');
    expect(hienThiTruongCaNhan('don_vi_id', 'tr-2', () => 'Trường Bịa Hai')).toBe('Trường Bịa Hai');
    expect(hienThiTruongCaNhan('don_vi_id', 'tr-9')).toBe('tr-9');
    expect(hienThiTruongCaNhan('ho_ten', null)).toBe('—');
  });
});
