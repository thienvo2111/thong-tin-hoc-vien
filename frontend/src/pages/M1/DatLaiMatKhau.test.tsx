import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderVoiRouter } from '@/test/testUtils';
import DatLaiMatKhau from './DatLaiMatKhau';

const routes = [
  { path: '/dat-lai-mat-khau', element: <DatLaiMatKhau /> },
  { path: '/dang-nhap', element: <div>Màn hình đăng nhập</div> },
  { path: '/quen-mat-khau', element: <div>Màn hình quên mật khẩu</div> },
];

describe('M1 — Đặt lại mật khẩu', () => {
  it('không có token trên URL → báo lỗi liên kết không hợp lệ, có lối yêu cầu liên kết mới, KHÔNG hiện form', async () => {
    renderVoiRouter(routes, { initialEntries: ['/dat-lai-mat-khau'] });

    expect(await screen.findByText('Liên kết không hợp lệ hoặc đã hết hạn')).toBeInTheDocument();
    expect(screen.queryByLabelText('Mật khẩu mới')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Yêu cầu liên kết mới' })).toBeInTheDocument();
  });

  it('token hợp lệ + mật khẩu mới hợp lệ → đặt lại thành công, điều hướng về đăng nhập', async () => {
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dat-lai-mat-khau?token=token-hop-le'] });

    await user.type(screen.getByLabelText('Mật khẩu mới'), 'MatKhau123');
    await user.type(screen.getByLabelText('Nhập lại mật khẩu mới'), 'MatKhau123');
    await user.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }));

    expect(await screen.findByText('Màn hình đăng nhập')).toBeInTheDocument();
  });

  it('token sai/hết hạn → hiện 1 thông báo lỗi chung, có lối yêu cầu liên kết mới', async () => {
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dat-lai-mat-khau?token=token-sai'] });

    await user.type(screen.getByLabelText('Mật khẩu mới'), 'MatKhau123');
    await user.type(screen.getByLabelText('Nhập lại mật khẩu mới'), 'MatKhau123');
    await user.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }));

    expect(await screen.findByText('Liên kết không hợp lệ hoặc đã hết hạn')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Yêu cầu liên kết mới' })).toBeInTheDocument();
    expect(screen.queryByText('Màn hình đăng nhập')).not.toBeInTheDocument();
  });

  it('mật khẩu mới quá ngắn → báo lỗi validate ngay, không gửi request', async () => {
    let daGoi = false;
    server.use(
      http.post('/auth/dat-lai-mat-khau', () => {
        daGoi = true;
        return HttpResponse.json({ da_dat_lai: true });
      }),
    );
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dat-lai-mat-khau?token=token-hop-le'] });

    await user.type(screen.getByLabelText('Mật khẩu mới'), 'abc123');
    await user.type(screen.getByLabelText('Nhập lại mật khẩu mới'), 'abc123');
    await user.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }));

    expect(await screen.findByText('Mật khẩu mới phải có ít nhất 8 ký tự')).toBeInTheDocument();
    expect(daGoi).toBe(false);
  });

  it('hai ô mật khẩu không trùng nhau → báo lỗi ở ô nhập lại', async () => {
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dat-lai-mat-khau?token=token-hop-le'] });

    await user.type(screen.getByLabelText('Mật khẩu mới'), 'MatKhau123');
    await user.type(screen.getByLabelText('Nhập lại mật khẩu mới'), 'MatKhauKhac1');
    await user.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }));

    expect(await screen.findByText('Hai ô mật khẩu chưa trùng nhau')).toBeInTheDocument();
  });

  it('lỗi field mat_khau_moi từ API (vd trùng ngày sinh) → hiện lỗi ngay dưới ô mật khẩu mới', async () => {
    server.use(
      http.post('/auth/dat-lai-mat-khau', () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Mật khẩu mới không đạt yêu cầu',
              fields: [{ field: 'mat_khau_moi', message: 'Không được trùng ngày sinh (định dạng ddmmyyyy)' }],
            },
          },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dat-lai-mat-khau?token=token-hop-le'] });

    await user.type(screen.getByLabelText('Mật khẩu mới'), 'MatKhau123');
    await user.type(screen.getByLabelText('Nhập lại mật khẩu mới'), 'MatKhau123');
    await user.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }));

    expect(await screen.findByText('Không được trùng ngày sinh (định dạng ddmmyyyy)')).toBeInTheDocument();
  });
});
