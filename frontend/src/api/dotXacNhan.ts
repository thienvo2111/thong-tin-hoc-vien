import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { DotXacNhanDanhMuc } from './types';

// Đợt xác nhận (quan_tri) — dot-xac-nhan.controller.ts. Tái dùng shape DotXacNhanDanhMuc (đã sửa khớp
// dot_xac_nhan.service.ts#layDanhSach thật: mảng thô, không bọc { data }) thay vì tự khai báo trùng.
export type DotXacNhan = DotXacNhanDanhMuc;
export type LoaiDotXacNhan = DotXacNhanDanhMuc['loai'];

export interface TaoDotXacNhanDto {
  khoa_id?: string;
  ten: string;
  loai: LoaiDotXacNhan;
  mo_luc: string;
  dong_luc: string;
}

function duongDanDanhSach(khoaId?: string): string {
  return khoaId ? `/dot-xac-nhan?khoa_id=${khoaId}` : '/dot-xac-nhan';
}

export function layDanhSachDot(khoaId?: string) {
  return apiFetch<DotXacNhan[]>(duongDanDanhSach(khoaId));
}

export function danhSachDotKey(khoaId?: string) {
  return ['admin', 'dot-xac-nhan', khoaId ?? ''] as const;
}

export function useDanhSachDot(khoaId?: string) {
  return useQuery({
    queryKey: danhSachDotKey(khoaId),
    queryFn: () => layDanhSachDot(khoaId),
  });
}

export function taoDot(dto: TaoDotXacNhanDto) {
  return apiFetch<DotXacNhan>('/dot-xac-nhan', { method: 'POST', body: JSON.stringify(dto) });
}

export function useTaoDot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: taoDot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'dot-xac-nhan'] });
    },
  });
}

// PATCH /dot-xac-nhan/{id} — CHỈ sửa được dong_luc (gia hạn), xem sua-dot-xac-nhan.dto.ts.
export function suaDot(id: string, dongLuc: string) {
  return apiFetch<DotXacNhan>(`/dot-xac-nhan/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ dong_luc: dongLuc }),
  });
}

export function useSuaDot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dongLuc }: { id: string; dongLuc: string }) => suaDot(id, dongLuc),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'dot-xac-nhan'] });
    },
  });
}
