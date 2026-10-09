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

/** Mức học hiệu lực = mức tự chọn ?? mức đánh giá làm mốc (chốt ?? quy đổi từ khảo sát, 2026-10-09). */
export function mucHocHieuLuc(dk: { muc_danh_gia: MucNangLuc | null; muc_hoc_chon: MucNangLuc | null }): MucNangLuc | null {
  return dk.muc_hoc_chon ?? dk.muc_danh_gia;
}

/** Ghi chú khi mốc xếp lớp lấy từ khảo sát mà nhãn kết quả khác tên mức lớp (vd M1 – Chưa đạt -> Cơ bản). */
export function ghiChuXepLopTheoKhaoSat(dk: {
  muc_danh_gia: MucNangLuc | null;
  nguon_muc_danh_gia: 'chot' | 'khao_sat' | null;
  nhan_muc_goc_danh_gia: string | null;
}): string | null {
  if (dk.nguon_muc_danh_gia !== 'khao_sat' || !dk.muc_danh_gia || !dk.nhan_muc_goc_danh_gia) return null;
  const tenMuc = NHAN_MUC_NANG_LUC[dk.muc_danh_gia];
  if (dk.nhan_muc_goc_danh_gia.includes(tenMuc)) return null;
  return `xếp lớp ${tenMuc} theo kết quả ${dk.nhan_muc_goc_danh_gia}`;
}

/** Các mức được chọn: bằng hoặc thấp hơn mức đánh giá (thấp -> cao). Chưa có đánh giá -> rỗng. */
export function cacMucDuocChon(mucDanhGia: MucNangLuc | null): MucNangLuc[] {
  if (!mucDanhGia) return [];
  return THU_TU_MUC.slice(0, THU_TU_MUC.indexOf(mucDanhGia) + 1);
}
