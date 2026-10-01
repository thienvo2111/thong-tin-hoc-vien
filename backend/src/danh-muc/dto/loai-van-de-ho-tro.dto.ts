import { trang_thai_active } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class CreateLoaiVanDeHoTroDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  ten: string;

  @IsString()
  @MinLength(1)
  noi_dung_goi_y: string;
}

export class UpdateLoaiVanDeHoTroDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  ten?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  noi_dung_goi_y?: string;

  @IsOptional()
  @IsEnum(trang_thai_active)
  trang_thai?: trang_thai_active;
}

export class QueryLoaiVanDeHoTroDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(trang_thai_active)
  trang_thai?: trang_thai_active;
}
