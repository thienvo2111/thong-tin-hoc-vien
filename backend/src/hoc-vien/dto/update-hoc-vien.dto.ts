import { cap_hoc, trinh_do_chuyen_mon } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

// Body của PATCH /hoc-vien/toi — mọi field tùy chọn vì đây vừa là sửa hồ sơ
// nhap (tu_dang_ky) vừa là màn "bổ sung thông tin" lần đầu cho hồ sơ
// import_moet (không bắt buộc điền đủ 1 lần, xem HocVienService.validateHocVien
// với requireFull=false). Không có chuyen_mon ở đây — quản lý riêng qua
// POST/DELETE /hoc-vien/toi/chuyen-mon.
export class UpdateHocVienDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  ho_ten?: string;

  @IsOptional()
  @IsString()
  so_dinh_danh_ca_nhan?: string;

  @IsOptional()
  @IsInt()
  ngay_sinh?: number;

  @IsOptional()
  @IsInt()
  thang_sinh?: number;

  @IsOptional()
  @IsInt()
  nam_sinh?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  gioi_tinh?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  chuc_vu?: string;

  @IsOptional()
  @IsUUID()
  noi_sinh_id?: string;

  @IsOptional()
  @IsUUID()
  phuong_xa_id?: string;

  @IsOptional()
  @IsUUID()
  don_vi_cong_tac_id?: string;

  @IsOptional()
  @IsString()
  so_dien_thoai_lien_he?: string;

  @IsOptional()
  @IsString()
  email_lien_he?: string;

  @IsOptional()
  @IsEnum(trinh_do_chuyen_mon)
  trinh_do_chuyen_mon?: trinh_do_chuyen_mon;

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

  @IsOptional()
  @IsString()
  ghi_chu?: string;
}
