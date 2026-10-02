import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MauExcelQueryDto {
  @IsString()
  loai: string;

  // Bắt buộc với phan_lop_hoc_vien (cột sinh theo giai đoạn của khóa).
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ma_khoa?: string;
}
