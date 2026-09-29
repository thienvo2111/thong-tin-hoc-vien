import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { db } from '@/test/mocks/db';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import AdminKhoaChiTiet from './AdminKhoaChiTiet';

function renderTrang(id: string) {
  datToken('token-gia-lap');
  return renderVoiRouter([{ path: '/admin/khoa-boi-duong/:id', element: <AdminKhoaChiTiet /> }], {
    initialEntries: [`/admin/khoa-boi-duong/${id}`],
  });
}

describe('Admin — Chi tiết khóa bồi dưỡng', () => {
  it('trạng thái tải: hiện skeleton trong lúc chờ API', () => {
    renderTrang('khoa-1');
    expect(document.querySelectorAll('.mantine-Skeleton-root').length).toBeGreaterThan(0);
  });

  it('lỗi API (không tìm thấy khóa): hiện thông báo lỗi', async () => {
    renderTrang('khoa-khong-ton-tai');
    expect(await screen.findByText('Không tìm thấy khóa bồi dưỡng')).toBeInTheDocument();
  });

  it('có dữ liệu: hiện tên khóa, badge trạng thái, danh sách lớp học', async () => {
    renderTrang('khoa-1');
    expect(await screen.findByText('Bồi dưỡng NLS – Mức cơ bản')).toBeInTheDocument();
    expect(screen.getByText('Chờ duyệt')).toBeInTheDocument();
    expect(screen.getByText('Lớp 01 – Nhóm cơ bản A')).toBeInTheDocument();
    expect(screen.getByText('Nguyễn Văn Long')).toBeInTheDocument();
  });

  it('khóa chưa có lớp học → hiện thông báo trống thay vì bảng rỗng im lặng', async () => {
    renderTrang('khoa-2');
    await screen.findByText('Bồi dưỡng NLS – Mức thành thạo');
    expect(screen.getByText('Khóa chưa có lớp học nào.')).toBeInTheDocument();
  });

  it('trang_thai=nhap + vai_tro=truong → hiện nút Nộp duyệt, không hiện nút Duyệt', async () => {
    db.nguoiDung.vai_tro = 'truong';
    renderTrang('khoa-2');
    await screen.findByText('Bồi dưỡng NLS – Mức thành thạo');
    expect(screen.getByRole('button', { name: 'Nộp duyệt' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '✓ Duyệt khóa' })).not.toBeInTheDocument();
  });

  it('trang_thai=cho_duyet + vai_tro=so_gddt → hiện nút Duyệt/Từ chối, click Duyệt gọi API duyệt', async () => {
    db.nguoiDung.vai_tro = 'so_gddt';
    const user = userEvent.setup();
    renderTrang('khoa-1');
    await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');

    expect(screen.getByRole('button', { name: '✓ Duyệt khóa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Từ chối' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '✓ Duyệt khóa' }));
    expect(await screen.findByText('Đã duyệt')).toBeInTheDocument();
  });

  it('trang_thai=cho_duyet + vai_tro=truong → không hiện nút Duyệt (không đúng vai trò được duyệt)', async () => {
    db.nguoiDung.vai_tro = 'truong';
    renderTrang('khoa-1');
    await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');
    expect(screen.queryByRole('button', { name: '✓ Duyệt khóa' })).not.toBeInTheDocument();
  });

  it('lỗi khi nộp duyệt: hiện thông báo lỗi qua notification', async () => {
    server.use(http.post('/khoa-boi-duong/:id/nop-duyet', () => HttpResponse.error()));
    db.nguoiDung.vai_tro = 'truong';
    const user = userEvent.setup();
    renderTrang('khoa-2');
    await screen.findByText('Bồi dưỡng NLS – Mức thành thạo');

    await user.click(screen.getByRole('button', { name: 'Nộp duyệt' }));
    expect(await screen.findByText('Không kết nối được máy chủ. Kiểm tra mạng và thử lại.')).toBeInTheDocument();
  });
});
