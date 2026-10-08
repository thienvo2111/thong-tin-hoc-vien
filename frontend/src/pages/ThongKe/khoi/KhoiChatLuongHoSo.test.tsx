import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { KhoiChatLuongHoSo } from './KhoiChatLuongHoSo';

function renderKhoi(loc: { khoa_id?: string; doi_tuong?: 'giao_vien' } = { khoa_id: 'khoa-1' }) {
  datToken('token-gia-lap');
  const qs = new URLSearchParams(loc as Record<string, string>).toString();
  return renderVoiRouter([{ path: '/thong-ke', element: <KhoiChatLuongHoSo loc={loc} /> }], {
    initialEntries: [`/thong-ke?${qs}`],
  });
}

const searchCua = (r: ReturnType<typeof renderKhoi>) => new URLSearchParams(r.router.state.location.search);

function tenCacDong(): string[] {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((tr) => within(tr).getAllByRole('cell')[0].textContent ?? '');
}

describe('KhoiChatLuongHoSo', () => {
  it('5 thẻ tổng: số và % trên tổng HV', async () => {
    renderKhoi();
    const du = await screen.findByTestId('the-du-ho-so');
    expect(within(du).getByText('Đủ hồ sơ')).toBeInTheDocument();
    expect(within(du).getByText('50 / 100 · 50,0%')).toBeInTheDocument();
    const caThe: [string, string, string][] = [
      ['the-thieu-doi-tuong', 'Thiếu đối tượng', '20 · 20,0%'],
      ['the-thieu-cap', 'Thiếu cấp giảng dạy', '30 · 30,0%'],
      ['the-thieu-email', 'Thiếu email', '40 · 40,0%'],
      ['the-thieu-sdt', 'Thiếu SĐT', '10 · 10,0%'],
    ];
    for (const [id, nhan, so] of caThe) {
      const the = screen.getByTestId(id);
      expect(within(the).getByText(nhan)).toBeInTheDocument();
      expect(within(the).getByText(so)).toBeInTheDocument();
    }
  });

  it('bảng đủ dòng, đúng cột; mặc định sắp Đủ hồ sơ tăng dần, null cuối', async () => {
    renderKhoi();
    await screen.findByText('Trường THPT Nguyễn Du');
    for (const h of [
      'Trường',
      'Số HV',
      'Thiếu đối tượng',
      'Thiếu cấp giảng dạy',
      'Thiếu email',
      'Thiếu SĐT',
      'Đủ hồ sơ',
    ]) {
      expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    }
    expect(screen.getByText('5 trường')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Đủ hồ sơ' })).toHaveAttribute('aria-sort', 'ascending');
    const ten = tenCacDong();
    expect(ten).toHaveLength(5);
    expect(ten[0]).toContain('Trường THCS Lê Lợi');
    expect(ten[1]).toContain('Trường THPT Phan Chu Trinh');
    expect(ten[2]).toContain('Trường THPT Nguyễn Du');
    expect(ten[3]).toContain('Trường Tiểu học Trần Phú');
    expect(ten[4]).toContain('Trường Mầm non Hoa Sen');
  });

  it('ô Đủ hồ sơ "x/y · %"; trường 0 HV hiện "—"', async () => {
    renderKhoi();
    const dong = (await screen.findByText('Trường THPT Nguyễn Du')).closest('tr')!;
    expect(within(dong).getByText('20/40 · 50,0%')).toBeInTheDocument();
    const rong = screen.getByText('Trường Mầm non Hoa Sen').closest('tr')!;
    expect(within(rong).getByText('—')).toBeInTheDocument();
  });

  it('bấm Số HV 2 lần → giảm dần', async () => {
    renderKhoi();
    await screen.findByText('Trường THPT Nguyễn Du');
    const nut = screen.getByRole('button', { name: 'Số HV' });
    await userEvent.click(nut);
    expect(screen.getByRole('columnheader', { name: 'Số HV' })).toHaveAttribute('aria-sort', 'ascending');
    await userEvent.click(nut);
    expect(screen.getByRole('columnheader', { name: 'Số HV' })).toHaveAttribute('aria-sort', 'descending');
    expect(tenCacDong()[0]).toContain('Trường THPT Nguyễn Du');
  });

  it('gõ "nguyen" khớp "Nguyễn Du" (bỏ dấu)', async () => {
    renderKhoi();
    await screen.findByText('Trường THPT Nguyễn Du');
    await userEvent.type(screen.getByRole('textbox', { name: 'Tìm trường' }), 'nguyen');
    expect(screen.getByText('1 trường')).toBeInTheDocument();
    expect(screen.queryByText('Trường THCS Lê Lợi')).not.toBeInTheDocument();
  });

  it('bấm tên trường đặt don_vi_id, giữ khoa_id và doi_tuong', async () => {
    const r = renderKhoi({ khoa_id: 'khoa-1', doi_tuong: 'giao_vien' });
    await userEvent.click(await screen.findByRole('button', { name: 'Xem riêng Trường THCS Lê Lợi' }));
    await waitFor(() => expect(searchCua(r).get('don_vi_id')).toBe('dv-b'));
    expect(searchCua(r).get('khoa_id')).toBe('khoa-1');
    expect(searchCua(r).get('doi_tuong')).toBe('giao_vien');
  });

  it('không có trường nào → thông báo rỗng', async () => {
    server.use(
      http.get('/thong-ke/chat-luong-ho-so', () =>
        HttpResponse.json({
          tong: {
            so_hv: 0,
            thieu_doi_tuong: 0,
            thieu_cap: 0,
            thieu_email: 0,
            thieu_sdt: 0,
            du_ho_so: 0,
            ty_le_du: null,
          },
          theo_truong: [],
        }),
      ),
    );
    renderKhoi();
    expect(await screen.findByText('Chưa có học viên trong phạm vi lọc')).toBeInTheDocument();
  });

  it('nút Xuất Excel gọi endpoint kèm khoa_id và doi_tuong', async () => {
    let url: URL | null = null;
    server.use(
      http.get('/thong-ke/chat-luong-ho-so/xuat-excel', ({ request }) => {
        url = new URL(request.url);
        return new HttpResponse('x', { headers: { 'Content-Type': 'application/octet-stream' } });
      }),
    );
    URL.createObjectURL = vi.fn(() => 'blob:gia-lap');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderKhoi({ khoa_id: 'khoa-1', doi_tuong: 'giao_vien' });
    await userEvent.click(await screen.findByRole('button', { name: 'Xuất Excel' }));
    await waitFor(() => expect((url as URL | null)?.searchParams.get('khoa_id')).toBe('khoa-1'));
    expect((url as URL | null)?.searchParams.get('doi_tuong')).toBe('giao_vien');
    await waitFor(() => expect(click).toHaveBeenCalled());
  });
});
