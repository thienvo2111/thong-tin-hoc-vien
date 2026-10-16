import { trang_thai_de_nghi } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

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

  // true = mọi đề nghị đã xử lý (da_duyet/tu_choi/da_huy), mới xử lý nhất trước; ưu tiên hơn trang_thai.
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsIn([true, false])
  da_xu_ly?: boolean;

  // Chỉ với trang_thai=cho_duyet: mặc định chỉ đề nghị còn hạn (cả buổi nguồn
  // lẫn buổi đề nghị chưa bắt đầu); true = đề nghị quá hạn, 100 bản mới nhất.
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsIn([true, false])
  qua_han?: boolean;
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
