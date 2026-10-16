import { IsString, IsUUID } from 'class-validator';

// Độ dài ly_do được kiểm bằng chuanHoaLyDo (5–500 sau NFC + trim).
export class GuiDoiBuoiDto {
  @IsUUID()
  lich_nguon_id: string;

  @IsUUID()
  lich_de_nghi_id: string;

  @IsString()
  ly_do: string;
}
