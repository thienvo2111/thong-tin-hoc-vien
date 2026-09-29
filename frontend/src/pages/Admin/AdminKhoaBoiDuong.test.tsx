import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { db } from '@/test/mocks/db';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import AdminKhoaBoiDuong from './AdminKhoaBoiDuong';

function renderTrang(initialEntries = ['/admin/khoa-boi-duong']) {
  datToken('token-gia-lap');
  return renderVoiRouter(
    [
      { path: '/admin/khoa-boi-duong', element: <AdminKhoaBoiDuong /> },
      { path: '/admin/khoa-boi-duong/:id', element: <div>Màn hình chi tiết khóa</div> },
    ],
    { initialEntries },
  );
}

describe('Admin — Danh sách khóa bồi dưỡng', () => {
  it('trạng thái tải: hiện skeleton trong lúc chờ API', () => {
    renderTrang();
    expect(document.querySelectorAll('.mantine-Skeleton-root').length).toBeGreaterThan(0);
  });

  it('lỗi API: hiện thông báo lỗi thay vì màn trắng', async () => {
    server.use(http.get('/khoa-boi-duong', () => HttpResponse.error()));
    renderTrang();
    expect(await screen.findByText('Không kết nối được máy chủ. Kiểm tra mạng và thử lại.')).toBeInTheDocument();
  });

  it('có dữ liệu: hiện đủ các khóa, badge trạng thái, tổng số kết quả', async () => {
    renderTrang();
    expect(await screen.findByText('Bồi dưỡng NLS – Mức cơ bản')).toBeInTheDocument();
    expect(screen.getByText('Bồi dưỡng NLS – Mức thành thạo')).toBeInTheDocument();
    expect(screen.getByText('2 khóa bồi dưỡng')).toBeInTheDocument();
    const bang = screen.getByRole('table');
    expect(within(bang).getByText('Chờ duyệt')).toBeInTheDocument();
    expect(within(bang).getByText('Nháp')).toBeInTheDocument();
  });

  it('không có kết quả khớp bộ lọc → hiện thông báo trống, không phải bảng rỗng im lặng', async () => {
    server.use(http.get('/khoa-boi-duong', () => HttpResponse.json({ data: [], total: 0, page: 1, page_size: 20 })));
    renderTrang();
    expect(await screen.findByText('Không có khóa bồi dưỡng nào khớp bộ lọc.')).toBeInTheDocument();
  });

  it('click 1 dòng → điều hướng sang /admin/khoa-boi-duong/{id}', async () => {
    const user = userEvent.setup();
    renderTrang();
    const dong = await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');
    await user.click(dong);
    expect(await screen.findByText('Màn hình chi tiết khóa')).toBeInTheDocument();
  });

  it('tạo khóa mới (Trường): điền form hợp lệ → gọi API, điều hướng sang trang chi tiết khóa vừa tạo', async () => {
    db.nguoiDung.vai_tro = 'truong';
    const user = userEvent.setup();
    renderTrang();
    await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');

    await user.click(screen.getByRole('button', { name: '+ Tạo khóa mới' }));
    // Mantine TextInput required render nhãn dạng "Mã khóa *" (dấu * nằm trong <span> con của <label>,
    // vẫn tính vào textContent dùng để so khớp accessible name dù aria-hidden) — khớp bằng regex tiền tố.
    await user.type(await screen.findByLabelText(/^Mã khóa/), 'AG-2026-020');
    await user.type(screen.getByLabelText(/^Tên khóa/), 'Bồi dưỡng kỹ năng số nâng cao');

    const oNgayBatDau = screen.getByLabelText(/^Ngày bắt đầu/);
    const oNgayKetThuc = screen.getByLabelText(/^Ngày kết thúc/);
    await user.type(oNgayBatDau, '2026-11-01');
    await user.type(oNgayKetThuc, '2026-12-01');

    await user.click(screen.getByRole('button', { name: 'Tạo khóa' }));

    expect(await screen.findByText('Màn hình chi tiết khóa')).toBeInTheDocument();
  });

  it('tạo khóa (Quản trị): thiếu đơn vị tổ chức → nút Tạo khóa bị vô hiệu hóa', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    const user = userEvent.setup();
    renderTrang();
    await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');

    await user.click(screen.getByRole('button', { name: '+ Tạo khóa mới' }));
    await user.type(await screen.findByLabelText(/^Mã khóa/), 'AG-2026-021');
    await user.type(screen.getByLabelText(/^Tên khóa/), 'Khóa test quản trị');
    await user.type(screen.getByLabelText(/^Ngày bắt đầu/), '2026-11-01');
    await user.type(screen.getByLabelText(/^Ngày kết thúc/), '2026-12-01');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Tạo khóa' })).toBeDisabled();
    });
  });
});
