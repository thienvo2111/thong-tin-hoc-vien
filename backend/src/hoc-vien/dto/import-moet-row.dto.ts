import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

// 1 dòng file "Luồng import nhân sự từ CSDL MOET" (docs/api-contract.md mục
// 2) sau khi đã khớp cột "Đơn vị" -> don_vi_cong_tac_id. chuyen_mon_raw giữ
// nguyên chuỗi gốc (tách theo ";" ở ImportService, không tách ở đây vì
// class-validator không có decorator tách chuỗi sẵn).
//
// T4b (2026-09-29): ma_dinh_danh_moet và so_dinh_danh_ca_nhan đều TÙY CHỌN ở
// đây (mỗi cột riêng) — điều kiện "phải có ít nhất 1 trong 2" được kiểm tra
// ở HocVienService.checkValidMoetImportRow (không biểu diễn được bằng
// decorator đơn lẻ của class-validator).
export class HoSoNhanSuMoetRowDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  ma_dinh_danh_moet?: string;

  // Regex 12 chữ số kiểm tra ở HocVienService.checkValidMoetImportRow
  // (validateSoDinhDanh dùng chung), không lặp lại ở DTO — theo đúng pattern
  // CreateHocVienDto.
  @IsOptional()
  @IsString()
  so_dinh_danh_ca_nhan?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  ho_ten: string;

  @Type(() => Number)
  @IsInt()
  ngay_sinh: number;

  @Type(() => Number)
  @IsInt()
  thang_sinh: number;

  @Type(() => Number)
  @IsInt()
  nam_sinh: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  chuc_vu?: string;

  // T4c (2026-09-30): danh sách tiếp nhận MOET thực tế có dòng THIẾU cả
  // chuyên môn lẫn SĐT — TÙY CHỌN ở đây, bổ sung sau qua PATCH /hoc-vien/toi
  // (chặn ở validateHocVien requireFull=true khi xác nhận, xem
  // checkValidMoetImportRow ở HocVienService).
  @IsOptional()
  @IsString()
  chuyen_mon_raw?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  so_dien_thoai_lien_he?: string;

  @IsOptional()
  @IsString()
  ghi_chu?: string;

  @IsUUID()
  don_vi_cong_tac_id: string;
}
