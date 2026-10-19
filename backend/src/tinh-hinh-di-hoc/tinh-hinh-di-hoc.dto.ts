import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';
import { trang_thai_diem_danh } from '@prisma/client';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

const chuoiThanhBoolean = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

const chuanHoaChuoi = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.normalize('NFC').trim() : value;

// ADR 0010 T2: bộ lọc dùng chung cho danh sách (phân trang) và file xuất (đủ dòng).
export class LocTinhHinhDiHocDto extends PaginationQueryDto {
  @IsUUID()
  khoa_id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsUUID()
  don_vi_cong_tac_id?: string;

  @IsOptional()
  @IsUUID()
  cum_id?: string;

  @IsOptional()
  @IsUUID()
  lop_id?: string;

  @IsOptional()
  @Transform(chuoiThanhBoolean)
  @IsIn([true, false])
  co_vang?: boolean;

  @IsOptional()
  @Transform(chuoiThanhBoolean)
  @IsIn([true, false])
  chua_diem_danh?: boolean;
}

// ADR 0010 T4: người hỗ trợ học viên điểm danh bổ sung — chỉ có mặt / vắng
// có phép, lý do bắt buộc.
export class DiemDanhBoSungHoTroDto {
  @IsUUID()
  lich_hoc_id!: string;

  @IsIn(['co_mat', 'vang_co_phep'], {
    message: 'Chỉ được bổ sung "Có mặt" hoặc "Vắng có phép"',
  })
  trang_thai!: trang_thai_diem_danh;

  @Transform(chuanHoaChuoi)
  @IsString({ message: 'Bắt buộc nhập lý do' })
  @Length(1, 500, { message: 'Lý do từ 1 đến 500 ký tự' })
  ly_do!: string;
}

// ADR 0010 T5: Quản trị sửa như Z7 — đủ 3 trạng thái, lý do tùy chọn.
export class DiemDanhBoSungQuanTriDto {
  @IsUUID()
  lich_hoc_id!: string;

  @IsIn(['co_mat', 'vang', 'vang_co_phep'])
  trang_thai!: trang_thai_diem_danh;

  @IsOptional()
  @Transform(chuanHoaChuoi)
  @IsString()
  @MaxLength(500)
  ly_do?: string;
}
