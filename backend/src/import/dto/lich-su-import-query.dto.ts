import { IsDateString, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class LichSuImportQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  loai?: string;

  @IsOptional()
  @IsDateString()
  tu_ngay?: string;

  @IsOptional()
  @IsDateString()
  den_ngay?: string;
}
