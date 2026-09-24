import { vai_tro_nhan_su_lop } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

// Body của POST /lop/{id}/nhan-su — docs/api-contract.md mục 3.
export class CreateNhanSuDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  ho_ten: string;

  @IsEnum(vai_tro_nhan_su_lop)
  vai_tro: vai_tro_nhan_su_lop;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  so_dien_thoai?: string;
}
