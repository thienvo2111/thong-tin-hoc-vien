import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiFetchBlob } from './client';
import type {
  BuoiHocHoTro,
  CumCuaToi,
  HocVienHoTroChiTiet,
  HocVienHoTroDong,
  MatKhauTamResponse,
  PaginatedResult,
  TrangThaiYeuCauHoTro,
  YeuCauHoTro,
  YeuCauHoTroChiTietHoTro,
  YeuCauHoTroQuanTri,
} from './types';

// Khu người hỗ trợ học viên (ADR 0003) — mọi API tự lọc theo cụm được phân công ở backend.

export interface LocHocVienHoTro {
  q?: string;
  cum_id?: string;
  day_du?: boolean;
  da_dang_nhap?: boolean;
  page?: number;
  page_size?: number;
}

export interface LocLichHocHoTro {
  tu_ngay?: string;
  den_ngay?: string;
  cum_id?: string;
}

function xayQueryString(params: object): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

const KHOA = ['ho-tro'] as const;

export function useCumCuaToi() {
  return useQuery({
    queryKey: [...KHOA, 'cum-cua-toi'],
    queryFn: () => apiFetch<CumCuaToi[]>('/ho-tro/cum-cua-toi'),
  });
}

export function useDanhSachHocVienHoTro(params: LocHocVienHoTro) {
  return useQuery({
    queryKey: [...KHOA, 'hoc-vien', params],
    queryFn: () => apiFetch<PaginatedResult<HocVienHoTroDong>>(`/ho-tro/hoc-vien${xayQueryString(params)}`),
    placeholderData: keepPreviousData,
  });
}

export function useChiTietHocVienHoTro(id: string | undefined) {
  return useQuery({
    queryKey: [...KHOA, 'hoc-vien', 'chi-tiet', id],
    queryFn: () => apiFetch<HocVienHoTroChiTiet>(`/ho-tro/hoc-vien/${id}`),
    enabled: !!id,
  });
}

export function useLichHocHoTro(params: LocLichHocHoTro) {
  return useQuery({
    queryKey: [...KHOA, 'lich-hoc', params],
    queryFn: () => apiFetch<BuoiHocHoTro[]>(`/ho-tro/lich-hoc${xayQueryString(params)}`),
    placeholderData: keepPreviousData,
  });
}

/** Xuất .xlsx theo bộ lọc đang áp dụng (bỏ phân trang). */
export function xuatDanhSachHoTro(params: LocHocVienHoTro): Promise<Blob> {
  const { page: _p, page_size: _ps, ...loc } = params;
  return apiFetchBlob(`/ho-tro/hoc-vien/xuat${xayQueryString(loc)}`);
}

// --- Yêu cầu hỗ trợ theo cụm (ADR 0003 Lát 4) ---

export interface LocYeuCauHoTroHoTro {
  trang_thai?: TrangThaiYeuCauHoTro;
  cum_id?: string;
  page?: number;
  page_size?: number;
}

export function useYeuCauHoTroCuaCum(params: LocYeuCauHoTroHoTro) {
  return useQuery({
    queryKey: [...KHOA, 'yeu-cau', params],
    queryFn: () => apiFetch<PaginatedResult<YeuCauHoTroQuanTri>>(`/ho-tro/yeu-cau-ho-tro${xayQueryString(params)}`),
    placeholderData: keepPreviousData,
  });
}

/** Số đếm trên menu — tải lại khi chuyển trang (không polling, ADR 0003 H13). */
export function useDemYeuCauHoTroCuaCum() {
  return useQuery({
    queryKey: [...KHOA, 'yeu-cau', 'dem'],
    queryFn: () => apiFetch<{ cho_xu_ly: number }>('/ho-tro/yeu-cau-ho-tro/dem'),
  });
}

export function layChiTietYeuCauHoTroCuaCum(id: string) {
  return apiFetch<YeuCauHoTroChiTietHoTro>(`/ho-tro/yeu-cau-ho-tro/${id}`);
}

export function useChiTietYeuCauHoTroCuaCum(id: string | null) {
  return useQuery({
    queryKey: [...KHOA, 'yeu-cau', 'chi-tiet', id],
    queryFn: () => layChiTietYeuCauHoTroCuaCum(id!),
    enabled: !!id,
  });
}

export function traLoiYeuCauHoTroCuaCum(id: string, noi_dung_tra_loi: string) {
  return apiFetch<YeuCauHoTro>(`/ho-tro/yeu-cau-ho-tro/${id}/tra-loi`, {
    method: 'PATCH',
    body: JSON.stringify({ noi_dung_tra_loi }),
  });
}

export function useLamMoiYeuCauHoTroCuaCum() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [...KHOA, 'yeu-cau'] });
}

// --- Can thiệp hồ sơ & tài khoản (ADR 0003 Lát 3) ---

/** Trường học viên tự sửa ở M4, TRỪ số định danh/CCCD; ly_do bắt buộc (5–500 ký tự). */
export interface SuaHoSoHoTroDto {
  ho_ten?: string;
  ngay_sinh?: number;
  thang_sinh?: number;
  nam_sinh?: number;
  gioi_tinh?: string;
  chuc_vu?: string;
  doi_tuong?: string;
  don_vi_cong_tac_id?: string;
  so_dien_thoai_lien_he?: string;
  email_lien_he?: string;
  trinh_do_chuyen_mon?: string;
  cap_giang_day?: string;
  ly_do: string;
}

function useLamMoiChiTiet(hocVienId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: [...KHOA, 'hoc-vien', 'chi-tiet', hocVienId] });
    qc.invalidateQueries({ queryKey: [...KHOA, 'hoc-vien'] });
  };
}

export function useSuaHoSoHoTro(hocVienId: string) {
  const lamMoi = useLamMoiChiTiet(hocVienId);
  return useMutation({
    mutationFn: (dto: SuaHoSoHoTroDto) =>
      apiFetch<{ xac_nhan_bi_huy: boolean }>(`/ho-tro/hoc-vien/${hocVienId}`, {
        method: 'PATCH',
        body: JSON.stringify(dto),
      }),
    onSuccess: lamMoi,
  });
}

export function useGuiLinkDatLaiMatKhauHoTro(hocVienId: string) {
  return useMutation({
    mutationFn: () =>
      apiFetch<{ da_gui: true; email: string }>(`/ho-tro/hoc-vien/${hocVienId}/gui-link-dat-lai-mat-khau`, {
        method: 'POST',
      }),
  });
}

export function useCapMatKhauTamHocVienHoTro(hocVienId: string) {
  const lamMoi = useLamMoiChiTiet(hocVienId);
  return useMutation({
    mutationFn: () =>
      apiFetch<MatKhauTamResponse>(`/ho-tro/hoc-vien/${hocVienId}/cap-mat-khau-tam`, { method: 'POST' }),
    onSuccess: lamMoi,
    gcTime: 0,
  });
}

export function useMoKhoaTamHoTro(hocVienId: string) {
  const lamMoi = useLamMoiChiTiet(hocVienId);
  return useMutation({
    mutationFn: () =>
      apiFetch<{ ten_dang_nhap: string; dang_bi_khoa: false }>(`/ho-tro/hoc-vien/${hocVienId}/mo-khoa-tam`, {
        method: 'POST',
      }),
    onSuccess: lamMoi,
  });
}
