import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

// Body của POST /khoa-boi-duong — docs/api-contract.md mục 3. Chỉ quan_tri
// tạo khóa (D1/D6) — don_vi_dat_hang_id BẮT BUỘC có trong body; thiếu/không
// hợp lệ/sai loại đơn vị được validateDonViDatHang() ở service báo lỗi field
// rõ ràng (giữ @IsOptional() ở DTO để lọt qua đây, không chặn bằng lỗi
// class-validator chung).
export class CreateKhoaBoiDuongDto {
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  ma_khoa: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  ten_khoa: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  dia_diem?: string;

  @IsDateString()
  thoi_gian_bat_dau: string;

  @IsDateString()
  thoi_gian_ket_thuc: string;

  @IsOptional()
  @IsUUID()
  don_vi_dat_hang_id?: string;
}
