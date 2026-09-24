import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

// Body của POST /lop/{id}/lich-hoc — docs/api-contract.md mục 3. giai_doan_id
// phải thuộc cùng khoa_id với lop_id — kiểm tra chéo ở service (rule #50,
// không thể biểu diễn bằng FK/CHECK vì 2 cột khác bảng).
export class CreateLichHocDto {
  @IsUUID()
  giai_doan_id: string;

  @IsDateString()
  thoi_gian_bat_dau: string;

  @IsDateString()
  thoi_gian_ket_thuc: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  dia_diem_hoac_link?: string;
}
