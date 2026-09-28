import { apiFetch } from './client';
import type { DiaDanh, DonViCongTac, MonHoc } from './types';

export function layDiaDanh(params: { cap: string; parent_id?: string; q?: string; trang_thai?: string }) {
  const qs = new URLSearchParams();
  qs.set('cap', params.cap);
  if (params.parent_id) qs.set('parent_id', params.parent_id);
  if (params.q) qs.set('q', params.q);
  qs.set('trang_thai', params.trang_thai ?? 'active');
  return apiFetch<{ data: DiaDanh[] }>(`/danh-muc/dia-danh?${qs.toString()}`);
}

export function layDonViCongTac(params: { q?: string; loai_don_vi?: string }) {
  const qs = new URLSearchParams();
  qs.set('loai_don_vi', params.loai_don_vi ?? 'truong');
  if (params.q) qs.set('q', params.q);
  return apiFetch<{ data: DonViCongTac[] }>(`/danh-muc/don-vi-cong-tac?${qs.toString()}`);
}

export function layMonHoc(cap_hoc: string) {
  const qs = new URLSearchParams({ cap_hoc });
  return apiFetch<{ data: MonHoc[] }>(`/danh-muc/mon-hoc?${qs.toString()}`);
}

export function goiYChuyenMon(q: string) {
  const qs = new URLSearchParams({ q });
  return apiFetch<{ data: string[] }>(`/danh-muc/chuyen-mon-dao-tao/goi-y?${qs.toString()}`);
}
