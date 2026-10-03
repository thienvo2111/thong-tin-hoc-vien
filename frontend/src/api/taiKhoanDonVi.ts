import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type {
  DonViChuaCap,
  KetQuaTaoTaiKhoanDonVi,
  MatKhauTamResponse,
  PaginatedResult,
  SuaTaiKhoanDonViDto,
  TaiKhoanDonVi,
  TaoTaiKhoanDonViDto,
  TrangThaiActive,
  VaiTroDonVi,
} from './types';

// Tài khoản đơn vị (ADR 0002) — /nguoi-dung/don-vi, chỉ quan_tri. Mật khẩu tạm chỉ nằm trong kết quả
// mutation (gcTime: 0) và state cục bộ của modal — không cache, không lưu storage.

export interface DanhSachTaiKhoanParams {
  vai_tro?: VaiTroDonVi;
  trang_thai?: TrangThaiActive;
  da_dang_nhap?: boolean;
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

const KHOA = ['nguoi-dung', 'don-vi'] as const;

export function useDanhSachTaiKhoanDonVi(params: DanhSachTaiKhoanParams) {
  return useQuery({
    queryKey: [...KHOA, 'danh-sach', params],
    queryFn: () => apiFetch<PaginatedResult<TaiKhoanDonVi>>(`/nguoi-dung/don-vi${xayQueryString(params)}`),
    placeholderData: keepPreviousData,
  });
}

export function useDonViChuaCap(params: { loai_don_vi?: VaiTroDonVi; q?: string }, enabled = true) {
  return useQuery({
    queryKey: [...KHOA, 'chua-cap', params],
    queryFn: () => apiFetch<DonViChuaCap[]>(`/nguoi-dung/don-vi/chua-cap${xayQueryString(params)}`),
    enabled,
  });
}

function useLamMoi() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [...KHOA] });
}

export function useTaoTaiKhoanDonVi() {
  const lamMoi = useLamMoi();
  return useMutation({
    mutationFn: (dto: TaoTaiKhoanDonViDto) =>
      apiFetch<KetQuaTaoTaiKhoanDonVi>('/nguoi-dung/don-vi', { method: 'POST', body: JSON.stringify(dto) }),
    onSuccess: lamMoi,
    gcTime: 0,
  });
}

export function useSuaTaiKhoanDonVi() {
  const lamMoi = useLamMoi();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: SuaTaiKhoanDonViDto }) =>
      apiFetch<TaiKhoanDonVi>(`/nguoi-dung/don-vi/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
    onSuccess: lamMoi,
  });
}

export function useCapMatKhauTam() {
  const lamMoi = useLamMoi();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<MatKhauTamResponse>(`/nguoi-dung/don-vi/${id}/cap-mat-khau-tam`, { method: 'POST' }),
    onSuccess: lamMoi,
    gcTime: 0,
  });
}

export function useGuiEmailKichHoat() {
  const lamMoi = useLamMoi();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ da_gui: true }>(`/nguoi-dung/don-vi/${id}/gui-email-kich-hoat`, { method: 'POST' }),
    onSuccess: lamMoi,
  });
}
