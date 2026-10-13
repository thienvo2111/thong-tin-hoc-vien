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

// ADR 0006 (2026-10-13): 3 nguồn mức đầu vào — kết quả hệ thống (muc_he_thong), nhu cầu học viên
// (muc_hoc_chon), mức chính thức do Quản trị chốt (muc_dau_vao). Chỉ mức chốt dùng để xếp lớp.

/** Mức học hiệu lực (xếp lớp) = mức chính thức đã chốt; null = chưa chốt, chưa xếp lớp. */
export function mucHocHieuLuc(dk: { muc_dau_vao: MucNangLuc | null }): MucNangLuc | null {
  return dk.muc_dau_vao;
}

/** Nhu cầu hiện tại = mức tự chọn ?? mức hệ thống quy đổi (chưa chọn = học theo kết quả đánh giá). */
export function nhuCauMucHoc(dk: { muc_hoc_chon: MucNangLuc | null; muc_he_thong: MucNangLuc | null }): MucNangLuc | null {
  return dk.muc_hoc_chon ?? dk.muc_he_thong;
}

/** Nhãn kết quả hệ thống: giữ nhãn gốc khảo sát, kèm mức quy đổi khi nhãn khác tên mức
 * (vd "M1 – Chưa đạt (quy đổi: Cơ bản)"). Chưa có kết quả -> null. */
export function nhanKetQuaHeThong(dk: {
  muc_he_thong: MucNangLuc | null;
  nhan_muc_goc_danh_gia: string | null;
}): string | null {
  if (!dk.muc_he_thong) return dk.nhan_muc_goc_danh_gia;
  const tenMuc = NHAN_MUC_NANG_LUC[dk.muc_he_thong];
  if (!dk.nhan_muc_goc_danh_gia) return tenMuc;
  if (dk.nhan_muc_goc_danh_gia.includes(tenMuc)) return dk.nhan_muc_goc_danh_gia;
  return `${dk.nhan_muc_goc_danh_gia} (quy đổi: ${tenMuc})`;
}

/** Các mức được chọn: bằng mức đánh giá hoặc thấp hơn ĐÚNG 1 mức (thấp -> cao, 2026-10-09). Chưa có đánh giá -> rỗng. */
export function cacMucDuocChon(mucDanhGia: MucNangLuc | null): MucNangLuc[] {
  if (!mucDanhGia) return [];
  const viTri = THU_TU_MUC.indexOf(mucDanhGia);
  return THU_TU_MUC.slice(Math.max(0, viTri - 1), viTri + 1);
}
