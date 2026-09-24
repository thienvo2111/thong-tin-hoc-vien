import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

// Body của PATCH /khoa-boi-duong/{id} — chỉ cho phép khi trang_thai ∈
// {nhap, tu_choi} (kiểm tra ở service, không phải DTO).
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
}
