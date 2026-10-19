import { trang_thai_diem_danh, vai_tro_nguoi_dung } from '@prisma/client';

export const HAN_SUA_HO_TRO_GV_MS = 3 * 24 * 60 * 60 * 1000;

export type LyDoKhongSua = 'chua_dien_ra' | 'qua_han' | 'khong_co_quyen';

/**
 * ADR 0005 Z7 / ADR 0004 G12 / ADR 0010 T4 — hàm thuần, dùng chung cho API
 * sửa 1 ô, cờ `sua_duoc` của bảng điểm danh và cờ `bo_sung_duoc` của màn
 * Tình hình đi học (UI không tự tính lại luật thời gian).
 * Quản trị: mọi lúc. Hỗ trợ GV: buổi đã bắt đầu, trong vòng 3 ngày.
 * Hỗ trợ HV (điểm danh bổ sung, ADR 0010): buổi đã bắt đầu, không giới hạn
 * thời gian. Phạm vi (khóa / cụm ∪ lớp) kiểm riêng (cần DB).
 */
export function quyenSuaDiemDanh(
  vaiTro: vai_tro_nguoi_dung,
  batDau: Date,
  now: Date,
): { sua_duoc: boolean; ly_do: LyDoKhongSua | null } {
  if (vaiTro === 'quan_tri') return { sua_duoc: true, ly_do: null };
  if (vaiTro !== 'ho_tro_giang_vien' && vaiTro !== 'ho_tro_hoc_vien') {
    return { sua_duoc: false, ly_do: 'khong_co_quyen' };
  }
  if (batDau.getTime() > now.getTime()) {
    return { sua_duoc: false, ly_do: 'chua_dien_ra' };
  }
  if (
    vaiTro === 'ho_tro_giang_vien' &&
    now.getTime() - batDau.getTime() > HAN_SUA_HO_TRO_GV_MS
  ) {
    return { sua_duoc: false, ly_do: 'qua_han' };
  }
  return { sua_duoc: true, ly_do: null };
}

/**
 * Trạng thái được ghi tay theo vai trò. Hỗ trợ HV chỉ bổ sung "có mặt" /
 * "vắng có phép" (ADR 0010 T4) — không tự ghi "vắng".
 */
export function trangThaiSuaDuoc(
  vaiTro: vai_tro_nguoi_dung,
): trang_thai_diem_danh[] {
  if (vaiTro === 'quan_tri' || vaiTro === 'ho_tro_giang_vien') {
    return ['co_mat', 'vang', 'vang_co_phep'];
  }
  if (vaiTro === 'ho_tro_hoc_vien') return ['co_mat', 'vang_co_phep'];
  return [];
}
