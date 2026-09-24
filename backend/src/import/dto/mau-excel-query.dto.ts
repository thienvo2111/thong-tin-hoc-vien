import { IsString } from 'class-validator';

export class MauExcelQueryDto {
  @IsString()
  loai: string;
}
