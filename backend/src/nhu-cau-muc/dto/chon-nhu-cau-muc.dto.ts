import { IsIn } from 'class-validator';
import type { muc_nang_luc } from '@prisma/client';

// Body PUT /hoc-vien/toi/nhu-cau-muc/{dotId} (ADR 0013).
export class ChonNhuCauMucDto {
  @IsIn(['co_ban', 'thanh_thao', 'nang_cao'], {
    message: 'muc phải là co_ban, thanh_thao hoặc nang_cao',
  })
  muc!: muc_nang_luc;
}
