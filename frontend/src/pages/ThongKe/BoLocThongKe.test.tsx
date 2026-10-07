import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { boLocQuanTri } from '@/test/mocks/thongKe';
import { BoLocThongKe } from './BoLocThongKe';

function renderBoLoc(url = '/thong-ke') {
  datToken('token-gia-lap');
  return renderVoiRouter([{ path: '/thong-ke', element: <BoLocThongKe /> }], { initialEntries: [url] });
}

const o = (ten: string) => screen.findByRole('textbox', { name: ten });
const search = (r: ReturnType<typeof renderBoLoc>) => new URLSearchParams(r.router.state.location.search);

async function chon(ten: string, nhan: string) {
  await userEvent.click(await o(ten));
  await userEvent.click(await screen.findByRole('option', { name: nhan }));
}

describe('BoLocThongKe', () => {
  it('quan_tri: ô cụm disabled khi chưa chọn khóa', async () => {
    renderBoLoc();
    expect(await o('Cụm')).toBeDisabled();
    expect(await o('Đơn vị')).toBeEnabled();
  });

  it('quan_tri: chọn khóa thì ô cụm bật', async () => {
    renderBoLoc('/thong-ke?khoa_id=khoa-1');
    await waitFor(async () => expect(await o('Cụm')).toBeEnabled());
  });

  it('truong: không có ô đơn vị, hiện tên trường cố định', async () => {
    server.use(
      http.get('/thong-ke/bo-loc', () =>
        HttpResponse.json({
          ...boLocQuanTri,
          don_vi: null,
          cum: null,
          don_vi_co_dinh: { id: 'dv-9', ten_don_vi: 'Trường THPT Châu Phú' },
        }),
      ),
    );
    renderBoLoc();
    expect(await screen.findByText('Trường THPT Châu Phú')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Đơn vị' })).not.toBeInTheDocument();
  });

  it('so: không có ô cụm', async () => {
    server.use(http.get('/thong-ke/bo-loc', () => HttpResponse.json({ ...boLocQuanTri, cum: null })));
    renderBoLoc();
    expect(await o('Đơn vị')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Cụm' })).not.toBeInTheDocument();
  });

  it('chọn khóa ghi khoa_id lên URL', async () => {
    const r = renderBoLoc();
    await chon('Khóa', 'Khóa 2');
    await waitFor(() => expect(search(r).get('khoa_id')).toBe('khoa-2'));
  });

  it('đổi khóa xóa cum_id', async () => {
    const r = renderBoLoc('/thong-ke?khoa_id=khoa-1&cum_id=cum-1');
    await chon('Khóa', 'Khóa 2');
    await waitFor(() => expect(search(r).get('khoa_id')).toBe('khoa-2'));
    expect(search(r).has('cum_id')).toBe(false);
  });

  it('chọn đơn vị xóa cụm', async () => {
    const r = renderBoLoc('/thong-ke?khoa_id=khoa-1&cum_id=cum-1');
    await chon('Đơn vị', 'Trường THPT Long Xuyên');
    await waitFor(() => expect(search(r).get('don_vi_id')).toBe('dv-2'));
    expect(search(r).has('cum_id')).toBe(false);
  });

  it('chọn cụm xóa đơn vị', async () => {
    const r = renderBoLoc('/thong-ke?khoa_id=khoa-1&don_vi_id=dv-2');
    await chon('Cụm', 'Cụm Long Xuyên');
    await waitFor(() => expect(search(r).get('cum_id')).toBe('cum-1'));
    expect(search(r).has('don_vi_id')).toBe(false);
  });
});
