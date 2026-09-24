import { loai_danh_muc_import } from '@prisma/client';

// Chỉ 3/5 loại được triển khai ở lượt này (theo phạm vi công việc được giao):
// phan_lop_hoc_vien và ho_so_nhan_su_moet phụ thuộc module hoc-vien/khoa-boi-duong
// chưa tồn tại — bỏ qua, trả lỗi rõ ràng nếu bị gọi.
export const SUPPORTED_IMPORT_TYPES = [
  'dia_danh',
  'don_vi_cong_tac',
  'mon_hoc',
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
