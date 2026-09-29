import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { db } from '@/test/mocks/db';
import { RequireAdmin } from '@/auth/RequireAdmin';
import AdminTongQuan from './AdminTongQuan';

function renderVoiGuard(initialEntries = ['/admin/tong-quan']) {
  datToken('token-gia-lap');
  return renderVoiRouter(
    [
      {
        element: <RequireAdmin />,
        children: [{ path: '/admin/tong-quan', element: <AdminTongQuan /> }],
      },
      { path: '/toi', element: <div>Màn hình trang chủ học viên</div> },
    ],
    { initialEntries },
  );
}

describe('Admin — guard theo vai_tro', () => {
  it('vai_tro=hoc_vien truy cập /admin/* → redirect về /toi', async () => {
    db.nguoiDung.vai_tro = 'hoc_vien';
    renderVoiGuard();
    expect(await screen.findByText('Màn hình trang chủ học viên')).toBeInTheDocument();
    expect(screen.queryByText('Tổng quan hệ thống')).not.toBeInTheDocument();
  });

  it('vai_tro=quan_tri truy cập /admin/* → vào được, không bị redirect', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    renderVoiGuard();
    expect(await screen.findByText('Tổng quan hệ thống')).toBeInTheDocument();
  });

  it('vai_tro=truong (quản lý cấp trường) truy cập /admin/* → vào được', async () => {
    db.nguoiDung.vai_tro = 'truong';
    renderVoiGuard();
    expect(await screen.findByText('Tổng quan hệ thống')).toBeInTheDocument();
  });
});
