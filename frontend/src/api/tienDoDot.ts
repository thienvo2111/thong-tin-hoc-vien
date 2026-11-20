import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiFetch, apiFetchBlob } from './client';
import type { ChuongTrinhBoiDuong } from './dotTrienKhai';
import type { TrangThaiDanhSachTruong, TrangThaiHopDong } from './truongDanhSach';

// Issue #65 / ADR 0015 X7, T5: bảng Tiến độ đợt của Quản trị + Excel trường chưa xong (kèm người liên hệ).

export const LOC_TIEN_DO = ['tat_ca', 'chua_xac_nhan_ds', 'bao_sai_lech', 'chua_nop_hd'] as const;
export type LocTienDo = (typeof LOC_TIEN_DO)[number];

export interface DongTienDo {
  don_vi: { id: string; ma: string | null; ten: string; dia_ban: string };
  so_nguoi: number;
  tong_suat: number;
  /** null = chưa có đơn giá. Đã nộp: giá trị lúc nộp. */
  gia_tri: number | null;
  trang_thai_danh_sach: TrangThaiDanhSachTruong;
  trang_thai_hop_dong: TrangThaiHopDong;
  nop_luc: string | null;
  so_de_nghi_cho: number;
  ho_so_du: boolean;
  /** false = trường chưa khai Hồ sơ đơn vị. */
  co_ho_so: boolean;
  thao_tac_cuoi_luc: string | null;
  thao_tac_cuoi_boi: { ho_ten: string; ten_dang_nhap: string } | null;
}

export interface TongHopTienDo {
  so_truong: number;
  so_da_xac_nhan_ds: number;
  so_bao_sai_lech: number;
  so_da_nop: number;
  tong_nguoi: number;
  tong_suat: number;
  tong_gia_tri: number | null;
}

export interface TienDoDot {
  dot: {
    id: string;
    ten: string;
    chuong_trinh: ChuongTrinhBoiDuong;
    don_gia: number | null;
    han_nop: string;
    han_nop_ngay: string;
  };
  /** Trên mọi trường của đợt (không phụ thuộc bộ lọc). */
  tong_hop: TongHopTienDo;
  /** Đã lọc theo loc, theo tên trường. */
  dong: DongTienDo[];
}

const urlGoc = (dotId: string) => `/cong-don-vi/dot-trien-khai/${dotId}/tien-do`;
const qs = (loc: LocTienDo) => `?${new URLSearchParams({ loc })}`;

export const urlTienDoDot = (dotId: string, loc: LocTienDo) => `${urlGoc(dotId)}${qs(loc)}`;
export const urlXuatTienDoDot = (dotId: string, loc: LocTienDo) => `${urlGoc(dotId)}/xuat-excel${qs(loc)}`;

export function useTienDoDot(dotId: string | null, loc: LocTienDo) {
  return useQuery({
    queryKey: ['cong-don-vi', 'tien-do-dot', dotId, loc],
    queryFn: () => apiFetch<TienDoDot>(urlTienDoDot(dotId as string, loc)),
    enabled: !!dotId,
    // Đổi bộ lọc: giữ bảng cũ tới khi có kết quả mới (không nháy khung chờ).
    placeholderData: keepPreviousData,
  });
}

/** Excel các trường chưa xong (chưa nộp hợp đồng) khớp bộ lọc — có SĐT/email liên hệ. */
export function xuatExcelTienDoDot(dotId: string, loc: LocTienDo) {
  return apiFetchBlob(urlXuatTienDoDot(dotId, loc));
}
