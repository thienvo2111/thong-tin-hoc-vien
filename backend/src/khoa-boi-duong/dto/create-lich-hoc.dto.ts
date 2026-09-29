import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
} from 'class-validator';

// Body của POST /lop/{id}/lich-hoc — docs/api-contract.md mục 3. giai_doan_id
// phải thuộc cùng khoa_id với lop_id — kiểm tra chéo ở service (rule #50,
// không thể biểu diễn bằng FK/CHECK vì 2 cột khác bảng).
export class CreateLichHocDto {
  @IsUUID()
  giai_doan_id: string;

  // T6 (mo-rong-nls-an-giang.md, QĐ3): buổi thứ mấy trong giai đoạn — tùy
  // chọn, mặc định 1 (khớp DEFAULT 1 của cột lich_hoc_lop.buoi_so) để không
  // phá vỡ lời gọi cũ (1 lịch/giai đoạn/lớp trước khi có T6).
  @IsOptional()
  @IsInt()
  @Min(1)
  buoi_so?: number;

  @IsDateString()
  thoi_gian_bat_dau: string;

  @IsDateString()
  thoi_gian_ket_thuc: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  dia_diem_hoac_link?: string;
}
