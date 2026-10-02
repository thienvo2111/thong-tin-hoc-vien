import { IsUUID, ValidateIf } from 'class-validator';

// Body của PUT /dang-ky-hoc/{id}/giai-doan/{giaiDoanId}/lop — phân lớp theo
// giai đoạn (spec 2026-10-02). null = gỡ học viên khỏi lớp của giai đoạn.
export class GanLopGiaiDoanDto {
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  lop_id: string | null;
}
