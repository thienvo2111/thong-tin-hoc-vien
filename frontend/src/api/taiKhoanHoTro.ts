import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type {
  KetQuaTaoTaiKhoanHoTro,
  MatKhauTamResponse,
  PaginatedResult,
  SuaTaiKhoanHoTroDto,
  TaiKhoanHoTro,
  TaoTaiKhoanHoTroDto,
  TrangThaiActive,
} from './types';

// Người hỗ trợ học viên (ADR 0003) — /nguoi-dung/ho-tro, chỉ quan_tri. Mật khẩu tạm chỉ nằm trong kết
// quả mutation (gcTime: 0) và state cục bộ của modal, như tài khoản đơn vị.

export interface DanhSachTaiKhoanHoTroParams {
  trang_thai?: TrangThaiActive;
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

export const KHOA_TAI_KHOAN_HO_TRO = ['nguoi-dung', 'ho-tro'] as const;

export function useDanhSachTaiKhoanHoTro(params: DanhSachTaiKhoanHoTroParams, enabled = true) {
  return useQuery({
    queryKey: [...KHOA_TAI_KHOAN_HO_TRO, 'danh-sach', params],
    queryFn: () => apiFetch<PaginatedResult<TaiKhoanHoTro>>(`/nguoi-dung/ho-tro${xayQueryString(params)}`),
    placeholderData: keepPreviousData,
    enabled,
  });
}

function useLamMoi() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [...KHOA_TAI_KHOAN_HO_TRO] });
}

export function useTaoTaiKhoanHoTro() {
  const lamMoi = useLamMoi();
  return useMutation({
    mutationFn: (dto: TaoTaiKhoanHoTroDto) =>
      apiFetch<KetQuaTaoTaiKhoanHoTro>('/nguoi-dung/ho-tro', { method: 'POST', body: JSON.stringify(dto) }),
    onSuccess: lamMoi,
    gcTime: 0,
  });
}

export function useSuaTaiKhoanHoTro() {
  const lamMoi = useLamMoi();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: SuaTaiKhoanHoTroDto }) =>
      apiFetch<TaiKhoanHoTro>(`/nguoi-dung/ho-tro/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
    onSuccess: lamMoi,
  });
}

export function useCapMatKhauTamHoTro() {
  const lamMoi = useLamMoi();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<MatKhauTamResponse>(`/nguoi-dung/ho-tro/${id}/cap-mat-khau-tam`, { method: 'POST' }),
    onSuccess: lamMoi,
    gcTime: 0,
  });
}

export function useGuiEmailKichHoatHoTro() {
  const lamMoi = useLamMoi();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ da_gui: true }>(`/nguoi-dung/ho-tro/${id}/gui-email-kich-hoat`, { method: 'POST' }),
    onSuccess: lamMoi,
  });
}
