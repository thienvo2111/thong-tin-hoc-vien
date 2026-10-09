import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('tài khoản trường (don_vi_co_dinh) → không có khối Tiến độ theo trường, không gọi API', async () => {
    let daGoi = false;
    server.use(
      http.get('/thong-ke/bo-loc', () =>
        HttpResponse.json({
          khoa: [],
          don_vi: null,
          cum: null,
          don_vi_co_dinh: { id: 'dv-2', ten_don_vi: 'Trường THPT Long Xuyên' },
        }),
      ),
      http.get('/thong-ke/tien-do-truong', () => {
        daGoi = true;
        return HttpResponse.json([]);
      }),
    );
    renderDashboard();
    expect(await screen.findByRole('region', { name: 'Cần đôn đốc' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Tiến độ theo trường' })).not.toBeInTheDocument();
    expect(daGoi).toBe(false);
    // Chất lượng hồ sơ hiện cho cả tài khoản trường.
    expect(await screen.findByRole('region', { name: 'Chất lượng hồ sơ' })).toBeInTheDocument();
  });

  it('admin → khối Chất lượng hồ sơ nằm ngay sau Tiến độ theo trường', async () => {
    renderDashboard();
    const tienDo = await screen.findByRole('region', { name: 'Tiến độ theo trường' });
    const chatLuong = await screen.findByRole('region', { name: 'Chất lượng hồ sơ' });
    expect(tienDo.nextElementSibling).toBe(chatLuong);
  });

  it('khối Đánh giá NLS theo mức nằm ngay sau Kết quả khảo sát', async () => {
    renderDashboard();
    const khaoSat = await screen.findByRole('region', { name: 'Kết quả khảo sát' });
    const muc = await screen.findByRole('region', { name: 'Đánh giá NLS thực tế theo mức — theo trường' });
    expect(khaoSat.nextElementSibling).toBe(muc);
  });

  it('tài khoản trường (đơn vị cố định) vẫn thấy khối Đánh giá NLS theo mức', async () => {
    server.use(
      http.get('/thong-ke/bo-loc', () =>
        HttpResponse.json({
          khoa: [],
          don_vi: null,
          cum: null,
          don_vi_co_dinh: { id: 'dv-2', ten_don_vi: 'Trường THPT Long Xuyên' },
        }),
      ),
    );
    renderDashboard();
    expect(await screen.findByRole('region', { name: 'Đánh giá NLS thực tế theo mức — theo trường' })).toBeInTheDocument();
  });

  it('admin → có khối Tiến độ theo trường', async () => {
    renderDashboard();
    expect(await screen.findByRole('region', { name: 'Tiến độ theo trường' })).toBeInTheDocument();
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

  it('doi_tuong trên URL được gửi kèm request của các khối', async () => {
    const goi: Record<string, string | null> = {};
    const ghi = (ten: string) =>
      http.get(`/thong-ke/${ten}`, ({ request }) => {
        goi[ten] = new URL(request.url).searchParams.get('doi_tuong');
        return undefined;
      });
    server.use(ghi('pheu'), ghi('khao-sat'), ghi('chuyen-can'), ghi('tien-do-truong'));
    renderDashboard('/thong-ke?doi_tuong=nhan_vien');
    await waitFor(() => {
      for (const ten of ['pheu', 'khao-sat', 'chuyen-can', 'tien-do-truong']) expect(goi[ten]).toBe('nhan_vien');
    });
  });

  it('403 ngoài phạm vi: xóa khoa/đơn vị nhưng giữ doi_tuong', async () => {
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
    const r = renderDashboard('/thong-ke?khoa_id=khoa-ngoai&doi_tuong=giao_vien');
    await waitFor(() => expect(r.router.state.location.search).toBe('?doi_tuong=giao_vien'));
  });
  it('nút Xuất biểu mẫu ĐK & truy cập gửi bộ lọc hiện tại và kích hoạt tải file', async () => {
    let url: URL | null = null;
    server.use(
      http.get('/thong-ke/bieu-mau/dang-ky-truy-cap/xuat-excel', ({ request }) => {
        url = new URL(request.url);
        return new HttpResponse('x', { headers: { 'Content-Type': 'application/octet-stream' } });
      }),
    );
    URL.createObjectURL = vi.fn(() => 'blob:gia-lap');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderDashboard('/thong-ke?khoa_id=khoa-1&doi_tuong=giao_vien');
    await userEvent.click(await screen.findByRole('button', { name: 'Xuất biểu mẫu ĐK & truy cập' }));
    await waitFor(() => expect((url as URL | null)?.searchParams.get('khoa_id')).toBe('khoa-1'));
    expect((url as URL | null)?.searchParams.get('doi_tuong')).toBe('giao_vien');
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('nút Xuất biểu mẫu có ở chế độ ho_tro', async () => {
    renderDashboard('/thong-ke', 'ho_tro');
    expect(await screen.findByRole('button', { name: 'Xuất biểu mẫu ĐK & truy cập' })).toBeInTheDocument();
  });
});
