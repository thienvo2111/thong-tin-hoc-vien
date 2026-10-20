import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { MucNangLuc, NhuCauMucCuaToi } from './types';

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
