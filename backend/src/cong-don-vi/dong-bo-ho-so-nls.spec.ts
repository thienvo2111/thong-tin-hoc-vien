import {
  HoSoCaNhan,
  gioiTinhKhongHopLe,
  giaTriCaNhanCuaHoSo,
  maGioiTinh,
  suaHoSoTuDongBo,
  truongCaNhanBiDoi,
  truongCaNhanDongBo,
} from './dong-bo-ho-so-nls';

// Issue #69 / ADR 0015 Y2 — dữ liệu bịa.
const HO_SO: HoSoCaNhan = {
  ho_ten: 'Trần Thị Bịa',
  ngay_sinh: 4,
  thang_sinh: 3,
  nam_sinh: 1991,
  gioi_tinh: 'nu',
  don_vi_cong_tac_id: 'truong-a',
};

describe('maGioiTinh / gioiTinhKhongHopLe', () => {
  it.each([
    ['Nam', 'nam'],
    ['nam', 'nam'],
    [' NỮ ', 'nu'],
    ['Nữ', 'nu'],
    ['nu', 'nu'],
    ['Khác', 'khac'],
    ['khac', 'khac'],
  ])('%p → %p', (vao, ra) => {
    expect(maGioiTinh(vao)).toBe(ra);
    expect(gioiTinhKhongHopLe(vao)).toBe(false);
  });

  it('NFD (dấu tổ hợp) vẫn nhận ra', () => {
    expect(maGioiTinh('Nữ'.normalize('NFD'))).toBe('nu');
  });

  it.each(['Ông', 'N', 'female'])(
    'không nhận ra %p → null, không hợp lệ',
    (v) => {
      expect(maGioiTinh(v)).toBeNull();
      expect(gioiTinhKhongHopLe(v)).toBe(true);
    },
  );

  it.each([null, undefined, '', '   '])(
    'trống %p → null nhưng không tính là sai',
    (v) => {
      expect(maGioiTinh(v)).toBeNull();
      expect(gioiTinhKhongHopLe(v)).toBe(false);
    },
  );
});

describe('giaTriCaNhanCuaHoSo', () => {
  it('3 cột ngày → YYYY-MM-DD; don_vi_cong_tac_id → don_vi_id', () => {
    expect(giaTriCaNhanCuaHoSo(HO_SO)).toEqual({
      ho_ten: 'Trần Thị Bịa',
      ngay_sinh: '1991-03-04',
      gioi_tinh: 'nu',
      don_vi_id: 'truong-a',
    });
  });

  it('ngày không có thật → null', () => {
    expect(
      giaTriCaNhanCuaHoSo({ ...HO_SO, ngay_sinh: 31, thang_sinh: 2 }).ngay_sinh,
    ).toBeNull();
  });
});

describe('truongCaNhanBiDoi', () => {
  it('chỉ lấy trường cá nhân, giữ thứ tự cố định', () => {
    expect(
      truongCaNhanBiDoi({
        giai_doan: 'chi_gd1',
        ty_le_suat: 0.5,
        don_vi_id: 'x',
        lop: 'Toán',
        ho_ten: 'A',
      }),
    ).toEqual(['ho_ten', 'don_vi_id']);
  });

  it('không có trường cá nhân / null → rỗng', () => {
    expect(truongCaNhanBiDoi({ giai_doan: 'ca_hai', ghi_chu: 'x' })).toEqual(
      [],
    );
    expect(truongCaNhanBiDoi(null)).toEqual([]);
    expect(truongCaNhanBiDoi(undefined)).toEqual([]);
  });
});

