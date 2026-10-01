import { trang_thai_yeu_cau_ho_tro } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryYeuCauHoTroDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(trang_thai_yeu_cau_ho_tro)
  trang_thai?: trang_thai_yeu_cau_ho_tro;

  @IsOptional()
  @IsUUID()
  loai_van_de_id?: string;
}
