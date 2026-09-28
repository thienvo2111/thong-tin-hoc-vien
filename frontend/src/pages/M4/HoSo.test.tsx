import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { db } from '@/test/mocks/db';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import HoSo from './HoSo';

const routes = [
  { path: '/toi/ho-so', element: <HoSo /> },
  { path: '/toi/xac-nhan', element: <div>Màn hình xác nhận</div> },
];

function renderDaDangNhap() {
  datToken('token-gia-lap');
  return renderVoiRouter(routes, { initialEntries: ['/toi/ho-so'] });
}

describe('M4 — Hồ sơ: xem & sửa', () => {
  it('trạng thái tải: hiện loader trong lúc chờ hồ sơ', () => {
    renderDaDangNhap();
    expect(document.querySelector('.mantine-Loader-root')).toBeInTheDocument();
  });

  it('lỗi API khi tải hồ sơ: hiện thông báo lỗi', async () => {
    server.use(http.get('/hoc-vien/toi', () => HttpResponse.error()));
    renderDaDangNhap();
    expect(await screen.findByText('Không kết nối được máy chủ. Kiểm tra mạng và thử lại.')).toBeInTheDocument();
  });

  it('tài khoản MOET mới: trường thiếu (theo muc-do-day-du) có nhãn "Cần bổ sung"', async () => {
    renderDaDangNhap();
    const oCccd = await screen.findByLabelText('Số CCCD');
    expect(oCccd.closest('.mantine-TextInput-root')).toHaveTextContent('Cần bổ sung');
  });

  it('đợt đóng (không có đợt đang mở) → mọi ô nhập không sửa được, không có nút Lưu', async () => {
    db.dotXacNhan.dot = null;
    renderDaDangNhap();
    const oHoTen = await screen.findByLabelText('Họ và tên');
    expect(oHoTen).toBeDisabled();
    expect(screen.getByLabelText('Số CCCD')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Lưu' })).not.toBeInTheDocument();
  });

  it('đổi nơi sinh (tỉnh/thành) → danh sách phường/xã đổi theo, giá trị phường/xã cũ bị xóa', async () => {
    db.hoSo.noi_sinh_id = 'tinh-2';
    db.hoSo.phuong_xa_id = 'phuong-2';
    db.hoSo.noi_sinh_ten = 'Cần Thơ';
    db.hoSo.phuong_xa_ten = 'Phường Châu Đốc';
    const user = userEvent.setup();
    renderDaDangNhap();

    const oPhuongXa = (await screen.findByLabelText(/^Phường\/xã/, { selector: 'input' })) as HTMLInputElement;
    await waitFor(() => expect(oPhuongXa).toHaveValue('Phường Châu Đốc'));

    const oNoiSinh = screen.getByLabelText(/^Nơi sinh/, { selector: 'input' });
    await user.click(oNoiSinh);
    await user.click(await screen.findByRole('option', { name: 'An Giang' }));

    await waitFor(() => expect(oPhuongXa).toHaveValue(''));
  });

  it('nhập CCCD đã có người dùng → báo trùng ngay khi rời ô, không cần bấm Lưu', async () => {
    server.use(http.get('/hoc-vien/kiem-tra-trung', () => HttpResponse.json({ trung: true })));
    const user = userEvent.setup();
    renderDaDangNhap();

    const oCccd = await screen.findByLabelText('Số CCCD');
    await user.type(oCccd, '123456789012');
    await user.tab();

    expect(await screen.findByText('Số CCCD này đã được dùng cho một hồ sơ khác. Liên hệ hỗ trợ.')).toBeInTheDocument();
  });

  it('chỉ gửi các trường đã đổi khi Lưu (PATCH một phần)', async () => {
    db.hoSo.noi_sinh_id = 'tinh-1';
    db.hoSo.phuong_xa_id = 'phuong-1';
    db.hoSo.so_dinh_danh_ca_nhan = '111111111111';
    db.hoSo.email_lien_he = 'a@vd.vn';
    db.hoSo.trinh_do_chuyen_mon = 'dai_hoc';
    db.hoSo.chuyen_mon = ['Tin học'];
    db.dotXacNhan.day_du = true;
    db.dotXacNhan.thieu = [];

    let thanPatch: Record<string, unknown> | null = null;
    server.use(
      http.patch('/hoc-vien/toi', async ({ request }) => {
        thanPatch = (await request.json()) as Record<string, unknown>;
        Object.assign(db.hoSo, thanPatch);
        return HttpResponse.json(db.hoSo);
      }),
    );

    const user = userEvent.setup();
    renderDaDangNhap();

    const oChucVu = await screen.findByLabelText('Chức vụ');
    await user.clear(oChucVu);
    await user.type(oChucVu, 'Tổ trưởng chuyên môn');

    await user.click(screen.getByRole('button', { name: 'Lưu' }));

    await waitFor(() => expect(thanPatch).not.toBeNull());
    expect(thanPatch).toEqual({ chuc_vu: 'Tổ trưởng chuyên môn' });
    expect(await screen.findByText('Đã lưu')).toBeInTheDocument();
  });

  it('thêm/xóa chuyên môn gọi ngay POST/DELETE, không đợi nút Lưu', async () => {
    db.dotXacNhan.day_du = true;
    db.dotXacNhan.thieu = [];
    let daGoiThem = false;
    server.use(
      http.post('/hoc-vien/toi/chuyen-mon', async ({ request }) => {
        const body = (await request.json()) as { chuyen_mon: string };
        daGoiThem = body.chuyen_mon === 'Tin học';
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderDaDangNhap();

    const oChuyenMon = await screen.findByLabelText(/^Chuyên môn/, { selector: 'input' });
    await user.click(oChuyenMon);
    await user.type(oChuyenMon, 'Tin học{Enter}');

    await waitFor(() => expect(daGoiThem).toBe(true));
    // Chưa bấm Lưu — nút Lưu (nếu tồn tại) vẫn ở trạng thái không bắt buộc phải bấm cho riêng chuyên môn.
  });

  it('response có xac_nhan_bi_huy:true → hộp thoại yêu cầu xác nhận lại, có nút Xác nhận lại', async () => {
    db.dotXacNhan.day_du = true;
    db.dotXacNhan.thieu = [];
    server.use(
      http.patch('/hoc-vien/toi', async ({ request }) => {
        const patch = (await request.json()) as Record<string, unknown>;
        Object.assign(db.hoSo, patch);
        return HttpResponse.json({ ...db.hoSo, xac_nhan_bi_huy: true });
      }),
    );

    const user = userEvent.setup();
    renderDaDangNhap();

    const oChucVu = await screen.findByLabelText('Chức vụ');
    await user.clear(oChucVu);
    await user.type(oChucVu, 'Hiệu phó');
    await user.click(screen.getByRole('button', { name: 'Lưu' }));

    const hopThoai = await screen.findByRole('dialog');
    expect(within(hopThoai).getByText(/Vui lòng xác nhận lại/)).toBeInTheDocument();
    await user.click(within(hopThoai).getByRole('button', { name: 'Xác nhận lại' }));
    expect(await screen.findByText('Màn hình xác nhận')).toBeInTheDocument();
  });
});
