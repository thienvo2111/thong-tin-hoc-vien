import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import DashboardThongKe from './DashboardThongKe';

function renderDashboard(url = '/thong-ke', cheDo: 'admin' | 'ho_tro' = 'admin') {
  datToken('token-gia-lap');
  return renderVoiRouter([{ path: '/thong-ke', element: <DashboardThongKe che_do={cheDo} /> }], {
    initialEntries: [url],
  });
}

describe('DashboardThongKe', () => {
  it('render bộ lọc + khối KPI', async () => {
    renderDashboard();
    expect(await screen.findByTestId('kpi-tham-gia')).toBeInTheDocument();
    expect(await screen.findByRole('textbox', { name: 'Khóa' })).toBeInTheDocument();
  });

  it('403 từ khối → thông báo ngoài phạm vi + xóa bộ lọc khỏi URL', async () => {
    server.use(
      http.get('/thong-ke/pheu', ({ request }) =>
        new URL(request.url).searchParams.has('khoa_id')
          ? HttpResponse.json({ error: { code: 'FORBIDDEN', message: 'Cấm' } }, { status: 403 })
          : HttpResponse.json({
              tham_gia: 1,
              da_truy_cap: 1,
              khao_sat_ky_nang_so: 1,
              danh_gia_dau_vao: 1,
              danh_gia_dau_ra: 1,
              ho_so_cho_duyet: null,
            }),
      ),
    );
    const r = renderDashboard('/thong-ke?khoa_id=khoa-ngoai');
    expect(await screen.findByText('Bộ lọc nằm ngoài phạm vi quyền')).toBeInTheDocument();
    await waitFor(() => expect(r.router.state.location.search).toBe(''));
    expect(await screen.findByTestId('kpi-tham-gia')).toBeInTheDocument();
  });

  it('che_do admin → có khối Xếp hạng + Chuyên cần + Cần đôn đốc', async () => {
    renderDashboard();
    expect(await screen.findByRole('region', { name: 'Xếp hạng đơn vị' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Chuyên cần' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Cần đôn đốc' })).toBeInTheDocument();
  });

  it('che_do ho_tro → không render và không gọi API xếp hạng', async () => {
    let daGoi = false;
    server.use(
      http.get('/thong-ke/xep-hang', () => {
        daGoi = true;
        return HttpResponse.json({ kieu: 'bang', top: [], bottom: [], tong_so: 0 });
      }),
    );
    renderDashboard('/thong-ke', 'ho_tro');
    expect(await screen.findByRole('region', { name: 'Cần đôn đốc' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Xếp hạng đơn vị' })).not.toBeInTheDocument();
    expect(daGoi).toBe(false);
  });
});
