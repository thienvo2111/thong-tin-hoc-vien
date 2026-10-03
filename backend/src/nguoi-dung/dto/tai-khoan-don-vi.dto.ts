import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

// Tài khoản đơn vị (ADR 0002). Kiểm tra định dạng tên đăng nhập/email và các
// quy tắc nghiệp vụ nằm ở TaiKhoanDonViService.kiemTraDuLieuTao() để dùng
// chung với import Excel và trả đúng message spec — DTO chỉ kiểm tra kiểu.

export class TaoTaiKhoanDonViDto {
  @IsUUID()
  don_vi_id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  ten_dang_nhap?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  ho_ten?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsIn(['mat_khau_tam', 'email'])
  cach_cap?: 'mat_khau_tam' | 'email';
}

export class SuaTaiKhoanDonViDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  ten_dang_nhap?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  ho_ten?: string;

  // Chuỗi rỗng "" = xóa email.
  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsIn(['active', 'ngung'])
  trang_thai?: 'active' | 'ngung';
}

export class QueryTaiKhoanDonViDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['so_gddt', 'phong_vhxh', 'truong'])
  vai_tro?: 'so_gddt' | 'phong_vhxh' | 'truong';

  @IsOptional()
  @IsIn(['active', 'ngung'])
  trang_thai?: 'active' | 'ngung';

  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsIn([true, false])
  da_dang_nhap?: boolean;

  @IsOptional()
  @IsString()
  q?: string;
}

export class QueryDonViChuaCapDto {
  @IsOptional()
  @IsIn(['so_gddt', 'phong_vhxh', 'truong'])
  loai_don_vi?: 'so_gddt' | 'phong_vhxh' | 'truong';

  @IsOptional()
  @IsString()
  q?: string;
}
