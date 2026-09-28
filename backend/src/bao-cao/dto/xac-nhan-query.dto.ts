import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { TRANG_THAI_XAC_NHAN, TrangThaiXacNhan } from '../bao-cao.types';

// GET /bao-cao/xac-nhan?dot_id=&trang_thai=&don_vi_cong_tac_id= — T14
// (mo-rong-nls-an-giang.md). dot_id BẮT BUỘC: "tiến độ xác nhận" luôn gắn
// với 1 đợt cụ thể (không có đợt thì không có gì để tính da_xac_nhan) —
// improvised, api-contract.md chỉ liệt kê query, không nói field nào bắt
// buộc; flagged trong self-review.
export class XacNhanQueryDto {
  @IsUUID()
  dot_id: string;

  @IsOptional()
  @IsIn(TRANG_THAI_XAC_NHAN)
  trang_thai?: TrangThaiXacNhan;

  @IsOptional()
  @IsUUID()
  don_vi_cong_tac_id?: string;
}
