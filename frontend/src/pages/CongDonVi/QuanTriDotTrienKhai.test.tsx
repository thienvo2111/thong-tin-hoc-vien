import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { db } from '@/test/mocks/db';
import { server } from '@/test/mocks/server';
import { dbDotTrienKhai, dotMau } from '@/test/mocks/dotTrienKhai';
import { routesCongDonVi } from '@/router';
import CongDonViLayout from './CongDonViLayout';
import QuanTriDotTrienKhai from './QuanTriDotTrienKhai';

// router.tsx tạo createBrowserRouter ngay khi import — thay bằng hàm rỗng để test chỉ dùng mảng route.
vi.mock('react-router-dom', async (goc) => ({
  ...(await goc<typeof import('react-router-dom')>()),
  createBrowserRouter: vi.fn(),
}));

beforeEach(() => vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', window.location.hostname));
afterEach(() => vi.unstubAllEnvs());

const URL = '/cong-don-vi/dot-trien-khai';

function renderTrang(vaiTro = 'quan_tri') {
  db.nguoiDung.vai_tro = vaiTro;
  datToken('token-gia-lap');
  return renderVoiRouter([{ path: '/quan-tri/dot-trien-khai', element: <QuanTriDotTrienKhai /> }], {
    initialEntries: ['/quan-tri/dot-trien-khai'],
  });
}

/** Bắt body gửi lên, vẫn trả về như handler mặc định. */
function batBody(method: 'post' | 'patch', duongDan: string) {
  const ghi: { body?: unknown } = {};
  server.use(
    http[method](duongDan, async ({ request }) => {
      ghi.body = await request.clone().json();
      return undefined;
    }),
  );
  return ghi;
}

async function moTao(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Tạo đợt' }));
  return screen.findByRole('dialog', { name: 'Tạo đợt triển khai' });
}

async function chonSo(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('textbox', { name: /^Sở GD&ĐT/ }));
  await user.click(await screen.findByRole('option', { name: 'Sở GD&ĐT An Giang' }));
}

async function goNgay(user: ReturnType<typeof userEvent.setup>, nhan: RegExp, giaTri: string) {
  const o = screen.getByLabelText(nhan);
  await user.clear(o);
  await user.type(o, giaTri);
  await user.tab(); // blur đóng lịch; Escape sẽ đóng cả Modal
}

describe('QuanTriDotTrienKhai — danh sách', () => {
  it('hiện badge chương trình, tên, Sở, đơn giá vi-VN, khoảng QĐ, hạn nộp; "Chưa có" khi đơn giá/QĐ trống', async () => {
    dbDotTrienKhai.ds = [
      dotMau(),
      dotMau({
        id: 'dtk-2',
        chuong_trinh: 'nls',
        ten: 'NLS đợt 2',
        don_gia: null,
        ngay_qd_tu: null,
        ngay_qd_den: null,
        han_nop_ngay: '2027-01-15',
      }),
    ];
    renderTrang();
    const ds = await screen.findByRole('list', { name: 'Danh sách đợt triển khai' });
    const [the1, the2] = within(ds).getAllByRole('listitem');
    expect(within(the1).getByText('HSG')).toBeInTheDocument();
    expect(within(the1).getByText('HSG An Giang 2026')).toBeInTheDocument();
    expect(within(the1).getByText('Sở GD&ĐT An Giang')).toBeInTheDocument();
    expect(within(the1).getByText('1.500.000 đ')).toBeInTheDocument();
    expect(within(the1).getByText('01/03/2026 – 31/12/2026')).toBeInTheDocument();
    expect(within(the1).getByText('31/12/2026')).toBeInTheDocument();
    expect(within(the1).getByRole('button', { name: 'Sửa đợt HSG An Giang 2026' })).toBeInTheDocument();

    expect(within(the2).getByText('NLS')).toBeInTheDocument();
    expect(within(the2).getAllByText('Chưa có')).toHaveLength(2);
    expect(within(the2).getByText('15/01/2027')).toBeInTheDocument();
  });

  it('chưa có đợt → thông báo trống, vẫn có nút Tạo đợt', async () => {
    renderTrang();
    expect(await screen.findByText('Chưa có đợt nào.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tạo đợt' })).toBeInTheDocument();
  });
});

