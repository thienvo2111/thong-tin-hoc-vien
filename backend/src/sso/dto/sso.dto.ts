import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export const SSO_TARGET = ['khao-sat', 'danh-gia', 'dau-ra'] as const;
export type SsoTarget = (typeof SSO_TARGET)[number];

// POST /sso/cap-ma (hoc_vien). Bỏ target -> bên khảo sát hiện danh sách bài cần làm.
export class CapMaSsoDto {
  @IsOptional()
  @IsIn(SSO_TARGET)
  target?: SsoTarget;
}

// POST /sso/doi-ma (hệ thống khảo sát, header X-API-Key). Tên trường `code`
// trùng tham số trên URL /sso/start?code=... để bên tích hợp đỡ nhầm.
export class DoiMaSsoDto {
  @IsString()
  @Length(20, 100)
  code: string;
}
