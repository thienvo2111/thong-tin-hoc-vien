import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderTrang } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { useToi } from '@/auth/AuthContext';
import { db } from '@/test/mocks/db';
import AdminDanhMucTruong from './AdminDanhMucTruong';

function render() {
  datToken('token-gia-lap');
  return renderTrang(<AdminDanhMucTruong />);
}

describe('Admin — Danh mục trường', () => {
  it('hiện danh sách trường từ API mock (tên, mã đơn vị, tỉnh, phường/xã hiện tại)', async () => {
    render();
    expect(await screen.findByText('THPT Long Xuyên')).toBeInTheDocument();
    expect(screen.getByText('THPT Châu Đốc')).toBeInTheDocument();
    const bang = screen.getByRole('table');
    expect(within(bang).getByText('THPT01')).toBeInTheDocument();
    expect(within(bang).getByText('An Giang')).toBeInTheDocument();
    expect(within(bang).getByText('Phường Long Xuyên')).toBeInTheDocument();
  });

  it('lọc theo tỉnh → gửi đúng query tinh_id lên API, chỉ còn trường thuộc tỉnh đó', async () => {
    const tinhIdNhan: (string | null)[] = [];
    server.use(
      http.get('/danh-muc/don-vi-cong-tac', ({ request }) => {
        const url = new URL(request.url);
        tinhIdNhan.push(url.searchParams.get('tinh_id'));
        return HttpResponse.json({
          data: [
            {
              id: 'dv-1',
              ma_don_vi: 'THPT01',
              ten_don_vi: 'THPT Long Xuyên',
              loai_don_vi: 'truong',
              dia_ban_id: 'phuong-1',
              dia_ban_ten: 'Phường Long Xuyên',
              tinh_id: 'tinh-1',
              tinh_ten: 'An Giang',
              trang_thai: 'active',
            },
          ],
          total: 1,
          page: 1,
          page_size: 20,
        });
      }),
    );
    const user = userEvent.setup();
    render();
    await screen.findByText('THPT Long Xuyên');

    const oTinh = screen.getByLabelText('Tỉnh/thành', { selector: 'input' });
    await user.click(oTinh);
    await user.click(await screen.findByRole('option', { name: 'An Giang' }));

    await waitFor(() => expect(tinhIdNhan).toContain('tinh-1'));
    expect(screen.queryByText('THPT Châu Đốc')).not.toBeInTheDocument();
  });

  it('mở modal sửa, chọn lại Tỉnh + Phường/xã rồi bấm Lưu → gọi đúng PATCH, hiện thông báo thành công', async () => {
    let patchBody: unknown;
    server.use(
      http.patch('/danh-muc/don-vi-cong-tac/:id', async ({ params, request }) => {
        patchBody = await request.json();
        return HttpResponse.json({
          id: params.id,
          ma_don_vi: 'THPT01',
          ten_don_vi: 'THPT Long Xuyên',
          loai_don_vi: 'truong',
          dia_ban_id: 'phuong-2',
          dia_ban_ten: 'Phường Châu Đốc',
          tinh_id: 'tinh-2',
          tinh_ten: 'Cần Thơ',
          trang_thai: 'active',
        });
      }),
    );
    const user = userEvent.setup();
    render();
    await screen.findByText('THPT Long Xuyên');

    await user.click(screen.getAllByRole('button', { name: 'Sửa địa bàn' })[0]);

    const modal = await screen.findByRole('dialog');
    expect(within(modal).getByText('THPT Long Xuyên')).toBeInTheDocument();

    const oTinh = within(modal).getByLabelText(/^Tỉnh\/thành/, { selector: 'input' });
    await user.click(oTinh);
    await user.click(await screen.findByRole('option', { name: 'Cần Thơ' }));

    const oPhuong = within(modal).getByLabelText(/^Phường\/xã/, { selector: 'input' });
    await user.click(oPhuong);
    await user.click(await screen.findByRole('option', { name: 'Phường Châu Đốc' }));

    await user.click(within(modal).getByRole('button', { name: 'Lưu' }));

    expect(await screen.findByText('Đã cập nhật địa bàn cho "THPT Long Xuyên"')).toBeInTheDocument();
    expect(patchBody).toEqual({ dia_ban_id: 'phuong-2' });
  });
});

/** Hiện vai trò đã tải xong — để kiểm "không có nút" sau khi biết chắc người dùng. */
function ThamDoVaiTro() {
  const { nguoiDung } = useToi();
  return <span>vai trò: {nguoiDung?.vai_tro ?? 'đang tải'}</span>;
}

function renderVoiVaiTro(vaiTro: string) {
  db.nguoiDung.vai_tro = vaiTro;
  datToken('token-gia-lap');
  return renderTrang(
    <>
      <ThamDoVaiTro />
      <AdminDanhMucTruong />
    </>,
  );
}

describe('Admin — Danh mục trường: thêm trường (NLS)', () => {
  it.each(['so_gddt', 'phong_vhxh', 'truong'])(
    '%s (không phải quan_tri) không thấy "+ Thêm trường"',
    async (vaiTro) => {
      renderVoiVaiTro(vaiTro);
      expect(await screen.findByText(`vai trò: ${vaiTro}`)).toBeInTheDocument();
      await screen.findByText('THPT Long Xuyên');
      expect(screen.queryByRole('button', { name: '+ Thêm trường' })).not.toBeInTheDocument();
    },
  );

  it('quan_tri thêm trường không nhập mã → POST không có ma_don_vi, danh mục được tải lại', async () => {
    let body: Record<string, unknown> | undefined;
    let soLanTaiDanhMuc = 0;
    server.use(
      http.post('/danh-muc/don-vi-cong-tac', async ({ request }) => {
        body = (await request.clone().json()) as Record<string, unknown>;
        return undefined;
      }),
      http.get('/danh-muc/don-vi-cong-tac', ({ request }) => {
        if (new URL(request.url).searchParams.get('page')) soLanTaiDanhMuc++;
        return undefined;
      }),
    );
    const user = userEvent.setup();
    renderVoiVaiTro('quan_tri');
    await screen.findByText('THPT Long Xuyên');
    await user.click(await screen.findByRole('button', { name: '+ Thêm trường' }));
    const modal = await screen.findByRole('dialog', { name: 'Thêm trường' });
    await user.type(within(modal).getByRole('textbox', { name: /^Tên trường/ }), 'Trường THCS Mới');
    await user.click(within(modal).getByLabelText(/^Tỉnh\/thành/, { selector: 'input' }));
    await user.click(await screen.findByRole('option', { name: 'Cần Thơ' }));
    await user.click(within(modal).getByLabelText(/^Phường\/xã/, { selector: 'input' }));
    await user.click(await screen.findByRole('option', { name: 'Phường Châu Đốc' }));
    await user.type(within(modal).getByRole('textbox', { name: /^Đơn vị quản lý/ }), 'Sở GD');
    await user.click(await screen.findByRole('option', { name: /Sở GD&ĐT An Giang/ }));
    const truocKhiTao = soLanTaiDanhMuc;
    await user.click(within(modal).getByRole('button', { name: 'Thêm trường' }));

    expect(await screen.findByText('Đã thêm trường "Trường THCS Mới"')).toBeInTheDocument();
    expect(body).toEqual({
      ten_don_vi: 'Trường THCS Mới',
      loai_don_vi: 'truong',
      dia_ban_id: 'phuong-2',
      don_vi_cha_id: 'dv-so-1',
    });
    await waitFor(() => expect(soLanTaiDanhMuc).toBeGreaterThan(truocKhiTao));
  }, 20000);
});
