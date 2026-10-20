import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { DotNhuCauMuc, DotNhuCauMucDto, MucNangLuc, NhuCauMucCuaToi } from './types';

// ADR 0013 — học viên xem/chọn nhu cầu mức học theo đợt.
export function layNhuCauMucToi() {
  return apiFetch<NhuCauMucCuaToi[]>('/hoc-vien/toi/nhu-cau-muc');
}

export const nhuCauMucToiKey = ['hoc-vien', 'toi', 'nhu-cau-muc'] as const;
export function useNhuCauMucToi(enabled = true) {
  return useQuery({ queryKey: nhuCauMucToiKey, queryFn: layNhuCauMucToi, enabled });
}

export function layNhuCauMucDot(dotId: string) {
  return apiFetch<NhuCauMucCuaToi>(`/hoc-vien/toi/nhu-cau-muc/${dotId}`);
}

export function useNhuCauMucDot(dotId: string | null) {
  return useQuery({
    queryKey: [...nhuCauMucToiKey, dotId],
    queryFn: () => layNhuCauMucDot(dotId as string),
    enabled: !!dotId,
    retry: false,
  });
}

export function chonNhuCauMuc(dotId: string, muc: MucNangLuc) {
  return apiFetch<NhuCauMucCuaToi>(`/hoc-vien/toi/nhu-cau-muc/${dotId}`, {
    method: 'PUT',
    body: JSON.stringify({ muc }),
  });
}

export function useChonNhuCauMuc(dotId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (muc: MucNangLuc) => chonNhuCauMuc(dotId, muc),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: nhuCauMucToiKey }),
  });
}

// --- Quản trị: quản lý đợt trong chi tiết khóa (ADR 0013 D7/D9) ---
export const dotNhuCauMucKey = (khoaId: string) => ['admin', 'dot-nhu-cau-muc', khoaId] as const;

export function useDotNhuCauMuc(khoaId: string) {
  return useQuery({
    queryKey: dotNhuCauMucKey(khoaId),
    queryFn: () => apiFetch<DotNhuCauMuc[]>(`/khoa-boi-duong/${khoaId}/dot-nhu-cau-muc`),
  });
}

export function useTaoDotNhuCauMuc(khoaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: DotNhuCauMucDto) =>
      apiFetch<DotNhuCauMuc>(`/khoa-boi-duong/${khoaId}/dot-nhu-cau-muc`, {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dotNhuCauMucKey(khoaId) }),
  });
}

export function useSuaDotNhuCauMuc(khoaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: { id: string } & Partial<DotNhuCauMucDto>) =>
      apiFetch<DotNhuCauMuc>(`/dot-nhu-cau-muc/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dotNhuCauMucKey(khoaId) }),
  });
}

export function useDongDotNhuCauMuc(khoaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<DotNhuCauMuc>(`/dot-nhu-cau-muc/${id}/dong`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dotNhuCauMucKey(khoaId) }),
  });
}

export function useXoaDotNhuCauMuc(khoaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/dot-nhu-cau-muc/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dotNhuCauMucKey(khoaId) }),
  });
}
