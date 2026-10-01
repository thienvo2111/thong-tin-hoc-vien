import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderTrang } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
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
