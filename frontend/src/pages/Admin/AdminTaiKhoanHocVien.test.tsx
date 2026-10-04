import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { db } from '@/test/mocks/db';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { RequireQuanTri } from '@/auth/RequireQuanTri';
import AdminTaiKhoanHocVien from './AdminTaiKhoanHocVien';
import { AdminSidebar } from './AdminSidebar';

function renderTrang() {
  datToken('token-gia-lap');
  return renderVoiRouter(
    [
      {
        element: <RequireQuanTri />,
        children: [{ path: '/admin/tai-khoan-hoc-vien', element: <AdminTaiKhoanHocVien /> }],
      },
      { path: '/admin/tong-quan', element: <div>Màn hình tổng quan</div> },
      { path: '/admin/hoc-vien/:id', element: <div>Màn hình hồ sơ học viên</div> },
    ],
    { initialEntries: ['/admin/tai-khoan-hoc-vien'] },
  );
}

async function dongCua(ten: string) {
  const bang = await screen.findByRole('table');
  return (await within(bang).findByText(ten)).closest('tr')!;
}

async function moMenu(user: ReturnType<typeof userEvent.setup>, ten: string) {
  await user.click(await screen.findByRole('button', { name: `Thao tác cho ${ten}` }));
}

describe('Admin — Tài khoản học viên', () => {
  it('vai_tro khác quan_tri bị chuyển về Tổng quan', async () => {
    db.nguoiDung.vai_tro = 'so_gddt';
    renderTrang();
    expect(await screen.findByText('Màn hình tổng quan')).toBeInTheDocument();
  });

  it('sidebar: "Tài khoản học viên" chỉ hiện với quan_tri', async () => {
    datToken('token-gia-lap');
    db.nguoiDung.vai_tro = 'so_gddt';
    const { unmount } = renderVoiRouter([{ path: '/', element: <AdminSidebar /> }]);
    expect(await screen.findByText('Tổng quan')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Tài khoản học viên')).not.toBeInTheDocument());
    unmount();
    db.nguoiDung.vai_tro = 'quan_tri';
    renderVoiRouter([{ path: '/', element: <AdminSidebar /> }]);
    expect(await screen.findByRole('link', { name: /Tài khoản học viên/ })).toHaveAttribute('href', '/admin/tai-khoan-hoc-vien');
  });

  it('bảng hiện đủ cột và badge tình trạng: tạm khóa, đã khóa, chưa đổi MK, sai MK, chưa đăng nhập', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    renderTrang();
    expect(await screen.findByText('Tài khoản học viên')).toBeInTheDocument();
    const bang = await screen.findByRole('table');
    for (const cot of ['Học viên', 'Tên đăng nhập', 'Đơn vị công tác', 'Đăng nhập lần cuối', 'Trạng thái']) {
      expect(within(bang).getByRole('columnheader', { name: cot })).toBeInTheDocument();
    }
    const an = await dongCua('Nguyễn Văn An');
    expect(within(an).getByText(/^Tạm khóa đến \d{2}:\d{2}$/)).toBeInTheDocument();
    expect(within(an).getByText('Sai MK 5 lần')).toBeInTheDocument();
    expect(within(an).getByText('Hoạt động')).toBeInTheDocument();
    expect(within(an).getByText('02/10/2026 10:00')).toBeInTheDocument();

    const binh = await dongCua('Trần Thị Bình');
    expect(within(binh).getByText('Đã khóa')).toBeInTheDocument();
    expect(within(binh).queryByText(/Tạm khóa đến/)).not.toBeInTheDocument();

    const cuong = await dongCua('Lê Văn Cường');
    expect(within(cuong).getByText('Chưa đổi MK')).toBeInTheDocument();
    expect(within(cuong).getByText('Chưa đăng nhập')).toBeInTheDocument();
    // CCCD (dòng phụ cột Học viên) + tên đăng nhập trùng CCCD.
    expect(within(cuong).getAllByText('089185000003')).toHaveLength(2);
    expect(within(cuong).queryByText(/Sai MK/)).not.toBeInTheDocument();
  });

  it('tìm kiếm và bộ lọc gửi đúng query', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    const queries: string[] = [];
    server.use(
      http.get('/nguoi-dung/hoc-vien', ({ request }) => {
        queries.push(new URL(request.url).search);
        return HttpResponse.json({ data: [], total: 0, page: 1, page_size: 20 });
      }),
    );
    renderTrang();
    const user = userEvent.setup();
    await waitFor(() => expect(queries[0]).toBe('?page=1&page_size=20'));
    await user.type(screen.getByRole('textbox', { name: 'Tìm kiếm' }), 'Nguyễn');
    await waitFor(() => expect(queries.some((q) => new URLSearchParams(q).get('q') === 'Nguyễn')).toBe(true));

    await user.click(screen.getByRole('textbox', { name: 'Trạng thái' }));
    await user.click(await screen.findByRole('option', { name: 'Đã khóa' }));
    await waitFor(() => expect(queries.some((q) => q.includes('trang_thai=ngung'))).toBe(true));

    await user.click(screen.getByRole('textbox', { name: 'Tình trạng' }));
    await user.click(await screen.findByRole('option', { name: 'Đang tạm khóa' }));
    await waitFor(() => expect(queries.some((q) => q.includes('tinh_trang=tam_khoa') && q.includes('trang_thai=ngung'))).toBe(true));

    await user.click(screen.getByRole('textbox', { name: 'Tình trạng' }));
    await user.click(await screen.findByRole('option', { name: 'Chưa đổi mật khẩu mặc định' }));
    await waitFor(() => expect(queries.some((q) => q.includes('tinh_trang=phai_doi_mat_khau'))).toBe(true));

    await user.click(screen.getByRole('textbox', { name: 'Tình trạng' }));
    await user.click(await screen.findByRole('option', { name: 'Chưa đăng nhập lần nào' }));
    await waitFor(() => expect(queries.some((q) => q.includes('tinh_trang=chua_dang_nhap'))).toBe(true));
  });

  it('cấp lại mật khẩu: modal hiện thông tin xác minh, chỉ gọi API khi xác nhận, thông báo kèm lưu ý', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    let idDaGoi: string | null = null;
    server.use(
      http.post('/nguoi-dung/:id/dat-lai-mat-khau', ({ params }) => {
        idDaGoi = params.id as string;
        return HttpResponse.json({ nguoi_dung: { id: params.id, ten_dang_nhap: 'x' }, luu_y: 'Mật khẩu đã về ngày sinh ddmmyyyy.' });
      }),
    );
    renderTrang();
    const user = userEvent.setup();
    await moMenu(user, 'Nguyễn Văn An');
    await user.click(await screen.findByRole('menuitem', { name: 'Cấp lại mật khẩu' }));
    const modal = await screen.findByRole('dialog');
    expect(within(modal).getByText(/ngày sinh dạng ddmmyyyy/)).toBeInTheDocument();
    expect(within(modal).getByText('Xác minh danh tính trước khi cấp lại')).toBeInTheDocument();
    expect(within(modal).getByText('05/03/1985')).toBeInTheDocument();
    expect(within(modal).getByText('Trường THPT Thoại Ngọc Hầu')).toBeInTheDocument();
    expect(within(modal).getByText('0912345678')).toBeInTheDocument();
    expect(idDaGoi).toBeNull();

    await user.click(within(modal).getByRole('button', { name: 'Cấp lại mật khẩu' }));
    expect(await screen.findByText('Mật khẩu đã về ngày sinh ddmmyyyy.')).toBeInTheDocument();
    expect(screen.getByText('Đã cấp lại mật khẩu cho Nguyễn Văn An')).toBeInTheDocument();
    expect(idDaGoi).toBe('nd-hv-1');
  });

  it('cấp lại mật khẩu: hủy thì không gọi API', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    let daGoi = false;
    server.use(
      http.post('/nguoi-dung/:id/dat-lai-mat-khau', () => {
        daGoi = true;
        return HttpResponse.json({});
      }),
    );
    renderTrang();
    const user = userEvent.setup();
    await moMenu(user, 'Lê Văn Cường');
    await user.click(await screen.findByRole('menuitem', { name: 'Cấp lại mật khẩu' }));
    const modal = await screen.findByRole('dialog');
    await user.click(within(modal).getByRole('button', { name: 'Hủy' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(daGoi).toBe(false);
  });

  it('cấp lại mật khẩu: lỗi API hiện thông báo lỗi', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    server.use(
      http.post('/nguoi-dung/:id/dat-lai-mat-khau', () =>
        HttpResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Hồ sơ chưa có ngày sinh' } }, { status: 400 }),
      ),
    );
    renderTrang();
    const user = userEvent.setup();
    await moMenu(user, 'Lê Văn Cường');
    await user.click(await screen.findByRole('menuitem', { name: 'Cấp lại mật khẩu' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cấp lại mật khẩu' }));
    expect(await screen.findByText('Hồ sơ chưa có ngày sinh')).toBeInTheDocument();
  });

  it('gỡ tạm khóa chỉ hiện khi đang tạm khóa và gọi đúng endpoint', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    let idDaGoi: string | null = null;
    server.use(
      http.post('/nguoi-dung/hoc-vien/:id/mo-khoa-tam', ({ params }) => {
        idDaGoi = params.id as string;
        const tk = db.taiKhoanHocVien.find((t) => t.id === params.id)!;
        Object.assign(tk, { khoa_den: null, so_lan_dang_nhap_sai: 0 });
        return HttpResponse.json(tk);
      }),
    );
    renderTrang();
    const user = userEvent.setup();
    await moMenu(user, 'Lê Văn Cường');
    expect(await screen.findByRole('menuitem', { name: 'Cấp lại mật khẩu' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Gỡ tạm khóa' })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');

    await moMenu(user, 'Nguyễn Văn An');
    await user.click(await screen.findByRole('menuitem', { name: 'Gỡ tạm khóa' }));
    expect(await screen.findByText('Đã gỡ tạm khóa cho Nguyễn Văn An')).toBeInTheDocument();
    expect(idDaGoi).toBe('nd-hv-1');
    const an = await dongCua('Nguyễn Văn An');
    await waitFor(() => expect(within(an).queryByText(/Tạm khóa đến/)).not.toBeInTheDocument());
  });

  it('khóa tài khoản hỏi xác nhận rồi PATCH trang_thai=ngung', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    const bodies: unknown[] = [];
    server.use(
      http.patch('/nguoi-dung/hoc-vien/:id', async ({ params, request }) => {
        const body = (await request.json()) as { trang_thai: 'active' | 'ngung' };
        bodies.push({ id: params.id, ...body });
        const tk = db.taiKhoanHocVien.find((t) => t.id === params.id)!;
        tk.trang_thai = body.trang_thai;
        return HttpResponse.json(tk);
      }),
    );
    renderTrang();
    const user = userEvent.setup();
    await moMenu(user, 'Lê Văn Cường');
    expect(screen.queryByRole('menuitem', { name: 'Mở khóa tài khoản' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('menuitem', { name: 'Khóa tài khoản' }));
    const modal = await screen.findByRole('dialog');
    expect(within(modal).getByText(/bị chặn đăng nhập ngay/)).toBeInTheDocument();
    expect(bodies).toHaveLength(0);
    await user.click(within(modal).getByRole('button', { name: 'Khóa' }));
    expect(await screen.findByText('Đã khóa tài khoản')).toBeInTheDocument();
    expect(bodies).toEqual([{ id: 'nd-hv-3', trang_thai: 'ngung' }]);
    const cuong = await dongCua('Lê Văn Cường');
    await waitFor(() => expect(within(cuong).getByText('Đã khóa')).toBeInTheDocument());
  });

  it('mở khóa tài khoản đã khóa hỏi xác nhận rồi PATCH trang_thai=active', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    const bodies: unknown[] = [];
    server.use(
      http.patch('/nguoi-dung/hoc-vien/:id', async ({ params, request }) => {
        const body = (await request.json()) as { trang_thai: 'active' | 'ngung' };
        bodies.push({ id: params.id, ...body });
        const tk = db.taiKhoanHocVien.find((t) => t.id === params.id)!;
        tk.trang_thai = body.trang_thai;
        return HttpResponse.json(tk);
      }),
    );
    renderTrang();
    const user = userEvent.setup();
    await moMenu(user, 'Trần Thị Bình');
    expect(screen.queryByRole('menuitem', { name: 'Khóa tài khoản' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('menuitem', { name: 'Mở khóa tài khoản' }));
    const modal = await screen.findByRole('dialog');
    await user.click(within(modal).getByRole('button', { name: 'Mở khóa' }));
    expect(await screen.findByText('Đã mở khóa tài khoản')).toBeInTheDocument();
    expect(bodies).toEqual([{ id: 'nd-hv-2', trang_thai: 'active' }]);
  });

  it('nhật ký: drawer mặc định lọc nhóm Tài khoản, chuyển "Tất cả" hiện mọi mục', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    let hocVienDaGoi: string | null = null;
    server.use(
      http.get('/hoc-vien/:id/nhat-ky', ({ params }) => {
        hocVienDaGoi = params.id as string;
        return HttpResponse.json(db.nhatKyHocVien);
      }),
    );
    renderTrang();
    const user = userEvent.setup();
    await moMenu(user, 'Nguyễn Văn An');
    await user.click(await screen.findByRole('menuitem', { name: 'Xem nhật ký' }));
    const drawer = await screen.findByRole('dialog', { name: /Nhật ký — Nguyễn Văn An/ });
    expect(await within(drawer).findByText('Đăng nhập thất bại')).toBeInTheDocument();
    expect(hocVienDaGoi).toBe('hv-1');
    expect(within(drawer).getByText('Được đặt lại mật khẩu')).toBeInTheDocument();
    expect(within(drawer).getByText('113.161.1.1 · Mozilla/5.0 Zalo')).toBeInTheDocument();
    expect(within(drawer).getByText(/Quản trị viên/)).toBeInTheDocument();
    expect(within(drawer).queryByText('Sửa hồ sơ')).not.toBeInTheDocument();

    await user.click(within(drawer).getByRole('radio', { name: 'Tất cả' }));
    expect(await within(drawer).findByText('Sửa hồ sơ')).toBeInTheDocument();
    expect(within(drawer).getByText('so_dien_thoai_lien_he: 0911 → 0912')).toBeInTheDocument();
  });

  it('nhật ký trống hiện thông báo trống', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    db.nhatKyHocVien = { hoc_vien: { id: 'hv-1', ho_ten: 'Nguyễn Văn An' }, muc: [] };
    renderTrang();
    const user = userEvent.setup();
    await moMenu(user, 'Nguyễn Văn An');
    await user.click(await screen.findByRole('menuitem', { name: 'Xem nhật ký' }));
    const drawer = await screen.findByRole('dialog');
    expect(await within(drawer).findByText('Chưa có hoạt động nào được ghi nhận.')).toBeInTheDocument();
  });

  it('"Xem hồ sơ" dẫn tới trang chi tiết học viên', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    renderTrang();
    const user = userEvent.setup();
    await moMenu(user, 'Nguyễn Văn An');
    await user.click(await screen.findByRole('menuitem', { name: 'Xem hồ sơ' }));
    expect(await screen.findByText('Màn hình hồ sơ học viên')).toBeInTheDocument();
  });

  it('tài khoản chưa gắn hồ sơ: các thao tác cần hồ sơ bị vô hiệu', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    db.taiKhoanHocVien = [{ ...db.taiKhoanHocVien[2], id: 'nd-mo-coi', ten_dang_nhap: 'mo-coi', hoc_vien: null }];
    renderTrang();
    const user = userEvent.setup();
    expect(await screen.findByText('Chưa gắn hồ sơ')).toBeInTheDocument();
    await moMenu(user, 'mo-coi');
    expect(await screen.findByRole('menuitem', { name: 'Cấp lại mật khẩu' })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: 'Xem nhật ký' })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: 'Xem hồ sơ' })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: 'Khóa tài khoản' })).toBeEnabled();
  });

  it('không có kết quả hiện trạng thái trống', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    db.taiKhoanHocVien = [];
    renderTrang();
    expect(await screen.findByText('Không có tài khoản học viên nào khớp bộ lọc.')).toBeInTheDocument();
  });

  it('lỗi API hiện thông báo lỗi', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    server.use(
      http.get('/nguoi-dung/hoc-vien', () =>
        HttpResponse.json({ error: { code: 'INTERNAL', message: 'Máy chủ đang bận' } }, { status: 500 }),
      ),
    );
    renderTrang();
    expect(await screen.findByText('Máy chủ đang bận')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
