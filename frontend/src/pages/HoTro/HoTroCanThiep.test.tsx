import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { db } from '@/test/mocks/db';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import HoTroHocVienChiTiet from './HoTroHocVienChiTiet';

// ADR 0003 Lát 3 — người hỗ trợ sửa hồ sơ (bắt buộc lý do) và 3 thao tác tài khoản.
function render() {
  datToken('token-gia-lap');
  db.nguoiDung.vai_tro = 'ho_tro_hoc_vien';
  db.hoTroChiTiet.ho_so.chuc_vu = 'Giáo viên';
  return renderVoiRouter([{ path: '/ho-tro/hoc-vien/:id', element: <HoTroHocVienChiTiet /> }], {
    initialEntries: ['/ho-tro/hoc-vien/hv-ht-1'],
  });
}

async function moFormSua(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Sửa hồ sơ' }));
  return screen.findByRole('dialog');
}

describe('Người hỗ trợ — sửa hồ sơ học viên', () => {
  it('chỉ gửi trường đã đổi + lý do; nút Lưu khóa khi chưa đổi gì hoặc lý do quá ngắn', async () => {
    let body: unknown = null;
    server.use(
      http.patch('/ho-tro-hoc-vien/hoc-vien/:id', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ xac_nhan_bi_huy: false });
      }),
    );
    render();
    const user = userEvent.setup();
    const modal = await moFormSua(user);
    const luu = within(modal).getByRole('button', { name: 'Lưu thay đổi' });
    expect(luu).toBeDisabled();
    const chucVu = within(modal).getByRole('textbox', { name: 'Chức vụ' });
    await user.clear(chucVu);
    await user.type(chucVu, 'Tổ trưởng');
    await user.type(within(modal).getByRole('textbox', { name: /Lý do điều chỉnh/ }), 'abc');
    expect(luu).toBeDisabled();
    await user.type(within(modal).getByRole('textbox', { name: /Lý do điều chỉnh/ }), ' qua Zalo');
    await user.click(luu);
    await waitFor(() => expect(body).toEqual({ chuc_vu: 'Tổ trưởng', ly_do: 'abc qua Zalo' }));
    expect(await screen.findByText('Đã lưu thay đổi hồ sơ')).toBeInTheDocument();
  });

  it('form không có ô CCCD/mã MOET; đổi email hiện cảnh báo phải xác minh lại', async () => {
    render();
    const user = userEvent.setup();
    const modal = await moFormSua(user);
    expect(within(modal).queryByRole('textbox', { name: /CCCD|định danh|MOET/i })).not.toBeInTheDocument();
    await user.type(within(modal).getByRole('textbox', { name: 'Email' }), 'moi@x.vn');
    expect(within(modal).getByText(/học viên sẽ phải tự xác minh email mới/)).toBeInTheDocument();
  });

  it('báo học viên phải xác nhận lại khi đợt đang mở bị hủy xác nhận', async () => {
    server.use(http.patch('/ho-tro-hoc-vien/hoc-vien/:id', () => HttpResponse.json({ xac_nhan_bi_huy: true })));
    render();
    const user = userEvent.setup();
    const modal = await moFormSua(user);
    await user.type(within(modal).getByRole('textbox', { name: 'Chức vụ' }), ' chính');
    await user.type(within(modal).getByRole('textbox', { name: /Lý do điều chỉnh/ }), 'Theo quyết định mới');
    await user.click(within(modal).getByRole('button', { name: 'Lưu thay đổi' }));
    expect(await screen.findByText(/học viên cần xác nhận lại/)).toBeInTheDocument();
  });

  it('lỗi field từ API hiện dưới ô tương ứng', async () => {
    server.use(
      http.patch('/ho-tro-hoc-vien/hoc-vien/:id', () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Dữ liệu cập nhật không hợp lệ',
              fields: [{ field: 'so_dien_thoai_lien_he', message: 'Số điện thoại không hợp lệ' }],
            },
          },
          { status: 400 },
        ),
      ),
    );
    render();
    const user = userEvent.setup();
    const modal = await moFormSua(user);
    await user.type(within(modal).getByRole('textbox', { name: 'Số điện thoại' }), '9');
    await user.type(within(modal).getByRole('textbox', { name: /Lý do điều chỉnh/ }), 'Sửa số điện thoại');
    await user.click(within(modal).getByRole('button', { name: 'Lưu thay đổi' }));
    expect(await within(modal).findByText('Số điện thoại không hợp lệ')).toBeInTheDocument();
  });

  it('bảng lịch sử có cột Lý do', async () => {
    db.hoTroChiTiet.lich_su_thay_doi = [
      {
        truong: 'ngay_sinh',
        gia_tri_cu: '2',
        gia_tri_moi: '12',
        vai_tro_nguoi_sua: 'ho_tro_hoc_vien',
        sua_luc: '2026-10-06T03:00:00.000Z',
        nguoi_sua_ten: 'Cán bộ A',
        ly_do: 'Học viên báo sai ngày sinh',
      },
    ];
    render();
    expect(await screen.findByRole('columnheader', { name: 'Lý do' })).toBeInTheDocument();
    expect(screen.getByText('Học viên báo sai ngày sinh')).toBeInTheDocument();
  });
});

describe('Người hỗ trợ — thao tác tài khoản học viên', () => {
  it('email chưa xác minh -> nút gửi link bị khóa + gợi ý cấp mật khẩu tạm', async () => {
    render();
    const nut = await screen.findByRole('button', { name: 'Gửi link đặt lại mật khẩu' });
    expect(nut).toBeDisabled();
    expect(screen.getByText(/Email chưa xác minh nên không gửi được link/)).toBeInTheDocument();
  });

  it('email đã xác minh -> gửi link, báo địa chỉ đã gửi', async () => {
    db.hoTroChiTiet.tai_khoan!.email_da_xac_minh = true;
    db.hoTroChiTiet.ho_so.email_lien_he = 'mot@truong.edu.vn';
    render();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Gửi link đặt lại mật khẩu' }));
    expect(await screen.findByText('Đã gửi link đặt lại mật khẩu tới mot@truong.edu.vn')).toBeInTheDocument();
  });

  it('cấp mật khẩu tạm cần xác nhận, rồi hiện mật khẩu đúng 1 lần', async () => {
    render();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Cấp mật khẩu tạm' }));
    await user.click(screen.getByRole('button', { name: 'Xác nhận cấp' }));
    const modal = await screen.findByRole('dialog', { name: 'Mật khẩu tạm' });
    expect(within(modal).getByText('Hv7tQ2mZp9')).toBeInTheDocument();
  });

  it('nút Mở khóa tạm chỉ hiện khi tài khoản đang bị khóa', async () => {
    const { unmount } = render();
    await screen.findByRole('button', { name: 'Cấp mật khẩu tạm' });
    expect(screen.queryByRole('button', { name: 'Mở khóa tạm' })).not.toBeInTheDocument();
    unmount();
    db.hoTroChiTiet.tai_khoan!.dang_bi_khoa = true;
    db.hoTroChiTiet.tai_khoan!.khoa_den = '2026-10-06T05:00:00.000Z';
    render();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Mở khóa tạm' }));
    expect(await screen.findByText('Đã mở khóa tạm')).toBeInTheDocument();
  });
});
