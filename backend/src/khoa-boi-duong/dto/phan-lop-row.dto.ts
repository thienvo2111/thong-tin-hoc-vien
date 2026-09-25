import { IsOptional, IsUUID } from 'class-validator';

// Dòng đã dựng xong của import phan_lop_hoc_vien — cột file gốc là
// so_dinh_danh_ca_nhan/ma_khoa/ten_lop (text, ten_lop TÙY CHỌN), đã được
// KhoaBoiDuongService tra cứu ra uuid trước khi commit (giống cách
// import.service tra dia_ban_ma/don_vi_cha_ma ra uuid trong buildDonViDto).
// lop_id null nghĩa là dòng chỉ ghi danh (ten_lop để trống), chưa phân lớp.
export class PhanLopHocVienRowDto {
  @IsUUID()
  hoc_vien_id: string;

  @IsUUID()
  khoa_id: string;

  @IsOptional()
  @IsUUID()
  lop_id: string | null;
}
