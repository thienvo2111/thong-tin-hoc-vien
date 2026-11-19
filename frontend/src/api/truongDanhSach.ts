import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { GiaiDoanThamGia } from './danhSachThamGia';
import type { ChuongTrinhBoiDuong } from './dotTrienKhai';

// Issue #60 / ADR 0015 U1, X6, S5: trường xem đợt + danh sách tham gia của chính trường (Cổng đơn vị).
export type TrangThaiDanhSachTruong = 'cho_xac_nhan' | 'da_xac_nhan' | 'bao_sai_lech';
export type TrangThaiHopDong = 'chua_nop' | 'da_nop';

export interface DotCuaTruong {
  id: string;
  ten: string;
  chuong_trinh: ChuongTrinhBoiDuong;
  /** ISO UTC — 23:59:59 giờ Việt Nam của han_nop_ngay. */
  han_nop: string;
  /** 'YYYY-MM-DD' theo giờ Việt Nam. */
  han_nop_ngay: string;
}

export interface TheDotTruong {
  dot: DotCuaTruong;
  so_nguoi: number;
  tong_suat: number;
  /** VNĐ, null = chưa có đơn giá. */
  don_gia: number | null;
  /** Đã làm tròn đến đồng; null khi chưa có đơn giá. */
  gia_tri_tam_tinh: number | null;
  trang_thai_danh_sach: TrangThaiDanhSachTruong;
  trang_thai_hop_dong: TrangThaiHopDong;
}

export interface DongDanhSachTruong {
  id: string;
  ho_ten: string;
  /** 'YYYY-MM-DD' hoặc null. */
  ngay_sinh: string | null;
  gioi_tinh: string | null;
  lop: string | null;
  giai_doan: GiaiDoanThamGia;
  ty_le_suat: number;
  ghi_chu: string | null;
}

export interface DanhSachCuaTruong {
  dot: DotCuaTruong;
  dong: DongDanhSachTruong[];
  tong_suat: number;
  don_gia: number | null;
  gia_tri_tam_tinh: number | null;
  trang_thai_danh_sach: TrangThaiDanhSachTruong;
}

const URL = '/cong-don-vi/truong/dot';

export function useDotCuaTruong() {
  return useQuery({
    queryKey: ['cong-don-vi', 'truong', 'dot'],
    queryFn: () => apiFetch<TheDotTruong[]>(URL),
  });
}

export function useDanhSachCuaTruong(dotId: string) {
  return useQuery({
    queryKey: ['cong-don-vi', 'truong', 'dot', dotId, 'danh-sach'],
    queryFn: () => apiFetch<DanhSachCuaTruong>(`${URL}/${dotId}/danh-sach`),
  });
}
