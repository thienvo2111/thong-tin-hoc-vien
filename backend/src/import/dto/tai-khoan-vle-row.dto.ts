import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

// 1 dòng đã dựng xong (sau khi resolveHocVienImportRow đã tra hoc_vien_id)
// cho import tai_khoan_vle (T15, mo-rong-nls-an-giang.md) — file Phòng CNTT
// trả về sau khi tạo tài khoản VLE cho toàn bộ học viên (QĐ8, cách B).
// mat_khau_tam giữ NGUYÊN VĂN (chưa mã hóa) tới khi ImportService.commitRow
// gọi encryptVleMatKhau() — không log/println DTO này ở đâu khác.
export class TaiKhoanVleRowDto {
  @IsUUID()
  hoc_vien_id: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  ten_dang_nhap_vle: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  mat_khau_tam?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  duong_dan: string;
}
