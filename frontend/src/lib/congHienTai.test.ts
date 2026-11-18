import { afterEach, describe, expect, it, vi } from 'vitest';
import { congHienTai, daCauHinhCongDonVi, urlCong, vaiTroDungCong, xacDinhCong, type Cong } from './congHienTai';

// ADR 0015 P3/T7: cổng nhận diện theo hostname cấu hình; chưa cấu hình → mọi thứ như cũ (NLS).
afterEach(() => vi.unstubAllEnvs());

describe('xacDinhCong', () => {
  it('hostname khớp cấu hình → don_vi', () => {
    expect(xacDinhCong('donvi.hcmue.edu.vn', 'donvi.hcmue.edu.vn')).toBe('don_vi');
  });

  it('khớp không phân biệt hoa thường, bỏ khoảng trắng thừa trong cấu hình', () => {
    expect(xacDinhCong('DonVi.HCMUE.edu.vn', '  donvi.hcmue.edu.VN ')).toBe('don_vi');
  });

  it('hostname khác → nls (kể cả tên miền con/cha gần giống)', () => {
    expect(xacDinhCong('boiduongnls.hcmue.edu.vn', 'donvi.hcmue.edu.vn')).toBe('nls');
    expect(xacDinhCong('x.donvi.hcmue.edu.vn', 'donvi.hcmue.edu.vn')).toBe('nls');
    expect(xacDinhCong('hcmue.edu.vn', 'donvi.hcmue.edu.vn')).toBe('nls');
  });

  it('chưa cấu hình (undefined, rỗng, chỉ khoảng trắng) → nls', () => {
    expect(xacDinhCong('donvi.hcmue.edu.vn', undefined)).toBe('nls');
    expect(xacDinhCong('donvi.hcmue.edu.vn', '')).toBe('nls');
    expect(xacDinhCong('', '   ')).toBe('nls');
  });
});

describe('congHienTai / daCauHinhCongDonVi (đọc env + window.location)', () => {
  it('không cấu hình → nls, daCauHinh = false', () => {
    vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', '');
    expect(congHienTai()).toBe('nls');
    expect(daCauHinhCongDonVi()).toBe(false);
  });

  it('cấu hình trùng hostname hiện tại → don_vi', () => {
    vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', window.location.hostname);
    expect(congHienTai()).toBe('don_vi');
    expect(daCauHinhCongDonVi()).toBe(true);
  });

  it('cấu hình tên miền khác → vẫn nls nhưng daCauHinh = true', () => {
    vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', 'donvi.localhost');
    expect(congHienTai()).toBe('nls');
    expect(daCauHinhCongDonVi()).toBe(true);
  });
});

describe('vaiTroDungCong', () => {
  // [vai trò, đúng ở nls, đúng ở don_vi] khi đã cấu hình Cổng đơn vị.
  const BANG: [string, boolean, boolean][] = [
    ['truong', false, true],
    ['so_gddt', false, true],
    ['phong_vhxh', false, true],
    ['quan_tri', true, true],
    ['hoc_vien', true, false],
    ['ho_tro_hoc_vien', true, false],
    ['ho_tro_giang_vien', true, false],
    ['giang_vien', true, false],
    ['vai_tro_la', true, false],
  ];

  it.each(BANG)('đã cấu hình: %s → nls=%s, don_vi=%s', (vaiTro, nls, donVi) => {
    expect(vaiTroDungCong(vaiTro, 'nls', true)).toBe(nls);
    expect(vaiTroDungCong(vaiTro, 'don_vi', true)).toBe(donVi);
  });

  it('chưa cấu hình → mọi vai trò đúng ở mọi cổng (không chặn ai khi chưa có tên miền)', () => {
    for (const [vaiTro] of BANG) {
      for (const cong of ['nls', 'don_vi'] as Cong[]) {
        expect(vaiTroDungCong(vaiTro, cong, false)).toBe(true);
      }
    }
  });
});

describe('urlCong', () => {
  it('don_vi lấy VITE_CONG_DON_VI_URL, nls lấy VITE_SITE_URL', () => {
    vi.stubEnv('VITE_CONG_DON_VI_URL', 'https://donvi.example.edu.vn');
    vi.stubEnv('VITE_SITE_URL', 'https://nls.example.edu.vn');
    expect(urlCong('don_vi')).toBe('https://donvi.example.edu.vn');
    expect(urlCong('nls')).toBe('https://nls.example.edu.vn');
  });

  it('thiếu cấu hình → chuỗi rỗng (nơi gọi hiện chữ, không có link)', () => {
    vi.stubEnv('VITE_CONG_DON_VI_URL', '');
    vi.stubEnv('VITE_SITE_URL', '');
    expect(urlCong('don_vi')).toBe('');
    expect(urlCong('nls')).toBe('');
  });
});
