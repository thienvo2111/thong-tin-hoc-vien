import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import DashboardThongKe from './DashboardThongKe';

function renderDashboard(url = '/thong-ke') {
  datToken('token-gia-lap');
  return renderVoiRouter([{ path: '/thong-ke', element: <DashboardThongKe che_do="admin" /> }], {
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
});
