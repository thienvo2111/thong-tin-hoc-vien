import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import AdminTongQuan from './AdminTongQuan';

function renderTrang() {
  datToken('token-gia-lap');
  return renderVoiRouter(
    [
      { path: '/admin/tong-quan', element: <AdminTongQuan /> },
      { path: '/admin/hoc-vien', element: <div>Màn hình danh sách học viên</div> },
    ],
    { initialEntries: ['/admin/tong-quan'] },
  );
}

describe('Admin — Tổng quan', () => {
  it('trạng thái tải: hiện skeleton trong lúc chờ API', () => {
    renderTrang();
    expect(screen.getByText('Tổng học viên')).toBeInTheDocument();
    expect(document.querySelectorAll('.mantine-Skeleton-root').length).toBeGreaterThan(0);
  });

  it('lỗi API: hiện thông báo lỗi thay vì màn trắng', async () => {
    server.use(http.get('/hoc-vien', () => HttpResponse.error()));
    renderTrang();
    expect((await screen.findAllByText('Không tải được')).length).toBe(2); // Tổng học viên + Hồ sơ chờ duyệt
    expect(await screen.findByText('Không kết nối được máy chủ. Kiểm tra mạng và thử lại.')).toBeInTheDocument();
  });

  it('có dữ liệu: hiện đúng 3 KPI thật + bảng hồ sơ chờ duyệt gần nhất', async () => {
    renderTrang();

    expect(await screen.findByText('3')).toBeInTheDocument(); // tổng học viên (fixture: 3 hồ sơ)
    expect(await screen.findByText('Lê Văn Bình')).toBeInTheDocument();
    expect(screen.getByText('Phạm Thu Hà')).toBeInTheDocument();
    // Hồ sơ đã duyệt không xuất hiện trong bảng "chờ duyệt gần nhất"
    expect(screen.queryByText('Võ Minh Khôi')).not.toBeInTheDocument();
    expect(screen.getAllByText('Chờ duyệt').length).toBeGreaterThan(0);
  });

  it('link "Xem tất cả" trỏ đúng sang /admin/hoc-vien?trang_thai=cho_duyet', async () => {
    renderTrang();
    const link = await screen.findByRole('link', { name: 'Xem tất cả →' });
    expect(link).toHaveAttribute('href', '/admin/hoc-vien?trang_thai=cho_duyet');
  });

  it('không có hồ sơ chờ duyệt → hiện thông báo trống, không phải bảng rỗng', async () => {
    server.use(http.get('/hoc-vien', () => HttpResponse.json({ data: [], total: 0, page: 1, page_size: 20 })));
    renderTrang();
    expect(await screen.findByText('Không có hồ sơ nào đang chờ duyệt.')).toBeInTheDocument();
  });
});
