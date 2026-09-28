import { IsOptional, IsUUID } from 'class-validator';

export class QueryDotXacNhanDto {
  @IsOptional()
  @IsUUID()
  khoa_id?: string;
}
