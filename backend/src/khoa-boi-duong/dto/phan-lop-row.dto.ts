import { IsOptional, IsUUID } from 'class-validator';

// Dòng đã dựng xong của import phan_lop_hoc_vien — cột file: ten_lop (giữ
// NGUYÊN tên cột cũ, nay hiểu là lớp TRỰC TIẾP, để không vỡ file mẫu đang
// dùng), ten_lop_zoom, ten_lop_vle, ten_cum (đều TÙY CHỌN — QĐ10,
// mo-rong-nls-an-giang.md, 2026-09-30: 3 loại lớp độc lập nhau + cụm học
// viên độc lập, không qua lớp nào). Đã được KhoaBoiDuongService tra cứu ra
// uuid trước khi commit, giống cách import.service tra dia_ban_ma ra uuid.
export class PhanLopHocVienRowDto {
  @IsUUID()
  hoc_vien_id: string;

  @IsUUID()
  khoa_id: string;

  @IsOptional()
  @IsUUID()
  lop_truc_tiep_id?: string;

  @IsOptional()
  @IsUUID()
  lop_zoom_id?: string;

  @IsOptional()
  @IsUUID()
  lop_vle_id?: string;

  @IsOptional()
  @IsUUID()
  cum_id?: string;
}
