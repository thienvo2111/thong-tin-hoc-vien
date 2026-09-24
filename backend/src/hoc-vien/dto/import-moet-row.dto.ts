import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

// 1 dòng file "Luồng import nhân sự từ CSDL MOET" (docs/api-contract.md mục
// 2) sau khi đã khớp cột "Đơn vị" -> don_vi_cong_tac_id. chuyen_mon_raw giữ
// nguyên chuỗi gốc (tách theo ";" ở ImportService, không tách ở đây vì
// class-validator không có decorator tách chuỗi sẵn).
export class HoSoNhanSuMoetRowDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  ma_dinh_danh_moet: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  ho_ten: string;

  @Type(() => Number)
  @IsInt()
  ngay_sinh: number;

  @Type(() => Number)
  @IsInt()
  thang_sinh: number;

  @Type(() => Number)
  @IsInt()
  nam_sinh: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  chuc_vu?: string;

  @IsString()
  chuyen_mon_raw: string;

  @IsString()
  @MinLength(1)
  so_dien_thoai_lien_he: string;

  @IsOptional()
  @IsString()
  ghi_chu?: string;

  @IsUUID()
  don_vi_cong_tac_id: string;
}
