import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { boLocQuanTri, nhuCauMucDotMau } from '@/test/mocks/thongKe';
import { db } from '@/test/mocks/db';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import type { DotNhuCauMuc } from '@/api/types';
import type { LocThongKe } from '@/api/thongKe';
import { KhoiNhuCauMucDot } from './KhoiNhuCauMucDot';

const dot = (id: string, ten: string, mo: string): DotNhuCauMuc => ({
  id,
  khoa_id: 'khoa-1',
  ten_dot: ten,
  mo_luc: mo,
  dong_luc: '2026-12-01T00:00:00.000Z',
  trang_thai: 'dang_mo',
  so_ban_ghi: 0,
});

function renderKhoi(loc: LocThongKe = { khoa_id: 'khoa-1' }) {
  datToken('token-gia-lap');
  return renderVoiRouter([{ path: '/thong-ke', element: <KhoiNhuCauMucDot loc={loc} /> }], {
    initialEntries: ['/thong-ke'],
  });
}

function batXuat() {
  const ref: { urls: URL[] } = { urls: [] };
  server.use(
    http.get('/thong-ke/nhu-cau-muc-dot/xuat-excel', ({ request }) => {
      ref.urls.push(new URL(request.url));
      return new HttpResponse('x', { headers: { 'Content-Type': 'application/octet-stream' } });
    }),
  );
  return ref;
}

const ketQuaRong = { ...nhuCauMucDotMau, tong_du_dieu_kien: 1, da_chon: 0, chua_chon: 1, ty_le_da_chon: 0, ma_tran: [], theo_truong: [] };

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:gia-lap');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  // API trả mới nhất trước (mo_luc giảm dần).
  db.danhSachDotNhuCauMuc = [
    dot('dot-2', 'Đợt 2', '2026-10-10T00:00:00.000Z'),
    dot('dot-1', 'Đợt 1', '2026-09-01T00:00:00.000Z'),
  ];
  server.use(
    http.get('/thong-ke/bo-loc', () =>
      HttpResponse.json({
        ...boLocQuanTri,
        don_vi: [
          ...(boLocQuanTri.don_vi ?? []),
          { id: 'dv-3', ten_don_vi: 'Trường THCS Châu Đốc', loai_don_vi: 'truong' },
        ],
      }),
    ),
  );
});

