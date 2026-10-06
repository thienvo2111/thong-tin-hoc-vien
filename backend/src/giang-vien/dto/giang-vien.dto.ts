import { trang_thai_active, vai_tro_nhan_su_lop } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

// T11 (issue #3) — danh mục giảng viên. SĐT bắt buộc + duy nhất, email tùy
// chọn + duy nhất (định dạng kiểm ở service để dùng chung với import).
export class CreateGiangVienDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  ho_ten: string;

  @IsString()
  @MaxLength(20)
  so_dien_thoai: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  don_vi_cong_tac?: string;

  @IsOptional()
  @IsString()
  ghi_chu?: string;
}

export class UpdateGiangVienDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  ho_ten?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  so_dien_thoai?: string;

  // null = xóa email.
  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  don_vi_cong_tac?: string | null;

  @IsOptional()
  @IsString()
  ghi_chu?: string | null;

  @IsOptional()
  @IsEnum(trang_thai_active)
  trang_thai?: trang_thai_active;
}

export class QueryGiangVienDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(trang_thai_active)
  trang_thai?: trang_thai_active;

  // Chỉ giảng viên có phân công trong khóa này.
  @IsOptional()
  @IsUUID()
  khoa_id?: string;
}

export class LichDayQueryDto {
  @IsOptional()
  @IsDateString()
  tu_ngay?: string;

  @IsOptional()
  @IsDateString()
  den_ngay?: string;
}

export class XacNhanGioDto {
  @IsBoolean()
  da_xac_nhan_gio: boolean;

  // Cho phép chốt số giờ cùng lúc xác nhận.
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0.1)
  so_gio?: number;
}

export class PhanCongMucDto {
  @IsUUID()
  giang_vien_id: string;

  @IsEnum(vai_tro_nhan_su_lop)
  vai_tro: vai_tro_nhan_su_lop;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0.1)
  so_gio?: number;
}

// PUT /lop/{id}/lich-hoc/{lichHocId}/giang-vien — thay toàn bộ phân công của buổi.
export class PhanCongBuoiDto {
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PhanCongMucDto)
  phan_cong: PhanCongMucDto[];
}
