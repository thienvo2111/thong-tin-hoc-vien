import { ket_qua_hoc } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

// Body của PATCH /dang-ky-hoc/{id}/ket-qua — docs/api-contract.md mục 3
// (thêm 2026-09-25).
export class KetQuaDangKyDto {
  @IsEnum(ket_qua_hoc)
  ket_qua: ket_qua_hoc;

  @IsOptional()
  @IsDateString()
  ngay_hoan_thanh?: string;
}
