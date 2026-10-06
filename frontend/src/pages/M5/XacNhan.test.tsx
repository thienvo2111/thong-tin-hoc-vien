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
  { path: '/toi/yeu-cau-ho-tro', element: <div>Màn hình hỗ trợ</div> },
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

  it('409 khi xác nhận (đã xác nhận ở đợt này) → hiện đúng thông điệp server, không phải câu trùng CCCD', async () => {
    const thongDiep = 'Thầy/Cô đã xác nhận hồ sơ ở đợt này. Chỉ cần xác nhận lại khi có điều chỉnh thông tin.';
    server.use(
      http.post('/hoc-vien/toi/xac-nhan', () =>
        HttpResponse.json({ error: { code: 'CONFLICT', message: thongDiep } }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    renderDaDangNhap();
    await user.click(await screen.findByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Xác nhận' }));
    expect(await screen.findByText(thongDiep)).toBeInTheDocument();
    expect(screen.queryByText(/Số CCCD này đã được dùng/)).not.toBeInTheDocument();
  });

  it('hiển thị hồ sơ dạng bảng 2 cột, dùng tên danh mục thay cho id', async () => {
    db.hoSo.noi_sinh_xa = 'Xã Long Xuyên';
    db.hoSo.noi_sinh_tinh = 'An Giang (cũ)';
    db.hoSo.cu_tru_tinh_id = 'tinh-1';
    db.hoSo.cu_tru_tinh_ten = 'An Giang';
    db.hoSo.cu_tru_phuong_xa_id = 'phuong-1';
    db.hoSo.cu_tru_phuong_xa_ten = 'Phường Long Xuyên';
    renderDaDangNhap();
    await screen.findByText('Nơi sinh');
    expect(screen.getByText('Xã Long Xuyên, An Giang (cũ)')).toBeInTheDocument();
    await screen.findByText('Cư trú');
    expect(screen.getByText('Phường Long Xuyên, An Giang')).toBeInTheDocument();
  });

  describe('khóa xác nhận lại & quá đợt (2026-10-05)', () => {
    it('đã xác nhận ở đợt đang mở -> báo đã xác nhận, không có ô cam kết/nút Xác nhận, vẫn có Chỉnh sửa thông tin', async () => {
      db.dotXacNhan.da_xac_nhan = true;
      db.dotXacNhan.xac_nhan_luc = '2026-10-03T02:00:00.000Z';
      renderDaDangNhap();
      expect(await screen.findByText('Thầy/Cô đã xác nhận hồ sơ')).toBeInTheDocument();
      expect(screen.getByText(/Đã xác nhận lúc 03\/10\/2026 09:00/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Xác nhận/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Chỉnh sửa thông tin/ })).toHaveAttribute('href', '/toi/ho-so');
    });

    it('đã xác nhận rồi điều chỉnh hồ sơ -> nhắc "thông tin đã được điều chỉnh", nút đổi thành "Xác nhận lại"', async () => {
      db.dotXacNhan.can_xac_nhan_lai = true;
      db.dotXacNhan.dieu_chinh_luc = '2026-10-04T03:00:00.000Z';
      const user = userEvent.setup();
      renderDaDangNhap();
      expect(await screen.findByText('Thông tin hồ sơ đã được điều chỉnh')).toBeInTheDocument();
      expect(screen.getByText(/có điều chỉnh lúc 04\/10\/2026 10:00/)).toBeInTheDocument();
      await user.click(await screen.findByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: 'Xác nhận lại' }));
      expect(await screen.findByText('Đã xác nhận')).toBeInTheDocument();
    });

    it('đã quá đợt -> hết thời gian xác nhận, nút Gửi yêu cầu hỗ trợ; không xác nhận/sửa được', async () => {
      db.dotXacNhan.dot = null;
      db.dotXacNhan.dang_mo = false;
      db.dotXacNhan.xac_nhan_gan_nhat = { dot_ten: 'Kiểm tra hồ sơ đợt 1', xac_nhan_luc: '2026-10-03T02:00:00.000Z' };
      renderDaDangNhap();
      expect(await screen.findByText('Đã hết thời gian xác nhận')).toBeInTheDocument();
      expect(screen.getByText(/đã xác nhận hồ sơ lúc 03\/10\/2026 09:00/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Gửi yêu cầu hỗ trợ' })).toHaveAttribute('href', '/toi/yeu-cau-ho-tro');
      expect(screen.queryByRole('button', { name: /^Xác nhận/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Chỉnh sửa thông tin/ })).not.toBeInTheDocument();
    });

    it('chưa tới đợt kế tiếp -> báo giờ mở, không nút hỗ trợ', async () => {
      db.dotXacNhan.dot = null;
      db.dotXacNhan.dang_mo = false;
      db.dotXacNhan.dot_sap_mo = { ten: 'Kiểm tra hồ sơ đợt 2', mo_luc: '2026-11-01T01:00:00.000Z' };
      renderDaDangNhap();
      expect(await screen.findByText(/Đợt xác nhận tiếp theo mở lúc 01\/11\/2026 08:00/)).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Gửi yêu cầu hỗ trợ' })).not.toBeInTheDocument();
    });

    it('server báo đợt vừa đóng khi bấm xác nhận -> chuyển sang hướng dẫn gửi hỗ trợ', async () => {
      server.use(
        http.post('/hoc-vien/toi/xac-nhan', () =>
          HttpResponse.json({ error: { code: 'DOT_XAC_NHAN_DONG', message: 'Đợt xác nhận đã đóng' } }, { status: 403 }),
        ),
      );
      const user = userEvent.setup();
      renderDaDangNhap();
      await user.click(await screen.findByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: 'Xác nhận' }));
      expect(await screen.findByText('Đã hết thời gian xác nhận')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Gửi yêu cầu hỗ trợ' })).toBeInTheDocument();
    });

    it('hồ sơ tự đăng ký (không áp dụng đợt) -> vẫn xác nhận như cũ', async () => {
      db.dotXacNhan.ap_dung_dot = false;
      db.dotXacNhan.dot = null;
      renderDaDangNhap();
      expect(await screen.findByRole('button', { name: 'Xác nhận' })).toBeInTheDocument();
      expect(screen.queryByText('Đã hết thời gian xác nhận')).not.toBeInTheDocument();
    });
  });
});
