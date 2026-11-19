import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { GiaiDoanThamGia, TyLeSuat } from '../quy-tac-hop-dong';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
// Chuỗi trống sau trim = không có giá trị.
const trimHoacNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const s = value.trim();
  return s === '' ? null : s;
};

const NGAY = /^\d{4}-\d{2}-\d{2}$/;
const MSG_NGAY = { message: 'ngay_sinh phải là ngày dạng YYYY-MM-DD' };
export const SO_DONG_NAP_TOI_DA = 5000;

// Một dòng đã xem trước + đã gắn trường (khớp tự động hoặc chọn tay). Server kiểm lại mọi thứ.
export class DongNapDanhSachDto {
  // Số dòng Excel — chỉ để báo lỗi đúng vị trí.
  @IsOptional()
  @IsInt()
  @Min(1)
  so_dong?: number;

  // Thiếu → service báo 400 kèm số dòng (không nạp dòng chưa có trường, M6).
  @IsOptional()
  @IsUUID('all', { message: 'don_vi_id không hợp lệ' })
  don_vi_id?: string | null;

  @Transform(trim)
  @IsString()
  @Length(1, 255, { message: 'ho_ten không được trống, tối đa 255 ký tự' })
  ho_ten!: string;

  @IsOptional()
  @Matches(NGAY, MSG_NGAY)
  @IsISO8601({ strict: true }, MSG_NGAY)
  ngay_sinh?: string | null;

  @IsOptional()
  @Transform(trimHoacNull)
  @IsString()
  @MaxLength(20)
  gioi_tinh?: string | null;

  @IsOptional()
  @Transform(trimHoacNull)
  @IsString()
  @MaxLength(50)
  ma_goc?: string | null;

  @IsOptional()
  @Transform(trimHoacNull)
  @IsString()
  @MaxLength(100)
  lop?: string | null;

  @IsIn(['ca_hai', 'chi_gd1', 'chi_gd2'], {
    message: 'giai_doan phải là ca_hai, chi_gd1 hoặc chi_gd2',
  })
  giai_doan!: GiaiDoanThamGia;

  // Tùy chọn; có gửi thì phải khớp giai đoạn (S1) — service kiểm.
  @IsOptional()
  @IsIn([1, 0.5], { message: 'ty_le_suat phải là 1 hoặc 0.5' })
  ty_le_suat?: TyLeSuat;

  @IsOptional()
  @Transform(trimHoacNull)
  @IsString()
  @MaxLength(2000)
  ghi_chu?: string | null;
}

// POST /cong-don-vi/dot-trien-khai/:id/danh-sach/nap (quan_tri) — issue #58.
export class NapDanhSachDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Không có dòng nào để nạp' })
  @ArrayMaxSize(SO_DONG_NAP_TOI_DA, {
    message: `Tối đa ${SO_DONG_NAP_TOI_DA} dòng mỗi lần nạp`,
  })
  @ValidateNested({ each: true })
  @Type(() => DongNapDanhSachDto)
  dong!: DongNapDanhSachDto[];
}

// GET /cong-don-vi/dot-trien-khai/:id/danh-sach?don_vi_id=
export class LocDanhSachDto {
  @IsOptional()
  @IsUUID('all', { message: 'don_vi_id không hợp lệ' })
  don_vi_id?: string;
}
