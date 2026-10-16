import { trang_thai_de_nghi } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

// Độ dài ly_do được kiểm bằng chuanHoaLyDo (5–500 sau NFC + trim).
export class GuiDoiBuoiDto {
  @IsUUID()
  lich_nguon_id: string;

  @IsUUID()
  lich_de_nghi_id: string;

  @IsString()
  ly_do: string;
}

export class LocDoiBuoiDto {
  @IsOptional()
  @IsEnum(trang_thai_de_nghi)
  trang_thai?: trang_thai_de_nghi;

  @IsOptional()
  @IsUUID()
  khoa_id?: string;
}

// ghi_chu kiểm bằng chuanHoaLyDo trong service (5–500 sau NFC + trim).
export class DuyetDoiBuoiDto {
  @IsOptional()
  @IsUUID()
  lich_chot_id?: string;

  @IsOptional()
  @IsString()
  ghi_chu?: string;
}

export class GhiChuXuLyDto {
  @IsString()
  ghi_chu: string;
}
