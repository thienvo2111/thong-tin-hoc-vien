import { hinh_thuc_giai_doan, trang_thai_active } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

// Body của PATCH /khoa-boi-duong/{id}/giai-doan/{giaiDoanId} — sửa một phần
// (partial), docs/api-contract.md mục 3. Thêm 2026-09-30. Không có khoa_id —
// không cho đổi khóa cha của giai đoạn qua endpoint này.
export class UpdateGiaiDoanDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  thu_tu?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  ten_giai_doan?: string;

  @IsOptional()
  @IsEnum(hinh_thuc_giai_doan)
  hinh_thuc?: hinh_thuc_giai_doan;

  @IsOptional()
  @IsDateString()
  thoi_gian_bat_dau?: string;

  @IsOptional()
  @IsDateString()
  thoi_gian_ket_thuc?: string;

  @IsOptional()
  @IsEnum(trang_thai_active)
  trang_thai?: trang_thai_active;

  // Phân lớp theo giai đoạn (spec 2026-10-02): thông tin chung hiện cho toàn
  // khóa ở M7 khi học viên không được gán lớp ở giai đoạn này. null = xóa.
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(500)
  link_hoac_dia_diem?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  huong_dan?: string | null;
}
