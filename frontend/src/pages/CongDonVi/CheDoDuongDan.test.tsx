import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { RouterProvider } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { MAT_KHAU_TAI_KHOAN_KHAC } from '@/test/mocks/handlers';
import { db } from '@/test/mocks/db';
import { datToken } from '@/auth/tokenStore';
import { theme } from '@/theme';

// Tạm khi chưa có tên miền riêng (ADR 0015 T7): Cổng đơn vị ở https://<NLS>/cdv/... — cùng bản build, router thật
// (router.tsx đọc env + window.location lúc import) với basename '/cdv'. Mỗi test nạp lại module để router được tạo
// đúng URL bắt đầu; mọi module ứng dụng phải import động SAU vi.resetModules() để dùng chung 1 AuthContext.

type BoDinhTuyen = Awaited<typeof import('@/router')>['router'];
let routerDangMo: BoDinhTuyen | null = null;

// Data router nạp `lazy` của route khớp trước khi render; chạy cả bộ song song thì lần nạp đầu chậm.
const CHO_LAU = { timeout: 20000 };
const TEST_LAU = { timeout: 30000 };

afterEach(() => {
  routerDangMo?.dispose();
  routerDangMo = null;
  vi.unstubAllEnvs();
  window.history.replaceState(null, '', '/');
});

function batCheDoDuongDan({ urlCong = '', urlNls = '' } = {}) {
  vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', '');
  vi.stubEnv('VITE_CONG_DON_VI_DUONG_DAN', '/cdv');
  vi.stubEnv('VITE_CONG_DON_VI_URL', urlCong);
  vi.stubEnv('VITE_SITE_URL', urlNls);
}

function dangNhapSan(vaiTro: string) {
  db.nguoiDung.vai_tro = vaiTro;
  datToken('token-gia-lap');
}

async function moUngDung(duongDan: string) {
  window.history.replaceState(null, '', duongDan);
  vi.resetModules();
  const [{ router }, { AuthProvider }] = await Promise.all([import('@/router'), import('@/auth/AuthContext')]);
  routerDangMo = router;
  render(
    <MantineProvider theme={theme} defaultColorScheme="light">
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </MantineProvider>,
  );
  return router;
}

const menuCong = () => screen.getByRole('navigation', { name: 'Menu Cổng đơn vị' });

