import { trang_thai_active } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

// T10 (issue #2) — danh mục điểm học trực tiếp. Không xóa cứng (rule #40):
// ngưng bằng PATCH trang_thai='ngung'.
export class CreateDiemHocDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_.-]{1,30}$/, {
    message: 'Mã điểm học 1–30 ký tự: chữ không dấu, số, "_", "-", "."',
  })
  ma_diem_hoc: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  ten: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  dia_chi: string;

  @IsUUID()
  dia_ban_id: string;

  @IsOptional()
  @IsUUID()
  don_vi_id?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  suc_chua?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  so_phong?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  nguoi_lien_he?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  sdt_lien_he?: string;

  @IsOptional()
  @IsString()
  ghi_chu_csvc?: string;
}

// Partial — mọi trường tùy chọn; null ở trường tùy chọn = xóa giá trị.
export class UpdateDiemHocDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_.-]{1,30}$/, {
    message: 'Mã điểm học 1–30 ký tự: chữ không dấu, số, "_", "-", "."',
  })
  ma_diem_hoc?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  ten?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  dia_chi?: string;

  @IsOptional()
  @IsUUID()
  dia_ban_id?: string;

  @IsOptional()
  @IsUUID()
  don_vi_id?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  suc_chua?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  so_phong?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  nguoi_lien_he?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  sdt_lien_he?: string | null;

  @IsOptional()
  @IsString()
  ghi_chu_csvc?: string | null;

  @IsOptional()
  @IsEnum(trang_thai_active)
  trang_thai?: trang_thai_active;
}

export class QueryDiemHocDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsUUID()
  dia_ban_id?: string;

  @IsOptional()
  @IsEnum(trang_thai_active)
  trang_thai?: trang_thai_active;
}
