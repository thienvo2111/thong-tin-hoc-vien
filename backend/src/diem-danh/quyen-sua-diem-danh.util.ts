import { vai_tro_nguoi_dung } from '@prisma/client';

export const HAN_SUA_HO_TRO_GV_MS = 3 * 24 * 60 * 60 * 1000;

export type LyDoKhongSua = 'chua_dien_ra' | 'qua_han' | 'khong_co_quyen';

/**
 * ADR 0005 Z7 / ADR 0004 G12 — hàm thuần, dùng chung cho API sửa 1 ô và cờ
 * `sua_duoc` của bảng điểm danh (UI không tự tính lại luật 3 ngày).
 * Quản trị: mọi lúc. Hỗ trợ GV: buổi đã bắt đầu, trong vòng 3 ngày.
 * Phạm vi khóa kiểm riêng (cần DB).
 */
export function quyenSuaDiemDanh(
  vaiTro: vai_tro_nguoi_dung,
  batDau: Date,
  now: Date,
): { sua_duoc: boolean; ly_do: LyDoKhongSua | null } {
  if (vaiTro === 'quan_tri') return { sua_duoc: true, ly_do: null };
  if (vaiTro !== 'ho_tro_giang_vien') {
    return { sua_duoc: false, ly_do: 'khong_co_quyen' };
  }
  if (batDau.getTime() > now.getTime()) {
    return { sua_duoc: false, ly_do: 'chua_dien_ra' };
  }
  if (now.getTime() - batDau.getTime() > HAN_SUA_HO_TRO_GV_MS) {
    return { sua_duoc: false, ly_do: 'qua_han' };
  }
  return { sua_duoc: true, ly_do: null };
}
