import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import AdminHocVienChiTiet from './AdminHocVienChiTiet';

// Thêm 2026-09-30 (QĐ10, docs/api-contract.md mục 3) — phần "Khóa & lớp" mới thêm vào trang
// AdminHocVienChiTiet (placeholder tối thiểu, xem comment đầu file .tsx): sửa tay phân lớp theo
// giai đoạn (spec 2026-10-02) + cụm hỗ trợ Zalo cho từng khóa mà học viên (đã da_duyet) ghi danh — GET /hoc-vien/{id}/khoa-hoc,
// PUT /dang-ky-hoc/{id}/giai-doan/{gd}/lop, PATCH /dang-ky-hoc/{id}/cum (mock ở test/mocks/handlers.ts,
// dữ liệu mẫu ở test/mocks/db.ts#taoKhoaHocCuaHocVienMau + taoChiTietKhoaMau).
function renderTrang(id: string) {
  datToken('token-gia-lap');
  return renderVoiRouter([{ path: '/admin/hoc-vien/:id', element: <AdminHocVienChiTiet /> }], {
    initialEntries: [`/admin/hoc-vien/${id}`],
  });
}

describe('Admin — Chi tiết hồ sơ học viên — Khóa & lớp (QĐ10)', () => {
  it('hiện tên khóa đã ghi danh + 1 dòng phân lớp mỗi giai đoạn + dòng cụm hỗ trợ Zalo', async () => {
    renderTrang('hv-duyet-1');

    expect(await screen.findByText('Bồi dưỡng NLS – Mức cơ bản')).toBeInTheDocument();
    // getByRole('textbox', ...) thay vì getByLabelText: dropdown (role=listbox, ẩn/portal) của Select
    // cũng mang aria-labelledby trỏ tới đúng label này — getByLabelText khớp cả 2, gây lỗi "multiple
    // elements", trong khi getByRole('textbox') chỉ khớp đúng ô input (giống quy ước AdminKhoaBoiDuong.test.tsx).
    // Phân lớp theo giai đoạn (spec 2026-10-02): khoa-1 có 4 giai đoạn active.
    expect(await screen.findByRole('textbox', { name: 'GĐ1 · Đánh giá đầu vào' })).toBeInTheDocument();
    expect(screen.getAllByRole('textbox', { name: /^GĐ\d/ })).toHaveLength(4);
    expect(screen.getByRole('textbox', { name: 'Cụm hỗ trợ Zalo' })).toBeInTheDocument();
  });

  it('học viên chưa ghi danh khóa nào -> thông báo "Chưa ghi danh khóa nào."', async () => {
    renderTrang('hv-cho-1');
    expect(await screen.findByText('Chưa ghi danh khóa nào.')).toBeInTheDocument();
  });

  it('chọn lớp cho GĐ2 rồi bấm Lưu -> gọi PUT /dang-ky-hoc/{id}/giai-doan/{gd}/lop, hiện thông báo thành công', async () => {
    const user = userEvent.setup();
    renderTrang('hv-duyet-1');
    await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');

    await user.click(await screen.findByRole('textbox', { name: 'GĐ2 · Học trực tiếp' }));
    await user.click(await screen.findByRole('option', { name: 'Lớp 01 – Nhóm cơ bản A (Trực tiếp)' }));
    await user.click(screen.getAllByRole('button', { name: 'Lưu' })[1]);

    expect(await screen.findByText('Đã lưu phân lớp')).toBeInTheDocument();
  });

  it('chọn cụm hỗ trợ Zalo rồi bấm Lưu -> gọi đúng API PATCH /dang-ky-hoc/{id}/cum, hiện thông báo thành công', async () => {
    const user = userEvent.setup();
    renderTrang('hv-duyet-1');
    await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');

    const dongCum = within(await screen.findByTestId('dong-cum'));
    await user.click(dongCum.getByRole('textbox', { name: 'Cụm hỗ trợ Zalo' }));
    await user.click(await screen.findByRole('option', { name: 'Cụm Long Xuyên' }));
    await user.click(dongCum.getByRole('button', { name: 'Lưu' }));

    expect(await screen.findByText('Đã lưu cụm')).toBeInTheDocument();
  });

  it('lỗi từ API khi lưu phân lớp -> hiện notification màu đỏ với thông điệp lỗi', async () => {
    server.use(http.put('/dang-ky-hoc/:id/giai-doan/:gdId/lop', () => HttpResponse.error()));
    const user = userEvent.setup();
    renderTrang('hv-duyet-1');
    await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');

    await user.click(await screen.findByRole('textbox', { name: 'GĐ2 · Học trực tiếp' }));
    await user.click(await screen.findByRole('option', { name: 'Lớp 01 – Nhóm cơ bản A (Trực tiếp)' }));
    await user.click(screen.getAllByRole('button', { name: 'Lưu' })[1]);

    expect(await screen.findByText('Không kết nối được máy chủ. Kiểm tra mạng và thử lại.')).toBeInTheDocument();
  });
});
