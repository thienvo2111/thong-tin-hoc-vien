import { Transform } from 'class-transformer';
import {
  IsEmpty,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { UpdateHocVienDto } from '../../hoc-vien/dto/update-hoc-vien.dto';

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

// PATCH /ho-tro/hoc-vien/{id} — ADR 0003 H7: các trường học viên tự sửa ở M4,
// TRỪ số định danh/CCCD (khóa khớp import + tên đăng nhập). ValidationPipe chỉ
// bật whitelist (trường lạ bị bỏ im lặng) nên chặn CCCD tường minh bằng
// @IsEmpty để trả 400 rõ ràng thay vì lặng lẽ bỏ qua.
export class SuaHoSoHoTroDto extends UpdateHocVienDto {
  @IsEmpty({ message: 'Người hỗ trợ không được sửa số định danh cá nhân' })
  declare so_dinh_danh_ca_nhan?: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().normalize('NFC') : value,
  )
  @IsString({ message: 'Bắt buộc nhập lý do điều chỉnh' })
  @Length(5, 500, { message: 'Lý do điều chỉnh từ 5 đến 500 ký tự' })
  ly_do!: string;
}
