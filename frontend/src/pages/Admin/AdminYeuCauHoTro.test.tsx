import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { db } from '@/test/mocks/db';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import type { YeuCauHoTroQuanTri } from '@/api/types';
import AdminYeuCauHoTroPage from './AdminYeuCauHoTro';

// Handler admin (GET /yeu-cau-ho-tro, PATCH /yeu-cau-ho-tro/:id/tra-loi) chưa có trong
// test/mocks/handlers.ts (Task 9 mới chỉ thêm phía hoc_vien) — khai báo tại chỗ bằng server.use()
// để không phải sửa file mock dùng chung cho các trang khác.
function dangKyMockQuanTri(ve: YeuCauHoTroQuanTri) {
  server.use(
    http.get('/yeu-cau-ho-tro', ({ request }) => {
      const trangThai = new URL(request.url).searchParams.get('trang_thai');
      const data = trangThai && ve.trang_thai !== trangThai ? [] : [ve];
      return HttpResponse.json({ data, total: data.length, page: 1, page_size: 50 });
    }),
    http.patch('/yeu-cau-ho-tro/:id/tra-loi', async ({ request }) => {
      const body = (await request.json()) as { noi_dung_tra_loi: string };
      ve.trang_thai = 'da_phan_hoi';
      ve.noi_dung_tra_loi = body.noi_dung_tra_loi;
      ve.thoi_gian_phan_hoi = new Date().toISOString();
      return HttpResponse.json(ve);
    }),
  );
}

function renderTrang() {
  datToken('token-gia-lap');
  db.nguoiDung.vai_tro = 'quan_tri';
  return renderVoiRouter([{ path: '/admin/yeu-cau-ho-tro', element: <AdminYeuCauHoTroPage /> }], {
    initialEntries: ['/admin/yeu-cau-ho-tro'],
  });
}

describe('AdminYeuCauHoTro (M8)', () => {
  it('trả lời ticket -> ticket biến mất khỏi danh sách chờ xử lý', async () => {
    dangKyMockQuanTri({
      id: 'yc-1',
      hoc_vien_id: 'hv-1',
      loai_van_de_id: 'lvd-1',
      loai_van_de_ten: 'Đăng nhập',
      noi_dung_hoi: 'Tôi không đăng nhập được',
      noi_dung_tra_loi: null,
      trang_thai: 'cho_xu_ly',
      danh_gia: null,
      da_dong_hieu_luc: false,
      thoi_gian_tao: new Date().toISOString(),
      thoi_gian_phan_hoi: null,
      thoi_gian_dong: null,
      hoi_lai: false,
    });

    renderTrang();
    const user = userEvent.setup();

    await screen.findByText('Tôi không đăng nhập được');
    await user.click(screen.getByRole('button', { name: /trả lời/i }));
    await user.type(screen.getByLabelText(/nội dung trả lời/i), 'Thầy/Cô thử đặt lại mật khẩu.');
    await user.click(screen.getByRole('button', { name: /gửi trả lời/i }));

    await waitFor(() => {
      expect(screen.queryByText('Tôi không đăng nhập được')).not.toBeInTheDocument();
    });
  });
});
