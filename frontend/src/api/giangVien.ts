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

// ADR 0004 G12: người hỗ trợ giảng viên dùng cùng màn danh mục qua
// /ho-tro-giang-vien/giang-vien (tạo/sửa, không ngưng, không xác nhận giờ).
export const GIANG_VIEN_QUAN_TRI = '/giang-vien';
export const GIANG_VIEN_HO_TRO_GV = '/ho-tro-giang-vien/giang-vien';

function queryString(params: object): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export function useGiangVien(params: GiangVienParams, enabled = true, base = GIANG_VIEN_QUAN_TRI) {
  return useQuery({
    queryKey: [...KEY, base, params],
    queryFn: () => apiFetch<PaginatedResult<GiangVien>>(`${base}${queryString(params)}`),
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

export function useTaoGiangVien(base = GIANG_VIEN_QUAN_TRI) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: LuuGiangVienDto) => apiFetch<GiangVien>(base, { method: 'POST', body: JSON.stringify(dto) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useSuaGiangVien(base = GIANG_VIEN_QUAN_TRI) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: LuuGiangVienDto }) =>
      apiFetch<GiangVien>(`${base}/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
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

/** PUT thay toàn bộ phân công 1 buổi. khu='quan_tri': /lop/... + làm mới chi tiết khóa; khu='ho_tro_gv':
 * /ho-tro-giang-vien/lich-hoc/... + làm mới trang lớp của người hỗ trợ GV. */
export function usePhanCongBuoi(khoaId: string, khu: 'quan_tri' | 'ho_tro_gv' = 'quan_tri') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ lopId, lichHocId, phan_cong }: { lopId: string; lichHocId: string; phan_cong: MucPhanCongDto[] }) =>
      apiFetch<PhanCongBuoi[]>(
        khu === 'quan_tri' ? `/lop/${lopId}/lich-hoc/${lichHocId}/giang-vien` : `/ho-tro-giang-vien/lich-hoc/${lichHocId}/giang-vien`,
        { method: 'PUT', body: JSON.stringify({ phan_cong }) },
      ),
    onSuccess: () => {
      if (khu === 'quan_tri') queryClient.invalidateQueries({ queryKey: chiTietKhoaKey(khoaId) });
      else queryClient.invalidateQueries({ queryKey: ['ho-tro-gv'] });
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}
