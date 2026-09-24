import { loai_don_vi, trang_thai_active } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class CreateDonViCongTacDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  ma_don_vi?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  ten_don_vi: string;

  @IsEnum(loai_don_vi)
  loai_don_vi: loai_don_vi;

  @IsUUID()
  dia_ban_id: string;

  @IsOptional()
  @IsUUID()
  don_vi_cha_id?: string;
}

export class UpdateDonViCongTacDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  ma_don_vi?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  ten_don_vi?: string;

  @IsOptional()
  @IsEnum(loai_don_vi)
  loai_don_vi?: loai_don_vi;

  @IsOptional()
  @IsUUID()
  dia_ban_id?: string;

  @IsOptional()
  @IsUUID()
  don_vi_cha_id?: string | null;

  @IsOptional()
  @IsEnum(trang_thai_active)
  trang_thai?: trang_thai_active;
}

export class QueryDonViCongTacDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(loai_don_vi)
  loai_don_vi?: loai_don_vi;

  @IsOptional()
  @IsUUID()
  dia_ban_id?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(trang_thai_active)
  trang_thai?: trang_thai_active;
}
