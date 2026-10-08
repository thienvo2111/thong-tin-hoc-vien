import { describe, expect, it, vi } from 'vitest';
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
  it('hiện đủ 9 thẻ báo cáo thật (khớp API docs/api-contract.md mục 7)', () => {
    renderTrang();
    expect(screen.getByText('Báo cáo tổng hợp')).toBeInTheDocument();
    expect(screen.getByText('Báo cáo xác nhận')).toBeInTheDocument();
    expect(screen.getByText('Sửa trường MOET')).toBeInTheDocument();
    expect(screen.getByText('Xuất cho VLE')).toBeInTheDocument();
    expect(screen.getByText('Điều kiện đánh giá đầu vào')).toBeInTheDocument();
    expect(screen.getByText('Vận hành theo lớp')).toBeInTheDocument();
    expect(screen.getByText('Giờ dạy')).toBeInTheDocument();
    expect(screen.getByText('Xuất Excel tổng quan')).toBeInTheDocument();
    expect(screen.getByText('Biểu mẫu đăng ký & truy cập')).toBeInTheDocument();
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

  it('tổng quan: Xuất Excel gọi /bao-cao/tong-quan/xuat-excel với khoa_id đã chọn', async () => {
    const queries: URLSearchParams[] = [];
    server.use(
      http.get('/bao-cao/tong-quan/xuat-excel', ({ request }) => {
        queries.push(new URL(request.url).searchParams);
        return new HttpResponse('xlsx', {
          headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        });
      }),
    );
    const user = userEvent.setup();
    renderTrang();
    const the = within(screen.getByTestId('the-bao-cao-tong-quan'));
    await waitFor(() => expect(the.getByLabelText(/^Khóa bồi dưỡng/)).toBeEnabled());
    await user.click(the.getByLabelText(/^Khóa bồi dưỡng/));
    await user.click(await screen.findByRole('option', { name: 'AG-2026-014 — Bồi dưỡng NLS – Mức cơ bản' }));
    await user.click(the.getByRole('button', { name: /Xuất Excel/ }));
    await waitFor(() => expect(queries).toHaveLength(1));
    expect(queries[0].get('khoa_id')).toBeTruthy();
  });

  it('biểu mẫu đăng ký & truy cập: Xuất Excel gọi endpoint với khoa_id và doi_tuong đã chọn', async () => {
    const queries: URLSearchParams[] = [];
    server.use(
      http.get('/thong-ke/bieu-mau/dang-ky-truy-cap/xuat-excel', ({ request }) => {
        queries.push(new URL(request.url).searchParams);
        return new HttpResponse('xlsx', {
          headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        });
      }),
    );
    URL.createObjectURL = vi.fn(() => 'blob:gia-lap');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const user = userEvent.setup();
    renderTrang();
    const the = within(screen.getByTestId('the-bao-cao-bieu-mau-dang-ky-truy-cap'));
    await waitFor(() => expect(the.getByLabelText(/^Khóa bồi dưỡng/)).toBeEnabled());
    await user.click(the.getByLabelText(/^Khóa bồi dưỡng/));
    await user.click(await screen.findByRole('option', { name: 'AG-2026-014 — Bồi dưỡng NLS – Mức cơ bản' }));
    await user.click(the.getByLabelText(/^Đối tượng/));
    await user.click(await screen.findByRole('option', { name: 'Giáo viên' }));
    await user.click(the.getByRole('button', { name: /Xuất Excel/ }));
    await waitFor(() => expect(queries).toHaveLength(1));
    expect(queries[0].get('khoa_id')).toBeTruthy();
    expect(queries[0].get('doi_tuong')).toBe('giao_vien');
  });

  it('biểu mẫu đăng ký & truy cập: không chọn gì thì không gửi tham số lọc', async () => {
    const queries: URLSearchParams[] = [];
    server.use(
      http.get('/thong-ke/bieu-mau/dang-ky-truy-cap/xuat-excel', ({ request }) => {
        queries.push(new URL(request.url).searchParams);
        return new HttpResponse('xlsx');
      }),
    );
    URL.createObjectURL = vi.fn(() => 'blob:gia-lap');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const user = userEvent.setup();
    renderTrang();
    const the = within(screen.getByTestId('the-bao-cao-bieu-mau-dang-ky-truy-cap'));
    await user.click(the.getByRole('button', { name: /Xuất Excel/ }));
    await waitFor(() => expect(queries).toHaveLength(1));
    expect(queries[0].toString()).toBe('');
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
