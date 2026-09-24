import { cap_hoc, trinh_do_chuyen_mon } from '@prisma/client';
import {
  ArrayMinSize,
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

// Body của POST /hoc-vien (tự đăng ký, nguon_tao='tu_dang_ky') — theo
// docs/api-contract.md mục 2 + docs/validation-checklist.md #1-26b. Field
// nào bắt buộc-có-điều-kiện theo nguon_tao (CCCD, nơi sinh, phường xã, email,
// trình độ, chuyên môn) đều bắt buộc ở DTO này vì luồng tự đăng ký luôn có
// đủ — điều kiện chỉ áp dụng khi PATCH hồ sơ import_moet, xem UpdateHocVienDto.
export class CreateHocVienDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  ho_ten: string;

  @IsString()
  so_dinh_danh_ca_nhan: string;

  @IsInt()
  ngay_sinh: number;

  @IsInt()
  thang_sinh: number;

  @IsInt()
  nam_sinh: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  gioi_tinh?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  chuc_vu?: string;

  @IsUUID()
  noi_sinh_id: string;

  @IsUUID()
  phuong_xa_id: string;

  @IsUUID()
  don_vi_cong_tac_id: string;

  @IsString()
  so_dien_thoai_lien_he: string;

  @IsString()
  email_lien_he: string;

  @IsEnum(trinh_do_chuyen_mon)
  trinh_do_chuyen_mon: trinh_do_chuyen_mon;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  trinh_do_chuyen_mon_khac?: string;

  @IsOptional()
  @IsEnum(cap_hoc)
  cap_giang_day?: cap_hoc;

  @IsOptional()
  @IsUUID()
  mon_giang_day_id?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(1)
  @IsString({ each: true })
  chuyen_mon: string[];

  @IsOptional()
  @IsString()
  ghi_chu?: string;
}
