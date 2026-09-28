import { IsOptional, IsString } from 'class-validator';

export class GoiYChuyenMonQueryDto {
  @IsOptional()
  @IsString()
  q?: string;
}
