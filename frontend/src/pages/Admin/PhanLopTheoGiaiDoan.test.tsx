import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { db, taoKhoaHocToiMau } from '@/test/mocks/db';
import { renderVoiRouter } from '@/test/testUtils';
import { PhanLopTheoGiaiDoan } from './PhanLopTheoGiaiDoan';

// Phân lớp theo giai đoạn (spec 2026-10-02 mục 5.3): dk-1 (taoKhoaHocToiMau) học lop-1 ở GĐ2,
// lop-2 ở GĐ3; khoa-1 (db.chiTietKhoa) có 4 giai đoạn gd-1..gd-4 + 3 lớp.
function render(yeuCau: { url: string; body: unknown }[], canhBao?: string) {
  server.use(
    http.put('/dang-ky-hoc/:id/giai-doan/:gdId/lop', async ({ request }) => {
      yeuCau.push({ url: new URL(request.url).pathname, body: await request.json() });
      return HttpResponse.json({ phan_lop: null, canh_bao: canhBao });
    }),
  );
  const dangKy = taoKhoaHocToiMau()[0];
  const khoa = db.chiTietKhoa['khoa-1'];
  return renderVoiRouter(
    [{ path: '/', element: <PhanLopTheoGiaiDoan hocVienId="hv-1" dangKy={dangKy} khoa={khoa} /> }],
    { initialEntries: ['/'] },
  );
}

describe('PhanLopTheoGiaiDoan', () => {
  it('1 dòng/giai đoạn, chọn sẵn lớp đang gán; đổi lớp + Lưu gọi PUT đúng URL/body', async () => {
    const yeuCau: { url: string; body: unknown }[] = [];
    const user = userEvent.setup();
    render(yeuCau);
    expect(await screen.findByRole('textbox', { name: /^GĐ1/ })).toHaveValue('-- Bỏ gán --');
    expect(screen.getByRole('textbox', { name: /^GĐ2/ })).toHaveValue('Lớp 01 – Nhóm cơ bản A (Trực tiếp)');
    expect(screen.getAllByRole('textbox', { name: /^GĐ\d/ })).toHaveLength(4);

    await user.click(screen.getByRole('textbox', { name: /^GĐ2/ }));
    await user.click(await screen.findByRole('option', { name: 'Lớp VLE 01 (VLE)' }));
    await user.click(screen.getAllByRole('button', { name: 'Lưu' })[1]);

    await screen.findAllByText('Đã lưu phân lớp');
    expect(yeuCau).toEqual([{ url: '/dang-ky-hoc/dk-1/giai-doan/gd-2/lop', body: { lop_id: 'lop-3' } }]);
  });

  it('chọn "-- Bỏ gán --" + Lưu gửi lop_id null', async () => {
    const yeuCau: { url: string; body: unknown }[] = [];
    const user = userEvent.setup();
    render(yeuCau);
    await user.click(await screen.findByRole('textbox', { name: /^GĐ2/ }));
    await user.click(await screen.findByRole('option', { name: '-- Bỏ gán --' }));
    await user.click(screen.getAllByRole('button', { name: 'Lưu' })[1]);

    await screen.findAllByText('Đã lưu phân lớp');
    expect(yeuCau[0].body).toEqual({ lop_id: null });
  });

  it('API trả canh_bao -> notification hiện nội dung cảnh báo', async () => {
    const user = userEvent.setup();
    render([], 'Lớp "Lớp 02" ở giai đoạn 2: lớp không có buổi nào trong giai đoạn này');
    await user.click((await screen.findAllByRole('button', { name: 'Lưu' }))[1]);
    expect(await screen.findByText(/lớp không có buổi nào trong giai đoạn này/)).toBeInTheDocument();
  });

  it('lỗi API -> notification lỗi', async () => {
    server.use(http.put('/dang-ky-hoc/:id/giai-doan/:gdId/lop', () => HttpResponse.error()));
    const user = userEvent.setup();
    const dangKy = taoKhoaHocToiMau()[0];
    renderVoiRouter(
      [{ path: '/', element: <PhanLopTheoGiaiDoan hocVienId="hv-1" dangKy={dangKy} khoa={db.chiTietKhoa['khoa-1']} /> }],
      { initialEntries: ['/'] },
    );
    await user.click((await screen.findAllByRole('button', { name: 'Lưu' }))[0]);
    expect(await screen.findByText('Không kết nối được máy chủ. Kiểm tra mạng và thử lại.')).toBeInTheDocument();
  });
});
