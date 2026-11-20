import { IsIn, IsOptional } from 'class-validator';
import { LOC_TIEN_DO, type LocTienDo } from '../tien-do-dot';

// Issue #65 / ADR 0015 X7, T5: bộ lọc bảng Tiến độ đợt; vắng = tat_ca.
export class LocTienDoDto {
  @IsOptional()
  @IsIn(LOC_TIEN_DO, {
    message: `loc phải là một trong: ${LOC_TIEN_DO.join(', ')}`,
  })
  loc?: LocTienDo;
}
