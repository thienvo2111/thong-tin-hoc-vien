import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MAT_KHAU_TAI_KHOAN_KHAC } from '@/test/mocks/handlers';
import { renderVoiRouter } from '@/test/testUtils';
import { layToken } from '@/auth/tokenStore';
import DangNhap from './DangNhap';

// Issue #55 / ADR 0015 P3: tài khoản đơn vị đăng nhập nhầm trang NLS → báo + link sang Cổng đơn vị, không chuyển hướng.
const routes = [
  { path: '/dang-nhap', element: <DangNhap /> },
  { path: '/doi-mat-khau', element: <div>Màn hình đổi mật khẩu</div> },
  { path: '/toi', element: <div>Trang của tôi</div> },
  { path: '/admin/tong-quan', element: <div>Màn hình tổng quan</div> },
];

afterEach(() => vi.unstubAllEnvs());

async function dangNhap(ten: string) {
  const user = userEvent.setup();
  renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });
  await user.type(screen.getByLabelText('Tên tài khoản hoặc mã định danh MOET'), ten);
  await user.type(screen.getByLabelText('Mật khẩu'), MAT_KHAU_TAI_KHOAN_KHAC);
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
}

describe('M1 — Đăng nhập nhầm cổng', () => {
  it('đã cấu hình Cổng đơn vị: tài khoản trường → báo + link Cổng đơn vị, ở lại /dang-nhap, token bị xóa', async () => {
    vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', 'donvi.localhost');
    vi.stubEnv('VITE_CONG_DON_VI_URL', 'https://donvi.example.edu.vn');
    await dangNhap('truong-mau');

    expect(await screen.findByText(/Tài khoản đơn vị đăng nhập tại Cổng đơn vị/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Cổng đơn vị/ })).toHaveAttribute('href', 'https://donvi.example.edu.vn');
    expect(screen.queryByText('Màn hình tổng quan')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeInTheDocument();
    await waitFor(() => expect(layToken()).toBeNull());
  });

  it('đã cấu hình Cổng đơn vị: quản trị vẫn vào trang NLS như cũ', async () => {
    vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', 'donvi.localhost');
    await dangNhap('quantri-mau');
    expect(await screen.findByText('Màn hình tổng quan')).toBeInTheDocument();
  });

  it('CHƯA cấu hình Cổng đơn vị: tài khoản trường vào /admin/tong-quan như trước', async () => {
    vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', '');
    await dangNhap('truong-mau');
    expect(await screen.findByText('Màn hình tổng quan')).toBeInTheDocument();
    expect(screen.queryByText(/Tài khoản đơn vị đăng nhập tại Cổng đơn vị/)).not.toBeInTheDocument();
  });
});
