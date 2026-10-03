import {
  MAT_KHAU_TAM_KY_TU,
  THOI_HAN_KICH_HOAT_MS,
  chuanHoaTenDangNhap,
  laTenDangNhapHopLe,
  sinhMatKhauTam,
  vaiTroTheoLoaiDonVi,
} from './tai-khoan-don-vi.util';

describe('tai-khoan-don-vi.util', () => {
  describe('sinhMatKhauTam', () => {
    it('dài 10 ký tự, chỉ dùng ký tự trong bảng chữ không gây nhầm', () => {
      const mk = sinhMatKhauTam();
      expect(mk).toHaveLength(10);
      for (const c of mk) expect(MAT_KHAU_TAM_KY_TU).toContain(c);
      expect(MAT_KHAU_TAM_KY_TU).not.toMatch(/[0Oo1lIL]/);
    });

    it('luôn có ít nhất 1 chữ và 1 số', () => {
      for (let i = 0; i < 200; i++) {
        const mk = sinhMatKhauTam();
        expect(mk).toMatch(/[A-Za-z]/);
        expect(mk).toMatch(/[0-9]/);
      }
    });

    it('1000 lần sinh không trùng', () => {
      const tap = new Set(Array.from({ length: 1000 }, () => sinhMatKhauTam()));
      expect(tap.size).toBe(1000);
    });
  });

  describe('chuanHoaTenDangNhap', () => {
    it('cắt khoảng trắng đầu cuối và chuyển chữ thường', () => {
      expect(chuanHoaTenDangNhap(' SGD-AnGiang ')).toBe('sgd-angiang');
    });
  });

  describe('laTenDangNhapHopLe', () => {
    it.each(['sgd-angiang', 'tr-ag-032', 'abc', 'a.b_c-1'])('%s hợp lệ', (s) => {
      expect(laTenDangNhapHopLe(s)).toBe(true);
    });

    it.each(['ab', 'có-dấu', 'a b', '-abc', 'ABC', 'a'.repeat(51)])(
      '%s không hợp lệ',
      (s) => {
        expect(laTenDangNhapHopLe(s)).toBe(false);
      },
    );
  });

  describe('vaiTroTheoLoaiDonVi', () => {
    it.each([
      ['so_gddt', 'so_gddt'],
      ['phong_vhxh', 'phong_vhxh'],
      ['truong', 'truong'],
    ] as const)('%s -> %s', (loai, vaiTro) => {
      expect(vaiTroTheoLoaiDonVi(loai)).toBe(vaiTro);
    });

    it('khac -> null (không cấp tài khoản)', () => {
      expect(vaiTroTheoLoaiDonVi('khac')).toBeNull();
    });
  });

  it('link kích hoạt hạn 72 giờ', () => {
    expect(THOI_HAN_KICH_HOAT_MS).toBe(72 * 60 * 60 * 1000);
  });
});
