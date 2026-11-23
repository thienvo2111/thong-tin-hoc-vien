import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { GiaiDoanThamGia } from './danhSachThamGia';
import type { LocTienDo, TienDoDot, TongHopTienDo } from './tienDoDot';
import type { TrangThaiDanhSachTruong, TrangThaiHopDong, YKienTruong } from './truongDanhSach';

// Issue #71 / ADR 0015 P1, O3: Sở/Phòng xem tiến độ các trường trong phạm vi theo đợt + danh sách GV (chỉ đọc).
// API chỉ trả trạng thái, danh sách GV, suất, giá trị — không tài khoản/kho bạc, người nhận, QĐ, liên hệ.

/** Vai trò xem các màn Sở/Phòng trên Cổng đơn vị (API: @Roles('so_gddt', 'phong_vhxh')). */
export const VAI_TRO_SO_PHONG = ['so_gddt', 'phong_vhxh'];

export type DotSoPhong = TienDoDot['dot'];

/** Thẻ đợt: số liệu chỉ trên các trường trong phạm vi. */
export interface TheDotSoPhong extends TongHopTienDo {
  dot: DotSoPhong;
}

export interface DongTienDoSoPhong {
  don_vi: { id: string; ma: string | null; ten: string; dia_ban: string };
  so_nguoi: number;
  tong_suat: number;
  /** null = chưa có đơn giá. Đã nộp: giá trị lúc nộp. */
  gia_tri: number | null;
  trang_thai_danh_sach: TrangThaiDanhSachTruong;
  trang_thai_hop_dong: TrangThaiHopDong;
  nop_luc: string | null;
  /** 'YYYY-MM-DD' giờ VN (hạn riêng của trường nếu có, không thì hạn đợt). */
  han_hieu_luc_ngay: string;
  qua_han: boolean;
  so_de_nghi_cho: number;
  thao_tac_cuoi_luc: string | null;
}

export interface TienDoSoPhong {
  dot: DotSoPhong;
  /** Trên mọi trường trong phạm vi của đợt (không phụ thuộc bộ lọc). */
  tong_hop: TongHopTienDo;
  dong: DongTienDoSoPhong[];
}

export interface DongDanhSachSoPhong {
  id: string;
  ho_ten: string;
  ngay_sinh: string | null;
  gioi_tinh: string | null;
  lop: string | null;
  giai_doan: GiaiDoanThamGia;
  ty_le_suat: number;
  ghi_chu: string | null;
  y_kien_truong: YKienTruong | null;
}

export interface DanhSachGvSoPhong {
  dot: DotSoPhong;
  truong: { id: string; ma: string | null; ten: string };
  trang_thai_danh_sach: TrangThaiDanhSachTruong;
  trang_thai_hop_dong: TrangThaiHopDong;
  /** Đã nộp: số liệu lúc nộp hợp đồng. */
  so_nguoi: number;
  tong_suat: number;
  gia_tri: number | null;
  dong: DongDanhSachSoPhong[];
}

const GOC = '/cong-don-vi/don-vi/dot';
export const urlTienDoSoPhong = (dotId: string, loc: LocTienDo) =>
  `${GOC}/${dotId}/tien-do?${new URLSearchParams({ loc })}`;
export const urlDanhSachGvSoPhong = (dotId: string, donViId: string) => `${GOC}/${dotId}/truong/${donViId}/danh-sach`;

export function useDotSoPhong() {
  return useQuery({
    queryKey: ['cong-don-vi', 'don-vi', 'dot'],
    queryFn: () => apiFetch<TheDotSoPhong[]>(GOC),
  });
}

export function useTienDoSoPhong(dotId: string | null, loc: LocTienDo) {
  return useQuery({
    queryKey: ['cong-don-vi', 'don-vi', 'tien-do', dotId, loc],
    queryFn: () => apiFetch<TienDoSoPhong>(urlTienDoSoPhong(dotId as string, loc)),
    enabled: !!dotId,
    // Đổi bộ lọc: giữ bảng cũ tới khi có kết quả mới.
    placeholderData: keepPreviousData,
  });
}

export function useDanhSachGvSoPhong(dotId: string, donViId: string) {
  return useQuery({
    queryKey: ['cong-don-vi', 'don-vi', 'danh-sach', dotId, donViId],
    queryFn: () => apiFetch<DanhSachGvSoPhong>(urlDanhSachGvSoPhong(dotId, donViId)),
  });
}
