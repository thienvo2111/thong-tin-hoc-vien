// Menu sidebar quản trị — design/redesign-spec.md § 2 + mục 3 (10 artboard). Các mục chưa có trang
// thật (Đợt xác nhận/Báo cáo/Nhập dữ liệu/Người dùng) vẫn trỏ tới route thật, render placeholder
// "Sắp ra mắt" — không được là link chết 404 (yêu cầu phase 3). Phase 4: Khóa bồi dưỡng đã có trang
// thật (AdminKhoaBoiDuong/AdminKhoaChiTiet), bỏ tag sapRaMat.
export interface MucMenuAdmin {
  to: string;
  nhan: string;
  icon: string;
  sapRaMat?: boolean;
}

export const MENU_ADMIN: MucMenuAdmin[] = [
  { to: '/admin/tong-quan', nhan: 'Tổng quan', icon: '📊' },
  { to: '/admin/hoc-vien', nhan: 'Học viên', icon: '👥' },
  { to: '/admin/khoa-boi-duong', nhan: 'Khóa bồi dưỡng', icon: '🎓' },
  { to: '/admin/dot-xac-nhan', nhan: 'Đợt xác nhận', icon: '🗓️', sapRaMat: true },
  { to: '/admin/bao-cao', nhan: 'Báo cáo', icon: '📈', sapRaMat: true },
  { to: '/admin/nhap-du-lieu', nhan: 'Nhập dữ liệu', icon: '⇪', sapRaMat: true },
  { to: '/admin/nguoi-dung', nhan: 'Người dùng', icon: '🔑', sapRaMat: true },
];
