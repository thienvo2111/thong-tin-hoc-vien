// Issue #65 / ADR 0015 X7, T5: hàm thuần cho bảng Tiến độ đợt (lọc trạng thái, "chưa xong", tổng hợp).
// Không truy cập DB — test đơn vị ở tien-do-dot.spec.ts. Issue #66 / T2, T3: lọc "Quá hạn".
import type {
  trang_thai_danh_sach_truong,
  trang_thai_hop_dong,
} from '@prisma/client';
import { tongSuat } from './quy-tac-hop-dong';

export const LOC_TIEN_DO = [
  'tat_ca',
  'chua_xac_nhan_ds',
  'bao_sai_lech',
  'chua_nop_hd',
  'qua_han',
] as const;
export type LocTienDo = (typeof LOC_TIEN_DO)[number];

export interface TrangThaiTienDo {
  trang_thai_danh_sach: trang_thai_danh_sach_truong;
  trang_thai_hop_dong: trang_thai_hop_dong;
  /** Issue #66: quá hạn hiệu lực mà chưa nộp hợp đồng (xem quaHan). */
  qua_han: boolean;
}

/** Issue #66 / T2: "Quá hạn" = đã hết hạn hiệu lực VÀ chưa nộp hợp đồng (đã nộp thì xong việc, không quá hạn). */
export function quaHan(
  daHetHan: boolean,
  trangThaiHopDong: trang_thai_hop_dong,
): boolean {
  return daHetHan && trangThaiHopDong !== 'da_nop';
}

/** Một trường có khớp bộ lọc không. */
export function khopLoc(dong: TrangThaiTienDo, loc: LocTienDo): boolean {
  switch (loc) {
    case 'chua_xac_nhan_ds':
      return dong.trang_thai_danh_sach !== 'da_xac_nhan';
    case 'bao_sai_lech':
      return dong.trang_thai_danh_sach === 'bao_sai_lech';
    case 'chua_nop_hd':
      return dong.trang_thai_hop_dong !== 'da_nop';
    case 'qua_han':
      return dong.qua_han;
    default:
      return true;
  }
}

/** Lọc các dòng theo trạng thái (giữ nguyên thứ tự). */
export function locTienDo<T extends TrangThaiTienDo>(
  dong: readonly T[],
  loc: LocTienDo,
): T[] {
  return dong.filter((d) => khopLoc(d, loc));
}

/** T5: "chưa xong" = chưa nộp hợp đồng (nộp là việc cuối cùng của trường). */
export function chuaXong(dong: TrangThaiTienDo): boolean {
  return dong.trang_thai_hop_dong !== 'da_nop';
}

/** Mốc muộn hơn trong 2 mốc, bỏ qua null (GREATEST của Postgres). */
export function mocMuonHon(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return b.getTime() > a.getTime() ? b : a;
}

export interface SoLieuTienDo extends TrangThaiTienDo {
  so_nguoi: number;
  tong_suat: number;
  gia_tri: number | null;
}

export interface TongHopTienDo {
  so_truong: number;
  so_da_xac_nhan_ds: number;
  so_bao_sai_lech: number;
  so_da_nop: number;
  /** Issue #66: số trường quá hạn (hết hạn hiệu lực, chưa nộp). */
  so_qua_han: number;
  tong_nguoi: number;
  tong_suat: number;
  /** Tổng các giá trị đã biết; null khi không trường nào có giá trị (đợt chưa có đơn giá). */
  tong_gia_tri: number | null;
}

/** Tổng hợp trên MỌI trường của đợt (không phụ thuộc bộ lọc). Tổng suất cộng chính xác theo nửa suất. */
export function tongHopTienDo(dong: readonly SoLieuTienDo[]): TongHopTienDo {
  const coGiaTri = dong.filter((d) => d.gia_tri !== null);
  return {
    so_truong: dong.length,
    so_da_xac_nhan_ds: dong.filter(
      (d) => d.trang_thai_danh_sach === 'da_xac_nhan',
    ).length,
    so_bao_sai_lech: dong.filter(
      (d) => d.trang_thai_danh_sach === 'bao_sai_lech',
    ).length,
    so_da_nop: dong.filter((d) => d.trang_thai_hop_dong === 'da_nop').length,
    so_qua_han: dong.filter((d) => d.qua_han).length,
    tong_nguoi: dong.reduce((t, d) => t + d.so_nguoi, 0),
    tong_suat: tongSuat(dong.map((d) => ({ ty_le_suat: d.tong_suat }))),
    tong_gia_tri: coGiaTri.length
      ? coGiaTri.reduce((t, d) => t + (d.gia_tri as number), 0)
      : null,
  };
}
