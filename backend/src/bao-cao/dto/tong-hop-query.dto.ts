import { IsDateString, IsIn, IsOptional } from 'class-validator';

export const BAO_CAO_THEO = ['don_vi', 'dia_ban', 'khoa'] as const;
export type BaoCaoTheo = (typeof BAO_CAO_THEO)[number];

// GET /bao-cao/tong-hop, GET /bao-cao/xuat-excel — docs/api-contract.md mục 7
// (bảng gốc chỉ có 2 dòng, hình dạng response là suy luận — xem
// bao-cao.service.ts đầu file để biết lý do lựa chọn, đánh dấu provisional
// giống GET /auth/toi).
export class TongHopQueryDto {
  @IsIn(BAO_CAO_THEO)
  theo: BaoCaoTheo;

  // Định dạng 'YYYY-MM-DD'. Ý nghĩa trường ngày lọc theo TỪNG loại báo cáo
  // khác nhau — xem BaoCaoService.hocVienDateField/khoaDateField.
  @IsOptional()
  @IsDateString()
  tu_ngay?: string;

  @IsOptional()
  @IsDateString()
  den_ngay?: string;
}
