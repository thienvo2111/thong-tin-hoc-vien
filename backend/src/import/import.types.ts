import { loai_danh_muc_import } from '@prisma/client';

// Cả 10/10 loại đã được triển khai (dia_danh/don_vi_cong_tac/mon_hoc/
// ho_so_nhan_su_moet/phan_lop_hoc_vien/tai_khoan_vle/ket_qua_danh_gia/
// lop_va_lich_hoc từ các lượt trước + diem_danh/ket_qua_giai_doan (T12,
// mo-rong-nls-an-giang.md) ở lượt này).
export const SUPPORTED_IMPORT_TYPES = [
  'dia_danh',
  'don_vi_cong_tac',
  'mon_hoc',
  'ho_so_nhan_su_moet',
  'phan_lop_hoc_vien',
  'tai_khoan_vle',
  'ket_qua_danh_gia',
  'lop_va_lich_hoc',
  'diem_danh',
  'ket_qua_giai_doan',
  'nhan_su_lop',
  // Tài khoản đơn vị (ADR 0002) — xác nhận nạp trả file Excel mật khẩu tạm.
  'tai_khoan_don_vi',
  // Kết quả khảo sát (2026-10-04) — dự phòng khi hệ thống khảo sát không báo qua API.
  'ket_qua_khao_sat',
] as const satisfies readonly loai_danh_muc_import[];

export type SupportedImportType = (typeof SUPPORTED_IMPORT_TYPES)[number];

export function isSupportedImportType(
  loai: string,
): loai is SupportedImportType {
  return (SUPPORTED_IMPORT_TYPES as readonly string[]).includes(loai);
}

export interface RowBuildResult<TDto> {
  dto?: TDto;
  error?: string;
  // T4 (mo-rong-nls-an-giang.md): cảnh báo 🟡 không chặn dòng (vd SĐT thiếu
  // số 0 đầu đã tự sửa, hoặc T12: điểm danh học bù) — chỉ
  // ho_so_nhan_su_moet/ket_qua_danh_gia/diem_danh dùng, các loại khác luôn
  // undefined.
  canhBao?: string;
}
