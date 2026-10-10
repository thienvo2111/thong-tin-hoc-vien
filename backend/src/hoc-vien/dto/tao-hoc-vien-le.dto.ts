import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

// Body của POST /hoc-vien/tao-le — Quản trị tạo lẻ 1 học viên thay cho import
// ho_so_nhan_su_moet. Cùng quy tắc với 1 dòng import MOET (validate ở
// HocVienService.checkValidMoetImportRow, kể cả "ít nhất 1 trong 2 mã").
// khoa_id/cum_id tùy chọn: có khoa_id thì ghi danh luôn (như import
// phan_lop_hoc_vien không gán lớp).
export class TaoHocVienLeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  ma_dinh_danh_moet?: string;

  @IsOptional()
  @IsString()
  so_dinh_danh_ca_nhan?: string;

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

  @IsUUID()
  don_vi_cong_tac_id: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  so_dien_thoai_lien_he?: string;

  @IsOptional()
  @IsString()
  ghi_chu?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  chuyen_mon?: string[];

  @IsOptional()
  @IsUUID()
  khoa_id?: string;

  @IsOptional()
  @IsUUID()
  cum_id?: string;
}
