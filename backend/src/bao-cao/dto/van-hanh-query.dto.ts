import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

// GET /bao-cao/van-hanh?khoa_id=&nhom_hoc_vien=&lop_id= — T7
// (mo-rong-nls-an-giang.md). Cả 3 đều tùy chọn: khoa_id trống -> gộp mọi
// khóa trong phạm vi quyền (xem BaoCaoService.baoCaoVanHanh); nhom_hoc_vien
// khớp CHECK chk_lop_hoc_nhom (1-20, T6).
export class VanHanhQueryDto {
  @IsOptional()
  @IsUUID()
  khoa_id?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  nhom_hoc_vien?: number;

  @IsOptional()
  @IsUUID()
  lop_id?: string;
}
