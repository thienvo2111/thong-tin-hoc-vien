import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { db } from '@/test/mocks/db';
import { server } from '@/test/mocks/server';
import { routesCongDonVi } from '@/router';
import AdminNguoiDung from '@/pages/Admin/AdminNguoiDung';

// router.tsx tạo createBrowserRouter ngay khi import — thay bằng hàm rỗng để test chỉ dùng mảng route.
vi.mock('react-router-dom', async (goc) => ({
  ...(await goc<typeof import('react-router-dom')>()),
  createBrowserRouter: vi.fn(),
}));

beforeEach(() => vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', window.location.hostname));
afterEach(() => vi.unstubAllEnvs());

const TRANG = '/quan-tri/don-vi-tai-khoan';
const TRANG_NHAP = '/quan-tri/nhap-tai-khoan-don-vi';

function moCong(duongDan: string, vaiTro = 'quan_tri') {
  db.nguoiDung.vai_tro = vaiTro;
  datToken('token-gia-lap');
  return renderVoiRouter(routesCongDonVi, { initialEntries: [duongDan] });
}

/** Ghi lại mọi request API tới các màn quản trị đơn vị/tài khoản (để kiểm "không gọi API"). */
function ghiRequestQuanTri() {
  const urls: string[] = [];
  const nghe = ({ request }: { request: Request }) => {
    const p = new URL(request.url).pathname;
    if (p.startsWith('/nguoi-dung') || p.startsWith('/danh-muc/don-vi-cong-tac') || p.startsWith('/import')) {
      urls.push(p);
    }
  };
  server.events.on('request:start', nghe);
  return { urls, go: () => server.events.removeListener('request:start', nghe) };
}

describe('Menu Cổng đơn vị — Đơn vị & tài khoản', () => {
  it('quan_tri thấy "Đơn vị & tài khoản", bấm vào mở trang Đơn vị & tài khoản', async () => {
    const user = userEvent.setup();
    const { router } = moCong('/trang-chu');
    const menu = await screen.findByRole('navigation', { name: 'Menu Cổng đơn vị' });
    const lienKet = await within(menu).findByRole('link', { name: 'Đơn vị & tài khoản' });
    expect(lienKet).toHaveAttribute('href', TRANG);
    await user.click(lienKet);
    expect(await screen.findByRole('tab', { name: 'Tài khoản đơn vị' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(TRANG);
  });

  it('trường không thấy "Đơn vị & tài khoản" — menu chỉ Trang chủ, Hồ sơ đơn vị, Hướng dẫn', async () => {
    moCong('/trang-chu', 'truong');
    const menu = await screen.findByRole('navigation', { name: 'Menu Cổng đơn vị' });
    await screen.findByText(String(db.hoSo.ma_dinh_danh_moet));
    expect(
      within(menu)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['Trang chủ', 'Hồ sơ đơn vị', 'Hướng dẫn']);
  });
});

describe('/quan-tri/don-vi-tai-khoan — tab', () => {
  it('mặc định mở tab "Tài khoản đơn vị" với danh sách tài khoản', async () => {
    moCong(TRANG);
    expect(await screen.findByRole('tab', { name: 'Tài khoản đơn vị' })).toHaveAttribute('aria-selected', 'true');
    const bang = await screen.findByRole('table');
    expect(await within(bang).findByText('sgd-angiang')).toBeInTheDocument();
    expect(screen.queryByText('THPT Long Xuyên')).not.toBeInTheDocument();
  });

  it('bấm tab "Danh mục trường" → hiện danh mục, URL có ?tab=danh-muc', async () => {
    const user = userEvent.setup();
    const { router } = moCong(TRANG);
    await user.click(await screen.findByRole('tab', { name: 'Danh mục trường' }));
    expect(await screen.findByText('THPT Long Xuyên')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Danh mục trường' })).toHaveAttribute('aria-selected', 'true');
    expect(router.state.location.pathname).toBe(TRANG);
    expect(new URLSearchParams(router.state.location.search).get('tab')).toBe('danh-muc');
  });

  it('mở thẳng ?tab=danh-muc → vào luôn tab Danh mục trường', async () => {
    moCong(`${TRANG}?tab=danh-muc`);
    expect(await screen.findByText('THPT Long Xuyên')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Danh mục trường' })).toHaveAttribute('aria-selected', 'true');
  });
});

/** Mở modal Thêm trường ở tab Danh mục trường trên Cổng, trả về modal. */
async function moThemTruong(user: ReturnType<typeof userEvent.setup>) {
  moCong(`${TRANG}?tab=danh-muc`);
  await screen.findByText('THPT Long Xuyên');
  await user.click(await screen.findByRole('button', { name: '+ Thêm trường' }));
  return screen.findByRole('dialog', { name: 'Thêm trường' });
}

async function dienDiaBanVaDonViQuanLy(user: ReturnType<typeof userEvent.setup>, modal: HTMLElement) {
  await user.click(within(modal).getByLabelText(/^Tỉnh\/thành/, { selector: 'input' }));
  await user.click(await screen.findByRole('option', { name: 'An Giang' }));
  await user.click(within(modal).getByLabelText(/^Phường\/xã/, { selector: 'input' }));
  await user.click(await screen.findByRole('option', { name: 'Phường Long Xuyên' }));
  await user.type(within(modal).getByRole('textbox', { name: /^Đơn vị quản lý/ }), 'Sở GD');
  await user.click(await screen.findByRole('option', { name: /Sở GD&ĐT An Giang/ }));
}

describe('Thêm trường trên Cổng đơn vị (quan_tri)', () => {
  it('nhập đủ → POST đúng body (loai_don_vi=truong, đơn vị cha), báo thành công, đóng modal, danh mục tải lại', async () => {
    let body: unknown;
    let daTao = false;
    server.use(
      http.post('/danh-muc/don-vi-cong-tac', async ({ request }) => {
        body = await request.clone().json();
        daTao = true;
        return undefined;
      }),
      http.get('/danh-muc/don-vi-cong-tac', ({ request }) => {
        const url = new URL(request.url);
        if (!daTao || url.searchParams.get('loai_don_vi') !== 'truong' || !url.searchParams.get('page')) {
          return undefined;
        }
        return HttpResponse.json({
          data: [
            {
              id: 'dv-moi',
              ma_don_vi: 'THPT99',
              ten_don_vi: 'Trường THPT Mới',
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
    const modal = await moThemTruong(user);
    await user.type(within(modal).getByRole('textbox', { name: /^Tên trường/ }), '  Trường THPT Mới  ');
    await user.type(within(modal).getByRole('textbox', { name: /^Mã đơn vị/ }), ' THPT99 ');
    await dienDiaBanVaDonViQuanLy(user, modal);
    await user.click(within(modal).getByRole('button', { name: 'Thêm trường' }));

    await waitFor(() => expect(body).toBeTruthy());
    expect(body).toEqual({
      ten_don_vi: 'Trường THPT Mới',
      ma_don_vi: 'THPT99',
      loai_don_vi: 'truong',
      dia_ban_id: 'phuong-1',
      don_vi_cha_id: 'dv-so-1',
    });
    expect(await screen.findAllByText('Đã thêm trường "Trường THPT Mới"')).not.toHaveLength(0);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Thêm trường' })).not.toBeInTheDocument());
    expect(await screen.findByText('Trường THPT Mới')).toBeInTheDocument();
  }, 20000);

  it('bỏ trống bắt buộc → báo lỗi tên, tỉnh, phường/xã, đơn vị quản lý; không gọi API', async () => {
    let daGoi = false;
    server.use(
      http.post('/danh-muc/don-vi-cong-tac', () => {
        daGoi = true;
        return undefined;
      }),
    );
    const user = userEvent.setup();
    const modal = await moThemTruong(user);
    await user.click(within(modal).getByRole('button', { name: 'Thêm trường' }));
    expect(await within(modal).findByText('Nhập tên trường')).toBeInTheDocument();
    expect(within(modal).getByText('Chọn tỉnh/thành')).toBeInTheDocument();
    expect(within(modal).getByText('Chọn phường/xã')).toBeInTheDocument();
    expect(within(modal).getByText('Chọn đơn vị quản lý (Sở/Phòng)')).toBeInTheDocument();
    expect(daGoi).toBe(false);
  });

  it('mã đơn vị trùng → server 409, hiện lỗi dưới ô Mã đơn vị, modal vẫn mở', async () => {
    const user = userEvent.setup();
    const modal = await moThemTruong(user);
    await user.type(within(modal).getByRole('textbox', { name: /^Tên trường/ }), 'Trường THPT Trùng Mã');
    await user.type(within(modal).getByRole('textbox', { name: /^Mã đơn vị/ }), 'THPT01');
    await dienDiaBanVaDonViQuanLy(user, modal);
    await user.click(within(modal).getByRole('button', { name: 'Thêm trường' }));
    expect(await within(modal).findByText('Mã đã tồn tại')).toBeInTheDocument();
    expect(within(modal).getByRole('alert')).toHaveTextContent('Mã đơn vị "THPT01" đã tồn tại');
    expect(screen.getByRole('dialog', { name: 'Thêm trường' })).toBeInTheDocument();
  }, 20000);
});

describe('Danh mục trường trên Cổng đơn vị', () => {
  // Luồng "Sửa địa bàn" có sẵn vẫn chạy được trong khung Cổng.
  it('sửa địa bàn trường: chọn Tỉnh + Phường/xã, Lưu → PATCH đúng body, báo thành công', async () => {
    let body: unknown;
    server.use(
      http.patch('/danh-muc/don-vi-cong-tac/:id', async ({ params, request }) => {
        body = await request.json();
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
    moCong(`${TRANG}?tab=danh-muc`);
    await screen.findByText('THPT Long Xuyên');
    await user.click(screen.getAllByRole('button', { name: 'Sửa địa bàn' })[0]);
    const modal = await screen.findByRole('dialog');
    await user.click(within(modal).getByLabelText(/^Tỉnh\/thành/, { selector: 'input' }));
    await user.click(await screen.findByRole('option', { name: 'Cần Thơ' }));
    await user.click(within(modal).getByLabelText(/^Phường\/xã/, { selector: 'input' }));
    await user.click(await screen.findByRole('option', { name: 'Phường Châu Đốc' }));
    await user.click(within(modal).getByRole('button', { name: 'Lưu' }));
    // routesCongDonVi có <Notifications> riêng (KhungNoiBo) ngoài cái của renderVoiRouter → thông báo hiện 2 lần trong test.
    expect(await screen.findAllByText('Đã cập nhật địa bàn cho "THPT Long Xuyên"')).not.toHaveLength(0);
    expect(body).toEqual({ dia_ban_id: 'phuong-2' });
  });
});

describe('Tài khoản đơn vị trên Cổng đơn vị', () => {
  it('"Nhập từ Excel" chuyển tới /quan-tri/nhap-tai-khoan-don-vi (không sang /admin)', async () => {
    const user = userEvent.setup();
    const { router } = moCong(TRANG);
    await user.click(await screen.findByRole('button', { name: 'Nhập từ Excel' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(TRANG_NHAP));
    expect(await screen.findByText('Tải file lên hệ thống')).toBeInTheDocument();
    expect(screen.queryByText('Không tìm thấy trang')).not.toBeInTheDocument();
  });

  it('modal tạo tài khoản không có lựa chọn "Gửi email kích hoạt" kể cả khi nhập email; tạo → mật khẩu tạm', async () => {
    let body: { cach_cap?: string } | undefined;
    server.use(
      http.post('/nguoi-dung/don-vi', async ({ request }) => {
        body = (await request.clone().json()) as { cach_cap?: string };
        return undefined;
      }),
    );
    const user = userEvent.setup();
    moCong(TRANG);
    await user.click(await screen.findByRole('button', { name: '+ Tạo tài khoản' }));
    const modal = await screen.findByRole('dialog');
    await user.click(within(modal).getByRole('textbox', { name: /^Đơn vị/ }));
    await user.click(await screen.findByRole('option', { name: /Trường THPT Long Xuyên/ }));
    await user.type(within(modal).getByRole('textbox', { name: /^Email/ }), 'ht@vidu.test');
    expect(within(modal).queryByRole('radio', { name: 'Gửi email kích hoạt' })).not.toBeInTheDocument();
    await user.click(within(modal).getByRole('button', { name: 'Tạo tài khoản' }));
    expect(await screen.findByText('Ab3dEf7hJk')).toBeInTheDocument();
    expect(body?.cach_cap).toBe('mat_khau_tam');
  });

  it('menu thao tác không có "Gửi email kích hoạt" (kể cả tài khoản có email); cấp lại mật khẩu tạm vẫn hiện mật khẩu', async () => {
    const user = userEvent.setup();
    moCong(TRANG);
    const bang = await screen.findByRole('table');
    const dongCoEmail = (await within(bang).findByText('sgd-angiang')).closest('tr')!;
    await user.click(within(dongCoEmail).getByRole('button', { name: 'Thao tác' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Cấp mật khẩu tạm' }));
    expect(screen.queryByRole('menuitem', { name: 'Gửi email kích hoạt' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Cấp mật khẩu' }));
    expect(await screen.findByText('Qw7eRt3yUp')).toBeInTheDocument();
  });
});

describe('/quan-tri/nhap-tai-khoan-don-vi', () => {
  it('loại cố định "Tài khoản đơn vị", không có ô chọn loại, bỏ qua ?loai=; lịch sử lọc theo loại', async () => {
    const lichSu: string[] = [];
    server.use(
      http.get('/import', ({ request }) => {
        lichSu.push(new URL(request.url).search);
        return undefined;
      }),
    );
    moCong(`${TRANG_NHAP}?loai=ho_so_nhan_su_moet`);
    expect(await screen.findByText('Tải file lên hệ thống')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Loại dữ liệu' })).not.toBeInTheDocument();
    expect(screen.getByText('Tài khoản đơn vị')).toBeInTheDocument();
    await waitFor(() => expect(lichSu).toContain('?loai=tai_khoan_don_vi'));
  });

  it('tải lên → kết quả kiểm tra → xác nhận: gửi đúng loại và tự tải file mật khẩu tạm', async () => {
    const urlTaiLen: string[] = [];
    server.use(
      http.post('/import/:loai', ({ request }) => {
        urlTaiLen.push(new URL(request.url).pathname);
        return undefined;
      }),
      http.post(
        '/import/:id/xac-nhan',
        () =>
          new HttpResponse(new Blob(['xlsx']), {
            headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
          }),
      ),
    );
    const user = userEvent.setup();
    const { container } = moCong(TRANG_NHAP);
    await screen.findByRole('table');
    const soLanTaiTruoc = vi.mocked(URL.createObjectURL).mock.calls.length;
    await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, new File(['x'], 'tk.xlsx'));
    await user.click(screen.getByRole('button', { name: 'Tải lên & kiểm tra' }));
    await user.click(await screen.findByRole('button', { name: 'Xác nhận nạp dữ liệu' }));

    expect(await screen.findByText(/Đã tạo 4 tài khoản/)).toBeInTheDocument();
    expect(urlTaiLen).toEqual(['/import/tai_khoan_don_vi']);
    expect(vi.mocked(URL.createObjectURL).mock.calls.length).toBeGreaterThan(soLanTaiTruoc);
    expect(screen.getByRole('button', { name: 'Tải file mật khẩu tạm' })).toBeInTheDocument();
  });
});

describe('Phân quyền — vai trò đơn vị', () => {
  const ca = ['truong', 'so_gddt', 'phong_vhxh'].flatMap((vaiTro) =>
    [TRANG, TRANG_NHAP].map((duongDan) => [vaiTro, duongDan] as const),
  );
  it.each(ca)('%s mở %s → 404, không gọi API', async (vaiTro, duongDan) => {
    const ghi = ghiRequestQuanTri();
    try {
      moCong(duongDan, vaiTro);
      expect(await screen.findByText('Không tìm thấy trang')).toBeInTheDocument();
      expect(screen.getByRole('navigation', { name: 'Menu Cổng đơn vị' })).toBeInTheDocument();
      expect(ghi.urls).toEqual([]);
    } finally {
      ghi.go();
    }
  });
});

describe('Trang NLS giữ nguyên mặc định', () => {
  it('AdminNguoiDung không truyền prop: "Nhập từ Excel" → /admin/nhap-du-lieu?loai=tai_khoan_don_vi, vẫn có lựa chọn email kích hoạt', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    datToken('token-gia-lap');
    const { router } = renderVoiRouter(
      [
        { path: '/admin/nguoi-dung', element: <AdminNguoiDung /> },
        { path: '/admin/nhap-du-lieu', element: <div>Màn hình nhập dữ liệu</div> },
      ],
      { initialEntries: ['/admin/nguoi-dung'] },
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '+ Tạo tài khoản' }));
    const modal = await screen.findByRole('dialog');
    expect(within(modal).getByRole('radio', { name: 'Gửi email kích hoạt' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Nhập từ Excel' }));
    expect(await screen.findByText('Màn hình nhập dữ liệu')).toBeInTheDocument();
    expect(router.state.location.pathname + router.state.location.search).toBe(
      '/admin/nhap-du-lieu?loai=tai_khoan_don_vi',
    );
  });
});
