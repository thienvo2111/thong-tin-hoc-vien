import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type {
  DanhGiaYeuCauHoTro,
  PaginatedResult,
  TrangThaiYeuCauHoTro,
  YeuCauHoTro,
  YeuCauHoTroQuanTri,
} from './types';

function xayQueryString(params: object): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

// M8 (2026-10-01): Yêu cầu hỗ trợ — ticket 1 câu hỏi/1 câu trả lời của hoc_vien.

// --- Phía học viên ---

export interface TaoYeuCauHoTroDto {
  loai_van_de_id: string;
  noi_dung_hoi: string;
}

export function taoYeuCauHoTro(dto: TaoYeuCauHoTroDto) {
  return apiFetch<YeuCauHoTro>('/yeu-cau-ho-tro/toi', { method: 'POST', body: JSON.stringify(dto) });
}

export const yeuCauHoTroCuaToiKey = ['yeu-cau-ho-tro', 'toi'] as const;

export function useTaoYeuCauHoTro() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: taoYeuCauHoTro,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: yeuCauHoTroCuaToiKey }),
  });
}

export function layDanhSachYeuCauHoTroCuaToi() {
  return apiFetch<YeuCauHoTro[]>('/yeu-cau-ho-tro/toi');
}

export function useDanhSachYeuCauHoTroCuaToi() {
  return useQuery({ queryKey: yeuCauHoTroCuaToiKey, queryFn: layDanhSachYeuCauHoTroCuaToi });
}

export function dongYeuCauHoTro(id: string) {
  return apiFetch<YeuCauHoTro>(`/yeu-cau-ho-tro/toi/${id}/dong`, { method: 'POST' });
}

export function useDongYeuCauHoTro() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: dongYeuCauHoTro,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: yeuCauHoTroCuaToiKey }),
  });
}

export function danhGiaYeuCauHoTro(id: string, danh_gia: DanhGiaYeuCauHoTro) {
  return apiFetch<YeuCauHoTro>(`/yeu-cau-ho-tro/toi/${id}/danh-gia`, {
    method: 'POST',
    body: JSON.stringify({ danh_gia }),
  });
}

export function useDanhGiaYeuCauHoTro() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, danh_gia }: { id: string; danh_gia: DanhGiaYeuCauHoTro }) =>
      danhGiaYeuCauHoTro(id, danh_gia),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: yeuCauHoTroCuaToiKey }),
  });
}

// --- Phía quan_tri ---

export interface DanhSachYeuCauHoTroQuanTriParams {
  trang_thai?: TrangThaiYeuCauHoTro;
  loai_van_de_id?: string;
  page?: number;
  page_size?: number;
}

export function layDanhSachYeuCauHoTroQuanTri(params: DanhSachYeuCauHoTroQuanTriParams) {
  return apiFetch<PaginatedResult<YeuCauHoTroQuanTri>>(`/yeu-cau-ho-tro${xayQueryString(params)}`);
}

export function danhSachYeuCauHoTroQuanTriKey(params: DanhSachYeuCauHoTroQuanTriParams) {
  return ['admin', 'yeu-cau-ho-tro', params] as const;
}

export function useDanhSachYeuCauHoTroQuanTri(params: DanhSachYeuCauHoTroQuanTriParams = {}) {
  return useQuery({
    queryKey: danhSachYeuCauHoTroQuanTriKey(params),
    queryFn: () => layDanhSachYeuCauHoTroQuanTri(params),
  });
}

export function traLoiYeuCauHoTro(id: string, noi_dung_tra_loi: string) {
  return apiFetch<YeuCauHoTro>(`/yeu-cau-ho-tro/${id}/tra-loi`, {
    method: 'PATCH',
    body: JSON.stringify({ noi_dung_tra_loi }),
  });
}

export function useTraLoiYeuCauHoTro() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, noi_dung_tra_loi }: { id: string; noi_dung_tra_loi: string }) =>
      traLoiYeuCauHoTro(id, noi_dung_tra_loi),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'yeu-cau-ho-tro'] }),
  });
}
