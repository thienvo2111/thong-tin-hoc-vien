import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { db } from '@/test/mocks/db';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { RequireQuanTri } from '@/auth/RequireQuanTri';
import AdminNguoiDung from './AdminNguoiDung';
import { AdminSidebar } from './AdminSidebar';

function renderTrang() {
  datToken('token-gia-lap');
  return renderVoiRouter(
    [
      {
        element: <RequireQuanTri />,
        children: [{ path: '/admin/nguoi-dung', element: <AdminNguoiDung /> }],
      },
      { path: '/admin/tong-quan', element: <div>Màn hình tổng quan</div> },
      { path: '/admin/nhap-du-lieu', element: <div>Màn hình nhập dữ liệu</div> },
    ],
    { initialEntries: ['/admin/nguoi-dung'] },
  );
}

describe('Admin — Người dùng (tài khoản đơn vị)', () => {
  it('vai_tro=so_gddt vào /admin/nguoi-dung -> về Tổng quan', async () => {
    db.nguoiDung.vai_tro = 'so_gddt';
    renderTrang();
    expect(await screen.findByText('Màn hình tổng quan')).toBeInTheDocument();
  });

  it('sidebar: "Người dùng" chỉ hiện với quan_tri', async () => {
    datToken('token-gia-lap');
    db.nguoiDung.vai_tro = 'so_gddt';
    const { unmount } = renderVoiRouter([{ path: '/', element: <AdminSidebar /> }]);
    expect(await screen.findByText('Tổng quan')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Người dùng')).not.toBeInTheDocument());
    unmount();
    db.nguoiDung.vai_tro = 'quan_tri';
    renderVoiRouter([{ path: '/', element: <AdminSidebar /> }]);
    expect(await screen.findByText('Người dùng')).toBeInTheDocument();
  });

  it('bảng hiện đủ cột, tài khoản chưa đăng nhập hiện "Chưa đăng nhập"', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    renderTrang();
    expect(await screen.findByText('Tài khoản đơn vị')).toBeInTheDocument();
    const bang = await screen.findByRole('table');
    for (const cot of ['Đơn vị', 'Loại', 'Tên đăng nhập', 'Người phụ trách', 'Email', 'Lần đăng nhập cuối', 'Trạng thái']) {
      expect(within(bang).getByRole('columnheader', { name: cot })).toBeInTheDocument();
    }
    expect(await within(bang).findByText('sgd-angiang')).toBeInTheDocument();
    expect(within(bang).getAllByText('Chưa đăng nhập').length).toBeGreaterThan(0);
  });

  it('đổi bộ lọc gửi đúng query', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    const queries: string[] = [];
    server.use(
      http.get('/nguoi-dung/don-vi', ({ request }) => {
        queries.push(new URL(request.url).search);
        return HttpResponse.json({ data: [], total: 0, page: 1, page_size: 20 });
      }),
    );
    renderTrang();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('textbox', { name: 'Loại đơn vị' }));
    await user.click(await screen.findByRole('option', { name: 'Trường' }));
    await waitFor(() => expect(queries.some((q) => q.includes('vai_tro=truong'))).toBe(true));
  });

  it('tạo tài khoản: Select chỉ đơn vị chưa cấp, điền sẵn tên đăng nhập, radio email bị khóa khi chưa nhập email', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    renderTrang();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '+ Tạo tài khoản' }));
    const modal = await screen.findByRole('dialog');
    await user.click(within(modal).getByRole('textbox', { name: /^Đơn vị/ }));
    expect(await screen.findByRole('option', { name: /Trường THPT Long Xuyên/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Sở GD&ĐT An Giang/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: /Trường THPT Long Xuyên/ }));
    expect(within(modal).getByRole('textbox', { name: /^Tên đăng nhập/ })).toHaveValue('tr-ag-032');
    expect(within(modal).getByRole('radio', { name: 'Gửi email kích hoạt' })).toBeDisabled();
    await user.type(within(modal).getByRole('textbox', { name: /^Email/ }), 'ht@thpt.vn');
    expect(within(modal).getByRole('radio', { name: 'Gửi email kích hoạt' })).toBeEnabled();
  });

  it('tạo tài khoản: lỗi 409 ten_dang_nhap hiện dưới ô', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    server.use(
      http.post('/nguoi-dung/don-vi', () =>
        HttpResponse.json(
          { error: { code: 'CONFLICT', message: 'Tên đăng nhập đã được dùng', fields: [{ field: 'ten_dang_nhap', message: 'Tên đăng nhập đã được dùng' }] } },
          { status: 409 },
        ),
      ),
    );
    renderTrang();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '+ Tạo tài khoản' }));
    const modal = await screen.findByRole('dialog');
    await user.click(within(modal).getByRole('textbox', { name: /^Đơn vị/ }));
    await user.click(await screen.findByRole('option', { name: /Trường THPT Long Xuyên/ }));
    await user.click(within(modal).getByRole('button', { name: 'Tạo tài khoản' }));
    expect(await within(modal).findByText('Tên đăng nhập đã được dùng')).toBeInTheDocument();
  });

  it('tạo bằng mật khẩu tạm: hiện mật khẩu 1 lần, sao chép cả hai, đóng thì không còn trong DOM', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    renderTrang();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '+ Tạo tài khoản' }));
    const modal = await screen.findByRole('dialog');
    await user.click(within(modal).getByRole('textbox', { name: /^Đơn vị/ }));
    await user.click(await screen.findByRole('option', { name: /Trường THPT Long Xuyên/ }));
    await user.click(within(modal).getByRole('button', { name: 'Tạo tài khoản' }));
    expect(await screen.findByText('Mật khẩu chỉ hiện một lần. Đóng cửa sổ này sẽ không xem lại được.')).toBeInTheDocument();
    expect(screen.getByText('Ab3dEf7hJk')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sao chép cả hai' }));
    expect(await navigator.clipboard.readText()).toBe('Tài khoản: tr-ag-032 / Mật khẩu: Ab3dEf7hJk');
    await user.click(screen.getByRole('button', { name: 'Đã lưu, đóng' }));
    await waitFor(() => expect(screen.queryByText('Ab3dEf7hJk')).not.toBeInTheDocument());
  });

  it('menu thao tác: email kích hoạt chỉ khi có email; cấp mật khẩu tạm hỏi xác nhận trước', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    let daGoiCapMatKhau = false;
    server.use(
      http.post('/nguoi-dung/don-vi/:id/cap-mat-khau-tam', () => {
        daGoiCapMatKhau = true;
        return HttpResponse.json({ ten_dang_nhap: 'tr-ag-001', mat_khau_tam: 'Zx8cVb2nMq' });
      }),
    );
    renderTrang();
    const user = userEvent.setup();
    const bang = await screen.findByRole('table');
    const dongKhongEmail = (await within(bang).findByText('tr-ag-001')).closest('tr')!;
    await user.click(within(dongKhongEmail).getByRole('button', { name: 'Thao tác' }));
    const capMk = await screen.findByRole('menuitem', { name: 'Cấp mật khẩu tạm' });
    expect(screen.queryByRole('menuitem', { name: 'Gửi email kích hoạt' })).not.toBeInTheDocument();
    await user.click(capMk);
    expect(daGoiCapMatKhau).toBe(false);
    await user.click(await screen.findByRole('button', { name: 'Cấp mật khẩu' }));
    expect(await screen.findByText('Zx8cVb2nMq')).toBeInTheDocument();
    expect(daGoiCapMatKhau).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Đã lưu, đóng' }));
    const dongCoEmail = within(bang).getByText('sgd-angiang').closest('tr')!;
    await user.click(within(dongCoEmail).getByRole('button', { name: 'Thao tác' }));
    expect(await screen.findByRole('menuitem', { name: 'Gửi email kích hoạt' })).toBeInTheDocument();
  });

  it('sửa tên đăng nhập hiện cảnh báo', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    renderTrang();
    const user = userEvent.setup();
    const bang = await screen.findByRole('table');
    const dong = (await within(bang).findByText('sgd-angiang')).closest('tr')!;
    await user.click(within(dong).getByRole('button', { name: 'Thao tác' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sửa' }));
    const modal = await screen.findByRole('dialog');
    const o = within(modal).getByRole('textbox', { name: /^Tên đăng nhập/ });
    await user.clear(o);
    await user.type(o, 'sgd-ag');
    expect(within(modal).getByText('Người dùng sẽ phải đăng nhập bằng tên mới')).toBeInTheDocument();
  });

  it('nút "Nhập từ Excel" chuyển sang trang nhập dữ liệu', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    renderTrang();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Nhập từ Excel' }));
    expect(await screen.findByText('Màn hình nhập dữ liệu')).toBeInTheDocument();
  });
});
