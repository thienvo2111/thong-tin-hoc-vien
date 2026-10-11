import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { boLocQuanTri } from '@/test/mocks/thongKe';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import type { LocThongKe } from '@/api/thongKe';
import { KhoiXuatDanhSachHocVien } from './KhoiXuatDanhSachHocVien';

const URL_XUAT = '/thong-ke/danh-sach-hoc-vien/xuat-excel';

function renderKhoi(loc: LocThongKe = { khoa_id: 'khoa-1', doi_tuong: 'giao_vien' }) {
  datToken('token-gia-lap');
  return renderVoiRouter([{ path: '/thong-ke', element: <KhoiXuatDanhSachHocVien loc={loc} /> }], {
    initialEntries: ['/thong-ke'],
  });
}

/** Bắt URL của lần gọi xuất gần nhất. */
function batXuat(status = 200) {
  const ref: { url: URL | null } = { url: null };
  server.use(
    http.get(URL_XUAT, ({ request }) => {
      ref.url = new URL(request.url);
      if (status !== 200) {
        return HttpResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Đơn vị nằm ngoài phạm vi của bạn' } },
          { status },
        );
      }
      return new HttpResponse('x', { headers: { 'Content-Type': 'application/octet-stream' } });
    }),
  );
  return ref;
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:gia-lap');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
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

describe('KhoiXuatDanhSachHocVien', () => {
  it('mặc định "Tất cả trường": gửi khóa + đối tượng của bộ lọc, không có don_vi_ids', async () => {
    const ref = batXuat();
    renderKhoi({ khoa_id: 'khoa-1', doi_tuong: 'giao_vien', don_vi_id: 'dv-1' });
    expect(await screen.findByRole('radio', { name: 'Tất cả trường (theo bộ lọc)' })).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Xuất Excel danh sách học viên' }));
    await waitFor(() => expect(ref.url).not.toBeNull());
    const q = ref.url!.searchParams;
    expect(q.get('khoa_id')).toBe('khoa-1');
    expect(q.get('doi_tuong')).toBe('giao_vien');
    expect(q.get('don_vi_id')).toBe('dv-1');
    expect(q.has('don_vi_ids')).toBe(false);
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
  });

  it('chọn trường: chưa chọn thì nút bị khóa; chọn 2 trường -> don_vi_ids, bỏ don_vi_id/cum_id', async () => {
    const ref = batXuat();
    renderKhoi({ khoa_id: 'khoa-1', don_vi_id: 'dv-1', cum_id: 'cum-1' });
    await userEvent.click(await screen.findByRole('radio', { name: 'Chọn một hoặc nhiều trường' }));
    const nut = screen.getByRole('button', { name: 'Xuất Excel danh sách học viên' });
    expect(nut).toBeDisabled();
    expect(screen.getByText('Chọn ít nhất một trường')).toBeInTheDocument();

    const o = screen.getByRole('textbox', { name: 'Trường' });
    await userEvent.click(o);
    // Chỉ liệt kê trường, không có Sở.
    expect(screen.queryByRole('option', { name: 'Sở GD&ĐT An Giang' })).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('option', { name: 'Trường THPT Long Xuyên' }));
    await userEvent.click(o);
    await userEvent.click(await screen.findByRole('option', { name: 'Trường THCS Châu Đốc' }));
    expect(screen.getByText('Đã chọn 2/100 trường')).toBeInTheDocument();

    await userEvent.click(nut);
    await waitFor(() => expect(ref.url).not.toBeNull());
    const q = ref.url!.searchParams;
    expect(q.get('don_vi_ids')).toBe('dv-2,dv-3');
    expect(q.get('khoa_id')).toBe('khoa-1');
    expect(q.has('don_vi_id')).toBe(false);
    expect(q.has('cum_id')).toBe(false);
  });

  it('tìm trường không dấu vẫn ra kết quả', async () => {
    renderKhoi();
    await userEvent.click(await screen.findByRole('radio', { name: 'Chọn một hoặc nhiều trường' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Trường' }), 'chau doc');
    expect(await screen.findByRole('option', { name: 'Trường THCS Châu Đốc' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Trường THPT Long Xuyên' })).not.toBeInTheDocument();
  });

  it('tài khoản không có danh sách đơn vị (trường/hỗ trợ): không có bộ chọn, vẫn xuất được', async () => {
    server.use(
      http.get('/thong-ke/bo-loc', () =>
        HttpResponse.json({ ...boLocQuanTri, don_vi: null, don_vi_co_dinh: { id: 'dv-2', ten_don_vi: 'T' } }),
      ),
    );
    const ref = batXuat();
    renderKhoi();
    const nut = await screen.findByRole('button', { name: 'Xuất Excel danh sách học viên' });
    await waitFor(() => expect(screen.queryByRole('radio')).not.toBeInTheDocument());
    await userEvent.click(nut);
    await waitFor(() => expect(ref.url?.searchParams.has('don_vi_ids')).toBe(false));
  });

  it('lỗi 403 -> hiện thông báo lỗi', async () => {
    batXuat(403);
    renderKhoi();
    await userEvent.click(await screen.findByRole('button', { name: 'Xuất Excel danh sách học viên' }));
    expect(await screen.findByText(/ngoài phạm vi/)).toBeInTheDocument();
  });
});
