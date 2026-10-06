import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { DiemHoc, PaginatedResult, TrangThaiActive } from './types';

// T10 (issue #2) — danh mục điểm học trực tiếp: GET/POST/PATCH /diem-hoc (không có DELETE — ngưng
// bằng PATCH trang_thai='ngung').
export interface DiemHocParams {
  q?: string;
  trang_thai?: TrangThaiActive;
  page?: number;
  page_size?: number;
}

export interface LuuDiemHocDto {
  ma_diem_hoc?: string;
  ten?: string;
  dia_chi?: string;
  dia_ban_id?: string;
  don_vi_id?: string | null;
  suc_chua?: number | null;
  so_phong?: number | null;
  nguoi_lien_he?: string | null;
  sdt_lien_he?: string | null;
  ghi_chu_csvc?: string | null;
  trang_thai?: TrangThaiActive;
}

const KEY = ['diem-hoc'] as const;

function queryString(params: DiemHocParams): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export function layDiemHoc(params: DiemHocParams) {
  return apiFetch<PaginatedResult<DiemHoc>>(`/diem-hoc${queryString(params)}`);
}

export function useDiemHoc(params: DiemHocParams) {
  return useQuery({
    queryKey: [...KEY, params],
    queryFn: () => layDiemHoc(params),
    placeholderData: keepPreviousData,
  });
}

/** Toàn bộ điểm học đang hoạt động (≤ 200) — cho ô chọn điểm học của buổi học. */
export function useDiemHocDangHoatDong() {
  return useDiemHoc({ trang_thai: 'active', page_size: 200 });
}

export function useTaoDiemHoc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: LuuDiemHocDto) =>
      apiFetch<DiemHoc>('/diem-hoc', { method: 'POST', body: JSON.stringify(dto) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useSuaDiemHoc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: LuuDiemHocDto }) =>
      apiFetch<DiemHoc>(`/diem-hoc/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
