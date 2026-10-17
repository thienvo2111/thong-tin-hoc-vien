import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { TrangThaiNhac } from './nhacLich';

// ADR 0009: email lịch giảng dạy theo (khóa × giai đoạn × giảng viên) — chỉ gửi khi bấm nút.

export interface GiaiDoanChon {
  id: string;
  thu_tu: number;
  ten_giai_doan: string;
  hinh_thuc: string;
  thoi_gian_bat_dau: string;
  thoi_gian_ket_thuc: string;
}

export interface KhoaCuaToiGv {
  id: string;
  ma_khoa: string;
  ten_khoa: string;
  giai_doan: GiaiDoanChon[];
}

export type TrangThaiHangDoi = 'cho_gui' | 'thanh_cong' | 'that_bai';

export interface DongGiangVienEmail {
  id: string;
  ho_ten: string;
  email: string | null;
  so_buoi: number;
  so_lop: number;
  trang_thai_nhac: TrangThaiNhac;
  email_cuoi: { gui_luc: string; trang_thai: TrangThaiHangDoi; loi: string | null } | null;
}

export interface DanhSachEmailLichDay {
  giai_doan: Omit<GiaiDoanChon, 'thu_tu'>;
  giang_vien: DongGiangVienEmail[];
}

export interface XemTruocEmailLichDay {
  tieu_de: string;
  html: string;
  la_cap_nhat: boolean;
  email: string | null;
}

export type LyDoBoQua = 'khong_co_email' | 'khong_co_buoi' | 'loi_he_thong';

export interface KetQuaGuiEmailLichDay {
  da_xep_hang: number;
  bo_qua: { giang_vien_id: string; ho_ten: string; ly_do: LyDoBoQua }[];
}

const goc = (khoaId: string, gdId: string) => `/ho-tro-giang-vien/khoa/${khoaId}/giai-doan/${gdId}/email-lich-day`;

export function useKhoaCuaToiGv() {
  return useQuery({
    queryKey: ['ho-tro-gv', 'khoa'],
    queryFn: () => apiFetch<KhoaCuaToiGv[]>('/ho-tro-giang-vien/khoa'),
  });
}

export function useDanhSachEmailLichDay(khoaId: string | null, gdId: string | null) {
  return useQuery({
    queryKey: ['ho-tro-gv', 'email-lich-day', khoaId, gdId],
    queryFn: () => apiFetch<DanhSachEmailLichDay>(goc(khoaId!, gdId!)),
    enabled: !!khoaId && !!gdId,
  });
}

export function useXemTruocEmailLichDay(khoaId: string | null, gdId: string | null, gvId: string | null) {
  return useQuery({
    queryKey: ['ho-tro-gv', 'email-lich-day', 'xem-truoc', khoaId, gdId, gvId],
    queryFn: () => apiFetch<XemTruocEmailLichDay>(`${goc(khoaId!, gdId!)}/${gvId}/xem-truoc`),
    enabled: !!khoaId && !!gdId && !!gvId,
    gcTime: 0,
  });
}

export function useGuiEmailLichDay(khoaId: string | null, gdId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (giang_vien_ids: string[]) =>
      apiFetch<KetQuaGuiEmailLichDay>(`${goc(khoaId!, gdId!)}/gui`, {
        method: 'POST',
        body: JSON.stringify({ giang_vien_ids }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ho-tro-gv'] }),
  });
}
