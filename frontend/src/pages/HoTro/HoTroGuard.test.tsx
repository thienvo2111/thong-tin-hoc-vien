import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { db } from '@/test/mocks/db';
import { RequireAdmin } from '@/auth/RequireAdmin';
import { RequireHoTro } from '@/auth/RequireHoTro';
import { trangChuTheoVaiTro } from '@/lib/trangChuTheoVaiTro';
import HoTroLayout from './HoTroLayout';
import HoTroTrangChu from './HoTroTrangChu';

// ADR 0003 H5: người hỗ trợ học viên có khu /ho-tro riêng, không vào được /admin; vai trò khác không vào /ho-tro.
function render(initialEntries: string[]) {
  datToken('token-gia-lap');
  return renderVoiRouter(
    [
      {
        element: <RequireAdmin />,
        children: [{ path: '/admin/tong-quan', element: <div>Màn hình tổng quan</div> }],
      },
      {
        element: <RequireHoTro />,
        children: [{ element: <HoTroLayout />, children: [{ path: '/ho-tro', element: <HoTroTrangChu /> }] }],
      },
      { path: '/toi', element: <div>Màn hình trang chủ học viên</div> },
    ],
    { initialEntries },
  );
}

describe('Khu người hỗ trợ học viên — guard', () => {
  it('trang chủ sau đăng nhập theo vai trò', () => {
    expect(trangChuTheoVaiTro('ho_tro_hoc_vien')).toBe('/ho-tro');
    expect(trangChuTheoVaiTro('hoc_vien')).toBe('/toi');
    expect(trangChuTheoVaiTro('quan_tri')).toBe('/admin/tong-quan');
    expect(trangChuTheoVaiTro(undefined)).toBe('/admin/tong-quan');
  });

  it('ho_tro_hoc_vien vào /admin/* -> về /ho-tro', async () => {
    db.nguoiDung.vai_tro = 'ho_tro_hoc_vien';
    render(['/admin/tong-quan']);
    expect(await screen.findByText('Cụm hỗ trợ của tôi')).toBeInTheDocument();
    expect(screen.queryByText('Màn hình tổng quan')).not.toBeInTheDocument();
  });

  it('ho_tro_hoc_vien vào /ho-tro -> thấy khu làm việc + nút Đăng xuất', async () => {
    db.nguoiDung.vai_tro = 'ho_tro_hoc_vien';
    render(['/ho-tro']);
    expect(await screen.findByText('Cụm hỗ trợ của tôi')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeInTheDocument();
  });

  it('quan_tri vào /ho-tro -> về Tổng quan; hoc_vien -> về /toi', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    const { unmount } = render(['/ho-tro']);
    expect(await screen.findByText('Màn hình tổng quan')).toBeInTheDocument();
    unmount();
    db.nguoiDung.vai_tro = 'hoc_vien';
    render(['/ho-tro']);
    expect(await screen.findByText('Màn hình trang chủ học viên')).toBeInTheDocument();
  });
});
