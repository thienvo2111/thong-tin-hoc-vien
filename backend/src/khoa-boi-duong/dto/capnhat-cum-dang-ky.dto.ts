import { IsOptional, IsUUID } from 'class-validator';

// Body của PATCH /dang-ky-hoc/{id}/cum — QĐ10 (mo-rong-nls-an-giang.md,
// 2026-09-30). cum_id=null để gỡ gán cụm khỏi đăng ký học này.
export class CapNhatCumDangKyDto {
  @IsOptional()
  @IsUUID()
  cum_id: string | null;
}
