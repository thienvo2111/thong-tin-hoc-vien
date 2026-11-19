import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator';
import type { chuong_trinh_boi_duong } from '@prisma/client';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Chỉ ngày (không giờ): regex chặn kèm giờ, IsISO8601 strict chặn ngày không có thật (30/02).
const NGAY = /^\d{4}-\d{2}-\d{2}$/;
const msgNgay = (field: string) => ({
  message: `${field} phải là ngày dạng YYYY-MM-DD`,
});
const MSG_DON_GIA = { message: 'don_gia phải là số nguyên ≥ 0 (VNĐ)' };
const MSG_TEN = { message: 'ten không được trống, tối đa 255 ký tự' };
const MSG_SO = { message: 'so_gddt_id không hợp lệ' };
// PATCH: field không được null — undefined = không đổi, null vẫn bị kiểm (và trượt).
const coGui = (_: object, v: unknown) => v !== undefined;

// POST /cong-don-vi/dot-trien-khai (quan_tri) — ADR 0015 M1/M2/S4/S6/T1.
export class TaoDotTrienKhaiDto {
  @IsIn(['nls', 'hsg'], { message: 'chuong_trinh phải là nls hoặc hsg' })
  chuong_trinh!: chuong_trinh_boi_duong;

  @Transform(trim)
  @IsString(MSG_TEN)
  @Length(1, 255, MSG_TEN)
  ten!: string;

  // null/bỏ trống = chưa có đơn giá (S4).
  @IsOptional()
  @IsInt(MSG_DON_GIA)
  @Min(0, MSG_DON_GIA)
  don_gia?: number | null;

  @IsOptional()
  @Matches(NGAY, msgNgay('ngay_qd_tu'))
  @IsISO8601({ strict: true }, msgNgay('ngay_qd_tu'))
  ngay_qd_tu?: string | null;

  @IsOptional()
  @Matches(NGAY, msgNgay('ngay_qd_den'))
  @IsISO8601({ strict: true }, msgNgay('ngay_qd_den'))
  ngay_qd_den?: string | null;

  // Lưu thành 23:59:59 giờ Việt Nam của ngày này (T1).
  @Matches(NGAY, msgNgay('han_nop_ngay'))
  @IsISO8601({ strict: true }, msgNgay('han_nop_ngay'))
  han_nop_ngay!: string;

  @IsUUID('all', MSG_SO)
  so_gddt_id!: string;
}

// PATCH /cong-don-vi/dot-trien-khai/:id — mọi field tùy chọn; null xóa đơn giá / ngày QĐ.
// Chương trình cố định sau khi tạo. Đổi han_nop_ngay = gia hạn cả đợt (T3).
export class SuaDotTrienKhaiDto {
  @ValidateIf(coGui)
  @Transform(trim)
  @IsString(MSG_TEN)
  @Length(1, 255, MSG_TEN)
  ten?: string;

  @IsOptional()
  @IsInt(MSG_DON_GIA)
  @Min(0, MSG_DON_GIA)
  don_gia?: number | null;

  @IsOptional()
  @Matches(NGAY, msgNgay('ngay_qd_tu'))
  @IsISO8601({ strict: true }, msgNgay('ngay_qd_tu'))
  ngay_qd_tu?: string | null;

  @IsOptional()
  @Matches(NGAY, msgNgay('ngay_qd_den'))
  @IsISO8601({ strict: true }, msgNgay('ngay_qd_den'))
  ngay_qd_den?: string | null;

  @ValidateIf(coGui)
  @Matches(NGAY, msgNgay('han_nop_ngay'))
  @IsISO8601({ strict: true }, msgNgay('han_nop_ngay'))
  han_nop_ngay?: string;

  @ValidateIf(coGui)
  @IsUUID('all', MSG_SO)
  so_gddt_id?: string;
}
