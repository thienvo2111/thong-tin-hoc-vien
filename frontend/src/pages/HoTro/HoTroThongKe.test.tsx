import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import HoTroLayout from './HoTroLayout';
import HoTroThongKe from './HoTroThongKe';

function renderTrang(url = '/ho-tro/thong-ke') {
  datToken('token-gia-lap');
  return renderVoiRouter(
    [{ element: <HoTroLayout />, children: [{ path: '/ho-tro/thong-ke', element: <HoTroThongKe /> }] }],
    { initialEntries: [url] },
  );
}

// Dashboard chia tab (2026-10-09): "Cần đôn đốc" ở tab Hồ sơ, "Xếp hạng" (chỉ admin) ở tab Học tập.
describe('Người hỗ trợ — Thống kê', () => {
  it('tab Hồ sơ & đôn đốc có khối "Cần đôn đốc"', async () => {
    renderTrang('/ho-tro/thong-ke?tab=ho_so');
    expect(await screen.findByRole('region', { name: 'Cần đôn đốc' })).toBeInTheDocument();
  });

  it('tab Học tập không có khối "Xếp hạng đơn vị"', async () => {
    renderTrang('/ho-tro/thong-ke?tab=hoc_tap');
    expect(await screen.findByRole('region', { name: 'Chuyên cần' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Xếp hạng đơn vị' })).not.toBeInTheDocument();
  });

  it('menu hỗ trợ có link "Thống kê" trỏ /ho-tro/thong-ke', async () => {
    renderTrang();
    const link = await screen.findByRole('link', { name: 'Thống kê' });
    expect(link).toHaveAttribute('href', '/ho-tro/thong-ke');
  });
});
