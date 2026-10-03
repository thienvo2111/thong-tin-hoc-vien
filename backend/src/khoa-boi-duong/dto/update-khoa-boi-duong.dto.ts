import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

// Body của PATCH /khoa-boi-duong/{id} — quan_tri sửa được ở mọi trạng thái
// (D6/spec mục 4). don_vi_dat_hang_id tùy chọn: không gửi = giữ nguyên, có
// gửi = validate lại bằng validateDonViDatHang() ở service (cùng quy tắc tạo
// khóa).
export class UpdateKhoaBoiDuongDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  ma_khoa?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  ten_khoa?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  dia_diem?: string;

  @IsOptional()
  @IsDateString()
  thoi_gian_bat_dau?: string;

  @IsOptional()
  @IsDateString()
  thoi_gian_ket_thuc?: string;

  @IsOptional()
  @IsUUID()
  don_vi_dat_hang_id?: string;
}
