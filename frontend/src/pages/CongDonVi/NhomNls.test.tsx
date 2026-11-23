import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { db } from '@/test/mocks/db';
import { routesCongDonVi } from '@/router';
import AdminDanhSach from '@/pages/Admin/AdminDanhSach';
import { DUONG_DAN_ADMIN, DUONG_DAN_NLS, DuongDanAdminProvider } from '@/pages/Admin/duongDanAdmin';
import CongDonViLayout from './CongDonViLayout';
import TrangChuCongDonVi from './TrangChuCongDonVi';

// Issue #70 / ADR 0015 P1: nhóm menu NLS trên Cổng đơn vị = 4 màn dùng chung với /admin/* của boiduongnls.

// router.tsx tạo createBrowserRouter ngay khi import — thay bằng hàm rỗng để test chỉ dùng mảng route.
vi.mock('react-router-dom', async (goc) => ({
  ...(await goc<typeof import('react-router-dom')>()),
  createBrowserRouter: vi.fn(),
}));

beforeEach(() => vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', window.location.hostname));
afterEach(() => vi.unstubAllEnvs());

// Trang lazy (Admin*) nạp chậm lần đầu / khi cả bộ chạy song song. Data router nạp `lazy` của mọi route khớp
// trước khi render — kể cả khi guard trả 404 — nên test 404 cũng phải chờ chunk của trang.
const CHO_LAU = { timeout: 20000 };
const TEST_LAU = { timeout: 30000 };

/** Ghi số lần gọi GET /cong-don-vi/toi/chuong-trinh, trả `ketQua` (hoặc 500 khi 'loi'). */
function giaLapChuongTrinh(ketQua: boolean | 'loi') {
  const goi = { soLan: 0 };
  server.use(
    http.get('/cong-don-vi/toi/chuong-trinh', () => {
      goi.soLan += 1;
      if (ketQua === 'loi') {
        return HttpResponse.json({ error: { code: 'INTERNAL', message: 'Lỗi' } }, { status: 500 });
      }
      return HttpResponse.json({ nls: ketQua });
    }),
  );
  return goi;
}

function dangNhap(vaiTro: string) {
  db.nguoiDung.vai_tro = vaiTro;
  datToken('token-gia-lap');
}

function renderLayout() {
  return renderVoiRouter(
    [{ element: <CongDonViLayout />, children: [{ path: '/trang-chu', element: <TrangChuCongDonVi /> }] }],
    { initialEntries: ['/trang-chu'] },
  );
}

const menu = () => screen.getByRole('navigation', { name: 'Menu Cổng đơn vị' });

describe('duongDanAdmin — đường dẫn 4 màn theo cổng', () => {
  it('mặc định /admin (khoa-boi-duong), Cổng đơn vị /nls (khoa)', () => {
    expect(DUONG_DAN_ADMIN.tongQuan()).toBe('/admin/tong-quan');
    expect(DUONG_DAN_ADMIN.hocVien()).toBe('/admin/hoc-vien');
    expect(DUONG_DAN_ADMIN.hocVien('hv-1')).toBe('/admin/hoc-vien/hv-1');
    expect(DUONG_DAN_ADMIN.khoa()).toBe('/admin/khoa-boi-duong');
    expect(DUONG_DAN_ADMIN.khoa('k-1')).toBe('/admin/khoa-boi-duong/k-1');
    expect(DUONG_DAN_ADMIN.baoCao()).toBe('/admin/bao-cao');
    expect(DUONG_DAN_NLS.tongQuan()).toBe('/nls/tong-quan');
    expect(DUONG_DAN_NLS.hocVien('hv-1')).toBe('/nls/hoc-vien/hv-1');
    expect(DUONG_DAN_NLS.khoa()).toBe('/nls/khoa');
    expect(DUONG_DAN_NLS.khoa('k-1')).toBe('/nls/khoa/k-1');
    expect(DUONG_DAN_NLS.baoCao()).toBe('/nls/bao-cao');
  });
});

describe('Menu nhóm NLS (CongDonViLayout)', () => {
  it('trường có NLS → nhóm "NLS" với 4 liên kết /nls/…, sau Hồ sơ đơn vị, trước Hướng dẫn (issue #71 / P1)', async () => {
    giaLapChuongTrinh(true);
    dangNhap('truong');
    renderLayout();
    const nhom = await within(await screen.findByRole('navigation', { name: 'Menu Cổng đơn vị' })).findByRole('group', {
      name: 'NLS',
    });
    const lienKet = within(nhom).getAllByRole('link');
    expect(lienKet.map((a) => a.textContent)).toEqual(['Tổng quan', 'Học viên', 'Khóa', 'Báo cáo']);
    expect(lienKet.map((a) => a.getAttribute('href'))).toEqual([
      '/nls/tong-quan',
      '/nls/hoc-vien',
      '/nls/khoa',
      '/nls/bao-cao',
    ]);
    expect(
      within(menu())
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['Trang chủ', 'Hồ sơ đơn vị', 'Tổng quan', 'Học viên', 'Khóa', 'Báo cáo', 'Hướng dẫn']);
  });

  it('trường chỉ HSG (nls=false) → không có nhóm NLS, menu giữ nguyên', async () => {
    const goi = giaLapChuongTrinh(false);
    dangNhap('truong');
    renderLayout();
    await screen.findByRole('navigation', { name: 'Menu Cổng đơn vị' });
    await waitFor(() => expect(goi.soLan).toBe(1));
    expect(within(menu()).queryByRole('group', { name: 'NLS' })).not.toBeInTheDocument();
    expect(
      within(menu())
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['Trang chủ', 'Hồ sơ đơn vị', 'Hướng dẫn']);
  });

  it('Sở có NLS → có nhóm NLS', async () => {
    giaLapChuongTrinh(true);
    dangNhap('so_gddt');
    renderLayout();
    expect(
      await within(await screen.findByRole('navigation', { name: 'Menu Cổng đơn vị' })).findByRole('group', {
        name: 'NLS',
      }),
    ).toBeInTheDocument();
  });

  it('Phòng có NLS → có nhóm NLS', async () => {
    giaLapChuongTrinh(true);
    dangNhap('phong_vhxh');
    renderLayout();
    expect(await screen.findByRole('group', { name: 'NLS' })).toBeInTheDocument();
  });

  it('API lỗi → ẩn nhóm NLS (không chặn menu)', async () => {
    const goi = giaLapChuongTrinh('loi');
    dangNhap('truong');
    renderLayout();
    await screen.findByRole('navigation', { name: 'Menu Cổng đơn vị' });
    await waitFor(() => expect(goi.soLan).toBeGreaterThan(0));
    expect(screen.queryByRole('group', { name: 'NLS' })).not.toBeInTheDocument();
    expect(within(menu()).getByRole('link', { name: 'Trang chủ' })).toBeInTheDocument();
  });

  it('quan_tri → không có nhóm NLS và không gọi API chương trình', async () => {
    const goi = giaLapChuongTrinh(true);
    dangNhap('quan_tri');
    renderLayout();
    expect(await screen.findByRole('link', { name: 'Tiến độ đợt' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'NLS' })).not.toBeInTheDocument();
    expect(goi.soLan).toBe(0);
  });
});

describe('Guard /nls/* (ChiDonViNls)', TEST_LAU, () => {
  it('đơn vị nls=false mở /nls/hoc-vien → 404, không gọi API học viên', async () => {
    giaLapChuongTrinh(false);
    const goiHocVien = { soLan: 0 };
    server.use(
      http.get('/hoc-vien', () => {
        goiHocVien.soLan += 1;
        return HttpResponse.json({ data: [], total: 0, page: 1, page_size: 20 });
      }),
    );
    dangNhap('truong');
    renderVoiRouter(routesCongDonVi, { initialEntries: ['/nls/hoc-vien'] });
    expect(await screen.findByText('Không tìm thấy trang', undefined, CHO_LAU)).toBeInTheDocument();
    expect(goiHocVien.soLan).toBe(0);
  });

  it('quan_tri mở /nls/tong-quan → 404, không gọi API chương trình', async () => {
    const goi = giaLapChuongTrinh(true);
    dangNhap('quan_tri');
    renderVoiRouter(routesCongDonVi, { initialEntries: ['/nls/tong-quan'] });
    expect(await screen.findByText('Không tìm thấy trang', undefined, CHO_LAU)).toBeInTheDocument();
    expect(goi.soLan).toBe(0);
  });

  it('API chương trình lỗi → 404', async () => {
    giaLapChuongTrinh('loi');
    dangNhap('so_gddt');
    renderVoiRouter(routesCongDonVi, { initialEntries: ['/nls/bao-cao'] });
    expect(await screen.findByText('Không tìm thấy trang', undefined, CHO_LAU)).toBeInTheDocument();
  });
});

describe('Seam đường dẫn trên AdminDanhSach', () => {
  function renderDanhSach(goc: '/admin' | '/nls') {
    datToken('token-gia-lap');
    const trang = <AdminDanhSach />;
    return renderVoiRouter(
      [
        {
          path: `${goc}/hoc-vien`,
          element:
            goc === '/nls' ? <DuongDanAdminProvider value={DUONG_DAN_NLS}>{trang}</DuongDanAdminProvider> : trang,
        },
        { path: `${goc}/hoc-vien/:id`, element: <div>Chi tiết {goc}</div> },
      ],
      { initialEntries: [`${goc}/hoc-vien`] },
    );
  }

  it('dưới /nls: bấm 1 dòng → /nls/hoc-vien/{id}', async () => {
    const user = userEvent.setup();
    const { router } = renderDanhSach('/nls');
    await user.click(await screen.findByText('Lê Văn Bình'));
    expect(await screen.findByText('Chi tiết /nls')).toBeInTheDocument();
    expect(router.state.location.pathname).toMatch(/^\/nls\/hoc-vien\/[^/]+$/);
  });

  it('mặc định (không Provider): bấm 1 dòng → /admin/hoc-vien/{id}', async () => {
    const user = userEvent.setup();
    const { router } = renderDanhSach('/admin');
    await user.click(await screen.findByText('Lê Văn Bình'));
    expect(await screen.findByText('Chi tiết /admin')).toBeInTheDocument();
    expect(router.state.location.pathname).toMatch(/^\/admin\/hoc-vien\/[^/]+$/);
  });
});

describe('Route /nls/* trên Cổng đơn vị (nls=true)', TEST_LAU, () => {
  beforeEach(() => {
    giaLapChuongTrinh(true);
    dangNhap('truong');
  });

  it('/nls → chuyển /nls/tong-quan (Tổng quan) trong khung Cổng đơn vị', async () => {
    const { router } = renderVoiRouter(routesCongDonVi, { initialEntries: ['/nls'] });
    expect(await screen.findByText('Tổng quan hệ thống', undefined, CHO_LAU)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/nls/tong-quan');
    expect(screen.getByRole('navigation', { name: 'Menu Cổng đơn vị' })).toBeInTheDocument();
    expect(await screen.findByTestId('kpi-tham-gia', undefined, CHO_LAU)).toBeInTheDocument();
  });

  it('/nls/hoc-vien → danh sách học viên; bấm dòng → /nls/hoc-vien/{id} (chi tiết)', async () => {
    const user = userEvent.setup();
    const { router } = renderVoiRouter(routesCongDonVi, { initialEntries: ['/nls/hoc-vien'] });
    await user.click(await screen.findByText('Lê Văn Bình', undefined, CHO_LAU));
    expect(await screen.findByText('Chi tiết hồ sơ học viên', undefined, CHO_LAU)).toBeInTheDocument();
    expect(router.state.location.pathname).toMatch(/^\/nls\/hoc-vien\/[^/]+$/);
  });

  it('/nls/hoc-vien/:id → chi tiết hồ sơ học viên', async () => {
    renderVoiRouter(routesCongDonVi, { initialEntries: ['/nls/hoc-vien/hv-duyet-1'] });
    expect(await screen.findByText('Chi tiết hồ sơ học viên', undefined, CHO_LAU)).toBeInTheDocument();
    expect(await screen.findByText('Bồi dưỡng NLS – Mức cơ bản', undefined, CHO_LAU)).toBeInTheDocument();
  });

  it('/nls/khoa → danh sách khóa; bấm dòng → /nls/khoa/{id}', async () => {
    const user = userEvent.setup();
    const { router } = renderVoiRouter(routesCongDonVi, { initialEntries: ['/nls/khoa'] });
    expect(await screen.findByText('Khóa bồi dưỡng', undefined, CHO_LAU)).toBeInTheDocument();
    await user.click(await screen.findByText('Bồi dưỡng NLS – Mức cơ bản', undefined, CHO_LAU));
    expect(await screen.findByText('Chi tiết khóa bồi dưỡng', undefined, CHO_LAU)).toBeInTheDocument();
    expect(router.state.location.pathname).toMatch(/^\/nls\/khoa\/[^/]+$/);
  });

  it('/nls/khoa/:id → chi tiết khóa, breadcrumb về /nls/khoa', async () => {
    renderVoiRouter(routesCongDonVi, { initialEntries: ['/nls/khoa/khoa-1'] });
    expect(await screen.findByText('Bồi dưỡng NLS – Mức cơ bản', undefined, CHO_LAU)).toBeInTheDocument();
    const main = screen.getByRole('main');
    expect(within(main).getByRole('link', { name: 'Khóa bồi dưỡng' })).toHaveAttribute('href', '/nls/khoa');
  });

  it('/nls/bao-cao → Trung tâm báo cáo', async () => {
    renderVoiRouter(routesCongDonVi, { initialEntries: ['/nls/bao-cao'] });
    expect(await screen.findByText('Trung tâm báo cáo', undefined, CHO_LAU)).toBeInTheDocument();
  });
});
