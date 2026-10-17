import {
  loai_su_kien_thong_bao,
  trang_thai_hang_doi_email,
} from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

// GET /thong-bao/hang-doi/danh-sach — docs/api-contract.md mục 8.
export class HangDoiEmailQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(trang_thai_hang_doi_email)
  trang_thai?: trang_thai_hang_doi_email;

  @IsOptional()
  @IsEnum(loai_su_kien_thong_bao)
  loai_su_kien?: loai_su_kien_thong_bao;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(255)
  q?: string;
}
