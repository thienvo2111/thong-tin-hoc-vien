import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderVoiRouter } from '@/test/testUtils';
import XacMinhEmail from './XacMinhEmail';

const routes = [
  { path: '/xac-minh-email', element: <XacMinhEmail /> },
  { path: '/dang-nhap', element: <div>Màn hình đăng nhập</div> },
];

describe('M1 — Xác minh email', () => {
  it('không có token trên URL → báo lỗi ngay, không gọi API', async () => {
    let daGoi = false;
    server.use(
      http.post('/auth/xac-minh-email', () => {
        daGoi = true;
        return HttpResponse.json({ da_xac_minh: true });
      }),
    );
    renderVoiRouter(routes, { initialEntries: ['/xac-minh-email'] });

    expect(await screen.findByText('Liên kết không hợp lệ hoặc đã hết hạn')).toBeInTheDocument();
    expect(daGoi).toBe(false);
  });

  it('đang gọi API → hiện trạng thái đang xác minh', async () => {
    renderVoiRouter(routes, { initialEntries: ['/xac-minh-email?token=token-hop-le'] });

    expect(screen.getByText('Đang xác minh email...')).toBeInTheDocument();
  });

  it('token hợp lệ → xác minh thành công, có lối về đăng nhập (chưa đăng nhập)', async () => {
    renderVoiRouter(routes, { initialEntries: ['/xac-minh-email?token=token-hop-le'] });

    expect(await screen.findByText('Đã xác minh email thành công.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Đăng nhập' })).toHaveAttribute('href', '/dang-nhap');
  });

  it('token sai/hết hạn → hiện lỗi chung + gợi ý vào Hồ sơ gửi lại email, có lối về đăng nhập', async () => {
    renderVoiRouter(routes, { initialEntries: ['/xac-minh-email?token=token-sai'] });

    expect(await screen.findByText('Liên kết không hợp lệ hoặc đã hết hạn')).toBeInTheDocument();
    expect(screen.getByText(/Gửi lại email xác minh/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Đăng nhập' })).toHaveAttribute('href', '/dang-nhap');
  });
});
