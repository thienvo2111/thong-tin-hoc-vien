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
  it('render bộ lọc + khối KPI (tab Tổng quan mặc định)', async () => {
    renderDashboard();
    expect(await screen.findByTestId('kpi-tham-gia')).toBeInTheDocument();
    expect(await screen.findByRole('textbox', { name: 'Khóa' })).toBeInTheDocument();
  });

  it('tab mặc định không hiện khối Nhu cầu mức học và không gọi API của nó', async () => {
    let daGoi = false;
    server.use(
      http.get('/thong-ke/nhu-cau-muc-hoc', () => {
        daGoi = true;
        return HttpResponse.json({ error: { code: 'INTERNAL', message: 'không nên gọi' } }, { status: 500 });
      }),
    );
    renderDashboard();
    expect(await screen.findByTestId('kpi-tham-gia')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Nhu cầu mức học (theo đề nghị của học viên)' })).not.toBeInTheDocument();
    expect(daGoi).toBe(false);
  });

  it('bấm tab "Nhu cầu mức học" → hiện khối, cập nhật URL ?tab=nhu_cau, gọi API', async () => {
    let daGoi = false;
    server.use(
      http.get('/thong-ke/nhu-cau-muc-hoc', () => {
        daGoi = true;
        return HttpResponse.json({
          so_dang_ky: 0,
          chua_co_muc: 0,
          da_dieu_chinh: 0,
          moc_tu_khao_sat: 0,
          theo_muc: [],
          dieu_chinh: [],
          theo_truong: [],
        });
      }),
    );
    const r = renderDashboard();
    await screen.findByTestId('kpi-tham-gia');
    await userEvent.click(screen.getByRole('tab', { name: 'Nhu cầu mức học' }));
    expect(await screen.findByRole('region', { name: 'Nhu cầu mức học (theo đề nghị của học viên)' })).toBeInTheDocument();
    await waitFor(() => expect(daGoi).toBe(true));
    await waitFor(() => expect(r.router.state.location.search).toBe('?tab=nhu_cau'));
  });

  it('deep link ?tab=hoc_tap mở tab Học tập', async () => {
    renderDashboard('/thong-ke?tab=hoc_tap');
    expect(await screen.findByRole('region', { name: 'Kết quả học tập' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Chuyên cần' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Xếp hạng đơn vị' })).toBeInTheDocument();
    expect(screen.queryByTestId('kpi-tham-gia')).not.toBeInTheDocument();
  });

  it('giá trị tab không hợp lệ → về tab Tổng quan', async () => {
    renderDashboard('/thong-ke?tab=khong_ton_tai');
    expect(await screen.findByTestId('kpi-tham-gia')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Nhu cầu mức học (theo đề nghị của học viên)' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tổng quan' })).toHaveAttribute('aria-selected', 'true');
  });

  it('che_do admin, tab Học tập → có khối Xếp hạng + Chuyên cần', async () => {
    renderDashboard('/thong-ke?tab=hoc_tap');
    expect(await screen.findByRole('region', { name: 'Xếp hạng đơn vị' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Chuyên cần' })).toBeInTheDocument();
  });

  it('tab Hồ sơ & đôn đốc → có khối Cần đôn đốc', async () => {
    renderDashboard('/thong-ke?tab=ho_so');
    expect(await screen.findByRole('region', { name: 'Cần đôn đốc' })).toBeInTheDocument();
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
    expect(await screen.findByTestId('kpi-tham-gia')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Tiến độ theo trường' })).not.toBeInTheDocument();
    expect(daGoi).toBe(false);
  });

  it('tài khoản trường vẫn thấy khối Chất lượng hồ sơ và Cần đôn đốc (tab Hồ sơ & đôn đốc)', async () => {
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
    renderDashboard('/thong-ke?tab=ho_so');
    expect(await screen.findByRole('region', { name: 'Chất lượng hồ sơ' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Cần đôn đốc' })).toBeInTheDocument();
  });

  it('admin → có khối Tiến độ theo trường (tab Tổng quan)', async () => {
    renderDashboard();
    expect(await screen.findByRole('region', { name: 'Tiến độ theo trường' })).toBeInTheDocument();
  });

  it('tab Đánh giá NLS (thực tế): khối Đánh giá NLS theo mức nằm ngay sau Kết quả khảo sát', async () => {
    renderDashboard('/thong-ke?tab=danh_gia');
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
    renderDashboard('/thong-ke?tab=danh_gia');
    expect(await screen.findByRole('region', { name: 'Đánh giá NLS thực tế theo mức — theo trường' })).toBeInTheDocument();
  });

  it('che_do ho_tro, tab Học tập → không render và không gọi API xếp hạng', async () => {
    let daGoi = false;
    server.use(
      http.get('/thong-ke/xep-hang', () => {
        daGoi = true;
        return HttpResponse.json({ kieu: 'bang', top: [], bottom: [], tong_so: 0 });
      }),
    );
    renderDashboard('/thong-ke?tab=hoc_tap', 'ho_tro');
    expect(await screen.findByRole('region', { name: 'Kết quả học tập' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Xếp hạng đơn vị' })).not.toBeInTheDocument();
    expect(daGoi).toBe(false);
  });

  it('doi_tuong trên URL được gửi kèm request của các khối ở từng tab', async () => {
    const goi: Record<string, string | null> = {};
    const ghi = (ten: string) =>
      http.get(`/thong-ke/${ten}`, ({ request }) => {
        goi[ten] = new URL(request.url).searchParams.get('doi_tuong');
        return undefined;
      });
    server.use(ghi('pheu'), ghi('khao-sat'), ghi('chuyen-can'), ghi('tien-do-truong'));
    renderDashboard('/thong-ke?doi_tuong=nhan_vien');
    await waitFor(() => {
      for (const ten of ['pheu', 'tien-do-truong']) expect(goi[ten]).toBe('nhan_vien');
    });

    await userEvent.click(screen.getByRole('tab', { name: 'Đánh giá NLS (thực tế)' }));
    await waitFor(() => expect(goi['khao-sat']).toBe('nhan_vien'));

    await userEvent.click(screen.getByRole('tab', { name: 'Học tập' }));
    await waitFor(() => expect(goi['chuyen-can']).toBe('nhan_vien'));
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

  it('bấm "Xem riêng" (drilldown) trong khối theo trường vẫn giữ tab hiện tại', async () => {
    const r = renderDashboard('/thong-ke?tab=danh_gia');
    await screen.findByRole('region', { name: 'Đánh giá NLS thực tế theo mức — theo trường' });
    await userEvent.click(await screen.findByRole('button', { name: 'Xem riêng Trường THPT Nguyễn Du' }));
    await waitFor(() => {
      const sp = r.router.state.location.search;
      expect(sp).toContain('tab=danh_gia');
      expect(sp).toContain('don_vi_id=dv-a');
    });
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

  it('che_do ho_tro → không có nút Xuất DS học viên theo trường (PII)', async () => {
    renderDashboard('/thong-ke', 'ho_tro');
    expect(await screen.findByRole('button', { name: 'Xuất biểu mẫu ĐK & truy cập' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xuất DS học viên theo trường' })).not.toBeInTheDocument();
  });

  it('admin chưa chọn trường → nút Xuất DS học viên theo trường bị vô hiệu', async () => {
    renderDashboard();
    const nut = await screen.findByRole('button', { name: 'Xuất DS học viên theo trường' });
    expect(nut).toHaveAttribute('aria-disabled', 'true');
  });

  it('admin + tài khoản trường (don_vi_co_dinh) → nút bật, gọi xuat-excel với id trường cố định', async () => {
    let url: URL | null = null;
    server.use(
      http.get('/thong-ke/bo-loc', () =>
        HttpResponse.json({
          khoa: [],
          don_vi: null,
          cum: null,
          don_vi_co_dinh: { id: 'dv-2', ten_don_vi: 'Trường THPT Long Xuyên' },
        }),
      ),
      http.get('/hoc-vien/xuat-excel', ({ request }) => {
        url = new URL(request.url);
        return new HttpResponse('x', { headers: { 'Content-Type': 'application/octet-stream' } });
      }),
    );
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderDashboard();
    const nut = await screen.findByRole('button', { name: 'Xuất DS học viên theo trường' });
    await waitFor(() => expect(nut).toHaveAttribute('aria-disabled', 'false'));
    await userEvent.click(nut);
    await waitFor(() => expect((url as URL | null)?.searchParams.get('don_vi_cong_tac_id')).toBe('dv-2'));
    await waitFor(() => expect(click).toHaveBeenCalled());
    click.mockRestore();
  });

  it('admin chọn trường trong bộ lọc (don_vi_id trên URL) → xuất theo trường đó', async () => {
    let url: URL | null = null;
    server.use(
      http.get('/hoc-vien/xuat-excel', ({ request }) => {
        url = new URL(request.url);
        return new HttpResponse('x', { headers: { 'Content-Type': 'application/octet-stream' } });
      }),
    );
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderDashboard('/thong-ke?don_vi_id=dv-1');
    const nut = await screen.findByRole('button', { name: 'Xuất DS học viên theo trường' });
    expect(nut).toHaveAttribute('aria-disabled', 'false');
    await userEvent.click(nut);
    await waitFor(() => expect((url as URL | null)?.searchParams.get('don_vi_cong_tac_id')).toBe('dv-1'));
    click.mockRestore();
  });
});
