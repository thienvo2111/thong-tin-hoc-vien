import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { db } from '@/test/mocks/db';
import HoTroGvHoSoLop from './HoTroGvHoSoLop';
import HoTroGvDanhMuc from './HoTroGvDanhMuc';

// ADR 0004 L3 (issue #16): vận hành lớp — sửa buổi có lý do, hậu cần (409), thực địa, danh mục.
function render(initialEntries: string[]) {
  datToken('token-gia-lap');
  db.nguoiDung.vai_tro = 'ho_tro_giang_vien';
  return renderVoiRouter(
    [
      { path: '/ho-tro-gv/lop/:lopId/giai-doan/:gdId', element: <HoTroGvHoSoLop /> },
      { path: '/ho-tro-gv/danh-muc', element: <HoTroGvDanhMuc /> },
    ],
    { initialEntries },
  );
}

const HO_SO = '/ho-tro-gv/lop/lop-1/giai-doan/gd-2';

describe('Hồ sơ chuẩn bị lớp — vận hành (L3)', () => {
  it('sửa buổi: nút Lưu chỉ bật khi có lý do ≥ 5 ký tự; gửi PATCH kèm lý do', async () => {
    let body: Record<string, unknown> | undefined;
    server.events.on('request:start', async ({ request }) => {
      if (request.method === 'PATCH' && request.url.includes('/ho-tro-giang-vien/lich-hoc/')) body = await request.clone().json();
    });
    const user = userEvent.setup();
    render([HO_SO]);
    await user.click(await screen.findByRole('tab', { name: 'Lịch & điểm học' }));
    const panel = await screen.findByRole('tabpanel', { name: 'Lịch & điểm học' });
    await user.click(within(panel).getByRole('button', { name: 'Sửa' }));
    const modal = await screen.findByRole('dialog');
    const nutLuu = within(modal).getByRole('button', { name: 'Lưu thay đổi' });
    expect(nutLuu).toBeDisabled();
    const oPhong = within(modal).getByLabelText(/^Phòng/);
    await user.clear(oPhong);
    await user.type(oPhong, 'P.202');
    await user.type(within(modal).getByLabelText(/^Lý do thay đổi/), 'Trường đổi phòng');
    expect(nutLuu).toBeEnabled();
    await user.click(nutLuu);
    await waitFor(() => expect(body).toEqual(expect.objectContaining({ phong: 'P.202', ly_do: 'Trường đổi phòng' })));
    server.events.removeAllListeners();
  });

  it('hậu cần: lưu lần đầu tạo bản ghi; khi người khác đã sửa (409) → báo vàng, không ghi đè', async () => {
    const user = userEvent.setup();
    render([HO_SO]);
    await user.click(await screen.findByRole('tab', { name: 'Giảng viên' }));
    const the = await screen.findByTestId('hau-can-gv-1');
    await user.type(within(the).getByLabelText('Nơi ở'), 'KS Hoa Sen');
    await user.click(within(the).getByLabelText('Đã xác nhận chỗ ở'));
    await user.click(within(the).getByRole('button', { name: 'Lưu hậu cần' }));
    await waitFor(() => expect(db.trangLopGv.hau_can[0]).toEqual(expect.objectContaining({ noi_o_ten: 'KS Hoa Sen', da_xac_nhan_noi_o: true })));

    // Người khác sửa trước → cap_nhat_luc trên máy này đã cũ.
    server.use(
      http.put('/ho-tro-giang-vien/lop/:lopId/giai-doan/:gdId/hau-can/:gvId', () =>
        HttpResponse.json({ error: { code: 'CONFLICT', message: 'Người khác vừa sửa hậu cần này — tải lại để xem bản mới' } }, { status: 409 }),
      ),
    );
    await user.click(within(await screen.findByTestId('hau-can-gv-1')).getByRole('button', { name: 'Lưu hậu cần' }));
    expect(await screen.findByText(/Người khác vừa sửa hậu cần này/)).toBeInTheDocument();
  });

  it('thực địa: thêm người → PUT danh sách', async () => {
    const user = userEvent.setup();
    render([HO_SO]);
    await user.click(await screen.findByRole('tab', { name: 'Lịch & điểm học' }));
    const panel = await screen.findByRole('tabpanel', { name: 'Lịch & điểm học' });
    await user.click(within(panel).getByRole('button', { name: '+ Thêm người' }));
    await user.type(within(panel).getByLabelText('Họ tên thực địa'), 'Anh Tâm');
    await user.type(within(panel).getByLabelText('SĐT thực địa'), '0933333333');
    await user.type(within(panel).getByLabelText('Nhiệm vụ'), 'Mở phòng');
    await user.click(within(panel).getByRole('button', { name: 'Lưu thực địa' }));
    await waitFor(() =>
      expect(db.trangLopGv.thuc_dia).toEqual([expect.objectContaining({ ho_ten: 'Anh Tâm', so_dien_thoai: '0933333333', nhiem_vu: 'Mở phòng' })]),
    );
  });
});

describe('Danh mục của người hỗ trợ GV', () => {
  it('điểm học + giảng viên: tạo/sửa được, KHÔNG có nút Ngưng', async () => {
    const user = userEvent.setup();
    render(['/ho-tro-gv/danh-muc']);
    expect(await screen.findByText('THPT Long Xuyên')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Thêm điểm học' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ngưng' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Giảng viên' }));
    expect(await screen.findByText('Nguyễn Văn Long')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lịch dạy' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ngưng' })).not.toBeInTheDocument();
  });
});
