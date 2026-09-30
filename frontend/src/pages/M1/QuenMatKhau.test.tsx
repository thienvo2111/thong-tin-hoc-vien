import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderVoiRouter } from '@/test/testUtils';
import QuenMatKhau from './QuenMatKhau';

const routes = [
  { path: '/quen-mat-khau', element: <QuenMatKhau /> },
  { path: '/dang-nhap', element: <div>Màn hình đăng nhập</div> },
];

describe('M1 — Quên mật khẩu', () => {
  it('gửi mã định danh hợp lệ → hiện thông báo thành công chung', async () => {
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/quen-mat-khau'] });

    await user.type(screen.getByLabelText('Mã định danh hoặc số CCCD'), '9115131060');
    await user.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));

    expect(
      await screen.findByText(/Thầy\/Cô sẽ nhận được email hướng dẫn đặt lại mật khẩu/),
    ).toBeInTheDocument();
  });

  it('gửi mã định danh không tồn tại → VẪN hiện đúng thông báo thành công như trên (không tiết lộ)', async () => {
    // Backend LUÔN trả { da_gui: true } bất kể tài khoản có tồn tại hay không (rule #79) — mock giữ
    // nguyên hành vi thật, không giả lập lỗi cho trường hợp "không tồn tại".
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/quen-mat-khau'] });

    await user.type(screen.getByLabelText('Mã định danh hoặc số CCCD'), 'khong-ton-tai');
    await user.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));

    expect(
      await screen.findByText(/Thầy\/Cô sẽ nhận được email hướng dẫn đặt lại mật khẩu/),
    ).toBeInTheDocument();
  });

  it('bỏ trống mã định danh → báo lỗi validate, không gửi request', async () => {
    let daGoi = false;
    server.use(
      http.post('/auth/quen-mat-khau', () => {
        daGoi = true;
        return HttpResponse.json({ da_gui: true });
      }),
    );
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/quen-mat-khau'] });

    await user.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));

    expect(await screen.findByText('Vui lòng nhập mã định danh')).toBeInTheDocument();
    expect(daGoi).toBe(false);
  });

  it('lỗi mạng khi gửi → hiện banner lỗi (không phải thông báo thành công giả)', async () => {
    server.use(http.post('/auth/quen-mat-khau', () => HttpResponse.error()));
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/quen-mat-khau'] });

    await user.type(screen.getByLabelText('Mã định danh hoặc số CCCD'), '9115131060');
    await user.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));

    expect(await screen.findByText('Không kết nối được máy chủ. Kiểm tra mạng và thử lại.')).toBeInTheDocument();
  });

  it('có lối quay lại đăng nhập', async () => {
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/quen-mat-khau'] });

    await user.click(screen.getByRole('link', { name: 'Quay lại đăng nhập' }));
    expect(await screen.findByText('Màn hình đăng nhập')).toBeInTheDocument();
  });
});
