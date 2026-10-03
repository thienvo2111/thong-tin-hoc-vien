import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { trang_thai_diem_danh, nguon_diem_danh } from '@prisma/client';

// Dòng đã dựng xong của import diem_danh (T12, mo-rong-nls-an-giang.md) — mỗi
// dòng = điểm danh của 1 học viên tại 1 buổi học (lich_hoc_lop) cụ thể. Cột
// file gốc: so_dinh_danh_ca_nhan/ma_dinh_danh_moet (HocVienResolver, cả 2
// TÙY CHỌN), ma_khoa, ten_lop, loai_lop (BẮT BUỘC — QĐ10: điểm danh gắn với 1
// buổi của 1 lớp cụ thể, không có mặc định an toàn để suy đoán như
// lop_va_lich_hoc), giai_doan_thu_tu, buoi_so, trang_thai, nguon, ghi_chu
// (tùy chọn nhưng BẮT BUỘC khi buổi thuộc lớp KHÁC lớp học viên đang được
// gán — "học bù", xem KhoaBoiDuongService.resolveDiemDanhRow). Đã được
// KhoaBoiDuongService tra cứu ra uuid dang_ky_hoc_id/lich_hoc_id, giống
// PhanLopHocVienRowDto.
export class DiemDanhRowDto {
  @IsUUID()
  dang_ky_hoc_id: string;

  @IsUUID()
  lich_hoc_id: string;

  @IsEnum(trang_thai_diem_danh)
  trang_thai: trang_thai_diem_danh;

  @IsEnum(nguon_diem_danh)
  nguon: nguon_diem_danh;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  ghi_chu?: string;
}
