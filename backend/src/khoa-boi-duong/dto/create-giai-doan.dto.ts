import { hinh_thuc_giai_doan } from '@prisma/client';
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

// Body của POST /khoa-boi-duong/{id}/giai-doan — docs/api-contract.md mục 3.
export class CreateGiaiDoanDto {
  @IsInt()
  @Min(1)
  thu_tu: number;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  ten_giai_doan: string;

  @IsEnum(hinh_thuc_giai_doan)
  hinh_thuc: hinh_thuc_giai_doan;

  @IsDateString()
  thoi_gian_bat_dau: string;

  @IsDateString()
  thoi_gian_ket_thuc: string;

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
