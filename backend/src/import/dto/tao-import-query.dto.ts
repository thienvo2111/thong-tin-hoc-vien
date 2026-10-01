import { IsOptional, IsString, MaxLength } from 'class-validator';

// Query của POST /import/{loai} — ma_khoa tùy chọn: import từ trang chi tiết
// khóa, dòng để trống ma_khoa được gán khóa này (xem ImportService).
export class TaoImportQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ma_khoa?: string;
}
