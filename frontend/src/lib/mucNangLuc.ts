import type { MucNangLuc } from '@/api/types';

export const NHAN_MUC_NANG_LUC: Record<MucNangLuc, string> = {
  co_ban: 'Cơ bản',
  thanh_thao: 'Thành thạo',
  nang_cao: 'Nâng cao',
};

export function nhanMucNangLuc(muc: MucNangLuc | null): string {
  return muc ? NHAN_MUC_NANG_LUC[muc] : 'Chưa có kết quả';
}

// Điều chỉnh mức lớp học (2026-10-08) — khớp backend util/muc-hoc.util.ts.
export const THU_TU_MUC: MucNangLuc[] = ['co_ban', 'thanh_thao', 'nang_cao'];

/** Mức học hiệu lực = mức tự chọn ?? mức đánh giá. */
export function mucHocHieuLuc(dk: { muc_dau_vao: MucNangLuc | null; muc_hoc_chon: MucNangLuc | null }): MucNangLuc | null {
  return dk.muc_hoc_chon ?? dk.muc_dau_vao;
}

/** Các mức được chọn: bằng hoặc thấp hơn mức đánh giá (thấp -> cao). Chưa có đánh giá -> rỗng. */
export function cacMucDuocChon(mucDauVao: MucNangLuc | null): MucNangLuc[] {
  if (!mucDauVao) return [];
  return THU_TU_MUC.slice(0, THU_TU_MUC.indexOf(mucDauVao) + 1);
}
