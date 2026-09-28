import { IsNotEmpty, IsString } from 'class-validator';

export class DoiMatKhauDto {
  @IsString()
  @IsNotEmpty()
  mat_khau_cu: string;

  // Độ phức tạp thật (≥8 ký tự, có chữ và số, khác ngày sinh ddmmyyyy, khác
  // mật khẩu cũ — T1 mo-rong-nls-an-giang.md) được kiểm tra ở AuthService,
  // không phải ở DTO, vì cần so sánh với dữ liệu hồ sơ (ngày sinh) và mật
  // khẩu cũ (bcrypt hash) — DTO chỉ giữ ràng buộc không phụ thuộc dữ liệu khác.
  @IsString()
  @IsNotEmpty()
  mat_khau_moi: string;
}
