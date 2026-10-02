import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { loi } from '@/test/mocks/handlers';
import { renderVoiRouter } from '@/test/testUtils';
import DangNhap from './DangNhap';

const routes = [
  { path: '/dang-nhap', element: <DangNhap /> },
  { path: '/doi-mat-khau', element: <div>Màn hình đổi mật khẩu</div> },
  { path: '/toi', element: <div>Trang của tôi</div> },
  { path: '/quen-mat-khau', element: <div>Màn hình quên mật khẩu</div> },
];

describe('M1 — Đăng nhập', () => {
  it('đăng nhập bằng mã MOET + mật khẩu đúng (ngày sinh) → chuyển sang M2', async () => {
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });

    await user.type(screen.getByLabelText('Mã định danh hoặc số CCCD'), '9115131060');
    await user.type(screen.getByLabelText('Mật khẩu'), '08121983');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText('Màn hình đổi mật khẩu')).toBeInTheDocument();
  });

  it('dán mã định danh có khoảng trắng vẫn đăng nhập được (khoảng trắng bị loại bỏ)', async () => {
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });

    const oMaDinhDanh = screen.getByLabelText('Mã định danh hoặc số CCCD') as HTMLInputElement;
    oMaDinhDanh.focus();
    await user.paste('9115 131060');
    expect(oMaDinhDanh.value).toBe('9115131060');

    await user.type(screen.getByLabelText('Mật khẩu'), '08121983');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText('Màn hình đổi mật khẩu')).toBeInTheDocument();
  });

  it('sai mã định danh hoặc mật khẩu → 1 thông báo chung, không phân biệt sai phần nào', async () => {
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });

    await user.type(screen.getByLabelText('Mã định danh hoặc số CCCD'), 'sai-ma');
    await user.type(screen.getByLabelText('Mật khẩu'), 'sai-mat-khau');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText('Mã định danh hoặc mật khẩu không đúng')).toBeInTheDocument();
  });

  it('423 ACCOUNT_LOCKED → thông báo tạm khóa kèm giờ mở khóa (giờ Việt Nam)', async () => {
    server.use(
      http.post('/auth/dang-nhap', () => loi(423, 'ACCOUNT_LOCKED', 'Tài khoản tạm khóa', { khoa_den: '2026-09-28T08:15:00.000Z' })),
    );
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });

    await user.type(screen.getByLabelText('Mã định danh hoặc số CCCD'), '9115131060');
    await user.type(screen.getByLabelText('Mật khẩu'), 'sai');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText(/Tài khoản tạm khóa do nhập sai nhiều lần/)).toBeInTheDocument();
    expect(screen.getByText(/15:15/)).toBeInTheDocument();
  });

  it('trạng thái tải: nút hiện loading khi đang gửi request', async () => {
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });

    await user.type(screen.getByLabelText('Mã định danh hoặc số CCCD'), '9115131060');
    await user.type(screen.getByLabelText('Mật khẩu'), '08121983');
    const nutGui = screen.getByRole('button', { name: 'Đăng nhập' });
    await user.click(nutGui);

    await waitFor(() => expect(nutGui).toHaveAttribute('data-loading', 'true'));
  });

  it('bấm "Không biết mã định danh?" → hiện khung hướng dẫn liên hệ', async () => {
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });

    await user.click(screen.getByRole('button', { name: 'Không biết mã định danh?' }));
    expect(await screen.findByText(/liên hệ bộ phận phụ trách/)).toBeInTheDocument();
  });

  it('có lối "Quên mật khẩu?" dẫn sang màn quên mật khẩu', async () => {
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });

    await user.click(screen.getByRole('link', { name: 'Quên mật khẩu?' }));
    expect(await screen.findByText('Màn hình quên mật khẩu')).toBeInTheDocument();
  });
});

describe('M1 — Đăng nhập theo chế độ triển khai (cấu hình quản trị)', () => {
  it('chưa lưu cấu hình (mặc định "khao_sat"): báo học viên chưa cần đăng nhập + link về khối khảo sát; form vẫn dùng được', async () => {
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });
    expect(await screen.findByText('Học viên chưa cần đăng nhập')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Đi tới trang khảo sát' })).toHaveAttribute('href', '/#khao-sat');
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeEnabled();
  });

  it('quản trị chọn "dang_nhap": không hiện thông báo khảo sát', async () => {
    let daGoi = false;
    server.use(
      http.get('/cau-hinh-khao-sat', () => {
        daGoi = true;
        return HttpResponse.json({
          cau_hinh: { che_do_hoc_vien: 'dang_nhap', danh_gia_dau_vao_trong_cong: true, hien_khao_sat: false, phieu: [] },
          cap_nhat_luc: '2026-10-02T03:00:00.000Z',
        });
      }),
    );
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });
    await waitFor(() => expect(daGoi).toBe(true));
    await screen.findByRole('button', { name: 'Đăng nhập' });
    await waitFor(() => expect(screen.queryByText('Học viên chưa cần đăng nhập')).not.toBeInTheDocument());
  });
});
