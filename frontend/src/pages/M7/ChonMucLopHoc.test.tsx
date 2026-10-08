import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { db } from '@/test/mocks/db';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import type { MucNangLuc } from '@/api/types';
import ThongTinLopHoc from './ThongTinLopHoc';

const routes = [{ path: '/toi/lop-hoc', element: <ThongTinLopHoc /> }];

function datDangKy(muc_dau_vao: MucNangLuc | null, mo_dieu_chinh_muc: boolean, muc_hoc_chon: MucNangLuc | null = null) {
  const dk = db.khoaHocToi[0];
  dk.muc_dau_vao = muc_dau_vao;
  dk.muc_hoc_chon = muc_hoc_chon;
  dk.khoa.mo_dieu_chinh_muc = mo_dieu_chinh_muc;
}

function renderDaDangNhap() {
  datToken('token-gia-lap');
  return renderVoiRouter(routes, { initialEntries: ['/toi/lop-hoc'] });
}

const nutDieuChinh = () => screen.queryByRole('button', { name: 'Điều chỉnh mức lớp' });

// Điều chỉnh mức lớp học (2026-10-08) — khối "Kết quả đánh giá" ở M7.
describe('M7 — Điều chỉnh mức lớp học', () => {
  it('khóa mở + đánh giá nâng cao: hiện mức lớp học và nút điều chỉnh', async () => {
    datDangKy('nang_cao', true);
    renderDaDangNhap();
    expect(await screen.findByText('Nâng cao', { selector: 'b' })).toBeInTheDocument();
    expect(screen.getByText(/Mức lớp học:/)).toBeInTheDocument();
    expect(nutDieuChinh()).toBeInTheDocument();
  });

  it('khóa đóng: chỉ hiện dòng mức, không có nút', async () => {
    datDangKy('nang_cao', false, 'thanh_thao');
    renderDaDangNhap();
    expect(await screen.findByText(/đã điều chỉnh từ Nâng cao/)).toBeInTheDocument();
    expect(screen.getByText('Thành thạo', { selector: 'b' })).toBeInTheDocument();
    expect(nutDieuChinh()).not.toBeInTheDocument();
  });

  it('đánh giá cơ bản: không có mức thấp hơn -> ẩn nút', async () => {
    datDangKy('co_ban', true);
    renderDaDangNhap();
    expect(await screen.findByText(/Mức lớp học:/)).toBeInTheDocument();
    expect(nutDieuChinh()).not.toBeInTheDocument();
  });

  it('chưa có kết quả đánh giá: không hiện dòng mức lớp học', async () => {
    datDangKy(null, true);
    renderDaDangNhap();
    await screen.findAllByTestId('the-giai-doan');
    expect(screen.queryByText(/Mức lớp học:/)).not.toBeInTheDocument();
    expect(nutDieuChinh()).not.toBeInTheDocument();
  });

  it('chỉ liệt kê các mức ≤ mức đánh giá, mức bằng ghi "(theo kết quả đánh giá)"', async () => {
    datDangKy('thanh_thao', true);
    renderDaDangNhap();
    await userEvent.click(await screen.findByRole('button', { name: 'Điều chỉnh mức lớp' }));
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.closest('.mantine-Radio-root')?.textContent)).toEqual([
      'Cơ bản',
      'Thành thạo (theo kết quả đánh giá)',
    ]);
    expect(screen.getByRole('radio', { name: 'Thành thạo (theo kết quả đánh giá)' })).toBeChecked();
    expect(screen.queryByRole('radio', { name: /Nâng cao/ })).not.toBeInTheDocument();
    expect(screen.getByText(/chỉ có thể chọn học ở mức bằng hoặc thấp hơn kết quả đánh giá/)).toBeInTheDocument();
  });

  it('lưu thành công: gửi mức đã chọn, báo thành công, cập nhật dòng mức', async () => {
    datDangKy('nang_cao', true);
    let body: unknown;
    server.use(
      http.put('/hoc-vien/toi/khoa-hoc/:khoaId/muc-hoc', async ({ request }) => {
        body = await request.json();
        db.khoaHocToi[0].muc_hoc_chon = 'co_ban';
        return HttpResponse.json({ muc_dau_vao: 'nang_cao', muc_hoc_chon: 'co_ban', muc_hoc: 'co_ban' });
      }),
    );
    renderDaDangNhap();
    await userEvent.click(await screen.findByRole('button', { name: 'Điều chỉnh mức lớp' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Cơ bản' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));

    expect(await screen.findByText(/Đã lưu mức lớp học/)).toBeInTheDocument();
    expect(body).toEqual({ muc: 'co_ban' });
    await waitFor(() => expect(screen.getByText(/đã điều chỉnh từ Nâng cao/)).toBeInTheDocument());
    expect(screen.getByText('Cơ bản', { selector: 'b' })).toBeInTheDocument();
  });

  it('lỗi 403 DIEU_CHINH_MUC_DONG: hiện "Đã hết thời gian điều chỉnh mức lớp học"', async () => {
    datDangKy('nang_cao', true);
    server.use(
      http.put('/hoc-vien/toi/khoa-hoc/:khoaId/muc-hoc', () =>
        HttpResponse.json(
          { error: { code: 'DIEU_CHINH_MUC_DONG', message: 'Khóa học chưa mở điều chỉnh mức lớp học' } },
          { status: 403 },
        ),
      ),
    );
    renderDaDangNhap();
    await userEvent.click(await screen.findByRole('button', { name: 'Điều chỉnh mức lớp' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Thành thạo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText('Đã hết thời gian điều chỉnh mức lớp học')).toBeInTheDocument();
  });

  it('bấm Hủy: đóng khu chọn, không gọi API', async () => {
    datDangKy('nang_cao', true);
    renderDaDangNhap();
    await userEvent.click(await screen.findByRole('button', { name: 'Điều chỉnh mức lớp' }));
    await userEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(nutDieuChinh()).toBeInTheDocument();
  });
});
