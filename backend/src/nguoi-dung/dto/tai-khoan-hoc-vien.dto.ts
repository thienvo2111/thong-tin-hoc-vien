import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export const TINH_TRANG_TAI_KHOAN_HOC_VIEN = [
  'tam_khoa',
  'chua_dang_nhap',
  'phai_doi_mat_khau',
] as const;
export type TinhTrangTaiKhoanHocVien =
  (typeof TINH_TRANG_TAI_KHOAN_HOC_VIEN)[number];

export class QueryTaiKhoanHocVienDto extends PaginationQueryDto {
  // page_size: base DTO cho tới 200; service chặn trần 100.
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(['active', 'ngung'])
  trang_thai?: 'active' | 'ngung';

  @IsOptional()
  @IsIn(TINH_TRANG_TAI_KHOAN_HOC_VIEN)
  tinh_trang?: TinhTrangTaiKhoanHocVien;
}

export class DoiTrangThaiTaiKhoanHocVienDto {
  @IsIn(['active', 'ngung'])
  trang_thai!: 'active' | 'ngung';
}
