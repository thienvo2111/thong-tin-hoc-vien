import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { KhoiTienDoTruong, mauTheoNguong } from './KhoiTienDoTruong';

function renderKhoi(url = '/thong-ke?khoa_id=khoa-1') {
  datToken('token-gia-lap');
  return renderVoiRouter([{ path: '/thong-ke', element: <KhoiTienDoTruong loc={{ khoa_id: 'khoa-1' }} /> }], {
    initialEntries: [url],
  });
}

/** Tên các trường theo thứ tự dòng trong tbody. */
function tenCacDong(): string[] {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((tr) => within(tr).getAllByRole('cell')[0].textContent ?? '');
}

describe('mauTheoNguong', () => {
  it('theo ngưỡng 0,5 / 0,8; null → null', () => {
    expect(mauTheoNguong(0.49)).toBe('red.6');
    expect(mauTheoNguong(0.5)).toBe('yellow.6');
    expect(mauTheoNguong(0.79)).toBe('yellow.6');
    expect(mauTheoNguong(0.8)).toBe('teal.6');
    expect(mauTheoNguong(null)).toBeNull();
  });
});

describe('KhoiTienDoTruong', () => {
  it('render đủ dòng + header; ô null hiện "—"', async () => {
    renderKhoi();
    expect(await screen.findByText('Trường THPT Nguyễn Du')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(5);
    const tieuDe = [
      'Trường',
      'Số HV',
      '% Truy cập',
      '% KS kĩ năng số',
      '% Đánh giá NLS đầu vào',
      '% Đánh giá NLS đầu ra',
      '% Có mặt',
      '% VLE ≥ 50%',
      '% Đạt',
    ];
    for (const h of tieuDe) {
      expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    }
    expect(screen.getByText('4 trường')).toBeInTheDocument();
    const dongPhan = screen.getByText('Trường THPT Phan Chu Trinh').closest('tr')!;
    expect(within(dongPhan).getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });

  it('mặc định sắp % Truy cập tăng dần, null cuối', async () => {
    renderKhoi();
    await screen.findByText('Trường THPT Nguyễn Du');
    expect(screen.getByRole('columnheader', { name: '% Truy cập' })).toHaveAttribute('aria-sort', 'ascending');
    const ten = tenCacDong();
    expect(ten[0]).toContain('Trường THCS Lê Lợi');
    expect(ten[3]).toContain('Trường THPT Phan Chu Trinh');
  });

  it('bấm % Đạt 2 lần → giảm dần, null vẫn cuối', async () => {
    renderKhoi();
    await screen.findByText('Trường THPT Nguyễn Du');
    const nut = screen.getByRole('button', { name: '% Đạt' });
    await userEvent.click(nut);
    expect(screen.getByRole('columnheader', { name: '% Đạt' })).toHaveAttribute('aria-sort', 'ascending');
    expect(tenCacDong()[3]).toContain('Trường THCS Lê Lợi');
    await userEvent.click(nut);
    expect(screen.getByRole('columnheader', { name: '% Đạt' })).toHaveAttribute('aria-sort', 'descending');
    expect(screen.getByRole('columnheader', { name: '% Truy cập' })).toHaveAttribute('aria-sort', 'none');
    const ten = tenCacDong();
    expect(ten[0]).toContain('Trường Tiểu học Trần Phú');
    expect(ten[3]).toContain('Trường THCS Lê Lợi');
  });

  it('gõ "nguyen" khớp "Nguyễn Du" (bỏ dấu)', async () => {
    renderKhoi();
    await screen.findByText('Trường THPT Nguyễn Du');
    await userEvent.type(screen.getByRole('textbox', { name: 'Tìm trường' }), 'nguyen');
    expect(screen.getByText('1 trường')).toBeInTheDocument();
    expect(screen.queryByText('Trường THCS Lê Lợi')).not.toBeInTheDocument();
  });

  it('bấm tên trường → URL có don_vi_id và giữ khoa_id', async () => {
    const r = renderKhoi();
    await userEvent.click(await screen.findByRole('button', { name: 'Xem riêng Trường THCS Lê Lợi' }));
    await waitFor(() => {
      const p = new URLSearchParams(r.router.state.location.search);
      expect(p.get('don_vi_id')).toBe('dv-b');
      expect(p.get('khoa_id')).toBe('khoa-1');
    });
  });

  it('mảng rỗng → thông báo rỗng', async () => {
    server.use(http.get('/thong-ke/tien-do-truong', () => HttpResponse.json([])));
    renderKhoi();
    expect(await screen.findByText('Chưa có học viên trong phạm vi lọc')).toBeInTheDocument();
  });

  it('nút Xuất Excel gọi endpoint xuat-excel kèm bộ lọc', async () => {
    let url: URL | null = null;
    server.use(
      http.get('/thong-ke/tien-do-truong/xuat-excel', ({ request }) => {
        url = new URL(request.url);
        return new HttpResponse('x', { headers: { 'Content-Type': 'application/octet-stream' } });
      }),
    );
    URL.createObjectURL = vi.fn(() => 'blob:gia-lap');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderKhoi();
    await userEvent.click(await screen.findByRole('button', { name: 'Xuất Excel' }));
    await waitFor(() => expect((url as URL | null)?.searchParams.get('khoa_id')).toBe('khoa-1'));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(URL.createObjectURL).toHaveBeenCalled();
  });
});
