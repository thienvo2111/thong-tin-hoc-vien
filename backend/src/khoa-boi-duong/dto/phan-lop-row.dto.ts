import { IsUUID } from 'class-validator';

// Dòng đã dựng xong của import phan_lop_hoc_vien — cột file gốc là
// so_dinh_danh_ca_nhan/ma_khoa/ten_lop (text), đã được KhoaBoiDuongService
// tra cứu ra đúng 3 uuid trước khi validate/commit (giống cách import.service
// tra dia_ban_ma/don_vi_cha_ma ra uuid trong buildDonViDto).
export class PhanLopHocVienRowDto {
  @IsUUID()
  hoc_vien_id: string;

  @IsUUID()
  khoa_id: string;

  @IsUUID()
  lop_id: string;
}
