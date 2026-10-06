import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export const VAI_TRO_HO_TRO = ['ho_tro_hoc_vien', 'ho_tro_giang_vien'] as const;
export type VaiTroHoTro = (typeof VAI_TRO_HO_TRO)[number];

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

  // ADR 0004 L1 (issue #14): loại người hỗ trợ — mặc định hỗ trợ học viên.
  @IsOptional()
  @IsIn(VAI_TRO_HO_TRO)
  vai_tro?: VaiTroHoTro;
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
  // Mặc định ho_tro_hoc_vien (giữ hành vi cũ của ô chọn người hỗ trợ cụm).
  @IsOptional()
  @IsIn(VAI_TRO_HO_TRO)
  vai_tro?: VaiTroHoTro;

  @IsOptional()
  @IsIn(['active', 'ngung'])
  trang_thai?: 'active' | 'ngung';

  @IsOptional()
  @IsString()
  q?: string;
}
