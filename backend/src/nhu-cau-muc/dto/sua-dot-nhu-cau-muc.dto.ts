import { Transform } from 'class-transformer';
import { IsISO8601, IsOptional, IsString, Length } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// PATCH /dot-nhu-cau-muc/:id (quan_tri) — mọi field tùy chọn.
export class SuaDotNhuCauMucDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 255)
  ten_dot?: string;

  @IsOptional()
  @IsISO8601()
  mo_luc?: string;

  @IsOptional()
  @IsISO8601()
  dong_luc?: string;
}
