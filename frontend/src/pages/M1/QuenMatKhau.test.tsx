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

    await user.type(screen.getByLabelText('Tên tài khoản hoặc mã định danh MOET'), '9115131060');
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

    await user.type(screen.getByLabelText('Tên tài khoản hoặc mã định danh MOET'), 'khong-ton-tai');
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

    await user.type(screen.getByLabelText('Tên tài khoản hoặc mã định danh MOET'), '9115131060');
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

// Spec 2026-10-09 Q-C: quên mật khẩu cũng chọn mã định danh MOET hoặc số điện thoại.
describe('M1 — Quên mật khẩu theo mã MOET hoặc số điện thoại', () => {
  function batBody() {
    const bodies: unknown[] = [];
    server.use(
      http.post('/auth/quen-mat-khau', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ da_gui: true });
      }),
    );
    return bodies;
  }

  it('có thanh chọn 2 chế độ + ghi chú liên hệ Zalo khi chưa xác minh email, không có chữ CCCD', () => {
    renderVoiRouter(routes, { initialEntries: ['/quen-mat-khau'] });
    expect(screen.getByRole('radio', { name: 'Mã định danh MOET' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Số điện thoại' })).toBeInTheDocument();
    expect(
      screen.getByText('Chưa xác minh email? Liên hệ nhóm Zalo hỗ trợ của trường để được cấp mật khẩu tạm.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/CCCD/)).not.toBeInTheDocument();
  });

  it('chế độ mã: gửi kieu_dang_nhap="ma"', async () => {
    const bodies = batBody();
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/quen-mat-khau'] });
    await user.type(screen.getByLabelText('Tên tài khoản hoặc mã định danh MOET'), '9115131060');
    await user.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));

    await screen.findByText(/Thầy\/Cô sẽ nhận được email/);
    expect(bodies).toEqual([{ ten_dang_nhap: '9115131060', kieu_dang_nhap: 'ma' }]);
  });

  it('chế độ SĐT: gửi kieu_dang_nhap="sdt", vẫn hiện thông báo chung', async () => {
    const bodies = batBody();
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/quen-mat-khau'] });
    await user.click(screen.getByRole('radio', { name: 'Số điện thoại' }));
    await user.type(screen.getByRole('textbox', { name: 'Số điện thoại' }), '0912345678');
    await user.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));

    await screen.findByText(/Thầy\/Cô sẽ nhận được email/);
    expect(bodies).toEqual([{ ten_dang_nhap: '0912345678', kieu_dang_nhap: 'sdt' }]);
  });

  it('chế độ SĐT: quá ít chữ số → báo lỗi, không gửi request', async () => {
    const bodies = batBody();
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/quen-mat-khau'] });
    await user.click(screen.getByRole('radio', { name: 'Số điện thoại' }));
    await user.type(screen.getByRole('textbox', { name: 'Số điện thoại' }), '0912');
    await user.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));

    expect(await screen.findByText('Số điện thoại phải có từ 9 đến 12 chữ số')).toBeInTheDocument();
    expect(bodies).toHaveLength(0);
  });

  it('dùng chung lựa chọn đã nhớ từ màn đăng nhập', () => {
    localStorage.setItem('kieu_dang_nhap', 'sdt');
    renderVoiRouter(routes, { initialEntries: ['/quen-mat-khau'] });
    expect(screen.getByRole('radio', { name: 'Số điện thoại' })).toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Số điện thoại' })).toBeInTheDocument();
  });
});
