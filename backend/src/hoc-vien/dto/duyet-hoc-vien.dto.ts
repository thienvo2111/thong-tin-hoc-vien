import { IsIn, IsOptional, IsString } from 'class-validator';

export type KetQuaDuyet = 'da_duyet' | 'tu_choi';

// Body của POST /hoc-vien/{id}/duyet — docs/api-contract.md mục 2.
export class DuyetHocVienDto {
  @IsIn(['da_duyet', 'tu_choi'])
  ket_qua: KetQuaDuyet;

  @IsOptional()
  @IsString()
  ly_do?: string;
}
