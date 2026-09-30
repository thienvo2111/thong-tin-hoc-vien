import { IsNotEmpty, IsString } from 'class-validator';

export class QuenMatKhauDto {
  // Chấp nhận ten_dang_nhap HOẶC so_dinh_danh_ca_nhan — dùng lại đúng logic
  // tìm tài khoản của POST /auth/dang-nhap (xem AuthService.timTaiKhoanTheoTenDangNhap).
  @IsString()
  @IsNotEmpty()
  ten_dang_nhap: string;
}
