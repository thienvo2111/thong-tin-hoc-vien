import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

// 1 dòng import diem_hoc (2026-11-12) đã tra ma_dia_ban/ma_don_vi ra uuid
// (ImportService.buildDiemHocDto). Cùng ràng buộc với CreateDiemHocDto (nhập
// tay). id có = cập nhật điểm học đã có cùng ma_diem_hoc. Cột tùy chọn để
// trống = undefined = giữ nguyên giá trị hiện có khi cập nhật.
export class DiemHocRowDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @Matches(/^[A-Za-z0-9_.-]{1,30}$/)
  ma_diem_hoc: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  ten: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  dia_chi: string;

  @IsUUID()
  dia_ban_id: string;

  @IsOptional()
  @IsUUID()
  don_vi_id?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  suc_chua?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  so_phong?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  nguoi_lien_he?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  sdt_lien_he?: string;

  @IsOptional()
  @IsString()
  ghi_chu_csvc?: string;
}
