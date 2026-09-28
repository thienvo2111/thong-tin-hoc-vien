import { cap_hoc, nguon_tao_ho_so, trang_thai_ho_so } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
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

  // T9: lọc theo "hồ sơ đầy đủ" (tính động qua HocVienService.danhGiaDayDu,
  // không phải cột DB) — dùng cho Quản trị/Sở/Phòng/Trường đôn đốc.
  // Transform thủ công vì query string ("false") qua Type(() => Boolean) sẽ
  // thành true (chuỗi không rỗng) — gotcha kinh điển của class-transformer.
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value as unknown;
  })
  @IsBoolean()
  day_du?: boolean;
}
