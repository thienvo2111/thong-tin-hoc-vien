import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { muc_nang_luc } from '@prisma/client';

// Dòng đã dựng xong của import lop_va_lich_hoc (T6, mo-rong-nls-an-giang.md)
// — mỗi dòng = 1 buổi học. Cột file gốc: ma_khoa, ten_lop, nhom_hoc_vien,
// muc_nang_luc, si_so_toi_da, giai_doan_thu_tu, buoi_so, bat_dau, ket_thuc,
// dia_diem_hoac_link, ma_diem_hoc (tùy chọn, T10 chưa làm — bị bỏ qua, xem
// KhoaBoiDuongService.resolveLopVaLichHocRow). Đã được KhoaBoiDuongService
// tra cứu ra uuid khoa_id/giai_doan_id, giống PhanLopHocVienRowDto.
export class LopVaLichHocRowDto {
  @IsUUID()
  khoa_id: string;

  @IsString()
  ten_lop: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  nhom_hoc_vien?: number;

  @IsOptional()
  @IsIn(['co_ban', 'thanh_thao', 'nang_cao'])
  muc_nang_luc?: muc_nang_luc;

  @IsOptional()
  @IsInt()
  @Min(1)
  si_so_toi_da?: number;

  @IsUUID()
  giai_doan_id: string;

  @IsInt()
  @Min(1)
  buoi_so: number;

  thoi_gian_bat_dau: Date;

  thoi_gian_ket_thuc: Date;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  dia_diem_hoac_link?: string;
}
