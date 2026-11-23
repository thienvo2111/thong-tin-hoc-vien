import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';
import { TRANG_THAI_DE_NGHI, type TrangThaiDeNghi } from '../quy-tac-hop-dong';
import { MSG_DONG_BO } from './danh-sach-tham-gia.dto';

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

// POST /cong-don-vi/de-nghi-sua/:id/ap-dung — issue #69 / ADR 0015 Y2: đề nghị sửa trên dòng NLS, Quản trị chọn
// cập nhật luôn hồ sơ học viên (chỉ thông tin cá nhân). Không gửi / false = như trước.
export class ApDungDeNghiDto {
  @IsOptional()
  @IsBoolean(MSG_DONG_BO)
  dong_bo_ho_so_hoc_vien?: boolean;
}
