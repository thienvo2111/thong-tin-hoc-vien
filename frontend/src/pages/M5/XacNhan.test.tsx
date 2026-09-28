import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { db } from '@/test/mocks/db';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import XacNhan from './XacNhan';

const routes = [
  { path: '/toi/xac-nhan', element: <XacNhan /> },
  { path: '/toi', element: <div>Trang của tôi</div> },
  { path: '/toi/ho-so', element: <div>Màn hình hồ sơ</div> },
];

function renderDaDangNhap() {
  datToken('token-gia-lap');
  return renderVoiRouter(routes, { initialEntries: ['/toi/xac-nhan'] });
}

describe('M5 — Xem lại & xác nhận', () => {
  it('trạng thái tải: hiện loader trong lúc chờ kiểm tra', () => {
    renderDaDangNhap();
    expect(document.querySelector('.mantine-Loader-root')).toBeInTheDocument();
  });

  it('lỗi API khi kiểm tra: hiện thông báo lỗi', async () => {
    server.use(http.post('/hoc-vien/toi/kiem-tra-truoc-xac-nhan', () => HttpResponse.error()));
    renderDaDangNhap();
    expect(await screen.findByText('Không kết nối được máy chủ. Kiểm tra mạng và thử lại.')).toBeInTheDocument();
  });

  it('hồ sơ thiếu (có lỗi) → không bấm được nút Xác nhận, mỗi lỗi có nút Sửa nhảy tới M4', async () => {
    server.use(
      http.post('/hoc-vien/toi/kiem-tra-truoc-xac-nhan', () =>
        HttpResponse.json({ loi: [{ field: 'so_dinh_danh_ca_nhan', message: 'Chưa có số CCCD' }], canh_bao: [] }),
      ),
    );
    const user = userEvent.setup();
    renderDaDangNhap();

    expect(await screen.findByText(/Số CCCD: Chưa có số CCCD/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Sửa' }));
    expect(await screen.findByText('Màn hình hồ sơ')).toBeInTheDocument();
  });

  it('có cảnh báo (không chặn) → hiện khối vàng, vẫn xác nhận được', async () => {
    server.use(
      http.post('/hoc-vien/toi/kiem-tra-truoc-xac-nhan', () =>
        HttpResponse.json({ loi: [], canh_bao: [{ field: 'ho_ten', message: 'Chưa viết hoa chữ đầu' }] }),
      ),
    );
    renderDaDangNhap();
    expect(await screen.findByText(/Chưa viết hoa chữ đầu/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeDisabled(); // chưa tick ô cam kết
  });

  it('hồ sơ đủ, chưa tick ô cam kết → nút Xác nhận vô hiệu; tick xong mới bấm được', async () => {
    const user = userEvent.setup();
    renderDaDangNhap();

    await screen.findByText('Họ và tên');
    const nutXacNhan = screen.getByRole('button', { name: 'Xác nhận' });
    expect(nutXacNhan).toBeDisabled();

    await user.click(screen.getByRole('checkbox'));
    expect(nutXacNhan).toBeEnabled();
  });

  it('bấm Xác nhận thành công → màn hình kết quả có giờ xác nhận + email đã gửi', async () => {
    db.hoSo.email_lien_he = 'giaovien@vidu.vn';
    const user = userEvent.setup();
    renderDaDangNhap();

    await screen.findByText('Họ và tên');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Xác nhận' }));

    expect(await screen.findByText(/Đã xác nhận lúc/)).toBeInTheDocument();
    expect(screen.getByText(/giaovien@vidu.vn/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Về trang chính' }));
    expect(await screen.findByText('Trang của tôi')).toBeInTheDocument();
  });

  it('hiển thị hồ sơ dạng bảng 2 cột, dùng tên danh mục thay cho id', async () => {
    db.hoSo.noi_sinh_id = 'tinh-1';
    db.hoSo.noi_sinh_ten = 'An Giang';
    renderDaDangNhap();
    await screen.findByText('Nơi sinh (tỉnh/thành)');
    expect(screen.getByText('An Giang')).toBeInTheDocument();
    expect(screen.queryByText('tinh-1')).not.toBeInTheDocument();
  });
});
