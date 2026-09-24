import { IsNotEmpty, IsString } from 'class-validator';

export class DangNhapDto {
  @IsString()
  @IsNotEmpty()
  ten_dang_nhap: string;

  @IsString()
  @IsNotEmpty()
  mat_khau: string;
}
