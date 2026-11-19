import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { db } from '@/test/mocks/db';
import { congDonVi } from '@/content/congDonVi';
import { routesCongDonVi } from '@/router';
import CongDonViLayout from './CongDonViLayout';
import TrangChuCongDonVi from './TrangChuCongDonVi';
import HuongDanCongDonVi from './HuongDanCongDonVi';

// router.tsx tạo createBrowserRouter ngay khi import — thay bằng hàm rỗng để test chỉ dùng mảng route.
vi.mock('react-router-dom', async (goc) => ({
  ...(await goc<typeof import('react-router-dom')>()),
  createBrowserRouter: vi.fn(),
}));

beforeEach(() => vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', window.location.hostname));
afterEach(() => vi.unstubAllEnvs());

describe('CongDonViLayout', () => {
  it('hiện tên cổng, tên tài khoản, nút Đăng xuất; menu đúng 2 mục Trang chủ, Hướng dẫn; đặt document.title', async () => {
    db.nguoiDung.vai_tro = 'truong';
    datToken('token-gia-lap');
    renderVoiRouter(
      [{ element: <CongDonViLayout />, children: [{ path: '/trang-chu', element: <TrangChuCongDonVi /> }] }],
      { initialEntries: ['/trang-chu'] },
    );
    expect(await screen.findByText(congDonVi.tenCong)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeInTheDocument();
    const menu = screen.getByRole('navigation', { name: 'Menu Cổng đơn vị' });
    const lienKet = within(menu).getAllByRole('link');
    expect(lienKet.map((a) => a.textContent)).toEqual(['Trang chủ', 'Hướng dẫn']);
    expect(lienKet.map((a) => a.getAttribute('href'))).toEqual(['/trang-chu', '/huong-dan']);
    expect(document.title).toBe(congDonVi.tenCong);
  });
});

describe('TrangChuCongDonVi', () => {
  // Issue #60: trường có trang chủ riêng (TrangChuTruong.test.tsx); trang tạm còn cho Sở/Phòng/Quản trị.
  it('chào theo tên tài khoản, báo chức năng sắp có, có link Hướng dẫn', async () => {
    db.nguoiDung.vai_tro = 'so_gddt';
    datToken('token-gia-lap');
    renderVoiRouter([{ path: '/trang-chu', element: <TrangChuCongDonVi /> }], { initialEntries: ['/trang-chu'] });
    expect(await screen.findByText(new RegExp(`Xin chào, ${db.hoSo.ma_dinh_danh_moet}`))).toBeInTheDocument();
    expect(screen.getByText(/sắp có/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Hướng dẫn/ })).toHaveAttribute('href', '/huong-dan');
  });
});

describe('HuongDanCongDonVi', () => {
  it('hiện đủ mọi bước trong file nội dung, theo thứ tự (danh sách có thứ tự)', () => {
    renderVoiRouter([{ path: '/huong-dan', element: <HuongDanCongDonVi /> }], { initialEntries: ['/huong-dan'] });
    expect(screen.getByRole('heading', { level: 1, name: 'Hướng dẫn sử dụng' })).toBeInTheDocument();
    const ds = screen.getByRole('list');
    expect(ds.tagName).toBe('OL');
    const buoc = within(ds).getAllByRole('listitem');
    expect(buoc).toHaveLength(congDonVi.huongDan.length);
    congDonVi.huongDan.forEach((b, i) => {
      expect(within(buoc[i]).getByRole('heading', { name: b.tieuDe })).toBeInTheDocument();
      expect(within(buoc[i]).getByText(b.noiDung)).toBeInTheDocument();
    });
  });

  it('chưa đăng nhập → lối quay lại /dang-nhap', async () => {
    renderVoiRouter([{ path: '/huong-dan', element: <HuongDanCongDonVi /> }], { initialEntries: ['/huong-dan'] });
    expect(await screen.findByRole('link', { name: 'Về trang đăng nhập' })).toHaveAttribute('href', '/dang-nhap');
  });

  it('đã đăng nhập → lối quay lại /trang-chu', async () => {
    db.nguoiDung.vai_tro = 'truong';
    datToken('token-gia-lap');
    renderVoiRouter([{ path: '/huong-dan', element: <HuongDanCongDonVi /> }], { initialEntries: ['/huong-dan'] });
    expect(await screen.findByRole('link', { name: 'Về trang chủ' })).toHaveAttribute('href', '/trang-chu');
  });
});

describe('routesCongDonVi', () => {
  it.each(['/toi', '/admin/tong-quan', '/ho-tro', '/giang-day'])('%s (route NLS) → trang 404', async (duongDan) => {
    db.nguoiDung.vai_tro = 'truong';
    datToken('token-gia-lap');
    renderVoiRouter(routesCongDonVi, { initialEntries: [duongDan] });
    expect(await screen.findByText('Không tìm thấy trang')).toBeInTheDocument();
  });

  it('/ chưa đăng nhập → màn đăng nhập Cổng đơn vị', async () => {
    renderVoiRouter(routesCongDonVi, { initialEntries: ['/'] });
    expect(await screen.findByLabelText('Tên tài khoản')).toBeInTheDocument();
  });

  it('/ đã đăng nhập (trường) → Trang chủ trường (U1) trong khung Cổng đơn vị', async () => {
    db.nguoiDung.vai_tro = 'truong';
    datToken('token-gia-lap');
    renderVoiRouter(routesCongDonVi, { initialEntries: ['/'] });
    expect(await screen.findByRole('heading', { level: 1, name: 'Việc cần làm' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Menu Cổng đơn vị' })).toBeInTheDocument();
  });

  it('/trang-chu với học viên đã đăng nhập → TrangSaiCong', async () => {
    db.nguoiDung.vai_tro = 'hoc_vien';
    datToken('token-gia-lap');
    renderVoiRouter(routesCongDonVi, { initialEntries: ['/trang-chu'] });
    expect(await screen.findByText(/Tài khoản này dùng trên trang Bồi dưỡng năng lực số/)).toBeInTheDocument();
  });

  it('/huong-dan công khai trên Cổng đơn vị', async () => {
    renderVoiRouter(routesCongDonVi, { initialEntries: ['/huong-dan'] });
    expect(await screen.findByRole('heading', { level: 1, name: 'Hướng dẫn sử dụng' })).toBeInTheDocument();
  });
});
