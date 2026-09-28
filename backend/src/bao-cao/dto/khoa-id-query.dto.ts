import { IsOptional, IsUUID } from 'class-validator';

// Dùng chung cho GET /bao-cao/sua-truong-moet?khoa_id=,
// GET /bao-cao/xuat-cho-vle?khoa_id= (T14), GET /bao-cao/dieu-kien-danh-gia?khoa_id=
// (T15) — khoa_id tùy chọn (P0: đợt xác nhận không gắn khóa, xem
// mo-rong-nls-an-giang.md mục 3 "Rút gọn để kịp P0").
export class KhoaIdQueryDto {
  @IsOptional()
  @IsUUID()
  khoa_id?: string;
}
