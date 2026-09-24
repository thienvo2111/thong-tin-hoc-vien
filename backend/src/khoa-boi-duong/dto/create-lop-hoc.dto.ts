import {
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';

// Body của POST /khoa-boi-duong/{id}/lop — docs/api-contract.md mục 3.
export class CreateLopHocDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  ten_lop: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  si_so_toi_da?: number;
}
