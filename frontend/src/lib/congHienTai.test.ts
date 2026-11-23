import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  chuanHoaDuongDan,
  congHienTai,
  daCauHinhCongDonVi,
  urlCong,
  vaiTroDungCong,
  viTriCong,
  viTriCongHienTai,
  xacDinhCong,
  type Cong,
} from './congHienTai';

// ADR 0015 P3/T7: cổng nhận diện theo hostname cấu hình; chưa cấu hình → mọi thứ như cũ (NLS).
afterEach(() => {
  vi.unstubAllEnvs();
  window.history.replaceState(null, '', '/');
});

describe('xacDinhCong', () => {
  it('hostname khớp cấu hình → don_vi', () => {
    expect(xacDinhCong('donvi.hcmue.edu.vn', '/', 'donvi.hcmue.edu.vn', undefined)).toBe('don_vi');
  });

  it('khớp không phân biệt hoa thường, bỏ khoảng trắng thừa trong cấu hình', () => {
    expect(xacDinhCong('DonVi.HCMUE.edu.vn', '/', '  donvi.hcmue.edu.VN ', undefined)).toBe('don_vi');
  });

  it('hostname khác → nls (kể cả tên miền con/cha gần giống)', () => {
    expect(xacDinhCong('boiduongnls.hcmue.edu.vn', '/', 'donvi.hcmue.edu.vn', undefined)).toBe('nls');
    expect(xacDinhCong('x.donvi.hcmue.edu.vn', '/', 'donvi.hcmue.edu.vn', undefined)).toBe('nls');
    expect(xacDinhCong('hcmue.edu.vn', '/', 'donvi.hcmue.edu.vn', undefined)).toBe('nls');
  });

  it('chưa cấu hình (undefined, rỗng, chỉ khoảng trắng) → nls', () => {
    expect(xacDinhCong('donvi.hcmue.edu.vn', '/', undefined, undefined)).toBe('nls');
    expect(xacDinhCong('donvi.hcmue.edu.vn', '/', '', undefined)).toBe('nls');
    expect(xacDinhCong('', '/', '   ', undefined)).toBe('nls');
  });
});

// Tạm khi chưa có tên miền (ADR 0015 T7): Cổng đơn vị ở tiền tố đường dẫn của origin NLS.
describe('viTriCong — chế độ đường dẫn', () => {
  const NLS = { cong: 'nls', basename: '' };
  const CDV = { cong: 'don_vi', basename: '/cdv' };

  it.each(['/cdv', '/cdv/', '/cdv/trang-chu', '/cdv/nls/hoc-vien/hv-1', '/CDV/Trang-chu'])(
    '%s → don_vi, basename /cdv',
    (p) => {
      expect(viTriCong('boiduongnls.hcmue.edu.vn', p, undefined, '/cdv')).toEqual(CDV);
    },
  );

  it.each(['/cdvx', '/cdvx/trang-chu', '/', '/admin', '/admin/cdv', '/dang-nhap'])('%s → nls', (p) => {
    expect(viTriCong('boiduongnls.hcmue.edu.vn', p, undefined, '/cdv')).toEqual(NLS);
  });

  it('hostname khớp thắng đường dẫn: cổng ở gốc, không basename', () => {
    expect(viTriCong('donvi.hcmue.edu.vn', '/cdv/trang-chu', 'donvi.hcmue.edu.vn', '/cdv')).toEqual({
      cong: 'don_vi',
      basename: '',
    });
    expect(xacDinhCong('donvi.hcmue.edu.vn', '/trang-chu', 'donvi.hcmue.edu.vn', '/cdv')).toBe('don_vi');
  });

  it('hostname cấu hình khác + đường dẫn khớp → vẫn vào cổng theo đường dẫn', () => {
    expect(viTriCong('boiduongnls.hcmue.edu.vn', '/cdv/x', 'donvi.hcmue.edu.vn', '/cdv')).toEqual(CDV);
  });

  it('cả 2 cấu hình trống → nls', () => {
    expect(viTriCong('boiduongnls.hcmue.edu.vn', '/cdv/trang-chu', '', '')).toEqual(NLS);
    expect(viTriCong('boiduongnls.hcmue.edu.vn', '/cdv', undefined, undefined)).toEqual(NLS);
    expect(viTriCong('x', '/', ' ', '/')).toEqual(NLS);
  });

  it('chuẩn hóa giá trị env: thêm / đầu, bỏ / cuối, chữ thường, bỏ khoảng trắng', () => {
    expect(chuanHoaDuongDan('cdv/')).toBe('/cdv');
    expect(chuanHoaDuongDan('/CDV')).toBe('/cdv');
    expect(chuanHoaDuongDan('  //cdv//  ')).toBe('/cdv');
    expect(chuanHoaDuongDan('')).toBe('');
    expect(chuanHoaDuongDan('/')).toBe('');
    expect(chuanHoaDuongDan(undefined)).toBe('');
    expect(viTriCong('h', '/cdv/trang-chu', undefined, 'CDV/')).toEqual(CDV);
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

  it('chế độ đường dẫn: đang ở /cdv/... → don_vi + basename; ở / → nls; daCauHinh = true ở cả 2', () => {
    vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', '');
    vi.stubEnv('VITE_CONG_DON_VI_DUONG_DAN', '/cdv');
    window.history.replaceState(null, '', '/cdv/trang-chu');
    expect(viTriCongHienTai()).toEqual({ cong: 'don_vi', basename: '/cdv' });
    expect(congHienTai()).toBe('don_vi');
    expect(daCauHinhCongDonVi()).toBe(true);
    window.history.replaceState(null, '', '/dang-nhap');
    expect(viTriCongHienTai()).toEqual({ cong: 'nls', basename: '' });
    expect(daCauHinhCongDonVi()).toBe(true);
  });

  it('biến đường dẫn trống (như hiện nay trên VPS) → /cdv/... vẫn là nls, daCauHinh = false', () => {
    vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', '');
    vi.stubEnv('VITE_CONG_DON_VI_DUONG_DAN', '');
    window.history.replaceState(null, '', '/cdv/trang-chu');
    expect(congHienTai()).toBe('nls');
    expect(daCauHinhCongDonVi()).toBe(false);
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

  it('chế độ đường dẫn, có URL cấu hình → dùng URL cấu hình', () => {
    vi.stubEnv('VITE_CONG_DON_VI_DUONG_DAN', '/cdv');
    vi.stubEnv('VITE_CONG_DON_VI_URL', 'https://boiduongnls.hcmue.edu.vn/cdv');
    vi.stubEnv('VITE_SITE_URL', 'https://boiduongnls.hcmue.edu.vn');
    expect(urlCong('don_vi')).toBe('https://boiduongnls.hcmue.edu.vn/cdv');
    expect(urlCong('nls')).toBe('https://boiduongnls.hcmue.edu.vn');
  });

  it('chế độ đường dẫn, thiếu URL → Cổng đơn vị = origin + tiền tố; NLS = origin khi đang trong /cdv', () => {
    vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', '');
    vi.stubEnv('VITE_CONG_DON_VI_DUONG_DAN', 'cdv/');
    vi.stubEnv('VITE_CONG_DON_VI_URL', '');
    vi.stubEnv('VITE_SITE_URL', '');
    expect(urlCong('don_vi')).toBe(`${window.location.origin}/cdv`);
    expect(urlCong('nls')).toBe('');
    window.history.replaceState(null, '', '/cdv/trang-chu');
    expect(urlCong('nls')).toBe(window.location.origin);
  });
});
