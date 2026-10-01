import { IsString, IsUUID, MinLength } from 'class-validator';

export class TaoYeuCauHoTroDto {
  @IsUUID()
  loai_van_de_id: string;

  @IsString()
  @MinLength(1)
  noi_dung_hoi: string;
}
