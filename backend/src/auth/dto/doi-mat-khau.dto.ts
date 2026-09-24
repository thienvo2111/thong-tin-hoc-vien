import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class DoiMatKhauDto {
  @IsString()
  @IsNotEmpty()
  mat_khau_cu: string;

  // Độ dài tối thiểu không có trong validation-checklist.md — ràng buộc hợp
  // lý tối thiểu do tự thêm (flag: cải tiến ngoài spec), tránh mật khẩu rỗng/1 ký tự.
  @IsString()
  @MinLength(6, { message: 'Mật khẩu mới phải có ít nhất 6 ký tự' })
  mat_khau_moi: string;
}
