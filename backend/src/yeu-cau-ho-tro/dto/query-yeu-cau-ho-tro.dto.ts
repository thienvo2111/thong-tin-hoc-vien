import { trang_thai_yeu_cau_ho_tro } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryYeuCauHoTroDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(trang_thai_yeu_cau_ho_tro)
  trang_thai?: trang_thai_yeu_cau_ho_tro;

  @IsOptional()
  @IsUUID()
  loai_van_de_id?: string;

  // ADR 0003 H10: ticket của học viên chưa được gán cụm (chỉ Quản trị xử lý).
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsIn([true, false])
  chua_co_cum?: boolean;
}

// GET /ho-tro/yeu-cau-ho-tro — người hỗ trợ học viên (ADR 0003).
export class QueryYeuCauHoTroHoTroDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(trang_thai_yeu_cau_ho_tro)
  trang_thai?: trang_thai_yeu_cau_ho_tro;

  @IsOptional()
  @IsUUID()
  cum_id?: string;
}
