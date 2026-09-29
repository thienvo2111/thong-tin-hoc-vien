import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import AdminNhapDuLieu, { nhanLoaiImport } from './AdminNhapDuLieu';

// 8 giá trị enum THẬT của loai_danh_muc_import — chép nguyên văn từ docs/database-ddl.sql
// (CREATE TYPE loai_danh_muc_import), không đoán/bịa. Nếu enum này được mở rộng thêm ở backend,
// cập nhật danh sách này (và nhãn tương ứng trong AdminNhapDuLieu.tsx) trong cùng 1 lần sửa.
const CAC_GIA_TRI_ENUM_LOAI_DANH_MUC_IMPORT = [
  'dia_danh',
  'don_vi_cong_tac',
  'mon_hoc',
  'phan_lop_hoc_vien',
  'ho_so_nhan_su_moet',
  'tai_khoan_vle',
  'ket_qua_danh_gia',
  'lop_va_lich_hoc',
] as const;

function renderTrang() {
  datToken('token-gia-lap');
  return renderVoiRouter([{ path: '/admin/nhap-du-lieu', element: <AdminNhapDuLieu /> }], { initialEntries: ['/admin/nhap-du-lieu'] });
}

describe('Admin — Nhập dữ liệu', () => {
  it('hiện lịch sử nhập dữ liệu thật, đúng nhãn loại + badge trạng thái', async () => {
    renderTrang();
    const bang = await screen.findByRole('table');
    const dongThanhCong = within(bang).getByText('Hồ sơ nhân sự (CSDL MOET)').closest('tr') as HTMLElement;
    const dongLoi = within(bang).getByText('Phân lớp học viên (MOET)').closest('tr') as HTMLElement;
    // "Thành công" cũng là tên cột (header) — thu hẹp về đúng dòng để tránh trùng chữ với tiêu đề cột.
    expect(within(dongThanhCong).getByText('Thành công')).toBeInTheDocument();
    expect(within(dongLoi).getByText('Có lỗi')).toBeInTheDocument();
  });

  it('chưa chọn file: nút "Tải lên & kiểm tra" bị vô hiệu hóa', async () => {
    renderTrang();
    await screen.findByRole('table');
    expect(screen.getByRole('button', { name: 'Tải lên & kiểm tra' })).toBeDisabled();
  });

  it('luồng 2 bước: tải file lên -> xem preview lỗi/cảnh báo -> bấm xác nhận mới nạp chính thức', async () => {
    const user = userEvent.setup();
    const { container } = renderTrang();
    await screen.findByRole('table');

    // FileInput của Mantine ẩn <input type="file"> thật (không gắn label trực tiếp, xem FileButton) —
    // truy cập qua selector thay vì getByLabelText.
    const oFile = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['noi-dung'], 'ho-so-nhan-su.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    await user.upload(oFile, file);

    const nutTaiLen = screen.getByRole('button', { name: 'Tải lên & kiểm tra' });
    expect(nutTaiLen).toBeEnabled();
    await user.click(nutTaiLen);

    expect(await screen.findByText('Kết quả kiểm tra')).toBeInTheDocument();
    expect(await screen.findByText('Mã định danh trùng đã tồn tại')).toBeInTheDocument();

    const nutXacNhan = screen.getByRole('button', { name: 'Xác nhận nạp dữ liệu' });
    expect(nutXacNhan).toBeEnabled();
    await user.click(nutXacNhan);

    // Xác nhận xong -> đóng panel preview, không còn "Kết quả kiểm tra" trên màn hình.
    await screen.findByRole('table');
    expect(screen.queryByText('Kết quả kiểm tra')).not.toBeInTheDocument();
  });

  it('lỗi API khi tải lịch sử: hiện thông báo lỗi thay vì màn trắng', async () => {
    server.use(http.get('/import', () => HttpResponse.error()));
    renderTrang();
    expect(await screen.findByText('Không kết nối được máy chủ. Kiểm tra mạng và thử lại.')).toBeInTheDocument();
  });

  it('mọi giá trị enum loai_danh_muc_import thật đều có nhãn hiển thị khác rỗng', () => {
    for (const giaTri of CAC_GIA_TRI_ENUM_LOAI_DANH_MUC_IMPORT) {
      const nhan = nhanLoaiImport(giaTri);
      expect(nhan).not.toBe('');
      expect(nhan.trim().length).toBeGreaterThan(0);
    }
  });

  it('giá trị enum lạ (chưa kịp cập nhật nhãn) hiện nguyên giá trị thô, không để trống', () => {
    expect(nhanLoaiImport('gia_tri_enum_moi_chua_co_nhan')).toBe('gia_tri_enum_moi_chua_co_nhan');
  });
});
