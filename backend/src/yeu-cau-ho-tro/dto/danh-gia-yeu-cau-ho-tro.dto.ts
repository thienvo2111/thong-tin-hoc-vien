import { danh_gia_yeu_cau_ho_tro } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class DanhGiaYeuCauHoTroDto {
  @IsEnum(danh_gia_yeu_cau_ho_tro)
  danh_gia: danh_gia_yeu_cau_ho_tro;
}
