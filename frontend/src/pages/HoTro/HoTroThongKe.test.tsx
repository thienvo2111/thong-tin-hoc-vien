import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import HoTroLayout from './HoTroLayout';
import HoTroThongKe from './HoTroThongKe';

function renderTrang() {
  datToken('token-gia-lap');
  return renderVoiRouter(
    [{ element: <HoTroLayout />, children: [{ path: '/ho-tro/thong-ke', element: <HoTroThongKe /> }] }],
    { initialEntries: ['/ho-tro/thong-ke'] },
  );
}

describe('Người hỗ trợ — Thống kê', () => {
  it('không có khối "Xếp hạng đơn vị" nhưng có "Cần đôn đốc"', async () => {
    renderTrang();
    expect(await screen.findByRole('region', { name: 'Cần đôn đốc' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Xếp hạng đơn vị' })).not.toBeInTheDocument();
  });

  it('menu hỗ trợ có link "Thống kê" trỏ /ho-tro/thong-ke', async () => {
    renderTrang();
    const link = await screen.findByRole('link', { name: 'Thống kê' });
    expect(link).toHaveAttribute('href', '/ho-tro/thong-ke');
  });
});
