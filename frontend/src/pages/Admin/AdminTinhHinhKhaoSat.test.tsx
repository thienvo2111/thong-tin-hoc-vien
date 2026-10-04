import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { db } from '@/test/mocks/db';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import AdminTinhHinhKhaoSat from './AdminTinhHinhKhaoSat';

// Mock GET /sso/ket-qua(/thong-ke) ở test/mocks/sso.ts (hocVienTinhHinhMock: 1 người xong phiếu khảo sát,
// đã mở phiếu đánh giá quá lâu; 1 người chưa làm gì).
function renderTrang() {
  datToken('token-gia-lap');
  db.nguoiDung.vai_tro = 'quan_tri';
  return renderVoiRouter([{ path: '/admin/tinh-hinh-khao-sat', element: <AdminTinhHinhKhaoSat /> }], {
    initialEntries: ['/admin/tinh-hinh-khao-sat'],
  });
}

const theThongKe = (nhan: string) => screen.getByRole('button', { name: new RegExp(nhan) });

describe('Admin — Tình hình khảo sát', () => {
  it('thống kê theo loại bài đang chọn + danh sách kèm mức, điểm, nguồn', async () => {
    renderTrang();
    expect(await screen.findByText('Hà Thị Thanh')).toBeInTheDocument();
    await waitFor(() => expect(theThongKe('Đã hoàn thành')).toHaveTextContent('1'));
    expect(theThongKe('Chưa làm')).toHaveTextContent('1');
    expect(screen.getByText(/Thành thạo 1/)).toBeInTheDocument();

    const dong = screen.getByText('Hà Thị Thanh').closest('tr')!;
    expect(within(dong).getByText('Đã hoàn thành')).toBeInTheDocument();
    expect(within(dong).getByText('Thành thạo')).toBeInTheDocument();
    expect(within(dong).getByText('72.5')).toBeInTheDocument();
    expect(within(dong).getByText('Hệ thống khảo sát')).toBeInTheDocument();
    expect(within(screen.getByText('Lê Văn Bình').closest('tr')!).getByText('Chưa làm')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Hà Thị Thanh' })).toHaveAttribute('href', '/admin/hoc-vien/hv-1');
  });

  it('đổi sang phiếu đánh giá -> thấy "Cần kiểm tra lại"; bấm ô thống kê -> lọc theo trạng thái đó, bấm lại bỏ lọc', async () => {
    const user = userEvent.setup();
    renderTrang();
    await screen.findByText('Hà Thị Thanh');

    await user.click(screen.getByText('Phiếu đánh giá năng lực số'));
    await waitFor(() => expect(theThongKe('Cần kiểm tra lại')).toHaveTextContent('1'));

    await user.click(theThongKe('Cần kiểm tra lại'));
    expect(theThongKe('Cần kiểm tra lại')).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(screen.queryByText('Lê Văn Bình')).not.toBeInTheDocument());
    const dong = screen.getByText('Hà Thị Thanh').closest('tr')!;
    expect(within(dong).getByText('Cần kiểm tra lại')).toBeInTheDocument();
    expect(within(dong).getByText('2')).toBeInTheDocument();

    await user.click(theThongKe('Cần kiểm tra lại'));
    expect(await screen.findByText('Lê Văn Bình')).toBeInTheDocument();
  });

  it('lọc không ra ai -> thông báo trống', async () => {
    const user = userEvent.setup();
    renderTrang();
    await screen.findByText('Hà Thị Thanh');
    await user.click(theThongKe('Đang làm'));
    expect(await screen.findByText('Không có học viên nào khớp bộ lọc.')).toBeInTheDocument();
  });

  it('API lỗi -> hiện lỗi', async () => {
    server.use(
      http.get('/sso/ket-qua', () =>
        HttpResponse.json({ error: { code: 'FORBIDDEN', message: 'Không có quyền truy cập tài nguyên này' } }, { status: 403 }),
      ),
    );
    renderTrang();
    expect(await screen.findByText('Không có quyền truy cập tài nguyên này')).toBeInTheDocument();
  });
});
