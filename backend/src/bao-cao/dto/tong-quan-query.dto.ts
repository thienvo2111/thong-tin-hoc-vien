import { IsDateString, IsOptional, IsUUID } from 'class-validator';

// GET /bao-cao/tong-quan?khoa_id=&don_vi_cong_tac_id=&tu_ngay=&den_ngay= — dashboard
// "Tổng quan hệ thống" (thêm 2026-09-30). Tất cả tùy chọn — xem BaoCaoService.tongQuan
// cho ý nghĩa lọc (tu_ngay/den_ngay theo dang_ky_hoc.ngay_dang_ky).
export class TongQuanQueryDto {
  @IsOptional()
  @IsUUID()
  khoa_id?: string;

  @IsOptional()
  @IsUUID()
  don_vi_cong_tac_id?: string;

  @IsOptional()
  @IsDateString()
  tu_ngay?: string;

  @IsOptional()
  @IsDateString()
  den_ngay?: string;
}
