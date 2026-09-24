import { IsString } from 'class-validator';

// GET /hoc-vien/kiem-tra-trung?so_dinh_danh_ca_nhan= — docs/api-contract.md mục 2.
export class KiemTraTrungQueryDto {
  @IsString()
  so_dinh_danh_ca_nhan: string;
}
