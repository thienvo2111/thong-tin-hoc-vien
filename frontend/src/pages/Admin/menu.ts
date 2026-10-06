// Menu sidebar quản trị — design/redesign-spec.md § 2 + mục 3 (10 artboard). Các mục chưa có trang
// thật (Người dùng) vẫn trỏ tới route thật, render placeholder "Sắp ra mắt" — không được là link chết
// 404 (yêu cầu phase 3). Phase 4: Khóa bồi dưỡng đã có trang thật, bỏ tag sapRaMat. Phase 5: Báo cáo
// (Trung tâm báo cáo) và Nhập dữ liệu đã có trang thật, bỏ tag sapRaMat. Đợt xác nhận đã có trang thật.
export interface MucMenuAdmin {
  to: string;
  nhan: string;
  icon: string;
  sapRaMat?: boolean;
  /** Chỉ hiện với quan_tri — API của màn hình chỉ cho Quản trị (2026-10-06: thêm Đợt xác nhận, Nhập dữ liệu,
   * Cấu hình khảo sát, Yêu cầu hỗ trợ; tài khoản đơn vị mở các mục này chỉ nhận lỗi không có quyền). */
  chiQuanTri?: boolean;
}

export const MENU_ADMIN: MucMenuAdmin[] = [
  { to: '/admin/tong-quan', nhan: 'Tổng quan', icon: '📊' },
  { to: '/admin/hoc-vien', nhan: 'Học viên', icon: '👥' },
  { to: '/admin/khoa-boi-duong', nhan: 'Khóa bồi dưỡng', icon: '🎓' },
  { to: '/admin/dot-xac-nhan', nhan: 'Đợt xác nhận', icon: '🗓️', chiQuanTri: true },
  { to: '/admin/bao-cao', nhan: 'Báo cáo', icon: '📈' },
  { to: '/admin/nhap-du-lieu', nhan: 'Nhập dữ liệu', icon: '⇪', chiQuanTri: true },
  { to: '/admin/cau-hinh-khao-sat', nhan: 'Cấu hình khảo sát', icon: '📝', chiQuanTri: true },
  { to: '/admin/tinh-hinh-khao-sat', nhan: 'Tình hình khảo sát', icon: '📋', chiQuanTri: true },
  { to: '/admin/yeu-cau-ho-tro', nhan: 'Yêu cầu hỗ trợ', icon: '💬', chiQuanTri: true },
  { to: '/admin/danh-muc-truong', nhan: 'Danh mục trường', icon: '🏫' },
  { to: '/admin/diem-hoc', nhan: 'Điểm học', icon: '📍', chiQuanTri: true },
  { to: '/admin/giang-vien', nhan: 'Giảng viên', icon: '🧑‍🏫', chiQuanTri: true },
  { to: '/admin/nguoi-dung', nhan: 'Người dùng', icon: '🔑', chiQuanTri: true },
  { to: '/admin/tai-khoan-hoc-vien', nhan: 'Tài khoản học viên', icon: '🪪', chiQuanTri: true },
  { to: '/admin/nguoi-ho-tro', nhan: 'Người hỗ trợ', icon: '🤝', chiQuanTri: true },
  { to: '/admin/huong-dan', nhan: 'Hướng dẫn', icon: '📘' },
];
