import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';
import { loai_lop_hoc } from '@prisma/client';

// Body của POST /khoa-boi-duong/{id}/lop — docs/api-contract.md mục 3.
// loai_lop bắt buộc từ QĐ10 (mo-rong-nls-an-giang.md, 2026-09-30) — 3 loại
// lớp ĐỘC LẬP nhau (trực tiếp/zoom/vle), không có giá trị mặc định ngầm.
export class CreateLopHocDto {
  @IsEnum(loai_lop_hoc)
  loai_lop: loai_lop_hoc;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  ten_lop: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  si_so_toi_da?: number;
}
