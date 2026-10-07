import { IsIn, IsOptional, IsUUID } from 'class-validator';

// Bộ lọc chung cho mọi endpoint /thong-ke/*. cum_id cần khoa_id;
// don_vi_id và cum_id loại trừ nhau (kiểm trong ThongKeScopeService).
export class ThongKeQueryDto {
  @IsOptional()
  @IsUUID()
  khoa_id?: string;

  @IsOptional()
  @IsUUID()
  don_vi_id?: string;

  @IsOptional()
  @IsUUID()
  cum_id?: string;
}

export const CHI_SO_XEP_HANG = ['truy_cap', 'khao_sat', 'dat'] as const;
export type ChiSoXepHang = (typeof CHI_SO_XEP_HANG)[number];

export class XepHangQueryDto extends ThongKeQueryDto {
  @IsIn(CHI_SO_XEP_HANG)
  chi_so!: ChiSoXepHang;
}
