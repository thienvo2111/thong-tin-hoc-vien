import { IsUUID } from 'class-validator';

// GET /hoc-vien/xuat-excel — bắt buộc chọn đúng 1 trường.
export class XuatHocVienTheoTruongDto {
  @IsUUID()
  don_vi_cong_tac_id!: string;
}
