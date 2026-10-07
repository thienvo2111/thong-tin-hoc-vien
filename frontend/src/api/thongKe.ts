import { useQuery } from '@tanstack/react-query';
import { apiFetch, apiFetchBlob } from './client';
import { taiFileTuBlob } from '@/lib/taiFile';
import type {
  BoLocResult,
  CanDonDocResult,
  ChuyenCanResult,
  ChuyenMucResult,
  KetQuaHocCot,
  KhaoSatResult,
  PheuResult,
  SoSanhKhoaCot,
  XepHangResult,
} from './types';

// Dashboard thống kê (docs/superpowers/specs/2026-10-07-dashboard-thong-ke-design.md): mỗi khối một endpoint.

export type LocThongKe = { khoa_id?: string; don_vi_id?: string; cum_id?: string };
export type ChiSoXepHang = 'truy_cap' | 'khao_sat' | 'dat';
export type LoaiCanDonDoc = 'chua_truy_cap' | 'chua_khao_sat' | 'vang_nhieu' | 'vle_thap';

const STALE_TIME = 60_000;

function xayQuery(params: object): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

function useKhoi<T>(khoi: string, path: string, params: object, enabled = true) {
  return useQuery({
    queryKey: ['thong-ke', khoi, params],
    queryFn: () => apiFetch<T>(`/thong-ke/${path}${xayQuery(params)}`),
    staleTime: STALE_TIME,
    enabled,
  });
}

export const useBoLocThongKe = () => useKhoi<BoLocResult>('bo-loc', 'bo-loc', {});
export const usePheu = (loc: LocThongKe) => useKhoi<PheuResult>('pheu', 'pheu', loc);
export const useKhaoSat = (loc: LocThongKe) => useKhoi<KhaoSatResult>('khao-sat', 'khao-sat', loc);
export const useChuyenMuc = (loc: LocThongKe) => useKhoi<ChuyenMucResult>('chuyen-muc', 'chuyen-muc', loc);
export const useKetQuaHoc = (loc: LocThongKe) => useKhoi<KetQuaHocCot[]>('ket-qua', 'ket-qua', loc);
export const useSoSanhKhoa = (loc: LocThongKe, enabled = true) =>
  useKhoi<SoSanhKhoaCot[]>('so-sanh-khoa', 'so-sanh-khoa', loc, enabled);
export const useChuyenCan = (loc: LocThongKe) => useKhoi<ChuyenCanResult>('chuyen-can', 'chuyen-can', loc);
export const useXepHang = (loc: LocThongKe & { chi_so: ChiSoXepHang }, enabled = true) =>
  useKhoi<XepHangResult>('xep-hang', 'xep-hang', loc, enabled);
export const useCanDonDoc = (loc: LocThongKe & { loai: LoaiCanDonDoc; page: number }) =>
  useKhoi<CanDonDocResult>('can-don-doc', 'can-don-doc', loc);

export async function xuatCanDonDoc(loc: LocThongKe & { loai: LoaiCanDonDoc }): Promise<void> {
  const blob = await apiFetchBlob(`/thong-ke/can-don-doc/xuat-excel${xayQuery(loc)}`);
  taiFileTuBlob(blob, `can-don-doc-${loc.loai}.xlsx`);
}