describe('KhoiNhuCauMucDot', () => {
  it('chưa chọn khóa: nhắc chọn khóa, không gọi API', async () => {
    let daGoi = false;
    server.use(
      http.get('/thong-ke/nhu-cau-muc-dot', () => {
        daGoi = true;
        return HttpResponse.json(ketQuaRong);
      }),
    );
    renderKhoi({});
    expect(await screen.findByText('Chọn khóa để xem nhu cầu theo đợt')).toBeInTheDocument();
    expect(daGoi).toBe(false);
  });

  it('khóa chưa có đợt: báo chưa có đợt', async () => {
    db.danhSachDotNhuCauMuc = [];
    renderKhoi();
    expect(await screen.findByText('Khóa này chưa có đợt nhu cầu')).toBeInTheDocument();
  });

  it('mặc định chọn đợt mới nhất và gọi API với dot_id đó (không gửi khoa_id)', async () => {
    const ref: { url: URL | null } = { url: null };
    server.use(
      http.get('/thong-ke/nhu-cau-muc-dot', ({ request }) => {
        ref.url = new URL(request.url);
        return HttpResponse.json(ketQuaRong);
      }),
    );
    renderKhoi();
    expect(await screen.findByRole('textbox', { name: 'Đợt' })).toHaveValue('Đợt 2');
    await waitFor(() => expect(ref.url?.searchParams.get('dot_id')).toBe('dot-2'));
    expect(ref.url?.searchParams.has('khoa_id')).toBe(false);
  });

  it('đổi đợt thì gọi lại với dot_id mới', async () => {
    const goi: string[] = [];
    server.use(
      http.get('/thong-ke/nhu-cau-muc-dot', ({ request }) => {
        goi.push(new URL(request.url).searchParams.get('dot_id') ?? '');
        return HttpResponse.json(ketQuaRong);
      }),
    );
    renderKhoi();
    await userEvent.click(await screen.findByRole('textbox', { name: 'Đợt' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Đợt 1' }));
    await waitFor(() => expect(goi).toContain('dot-1'));
  });

  it('hiện KPI: đủ điều kiện / đã chọn / chưa chọn / tỷ lệ', async () => {
    renderKhoi();
    expect(await screen.findByTestId('kpi-du-dieu-kien')).toHaveTextContent('20');
    expect(screen.getByTestId('kpi-da-chon')).toHaveTextContent('15');
    expect(screen.getByTestId('kpi-chua-chon')).toHaveTextContent('5');
    expect(screen.getByTestId('kpi-ty-le')).toHaveTextContent('75,0%');
  });

  it('ma trận 3×3 có tiêu đề và nhãn mức; ô hợp lệ không có dữ liệu hiện 0, ô không hợp lệ hiện —', async () => {
    renderKhoi();
    const bang = await screen.findByRole('table', { name: /Mốc.*mức đã chọn/ });
    const cacO = (ten: string) =>
      within(within(bang).getByRole('row', { name: new RegExp(`^${ten}`) }))
        .getAllByRole('cell')
        .map((c) => c.textContent);
    expect(within(bang).getByRole('columnheader', { name: 'Nâng cao' })).toBeInTheDocument();
    expect(cacO('Cơ bản')).toEqual(['4', '—', '—']);
    expect(cacO('Thành thạo')).toEqual(['2', '5', '—']);
    expect(cacO('Nâng cao')).toEqual(['0', '3', '1']);
  });

  it('bảng theo trường liệt kê từng trường', async () => {
    renderKhoi();
    const bang = await screen.findByRole('table', { name: 'Nhu cầu theo trường' });
    const dong = within(bang).getByRole('row', { name: /Trường Tiểu học Cẩm Hà/ });
    expect(within(dong).getAllByRole('cell').map((c) => c.textContent)).toEqual([
      'Trường Tiểu học Cẩm Hà',
      '12',
      '9',
      '3',
      '4',
    ]);
    expect(within(bang).getByRole('row', { name: /Trường THCS Minh Khai/ })).toBeInTheDocument();
  });

  it('Xuất Excel mặc định tất cả trường: có dot_id, không có don_vi_ids', async () => {
    const ref = batXuat();
    renderKhoi({ khoa_id: 'khoa-1', doi_tuong: 'giao_vien' });
    await userEvent.click(await screen.findByRole('button', { name: 'Xuất Excel' }));
    await waitFor(() => expect(ref.urls).toHaveLength(1));
    expect(ref.urls[0].searchParams.get('dot_id')).toBe('dot-2');
    expect(ref.urls[0].searchParams.get('doi_tuong')).toBe('giao_vien');
    expect(ref.urls[0].searchParams.has('don_vi_ids')).toBe(false);
  });

  it('chọn nhiều trường: gửi don_vi_ids; chưa chọn trường nào thì khóa nút', async () => {
    const ref = batXuat();
    renderKhoi();
    await userEvent.click(await screen.findByRole('radio', { name: 'Chọn một hoặc nhiều trường' }));
    expect(screen.getByRole('button', { name: 'Xuất Excel' })).toBeDisabled();
    expect(screen.getByText('Chọn ít nhất một trường')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('textbox', { name: 'Trường' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Trường THCS Châu Đốc' }));
    await userEvent.click(screen.getByRole('button', { name: 'Xuất Excel' }));
    await waitFor(() => expect(ref.urls).toHaveLength(1));
    expect(ref.urls[0].searchParams.get('don_vi_ids')).toBe('dv-3');
  });

  it('lỗi tải thống kê: hiện lỗi, không crash', async () => {
    server.use(
      http.get('/thong-ke/nhu-cau-muc-dot', () =>
        HttpResponse.json({ error: { code: 'INTERNAL', message: 'Lỗi máy chủ' } }, { status: 500 }),
      ),
    );
    renderKhoi();
    expect(await screen.findByText('Không tải được')).toBeInTheDocument();
  });
});
