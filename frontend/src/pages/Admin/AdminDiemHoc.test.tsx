import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { db } from '@/test/mocks/db';
import { renderTrang } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import AdminDiemHoc from './AdminDiemHoc';

function render() {
  datToken('token-gia-lap');
  return renderTrang(<AdminDiemHoc />);
}

// T10 (issue #2): danh mục điểm học trực tiếp.
describe('Admin — Điểm học', () => {
  it('mặc định chỉ hiện điểm học đang dùng (tên, mã, địa chỉ, số phòng, liên hệ)', async () => {
    render();
    expect(await screen.findByText('THPT Long Xuyên')).toBeInTheDocument();
    const bang = screen.getByRole('table');
    expect(within(bang).getByText('AG-LX-01')).toBeInTheDocument();
    expect(within(bang).getByText('1 Trần Hưng Đạo')).toBeInTheDocument();
    expect(within(bang).getByText('Cô Lan')).toBeInTheDocument();
    expect(screen.queryByText('THCS Châu Đốc')).not.toBeInTheDocument();
  });

  it('chuyển sang "Đã ngưng" → thấy điểm học đã ngưng, có nút Mở lại', async () => {
    const user = userEvent.setup();
    render();
    await screen.findByText('THPT Long Xuyên');
    await user.click(screen.getByRole('radio', { name: 'Đã ngưng' }));
    expect(await screen.findByText('THCS Châu Đốc')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mở lại' })).toBeInTheDocument();
  });

  it('thêm điểm học: nút Thêm chỉ bật khi đủ mã, tên, địa chỉ, phường/xã; gửi đúng POST', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post('/diem-hoc', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 'dh-moi', ...body, trang_thai: 'active' }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    render();
    await screen.findByText('THPT Long Xuyên');
    await user.click(screen.getByRole('button', { name: '+ Thêm điểm học' }));

    const nutLuu = await screen.findByRole('button', { name: 'Thêm điểm học' });
    expect(nutLuu).toBeDisabled();

    await user.type(screen.getByLabelText(/Mã điểm học/), 'AG-TS-01');
    await user.type(screen.getByLabelText(/Tên điểm học/), 'THPT Tân Châu');
    await user.type(screen.getByLabelText(/^Địa chỉ/), '9 Lê Lợi');
    await user.click(screen.getByLabelText(/Tỉnh\/thành/, { selector: 'input' }));
    await user.click(await screen.findByRole('option', { name: 'An Giang' }));
    await user.click(screen.getByLabelText(/Phường\/xã/, { selector: 'input' }));
    await user.click(await screen.findByRole('option', { name: 'Phường Long Xuyên' }));
    await user.type(screen.getByLabelText(/Số phòng học/), '3');

    expect(nutLuu).toBeEnabled();
    await user.click(nutLuu);
    await waitFor(() =>
      expect(body).toEqual(
        expect.objectContaining({
          ma_diem_hoc: 'AG-TS-01',
          ten: 'THPT Tân Châu',
          dia_chi: '9 Lê Lợi',
          dia_ban_id: 'phuong-1',
          so_phong: 3,
        }),
      ),
    );
    // POST không gửi null cho trường tùy chọn đang trống.
    expect(body).not.toHaveProperty('nguoi_lien_he');
  });

  it('trùng mã → hiện lỗi ngay ở ô Mã điểm học', async () => {
    const user = userEvent.setup();
    render();
    await screen.findByText('THPT Long Xuyên');
    await user.click(screen.getByRole('button', { name: '+ Thêm điểm học' }));
    await user.type(await screen.findByLabelText(/Mã điểm học/), 'AG-LX-01');
    await user.type(screen.getByLabelText(/Tên điểm học/), 'Trùng');
    await user.type(screen.getByLabelText(/^Địa chỉ/), 'x');
    await user.click(screen.getByLabelText(/Tỉnh\/thành/, { selector: 'input' }));
    await user.click(await screen.findByRole('option', { name: 'An Giang' }));
    await user.click(screen.getByLabelText(/Phường\/xã/, { selector: 'input' }));
    await user.click(await screen.findByRole('option', { name: 'Phường Long Xuyên' }));
    await user.click(screen.getByRole('button', { name: 'Thêm điểm học' }));
    expect(await screen.findByText('Đã tồn tại')).toBeInTheDocument();
  });

  it('sửa: điền sẵn dữ liệu (kể cả tỉnh suy từ phường/xã), lưu bằng PATCH', async () => {
    const user = userEvent.setup();
    render();
    await screen.findByText('THPT Long Xuyên');
    await user.click(screen.getByRole('button', { name: 'Sửa' }));
    const oTen = await screen.findByLabelText(/Tên điểm học/);
    expect(oTen).toHaveValue('THPT Long Xuyên');
    await waitFor(() =>
      expect(screen.getByLabelText(/Tỉnh\/thành/, { selector: 'input' })).toHaveValue('An Giang'),
    );
    await user.clear(oTen);
    await user.type(oTen, 'THPT Long Xuyên (cơ sở 2)');
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(db.diemHoc[0].ten).toBe('THPT Long Xuyên (cơ sở 2)'));
  });

  it('Ngưng → PATCH trang_thai=ngung (không xóa)', async () => {
    const user = userEvent.setup();
    render();
    await screen.findByText('THPT Long Xuyên');
    await user.click(screen.getByRole('button', { name: 'Ngưng' }));
    await waitFor(() => expect(db.diemHoc[0].trang_thai).toBe('ngung'));
  });

  it('409 không kèm fields (vd trùng mã do race) → thông báo đúng message server, không phải câu trùng CCCD', async () => {
    server.use(
      http.patch('/diem-hoc/:id', () =>
        HttpResponse.json(
          { error: { code: 'CONFLICT', message: 'Mã điểm học "AG-LX-01" đã tồn tại' } },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    render();
    await screen.findByText('THPT Long Xuyên');
    await user.click(screen.getByRole('button', { name: 'Ngưng' }));
    expect(await screen.findByText('Mã điểm học "AG-LX-01" đã tồn tại')).toBeInTheDocument();
    expect(screen.queryByText(/Số CCCD này đã được dùng/)).not.toBeInTheDocument();
  });
});
