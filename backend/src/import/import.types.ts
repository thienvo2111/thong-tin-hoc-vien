import { loai_danh_muc_import } from '@prisma/client';

// Cả 5/5 loại đã được triển khai (dia_danh/don_vi_cong_tac/mon_hoc/
// ho_so_nhan_su_moet từ các lượt trước + phan_lop_hoc_vien ở lượt này, xem
// KhoaBoiDuongService).
export const SUPPORTED_IMPORT_TYPES = [
  'dia_danh',
  'don_vi_cong_tac',
  'mon_hoc',
  'ho_so_nhan_su_moet',
  'phan_lop_hoc_vien',
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
}
