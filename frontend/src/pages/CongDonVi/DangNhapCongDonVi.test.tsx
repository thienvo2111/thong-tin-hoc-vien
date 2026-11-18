import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { server } from '@/test/mocks/server';
import { loi, MAT_KHAU_TAI_KHOAN_KHAC } from '@/test/mocks/handlers';
import { db } from '@/test/mocks/db';
import { renderVoiRouter } from '@/test/testUtils';
import { layToken } from '@/auth/tokenStore';
import DangNhapCongDonVi from './DangNhapCongDonVi';

const routes = [
  { path: '/dang-nhap', element: <DangNhapCongDonVi /> },
  { path: '/doi-mat-khau', element: <div>Màn hình đổi mật khẩu</div> },
  { path: '/trang-chu', element: <div>Trang chủ cổng đơn vị</div> },
  { path: '/huong-dan', element: <div>Màn hình hướng dẫn</div> },
];

// Đứng trên Cổng đơn vị: jsdom chạy ở hostname hiện tại → cấu hình trùng hostname đó.
beforeEach(() => {
  vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', window.location.hostname);
  vi.stubEnv('VITE_SITE_URL', 'https://nls.example.edu.vn');
});
afterEach(() => {
  vi.unstubAllEnvs();
  server.events.removeAllListeners();
});

async function dangNhap(ten: string, matKhau = MAT_KHAU_TAI_KHOAN_KHAC) {
  const user = userEvent.setup();
  renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });
  await user.type(screen.getByLabelText('Tên tài khoản'), ten);
  await user.type(screen.getByLabelText('Mật khẩu'), matKhau);
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
  return user;
}

describe('Cổng đơn vị — Đăng nhập', () => {
  it('hiện nhãn "Tên tài khoản"/"Mật khẩu", không gợi ý MOET/SĐT/ngày sinh; có lối Hướng dẫn và số hỗ trợ', () => {
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });
    expect(screen.getByLabelText('Tên tài khoản')).toBeInTheDocument();
    expect(screen.getByLabelText('Mật khẩu')).toBeInTheDocument();
    expect(screen.queryByText(/MOET/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ngày sinh/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Số điện thoại' })).not.toBeInTheDocument();
    expect(screen.getByText(/Quên mật khẩu\? Liên hệ HCMUE/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Hướng dẫn/ })).toHaveAttribute('href', '/huong-dan');
  });

  it('tài khoản trường → /trang-chu; gửi kieu_dang_nhap="ma"', async () => {
    const bodies: unknown[] = [];
    server.events.on('request:start', async ({ request }) => {
      if (request.url.endsWith('/auth/dang-nhap')) bodies.push(await request.clone().json());
    });
    await dangNhap('truong-mau');
    expect(await screen.findByText('Trang chủ cổng đơn vị')).toBeInTheDocument();
    expect(bodies).toEqual([{ ten_dang_nhap: 'truong-mau', mat_khau: MAT_KHAU_TAI_KHOAN_KHAC, kieu_dang_nhap: 'ma' }]);
  });

  it('tài khoản trường phải đổi mật khẩu → /doi-mat-khau', async () => {
    await dangNhap('truong-moi');
    expect(await screen.findByText('Màn hình đổi mật khẩu')).toBeInTheDocument();
  });

  it('tài khoản Sở → /trang-chu', async () => {
    await dangNhap('so-mau');
    expect(await screen.findByText('Trang chủ cổng đơn vị')).toBeInTheDocument();
  });

  it('quản trị được vào Cổng đơn vị → /trang-chu', async () => {
    await dangNhap('quantri-mau');
    expect(await screen.findByText('Trang chủ cổng đơn vị')).toBeInTheDocument();
  });

  it('học viên → báo dùng trang NLS + link, ở lại /dang-nhap, token bị xóa', async () => {
    db.nguoiDung.vai_tro = 'hoc_vien';
    await dangNhap(db.hoSo.ma_dinh_danh_moet ?? '', 'bat-ky');
    expect(await screen.findByText(/Tài khoản này dùng trên trang Bồi dưỡng năng lực số/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Bồi dưỡng năng lực số/ })).toHaveAttribute(
      'href',
      'https://nls.example.edu.vn',
    );
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeInTheDocument();
    expect(screen.queryByText('Trang chủ cổng đơn vị')).not.toBeInTheDocument();
    await waitFor(() => expect(layToken()).toBeNull());
  });

  it('giảng viên → cũng bị chặn, không điều hướng', async () => {
    db.nguoiDung.vai_tro = 'giang_vien';
    await dangNhap(db.hoSo.ma_dinh_danh_moet ?? '', 'bat-ky');
    expect(await screen.findByText(/Tài khoản này dùng trên trang Bồi dưỡng năng lực số/)).toBeInTheDocument();
    await waitFor(() => expect(layToken()).toBeNull());
  });

  it('chưa cấu hình URL trang NLS → vẫn báo, không có link', async () => {
    vi.stubEnv('VITE_SITE_URL', '');
    await dangNhap(db.hoSo.ma_dinh_danh_moet ?? '', 'bat-ky');
    expect(await screen.findByText(/Tài khoản này dùng trên trang Bồi dưỡng năng lực số/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Bồi dưỡng năng lực số/ })).not.toBeInTheDocument();
  });

  it('sai mật khẩu → thông báo chung', async () => {
    await dangNhap('truong-mau', 'sai-mat-khau');
    expect(await screen.findByText('Tên tài khoản hoặc mật khẩu không đúng')).toBeInTheDocument();
    expect(layToken()).toBeNull();
  });

  it('423 ACCOUNT_LOCKED → thông báo tạm khóa kèm giờ mở khóa', async () => {
    server.use(
      http.post('/auth/dang-nhap', () =>
        loi(423, 'ACCOUNT_LOCKED', 'Tài khoản tạm khóa', { khoa_den: '2026-09-28T08:15:00.000Z' }),
      ),
    );
    await dangNhap('truong-mau');
    expect(await screen.findByText(/Tài khoản tạm khóa do nhập sai nhiều lần/)).toBeInTheDocument();
    expect(screen.getByText(/15:15/)).toBeInTheDocument();
  });

  it('429 → báo chờ 1 phút', async () => {
    server.use(http.post('/auth/dang-nhap', () => loi(429, 'RATE_LIMITED', 'Too Many Requests')));
    await dangNhap('truong-mau');
    expect(await screen.findByText('Bạn đã thử quá nhiều lần. Vui lòng chờ 1 phút rồi thử lại.')).toBeInTheDocument();
  });

  it('bỏ trống → báo lỗi cả 2 ô, không gửi request', async () => {
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByText('Vui lòng nhập tên tài khoản')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng nhập mật khẩu')).toBeInTheDocument();
  });
});
