import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CAC_KIEU_DANG_NHAP, KieuDangNhap } from './kieu-dang-nhap';

export class DangNhapDto {
  // Chế độ 'ma': tên đăng nhập / CCCD / mã MOET; chế độ 'sdt': số điện thoại.
  @IsString()
  @IsNotEmpty()
  ten_dang_nhap: string;

  @IsString()
  @IsNotEmpty()
  mat_khau: string;

  @IsOptional()
  @IsIn(CAC_KIEU_DANG_NHAP)
  kieu_dang_nhap?: KieuDangNhap;
}
