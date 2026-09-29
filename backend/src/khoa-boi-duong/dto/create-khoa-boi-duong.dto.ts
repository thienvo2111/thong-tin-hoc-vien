import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

// Body của POST /khoa-boi-duong — docs/api-contract.md mục 3. Khi Trường gọi,
// don_vi_to_chuc_id luôn suy ra từ caller.don_vi_id (rule #47) — trường này
// trong body bị bỏ qua. Khi Quản trị gọi (T2, QĐ2), don_vi_to_chuc_id BẮT
// BUỘC có trong body (Quản trị không gắn với đơn vị nào để suy ra) — validate
// đơn vị active + loai_don_vi ∈ {khac, truong} ở service.
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
  don_vi_to_chuc_id?: string;
}
