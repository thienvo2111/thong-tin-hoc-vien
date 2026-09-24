import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

// Body của POST /khoa-boi-duong — docs/api-contract.md mục 3. don_vi_to_chuc_id
// KHÔNG nằm trong body — luôn suy ra từ caller.don_vi_id (Trường gọi endpoint
// này chỉ có thể tạo khóa cho chính đơn vị mình, rule #47).
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
}
