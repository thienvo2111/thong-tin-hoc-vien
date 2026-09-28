import { loai_dot_xac_nhan } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

// POST /dot-xac-nhan (quan_tri) — mo-rong-nls-an-giang.md mục T14. khoa_id để
// trống = áp dụng cho MỌI hồ sơ import_moet (quyết định "rút gọn để kịp P0").
export class TaoDotXacNhanDto {
  @IsOptional()
  @IsUUID()
  khoa_id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  ten: string;

  @IsEnum(loai_dot_xac_nhan)
  loai: loai_dot_xac_nhan;

  @IsDateString()
  mo_luc: string;

  @IsDateString()
  dong_luc: string;
}
