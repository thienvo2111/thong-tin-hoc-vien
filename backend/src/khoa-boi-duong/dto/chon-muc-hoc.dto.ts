import { IsIn, ValidateIf } from 'class-validator';
import type { muc_nang_luc } from '@prisma/client';

// Body của PUT /hoc-vien/toi/khoa-hoc/{khoaId}/muc-hoc và PATCH
// /dang-ky-hoc/{id}/muc-hoc (2026-10-08). muc=null = quay về học theo mức
// đánh giá đầu vào.
export class ChonMucHocDto {
  @ValidateIf((o: ChonMucHocDto) => o.muc !== null)
  @IsIn(['co_ban', 'thanh_thao', 'nang_cao'], {
    message: 'muc phải là co_ban, thanh_thao, nang_cao hoặc null',
  })
  muc: muc_nang_luc | null;
}
