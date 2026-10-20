import { describe, expect, it } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { loi } from '@/test/mocks/handlers';
import { db } from '@/test/mocks/db';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { dinhDangNgayGio } from '@/lib/ngay';
import type { DotNhuCauMuc } from '@/api/types';
import { KhoiDotNhuCauMuc } from './KhoiDotNhuCauMuc';

function dot(p: Partial<DotNhuCauMuc>): DotNhuCauMuc {
  return {
    id: 'd1',
    khoa_id: 'k1',
    ten_dot: 'Đợt 1',
    mo_luc: '2027-01-01T01:00:00.000Z',
    dong_luc: '2027-01-05T01:00:00.000Z',
    trang_thai: 'chua_mo',
    so_ban_ghi: 0,
    ...p,
  };
}

function renderKhoi() {
  datToken('token-gia-lap');
  return renderVoiRouter([{ path: '/', element: <KhoiDotNhuCauMuc khoaId="k1" /> }], { initialEntries: ['/'] });
}

describe('KhoiDotNhuCauMuc', () => {
  it('bảng hiện tên đợt, mở/đóng, badge trạng thái và số bản ghi', async () => {
    db.danhSachDotNhuCauMuc = [
      dot({ id: 'a', ten_dot: 'Đợt đang mở', trang_thai: 'dang_mo', so_ban_ghi: 7 }),
      dot({ id: 'b', ten_dot: 'Đợt đã đóng', trang_thai: 'da_dong', so_ban_ghi: 3 }),
    ];
    renderKhoi();
    const bang = await screen.findByRole('table');
    expect(within(bang).getByText('Đợt đang mở')).toBeInTheDocument();
    expect(within(bang).getByText('Đang mở')).toBeInTheDocument();
    expect(within(bang).getByText('Đã đóng')).toBeInTheDocument();
    expect(within(bang).getAllByText(dinhDangNgayGio('2027-01-01T01:00:00.000Z'))).toHaveLength(2);
    expect(within(bang).getByText('7')).toBeInTheDocument();
  });

  it('form tạo đợt gửi đúng body ISO', async () => {
    let body: unknown;
    server.use(
      http.post('/khoa-boi-duong/k1/dot-nhu-cau-muc', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(dot({ ten_dot: 'Đợt mới' }), { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderKhoi();
    await user.click(await screen.findByRole('button', { name: '+ Tạo đợt' }));
    await user.type(await screen.findByLabelText(/^Tên đợt/), 'Đợt mới');
    await user.type(screen.getByLabelText(/^Mở lúc/), '2027-02-01T08:00');
    await user.type(screen.getByLabelText(/^Đóng lúc/), '2027-02-02T08:00');
    await user.click(screen.getByRole('button', { name: 'Tạo đợt' }));
    await waitFor(() => expect(body).toBeTruthy());
    expect(body).toEqual({
      ten_dot: 'Đợt mới',
      mo_luc: new Date('2027-02-01T08:00').toISOString(),
      dong_luc: new Date('2027-02-02T08:00').toISOString(),
    });
  }, 15000);

  it('409 chồng giờ → lỗi hiện ở ô Mở lúc', async () => {
    server.use(
      http.post('/khoa-boi-duong/k1/dot-nhu-cau-muc', () =>
        loi(409, 'CONFLICT', 'Chồng giờ', { fields: [{ field: 'mo_luc', message: 'Trùng với đợt "Đợt X"' }] }),
      ),
    );
    const user = userEvent.setup();
    renderKhoi();
    await user.click(await screen.findByRole('button', { name: '+ Tạo đợt' }));
    await user.type(await screen.findByLabelText(/^Tên đợt/), 'Đợt Y');
    await user.type(screen.getByLabelText(/^Mở lúc/), '2027-02-01T08:00');
    await user.type(screen.getByLabelText(/^Đóng lúc/), '2027-02-02T08:00');
    await user.click(screen.getByRole('button', { name: 'Tạo đợt' }));
    expect(await screen.findByText('Trùng với đợt "Đợt X"')).toBeInTheDocument();
  }, 15000);

  it('"Đóng ngay" chỉ có ở đợt đang mở, mở modal xác nhận trước khi gọi', async () => {
    db.danhSachDotNhuCauMuc = [
      dot({ id: 'a', ten_dot: 'Đợt đang mở', trang_thai: 'dang_mo' }),
      dot({ id: 'b', ten_dot: 'Đợt chưa mở', trang_thai: 'chua_mo' }),
    ];
    let daGoi = false;
    server.use(
      http.post('/dot-nhu-cau-muc/a/dong', () => {
        daGoi = true;
        return HttpResponse.json(dot({ id: 'a', trang_thai: 'da_dong' }), { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderKhoi();
    await screen.findByText('Đợt đang mở');
    expect(screen.getAllByRole('button', { name: /^Đóng ngay/ })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: /^Đóng ngay/ }));
    expect(daGoi).toBe(false);
    const modal = await screen.findByRole('dialog');
    await user.click(within(modal).getByRole('button', { name: 'Xác nhận đóng' }));
    await waitFor(() => expect(daGoi).toBe(true));
  });

  it('"Xóa" bị vô hiệu hóa khi so_ban_ghi > 0, kèm nhãn "Đã có dữ liệu"', async () => {
    db.danhSachDotNhuCauMuc = [
      dot({ id: 'a', ten_dot: 'Có dữ liệu', so_ban_ghi: 2 }),
      dot({ id: 'b', ten_dot: 'Trống', so_ban_ghi: 0 }),
    ];
    renderKhoi();
    await screen.findByText('Có dữ liệu');
    expect(screen.getByRole('button', { name: 'Xóa đợt Có dữ liệu' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Xóa đợt Trống' })).toBeEnabled();
    expect(screen.getByText('Đã có dữ liệu')).toBeInTheDocument();
  });
});
