import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { DiaDanh, DonViCongTac, MonHoc, PaginatedResult } from './types';

export function layDiaDanh(params: { cap: string; parent_id?: string; q?: string; trang_thai?: string; phien_ban?: string }) {
  const qs = new URLSearchParams();
  qs.set('cap', params.cap);
  if (params.parent_id) qs.set('parent_id', params.parent_id);
  if (params.q) qs.set('q', params.q);
  qs.set('trang_thai', params.trang_thai ?? 'active');
  if (params.phien_ban) qs.set('phien_ban', params.phien_ban);
  return apiFetch<{ data: DiaDanh[] }>(`/danh-muc/dia-danh?${qs.toString()}`);
}

export function layDonViCongTac(params: { q?: string; loai_don_vi?: string; dia_ban_id?: string }) {
  const qs = new URLSearchParams();
  qs.set('loai_don_vi', params.loai_don_vi ?? 'truong');
  if (params.q) qs.set('q', params.q);
  if (params.dia_ban_id) qs.set('dia_ban_id', params.dia_ban_id);
  return apiFetch<{ data: DonViCongTac[] }>(`/danh-muc/don-vi-cong-tac?${qs.toString()}`);
}

export interface DonViCongTacPhanTrangParams {
  loai_don_vi?: string;
  dia_ban_id?: string;
  tinh_id?: string;
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

// Thêm 2026-10-01 — trang quản trị "Danh mục trường" (sửa tay dia_ban_id sau khi remap T19): phân
// trang server-side thật qua GET /danh-muc/don-vi-cong-tac (đã có page/page_size từ PaginationQueryDto),
// khác layDonViCongTac() ở trên (dùng cho autocomplete, không phân trang, luôn trả thẳng { data }).
export function layDonViCongTacPhanTrang(params: DonViCongTacPhanTrangParams) {
  return apiFetch<PaginatedResult<DonViCongTac>>(`/danh-muc/don-vi-cong-tac${xayQueryString(params)}`);
}

// PATCH /danh-muc/don-vi-cong-tac/{id} — sửa tay dia_ban_id (quan_tri), UpdateDonViCongTacDto đã nhận
// sẵn field này, không cần sửa backend thêm cho thao tác này (chỉ sửa 1 field, không đụng field khác).
export function suaDiaBanDonViCongTac(id: string, diaBanId: string) {
  return apiFetch<DonViCongTac>(`/danh-muc/don-vi-cong-tac/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ dia_ban_id: diaBanId }),
  });
}

export function useSuaDiaBanDonViCongTac() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, diaBanId }: { id: string; diaBanId: string }) => suaDiaBanDonViCongTac(id, diaBanId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['danh-muc', 'don-vi-cong-tac'] });
    },
  });
}

export function layMonHoc(cap_hoc: string) {
  const qs = new URLSearchParams({ cap_hoc });
  return apiFetch<{ data: MonHoc[] }>(`/danh-muc/mon-hoc?${qs.toString()}`);
}

export function goiYChuyenMon(q: string) {
  const qs = new URLSearchParams({ q });
  return apiFetch<{ data: string[] }>(`/danh-muc/chuyen-mon-dao-tao/goi-y?${qs.toString()}`);
}
