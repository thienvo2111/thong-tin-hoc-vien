import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { vai_tro_nhan_su_lop } from '@prisma/client';

// Dòng đã dựng xong của import nhan_su_lop — mỗi dòng = 1 nhân sự (giảng
// viên/hỗ trợ) của 1 lớp. Cột file gốc: ma_khoa, ten_lop, loai_lop, ho_ten,
// vai_tro, so_dien_thoai (tùy chọn). Lớp đã được KhoaBoiDuongService tra cứu
// ra uuid lop_id (xem resolveNhanSuLopRow).
export class NhanSuLopRowDto {
  @IsUUID()
  lop_id: string;

  @IsString()
  @MaxLength(255)
  ho_ten: string;

  @IsEnum(vai_tro_nhan_su_lop)
  vai_tro: vai_tro_nhan_su_lop;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  so_dien_thoai?: string;
}
