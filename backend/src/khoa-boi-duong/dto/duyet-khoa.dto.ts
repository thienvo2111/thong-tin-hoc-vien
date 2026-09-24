import { IsIn, IsOptional, IsString } from 'class-validator';

export type KetQuaDuyetKhoa = 'da_duyet' | 'tu_choi';

// Body của POST /khoa-boi-duong/{id}/duyet — docs/api-contract.md mục 3.
export class DuyetKhoaDto {
  @IsIn(['da_duyet', 'tu_choi'])
  ket_qua: KetQuaDuyetKhoa;

  @IsOptional()
  @IsString()
  ly_do?: string;
}
