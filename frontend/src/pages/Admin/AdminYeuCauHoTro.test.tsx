import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '@/test/mocks/db';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import type { YeuCauHoTroQuanTri } from '@/api/types';
import AdminYeuCauHoTroPage from './AdminYeuCauHoTro';

// Handler admin (GET /yeu-cau-ho-tro, PATCH /yeu-cau-ho-tro/:id/tra-loi) nay đã có sẵn trong
// test/mocks/handlers.ts — chỉ cần nạp dữ liệu mẫu vào db.danhSachYeuCauHoTro.
function dangKyMockQuanTri(...ve: YeuCauHoTroQuanTri[]) {
  db.danhSachYeuCauHoTro = ve;
}

function taoTicket(ghiDe: Partial<YeuCauHoTroQuanTri>): YeuCauHoTroQuanTri {
  return {
    id: 'yc-1',
    hoc_vien_id: 'hv-1',
    loai_van_de_id: null,
    tinh_huong: 'Đăng nhập',
    chu_de: 'Đăng nhập',
    noi_dung_hoi: 'Tôi không đăng nhập được',
    noi_dung_tra_loi: null,
    trang_thai: 'cho_xu_ly',
    danh_gia: null,
    da_dong_hieu_luc: false,
    thoi_gian_tao: new Date().toISOString(),
    thoi_gian_phan_hoi: null,
    thoi_gian_dong: null,
    hoi_lai: false,
    hoc_vien_ho_ten: 'Bùi Thị A',
    nguoi_tra_loi_ten: null,
    ...ghiDe,
  };
}

function renderTrang() {
  datToken('token-gia-lap');
  db.nguoiDung.vai_tro = 'quan_tri';
  return renderVoiRouter([{ path: '/admin/yeu-cau-ho-tro', element: <AdminYeuCauHoTroPage /> }], {
    initialEntries: ['/admin/yeu-cau-ho-tro'],
  });
}

describe('AdminYeuCauHoTro (M8)', () => {
  it('trả lời ticket -> ticket biến mất khỏi danh sách chờ xử lý', async () => {
    dangKyMockQuanTri(taoTicket({}));

    renderTrang();
    const user = userEvent.setup();

    await screen.findByText('Tôi không đăng nhập được');
    await user.click(screen.getByRole('button', { name: /trả lời/i }));
    await user.type(screen.getByLabelText(/nội dung trả lời/i), 'Thầy/Cô thử đặt lại mật khẩu.');
    await user.click(screen.getByRole('button', { name: /gửi trả lời/i }));

    await waitFor(() => {
      expect(screen.queryByText('Tôi không đăng nhập được')).not.toBeInTheDocument();
    });
  });

  it('ticket đã trả lời vẫn còn trong lịch sử ở tab "Đã phản hồi", kèm câu trả lời', async () => {
    dangKyMockQuanTri(taoTicket({}));
    renderTrang();
    const user = userEvent.setup();

    await screen.findByText('Bùi Thị A');
    await user.click(screen.getByRole('button', { name: /trả lời/i }));
    await user.type(screen.getByLabelText(/nội dung trả lời/i), 'Thầy/Cô thử đặt lại mật khẩu.');
    await user.click(screen.getByRole('button', { name: /gửi trả lời/i }));
    await waitFor(() => expect(screen.queryByText('Tôi không đăng nhập được')).not.toBeInTheDocument());

    await user.click(screen.getByRole('radio', { name: 'Đã phản hồi' }));

    expect(await screen.findByText('Tôi không đăng nhập được')).toBeInTheDocument();
    expect(screen.getByText('Thầy/Cô thử đặt lại mật khẩu.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^trả lời$/i })).not.toBeInTheDocument();
  });

  it('tab "Đã đóng" hiện đánh giá, người trả lời của học viên', async () => {
    dangKyMockQuanTri(
      taoTicket({
        id: 'yc-2',
        noi_dung_hoi: 'Quên mật khẩu',
        noi_dung_tra_loi: 'Bấm quên mật khẩu',
        trang_thai: 'da_dong',
        da_dong_hieu_luc: true,
        danh_gia: 'chua_hai_long',
        nguoi_tra_loi_ten: 'Quản trị B',
        thoi_gian_phan_hoi: new Date().toISOString(),
      }),
    );
    renderTrang();
    const user = userEvent.setup();

    expect(await screen.findByText(/không có yêu cầu hỗ trợ nào đang chờ xử lý/i)).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Đã đóng' }));

    expect(await screen.findByText('Bấm quên mật khẩu')).toBeInTheDocument();
    expect(screen.getByText('Chưa hài lòng')).toBeInTheDocument();
    expect(screen.getByText(/Quản trị B/)).toBeInTheDocument();
  });

  it('tab "Tất cả" hiện cả ticket chờ xử lý lẫn đã đóng', async () => {
    dangKyMockQuanTri(
      taoTicket({}),
      taoTicket({ id: 'yc-3', noi_dung_hoi: 'Sai tên lớp', trang_thai: 'da_dong', da_dong_hieu_luc: true }),
    );
    renderTrang();
    const user = userEvent.setup();

    await screen.findByText('Tôi không đăng nhập được');
    expect(screen.queryByText('Sai tên lớp')).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Tất cả' }));
    expect(await screen.findByText('Sai tên lớp')).toBeInTheDocument();
    expect(screen.getByText('Tôi không đăng nhập được')).toBeInTheDocument();
  });

  it('tab không có dữ liệu -> thông báo rỗng tương ứng', async () => {
    dangKyMockQuanTri();
    renderTrang();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('radio', { name: 'Đã phản hồi' }));
    expect(await screen.findByText(/chưa có yêu cầu nào đã phản hồi/i)).toBeInTheDocument();
  });
});