describe('QuanTriDotTrienKhai — tạo đợt', () => {
  it('chỉ nhập bắt buộc → POST đúng body (han_nop_ngay YYYY-MM-DD, don_gia/QĐ null), báo thành công, danh sách tải lại', async () => {
    const ghi = batBody('post', URL);
    const user = userEvent.setup();
    renderTrang();
    const hop = await moTao(user);
    expect(within(hop).getByText('Tính đến 23:59 ngày này (giờ Việt Nam)')).toBeInTheDocument();
    await user.type(within(hop).getByLabelText(/^Tên đợt/), '  HSG An Giang 2026  ');
    await chonSo(user);
    await goNgay(user, /^Hạn nộp/, '31/12/2026');
    await user.click(within(hop).getByRole('button', { name: 'Tạo đợt' }));

    await waitFor(() => expect(ghi.body).toBeTruthy());
    expect(ghi.body).toEqual({
      chuong_trinh: 'hsg',
      ten: 'HSG An Giang 2026',
      so_gddt_id: 'dv-so-1',
      don_gia: null,
      ngay_qd_tu: null,
      ngay_qd_den: null,
      han_nop_ngay: '2026-12-31',
    });
    expect(await screen.findByText('Đã tạo đợt')).toBeInTheDocument();
    const ds = await screen.findByRole('list', { name: 'Danh sách đợt triển khai' });
    expect(within(ds).getByText('HSG An Giang 2026')).toBeInTheDocument();
  }, 20000);

  it('chương trình NLS + đơn giá + khoảng QĐ (đến == từ) → gửi số nguyên và 2 ngày', async () => {
    const ghi = batBody('post', URL);
    const user = userEvent.setup();
    renderTrang();
    const hop = await moTao(user);
    await user.click(within(hop).getByRole('textbox', { name: /^Chương trình/ }));
    await user.click(await screen.findByRole('option', { name: /^NLS/ }));
    await user.type(within(hop).getByLabelText(/^Tên đợt/), 'NLS đợt 1');
    await chonSo(user);
    await user.type(within(hop).getByLabelText(/^Đơn giá/), '1500000');
    expect(within(hop).getByLabelText(/^Đơn giá/)).toHaveValue('1.500.000');
    await goNgay(user, /^Ngày QĐ chỉ định thầu – từ/, '01/03/2026');
    await goNgay(user, /^Ngày QĐ chỉ định thầu – đến/, '01/03/2026');
    await goNgay(user, /^Hạn nộp/, '15/01/2027');
    await user.click(within(hop).getByRole('button', { name: 'Tạo đợt' }));

    await waitFor(() => expect(ghi.body).toBeTruthy());
    expect(ghi.body).toMatchObject({
      chuong_trinh: 'nls',
      don_gia: 1500000,
      ngay_qd_tu: '2026-03-01',
      ngay_qd_den: '2026-03-01',
      han_nop_ngay: '2027-01-15',
    });
  }, 20000);

  it('bỏ trống bắt buộc → báo lỗi tên, Sở, hạn nộp; không gọi API', async () => {
    const ghi = batBody('post', URL);
    const user = userEvent.setup();
    renderTrang();
    const hop = await moTao(user);
    await user.click(within(hop).getByRole('button', { name: 'Tạo đợt' }));
    expect(await within(hop).findByText('Nhập tên đợt')).toBeInTheDocument();
    expect(within(hop).getByText('Chọn Sở GD&ĐT')).toBeInTheDocument();
    expect(within(hop).getByText('Chọn hạn nộp')).toBeInTheDocument();
    expect(ghi.body).toBeUndefined();
  }, 20000);

  it('ngày QĐ đến < từ, chỉ có 1 ngày QĐ, đơn giá âm → báo lỗi, không gọi API', async () => {
    const ghi = batBody('post', URL);
    const user = userEvent.setup();
    renderTrang();
    const hop = await moTao(user);
    await user.type(within(hop).getByLabelText(/^Tên đợt/), 'Đợt lỗi');
    await chonSo(user);
    await goNgay(user, /^Hạn nộp/, '31/12/2026');
    await user.type(within(hop).getByLabelText(/^Đơn giá/), '-5');
    await goNgay(user, /^Ngày QĐ chỉ định thầu – từ/, '02/03/2026');
    await goNgay(user, /^Ngày QĐ chỉ định thầu – đến/, '01/03/2026');
    await user.click(within(hop).getByRole('button', { name: 'Tạo đợt' }));
    expect(await within(hop).findByText('Ngày đến phải bằng hoặc sau ngày từ')).toBeInTheDocument();
    expect(within(hop).getByText('Đơn giá không được âm')).toBeInTheDocument();

    await user.clear(within(hop).getByLabelText(/^Ngày QĐ chỉ định thầu – đến/));
    await user.tab(); // blur đóng lịch; Escape sẽ đóng cả Modal
    await user.click(within(hop).getByRole('button', { name: 'Tạo đợt' }));
    expect(await within(hop).findByText('Nhập cả ngày từ và ngày đến, hoặc để trống cả hai')).toBeInTheDocument();
    expect(ghi.body).toBeUndefined();
  }, 20000);

  it('server trả 400 → hiện thông điệp server và lỗi ở đúng ô', async () => {
    server.use(
      http.post(URL, () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Sở GD&ĐT không tồn tại hoặc đã ngưng hoạt động',
              fields: [{ field: 'so_gddt_id', message: 'Sở đã ngưng hoạt động' }],
            },
          },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderTrang();
    const hop = await moTao(user);
    await user.type(within(hop).getByLabelText(/^Tên đợt/), 'Đợt X');
    await chonSo(user);
    await goNgay(user, /^Hạn nộp/, '31/12/2026');
    await user.click(within(hop).getByRole('button', { name: 'Tạo đợt' }));
    expect(await within(hop).findByRole('alert')).toHaveTextContent('Sở GD&ĐT không tồn tại hoặc đã ngưng hoạt động');
    expect(within(hop).getByText('Sở đã ngưng hoạt động')).toBeInTheDocument();
  }, 20000);
});

