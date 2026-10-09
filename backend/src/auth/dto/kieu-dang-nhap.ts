// Spec 2026-10-09 Q-B: chế độ tìm tài khoản học viên ở đăng nhập/quên mật
// khẩu. Tùy chọn — client cũ không gửi = 'ma' (hành vi cũ + khớp bỏ số 0).
export const CAC_KIEU_DANG_NHAP = ['ma', 'sdt'] as const;
export type KieuDangNhap = (typeof CAC_KIEU_DANG_NHAP)[number];
