import { cap_hoc, nguon_tao_ho_so, trang_thai_ho_so } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

// GET /hoc-vien — docs/api-contract.md mục 2.
export class QueryHocVienDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(trang_thai_ho_so)
  trang_thai?: trang_thai_ho_so;

  @IsOptional()
  @IsUUID()
  don_vi_cong_tac_id?: string;

  @IsOptional()
  @IsEnum(cap_hoc)
  cap_giang_day?: cap_hoc;

  @IsOptional()
  @IsEnum(nguon_tao_ho_so)
  nguon_tao?: nguon_tao_ho_so;

  @IsOptional()
  @IsString()
  q?: string;
}
