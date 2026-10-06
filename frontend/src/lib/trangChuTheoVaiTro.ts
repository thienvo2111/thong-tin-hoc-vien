/** Trang chủ sau đăng nhập/đổi mật khẩu, theo vai_tro — dùng chung cho M1 (DangNhap) và M2 (DoiMatKhau)
 * để tránh lặp logic điều hướng (trước đây cả 2 nơi đều hardcode '/toi', khiến tài khoản quản trị
 * bị đẩy nhầm vào trang chủ học viên và treo loading vô hạn vì gọi API dành riêng cho hoc_vien). */
export function trangChuTheoVaiTro(vaiTro: string | undefined): string {
  if (vaiTro === 'hoc_vien') return '/toi';
  // ADR 0003: người hỗ trợ học viên có khu làm việc riêng, không vào /admin.
  if (vaiTro === 'ho_tro_hoc_vien') return '/ho-tro';
  // ADR 0004: người hỗ trợ giảng viên — trang /ho-tro-gv (API ở /ho-tro-giang-vien, không trùng tiền tố).
  if (vaiTro === 'ho_tro_giang_vien') return '/ho-tro-gv';
  // ADR 0004 G8: cổng giảng viên — trang /giang-day (API /cong-giang-vien; /giang-vien là API danh mục).
  if (vaiTro === 'giang_vien') return '/giang-day';
  return '/admin/tong-quan';
}
