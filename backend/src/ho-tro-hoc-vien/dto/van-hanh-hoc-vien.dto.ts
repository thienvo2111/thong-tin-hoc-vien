import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

// ADR 0004 G13/G14 (issue #18): báo vắng + đề nghị đổi lớp — lý do bắt buộc.

export class BaoVangDto {
  @IsUUID()
  lich_hoc_id!: string;

  @IsString()
  @MinLength(2, { message: 'Lý do tối thiểu 2 ký tự' })
  @MaxLength(500)
  ly_do!: string;
}

export class TaoDeNghiDoiLopDto {
  @IsUUID()
  giai_doan_id!: string;

  @IsUUID()
  lop_de_nghi_id!: string;

  @IsString()
  @MinLength(5, { message: 'Lý do tối thiểu 5 ký tự' })
  @MaxLength(500)
  ly_do!: string;
}

export class LopCoTheDoiQueryDto {
  @IsUUID()
  giai_doan_id!: string;
}
