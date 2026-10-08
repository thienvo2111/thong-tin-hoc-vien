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

const searchCua = (r: ReturnType<typeof renderKhoi>) => new URLSearchParams(r.router.state.location.search);

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
  it('mặc định tab Đầu vào: đúng cột, không có cột tab khác; ô null hiện "—"', async () => {
    const r = renderKhoi();
    expect(await screen.findByText('Trường THPT Nguyễn Du')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(5);
    expect(screen.getByRole('tab', { name: 'Đầu vào' })).toHaveAttribute('aria-selected', 'true');
    for (const h of ['Trường', 'Số HV', 'Truy cập', 'KS kĩ năng số', 'Đánh giá NLS đầu vào']) {
      expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    }
    for (const h of ['Đạt', 'Có mặt', 'VLE ≥ 50%', 'Đánh giá NLS đầu ra']) {
      expect(screen.queryByRole('columnheader', { name: h })).not.toBeInTheDocument();
    }
    expect(screen.getByText('4 trường')).toBeInTheDocument();
    const dongNguyenDu = screen.getByText('Trường THPT Nguyễn Du').closest('tr')!;
    expect(within(dongNguyenDu).getByText('36/40 · 90,0%')).toBeInTheDocument();
    const dongPhan = screen.getByText('Trường THPT Phan Chu Trinh').closest('tr')!;
    expect(within(dongPhan).getAllByText('—').length).toBeGreaterThanOrEqual(1);
    expect(searchCua(r).get('tdt_tab')).toBeNull();
  });

  it('chuyển sang Học tập: cột Có mặt / VLE, ô "3/4 lượt · 75,0%", ghi tdt_tab vào URL', async () => {
    const r = renderKhoi();
    await screen.findByText('Trường THPT Nguyễn Du');
    await userEvent.click(screen.getByRole('tab', { name: 'Học tập' }));
    expect(screen.getByRole('columnheader', { name: 'Có mặt' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'VLE ≥ 50%' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Truy cập' })).not.toBeInTheDocument();
    const dongLeLoi = screen.getByText('Trường THCS Lê Lợi').closest('tr')!;
    expect(within(dongLeLoi).getByText('3/4 lượt · 75,0%')).toBeInTheDocument();
    expect(within(dongLeLoi).getByText('5/10 HV · 50,0%')).toBeInTheDocument();
    const dongPhan = screen.getByText('Trường THPT Phan Chu Trinh').closest('tr')!;
    expect(within(dongPhan).getAllByText('—').length).toBeGreaterThanOrEqual(1);
    expect(within(dongPhan).queryByText(/lượt ·/)).not.toBeInTheDocument();
    await waitFor(() => expect(searchCua(r).get('tdt_tab')).toBe('hoc-tap'));
    expect(searchCua(r).get('khoa_id')).toBe('khoa-1');
  });

  it('tab Đầu ra: cột Đánh giá NLS đầu ra + Đạt với "lượt ĐK"', async () => {
    renderKhoi();
    await screen.findByText('Trường THPT Nguyễn Du');
    await userEvent.click(screen.getByRole('tab', { name: 'Đầu ra' }));
    expect(screen.getByRole('columnheader', { name: 'Đánh giá NLS đầu ra' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Đạt' })).toBeInTheDocument();
    const dong = screen.getByText('Trường Tiểu học Trần Phú').closest('tr')!;
    expect(within(dong).getByText('27/30 lượt ĐK · 90,0%')).toBeInTheDocument();
    expect(within(dong).getByText('3/30 · 10,0%')).toBeInTheDocument();
  });

  it('URL có tdt_tab=hoc-tap → mở đúng tab; giá trị sai → Đầu vào', async () => {
    const r = renderKhoi('/thong-ke?khoa_id=khoa-1&tdt_tab=hoc-tap');
    await screen.findByText('Trường THPT Nguyễn Du');
    expect(screen.getByRole('tab', { name: 'Học tập' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('columnheader', { name: 'Có mặt' })).toBeInTheDocument();
    r.unmount();
    renderKhoi('/thong-ke?khoa_id=khoa-1&tdt_tab=bay-ba');
    await screen.findByText('Trường THPT Nguyễn Du');
    expect(screen.getByRole('tab', { name: 'Đầu vào' })).toHaveAttribute('aria-selected', 'true');
  });

  it('sắp xếp mặc định theo tab: Truy cập / Có mặt / Đánh giá NLS đầu ra tăng dần, null cuối', async () => {
    renderKhoi();
    await screen.findByText('Trường THPT Nguyễn Du');
    expect(screen.getByRole('columnheader', { name: 'Truy cập' })).toHaveAttribute('aria-sort', 'ascending');
    let ten = tenCacDong();
    expect(ten[0]).toContain('Trường THCS Lê Lợi');
    expect(ten[3]).toContain('Trường THPT Phan Chu Trinh');

    await userEvent.click(screen.getByRole('tab', { name: 'Học tập' }));
    expect(screen.getByRole('columnheader', { name: 'Có mặt' })).toHaveAttribute('aria-sort', 'ascending');
    ten = tenCacDong();
    expect(ten[0]).toContain('Trường THCS Lê Lợi');
    expect(ten[3]).toContain('Trường THPT Phan Chu Trinh');

    await userEvent.click(screen.getByRole('tab', { name: 'Đầu ra' }));
    expect(screen.getByRole('columnheader', { name: 'Đánh giá NLS đầu ra' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    expect(tenCacDong()[0]).toContain('Trường Tiểu học Trần Phú');
  });

  it('đổi tab đặt lại sắp xếp về cột đầu của tab', async () => {
    renderKhoi();
    await screen.findByText('Trường THPT Nguyễn Du');
    await userEvent.click(screen.getByRole('button', { name: 'Đánh giá NLS đầu vào' }));
    expect(screen.getByRole('columnheader', { name: 'Đánh giá NLS đầu vào' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Học tập' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Đầu vào' }));
    expect(screen.getByRole('columnheader', { name: 'Truy cập' })).toHaveAttribute('aria-sort', 'ascending');
    expect(screen.getByRole('columnheader', { name: 'Đánh giá NLS đầu vào' })).toHaveAttribute('aria-sort', 'none');
  });

  it('bấm Đạt 2 lần → giảm dần, null vẫn cuối', async () => {
    renderKhoi('/thong-ke?khoa_id=khoa-1&tdt_tab=dau-ra');
    await screen.findByText('Trường THPT Nguyễn Du');
    const nut = screen.getByRole('button', { name: 'Đạt' });
    await userEvent.click(nut);
    expect(screen.getByRole('columnheader', { name: 'Đạt' })).toHaveAttribute('aria-sort', 'ascending');
    expect(tenCacDong()[3]).toContain('Trường THCS Lê Lợi');
    await userEvent.click(nut);
    expect(screen.getByRole('columnheader', { name: 'Đạt' })).toHaveAttribute('aria-sort', 'descending');
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

  it('tìm kiếm vẫn áp dụng khi sang tab khác', async () => {
    renderKhoi();
    await screen.findByText('Trường THPT Nguyễn Du');
    await userEvent.type(screen.getByRole('textbox', { name: 'Tìm trường' }), 'nguyen');
    await userEvent.click(screen.getByRole('tab', { name: 'Học tập' }));
    expect(screen.getByText('1 trường')).toBeInTheDocument();
    expect(screen.getByText('Trường THPT Nguyễn Du')).toBeInTheDocument();
    expect(screen.queryByText('Trường THCS Lê Lợi')).not.toBeInTheDocument();
  });

  it('bấm tên trường ở tab Học tập → giữ tdt_tab, thêm don_vi_id, giữ khoa_id', async () => {
    const r = renderKhoi('/thong-ke?khoa_id=khoa-1&tdt_tab=hoc-tap');
    await userEvent.click(await screen.findByRole('button', { name: 'Xem riêng Trường THCS Lê Lợi' }));
    await waitFor(() => expect(searchCua(r).get('don_vi_id')).toBe('dv-b'));
    expect(searchCua(r).get('tdt_tab')).toBe('hoc-tap');
    expect(searchCua(r).get('khoa_id')).toBe('khoa-1');
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
