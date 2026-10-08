import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { KhoiMucNlsTheoTruong } from './KhoiMucNlsTheoTruong';

function renderKhoi(
  loc: { khoa_id?: string; doi_tuong?: 'giao_vien' } = { khoa_id: 'khoa-1' },
  extra = '',
) {
  datToken('token-gia-lap');
  const qs = new URLSearchParams(loc as Record<string, string>).toString();
  return renderVoiRouter([{ path: '/thong-ke', element: <KhoiMucNlsTheoTruong loc={loc} /> }], {
    initialEntries: [`/thong-ke?${qs}${extra}`],
  });
}

const searchCua = (r: ReturnType<typeof renderKhoi>) => new URLSearchParams(r.router.state.location.search);

function tenCacDong(): string[] {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((tr) => within(tr).getAllByRole('cell')[0].textContent ?? '');
}

/** Ghi lại query của các request tới /thong-ke/muc-nls. */
function ghiRequest() {
  const goi: URL[] = [];
  server.use(
    http.get('/thong-ke/muc-nls', ({ request }) => {
      goi.push(new URL(request.url));
      return undefined;
    }),
  );
  return goi;
}

describe('KhoiMucNlsTheoTruong', () => {
  it('mặc định gọi loai=dau_vao; bảng đủ cột; sắp Đã làm tăng dần, null cuối', async () => {
    const goi = ghiRequest();
    renderKhoi();
    await screen.findByText('Trường THPT Nguyễn Du');
    expect(goi[0].searchParams.get('loai')).toBe('dau_vao');
    expect(goi[0].searchParams.get('khoa_id')).toBe('khoa-1');
    for (const h of [
      'Trường',
      'Số HV',
      'Đã làm',
      'Phân bố mức',
      'Chưa đạt',
      'Cơ bản',
      'Thành thạo',
      'Nâng cao',
      'Chưa làm',
    ]) {
      expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    }
    expect(screen.getByText('5 trường')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Đã làm' })).toHaveAttribute('aria-sort', 'ascending');
    const ten = tenCacDong();
    expect(ten).toHaveLength(5);
    expect(ten[0]).toContain('Trường THCS Lê Lợi');
    expect(ten[1]).toContain('Trường THPT Phan Chu Trinh');
    expect(ten[2]).toContain('Trường THPT Nguyễn Du');
    expect(ten[3]).toContain('Trường Tiểu học Trần Phú');
    expect(ten[4]).toContain('Trường Mầm non Hoa Sen');
  });

  it('ô Đã làm "x/y · %"; trường 0 HV hiện "—"; cột mức và Chưa làm là số', async () => {
    renderKhoi();
    const dong = (await screen.findByText('Trường THPT Nguyễn Du')).closest('tr')!;
    expect(within(dong).getByText('30/40 · 75,0%')).toBeInTheDocument();
    const so = within(dong)
      .getAllByRole('cell')
      .map((c) => c.textContent);
    // Trường, Số HV, Đã làm, Phân bố, M1..M4, Chưa làm
    expect(so.slice(1, 3)).toEqual(['40', '30/40 · 75,0%']);
    expect(so.slice(4)).toEqual(['3', '12', '10', '4', '10']);
    const rong = screen.getByText('Trường Mầm non Hoa Sen').closest('tr')!;
    expect(within(rong).getAllByText('—')).toHaveLength(2); // Đã làm và Phân bố mức
  });

  it('thanh phân bố có aria-label đúng số từng mức', async () => {
    renderKhoi();
    await screen.findByText('Trường THPT Nguyễn Du');
    expect(
      screen.getByRole('img', {
        name: 'Trường THPT Nguyễn Du: Chưa đạt 3, Cơ bản 12, Thành thạo 10, Nâng cao 4, Chưa xếp mức 1',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: 'Trường THCS Lê Lợi: Chưa đạt 1, Cơ bản 2, Thành thạo 1, Nâng cao 0, Chưa xếp mức 1',
      }),
    ).toBeInTheDocument();
    // Trường chưa ai làm: không vẽ thanh.
    expect(screen.queryByRole('img', { name: /Hoa Sen/ })).not.toBeInTheDocument();
  });

  it('chuyển sang Đầu ra: gọi API loai=dau_ra và ghi mnls lên URL, giữ tham số khác', async () => {
    const goi = ghiRequest();
    const r = renderKhoi({ khoa_id: 'khoa-1', doi_tuong: 'giao_vien' });
    await screen.findByText('Trường THPT Nguyễn Du');
    await userEvent.click(screen.getByLabelText('Đầu ra'));
    await waitFor(() => expect(goi.some((u) => u.searchParams.get('loai') === 'dau_ra')).toBe(true));
    expect(searchCua(r).get('mnls')).toBe('dau_ra');
    expect(searchCua(r).get('khoa_id')).toBe('khoa-1');
    expect(searchCua(r).get('doi_tuong')).toBe('giao_vien');
    await waitFor(() => expect(screen.getByText('1 trường')).toBeInTheDocument());
    await userEvent.click(screen.getByLabelText('Đầu vào'));
    await waitFor(() => expect(searchCua(r).get('mnls')).toBe('dau_vao'));
  });

  it('mnls=dau_ra có sẵn trên URL → gọi dau_ra và chọn "Đầu ra"', async () => {
    const goi = ghiRequest();
    renderKhoi({ khoa_id: 'khoa-1' }, '&mnls=dau_ra');
    await screen.findByText('Trường THPT Nguyễn Du');
    expect(goi[0].searchParams.get('loai')).toBe('dau_ra');
    expect(screen.getByLabelText('Đầu ra')).toBeChecked();
  });

  it('mnls không hợp lệ → quay về đầu vào', async () => {
    const goi = ghiRequest();
    renderKhoi({ khoa_id: 'khoa-1' }, '&mnls=xyz');
    await screen.findByText('Trường THPT Nguyễn Du');
    expect(goi[0].searchParams.get('loai')).toBe('dau_vao');
  });

  it('bấm tiêu đề cột mức 2 lần → giảm dần', async () => {
    renderKhoi();
    await screen.findByText('Trường THPT Nguyễn Du');
    const nut = screen.getByRole('button', { name: 'Cơ bản' });
    await userEvent.click(nut);
    expect(screen.getByRole('columnheader', { name: 'Cơ bản' })).toHaveAttribute('aria-sort', 'ascending');
    await userEvent.click(nut);
    expect(screen.getByRole('columnheader', { name: 'Cơ bản' })).toHaveAttribute('aria-sort', 'descending');
    expect(tenCacDong()[0]).toContain('Trường THPT Nguyễn Du');
  });

  it('gõ "nguyen" khớp "Nguyễn Du" (bỏ dấu)', async () => {
    renderKhoi();
    await screen.findByText('Trường THPT Nguyễn Du');
    await userEvent.type(screen.getByRole('textbox', { name: 'Tìm trường' }), 'nguyen');
    expect(screen.getByText('1 trường')).toBeInTheDocument();
    expect(screen.queryByText('Trường THCS Lê Lợi')).not.toBeInTheDocument();
  });

  it('bấm tên trường đặt don_vi_id, giữ khoa_id và doi_tuong (và mnls)', async () => {
    const r = renderKhoi({ khoa_id: 'khoa-1', doi_tuong: 'giao_vien' }, '&mnls=dau_ra');
    await userEvent.click(await screen.findByRole('button', { name: 'Xem riêng Trường THPT Nguyễn Du' }));
    await waitFor(() => expect(searchCua(r).get('don_vi_id')).toBe('dv-a'));
    expect(searchCua(r).get('khoa_id')).toBe('khoa-1');
    expect(searchCua(r).get('doi_tuong')).toBe('giao_vien');
    expect(searchCua(r).get('mnls')).toBe('dau_ra');
  });

  it('không có trường nào → thông báo rỗng', async () => {
    server.use(
      http.get('/thong-ke/muc-nls', () =>
        HttpResponse.json({
          loai: 'dau_vao',
          thang: [],
          tong: { so_hv: 0, da_lam: 0, chua_lam: 0, theo_muc: [], chua_xep_muc: 0 },
          theo_truong: [],
        }),
      ),
    );
    renderKhoi();
    expect(await screen.findByText('Chưa có học viên trong phạm vi lọc')).toBeInTheDocument();
  });

  it('nút Xuất Excel gửi loai và bộ lọc hiện tại', async () => {
    const urls: URL[] = [];
    server.use(
      http.get('/thong-ke/muc-nls/xuat-excel', ({ request }) => {
        urls.push(new URL(request.url));
        return new HttpResponse('x', { headers: { 'Content-Type': 'application/octet-stream' } });
      }),
    );
    URL.createObjectURL = vi.fn(() => 'blob:gia-lap');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderKhoi({ khoa_id: 'khoa-1', doi_tuong: 'giao_vien' });
    await screen.findByText('Trường THPT Nguyễn Du');
    await userEvent.click(screen.getByRole('button', { name: 'Xuất Excel' }));
    await waitFor(() => expect(urls).toHaveLength(1));
    expect(urls[0].searchParams.get('loai')).toBe('dau_vao');
    expect(urls[0].searchParams.get('khoa_id')).toBe('khoa-1');
    expect(urls[0].searchParams.get('doi_tuong')).toBe('giao_vien');
    await waitFor(() => expect(click).toHaveBeenCalled());

    await userEvent.click(screen.getByLabelText('Đầu ra'));
    await screen.findByText('1 trường');
    await userEvent.click(screen.getByRole('button', { name: 'Xuất Excel' }));
    await waitFor(() => expect(urls).toHaveLength(2));
    expect(urls[1].searchParams.get('loai')).toBe('dau_ra');
  });
});
