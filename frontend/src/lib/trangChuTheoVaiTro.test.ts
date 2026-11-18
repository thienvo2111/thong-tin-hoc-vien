import { afterEach, describe, expect, it, vi } from 'vitest';
import { trangChuTheoVaiTro } from './trangChuTheoVaiTro';

afterEach(() => vi.unstubAllEnvs());

describe('trangChuTheoVaiTro', () => {
  const NLS: [string | undefined, string][] = [
    ['hoc_vien', '/toi'],
    ['ho_tro_hoc_vien', '/ho-tro'],
    ['ho_tro_giang_vien', '/ho-tro-gv'],
    ['giang_vien', '/giang-day'],
    ['quan_tri', '/admin/tong-quan'],
    ['truong', '/admin/tong-quan'],
    ['so_gddt', '/admin/tong-quan'],
    ['phong_vhxh', '/admin/tong-quan'],
    [undefined, '/admin/tong-quan'],
  ];

  it.each(NLS)('cổng nls: %s → %s (giữ nguyên như trước)', (vaiTro, trang) => {
    expect(trangChuTheoVaiTro(vaiTro, 'nls')).toBe(trang);
  });

  it.each(NLS)('Cổng đơn vị: %s → /trang-chu', (vaiTro) => {
    expect(trangChuTheoVaiTro(vaiTro, 'don_vi')).toBe('/trang-chu');
  });

  it('không truyền cổng + chưa cấu hình Cổng đơn vị → như nls', () => {
    vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', '');
    expect(trangChuTheoVaiTro('hoc_vien')).toBe('/toi');
    expect(trangChuTheoVaiTro('truong')).toBe('/admin/tong-quan');
  });

  it('không truyền cổng + đang đứng ở Cổng đơn vị → /trang-chu', () => {
    vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', window.location.hostname);
    expect(trangChuTheoVaiTro('truong')).toBe('/trang-chu');
  });
});
