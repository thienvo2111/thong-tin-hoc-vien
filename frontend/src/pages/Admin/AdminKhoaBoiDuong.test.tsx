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

  it('có dữ liệu: hiện đủ các khóa, badge trạng thái, tổng số kết quả, cột "Đơn vị đặt hàng"', async () => {
    renderTrang();
    expect(await screen.findByText('Bồi dưỡng NLS – Mức cơ bản')).toBeInTheDocument();
    expect(screen.getByText('Bồi dưỡng NLS – Mức thành thạo')).toBeInTheDocument();
    expect(screen.getByText('2 khóa bồi dưỡng')).toBeInTheDocument();
    const bang = screen.getByRole('table');
    expect(within(bang).getByText('Chờ duyệt')).toBeInTheDocument();
    expect(within(bang).getByText('Nháp')).toBeInTheDocument();
    expect(within(bang).getByRole('columnheader', { name: 'Đơn vị đặt hàng' })).toBeInTheDocument();
    expect(within(bang).getByText('Sở GD&ĐT An Giang')).toBeInTheDocument();
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

  it('bộ lọc trạng thái chỉ còn "Tất cả trạng thái", "Đang mở", "Đóng đăng ký" (bỏ nhap/cho_duyet/tu_choi)', async () => {
    const user = userEvent.setup();
    renderTrang();
    await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');

    await user.click(screen.getByDisplayValue('Tất cả trạng thái'));
    expect(await screen.findByRole('option', { name: 'Đang mở' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Đóng đăng ký' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Nháp' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Chờ duyệt' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Từ chối' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Đã duyệt' })).not.toBeInTheDocument();
  });

  it('vai_tro=so_gddt: không thấy nút "+ Tạo khóa mới"', async () => {
    db.nguoiDung.vai_tro = 'so_gddt';
    renderTrang();
    await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');
    expect(screen.queryByRole('button', { name: '+ Tạo khóa mới' })).not.toBeInTheDocument();
  });

  it('vai_tro=truong: không thấy nút "+ Tạo khóa mới"', async () => {
    db.nguoiDung.vai_tro = 'truong';
    renderTrang();
    await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');
    expect(screen.queryByRole('button', { name: '+ Tạo khóa mới' })).not.toBeInTheDocument();
  });

  it('vai_tro=quan_tri: thấy nút "+ Tạo khóa mới"; mở modal không còn chữ "Đơn vị tổ chức"', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    const user = userEvent.setup();
    renderTrang();
    await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');

    await user.click(screen.getByRole('button', { name: '+ Tạo khóa mới' }));
    // getByRole('textbox', ...) thay vì getByLabelText: dropdown (role=listbox) của Select cũng mang
    // aria-labelledby trỏ tới đúng label này — getByLabelText khớp cả 2, gây lỗi "multiple elements"
    // (cùng quy ước đã ghi trong AdminKhoaChiTiet.test.tsx).
    expect(await screen.findByRole('textbox', { name: /^Đơn vị đặt hàng/ })).toBeInTheDocument();
    expect(screen.queryByText('Đơn vị tổ chức')).not.toBeInTheDocument();
    expect(screen.queryByText('Bắt buộc khi tạo khóa với tài khoản Quản trị hệ thống')).not.toBeInTheDocument();
  });

  it('tạo khóa (Quản trị): thiếu đơn vị đặt hàng → nút Tạo khóa bị vô hiệu hóa', async () => {
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

  it('tạo khóa (Quản trị): điền đủ form + chọn đơn vị đặt hàng → gọi API, điều hướng sang trang chi tiết', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    const user = userEvent.setup();
    renderTrang();
    await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');

    await user.click(screen.getByRole('button', { name: '+ Tạo khóa mới' }));
    await user.type(await screen.findByLabelText(/^Mã khóa/), 'AG-2026-020');
    await user.type(screen.getByLabelText(/^Tên khóa/), 'Bồi dưỡng kỹ năng số nâng cao');
    await user.type(screen.getByLabelText(/^Ngày bắt đầu/), '2026-11-01');
    await user.type(screen.getByLabelText(/^Ngày kết thúc/), '2026-12-01');

    await user.click(screen.getByRole('textbox', { name: /^Đơn vị đặt hàng/ }));
    await user.click(await screen.findByRole('option', { name: 'Sở GD&ĐT An Giang' }));
    await user.click(screen.getByRole('button', { name: 'Tạo khóa' }));

    expect(await screen.findByText('Màn hình chi tiết khóa')).toBeInTheDocument();
  });

  it('tạo khóa (Quản trị): API trả 400 "Sai loại đơn vị" → hiện lỗi dưới Select', async () => {
    server.use(
      http.post('/khoa-boi-duong', () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'don_vi_dat_hang_id không được là Phòng VHXH',
              fields: [{ field: 'don_vi_dat_hang_id', message: 'Sai loại đơn vị' }],
            },
          },
          { status: 400 },
        ),
      ),
    );
    db.nguoiDung.vai_tro = 'quan_tri';
    const user = userEvent.setup();
    renderTrang();
    await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');

    await user.click(screen.getByRole('button', { name: '+ Tạo khóa mới' }));
    await user.type(await screen.findByLabelText(/^Mã khóa/), 'AG-2026-022');
    await user.type(screen.getByLabelText(/^Tên khóa/), 'Khóa test lỗi đơn vị');
    await user.type(screen.getByLabelText(/^Ngày bắt đầu/), '2026-11-01');
    await user.type(screen.getByLabelText(/^Ngày kết thúc/), '2026-12-01');
    await user.click(screen.getByRole('textbox', { name: /^Đơn vị đặt hàng/ }));
    await user.click(await screen.findByRole('option', { name: 'Sở GD&ĐT An Giang' }));
    await user.click(screen.getByRole('button', { name: 'Tạo khóa' }));

    expect(await screen.findByText('Sai loại đơn vị')).toBeInTheDocument();
  });

  // Fix: "Trường" không còn nằm trong Select nhóm tĩnh (danh mục trường quá lớn để tải trọn) — chọn
  // qua ô tìm kiếm riêng, tìm được bất kỳ trường nào (không bị cắt ở page_size=200).
  it('tạo khóa (Quản trị): chọn đơn vị đặt hàng là TRƯỜNG qua ô tìm kiếm → gọi API, điều hướng sang trang chi tiết', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    const user = userEvent.setup();
    renderTrang();
    await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');

    await user.click(screen.getByRole('button', { name: '+ Tạo khóa mới' }));
    await user.type(await screen.findByLabelText(/^Mã khóa/), 'AG-2026-023');
    await user.type(screen.getByLabelText(/^Tên khóa/), 'Khóa chọn trường đặt hàng');
    await user.type(screen.getByLabelText(/^Ngày bắt đầu/), '2026-11-01');
    await user.type(screen.getByLabelText(/^Ngày kết thúc/), '2026-12-01');

    await user.type(screen.getByRole('textbox', { name: /^Hoặc chọn trường/ }), 'Long Xuyên');
    await user.click(await screen.findByRole('option', { name: 'THPT Long Xuyên — Phường Long Xuyên' }));
    await user.click(screen.getByRole('button', { name: 'Tạo khóa' }));

    expect(await screen.findByText('Màn hình chi tiết khóa')).toBeInTheDocument();
  });

  it('lọc danh sách theo đơn vị đặt hàng là TRƯỜNG (ngoài danh mục so_gddt/khac tĩnh) → gửi đúng don_vi_dat_hang_id', async () => {
    let donViIdNhan: string | null = null;
    server.use(
      http.get('/khoa-boi-duong', ({ request }) => {
        donViIdNhan = new URL(request.url).searchParams.get('don_vi_dat_hang_id');
        return HttpResponse.json({ data: db.danhSachKhoa, total: db.danhSachKhoa.length, page: 1, page_size: 20 });
      }),
    );
    const user = userEvent.setup();
    renderTrang();
    await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');

    await user.type(screen.getByPlaceholderText('Tất cả đơn vị đặt hàng — gõ tên để tìm'), 'Long Xuyên');
    await user.click(await screen.findByRole('option', { name: 'THPT Long Xuyên — Phường Long Xuyên' }));

    await waitFor(() => expect(donViIdNhan).toBe('dv-1'));
  });
});
