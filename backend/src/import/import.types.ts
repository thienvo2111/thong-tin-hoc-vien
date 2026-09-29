import { loai_danh_muc_import } from '@prisma/client';

// Cả 7/7 loại đã được triển khai (dia_danh/don_vi_cong_tac/mon_hoc/
// ho_so_nhan_su_moet/phan_lop_hoc_vien/tai_khoan_vle từ các lượt trước +
// ket_qua_danh_gia (T5, mo-rong-nls-an-giang.md) ở lượt này).
export const SUPPORTED_IMPORT_TYPES = [
  'dia_danh',
  'don_vi_cong_tac',
  'mon_hoc',
  'ho_so_nhan_su_moet',
  'phan_lop_hoc_vien',
  'tai_khoan_vle',
  'ket_qua_danh_gia',
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
  // số 0 đầu đã tự sửa) — chỉ ho_so_nhan_su_moet dùng, các loại khác luôn
  // undefined.
  canhBao?: string;
}
