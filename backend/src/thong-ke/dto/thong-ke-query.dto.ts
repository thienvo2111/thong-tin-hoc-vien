import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export const DOI_TUONG_LOC = [
  'giao_vien',
  'can_bo_quan_ly',
  'nhan_vien',
  'chua_xac_dinh',
] as const;
export type DoiTuongLoc = (typeof DOI_TUONG_LOC)[number];

// Giới hạn để URL không vượt bộ đệm header của Nginx (~37 ký tự/UUID).
export const TOI_DA_DON_VI_LOC = 100;

/** "a,b" | ["a","b"] | ["a,b"] -> ["a","b"]; rỗng -> undefined. */
export function tachDanhSach({ value }: { value: unknown }): string[] | undefined {
  if (value == null || value === '') return undefined;
  const ds = (Array.isArray(value) ? value : [value])
    .flatMap((v) => String(v).split(','))
    .map((v) => v.trim())
    .filter(Boolean);
  return ds.length ? ds : undefined;
}

// Bộ lọc chung cho mọi endpoint /thong-ke/*. cum_id cần khoa_id;
// don_vi_id/don_vi_ids và cum_id loại trừ nhau (kiểm trong ThongKeScopeService).
export class ThongKeQueryDto {
  @IsOptional()
  @IsUUID()
  khoa_id?: string;

  @IsOptional()
  @IsUUID()
  don_vi_id?: string;

  // Chọn nhiều trường/đơn vị (gộp với don_vi_id nếu có); bỏ trống = tất cả.
  @IsOptional()
  @Transform(tachDanhSach)
  @IsArray()
  @ArrayMaxSize(TOI_DA_DON_VI_LOC)
  @IsUUID('all', { each: true })
  don_vi_ids?: string[];

  @IsOptional()
  @IsUUID()
  cum_id?: string;

  @IsOptional()
  @IsIn(DOI_TUONG_LOC)
  doi_tuong?: DoiTuongLoc;
}

export const CHI_SO_XEP_HANG = ['truy_cap', 'khao_sat', 'dat'] as const;
export type ChiSoXepHang = (typeof CHI_SO_XEP_HANG)[number];

export class XepHangQueryDto extends ThongKeQueryDto {
  @IsIn(CHI_SO_XEP_HANG)
  chi_so!: ChiSoXepHang;
}

export const LOAI_CAN_DON_DOC = [
  'chua_truy_cap',
  'chua_ky_nang_so',
  'chua_khao_sat',
  'vang_nhieu',
  'vle_thap',
] as const;
export type LoaiCanDonDoc = (typeof LOAI_CAN_DON_DOC)[number];

export class CanDonDocQueryDto extends ThongKeQueryDto {
  @IsIn(LOAI_CAN_DON_DOC)
  loai!: LoaiCanDonDoc;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}

export const LOAI_MUC_NLS = ['dau_vao', 'dau_ra'] as const;

export class MucNlsQueryDto extends ThongKeQueryDto {
  @IsOptional()
  @IsIn(LOAI_MUC_NLS)
  loai?: (typeof LOAI_MUC_NLS)[number];
}
