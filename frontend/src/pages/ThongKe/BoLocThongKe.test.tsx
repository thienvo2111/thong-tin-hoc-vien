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
  it('đổi bộ lọc giữ nguyên query param không thuộc bộ lọc (tdt_tab)', async () => {
    const r = renderBoLoc('/thong-ke?khoa_id=khoa-1&tdt_tab=hoc-tap');
    await chon('Khóa', 'Khóa 2');
    await waitFor(() => expect(search(r).get('khoa_id')).toBe('khoa-2'));
    expect(search(r).get('tdt_tab')).toBe('hoc-tap');
  });

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

  it('chọn đối tượng ghi doi_tuong lên URL; xóa chọn thì bỏ tham số', async () => {
    const r = renderBoLoc();
    expect(await o('Đối tượng')).toHaveAttribute('placeholder', 'Tất cả đối tượng');
    await chon('Đối tượng', 'Giáo viên');
    await waitFor(() => expect(search(r).get('doi_tuong')).toBe('giao_vien'));
    await userEvent.click(await screen.findByLabelText('Xóa đối tượng'));
    await waitFor(() => expect(search(r).has('doi_tuong')).toBe(false));
  });

  it('có đủ 4 lựa chọn đối tượng', async () => {
    renderBoLoc();
    await userEvent.click(await o('Đối tượng'));
    for (const n of ['Giáo viên', 'Cán bộ quản lý', 'Nhân viên', 'Chưa xác định']) {
      expect(await screen.findByRole('option', { name: n })).toBeInTheDocument();
    }
  });

  it('đổi khóa/đơn vị/cụm không xóa doi_tuong', async () => {
    const r = renderBoLoc('/thong-ke?doi_tuong=nhan_vien&khoa_id=khoa-1&cum_id=cum-1');
    await chon('Khóa', 'Khóa 2');
    await waitFor(() => expect(search(r).get('khoa_id')).toBe('khoa-2'));
    await chon('Đơn vị', 'Trường THPT Long Xuyên');
    await waitFor(() => expect(search(r).get('don_vi_id')).toBe('dv-2'));
    expect(search(r).get('doi_tuong')).toBe('nhan_vien');
  });

  it('gõ không dấu "chau thi te" vẫn tìm thấy "Trường THPT Châu Thị Tế" trong ô Đơn vị', async () => {
    server.use(
      http.get('/thong-ke/bo-loc', () =>
        HttpResponse.json({
          ...boLocQuanTri,
          don_vi: [...(boLocQuanTri.don_vi ?? []), { id: 'dv-ctt', ten_don_vi: 'Trường THPT Châu Thị Tế', loai_don_vi: 'truong' }],
        }),
      ),
    );
    renderBoLoc();
    await userEvent.click(await o('Đơn vị'));
    await userEvent.type(await o('Đơn vị'), 'chau thi te');
    expect(await screen.findByRole('option', { name: 'Trường THPT Châu Thị Tế' })).toBeInTheDocument();
  });

  it('hiện ô đối tượng cả với tài khoản trường', async () => {
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
    expect(await o('Đối tượng')).toBeInTheDocument();
  });
});
