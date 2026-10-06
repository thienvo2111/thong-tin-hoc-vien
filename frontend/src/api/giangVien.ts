import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import { chiTietKhoaKey } from './khoaBoiDuong';
import type { GiangVien, LichDayGiangVien, PaginatedResult, PhanCongBuoi, TrangThaiActive, VaiTroNhanSuLop } from './types';

// T11 (issue #3) — danh mục giảng viên + phân công (chỉ Quản trị). Không có DELETE: ngưng = PATCH trang_thai.
export interface GiangVienParams {
  q?: string;
  trang_thai?: TrangThaiActive;
  khoa_id?: string;
  page?: number;
  page_size?: number;
}

export interface LuuGiangVienDto {
  ho_ten?: string;
  so_dien_thoai?: string;
  email?: string | null;
  don_vi_cong_tac?: string | null;
  ghi_chu?: string | null;
  trang_thai?: TrangThaiActive;
}

export interface MucPhanCongDto {
  giang_vien_id: string;
  vai_tro: VaiTroNhanSuLop;
  so_gio?: number;
}

const KEY = ['giang-vien'] as const;

function queryString(params: object): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export function useGiangVien(params: GiangVienParams, enabled = true) {
  return useQuery({
    queryKey: [...KEY, params],
    queryFn: () => apiFetch<PaginatedResult<GiangVien>>(`/giang-vien${queryString(params)}`),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useLichDayGiangVien(id: string | null) {
  return useQuery({
    queryKey: [...KEY, 'lich-day', id],
    queryFn: () => apiFetch<LichDayGiangVien>(`/giang-vien/${id}/lich-day`),
    enabled: !!id,
  });
}

export function useTaoGiangVien() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: LuuGiangVienDto) => apiFetch<GiangVien>('/giang-vien', { method: 'POST', body: JSON.stringify(dto) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useSuaGiangVien() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: LuuGiangVienDto }) =>
      apiFetch<GiangVien>(`/giang-vien/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useXacNhanGio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ phanCongId, da_xac_nhan_gio, so_gio }: { phanCongId: string; da_xac_nhan_gio: boolean; so_gio?: number }) =>
      apiFetch(`/giang-vien/phan-cong/${phanCongId}/xac-nhan-gio`, {
        method: 'PATCH',
        body: JSON.stringify({ da_xac_nhan_gio, so_gio }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

/** PUT thay toàn bộ phân công 1 buổi; invalidate chi tiết khóa đang xem. */
export function usePhanCongBuoi(khoaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ lopId, lichHocId, phan_cong }: { lopId: string; lichHocId: string; phan_cong: MucPhanCongDto[] }) =>
      apiFetch<PhanCongBuoi[]>(`/lop/${lopId}/lich-hoc/${lichHocId}/giang-vien`, {
        method: 'PUT',
        body: JSON.stringify({ phan_cong }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chiTietKhoaKey(khoaId) });
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}
