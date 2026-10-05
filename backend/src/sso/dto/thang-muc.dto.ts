import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';

export class MucThangDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z0-9]{1,10}$/, {
    message: 'Mã mức chỉ gồm chữ không dấu và số, tối đa 10 ký tự',
  })
  ma: string;

  @IsString()
  @Length(1, 40)
  nhan: string;
}

// PUT /sso/thang-muc (quản trị).
export class LuuThangMucDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => MucThangDto)
  muc: MucThangDto[];
}
