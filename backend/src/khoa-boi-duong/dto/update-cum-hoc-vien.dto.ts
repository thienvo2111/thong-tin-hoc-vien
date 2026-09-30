import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trang_thai_active } from '@prisma/client';

// Body của PATCH /khoa-boi-duong/{id}/cum/{cumId} — sửa một phần (partial),
// docs/api-contract.md mục 3. Thêm 2026-09-30. Không có khoa_id — không cho
// đổi khóa cha của cụm qua endpoint này.
export class UpdateCumHocVienDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  ten_cum?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  link_zalo?: string;

  @IsOptional()
  @IsString()
  ghi_chu?: string;

  @IsOptional()
  @IsEnum(trang_thai_active)
  trang_thai?: trang_thai_active;
}
