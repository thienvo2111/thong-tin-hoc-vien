import { IsOptional, IsUUID } from 'class-validator';

// Dòng đã dựng xong của import phan_lop_hoc_vien — định dạng theo giai đoạn
// (spec 2026-10-02-phan-lop-theo-giai-doan mục 4): mỗi học viên 1 dòng, mỗi
// giai đoạn 1 cột "GĐ<n> - <tên>". Đã được KhoaBoiDuongService tra cứu ra
// uuid trước khi commit. gan chỉ chứa giai đoạn có ô KHÔNG trống trong file:
// lop_id = null nghĩa là ô "-" (gỡ lớp); giai đoạn vắng mặt = giữ nguyên.
export class PhanLopHocVienRowDto {
  @IsUUID()
  hoc_vien_id: string;

  @IsUUID()
  khoa_id: string;

  @IsOptional()
  @IsUUID()
  cum_id?: string;

  gan: { giai_doan_id: string; lop_id: string | null }[];
}
