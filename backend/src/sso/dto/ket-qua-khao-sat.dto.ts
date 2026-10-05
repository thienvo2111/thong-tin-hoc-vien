import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { SSO_TARGET, SsoTarget } from './sso.dto';

// Loại bài = đúng giá trị `target` của SSO (2026-10-04) để 2 bên dùng chung 1 bộ mã.
export const LOAI_KHAO_SAT = SSO_TARGET;
export type LoaiKhaoSat = SsoTarget;

export const MUC_NANG_LUC = ['co_ban', 'thanh_thao', 'nang_cao'] as const;
export type MucNangLuc = (typeof MUC_NANG_LUC)[number];

// Trạng thái hệ thống khảo sát được phép báo về. `da_mo` do cổng tự ghi khi đổi mã SSO.
export const TRANG_THAI_BAO_VE = ['dang_lam', 'hoan_thanh'] as const;
export type TrangThaiBaoVe = (typeof TRANG_THAI_BAO_VE)[number];

// Bộ lọc tình hình ở trang quản trị: thêm `chua_lam` (không có bản ghi) và
// `can_kiem_tra` (đã mở / đang làm nhưng quá lâu không cập nhật).
export const LOC_TINH_HINH = [
  'chua_lam',
  'da_mo',
  'dang_lam',
  'hoan_thanh',
  'can_kiem_tra',
] as const;
export type LocTinhHinh = (typeof LOC_TINH_HINH)[number];

// POST /sso/ket-qua (máy chủ khảo sát, header X-API-Key). Cần 1 trong 2:
// hoc_vien_id (nhận từ /sso/doi-ma) hoặc ma_dinh_danh_moet.
export class BaoKetQuaDto {
  @IsOptional()
  @IsUUID()
  hoc_vien_id?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  ma_dinh_danh_moet?: string;

  @IsIn(LOAI_KHAO_SAT)
  loai: LoaiKhaoSat;

  @IsIn(TRANG_THAI_BAO_VE)
  trang_thai: TrangThaiBaoVe;

  @IsOptional()
  @IsDateString()
  thoi_diem?: string;

  @IsOptional()
  @IsIn(MUC_NANG_LUC)
  muc?: MucNangLuc;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999)
  diem?: number;

  // 2026-10-05: điểm tối đa của bài, để hiển thị "13,75 / 44 (31,25%)".
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9999)
  diem_toi_da?: number;

  // 2026-10-05: nhãn mức theo thang riêng của hệ thống khảo sát (vd "M1 – Chưa đạt").
  @IsOptional()
  @IsString()
  @MaxLength(50)
  muc_goc?: string;

  // 2026-10-05: trang kết quả chi tiết bên khảo sát — phải cùng tên miền SSO_KHAO_SAT_URL (kiểm ở service).
  @IsOptional()
  @IsString()
  @MaxLength(500)
  url_ket_qua?: string;

  @IsOptional()
  @IsObject()
  chi_tiet?: Record<string, unknown>;
}

/** Tên trường hợp lệ của POST /sso/ket-qua — trường khác bị ValidationPipe (whitelist) bỏ âm thầm,
 * nên controller liệt kê lại cho bên khảo sát biết (`bo_qua`). */
export const TRUONG_BAO_KET_QUA = [
  'hoc_vien_id',
  'ma_dinh_danh_moet',
  'loai',
  'trang_thai',
  'thoi_diem',
  'muc',
  'diem',
  'diem_toi_da',
  'muc_goc',
  'url_ket_qua',
  'chi_tiet',
] as const;

// GET /ket-qua-khao-sat (quản trị).
export class QueryTinhHinhKhaoSatDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  khoa_id?: string;

  @IsOptional()
  @IsIn(LOAI_KHAO_SAT)
  loai?: LoaiKhaoSat;

  @IsOptional()
  @IsIn(LOC_TINH_HINH)
  trang_thai?: LocTinhHinh;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class ThongKeKhaoSatDto {
  @IsOptional()
  @IsUUID()
  khoa_id?: string;
}
