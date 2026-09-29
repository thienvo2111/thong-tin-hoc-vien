import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import AdminDanhSach from './AdminDanhSach';

function renderTrang(initialEntries = ['/admin/hoc-vien']) {
  datToken('token-gia-lap');
  return renderVoiRouter(
    [
      { path: '/admin/hoc-vien', element: <AdminDanhSach /> },
      { path: '/admin/hoc-vien/:id', element: <div>Màn hình chi tiết học viên</div> },
    ],
    { initialEntries },
  );
}

describe('Admin — Danh sách học viên', () => {
  it('trạng thái tải: hiện skeleton trong lúc chờ API', () => {
    renderTrang();
    expect(document.querySelectorAll('.mantine-Skeleton-root').length).toBeGreaterThan(0);
  });

  it('lỗi API: hiện thông báo lỗi thay vì màn trắng', async () => {
    server.use(http.get('/hoc-vien', () => HttpResponse.error()));
    renderTrang();
    expect(await screen.findByText('Không kết nối được máy chủ. Kiểm tra mạng và thử lại.')).toBeInTheDocument();
  });

  it('có dữ liệu: hiện đủ 3 dòng, badge trạng thái, tổng số kết quả', async () => {
    renderTrang();
    expect(await screen.findByText('Lê Văn Bình')).toBeInTheDocument();
    expect(screen.getByText('Phạm Thu Hà')).toBeInTheDocument();
    expect(screen.getByText('Võ Minh Khôi')).toBeInTheDocument();
    expect(screen.getByText('3 học viên')).toBeInTheDocument();
    const bang = screen.getByRole('table');
    expect(within(bang).getAllByText('Chờ duyệt').length).toBe(2);
    expect(within(bang).getByText('Đã duyệt')).toBeInTheDocument();
  });

  it('đọc trang_thai=cho_duyet từ URL (đến từ link "Xem tất cả" của Tổng quan)', async () => {
    renderTrang(['/admin/hoc-vien?trang_thai=cho_duyet']);
    expect(await screen.findByText('Lê Văn Bình')).toBeInTheDocument();
    expect(screen.queryByText('Võ Minh Khôi')).not.toBeInTheDocument();
  });

  it('gõ ô tìm kiếm → lọc theo tên (query q gửi đúng lên API)', async () => {
    const user = userEvent.setup();
    renderTrang();
    await screen.findByText('Lê Văn Bình');

    await user.type(screen.getByPlaceholderText('Tìm theo tên, CCCD, mã MOET...'), 'Khôi');

    await waitFor(() => {
      expect(screen.queryByText('Lê Văn Bình')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Võ Minh Khôi')).toBeInTheDocument();
  });

  it('không có kết quả khớp bộ lọc → hiện thông báo trống, không phải bảng rỗng im lặng', async () => {
    server.use(http.get('/hoc-vien', () => HttpResponse.json({ data: [], total: 0, page: 1, page_size: 20 })));
    renderTrang();
    expect(await screen.findByText('Không có học viên nào khớp bộ lọc.')).toBeInTheDocument();
  });

  it('click 1 dòng → điều hướng sang /admin/hoc-vien/{id}', async () => {
    const user = userEvent.setup();
    renderTrang();
    const dong = await screen.findByText('Lê Văn Bình');
    await user.click(dong);
    expect(await screen.findByText('Màn hình chi tiết học viên')).toBeInTheDocument();
  });
});
