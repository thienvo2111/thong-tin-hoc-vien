import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// Body của POST /khoa-boi-duong/{id}/cum — QĐ10 (mo-rong-nls-an-giang.md,
// 2026-09-30): cụm học viên (nhóm Zalo hỗ trợ theo địa lý), độc lập với cây
// đơn vị công tác và độc lập với 3 loại lớp.
export class CreateCumHocVienDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  ten_cum: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  link_zalo?: string;

  @IsOptional()
  @IsString()
  ghi_chu?: string;
}
