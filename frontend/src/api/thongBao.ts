import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { PaginatedResult } from './types';

// Màn "Nhật ký email" của Quản trị — /thong-bao/* (api-contract.md mục 8), chỉ quan_tri.

export type LoaiSuKienThongBao =
  | 'hoc_vien_xac_nhan'
  | 'hoc_vien_duyet'
  | 'khoa_boi_duong_duyet'
  | 'dang_ky_hoc_phan_lop'
  | 'dang_ky_hoc_ket_qua'
  | 'yeu_cau_ho_tro_tra_loi'
  | 'email_xac_minh'
  | 'kich_hoat_tai_khoan'
  | 'dat_lai_mat_khau'
  | 'yeu_cau_ho_tro_cap_nhat_tra_loi'
  | 'nhac_lich_giang_vien';

export type TrangThaiGuiEmail = 'thanh_cong' | 'that_bai';
export type TrangThaiHangDoiEmail = 'cho_gui' | TrangThaiGuiEmail;

export interface NhatKyThongBao {
  id: string;
  loai_su_kien: LoaiSuKienThongBao;
  hoc_vien_id: string | null;
  email_nguoi_nhan: string;
  tieu_de: string;
  gui_luc: string;
  trang_thai: TrangThaiGuiEmail;
  loi: string | null;
}

export interface HangDoiEmailDong {
  id: string;
  loai_su_kien: LoaiSuKienThongBao;
  hoc_vien_id: string | null;
  email_nguoi_nhan: string;
  tieu_de: string;
  trang_thai: TrangThaiHangDoiEmail;
  so_lan_thu: number;
  loi: string | null;
  created_at: string;
  gui_luc: string | null;
}

export interface HangDoiEmailChiTiet extends HangDoiEmailDong {
  noi_dung_html: string;
}

export interface TrangThaiHangDoi {
  theo_trang_thai: Record<TrangThaiHangDoiEmail, number>;
  da_gui_hom_nay: number;
  han_muc_con_lai: number;
}

export interface LocEmailParams {
  loai_su_kien?: LoaiSuKienThongBao;
  trang_thai?: string;
  q?: string;
  page?: number;
  page_size?: number;
}

function xayQueryString(params: object): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

const KHOA = ['thong-bao'] as const;

export function useTrangThaiHangDoi() {
  return useQuery({
    queryKey: [...KHOA, 'hang-doi'],
    queryFn: () => apiFetch<TrangThaiHangDoi>('/thong-bao/hang-doi'),
  });
}

export function useLichSuEmail(params: LocEmailParams) {
  return useQuery({
    queryKey: [...KHOA, 'lich-su', params],
    queryFn: () => apiFetch<PaginatedResult<NhatKyThongBao>>(`/thong-bao/lich-su${xayQueryString(params)}`),
    placeholderData: keepPreviousData,
  });
}

export function useDanhSachHangDoiEmail(params: LocEmailParams) {
  return useQuery({
    queryKey: [...KHOA, 'hang-doi', 'danh-sach', params],
    queryFn: () =>
      apiFetch<PaginatedResult<HangDoiEmailDong>>(`/thong-bao/hang-doi/danh-sach${xayQueryString(params)}`),
    placeholderData: keepPreviousData,
  });
}

export function useChiTietHangDoiEmail(id: string | null) {
  return useQuery({
    queryKey: [...KHOA, 'hang-doi', 'chi-tiet', id],
    queryFn: () => apiFetch<HangDoiEmailChiTiet>(`/thong-bao/hang-doi/${id}`),
    enabled: !!id,
  });
}
