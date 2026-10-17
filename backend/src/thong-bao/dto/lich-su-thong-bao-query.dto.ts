import {
  loai_su_kien_thong_bao,
  trang_thai_gui_thong_bao,
} from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

// GET /thong-bao/lich-su — docs/api-contract.md mục 8. Mọi filter đều tùy
// chọn, kết hợp AND. q tìm trong email người nhận hoặc tiêu đề.
export class LichSuThongBaoQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  hoc_vien_id?: string;

  @IsOptional()
  @IsEnum(loai_su_kien_thong_bao)
  loai_su_kien?: loai_su_kien_thong_bao;

  @IsOptional()
  @IsEnum(trang_thai_gui_thong_bao)
  trang_thai?: trang_thai_gui_thong_bao;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(255)
  q?: string;
}
