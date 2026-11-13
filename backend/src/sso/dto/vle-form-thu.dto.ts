import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import type { muc_nang_luc } from '@prisma/client';

const MUC_NANG_LUC: readonly muc_nang_luc[] = [
  'co_ban',
  'thanh_thao',
  'nang_cao',
];

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Ô trống ("" sau khi trim) coi như không gửi — để quy tắc "ít nhất 1 trong
// username/email" ở VleService.formThu quyết định, không báo lỗi độ dài.
const trimRongThanhUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t === '' ? undefined : t;
};

// POST /sso/vle/form-thu (quan_tri, api-contract mục 10.2): thử vào VLE với
// username/email VLE bất kỳ + mức (để kiểm VLE_COURSE_MAP) — không cần tài
// khoản học viên. Có cả hai -> username thắng (giống luồng học viên).
export class VleFormThuDto {
  @IsOptional()
  @Transform(trimRongThanhUndefined)
  @IsString()
  @Length(1, 100)
  username?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    const v = trimRongThanhUndefined({ value });
    return typeof v === 'string' ? v.toLowerCase() : v;
  })
  @IsEmail({}, { message: 'Email VLE không hợp lệ' })
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @Transform(trim)
  @IsIn(MUC_NANG_LUC)
  muc?: muc_nang_luc;
}
