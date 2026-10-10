import { IsOptional, IsUUID } from 'class-validator';

// Body của POST /dang-ky-hoc — Quản trị ghi danh lẻ 1 học viên đã duyệt vào
// khóa (thay cho import phan_lop_hoc_vien không gán lớp).
export class GhiDanhLeDto {
  @IsUUID()
  hoc_vien_id: string;

  @IsUUID()
  khoa_id: string;

  @IsOptional()
  @IsUUID()
  cum_id?: string;
}