describe('QuanTriDotTrienKhai — sửa đợt', () => {
  it('điền sẵn giá trị, khóa chương trình, gợi ý gia hạn; đổi hạn nộp → PATCH', async () => {
    dbDotTrienKhai.ds = [dotMau()];
    const ghi = batBody('patch', `${URL}/:id`);
    const user = userEvent.setup();
    renderTrang();
    await user.click(await screen.findByRole('button', { name: 'Sửa đợt HSG An Giang 2026' }));
    const hop = await screen.findByRole('dialog', { name: 'Sửa đợt triển khai' });
    expect(within(hop).getByLabelText(/^Tên đợt/)).toHaveValue('HSG An Giang 2026');
    expect(within(hop).getByRole('textbox', { name: /^Chương trình/ })).toBeDisabled();
    expect(within(hop).getByRole('textbox', { name: /^Sở GD&ĐT/ })).toHaveValue('Sở GD&ĐT An Giang');
    expect(within(hop).getByLabelText(/^Đơn giá/)).toHaveValue('1.500.000');
    expect(within(hop).getByLabelText(/^Ngày QĐ chỉ định thầu – từ/)).toHaveValue('01/03/2026');
    expect(within(hop).getByLabelText(/^Hạn nộp/)).toHaveValue('31/12/2026');
    expect(within(hop).getByText(/Đổi hạn = gia hạn cả đợt/)).toBeInTheDocument();

    await goNgay(user, /^Hạn nộp/, '15/01/2027');
    await user.click(within(hop).getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(ghi.body).toBeTruthy());
    expect(ghi.body).toEqual({
      ten: 'HSG An Giang 2026',
      so_gddt_id: 'dv-so-1',
      don_gia: 1500000,
      ngay_qd_tu: '2026-03-01',
      ngay_qd_den: '2026-12-31',
      han_nop_ngay: '2027-01-15',
    });
    expect(await screen.findByText('Đã cập nhật đợt')).toBeInTheDocument();
    expect(await screen.findByText('15/01/2027')).toBeInTheDocument();
  }, 20000);

  it('xóa đơn giá khi sửa → PATCH don_gia null', async () => {
    dbDotTrienKhai.ds = [dotMau()];
    const ghi = batBody('patch', `${URL}/:id`);
    const user = userEvent.setup();
    renderTrang();
    await user.click(await screen.findByRole('button', { name: 'Sửa đợt HSG An Giang 2026' }));
    const hop = await screen.findByRole('dialog', { name: 'Sửa đợt triển khai' });
    await user.clear(within(hop).getByLabelText(/^Đơn giá/));
    await user.click(within(hop).getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(ghi.body).toBeTruthy());
    expect(ghi.body).toMatchObject({ don_gia: null });
  }, 20000);
});

describe('Phân quyền Cổng đơn vị', () => {
  function renderLayout(vaiTro: string) {
    db.nguoiDung.vai_tro = vaiTro;
    datToken('token-gia-lap');
    renderVoiRouter([{ element: <CongDonViLayout />, children: [{ path: '/trang-chu', element: <div /> }] }], {
      initialEntries: ['/trang-chu'],
    });
  }

  it('menu có "Chương trình / Đợt" cho quan_tri', async () => {
    renderLayout('quan_tri');
    const menu = await screen.findByRole('navigation', { name: 'Menu Cổng đơn vị' });
    await waitFor(() =>
      expect(within(menu).getByRole('link', { name: 'Chương trình / Đợt' })).toHaveAttribute(
        'href',
        '/quan-tri/dot-trien-khai',
      ),
    );
  });

  it('menu không có "Chương trình / Đợt" cho trường', async () => {
    renderLayout('truong');
    const menu = await screen.findByRole('navigation', { name: 'Menu Cổng đơn vị' });
    await screen.findByText(String(db.hoSo.ma_dinh_danh_moet));
    expect(within(menu).queryByRole('link', { name: 'Chương trình / Đợt' })).not.toBeInTheDocument();
  });

  it('trường mở /quan-tri/dot-trien-khai → trang 404, không gọi API đợt', async () => {
    let daGoi = false;
    server.use(
      http.get(URL, () => {
        daGoi = true;
        return HttpResponse.json([]);
      }),
    );
    db.nguoiDung.vai_tro = 'truong';
    datToken('token-gia-lap');
    renderVoiRouter(routesCongDonVi, { initialEntries: ['/quan-tri/dot-trien-khai'] });
    expect(await screen.findByText('Không tìm thấy trang')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tạo đợt' })).not.toBeInTheDocument();
    expect(daGoi).toBe(false);
  });

  it('quan_tri mở /quan-tri/dot-trien-khai trong khung Cổng đơn vị → thấy trang', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    datToken('token-gia-lap');
    renderVoiRouter(routesCongDonVi, { initialEntries: ['/quan-tri/dot-trien-khai'] });
    expect(await screen.findByRole('heading', { name: 'Chương trình / Đợt' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Menu Cổng đơn vị' })).toBeInTheDocument();
  });
});
