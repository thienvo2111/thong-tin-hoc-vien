import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken, layToken } from '@/auth/tokenStore';
import { db } from '@/test/mocks/db';
import { RequireAuth } from './RequireAuth';

// Issue #55 / ADR 0015 P3: guard chặn vai trò sai cổng (đã đăng nhập) bằng màn TrangSaiCong, không tự chuyển hướng.
function render(vaiTro: string, duongDan = '/trang') {
  db.nguoiDung.vai_tro = vaiTro;
  datToken('token-gia-lap');
  return renderVoiRouter(
    [
      { element: <RequireAuth />, children: [{ path: '/trang', element: <div>Nội dung được bảo vệ</div> }] },
      { path: '/dang-nhap', element: <div>Màn hình đăng nhập</div> },
    ],
    { initialEntries: [duongDan] },
  );
}

afterEach(() => vi.unstubAllEnvs());

describe('RequireAuth — đúng/sai cổng', () => {
  it('đứng ở Cổng đơn vị, tài khoản học viên → TrangSaiCong, link sang trang NLS, có nút Đăng xuất', async () => {
    vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', window.location.hostname);
    vi.stubEnv('VITE_SITE_URL', 'https://nls.example.edu.vn');
    render('hoc_vien');
    expect(await screen.findByText(/Tài khoản này dùng trên trang Bồi dưỡng năng lực số/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Bồi dưỡng năng lực số/ })).toHaveAttribute(
      'href',
      'https://nls.example.edu.vn',
    );
    expect(screen.queryByText('Nội dung được bảo vệ')).not.toBeInTheDocument();
  });

  it('bấm Đăng xuất ở TrangSaiCong → xóa token, về /dang-nhap', async () => {
    vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', window.location.hostname);
    render('hoc_vien');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Đăng xuất' }));
    expect(await screen.findByText('Màn hình đăng nhập')).toBeInTheDocument();
    await waitFor(() => expect(layToken()).toBeNull());
  });

  it('đứng ở Cổng đơn vị, tài khoản trường/quản trị → thấy nội dung', async () => {
    vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', window.location.hostname);
    const { unmount } = render('truong');
    expect(await screen.findByText('Nội dung được bảo vệ')).toBeInTheDocument();
    unmount();
    render('quan_tri');
    expect(await screen.findByText('Nội dung được bảo vệ')).toBeInTheDocument();
  });

  it('đứng ở trang NLS (đã cấu hình Cổng đơn vị), tài khoản trường → TrangSaiCong, link Cổng đơn vị', async () => {
    vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', 'donvi.localhost');
    vi.stubEnv('VITE_CONG_DON_VI_URL', 'https://donvi.example.edu.vn');
    render('truong');
    expect(await screen.findByText(/Tài khoản đơn vị đăng nhập tại Cổng đơn vị/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Cổng đơn vị/ })).toHaveAttribute('href', 'https://donvi.example.edu.vn');
  });

  it('đứng ở trang NLS, học viên → thấy nội dung', async () => {
    vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', 'donvi.localhost');
    render('hoc_vien');
    expect(await screen.findByText('Nội dung được bảo vệ')).toBeInTheDocument();
  });

  it('CHƯA cấu hình Cổng đơn vị: tài khoản trường vẫn vào như trước', async () => {
    vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', '');
    render('truong');
    expect(await screen.findByText('Nội dung được bảo vệ')).toBeInTheDocument();
  });

  it('chưa đăng nhập → về /dang-nhap (hành vi cũ)', async () => {
    vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', window.location.hostname);
    renderVoiRouter(
      [
        { element: <RequireAuth />, children: [{ path: '/trang', element: <div>Nội dung được bảo vệ</div> }] },
        { path: '/dang-nhap', element: <div>Màn hình đăng nhập</div> },
      ],
      { initialEntries: ['/trang'] },
    );
    expect(await screen.findByText('Màn hình đăng nhập')).toBeInTheDocument();
  });
});
