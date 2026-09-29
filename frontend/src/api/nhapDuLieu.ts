import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiFetchBlob } from './client';
import type { ImportChiTiet, LoaiDanhMucImport, NhatKyImportItem, PaginatedResult, TaoImportResponse } from './types';

// Nhập dữ liệu (Phase 5 redesign) — luồng 2 bước thật của backend (docs/api-contract.md mục 5):
// POST /import/{loai} (upload + validate, xử lý bất đồng bộ) -> GET /import/{id} (xem preview lỗi/
// cảnh báo, poll khi còn "dang_xu_ly") -> POST /import/{id}/xac-nhan (nạp chính thức).

function xayQueryString(params: object): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export function taiMauExcel(loai: LoaiDanhMucImport) {
  return apiFetchBlob(`/import/mau-excel?loai=${loai}`);
}

function taiLenImport(loai: LoaiDanhMucImport, file: File) {
  const form = new FormData();
  form.append('file', file);
  return apiFetch<TaoImportResponse>(`/import/${loai}`, { method: 'POST', body: form });
}

export function useTaiLenImport() {
  return useMutation({
    mutationFn: ({ loai, file }: { loai: LoaiDanhMucImport; file: File }) => taiLenImport(loai, file),
  });
}

export function layImportChiTiet(id: string) {
  return apiFetch<ImportChiTiet>(`/import/${id}`);
}

export function importChiTietKey(id: string) {
  return ['admin', 'import', 'chi-tiet', id] as const;
}

/** Poll mỗi 2s trong lúc backend còn xử lý bất đồng bộ (trang_thai='dang_xu_ly'). */
export function useImportChiTiet(id: string | undefined) {
  return useQuery({
    queryKey: importChiTietKey(id ?? ''),
    queryFn: () => layImportChiTiet(id as string),
    enabled: !!id,
    refetchInterval: (query) => (query.state.data?.trang_thai === 'dang_xu_ly' ? 2000 : false),
  });
}

function xacNhanImport(id: string) {
  return apiFetch<ImportChiTiet>(`/import/${id}/xac-nhan`, { method: 'POST' });
}

export function useXacNhanImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => xacNhanImport(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: importChiTietKey(id) });
      queryClient.invalidateQueries({ queryKey: ['admin', 'import', 'lich-su'] });
    },
  });
}

export function taiFileLoiImport(id: string) {
  return apiFetchBlob(`/import/${id}/file-loi`);
}

export interface LichSuImportParams {
  loai?: LoaiDanhMucImport | '';
  tu_ngay?: string;
  den_ngay?: string;
}

export function layLichSuImport(params: LichSuImportParams = {}) {
  return apiFetch<PaginatedResult<NhatKyImportItem>>(`/import${xayQueryString(params)}`);
}

export function useLichSuImport(params: LichSuImportParams = {}) {
  return useQuery({
    queryKey: ['admin', 'import', 'lich-su', params],
    queryFn: () => layLichSuImport(params),
  });
}
