import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { db } from '@/test/mocks/db';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { RequireQuanTri } from '@/auth/RequireQuanTri';
import AdminNguoiHoTro from './AdminNguoiHoTro';
import { AdminSidebar } from './AdminSidebar';

function renderTrang() {
  datToken('token-gia-lap');
  return renderVoiRouter(
    [
      {
        element: <RequireQuanTri />,
        children: [{ path: '/admin/nguoi-ho-tro', element: <AdminNguoiHoTro /> }],
      },
      { path: '/admin/tong-quan', element: <div>Màn hình tổng quan</div> },
      { path: '/admin/khoa-boi-duong/:id', element: <div>Màn hình chi tiết khóa</div> },
    ],
    { initialEntries: ['/admin/nguoi-ho-tro'] },
  );
}

describe('Admin — Người hỗ trợ học viên (ADR 0003)', () => {
  it('vai trò khác quan_tri vào /admin/nguoi-ho-tro -> về Tổng quan; sidebar chỉ hiện mục với quan_tri', async () => {
    db.nguoiDung.vai_tro = 'so_gddt';
    const { unmount } = renderTrang();
    expect(await screen.findByText('Màn hình tổng quan')).toBeInTheDocument();
    unmount();

    const sb = renderVoiRouter([{ path: '/', element: <AdminSidebar /> }]);
    expect(await screen.findByText('Tổng quan')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Người hỗ trợ')).not.toBeInTheDocument());
    sb.unmount();
    db.nguoiDung.vai_tro = 'quan_tri';
    renderVoiRouter([{ path: '/', element: <AdminSidebar /> }]);
    expect(await screen.findByText('Người hỗ trợ')).toBeInTheDocument();
  });

  it('bảng hiện cụm phụ trách (link tới khóa) và "Chưa phân công" cho người chưa có cụm', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    renderTrang();
    const bang = await screen.findByRole('table');
    for (const cot of ['Họ tên', 'Tên đăng nhập', 'Email', 'Cụm phụ trách', 'Lần đăng nhập cuối', 'Trạng thái']) {
      expect(within(bang).getByRole('columnheader', { name: cot })).toBeInTheDocument();
    }
    const link = await within(bang).findByRole('link', { name: /Cụm Long Xuyên · KBD-AG-01/ });
    expect(link).toHaveAttribute('href', '/admin/khoa-boi-duong/khoa-1');
    const dongB = within(bang).getByText('Trần Thị B').closest('tr')!;
    expect(within(dongB).getByText('Chưa phân công')).toBeInTheDocument();
  });

  it('tạo mặc định gửi email kích hoạt: gửi đúng body, báo đã gửi, không hiện mật khẩu', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post('/nguoi-dung/ho-tro', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { tai_khoan: { ...db.taiKhoanHoTro[1], id: 'ht-moi', email: 'le.c@hcmue.edu.vn' } },
          { status: 201 },
        );
      }),
    );
    renderTrang();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '+ Tạo tài khoản' }));
    const modal = await screen.findByRole('dialog');
    const nutTao = within(modal).getByRole('button', { name: 'Tạo tài khoản' });
    expect(nutTao).toBeDisabled();
    await user.type(within(modal).getByRole('textbox', { name: /Họ tên/ }), 'Lê Văn C');
    await user.type(within(modal).getByRole('textbox', { name: /Email/ }), 'le.c@hcmue.edu.vn');
    expect(within(modal).getByRole('textbox', { name: /Tên đăng nhập/ })).toHaveAttribute('placeholder', 'le.c');
    await user.click(nutTao);
    expect(await screen.findByText('Đã gửi email kích hoạt tới le.c@hcmue.edu.vn')).toBeInTheDocument();
    expect(body).toEqual({ ho_ten: 'Lê Văn C', email: 'le.c@hcmue.edu.vn', cach_cap: 'email' });
    expect(screen.queryByText('Mật khẩu tạm')).not.toBeInTheDocument();
  });

  it('tạo bằng mật khẩu tạm -> hiện mật khẩu đúng 1 lần', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    renderTrang();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '+ Tạo tài khoản' }));
    const modal = await screen.findByRole('dialog');
    await user.type(within(modal).getByRole('textbox', { name: /Họ tên/ }), 'Phạm D');
    await user.type(within(modal).getByRole('textbox', { name: /Email/ }), 'pham.d@hcmue.edu.vn');
    await user.click(within(modal).getByRole('radio', { name: 'Sinh mật khẩu tạm' }));
    await user.click(within(modal).getByRole('button', { name: 'Tạo tài khoản' }));
    const modalMk = await screen.findByRole('dialog', { name: 'Mật khẩu tạm' });
    expect(within(modalMk).getByText('Ht3dEf7hJk')).toBeInTheDocument();
    expect(within(modalMk).getByText('pham.d')).toBeInTheDocument();
  });

  it('email trùng -> lỗi hiện ngay dưới ô Email', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    renderTrang();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '+ Tạo tài khoản' }));
    const modal = await screen.findByRole('dialog');
    await user.type(within(modal).getByRole('textbox', { name: /Họ tên/ }), 'Trùng');
    await user.type(within(modal).getByRole('textbox', { name: /Email/ }), 'tran.b@hcmue.edu.vn');
    await user.click(within(modal).getByRole('button', { name: 'Tạo tài khoản' }));
    expect(await within(modal).findByText('Email đã được dùng')).toBeInTheDocument();
  });

  it('khóa tài khoản qua menu thao tác -> gửi trang_thai=ngung', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    let body: unknown = null;
    server.use(
      http.patch('/nguoi-dung/ho-tro/:id', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...db.taiKhoanHoTro[0], trang_thai: 'ngung' });
      }),
    );
    renderTrang();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Thao tác nguyen.a' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Khóa' }));
    const xacNhan = await screen.findByRole('dialog');
    await user.click(within(xacNhan).getByRole('button', { name: 'Khóa' }));
    await waitFor(() => expect(body).toEqual({ trang_thai: 'ngung' }));
  });
});
