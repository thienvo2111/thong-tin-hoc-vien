import type { muc_nang_luc } from '@prisma/client';

// Điều chỉnh mức lớp học (2026-10-08): học viên chỉ được chọn mức BẰNG hoặc
// THẤP HƠN mức đánh giá đầu vào. Mức học hiệu lực = muc_hoc_chon ?? muc_dau_vao.
export const THU_TU_MUC: Record<muc_nang_luc, number> = {
  co_ban: 1,
  thanh_thao: 2,
  nang_cao: 3,
};

export function mucHocHieuLuc(dk: {
  muc_dau_vao: muc_nang_luc | null;
  muc_hoc_chon: muc_nang_luc | null;
}): muc_nang_luc | null {
  return dk.muc_hoc_chon ?? dk.muc_dau_vao;
}

export function duocChonMuc(
  mucDauVao: muc_nang_luc | null,
  mucChon: muc_nang_luc | null,
): boolean {
  if (!mucDauVao || !mucChon) return false;
  return THU_TU_MUC[mucChon] <= THU_TU_MUC[mucDauVao];
}
