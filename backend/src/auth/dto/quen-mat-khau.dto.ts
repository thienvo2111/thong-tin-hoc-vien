import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CAC_KIEU_DANG_NHAP, KieuDangNhap } from './kieu-dang-nhap';

export class QuenMatKhauDto {
  // Chấp nhận ten_dang_nhap HOẶC so_dinh_danh_ca_nhan — dùng lại đúng logic
  // tìm tài khoản của POST /auth/dang-nhap (xem AuthService.timTaiKhoan).
  @IsString()
  @IsNotEmpty()
  ten_dang_nhap: string;

  @IsOptional()
  @IsIn(CAC_KIEU_DANG_NHAP)
  kieu_dang_nhap?: KieuDangNhap;
}
