import { IsString, MaxLength, MinLength } from 'class-validator';

export class TaoYeuCauHoTroDto {
  // Tên tình huống học viên chọn ở mục "Lỗi thường gặp" (frontend/src/content/huongDan.ts) hoặc "Khác".
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  tinh_huong: string;

  @IsString()
  @MinLength(1)
  noi_dung_hoi: string;
}
