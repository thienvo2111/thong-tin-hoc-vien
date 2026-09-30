import { IsNotEmpty, IsString } from 'class-validator';

export class XacMinhEmailDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
