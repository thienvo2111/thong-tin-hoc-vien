import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { TRANG_THAI_DE_NGHI, type TrangThaiDeNghi } from '../quy-tac-hop-dong';

// GET /cong-don-vi/dot-trien-khai/:id/de-nghi?trang_thai=&don_vi_id= (quan_tri) — issue #62.
// Không gửi trang_thai = 'cho' (hàng đợi việc cần xử lý).
export class LocDeNghiDto {
  @IsOptional()
  @IsIn(TRANG_THAI_DE_NGHI, {
    message: 'trang_thai phải là cho, da_ap_dung hoặc tu_choi',
  })
  trang_thai?: TrangThaiDeNghi;

  @IsOptional()
  @IsUUID('all', { message: 'don_vi_id không hợp lệ' })
  don_vi_id?: string;
}
