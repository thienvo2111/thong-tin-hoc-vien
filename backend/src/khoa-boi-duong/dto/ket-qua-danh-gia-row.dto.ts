import { IsIn, IsUUID } from 'class-validator';
import { muc_nang_luc } from '@prisma/client';

// Dòng đã dựng xong của import ket_qua_danh_gia (T5, mo-rong-nls-an-giang.md)
// — cột file gốc: so_dinh_danh_ca_nhan/ma_dinh_danh_moet (HocVienResolver,
// cả 2 TÙY CHỌN), ma_khoa, loai (dau_vao|dau_ra), muc — đã được
// KhoaBoiDuongService tra cứu ra uuid hoc_vien_id/khoa_id trước khi commit,
// giống PhanLopHocVienRowDto.
export class KetQuaDanhGiaRowDto {
  @IsUUID()
  hoc_vien_id: string;

  @IsUUID()
  khoa_id: string;

  @IsIn(['dau_vao', 'dau_ra'])
  loai: 'dau_vao' | 'dau_ra';

  @IsIn(['co_ban', 'thanh_thao', 'nang_cao'])
  muc: muc_nang_luc;
}
