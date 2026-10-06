import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import AdminBaoCao from './AdminBaoCao';

function renderTrang() {
  datToken('token-gia-lap');
  return renderVoiRouter([{ path: '/admin/bao-cao', element: <AdminBaoCao /> }], { initialEntries: ['/admin/bao-cao'] });
}

describe('Admin — Trung tâm báo cáo', () => {
  it('hiện đủ 7 thẻ báo cáo thật (khớp API docs/api-contract.md mục 7)', () => {
    renderTrang();
    expect(screen.getByText('Báo cáo tổng hợp')).toBeInTheDocument();
    expect(screen.getByText('Báo cáo xác nhận')).toBeInTheDocument();
    expect(screen.getByText('Sửa trường MOET')).toBeInTheDocument();
    expect(screen.getByText('Xuất cho VLE')).toBeInTheDocument();
    expect(screen.getByText('Điều kiện đánh giá đầu vào')).toBeInTheDocument();
    expect(screen.getByText('Vận hành theo lớp')).toBeInTheDocument();
    expect(screen.getByText('Giờ dạy')).toBeInTheDocument();
  });

  // T11 (issue #3)
  it('giờ dạy: Xem hiện dữ liệu giảng viên × lớp', async () => {
    const user = userEvent.setup();
    renderTrang();
    const the = within(screen.getByTestId('the-bao-cao-gio-day'));
    await user.click(the.getByRole('button', { name: 'Xem' }));
    expect(await screen.findByText('Nguyễn Văn Long')).toBeInTheDocument();
  });

  it('báo cáo tổng hợp: không cần chọn tham số bắt buộc, Xem hiện đúng dữ liệu thật trả về', async () => {
    const user = userEvent.setup();
    renderTrang();
    const the = within(screen.getByTestId('the-bao-cao-tong-hop'));
    await user.click(the.getByRole('button', { name: 'Xem' }));
    expect(await screen.findByText('THPT Long Xuyên')).toBeInTheDocument();
  });

  it('báo cáo xác nhận: dot_id bắt buộc — Xem/Xuất Excel bị vô hiệu hóa cho đến khi chọn đợt', async () => {
    const user = userEvent.setup();
    renderTrang();
    const the = within(screen.getByTestId('the-bao-cao-xac-nhan'));

    expect(the.getByRole('button', { name: 'Xem' })).toBeDisabled();
    expect(the.getByRole('button', { name: /Xuất Excel/ })).toBeDisabled();

    // Select required render nhãn dạng "Đợt xác nhận *" (dấu * trong span con) — khớp bằng regex tiền tố,
    // giống quy ước đã dùng ở AdminKhoaBoiDuong.test.tsx cho TextInput required.
    await waitFor(() => expect(the.getByLabelText(/^Đợt xác nhận/)).toBeEnabled());
    await user.click(the.getByLabelText(/^Đợt xác nhận/));
    await user.click(await screen.findByRole('option', { name: 'Kiểm tra hồ sơ đợt 1' }));

    expect(the.getByRole('button', { name: 'Xem' })).toBeEnabled();
    await user.click(the.getByRole('button', { name: 'Xem' }));
    expect(await screen.findByText('Lê Văn Bình')).toBeInTheDocument();
  });

  it('sửa trường MOET: khoa_id bắt buộc — chọn khóa rồi Xem mới gọi API và hiện dữ liệu', async () => {
    const user = userEvent.setup();
    renderTrang();
    const the = within(screen.getByTestId('the-bao-cao-sua-truong-moet'));

    expect(the.getByRole('button', { name: 'Xem' })).toBeDisabled();

    await waitFor(() => expect(the.getByLabelText(/^Khóa bồi dưỡng/)).toBeEnabled());
    await user.click(the.getByLabelText(/^Khóa bồi dưỡng/));
    await user.click(await screen.findByRole('option', { name: 'AG-2026-014 — Bồi dưỡng NLS – Mức cơ bản' }));

    await user.click(the.getByRole('button', { name: 'Xem' }));
    expect(await screen.findByText('Võ Minh Khôi')).toBeInTheDocument();
  });

  it('xuất cho VLE: chỉ có nút Xuất Excel, không có nút Xem (không có endpoint JSON xem trước)', () => {
    renderTrang();
    const the = within(screen.getByTestId('the-bao-cao-xuat-cho-vle'));
    expect(the.queryByRole('button', { name: 'Xem' })).not.toBeInTheDocument();
    expect(the.getByRole('button', { name: /Xuất Excel/ })).toBeInTheDocument();
  });

  it('lỗi API khi xem báo cáo: hiện thông báo lỗi thay vì màn trắng', async () => {
    server.use(http.get('/bao-cao/tong-hop', () => HttpResponse.error()));
    const user = userEvent.setup();
    renderTrang();
    const the = within(screen.getByTestId('the-bao-cao-tong-hop'));
    await user.click(the.getByRole('button', { name: 'Xem' }));
    expect(await screen.findByText('Không kết nối được máy chủ. Kiểm tra mạng và thử lại.')).toBeInTheDocument();
  });
});
