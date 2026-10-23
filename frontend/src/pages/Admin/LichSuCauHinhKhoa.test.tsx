import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import type { LichSuCauHinhKhoa as MucLichSu } from '@/api/khoaBoiDuong';
import { LichSuCauHinhKhoa } from './LichSuCauHinhKhoa';

function render(ds: MucLichSu[] | 'loi') {
  datToken('token-gia-lap');
  server.use(
    http.get('/khoa-boi-duong/khoa-1/lich-su-cau-hinh', () =>
      ds === 'loi'
        ? HttpResponse.json({ error: { code: 'INTERNAL', message: 'Lỗi máy chủ' } }, { status: 500 })
        : HttpResponse.json(ds),
    ),
  );
  return renderVoiRouter([{ path: '/', element: <LichSuCauHinhKhoa khoaId="khoa-1" /> }]);
}

describe('Admin — Lịch sử cấu hình khóa', () => {
  it('hiện thời gian giờ VN, người thực hiện, giá trị cũ → mới theo nhãn server', async () => {
    render([
      {
        id: 'nk-1',
        thoi_gian: '2026-10-22T02:30:00.000Z',
        nguoi_thuc_hien: 'Quản trị A (quản trị)',
        thay_doi: [
          {
            truong: 'che_do_chuyen_can',
            nhan: 'Chế độ chuyên cần khi chuyển lớp',
            truoc_hien_thi: 'Theo lớp hiện tại (học lại các buổi ở lớp mới)',
            sau_hien_thi: 'Công nhận buổi đã có mặt ở lớp cũ (bất kể mức)',
          },
          { truong: 'so_buoi_doi_toi_da', nhan: 'Số buổi đổi tối đa', truoc_hien_thi: '0', sau_hien_thi: '2' },
        ],
      },
    ]);
    expect(await screen.findByText('22/10/2026 09:30')).toBeInTheDocument();
    expect(screen.getByText('Quản trị A (quản trị)')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Theo lớp hiện tại \(học lại các buổi ở lớp mới\) → Công nhận buổi đã có mặt ở lớp cũ \(bất kể mức\)/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Số buổi đổi tối đa:')).toBeInTheDocument();
    expect(screen.getByText(/0 → 2/)).toBeInTheDocument();
  });

  it('chưa có lịch sử -> thông báo trống', async () => {
    render([]);
    expect(await screen.findByText('Chưa có lần cập nhật cấu hình nào được ghi nhận.')).toBeInTheDocument();
  });

  it('API lỗi -> hiện thông báo lỗi', async () => {
    render('loi');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
