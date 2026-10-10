import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { nhuCauMucHocMau } from '@/test/mocks/thongKe';
import { KhoiNhuCauMucHoc } from './KhoiNhuCauMucHoc';

function renderKhoi(loc: { khoa_id?: string } = {}, extra = '') {
  datToken('token-gia-lap');
  const qs = new URLSearchParams(loc as Record<string, string>).toString();
  return renderVoiRouter([{ path: '/thong-ke', element: <KhoiNhuCauMucHoc loc={loc} /> }], {
    initialEntries: [`/thong-ke?${qs}${extra}`],
  });
}

describe('KhoiNhuCauMucHoc', () => {
  it('dòng tóm tắt + bảng + danh sách điều chỉnh', async () => {
    renderKhoi();

    expect(
      await screen.findByText('Có mức đánh giá: 7/9 đăng ký · Đề nghị học mức thấp hơn: 3 (42,9% trên số có mức) · Chưa có mức: 2'),
    ).toBeInTheDocument();

    const hang = screen.getByRole('row', { name: /Nâng cao/ });
    expect(within(hang).getByText('−3')).toBeInTheDocument();

    const danhSach = screen.getByTestId('danh-sach-dieu-chinh');
    expect(within(danhSach).getByText('Nâng cao → Thành thạo: 2')).toBeInTheDocument();
    expect(within(danhSach).getByText('Nâng cao → Cơ bản: 1')).toBeInTheDocument();
  });

  it('moc_tu_khao_sat > 0 -> dòng tóm tắt thêm "Trong đó lấy từ khảo sát"', async () => {
    server.use(
      http.get('/thong-ke/nhu-cau-muc-hoc', () =>
        HttpResponse.json({ ...nhuCauMucHocMau, moc_tu_khao_sat: 2 }),
      ),
    );
    renderKhoi();
    expect(
      await screen.findByText(
        'Có mức đánh giá: 7/9 đăng ký · Đề nghị học mức thấp hơn: 3 (42,9% trên số có mức) · Chưa có mức: 2 · Trong đó lấy từ khảo sát: 2',
      ),
    ).toBeInTheDocument();
  });

  it('so_nhan_vien_loai_tru > 0 -> hiện cảnh báo loại nhân viên', async () => {
    server.use(
      http.get('/thong-ke/nhu-cau-muc-hoc', () =>
        HttpResponse.json({ ...nhuCauMucHocMau, so_nhan_vien_loai_tru: 5 }),
      ),
    );
    renderKhoi();
    expect(
      await screen.findByText(
        'Không tính 5 đăng ký của nhân viên (không tham gia khảo sát – đánh giá và tập huấn).',
      ),
    ).toBeInTheDocument();
  });

  it('so_nhan_vien_loai_tru = 0 -> không hiện cảnh báo', async () => {
    renderKhoi();
    await screen.findByText(/Có mức đánh giá/);
    expect(screen.queryByText(/Không tính.*nhân viên/)).not.toBeInTheDocument();
  });

  it('chưa có HV nào có mức đánh giá -> rỗng', async () => {
    server.use(
      http.get('/thong-ke/nhu-cau-muc-hoc', () =>
        HttpResponse.json({
          ...nhuCauMucHocMau,
          so_dang_ky: 5,
          chua_co_muc: 5,
          da_dieu_chinh: 0,
          theo_muc: nhuCauMucHocMau.theo_muc.map((m) => ({ ...m, theo_danh_gia: 0, theo_nhu_cau: 0 })),
          dieu_chinh: [],
        }),
      ),
    );
    renderKhoi();
    expect(await screen.findByText('Chưa có học viên có mức đánh giá đầu vào')).toBeInTheDocument();
  });

  it('chuyển sang Theo trường: hiện cả 2 trường, ô mức dạng "đánh giá → nhu cầu"', async () => {
    renderKhoi();
    await screen.findByText(/Có mức đánh giá/);
    await userEvent.click(screen.getByLabelText('Theo trường'));
    expect(await screen.findByText('Trường THPT Nguyễn Du')).toBeInTheDocument();
    expect(screen.getByText('Trường THCS Lê Lợi')).toBeInTheDocument();
    expect(screen.getByText('2 trường')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Cơ bản: đánh giá 3, nhu cầu 4' }),
    ).toBeInTheDocument();
    const dong = screen.getByText('Trường THPT Nguyễn Du').closest('tr')!;
    expect(
      within(dong).getByRole('img', { name: 'Cơ bản: đánh giá 3, nhu cầu 4' }),
    ).toBeInTheDocument();
  });

  it('Theo trường: tìm kiếm lọc theo tên (bỏ dấu)', async () => {
    renderKhoi();
    await userEvent.click(await screen.findByLabelText('Theo trường'));
    await screen.findByText('Trường THPT Nguyễn Du');
    await userEvent.type(screen.getByRole('textbox', { name: 'Tìm trường' }), 'le loi');
    expect(screen.getByText('1 trường')).toBeInTheDocument();
    expect(screen.queryByText('Trường THPT Nguyễn Du')).not.toBeInTheDocument();
    expect(screen.getByText('Trường THCS Lê Lợi')).toBeInTheDocument();
  });

  it('Theo trường: ghi ncmh=theo_truong lên URL và bấm tên trường đặt don_vi_id', async () => {
    const r = renderKhoi({ khoa_id: 'khoa-1' });
    await userEvent.click(await screen.findByLabelText('Theo trường'));
    await waitFor(() =>
      expect(new URLSearchParams(r.router.state.location.search).get('ncmh')).toBe('theo_truong'),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Xem riêng Trường THPT Nguyễn Du' }),
    );
    await waitFor(() =>
      expect(new URLSearchParams(r.router.state.location.search).get('don_vi_id')).toBe('dv-a'),
    );
    expect(new URLSearchParams(r.router.state.location.search).get('khoa_id')).toBe('khoa-1');
  });

  it('nút Xuất Excel gọi endpoint kèm bộ lọc hiện tại', async () => {
    const urls: URL[] = [];
    server.use(
      http.get('/thong-ke/nhu-cau-muc-hoc/xuat-excel', ({ request }) => {
        urls.push(new URL(request.url));
        return new HttpResponse('x', { headers: { 'Content-Type': 'application/octet-stream' } });
      }),
    );
    URL.createObjectURL = vi.fn(() => 'blob:gia-lap');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderKhoi({ khoa_id: 'khoa-1' });
    await screen.findByText(/Có mức đánh giá/);
    await userEvent.click(screen.getByRole('button', { name: 'Xuất Excel' }));
    await waitFor(() => expect(urls).toHaveLength(1));
    expect(urls[0].searchParams.get('khoa_id')).toBe('khoa-1');
    await waitFor(() => expect(click).toHaveBeenCalled());
  });
});
