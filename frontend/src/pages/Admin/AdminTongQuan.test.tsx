import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import AdminTongQuan from './AdminTongQuan';

function renderTrang() {
  datToken('token-gia-lap');
  return renderVoiRouter([{ path: '/admin/tong-quan', element: <AdminTongQuan /> }], {
    initialEntries: ['/admin/tong-quan'],
  });
}

describe('Admin — Tổng quan (dashboard thống kê)', () => {
  it('render bộ lọc + thẻ "Tham gia"', async () => {
    renderTrang();
    expect(await screen.findByRole('textbox', { name: 'Khóa' })).toBeInTheDocument();
    expect(await screen.findByTestId('kpi-tham-gia')).toBeInTheDocument();
  });

  it('che_do admin → có khối "Xếp hạng đơn vị"', async () => {
    renderTrang();
    expect(await screen.findByRole('region', { name: 'Xếp hạng đơn vị' })).toBeInTheDocument();
  });
});
