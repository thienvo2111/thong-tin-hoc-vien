import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { LoaiLop } from './types';

// ADR 0004 G13/G14 (issue #18): báo vắng + đề nghị đổi lớp.
// Người hỗ trợ học viên tạo (cụm mình); nhóm hỗ trợ giảng viên duyệt/từ chối.

export type TrangThaiDeNghi = 'cho_duyet' | 'da_duyet' | 'tu_choi' | 'da_huy';

export const NHAN_TRANG_THAI_DE_NGHI: Record<TrangThaiDeNghi, string> = {
  cho_duyet: 'Chờ duyệt',
  da_duyet: 'Đã duyệt',
  tu_choi: 'Từ chối',
  da_huy: 'Đã hủy',
};

export const MAU_TRANG_THAI_DE_NGHI: Record<TrangThaiDeNghi, string> = {
  cho_duyet: 'yellow',
  da_duyet: 'green',
  tu_choi: 'red',
  da_huy: 'gray',
};

export interface BaoVangHocVien {
  lich_hoc_id: string;
  ly_do: string;
  ghi_luc: string;
  nguoi_ghi: string | null;
}

export interface DeNghiDoiLopHocVien {
  id: string;
  giai_doan_id: string;
  ly_do: string;
  trang_thai: TrangThaiDeNghi;
  tao_luc: string;
  xu_ly_luc: string | null;
  ghi_chu_xu_ly: string | null;
  nguoi_tao: string | null;
  lop_hien_tai: { id: string; ten_lop: string } | null;
  lop_de_nghi: { id: string; ten_lop: string };
  nguoi_tao_ten: string | null;
  nguoi_xu_ly: string | null;
}

export interface LopCoTheDoi {
  lop_hien_tai_id: string | null;
  lop: { id: string; ten_lop: string; loai_lop: LoaiLop; si_so_toi_da: number | null; si_so: number }[];
}

export interface DeNghiDoiLopGv {
  id: string;
  giai_doan_id: string;
  ly_do: string;
  trang_thai: TrangThaiDeNghi;
  tao_luc: string;
  xu_ly_luc: string | null;
  ghi_chu_xu_ly: string | null;
  hoc_vien: { id: string; ho_ten: string; don_vi: string; cum: string | null };
  giai_doan: { thu_tu: number; ten_giai_doan: string };
  lop_hien_tai: { id: string; ten_lop: string } | null;
  lop_de_nghi: { id: string; ten_lop: string; si_so_toi_da: number | null; khoa: { ma_khoa: string } };
  si_so_lop_de_nghi: number;
  nguoi_tao: string | null;
  nguoi_xu_ly: string | null;
}

// ---------------- Người hỗ trợ học viên ----------------
function useLamMoiHoTro() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['ho-tro'] });
}

export function useBaoVang(hocVienId: string) {
  const lamMoi = useLamMoiHoTro();
  return useMutation({
    mutationFn: (dto: { lich_hoc_id: string; ly_do: string }) =>
      apiFetch(`/ho-tro-hoc-vien/hoc-vien/${hocVienId}/bao-vang`, { method: 'POST', body: JSON.stringify(dto) }),
    onSuccess: lamMoi,
  });
}

export function useHuyBaoVang(hocVienId: string) {
  const lamMoi = useLamMoiHoTro();
  return useMutation({
    mutationFn: (lichHocId: string) =>
      apiFetch<void>(`/ho-tro-hoc-vien/hoc-vien/${hocVienId}/bao-vang/${lichHocId}`, { method: 'DELETE' }),
    onSuccess: lamMoi,
  });
}

export function useLopCoTheDoi(hocVienId: string, gdId: string | null) {
  return useQuery({
    queryKey: ['ho-tro', 'lop-co-the-doi', hocVienId, gdId],
    queryFn: () =>
      apiFetch<LopCoTheDoi>(`/ho-tro-hoc-vien/hoc-vien/${hocVienId}/lop-co-the-doi?giai_doan_id=${gdId}`),
    enabled: !!gdId,
  });
}

export function useTaoDeNghiDoiLop(hocVienId: string) {
  const lamMoi = useLamMoiHoTro();
  return useMutation({
    mutationFn: (dto: { giai_doan_id: string; lop_de_nghi_id: string; ly_do: string }) =>
      apiFetch(`/ho-tro-hoc-vien/hoc-vien/${hocVienId}/de-nghi-doi-lop`, { method: 'POST', body: JSON.stringify(dto) }),
    onSuccess: lamMoi,
  });
}

export function useHuyDeNghiDoiLop() {
  const lamMoi = useLamMoiHoTro();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/ho-tro-hoc-vien/de-nghi-doi-lop/${id}/huy`, { method: 'POST' }),
    onSettled: lamMoi,
  });
}

// ---------------- Nhóm hỗ trợ giảng viên ----------------
export function useDeNghiDoiLopGv(trangThai: TrangThaiDeNghi | null) {
  return useQuery({
    queryKey: ['ho-tro-gv', 'de-nghi-doi-lop', trangThai],
    queryFn: () =>
      apiFetch<DeNghiDoiLopGv[]>(`/ho-tro-giang-vien/de-nghi-doi-lop${trangThai ? `?trang_thai=${trangThai}` : ''}`),
  });
}

function useLamMoiGv() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['ho-tro-gv'] });
}

export function useDuyetDeNghi() {
  const lamMoi = useLamMoiGv();
  return useMutation({
    mutationFn: ({ id, ghi_chu }: { id: string; ghi_chu?: string }) =>
      apiFetch<{ trang_thai: 'da_duyet'; canh_bao: string[] }>(`/ho-tro-giang-vien/de-nghi-doi-lop/${id}/duyet`, {
        method: 'POST',
        body: JSON.stringify({ ghi_chu }),
      }),
    onSettled: lamMoi,
  });
}

export function useTuChoiDeNghi() {
  const lamMoi = useLamMoiGv();
  return useMutation({
    mutationFn: ({ id, ghi_chu }: { id: string; ghi_chu: string }) =>
      apiFetch(`/ho-tro-giang-vien/de-nghi-doi-lop/${id}/tu-choi`, { method: 'POST', body: JSON.stringify({ ghi_chu }) }),
    onSettled: lamMoi,
  });
}
