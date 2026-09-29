import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import { layDonViCongTac } from './danhMuc';
import type {
  KhoaBoiDuong,
  KhoaBoiDuongChiTiet,
  PaginatedResult,
  TaoKhoaBoiDuongDto,
  TrangThaiKhoa,
} from './types';

// don_vi_to_chuc_id của khóa có thể là đơn vị loại 'truong' hoặc 'khac' (T2, QĐ2 — vd. HCMUE không
// thuộc cây đơn vị An Giang). layDonViCongTac() mặc định chỉ lọc loai_don_vi='truong' (dùng cho màn
// học viên) nên ở đây gộp cả 2 loại để map id->tên không bị thiếu đơn vị 'khac'.
export function useDonViChoKhoa() {
  return useQuery({
    queryKey: ['danh-muc', 'don-vi-cong-tac', 'khoa-boi-duong'],
    queryFn: async () => {
      const [truong, khac] = await Promise.all([
        layDonViCongTac({ loai_don_vi: 'truong' }),
        layDonViCongTac({ loai_don_vi: 'khac' }),
      ]);
      return [...truong.data, ...khac.data];
    },
  });
}

export interface DanhSachKhoaParams {
  trang_thai?: TrangThaiKhoa | '';
  don_vi_to_chuc_id?: string;
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

export function layDanhSachKhoa(params: DanhSachKhoaParams) {
  return apiFetch<PaginatedResult<KhoaBoiDuong>>(`/khoa-boi-duong${xayQueryString(params)}`);
}

export function danhSachKhoaKey(params: DanhSachKhoaParams) {
  return ['admin', 'khoa-boi-duong', params] as const;
}

export function useDanhSachKhoa(params: DanhSachKhoaParams) {
  return useQuery({
    queryKey: danhSachKhoaKey(params),
    queryFn: () => layDanhSachKhoa(params),
    placeholderData: keepPreviousData,
  });
}

export function layChiTietKhoa(id: string) {
  return apiFetch<KhoaBoiDuongChiTiet>(`/khoa-boi-duong/${id}`);
}

export function chiTietKhoaKey(id: string) {
  return ['admin', 'khoa-boi-duong', 'chi-tiet', id] as const;
}

export function useChiTietKhoa(id: string | undefined) {
  return useQuery({
    queryKey: chiTietKhoaKey(id ?? ''),
    queryFn: () => layChiTietKhoa(id as string),
    enabled: !!id,
  });
}

export function taoKhoa(dto: TaoKhoaBoiDuongDto) {
  return apiFetch<KhoaBoiDuong>('/khoa-boi-duong', { method: 'POST', body: JSON.stringify(dto) });
}

export function useTaoKhoa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: taoKhoa,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'khoa-boi-duong'] });
    },
  });
}

export function nopDuyetKhoa(id: string) {
  return apiFetch<KhoaBoiDuong>(`/khoa-boi-duong/${id}/nop-duyet`, { method: 'POST' });
}

export function useNopDuyetKhoa(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => nopDuyetKhoa(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chiTietKhoaKey(id) });
      queryClient.invalidateQueries({ queryKey: ['admin', 'khoa-boi-duong'] });
    },
  });
}

export interface DuyetKhoaDto {
  ket_qua: 'da_duyet' | 'tu_choi';
  ly_do?: string;
}

export function duyetKhoa(id: string, dto: DuyetKhoaDto) {
  return apiFetch<KhoaBoiDuong>(`/khoa-boi-duong/${id}/duyet`, { method: 'POST', body: JSON.stringify(dto) });
}

export function useDuyetKhoa(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: DuyetKhoaDto) => duyetKhoa(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chiTietKhoaKey(id) });
      queryClient.invalidateQueries({ queryKey: ['admin', 'khoa-boi-duong'] });
    },
  });
}
