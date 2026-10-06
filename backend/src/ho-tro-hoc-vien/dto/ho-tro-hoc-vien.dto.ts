import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const chuoiThanhBoolean = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

// Bộ lọc dùng chung cho GET /ho-tro/hoc-vien và /ho-tro/hoc-vien/xuat.
export class LocHocVienHoTroDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsUUID()
  cum_id?: string;

  @IsOptional()
  @IsUUID()
  don_vi_cong_tac_id?: string;

  @IsOptional()
  @Transform(chuoiThanhBoolean)
  @IsIn([true, false])
  day_du?: boolean;

  @IsOptional()
  @Transform(chuoiThanhBoolean)
  @IsIn([true, false])
  da_dang_nhap?: boolean;
}

const NGAY = /^\d{4}-\d{2}-\d{2}$/;

export class LocLichHocHoTroDto {
  @IsOptional()
  @Matches(NGAY, { message: 'Định dạng YYYY-MM-DD' })
  tu_ngay?: string;

  @IsOptional()
  @Matches(NGAY, { message: 'Định dạng YYYY-MM-DD' })
  den_ngay?: string;

  @IsOptional()
  @IsUUID()
  cum_id?: string;
}
