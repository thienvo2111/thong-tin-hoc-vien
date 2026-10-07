import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderTrang } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { canDonDocMau } from '@/test/mocks/thongKe';
import { KhoiCanDonDoc } from './KhoiCanDonDoc';

function renderKhoi() {
  datToken('token-gia-lap');
  return renderTrang(<KhoiCanDonDoc loc={{}} />);
}

describe('KhoiCanDonDoc', () => {
  it('hiện bảng học viên', async () => {
    renderKhoi();
    expect(await screen.findByText('Nguyễn Văn An')).toBeInTheDocument();
    expect(screen.getByText('Vắng 3 buổi')).toBeInTheDocument();
  });

  it('đổi tab → gọi loai mới, page reset 1', async () => {
    const goi: string[] = [];
    server.use(
      http.get('/thong-ke/can-don-doc', ({ request }) => {
        const p = new URL(request.url).searchParams;
        goi.push(`${p.get('loai')}:${p.get('page')}`);
        return HttpResponse.json({ ...canDonDocMau, tong: 45 });
      }),
    );
    renderKhoi();
    await waitFor(() => expect(goi).toEqual(['chua_truy_cap:1']));
    await userEvent.click(await screen.findByRole('button', { name: '2' }));
    await waitFor(() => expect(goi).toContain('chua_truy_cap:2'));
    await userEvent.click(screen.getByRole('tab', { name: 'Vắng nhiều' }));
    await waitFor(() => expect(goi[goi.length - 1]).toBe('vang_nhieu:1'));
  });

  it('thứ tự tab và tab "Chưa làm KS kĩ năng số" gọi loai=chua_ky_nang_so', async () => {
    const goi: string[] = [];
    server.use(
      http.get('/thong-ke/can-don-doc', ({ request }) => {
        goi.push(new URL(request.url).searchParams.get('loai') ?? '');
        return HttpResponse.json(canDonDocMau);
      }),
    );
    renderKhoi();
    await screen.findByText('Nguyễn Văn An');
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Chưa truy cập',
      'Chưa làm KS kĩ năng số',
      'Chưa làm đánh giá NLS',
      'Vắng nhiều',
      'VLE thấp',
    ]);
    await userEvent.click(screen.getByRole('tab', { name: 'Chưa làm KS kĩ năng số' }));
    await waitFor(() => expect(goi[goi.length - 1]).toBe('chua_ky_nang_so'));
    await userEvent.click(screen.getByRole('tab', { name: 'Chưa làm đánh giá NLS' }));
    await waitFor(() => expect(goi[goi.length - 1]).toBe('chua_khao_sat'));
  });

  it('rỗng → thông báo không có học viên', async () => {
    server.use(http.get('/thong-ke/can-don-doc', () => HttpResponse.json({ tong: 0, page: 1, items: [] })));
    renderKhoi();
    expect(await screen.findByText('Không có học viên cần đôn đốc')).toBeInTheDocument();
  });

  it('nút Xuất Excel gọi endpoint xuat-excel với loai hiện tại', async () => {
    let url: URL | null = null;
    server.use(
      http.get('/thong-ke/can-don-doc/xuat-excel', ({ request }) => {
        url = new URL(request.url);
        return new HttpResponse('x', { headers: { 'Content-Type': 'application/octet-stream' } });
      }),
    );
    URL.createObjectURL = vi.fn(() => 'blob:gia-lap');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderKhoi();
    await userEvent.click(await screen.findByRole('tab', { name: 'VLE thấp' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Xuất Excel' }));
    await waitFor(() => expect((url as URL | null)?.searchParams.get('loai')).toBe('vle_thap'));
  });
});
