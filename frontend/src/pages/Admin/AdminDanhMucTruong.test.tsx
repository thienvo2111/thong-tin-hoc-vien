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
    // "Sửa địa bàn" chỉ hiện cho quan_tri (PATCH @Roles quan_tri) — vai trò mặc định của mock là hoc_vien.
    renderVoiVaiTro('quan_tri');
    await screen.findByText('THPT Long Xuyên');

    await user.click((await screen.findAllByRole('button', { name: 'Sửa địa bàn' }))[0]);

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

// Dữ liệu bịa cho test sửa mã/tên trường.
const TRUONG_CHUA_MA = {
  id: 'dv-chua-ma',
  ma_don_vi: null,
  ten_don_vi: 'Trường THCS Thử Nghiệm',
  loai_don_vi: 'truong',
  dia_ban_id: 'phuong-1',
  dia_ban_ten: 'Phường Long Xuyên',
  tinh_id: 'tinh-1',
  tinh_ten: 'An Giang',
  trang_thai: 'active',
};

/** GET danh mục (trang) trả 1 trường chưa có mã + 1 trường có mã; đếm số lần tải. */
function moPhongDanhMucCoTruongChuaMa() {
  const dem = { soLanTai: 0 };
  server.use(
    http.get('/danh-muc/don-vi-cong-tac', ({ request }) => {
      if (!new URL(request.url).searchParams.get('page')) return undefined;
      dem.soLanTai++;
      return HttpResponse.json({
        data: [
          TRUONG_CHUA_MA,
          { ...TRUONG_CHUA_MA, id: 'dv-co-ma', ma_don_vi: 'THCS99', ten_don_vi: 'Trường THCS Có Mã' },
        ],
        total: 2,
        page: 1,
        page_size: 20,
      });
    }),
  );
  return dem;
}

/** PATCH giả lập: ghi id + body, không đụng DON_VI dùng chung. */
function ghiPatch(traVe?: () => Response) {
  const ghi: { body?: Record<string, unknown>; id?: string } = {};
  server.use(
    http.patch('/danh-muc/don-vi-cong-tac/:id', async ({ params, request }) => {
      ghi.id = params.id as string;
      ghi.body = (await request.json()) as Record<string, unknown>;
      return traVe ? traVe() : HttpResponse.json({ ...TRUONG_CHUA_MA, ...ghi.body });
    }),
  );
  return ghi;
}

async function moModalSuaTruong(user: ReturnType<typeof userEvent.setup>, tenTruong: string) {
  const dong = (await screen.findByText(tenTruong)).closest('tr') as HTMLElement;
  await user.click(await within(dong).findByRole('button', { name: 'Sửa' }));
  return screen.findByRole('dialog', { name: 'Sửa trường' });
}

