import { che_do_chuyen_can } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
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

  // 2026-10-08: công tắc cho học viên tự điều chỉnh mức lớp học.
  @IsOptional()
  @IsBoolean()
  mo_dieu_chinh_muc?: boolean;

  // ADR 0005 (issue #23): bật = ghi mốc bat_diem_danh_zoom_luc (giữ mốc cũ
  // nếu đã bật), tắt = NULL. Khoảng phút khớp CHECK trong migration.
  @IsOptional()
  @IsBoolean()
  bat_diem_danh_zoom?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(180)
  diem_danh_mo_truoc_phut?: number;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(720)
  diem_danh_dong_sau_phut?: number;

  @IsOptional()
  @IsEnum(che_do_chuyen_can)
  che_do_chuyen_can?: che_do_chuyen_can;
}
