import { Transform } from 'class-transformer';
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  LOAI_DE_NGHI,
  Y_KIEN_TRUONG,
  type LoaiDeNghi,
  type YKienTruong,
} from '../quy-tac-hop-dong';

// PUT /cong-don-vi/truong/dot/:dotId/danh-sach/:dongId/y-kien (truong) — issue #61, ADR 0015 X2.
// Bắt buộc gửi khóa y_kien; null = bỏ ý kiến (về "chưa có ý kiến").
export class YKienDongDto {
  @ValidateIf((o: YKienDongDto) => o.y_kien !== null)
  @IsIn(Y_KIEN_TRUONG, {
    message: 'y_kien phải là dong_y, khong_dong_y hoặc null',
  })
  y_kien!: YKienTruong | null;
}

// Chuỗi trống sau trim = không có giá trị.
const trimHoacNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const s = value.trim();
  return s === '' ? null : s;
};

// POST /cong-don-vi/truong/dot/:dotId/de-nghi (truong) — issue #62, ADR 0015 X2.
// Quy tắc theo loại (dong_id bắt buộc/cấm, lý do bắt buộc khi bớt, giá trị hợp lệ) kiểm ở service.
export class GuiDeNghiDto {
  @IsIn(LOAI_DE_NGHI, { message: 'loai phải là sua, them hoặc bot' })
  loai!: LoaiDeNghi;

  @IsOptional()
  @IsUUID('all', { message: 'dong_id không hợp lệ' })
  dong_id?: string | null;

  @IsOptional()
  @IsObject({ message: 'gia_tri phải là đối tượng' })
  gia_tri?: Record<string, unknown> | null;

  @IsOptional()
  @Transform(trimHoacNull)
  @IsString({ message: 'Lý do tối đa 500 ký tự' })
  @MaxLength(500, { message: 'Lý do tối đa 500 ký tự' })
  ly_do?: string | null;
}
