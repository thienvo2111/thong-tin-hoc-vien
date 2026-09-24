import { hinh_thuc_giai_doan } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsString,
  Min,
  MaxLength,
  MinLength,
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
}
