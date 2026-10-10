import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { trang_thai_diem_danh } from '@prisma/client';

export class SuaDiemDanhDto {
  @IsUUID()
  dang_ky_hoc_id!: string;

  @IsUUID()
  lich_hoc_id!: string;

  @IsIn(['co_mat', 'vang', 'vang_co_phep'])
  trang_thai!: trang_thai_diem_danh;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  ghi_chu?: string;
}

export class BangDiemDanhQueryDto {
  @IsOptional()
  @IsUUID()
  giai_doan_id?: string;
}
