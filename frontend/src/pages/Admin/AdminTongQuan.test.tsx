import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import AdminTongQuan from './AdminTongQuan';

function renderTrang(url = '/admin/tong-quan') {
  datToken('token-gia-lap');
  return renderVoiRouter([{ path: '/admin/tong-quan', element: <AdminTongQuan /> }], {
    initialEntries: [url],
  });
}

describe('Admin — Tổng quan (dashboard thống kê)', () => {
  it('render bộ lọc + thẻ "Tham gia"', async () => {
    renderTrang();
    expect(await screen.findByRole('textbox', { name: 'Khóa' })).toBeInTheDocument();
    expect(await screen.findByTestId('kpi-tham-gia')).toBeInTheDocument();
  });

  // Xếp hạng nằm ở tab "Học tập" (dashboard chia tab 2026-10-09).
  it('che_do admin → tab Học tập có khối "Xếp hạng đơn vị"', async () => {
    renderTrang('/admin/tong-quan?tab=hoc_tap');
    expect(await screen.findByRole('region', { name: 'Xếp hạng đơn vị' })).toBeInTheDocument();
  });
});
