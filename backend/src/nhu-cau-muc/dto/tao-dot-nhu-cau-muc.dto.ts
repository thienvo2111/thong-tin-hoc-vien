import { Transform } from 'class-transformer';
import { IsISO8601, IsString, Length } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// POST /khoa-boi-duong/:khoaId/dot-nhu-cau-muc (quan_tri) — ADR 0013.
export class TaoDotNhuCauMucDto {
  @Transform(trim)
  @IsString()
  @Length(1, 255)
  ten_dot: string;

  @IsISO8601()
  mo_luc: string;

  @IsISO8601()
  dong_luc: string;
}
