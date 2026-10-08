import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { db } from '@/test/mocks/db';
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

// 2026-10-08: mức lớp học hiệu lực + Quản trị sửa hộ (PATCH /dang-ky-hoc/{id}/muc-hoc).
describe('Admin — Chi tiết hồ sơ học viên — Mức lớp học', () => {
  function datMuc(muc_dau_vao: 'co_ban' | 'thanh_thao' | 'nang_cao' | null, muc_hoc_chon: 'co_ban' | 'thanh_thao' | null = null) {
    const dk = db.khoaHocCuaHocVien['hv-duyet-1'][0];
    dk.muc_dau_vao = muc_dau_vao;
    dk.muc_hoc_chon = muc_hoc_chon;
  }

  it('chưa có kết quả đánh giá -> chỉ hiện dòng thông báo, không có ô sửa', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    datMuc(null);
    renderTrang('hv-duyet-1');
    expect(await screen.findByText('Mức lớp học: chưa có kết quả đánh giá đầu vào')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Sửa mức lớp học' })).not.toBeInTheDocument();
  });

  it('đã tự điều chỉnh -> hiện mức hiệu lực kèm mức đánh giá gốc', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    datMuc('nang_cao', 'thanh_thao');
    renderTrang('hv-duyet-1');
    const dong = within(await screen.findByTestId('dong-muc-hoc'));
    expect(dong.getByText('Thành thạo', { selector: 'b' })).toBeInTheDocument();
    expect(dong.getByText(/học viên tự điều chỉnh từ Nâng cao/)).toBeInTheDocument();
    expect(dong.queryByText(/Đã điều chỉnh lúc/)).not.toBeInTheDocument();
  });

  it('có thời điểm điều chỉnh -> hiện "Đã điều chỉnh lúc" theo giờ Việt Nam', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    datMuc('nang_cao', 'thanh_thao');
    db.khoaHocCuaHocVien['hv-duyet-1'][0].muc_hoc_chon_luc = '2026-10-08T03:05:00.000Z';
    renderTrang('hv-duyet-1');
    const dong = within(await screen.findByTestId('dong-muc-hoc'));
    expect(dong.getByText('Đã điều chỉnh lúc 08/10/2026 10:05')).toBeInTheDocument();
  });

  it('quản trị: Select chỉ có các mức ≤ đánh giá; chọn + Lưu mức -> PATCH đúng body, báo thành công', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    datMuc('thanh_thao');
    let body: unknown;
    server.use(
      http.patch('/dang-ky-hoc/:id/muc-hoc', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ muc_dau_vao: 'thanh_thao', muc_hoc_chon: 'co_ban', muc_hoc: 'co_ban' });
      }),
    );
    const user = userEvent.setup();
    renderTrang('hv-duyet-1');
    const dong = within(await screen.findByTestId('dong-muc-hoc'));
    await user.click(dong.getByRole('textbox', { name: 'Sửa mức lớp học' }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(
      expect.arrayContaining(['Cơ bản', 'Thành thạo (theo kết quả đánh giá)']),
    );
    expect(screen.queryByRole('option', { name: /Nâng cao/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Cơ bản' }));
    await user.click(dong.getByRole('button', { name: 'Lưu mức' }));
    expect(await screen.findByText('Đã lưu mức lớp học')).toBeInTheDocument();
    expect(body).toEqual({ muc: 'co_ban' });
  });

  it('tài khoản đơn vị (trường) -> chỉ xem mức, không có ô sửa', async () => {
    db.nguoiDung.vai_tro = 'truong';
    datMuc('nang_cao');
    renderTrang('hv-duyet-1');
    expect(await screen.findByTestId('dong-muc-hoc')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Sửa mức lớp học' })).not.toBeInTheDocument();
  });
});

describe('Admin — Chi tiết hồ sơ học viên — Nhật ký hoạt động (2026-10-04)', () => {
  it('quản trị -> thấy mục Nhật ký hoạt động với dòng thời gian từ API', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    renderTrang('hv-duyet-1');
    expect(await screen.findByText('Nhật ký hoạt động')).toBeInTheDocument();
    expect(await screen.findByText('Đăng nhập thất bại')).toBeInTheDocument();
    expect(screen.getByText('Được đặt lại mật khẩu')).toBeInTheDocument();
  });

  it('tài khoản đơn vị (trường) -> không hiện mục nhật ký, không gọi API', async () => {
    db.nguoiDung.vai_tro = 'truong';
    let daGoi = false;
    server.use(
      http.get('/hoc-vien/:id/nhat-ky', () => {
        daGoi = true;
        return HttpResponse.json(db.nhatKyHocVien);
      }),
    );
    renderTrang('hv-duyet-1');
    expect(await screen.findByText('Bồi dưỡng NLS – Mức cơ bản')).toBeInTheDocument();
    expect(screen.queryByText('Nhật ký hoạt động')).not.toBeInTheDocument();
    expect(daGoi).toBe(false);
  });

  it('API nhật ký lỗi -> báo lỗi trong mục, phần còn lại của trang vẫn dùng được', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    server.use(http.get('/hoc-vien/:id/nhat-ky', () => HttpResponse.error()));
    renderTrang('hv-duyet-1');
    expect(await screen.findByText('Nhật ký hoạt động')).toBeInTheDocument();
    expect(await screen.findByText('Không kết nối được máy chủ. Kiểm tra mạng và thử lại.')).toBeInTheDocument();
    expect(screen.getByText('Bồi dưỡng NLS – Mức cơ bản')).toBeInTheDocument();
  });
});
