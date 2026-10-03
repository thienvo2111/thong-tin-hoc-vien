import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import AdminNhapDuLieu, { nhanLoaiImport } from './AdminNhapDuLieu';

// 11 giá trị enum THẬT của loai_danh_muc_import — chép nguyên văn từ docs/database-ddl.sql
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
  'diem_danh',
  'ket_qua_giai_doan',
  'nhan_su_lop',
  'tai_khoan_don_vi',
] as const;

function renderTrang(initialEntries = ['/admin/nhap-du-lieu']) {
  datToken('token-gia-lap');
  return renderVoiRouter([{ path: '/admin/nhap-du-lieu', element: <AdminNhapDuLieu /> }], { initialEntries });
}

describe('Admin — Nhập dữ liệu', () => {
  it('hiện lịch sử nhập dữ liệu thật, đúng nhãn loại + ngày giờ + badge trạng thái', async () => {
    renderTrang();
    const bang = await screen.findByRole('table');
    const dongThanhCong = within(bang).getByText('Hồ sơ nhân sự (CSDL MOET)').closest('tr') as HTMLElement;
    const dongCoLoi = within(bang).getByText('Phân lớp học viên (MOET)').closest('tr') as HTMLElement;
    // import-3 (mock): trang_thai='loi' cấp file (không đọc được file) nhưng so_dong_loi=0 — ca lỗi
    // thật đã gặp khiến badge từng hiện nhầm "Thành công" do suy trạng thái chỉ từ so_dong_loi.
    const dongLoiFile = within(bang).getByText('Danh mục địa danh').closest('tr') as HTMLElement;

    // "Thành công" cũng là tên cột (header) — thu hẹp về đúng dòng để tránh trùng chữ với tiêu đề cột.
    expect(within(dongThanhCong).getByText('Thành công')).toBeInTheDocument();
    // Cột "Thời gian" phải đọc field thoi_gian_import (KHÔNG phải created_at, field không tồn tại
    // trong response thật) — 2026-09-29T02:12:00.000Z giờ Việt Nam (UTC+7) là 29/09/2026 09:12.
    expect(within(dongThanhCong).getByText('29/09/2026 09:12')).toBeInTheDocument();

    expect(within(dongCoLoi).getByText('Có lỗi')).toBeInTheDocument();

    expect(within(dongLoiFile).getByText('Lỗi')).toBeInTheDocument();
    expect(within(dongLoiFile).queryByText('Thành công')).not.toBeInTheDocument();
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

  it('lịch sử: job đã validate xong nhưng chưa xác nhận (dang_xu_ly, so_dong_thanh_cong>0) hiện nút "Xác nhận →"; job 100% lỗi (so_dong_thanh_cong=0) thì không', async () => {
    renderTrang();
    const bang = await screen.findByRole('table');
    const dongChuaXacNhan = within(bang).getByText('Kết quả đánh giá (đầu vào/đầu ra)').closest('tr') as HTMLElement;
    const dongLoiFile = within(bang).getByText('Danh mục địa danh').closest('tr') as HTMLElement;
    const dongDaHoanThanh = within(bang).getByText('Hồ sơ nhân sự (CSDL MOET)').closest('tr') as HTMLElement;

    expect(within(dongChuaXacNhan).getByRole('button', { name: 'Xác nhận →' })).toBeInTheDocument();
    expect(within(dongLoiFile).queryByRole('button', { name: 'Xác nhận →' })).not.toBeInTheDocument();
    expect(within(dongDaHoanThanh).queryByRole('button', { name: 'Xác nhận →' })).not.toBeInTheDocument();
  });

  it('bấm "Xác nhận →" ở 1 job cũ trong lịch sử: mở lại panel xác nhận đúng id đó (không cần upload lại file)', async () => {
    const user = userEvent.setup();
    const yeuCauImportChiTiet: string[] = [];
    server.use(
      http.get('/import/:id', ({ params }) => {
        yeuCauImportChiTiet.push(params.id as string);
        return HttpResponse.json({
          id: 'import-4',
          trang_thai: 'dang_xu_ly',
          tong_so_dong: 7,
          so_dong_thanh_cong: 6,
          so_dong_loi: 1,
          danh_sach_loi: [{ dong: 4, ly_do: 'Thiếu điểm đánh giá đầu ra' }],
          danh_sach_canh_bao: [],
          so_hoc_vien_chua_co_email: 0,
        });
      }),
    );
    renderTrang();
    const bang = await screen.findByRole('table');
    const dongChuaXacNhan = within(bang).getByText('Kết quả đánh giá (đầu vào/đầu ra)').closest('tr') as HTMLElement;

    await user.click(within(dongChuaXacNhan).getByRole('button', { name: 'Xác nhận →' }));

    expect(await screen.findByText('Kết quả kiểm tra')).toBeInTheDocument();
    // Panel phải render preview thật (không kẹt ở "Đang xử lý...") dù trang_thai vẫn 'dang_xu_ly',
    // vì đã có tong_so_dong > 0 — job đã validate xong, chỉ đang chờ xác nhận.
    expect(screen.queryByText('Đang xử lý file, vui lòng chờ...')).not.toBeInTheDocument();
    expect(screen.getByText('Thiếu điểm đánh giá đầu ra')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xác nhận nạp dữ liệu' })).toBeEnabled();
    expect(yeuCauImportChiTiet).toContain('import-4');
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

  it('nhan_su_lop có nhãn riêng, không hiện giá trị thô', () => {
    expect(nhanLoaiImport('nhan_su_lop')).toBe('Nhân sự lớp (giảng viên/hỗ trợ)');
  });

  it('tải lên từ trang Nhập dữ liệu không gửi kèm ?ma_khoa', async () => {
    const urls: string[] = [];
    server.use(
      http.post('/import/:loai', ({ request }) => {
        urls.push(request.url);
        return undefined;
      }),
    );
    const user = userEvent.setup();
    const { container } = renderTrang();
    await screen.findByRole('table');
    await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, new File(['x'], 'a.xlsx'));
    await user.click(screen.getByRole('button', { name: 'Tải lên & kiểm tra' }));

    await screen.findByText('Kết quả kiểm tra');
    expect(new URL(urls[0]).search).toBe('');
  });

  it('loại "Phân lớp học viên": bắt chọn khóa trước khi tải lên; upload gửi ?ma_khoa', async () => {
    const urls: string[] = [];
    server.use(
      http.post('/import/:loai', ({ request }) => {
        urls.push(request.url);
        return undefined;
      }),
    );
    const user = userEvent.setup();
    const { container } = renderTrang();
    await screen.findByRole('table');
    await user.click(screen.getByRole('textbox', { name: 'Loại dữ liệu' }));
    await user.click(await screen.findByRole('option', { name: 'Phân lớp học viên (MOET)' }));
    await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, new File(['x'], 'pl.xlsx'));
    expect(screen.getByRole('button', { name: 'Tải lên & kiểm tra' })).toBeDisabled();

    await user.click(screen.getByRole('textbox', { name: /Khóa bồi dưỡng/ }));
    await user.click(await screen.findByRole('option', { name: /AG-2026-014/ }));
    await user.click(screen.getByRole('button', { name: 'Tải lên & kiểm tra' }));
    await screen.findByText('Kết quả kiểm tra');
    expect(new URL(urls[0]).searchParams.get('ma_khoa')).toBe('AG-2026-014');
  });

  it('giá trị enum lạ (chưa kịp cập nhật nhãn) hiện nguyên giá trị thô, không để trống', () => {
    expect(nhanLoaiImport('gia_tri_enum_moi_chua_co_nhan')).toBe('gia_tri_enum_moi_chua_co_nhan');
  });

  it('?loai=tai_khoan_don_vi: chọn sẵn loại "Tài khoản đơn vị"', async () => {
    renderTrang(['/admin/nhap-du-lieu?loai=tai_khoan_don_vi']);
    await screen.findByRole('table');
    expect(screen.getByDisplayValue('Tài khoản đơn vị')).toBeInTheDocument();
  });

  it('tài khoản đơn vị: xác nhận nạp tự tải file mật khẩu tạm, giữ panel với tóm tắt + nút tải lại', async () => {
    let soLanXacNhan = 0;
    server.use(
      http.post('/import/:id/xac-nhan', () => {
        soLanXacNhan++;
        return new HttpResponse(new Blob(['xlsx']), {
          headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        });
      }),
    );
    const user = userEvent.setup();
    const { container } = renderTrang(['/admin/nhap-du-lieu?loai=tai_khoan_don_vi']);
    await screen.findByRole('table');
    const oFile = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(oFile, new File(['x'], 'tai-khoan.xlsx'));
    await user.click(screen.getByRole('button', { name: 'Tải lên & kiểm tra' }));
    await user.click(await screen.findByRole('button', { name: 'Xác nhận nạp dữ liệu' }));

    expect(await screen.findByText(/Đã tạo 4 tài khoản/)).toBeInTheDocument();
    expect(screen.getByText('File mật khẩu tạm chỉ tải được trong phiên màn hình này. Đóng lại sẽ không lấy lại được.')).toBeInTheDocument();
    expect(vi.mocked(URL.createObjectURL)).toHaveBeenCalled();
    const soLanTaiDau = vi.mocked(URL.createObjectURL).mock.calls.length;
    await user.click(screen.getByRole('button', { name: 'Tải file mật khẩu tạm' }));
    expect(vi.mocked(URL.createObjectURL).mock.calls.length).toBe(soLanTaiDau + 1);
    expect(soLanXacNhan).toBe(1);
    expect(screen.getByText('Kết quả kiểm tra')).toBeInTheDocument();
  });
});
