import { IsString, MaxLength, MinLength } from 'class-validator';

// Body của POST/DELETE /hoc-vien/toi/chuyen-mon — validation-checklist.md #24.
export class ChuyenMonDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  chuyen_mon: string;
}
