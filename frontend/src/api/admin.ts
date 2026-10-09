import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { BaoCaoTheo, HocVien, HocVienDanhSachItem, PaginatedResult, TongHopResult } from './types';

export interface DanhSachHocVienParams {
  trang_thai?: string;
  don_vi_cong_tac_id?: string;
  cap_giang_day?: string;
  nguon_tao?: string;
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

export function layDanhSachHocVien(params: DanhSachHocVienParams) {
  return apiFetch<PaginatedResult<HocVienDanhSachItem>>(`/hoc-vien${xayQueryString(params)}`);
}

export function danhSachHocVienKey(params: DanhSachHocVienParams) {
  return ['admin', 'hoc-vien', params] as const;
}

/** Danh sách học viên (quản trị) — phân trang server-side thật, xem PaginatedResult trong types.ts. */
export function useDanhSachHocVien(params: DanhSachHocVienParams) {
  return useQuery({
    queryKey: danhSachHocVienKey(params),
    queryFn: () => layDanhSachHocVien(params),
    placeholderData: keepPreviousData,
  });
}

export function layHocVienTheoId(id: string) {
  return apiFetch<HocVien>(`/hoc-vien/${id}`);
}

export function hocVienTheoIdKey(id: string) {
  return ['admin', 'hoc-vien', 'chi-tiet', id] as const;
}

export function useHocVienTheoId(id: string | undefined) {
  return useQuery({
    queryKey: hocVienTheoIdKey(id ?? ''),
    queryFn: () => layHocVienTheoId(id as string),
    enabled: !!id,
  });
}

// 2026-10-09 (spec khớp mã MOET Q-E): Quản trị sửa mã định danh MOET — chỉ quan_tri; 409 khi trùng
// học viên khác (kể cả khác số 0 đầu), mã mới là tên đăng nhập của TK khác, hoặc HV đã có kết quả khảo sát.
export interface SuaMaMoetDto {
  ma_dinh_danh_moet: string;
  ly_do: string;
}

export interface SuaMaMoetResult {
  id: string;
  ma_dinh_danh_moet: string;
  ten_dang_nhap: string | null;
  da_doi_ten_dang_nhap: boolean;
}

export function suaMaDinhDanhMoet(id: string, dto: SuaMaMoetDto) {
  return apiFetch<SuaMaMoetResult>(`/hoc-vien/${id}/ma-dinh-danh-moet`, {
    method: 'PATCH',
    body: JSON.stringify(dto),
  });
}

export function useSuaMaDinhDanhMoet(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: SuaMaMoetDto) => suaMaDinhDanhMoet(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hocVienTheoIdKey(id) });
    },
  });
}

export function layBaoCaoTongHop(theo: BaoCaoTheo) {
  return apiFetch<TongHopResult>(`/bao-cao/tong-hop?theo=${theo}`);
}

export function baoCaoTongHopKey(theo: BaoCaoTheo) {
  return ['admin', 'bao-cao', 'tong-hop', theo] as const;
}

export function useBaoCaoTongHop(theo: BaoCaoTheo) {
  return useQuery({ queryKey: baoCaoTongHopKey(theo), queryFn: () => layBaoCaoTongHop(theo) });
}
