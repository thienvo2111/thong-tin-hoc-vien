import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { server } from '@/test/mocks/server';
import { loi } from '@/test/mocks/handlers';
import { renderVoiRouter } from '@/test/testUtils';
import DangNhap from '@/pages/M1/DangNhap';
import DoiMatKhau from './DoiMatKhau';

const routes = [
  { path: '/dang-nhap', element: <DangNhap /> },
  { path: '/doi-mat-khau', element: <DoiMatKhau /> },
  { path: '/toi', element: <div>Trang của tôi</div> },
];

async function dangNhapTruoc(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Mã định danh'), '9115131060');
  await user.type(screen.getByLabelText('Mật khẩu'), '08121983');
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
  await screen.findByRole('heading', { name: 'Đổi mật khẩu' });
}

describe('M2 — Đổi mật khẩu lần đầu', () => {
  it('checklist tích xanh theo thời gian thực khi gõ mật khẩu mới hợp lệ', async () => {
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });
    await dangNhapTruoc(user);

    await user.type(screen.getByLabelText('Mật khẩu mới'), 'MatKhau123');
    await user.type(screen.getByLabelText('Nhập lại mật khẩu mới'), 'MatKhau123');

    // Checklist hiện đủ 4 điều kiện; mật khẩu hợp lệ nên submit không bị chặn bởi lỗi validate.
    expect(screen.getByText('Ít nhất 8 ký tự')).toBeInTheDocument();
    expect(screen.getByText('Có chữ và số')).toBeInTheDocument();
    expect(screen.getByText('Khác ngày sinh')).toBeInTheDocument();
    expect(screen.getByText('Hai ô mật khẩu mới trùng nhau')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
    expect(await screen.findByText('Trang của tôi')).toBeInTheDocument();
  });

  it('mật khẩu mới trùng ngày sinh → checklist "Khác ngày sinh" không tích xanh, không cho đổi', async () => {
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });
    await dangNhapTruoc(user);

    // Ngày sinh viết liền (ddmmyyyy) toàn chữ số nên khi dùng làm mật khẩu mới cũng luôn vi phạm
    // đồng thời điều kiện "có chữ và số" — đúng như dieuKienMatKhau() định nghĩa; kiểm bằng chính
    // dòng checklist "Khác ngày sinh" (thời gian thực) thay vì đoán trước thông điệp lỗi nào thắng.
    await user.type(screen.getByLabelText('Mật khẩu mới'), '08121983');
    await user.type(screen.getByLabelText('Nhập lại mật khẩu mới'), '08121983');

    const dongKhacNgaySinh = screen.getByText('Khác ngày sinh').closest('li');
    expect(dongKhacNgaySinh).toHaveTextContent('○');

    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
    expect(screen.queryByText('Trang của tôi')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Đổi mật khẩu' })).toBeInTheDocument();
  });

  it('hai ô mật khẩu mới không trùng nhau → báo lỗi ở ô nhập lại', async () => {
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });
    await dangNhapTruoc(user);

    await user.type(screen.getByLabelText('Mật khẩu mới'), 'MatKhau123');
    await user.type(screen.getByLabelText('Nhập lại mật khẩu mới'), 'MatKhauKhac1');
    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

    expect(await screen.findByText('Hai ô mật khẩu chưa trùng nhau')).toBeInTheDocument();
  });

  it('lỗi mat_khau_cu từ API hiển thị dạng banner (ô mật khẩu hiện tại đang ẩn vì đã tự điền)', async () => {
    server.use(
      http.post('/auth/doi-mat-khau', () =>
        loi(400, 'VALIDATION_ERROR', 'Không hợp lệ', { fields: [{ field: 'mat_khau_cu', message: 'Mật khẩu hiện tại không đúng' }] }),
      ),
    );
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });
    await dangNhapTruoc(user);

    await user.type(screen.getByLabelText('Mật khẩu mới'), 'MatKhau123');
    await user.type(screen.getByLabelText('Nhập lại mật khẩu mới'), 'MatKhau123');
    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

    expect(await screen.findByText('Mật khẩu hiện tại không đúng')).toBeInTheDocument();
  });

  it('có lối "Đăng xuất" ngay trên màn hình (không có TopBar ở M2)', async () => {
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });
    await dangNhapTruoc(user);

    await user.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    expect(await screen.findByLabelText('Mã định danh')).toBeInTheDocument();
  });
});
