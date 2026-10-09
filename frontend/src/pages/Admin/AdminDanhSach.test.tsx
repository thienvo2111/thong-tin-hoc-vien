import { describe, expect, it, vi } from 'vitest';
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

  it('nút Xuất Excel theo trường bị vô hiệu khi chưa chọn trường', async () => {
    renderTrang();
    await screen.findByText('Lê Văn Bình');
    const nut = screen.getByRole('button', { name: 'Xuất Excel theo trường' });
    expect(nut).toHaveAttribute('aria-disabled', 'true');
    expect(nut).toHaveAttribute('data-disabled');
  });

  it('chọn trường → bấm Xuất gọi /hoc-vien/xuat-excel?don_vi_cong_tac_id=<id> và tải file', async () => {
    let url: URL | null = null;
    server.use(
      http.get('/hoc-vien/xuat-excel', ({ request }) => {
        url = new URL(request.url);
        return new HttpResponse('x', { headers: { 'Content-Type': 'application/octet-stream' } });
      }),
    );
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const user = userEvent.setup();
    renderTrang();
    await screen.findByText('Lê Văn Bình');

    await user.type(screen.getByPlaceholderText('Tất cả đơn vị — gõ tên để tìm'), 'Long Xuyên');
    await user.click(await screen.findByRole('option', { name: 'THPT Long Xuyên — Phường Long Xuyên' }));
    const nut = screen.getByRole('button', { name: 'Xuất Excel theo trường' });
    await waitFor(() => expect(nut).toHaveAttribute('aria-disabled', 'false'));
    await user.click(nut);

    await waitFor(() => expect((url as URL | null)?.searchParams.get('don_vi_cong_tac_id')).toBe('dv-1'));
    await waitFor(() => expect(click).toHaveBeenCalled());
    click.mockRestore();
  });

  // Đơn vị xếp sau trang đầu (page_size=200) của danh mục ~5.000 trường vẫn tìm được, vì ô lọc giờ
  // tìm qua server (q) chứ không tải cả danh mục rồi lọc phía client — bug đã gặp "Châu Thị Tế".
  it('tìm được trường KHÔNG nằm trong 200 dòng đầu danh mục (tìm qua server, không bị cắt trang)', async () => {
    server.use(
      http.get('/danh-muc/don-vi-cong-tac', ({ request }) => {
        const q = new URL(request.url).searchParams.get('q')?.toLowerCase() ?? '';
        if (!q.includes('châu thị tế')) return HttpResponse.json({ data: [] });
        return HttpResponse.json({
          data: [
            {
              id: 'dv-xa-200',
              ma_don_vi: 'TR-AG-9999',
              ten_don_vi: 'Trường THPT Châu Thị Tế',
              loai_don_vi: 'truong',
              dia_ban_id: 'phuong-1',
              dia_ban_ten: 'Phường Long Xuyên',
              tinh_id: 'tinh-1',
              trang_thai: 'active',
            },
          ],
        });
      }),
    );
    const user = userEvent.setup();
    renderTrang();
    await screen.findByText('Lê Văn Bình');

    await user.type(screen.getByPlaceholderText('Tất cả đơn vị — gõ tên để tìm'), 'Châu Thị Tế');
    const tuyChon = await screen.findByRole('option', { name: 'Trường THPT Châu Thị Tế — Phường Long Xuyên' });
    await user.click(tuyChon);

    const nut = screen.getByRole('button', { name: 'Xuất Excel theo trường' });
    await waitFor(() => expect(nut).toHaveAttribute('aria-disabled', 'false'));
  });

  it('chọn đơn vị không phải trường (Sở) → nút vẫn vô hiệu', async () => {
    server.use(
      http.get('/danh-muc/don-vi-cong-tac', () =>
        HttpResponse.json({
          data: [
            {
              id: 'dv-so-1',
              ma_don_vi: 'SOGDDT-AG',
              ten_don_vi: 'Sở GD&ĐT An Giang',
              loai_don_vi: 'so_gddt',
              dia_ban_id: 'tinh-1',
              dia_ban_ten: 'An Giang',
              tinh_id: 'tinh-1',
              trang_thai: 'active',
            },
          ],
        }),
      ),
    );
    const user = userEvent.setup();
    renderTrang();
    await screen.findByText('Lê Văn Bình');
    await user.type(screen.getByPlaceholderText('Tất cả đơn vị — gõ tên để tìm'), 'Sở GD');
    await user.click(await screen.findByRole('option', { name: /^Sở GD&ĐT An Giang/ }));
    expect(screen.getByRole('button', { name: 'Xuất Excel theo trường' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('xuất lỗi → hiện thông báo lỗi', async () => {
    server.use(
      http.get('/hoc-vien/xuat-excel', () =>
        HttpResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Đơn vị công tác nằm ngoài phạm vi quyền' } },
          { status: 403 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderTrang();
    await screen.findByText('Lê Văn Bình');
    await user.type(screen.getByPlaceholderText('Tất cả đơn vị — gõ tên để tìm'), 'Long Xuyên');
    await user.click(await screen.findByRole('option', { name: 'THPT Long Xuyên — Phường Long Xuyên' }));
    await user.click(screen.getByRole('button', { name: 'Xuất Excel theo trường' }));
    expect(await screen.findByText('Đơn vị công tác nằm ngoài phạm vi quyền')).toBeInTheDocument();
  });
});