describe('truongCaNhanDongBo', () => {
  it('đủ 4 trường khác hồ sơ → cũ/mới theo kiểu danh sách', () => {
    expect(
      truongCaNhanDongBo(HO_SO, {
        ho_ten: 'Trần Thị Mới',
        ngay_sinh: '1990-12-31',
        gioi_tinh: 'Nam',
        don_vi_id: 'truong-b',
      }),
    ).toEqual([
      { truong: 'ho_ten', cu: 'Trần Thị Bịa', moi: 'Trần Thị Mới' },
      { truong: 'ngay_sinh', cu: '1991-03-04', moi: '1990-12-31' },
      { truong: 'gioi_tinh', cu: 'nu', moi: 'nam' },
      { truong: 'don_vi_id', cu: 'truong-a', moi: 'truong-b' },
    ]);
  });

  it('so với HỒ SƠ: giá trị bằng hồ sơ (dù khác dòng danh sách) → không đồng bộ', () => {
    expect(
      truongCaNhanDongBo(HO_SO, {
        ho_ten: '  Trần   Thị Bịa ',
        ngay_sinh: '1991-03-04',
        gioi_tinh: 'Nữ',
        don_vi_id: 'truong-a',
      }),
    ).toEqual([]);
  });

  it('họ tên NFD bằng hồ sơ NFC → không khác; giá trị mới được chuẩn NFC', () => {
    expect(
      truongCaNhanDongBo(HO_SO, { ho_ten: 'Trần Thị Bịa'.normalize('NFD') }),
    ).toEqual([]);
    const [d] = truongCaNhanDongBo(HO_SO, {
      ho_ten: 'Trần Thị Mới'.normalize('NFD'),
    });
    expect(d.moi).toBe('Trần Thị Mới'.normalize('NFC'));
  });

  it('hồ sơ giới tính cũ dạng chữ ("Nữ") so theo mã với "nu"', () => {
    expect(
      truongCaNhanDongBo({ ...HO_SO, gioi_tinh: 'Nữ' }, { gioi_tinh: 'nu' }),
    ).toEqual([]);
  });

  it('hồ sơ chưa có giới tính → đồng bộ', () => {
    expect(
      truongCaNhanDongBo({ ...HO_SO, gioi_tinh: null }, { gioi_tinh: 'Khác' }),
    ).toEqual([{ truong: 'gioi_tinh', cu: null, moi: 'khac' }]);
  });

  it('hồ sơ ngày sinh không có thật → ngày mới hợp lệ được đồng bộ (cũ = null)', () => {
    expect(
      truongCaNhanDongBo(
        { ...HO_SO, ngay_sinh: 31, thang_sinh: 2 },
        { ngay_sinh: '1991-02-28' },
      ),
    ).toEqual([{ truong: 'ngay_sinh', cu: null, moi: '1991-02-28' }]);
  });

  it('giá trị mới trống (null / chuỗi trống) không xóa thông tin hồ sơ', () => {
    expect(
      truongCaNhanDongBo(HO_SO, { ngay_sinh: null, gioi_tinh: null }),
    ).toEqual([]);
    expect(truongCaNhanDongBo(HO_SO, { gioi_tinh: '  ' })).toEqual([]);
  });

  it('không gửi trường nào → rỗng', () => {
    expect(truongCaNhanDongBo(HO_SO, {})).toEqual([]);
  });
});

describe('suaHoSoTuDongBo', () => {
  it('ánh xạ sang cột hồ sơ; ngày → 3 cột số', () => {
    expect(
      suaHoSoTuDongBo([
        { truong: 'ho_ten', cu: 'A', moi: 'Trần Thị Mới' },
        { truong: 'ngay_sinh', cu: '1991-03-04', moi: '1990-12-31' },
        { truong: 'gioi_tinh', cu: 'nu', moi: 'nam' },
        { truong: 'don_vi_id', cu: 'truong-a', moi: 'truong-b' },
      ]),
    ).toEqual({
      ho_ten: 'Trần Thị Mới',
      ngay_sinh: 31,
      thang_sinh: 12,
      nam_sinh: 1990,
      gioi_tinh: 'nam',
      don_vi_cong_tac_id: 'truong-b',
    });
  });

  it('rỗng → {} (không đụng trường nào khác của hồ sơ)', () => {
    expect(suaHoSoTuDongBo([])).toEqual({});
  });
});
