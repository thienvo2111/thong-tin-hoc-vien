import { loai_su_kien_thong_bao } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

// GET /thong-bao/lich-su — docs/api-contract.md mục 8. Cả 2 filter đều tùy
// chọn, kết hợp AND nếu truyền cả 2.
export class LichSuThongBaoQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  hoc_vien_id?: string;

  @IsOptional()
  @IsEnum(loai_su_kien_thong_bao)
  loai_su_kien?: loai_su_kien_thong_bao;
}
