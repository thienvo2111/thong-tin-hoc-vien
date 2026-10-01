import { IsString, MinLength } from 'class-validator';

export class TraLoiYeuCauHoTroDto {
  @IsString()
  @MinLength(1)
  noi_dung_tra_loi: string;
}
