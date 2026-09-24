import { trang_thai_khoa } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

// GET /khoa-boi-duong — docs/api-contract.md mục 3. Với caller vai_tro=hoc_vien,
// trang_thai bị ép về 'da_duyet' ở service bất kể query truyền gì (chỉ được
// xem khóa đã duyệt).
export class QueryKhoaBoiDuongDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(trang_thai_khoa)
  trang_thai?: trang_thai_khoa;

  @IsOptional()
  @IsUUID()
  don_vi_to_chuc_id?: string;

  @IsOptional()
  @IsString()
  q?: string;
}
