import { cap_hoc, trang_thai_active } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class CreateMonHocDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  ten_mon: string;

  @IsEnum(cap_hoc)
  cap_hoc: cap_hoc;
}

export class UpdateMonHocDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  ten_mon?: string;

  @IsOptional()
  @IsEnum(cap_hoc)
  cap_hoc?: cap_hoc;

  @IsOptional()
  @IsEnum(trang_thai_active)
  trang_thai?: trang_thai_active;
}

export class QueryMonHocDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(cap_hoc)
  cap_hoc?: cap_hoc;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(trang_thai_active)
  trang_thai?: trang_thai_active;
}
