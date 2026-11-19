import AdminNhapDuLieu from '@/pages/Admin/AdminNhapDuLieu';

/** Nhập tài khoản đơn vị từ Excel trên Cổng đơn vị (issue #57, ADR 0015 T4) — dùng lại màn Nhập dữ liệu,
 * khóa cứng loại `tai_khoan_don_vi` (giữ nguyên luồng tải file mật khẩu tạm 1 lần). */
export default function QuanTriNhapTaiKhoanDonVi() {
  return <AdminNhapDuLieu chiLoai="tai_khoan_don_vi" />;
}
