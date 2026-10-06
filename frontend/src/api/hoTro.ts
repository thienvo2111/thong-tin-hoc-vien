import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiFetch, apiFetchBlob } from './client';
import type { BuoiHocHoTro, CumCuaToi, HocVienHoTroChiTiet, HocVienHoTroDong, PaginatedResult } from './types';

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
