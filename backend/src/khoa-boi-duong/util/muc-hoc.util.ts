import type { muc_nang_luc } from '@prisma/client';

// Điều chỉnh mức lớp học (2026-10-08): học viên chỉ được chọn mức BẰNG hoặc
// THẤP HƠN mức đánh giá làm mốc. Mức học hiệu lực = muc_hoc_chon ?? mốc.
export const THU_TU_MUC: Record<muc_nang_luc, number> = {
  co_ban: 1,
  thanh_thao: 2,
  nang_cao: 3,
};

// Bài trên hệ thống khảo sát dùng làm đánh giá đầu vào — khớp FE M7 (baiDauVao).
export const LOAI_BAI_DAU_VAO = 'danh-gia';

// Quy đổi mã mức gốc của hệ thống khảo sát -> mức lớp học (cố định theo MÃ,
// không theo nhãn thang quản trị cấu hình). CHỈ dùng để xếp lớp / làm mốc điều
// chỉnh mức: M1 "Chưa đạt" vẫn xếp lớp Cơ bản, nhưng KẾT QUẢ hiện cho học viên
// và báo cáo/thống kê theo khảo sát vẫn giữ mã/nhãn gốc (muc_goc).
const MUC_THEO_MA_GOC: Record<string, muc_nang_luc> = {
  M1: 'co_ban',
  M2: 'co_ban',
  M3: 'thanh_thao',
  M4: 'nang_cao',
};

/** Mức quy đổi từ 1 bài khảo sát: ưu tiên `muc`, không có thì theo mã `muc_goc`; mã lạ -> null. */
export function mucTuKetQuaKhaoSat(kq: {
  muc: muc_nang_luc | null;
  muc_goc: string | null;
}): muc_nang_luc | null {
  if (kq.muc) return kq.muc;
  if (!kq.muc_goc) return null;
  return MUC_THEO_MA_GOC[kq.muc_goc.trim().toUpperCase()] ?? null;
}

export type NguonMucDanhGia = 'chot' | 'khao_sat';

/** Mức đánh giá làm mốc = muc_dau_vao (quản trị chốt) ?? mức quy đổi từ bài đầu vào ĐÃ hoàn thành. */
export function mucDanhGiaLamMoc(
  mucDauVao: muc_nang_luc | null,
  baiDauVao: {
    trang_thai: string;
    muc: muc_nang_luc | null;
    muc_goc: string | null;
  } | null,
): { muc: muc_nang_luc | null; nguon: NguonMucDanhGia | null } {
  if (mucDauVao) return { muc: mucDauVao, nguon: 'chot' };
  if (baiDauVao?.trang_thai !== 'hoan_thanh') return { muc: null, nguon: null };
  const muc = mucTuKetQuaKhaoSat(baiDauVao);
  return muc ? { muc, nguon: 'khao_sat' } : { muc: null, nguon: null };
}

export function mucHocHieuLuc(
  mucHocChon: muc_nang_luc | null,
  mucDanhGia: muc_nang_luc | null,
): muc_nang_luc | null {
  return mucHocChon ?? mucDanhGia;
}

export function duocChonMuc(
  mucDanhGia: muc_nang_luc | null,
  mucChon: muc_nang_luc | null,
): boolean {
  if (!mucDanhGia || !mucChon) return false;
  return THU_TU_MUC[mucChon] <= THU_TU_MUC[mucDanhGia];
}
