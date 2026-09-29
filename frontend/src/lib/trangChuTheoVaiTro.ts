/** Trang chủ sau đăng nhập/đổi mật khẩu, theo vai_tro — dùng chung cho M1 (DangNhap) và M2 (DoiMatKhau)
 * để tránh lặp logic điều hướng (trước đây cả 2 nơi đều hardcode '/toi', khiến tài khoản quản trị
 * bị đẩy nhầm vào trang chủ học viên và treo loading vô hạn vì gọi API dành riêng cho hoc_vien). */
export function trangChuTheoVaiTro(vaiTro: string | undefined): string {
  return vaiTro === 'hoc_vien' ? '/toi' : '/admin/tong-quan';
}