describe('Admin — Danh mục trường: sửa mã/tên trường', () => {
  it('quan_tri thấy cả "Sửa" và "Sửa địa bàn" trên mỗi dòng', async () => {
    renderVoiVaiTro('quan_tri');
    const dong = (await screen.findByText('THPT Long Xuyên')).closest('tr') as HTMLElement;
    expect(await within(dong).findByRole('button', { name: 'Sửa' })).toBeInTheDocument();
    expect(within(dong).getByRole('button', { name: 'Sửa địa bàn' })).toBeInTheDocument();
  });

  it.each(['so_gddt', 'phong_vhxh', 'truong'])(
    '%s (không phải quan_tri) không thấy "Sửa" lẫn "Sửa địa bàn"',
    async (vaiTro) => {
      renderVoiVaiTro(vaiTro);
      expect(await screen.findByText(`vai trò: ${vaiTro}`)).toBeInTheDocument();
      await screen.findByText('THPT Long Xuyên');
      expect(screen.queryByRole('button', { name: 'Sửa' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Sửa địa bàn' })).not.toBeInTheDocument();
    },
  );

  it('trường chưa có mã hiện "Chưa có mã" ở cột Mã đơn vị', async () => {
    moPhongDanhMucCoTruongChuaMa();
    renderVoiVaiTro('truong');
    const dong = (await screen.findByText('Trường THCS Thử Nghiệm')).closest('tr') as HTMLElement;
    expect(within(dong).getByText('Chưa có mã')).toBeInTheDocument();
    const dongCoMa = screen.getByText('Trường THCS Có Mã').closest('tr') as HTMLElement;
    expect(within(dongCoMa).getByText('THCS99')).toBeInTheDocument();
    expect(within(dongCoMa).queryByText('Chưa có mã')).not.toBeInTheDocument();
  });

  it('mở modal → điền sẵn mã + tên, Lưu bị khóa khi chưa đổi gì (kể cả đổi rồi trả lại như cũ)', async () => {
    const user = userEvent.setup();
    renderVoiVaiTro('quan_tri');
    const modal = await moModalSuaTruong(user, 'THPT Long Xuyên');
    const oMa = within(modal).getByRole('textbox', { name: /^Mã đơn vị/ });
    const oTen = within(modal).getByRole('textbox', { name: /^Tên trường/ });
    expect(oMa).toHaveValue('THPT01');
    expect(oTen).toHaveValue('THPT Long Xuyên');
    expect(within(modal).getByText(/Đổi mã không đổi tên đăng nhập của tài khoản trường đã cấp/)).toBeInTheDocument();
    const nutLuu = within(modal).getByRole('button', { name: 'Lưu' });
    expect(nutLuu).toBeDisabled();

    await user.type(oMa, 'X');
    expect(nutLuu).toBeEnabled();
    await user.type(oMa, '{Backspace}');
    expect(nutLuu).toBeDisabled();
    // Chỉ thêm khoảng trắng cuối tên → sau trim vẫn như cũ.
    await user.type(oTen, '  ');
    expect(nutLuu).toBeDisabled();
  });

  it('bổ sung mã cho trường chưa có mã → PATCH chỉ có ma_don_vi (đã trim), báo thành công, danh mục tải lại', async () => {
    const dem = moPhongDanhMucCoTruongChuaMa();
    const ghi = ghiPatch();
    const user = userEvent.setup();
    renderVoiVaiTro('quan_tri');
    const modal = await moModalSuaTruong(user, 'Trường THCS Thử Nghiệm');
    const oMa = within(modal).getByRole('textbox', { name: /^Mã đơn vị/ });
    expect(oMa).toHaveValue('');
    expect(within(modal).getByText('Dùng làm tên đăng nhập của tài khoản trường (viết thường)')).toBeInTheDocument();

    await user.type(oMa, '  THCS-TN01 ');
    const truocKhiLuu = dem.soLanTai;
    await user.click(within(modal).getByRole('button', { name: 'Lưu' }));

    expect(await screen.findByText('Đã cập nhật trường')).toBeInTheDocument();
    expect(ghi.id).toBe('dv-chua-ma');
    expect(ghi.body).toEqual({ ma_don_vi: 'THCS-TN01' });
    await waitFor(() => expect(dem.soLanTai).toBeGreaterThan(truocKhiLuu));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Sửa trường' })).not.toBeInTheDocument());
  });

  it('chỉ sửa tên → PATCH chỉ có ten_don_vi, chuẩn hóa NFC', async () => {
    const ghi = ghiPatch();
    const user = userEvent.setup();
    renderVoiVaiTro('quan_tri');
    const modal = await moModalSuaTruong(user, 'THPT Long Xuyên');
    const oTen = within(modal).getByRole('textbox', { name: /^Tên trường/ });
    await user.clear(oTen);
    await user.type(oTen, 'THPT Long Xuyên Mới'.normalize('NFD'));
    await user.click(within(modal).getByRole('button', { name: 'Lưu' }));

    expect(await screen.findByText('Đã cập nhật trường')).toBeInTheDocument();
    expect(ghi.body).toEqual({ ten_don_vi: 'THPT Long Xuyên Mới'.normalize('NFC') });
  });

  it('mã trùng (409) → hiện "Mã đã tồn tại" dưới ô Mã, modal vẫn mở', async () => {
    moPhongDanhMucCoTruongChuaMa();
    ghiPatch(() =>
      HttpResponse.json(
        {
          error: {
            code: 'CONFLICT',
            message: 'Mã đơn vị "THPT01" đã tồn tại',
            fields: [{ field: 'ma_don_vi', message: 'Mã đã tồn tại' }],
          },
        },
        { status: 409 },
      ),
    );
    const user = userEvent.setup();
    renderVoiVaiTro('quan_tri');
    const modal = await moModalSuaTruong(user, 'Trường THCS Thử Nghiệm');
    const oMa = within(modal).getByRole('textbox', { name: /^Mã đơn vị/ });
    await user.type(oMa, 'THPT01');
    await user.click(within(modal).getByRole('button', { name: 'Lưu' }));

    expect(await within(modal).findByText('Mã đã tồn tại')).toBeInTheDocument();
    expect(oMa).toHaveAttribute('aria-invalid', 'true');
    expect(oMa).toHaveAccessibleDescription(/Mã đã tồn tại/);
    expect(within(modal).getByRole('alert')).toHaveTextContent('Mã đơn vị "THPT01" đã tồn tại');
    expect(screen.getByRole('dialog', { name: 'Sửa trường' })).toBeInTheDocument();
  });

  it.each([
    ['mã có khoảng trắng', 'THCS 01', 'Mã đơn vị không được có khoảng trắng'],
    ['mã quá 30 ký tự', 'A'.repeat(31), 'Mã đơn vị tối đa 30 ký tự'],
  ])('%s → báo lỗi tại ô Mã, không gọi PATCH', async (_tinhHuong, ma, loi) => {
    moPhongDanhMucCoTruongChuaMa();
    const ghi = ghiPatch();
    const user = userEvent.setup();
    renderVoiVaiTro('quan_tri');
    const modal = await moModalSuaTruong(user, 'Trường THCS Thử Nghiệm');
    await user.type(within(modal).getByRole('textbox', { name: /^Mã đơn vị/ }), ma);
    await user.click(within(modal).getByRole('button', { name: 'Lưu' }));

    expect(await within(modal).findByText(loi)).toBeInTheDocument();
    expect(ghi.body).toBeUndefined();
  });

  it('xóa trắng tên → báo "Nhập tên trường", không gọi PATCH', async () => {
    const ghi = ghiPatch();
    const user = userEvent.setup();
    renderVoiVaiTro('quan_tri');
    const modal = await moModalSuaTruong(user, 'THPT Long Xuyên');
    await user.clear(within(modal).getByRole('textbox', { name: /^Tên trường/ }));
    await user.click(within(modal).getByRole('button', { name: 'Lưu' }));

    expect(await within(modal).findByText('Nhập tên trường')).toBeInTheDocument();
    expect(ghi.body).toBeUndefined();
  });
});