describe('Cổng đơn vị ở /cdv (chế độ đường dẫn)', () => {
  it(
    '/cdv/dang-nhap → màn đăng nhập Cổng đơn vị; trường đăng nhập → /cdv/trang-chu',
    async () => {
      batCheDoDuongDan();
      await moUngDung('/cdv/dang-nhap');
      const user = userEvent.setup();
      await user.type(await screen.findByLabelText('Tên tài khoản', {}, CHO_LAU), 'truong-mau');
      expect(screen.queryByLabelText('Tên tài khoản hoặc mã định danh MOET')).not.toBeInTheDocument();
      await user.type(screen.getByLabelText('Mật khẩu'), MAT_KHAU_TAI_KHOAN_KHAC);
      await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
      expect(await screen.findByRole('heading', { level: 1, name: 'Việc cần làm' }, CHO_LAU)).toBeInTheDocument();
      expect(window.location.pathname).toBe('/cdv/trang-chu');
    },
    TEST_LAU,
  );

  it(
    '/cdv (không "/" cuối) chưa đăng nhập → /cdv/dang-nhap',
    async () => {
      batCheDoDuongDan();
      await moUngDung('/cdv');
      expect(await screen.findByLabelText('Tên tài khoản', {}, CHO_LAU)).toBeInTheDocument();
      expect(window.location.pathname).toBe('/cdv/dang-nhap');
    },
    TEST_LAU,
  );

  it(
    'trường có NLS: menu (kể cả nhóm NLS) đều nằm dưới /cdv; bấm "Tổng quan" → /cdv/nls/tong-quan',
    async () => {
      batCheDoDuongDan();
      server.use(http.get('/cong-don-vi/toi/chuong-trinh', () => HttpResponse.json({ nls: true })));
      dangNhapSan('truong');
      await moUngDung('/cdv/trang-chu');
      const nhomNls = await within(
        await screen.findByRole('navigation', { name: 'Menu Cổng đơn vị' }, CHO_LAU),
      ).findByRole('link', { name: 'Tổng quan' }, CHO_LAU);
      expect(nhomNls).toHaveAttribute('href', '/cdv/nls/tong-quan');
      for (const a of within(menuCong()).getAllByRole('link')) {
        expect(a.getAttribute('href')).toMatch(/^\/cdv\//);
      }
      await userEvent.setup().click(nhomNls);
      await waitFor(() => expect(window.location.pathname).toBe('/cdv/nls/tong-quan'), CHO_LAU);
    },
    TEST_LAU,
  );

  it(
    'quản trị: mục quản trị nằm dưới /cdv; bấm "Tiến độ đợt" → /cdv/quan-tri/tien-do-dot',
    async () => {
      batCheDoDuongDan();
      dangNhapSan('quan_tri');
      await moUngDung('/cdv/trang-chu');
      const lienKet = await within(
        await screen.findByRole('navigation', { name: 'Menu Cổng đơn vị' }, CHO_LAU),
      ).findByRole('link', { name: 'Tiến độ đợt' });
      expect(lienKet).toHaveAttribute('href', '/cdv/quan-tri/tien-do-dot');
      await userEvent.setup().click(lienKet);
      await waitFor(() => expect(window.location.pathname).toBe('/cdv/quan-tri/tien-do-dot'), CHO_LAU);
    },
    TEST_LAU,
  );

  it(
    'API trả 401 giữa phiên → về /cdv/dang-nhap (màn đăng nhập của Cổng đơn vị)',
    async () => {
      batCheDoDuongDan();
      server.use(
        http.get('/cong-don-vi/toi/chuong-trinh', () =>
          HttpResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Hết phiên' } }, { status: 401 }),
        ),
      );
      dangNhapSan('truong');
      await moUngDung('/cdv/trang-chu');
      await waitFor(() => expect(window.location.pathname).toBe('/cdv/dang-nhap'), CHO_LAU);
      expect(await screen.findByLabelText('Tên tài khoản', {}, CHO_LAU)).toBeInTheDocument();
    },
    TEST_LAU,
  );

  it(
    'P3: học viên trong /cdv → báo dùng trang NLS, link về origin (thiếu VITE_SITE_URL)',
    async () => {
      batCheDoDuongDan();
      dangNhapSan('hoc_vien');
      await moUngDung('/cdv/trang-chu');
      expect(
        await screen.findByText(/Tài khoản này dùng trên trang Bồi dưỡng năng lực số/, {}, CHO_LAU),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Bồi dưỡng năng lực số/ })).toHaveAttribute(
        'href',
        window.location.origin,
      );
    },
    TEST_LAU,
  );

  it(
    'P3: tài khoản trường ở trang đăng nhập NLS (/dang-nhap) → báo + link sang /cdv',
    async () => {
      batCheDoDuongDan({ urlCong: 'https://boiduongnls.hcmue.edu.vn/cdv' });
      await moUngDung('/dang-nhap');
      const user = userEvent.setup();
      await user.type(await screen.findByLabelText('Tên tài khoản hoặc mã định danh MOET', {}, CHO_LAU), 'truong-mau');
      await user.type(screen.getByLabelText('Mật khẩu'), MAT_KHAU_TAI_KHOAN_KHAC);
      await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
      expect(await screen.findByText(/Tài khoản đơn vị đăng nhập tại Cổng đơn vị/, {}, CHO_LAU)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Cổng đơn vị/ })).toHaveAttribute(
        'href',
        'https://boiduongnls.hcmue.edu.vn/cdv',
      );
      expect(window.location.pathname).toBe('/dang-nhap');
    },
    TEST_LAU,
  );

  it(
    'tắt chế độ đường dẫn (biến trống, như VPS hiện nay) → /cdv/dang-nhap là trang 404 của NLS',
    async () => {
      vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', '');
      vi.stubEnv('VITE_CONG_DON_VI_DUONG_DAN', '');
      await moUngDung('/cdv/dang-nhap');
      expect(await screen.findByText('Không tìm thấy trang', {}, CHO_LAU)).toBeInTheDocument();
    },
    TEST_LAU,
  );
});
