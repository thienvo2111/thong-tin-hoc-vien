import { IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';

// Dòng đã dựng xong của import ket_qua_giai_doan (T12, mo-rong-nls-an-giang.md)
// — kết quả/tiến độ theo từng giai đoạn của khóa (vd tiến độ VLE, điểm đánh
// giá giai đoạn). Cột file gốc: so_dinh_danh_ca_nhan/ma_dinh_danh_moet
// (HocVienResolver, cả 2 TÙY CHỌN), ma_khoa, giai_doan_thu_tu,
// ty_le_hoan_thanh, diem (cả 2 giá trị TÙY CHỌN). Đã được KhoaBoiDuongService
// tra cứu ra uuid dang_ky_hoc_id/giai_doan_id, giống KetQuaDanhGiaRowDto.
export class KetQuaGiaiDoanRowDto {
  @IsUUID()
  dang_ky_hoc_id: string;

  @IsUUID()
  giai_doan_id: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  ty_le_hoan_thanh?: number;

  @IsOptional()
  @IsNumber()
  diem?: number;
}
