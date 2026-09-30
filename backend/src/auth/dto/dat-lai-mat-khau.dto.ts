import { IsNotEmpty, IsString } from 'class-validator';

export class DatLaiMatKhauDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  // Độ phức tạp thật (≥8 ký tự, có chữ và số, khác ngày sinh ddmmyyyy, khác
  // mật khẩu hiện tại) được kiểm tra ở AuthService — cùng bộ quy tắc với
  // POST /auth/doi-mat-khau (xem AuthService.kiemTraDoDaiVaKyTuMatKhau +
  // kiemTraKhacNgaySinh), không lặp lại ở DTO.
  @IsString()
  @IsNotEmpty()
  mat_khau_moi: string;
}
