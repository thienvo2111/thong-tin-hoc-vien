import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { db } from '@/test/mocks/db';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import AdminTinhHinhKhaoSat from './AdminTinhHinhKhaoSat';

// Mock GET /sso/ket-qua(/thong-ke) ở test/mocks/sso.ts (hocVienTinhHinhMock: 1 người xong phiếu đánh giá,
// đã mở phiếu khảo sát kĩ năng số quá lâu; 1 người chưa làm gì).
function renderTrang() {
  datToken('token-gia-lap');
  db.nguoiDung.vai_tro = 'quan_tri';
  return renderVoiRouter([{ path: '/admin/tinh-hinh-khao-sat', element: <AdminTinhHinhKhaoSat /> }], {
    initialEntries: ['/admin/tinh-hinh-khao-sat'],
  });
}

const theThongKe = (nhan: string) => screen.getByRole('button', { name: new RegExp(nhan) });

describe('Admin — Tình hình khảo sát', () => {
  // Sửa 2026-10-07: "Phiếu khảo sát kĩ năng số" (tab mặc định) chỉ theo dõi đã làm/chưa làm, không có
  // mức/điểm trên UI (hệ thống đó không trả mức có ý nghĩa) -> không cột Mức/Điểm, không dòng tóm tắt mức.
  it('tab Phiếu khảo sát kĩ năng số: không cột Mức/Điểm, không dòng tóm tắt mức', async () => {
    renderTrang();
    expect(await screen.findByText('Hà Thị Thanh')).toBeInTheDocument();
    await waitFor(() => expect(theThongKe('Cần kiểm tra lại')).toHaveTextContent('1'));
    expect(theThongKe('Chưa làm')).toHaveTextContent('1');

    expect(screen.queryByRole('columnheader', { name: 'Mức' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Điểm' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Thành thạo/)).not.toBeInTheDocument();
    expect(screen.queryByText('Mức của bài đã hoàn thành:', { exact: false })).not.toBeInTheDocument();
  });

  it('đổi sang phiếu đánh giá -> hiện cột Mức/Điểm + dòng tóm tắt mức + chi tiết từng hồ sơ', async () => {
    renderTrang();
    await screen.findByText('Hà Thị Thanh');

    const user = userEvent.setup();
    await user.click(screen.getByText('Phiếu đánh giá năng lực số'));
    await waitFor(() => expect(theThongKe('Đã hoàn thành')).toHaveTextContent('1'));
    expect(screen.getByText(/Thành thạo 1/)).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Mức' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Điểm' })).toBeInTheDocument();

    const dong = screen.getByText('Hà Thị Thanh').closest('tr')!;
    expect(within(dong).getByText('Đã hoàn thành')).toBeInTheDocument();
    expect(within(dong).getByText('M3 – Thành thạo')).toBeInTheDocument();
    expect(within(dong).getByText('Quy đổi: Thành thạo')).toBeInTheDocument();
    expect(within(dong).getByText('72,5 / 100 (72,5%)')).toBeInTheDocument();
    expect(within(dong).getByRole('link', { name: 'Xem kết quả chi tiết' })).toHaveAttribute(
      'href',
      'https://khaosat.test/ket-qua/hv-1',
    );
    expect(within(dong).getByText('Hệ thống khảo sát')).toBeInTheDocument();
    expect(within(screen.getByText('Lê Văn Bình').closest('tr')!).getByText('Chưa làm')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Hà Thị Thanh' })).toHaveAttribute('href', '/admin/hoc-vien/hv-1');
  });

  it('bấm ô thống kê -> lọc theo trạng thái đó, bấm lại bỏ lọc', async () => {
    const user = userEvent.setup();
    renderTrang();
    await screen.findByText('Hà Thị Thanh');
    await waitFor(() => expect(theThongKe('Cần kiểm tra lại')).toHaveTextContent('1'));

    await user.click(theThongKe('Cần kiểm tra lại'));
    expect(theThongKe('Cần kiểm tra lại')).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(screen.queryByText('Lê Văn Bình')).not.toBeInTheDocument());
    const dong = screen.getByText('Hà Thị Thanh').closest('tr')!;
    expect(within(dong).getByText('Cần kiểm tra lại')).toBeInTheDocument();
    expect(within(dong).getByText('2')).toBeInTheDocument();

    await user.click(theThongKe('Cần kiểm tra lại'));
    expect(await screen.findByText('Lê Văn Bình')).toBeInTheDocument();
  });

  it('lọc không ra ai -> thông báo trống', async () => {
    const user = userEvent.setup();
    renderTrang();
    await screen.findByText('Hà Thị Thanh');
    await user.click(theThongKe('Đang làm'));
    expect(await screen.findByText('Không có học viên nào khớp bộ lọc.')).toBeInTheDocument();
  });

  it('luôn hiện chú thích "Không tính nhân viên" dưới các ô thống kê', async () => {
    renderTrang();
    expect(await screen.findByText('Hà Thị Thanh')).toBeInTheDocument();
    expect(screen.getByText('Không tính nhân viên (không thực hiện khảo sát – đánh giá).')).toBeInTheDocument();
  });

  it('API lỗi -> hiện lỗi', async () => {
    server.use(
      http.get('/sso/ket-qua', () =>
        HttpResponse.json({ error: { code: 'FORBIDDEN', message: 'Không có quyền truy cập tài nguyên này' } }, { status: 403 }),
      ),
    );
    renderTrang();
    expect(await screen.findByText('Không có quyền truy cập tài nguyên này')).toBeInTheDocument();
  });
});
