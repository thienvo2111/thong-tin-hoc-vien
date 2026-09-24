import { cap_dia_danh, trang_thai_active } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class CreateDiaDanhDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  ma: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  ten: string;

  @IsEnum(cap_dia_danh)
  cap: cap_dia_danh;

  @IsOptional()
  @IsUUID()
  parent_id?: string;
}

export class UpdateDiaDanhDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  ma?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  ten?: string;

  @IsOptional()
  @IsEnum(cap_dia_danh)
  cap?: cap_dia_danh;

  @IsOptional()
  @IsUUID()
  parent_id?: string | null;

  @IsOptional()
  @IsEnum(trang_thai_active)
  trang_thai?: trang_thai_active;
}

export class QueryDiaDanhDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(cap_dia_danh)
  cap?: cap_dia_danh;

  @IsOptional()
  @IsUUID()
  parent_id?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(trang_thai_active)
  trang_thai?: trang_thai_active;
}
