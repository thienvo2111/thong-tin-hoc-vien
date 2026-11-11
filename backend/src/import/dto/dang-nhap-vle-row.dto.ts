import { IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

// 1 dòng đã dựng xong (sau khi resolveHocVienImportRow đã tra hoc_vien_id)
// cho import dang_nhap_vle (Vào học VLE, external-login P.CNTT, 2026-11-10,
// docs/api-contract.md mục 10.2). Khác tai_khoan_vle (T15) — không lưu mật
// khẩu, chỉ lưu username/email dùng để khớp sang VLE khi học viên bấm
// "Vào học VLE". Phải có ít nhất 1 trong username/email (kiểm tra ở
// ImportService.buildDangNhapVleDto, không phải ở decorator cấp DTO này).
export class DangNhapVleRowDto {
  @IsUUID()
  hoc_vien_id: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  username?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;
}
