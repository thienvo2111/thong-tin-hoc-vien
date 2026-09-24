import { loai_danh_muc_import } from '@prisma/client';

// 4/5 loại được triển khai (dia_danh/don_vi_cong_tac/mon_hoc từ lượt trước +
// ho_so_nhan_su_moet ở lượt này, xem HocVienService). phan_lop_hoc_vien vẫn
// bị hoãn (cần module khoa-boi-duong chưa tồn tại) — trả lỗi rõ ràng nếu bị gọi.
export const SUPPORTED_IMPORT_TYPES = [
  'dia_danh',
  'don_vi_cong_tac',
  'mon_hoc',
  'ho_so_nhan_su_moet',
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
