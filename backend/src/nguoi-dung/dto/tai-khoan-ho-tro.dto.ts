import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

// Người hỗ trợ học viên (ADR 0003). Như tài khoản đơn vị: DTO chỉ kiểm tra
// kiểu, quy tắc tên đăng nhập/email nằm ở TaiKhoanHoTroService.

export class TaoTaiKhoanHoTroDto {
  @IsString()
  @MaxLength(255)
  ho_ten!: string;

  // Bắt buộc (cán bộ HCMUE) — kiểm tra rỗng/định dạng ở service.
  @IsString()
  @MaxLength(255)
  email!: string;

  // Bỏ trống = phần trước @ của email.
  @IsOptional()
  @IsString()
  @MaxLength(255)
  ten_dang_nhap?: string;

  @IsOptional()
  @IsIn(['email', 'mat_khau_tam'])
  cach_cap?: 'email' | 'mat_khau_tam';
}

export class SuaTaiKhoanHoTroDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  ho_ten?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsIn(['active', 'ngung'])
  trang_thai?: 'active' | 'ngung';
}

export class QueryTaiKhoanHoTroDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['active', 'ngung'])
  trang_thai?: 'active' | 'ngung';

  @IsOptional()
  @IsString()
  q?: string;
}
