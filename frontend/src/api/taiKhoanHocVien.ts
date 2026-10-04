import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type {
  DatLaiMatKhauHocVienResponse,
  NhatKyHocVien,
  PaginatedResult,
  TaiKhoanHocVien,
  TinhTrangTaiKhoanHocVien,
  TrangThaiActive,
} from './types';

// Tài khoản đăng nhập của học viên — /nguoi-dung/hoc-vien, chỉ quan_tri.

export interface DanhSachTaiKhoanHocVienParams {
  q?: string;
  trang_thai?: TrangThaiActive;
  tinh_trang?: TinhTrangTaiKhoanHocVien;
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

const KHOA = ['nguoi-dung', 'hoc-vien'] as const;
const khoaNhatKy = (hocVienId: string) => ['hoc-vien', hocVienId, 'nhat-ky'] as const;

export function useDanhSachTaiKhoanHocVien(params: DanhSachTaiKhoanHocVienParams) {
  return useQuery({
    queryKey: [...KHOA, 'danh-sach', params],
    queryFn: () => apiFetch<PaginatedResult<TaiKhoanHocVien>>(`/nguoi-dung/hoc-vien${xayQueryString(params)}`),
    placeholderData: keepPreviousData,
  });
}

export function useNhatKyHocVien(hocVienId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: khoaNhatKy(hocVienId ?? ''),
    queryFn: () => apiFetch<NhatKyHocVien>(`/hoc-vien/${hocVienId}/nhat-ky`),
    enabled: enabled && !!hocVienId,
  });
}

/** Làm mới danh sách + nhật ký của học viên vừa bị thao tác. */
function useLamMoi() {
  const qc = useQueryClient();
  return (hocVienId?: string | null) => {
    void qc.invalidateQueries({ queryKey: [...KHOA] });
    if (hocVienId) void qc.invalidateQueries({ queryKey: khoaNhatKy(hocVienId) });
  };
}

interface BienThaoTac {
  id: string;
  hocVienId?: string | null;
}

export function useDoiTrangThaiTaiKhoanHocVien() {
  const lamMoi = useLamMoi();
  return useMutation({
    mutationFn: ({ id, trang_thai }: BienThaoTac & { trang_thai: TrangThaiActive }) =>
      apiFetch<TaiKhoanHocVien>(`/nguoi-dung/hoc-vien/${id}`, { method: 'PATCH', body: JSON.stringify({ trang_thai }) }),
    onSuccess: (_kq, bien) => lamMoi(bien.hocVienId),
  });
}

export function useMoKhoaTamHocVien() {
  const lamMoi = useLamMoi();
  return useMutation({
    mutationFn: ({ id }: BienThaoTac) =>
      apiFetch<TaiKhoanHocVien>(`/nguoi-dung/hoc-vien/${id}/mo-khoa-tam`, { method: 'POST' }),
    onSuccess: (_kq, bien) => lamMoi(bien.hocVienId),
  });
}

export function useDatLaiMatKhauHocVien() {
  const lamMoi = useLamMoi();
  return useMutation({
    mutationFn: ({ id }: BienThaoTac) =>
      apiFetch<DatLaiMatKhauHocVienResponse>(`/nguoi-dung/${id}/dat-lai-mat-khau`, { method: 'POST' }),
    onSuccess: (_kq, bien) => lamMoi(bien.hocVienId),
    gcTime: 0,
  });
}
