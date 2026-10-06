import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { LoaiLop, TrangThaiActive } from './types';

// ADR 0004 G5b (issue #17) — bảng kiểm chuẩn bị đợt trực tiếp, động theo khóa.
export type LoaiMucKiemTra = 'tu_dong' | 'thu_cong';
export type TrangThaiMuc = 'dat' | 'chua_dat' | 'qua_han';
export type MauDot = 'xanh' | 'vang' | 'do';

export interface MucKiemTra {
  id: string;
  khoa_id: string | null;
  thu_tu: number;
  ten: string;
  mo_ta: string | null;
  loai: LoaiMucKiemTra;
  ma_quy_tac: string | null;
  han_truoc_ngay: number | null;
  trang_thai: TrangThaiActive;
}

export interface BoBangKiem {
  nguon: 'mac_dinh' | 'rieng';
  muc: MucKiemTra[];
}

export interface LuuMucDto {
  ten?: string;
  loai?: LoaiMucKiemTra;
  ma_quy_tac?: string | null;
  han_truoc_ngay?: number | null;
  thu_tu?: number;
  trang_thai?: TrangThaiActive;
}

export interface MucDanhGia {
  muc_id: string;
  ten: string;
  loai: LoaiMucKiemTra;
  ma_quy_tac: string | null;
  han: string | null;
  trang_thai: TrangThaiMuc;
  ly_do: string | null;
  ghi_chu: string | null;
  cap_nhat_boi: string | null;
  cap_nhat_luc: string | null;
}

export interface DanhGiaDot {
  lop: { id: string; ten_lop: string; loai_lop: LoaiLop; khoa: { id: string; ma_khoa: string; ten_khoa: string } };
  giai_doan: { id: string; thu_tu: number; ten_giai_doan: string };
  buoi_dau: string | null;
  nguon: 'mac_dinh' | 'rieng';
  mau: MauDot;
  muc: MucDanhGia[];
}

export interface ViecCanLam {
  lop: DanhGiaDot['lop'];
  giai_doan: DanhGiaDot['giai_doan'];
  buoi_dau: string | null;
  mau: MauDot;
  so_qua_han: number;
  so_chua_dat: number;
  muc_chua_dat: { ten: string; trang_thai: TrangThaiMuc; han: string | null }[];
  // ADR 0004 G11 (issue #21): giảng viên chưa nhắc / cần nhắc lại.
  nhac_gv?: { id: string; ho_ten: string; trang_thai: import('./nhacLich').TrangThaiNhac }[];
}

const KEY = ['bang-kiem'] as const;

// --- Quản trị ---
export function useQuyTac() {
  return useQuery({
    queryKey: [...KEY, 'quy-tac'],
    queryFn: () => apiFetch<{ ma: string; ten: string }[]>('/bang-kiem/quy-tac'),
    staleTime: Infinity,
  });
}

/** khoaId null = bộ mặc định hệ thống. */
export function useBoBangKiem(khoaId: string | null) {
  return useQuery({
    queryKey: [...KEY, 'bo', khoaId],
    queryFn: () => apiFetch<BoBangKiem>(khoaId ? `/bang-kiem/khoa/${khoaId}` : '/bang-kiem/mac-dinh'),
  });
}

function useLamMoi() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: KEY });
}

export function useTuyChinhBangKiem(khoaId: string) {
  const lamMoi = useLamMoi();
  return useMutation({
    mutationFn: () => apiFetch<BoBangKiem>(`/bang-kiem/khoa/${khoaId}/tuy-chinh`, { method: 'POST' }),
    onSuccess: lamMoi,
  });
}

export function useThemMuc(khoaId: string | null) {
  const lamMoi = useLamMoi();
  return useMutation({
    mutationFn: (dto: LuuMucDto) =>
      apiFetch<MucKiemTra>(khoaId ? `/bang-kiem/khoa/${khoaId}/muc` : '/bang-kiem/mac-dinh/muc', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
    onSuccess: lamMoi,
  });
}

export function useSuaMuc() {
  const lamMoi = useLamMoi();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: LuuMucDto }) =>
      apiFetch<MucKiemTra>(`/bang-kiem/muc/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
    onSuccess: lamMoi,
  });
}

// --- Người hỗ trợ giảng viên ---
export function useBangKiemDot(lopId: string, gdId: string) {
  return useQuery({
    queryKey: ['ho-tro-gv', 'bang-kiem', lopId, gdId],
    queryFn: () => apiFetch<DanhGiaDot>(`/ho-tro-giang-vien/lop/${lopId}/giai-doan/${gdId}/bang-kiem`),
  });
}

export function useDanhDauMuc(lopId: string, gdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ mucId, da_xong, ghi_chu }: { mucId: string; da_xong: boolean; ghi_chu?: string | null }) =>
      apiFetch(`/ho-tro-giang-vien/lop/${lopId}/giai-doan/${gdId}/bang-kiem/${mucId}`, {
        method: 'PUT',
        body: JSON.stringify({ da_xong, ghi_chu }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ho-tro-gv'] }),
  });
}

export function useViecCanLam() {
  return useQuery({
    queryKey: ['ho-tro-gv', 'viec-can-lam'],
    queryFn: () => apiFetch<ViecCanLam[]>('/ho-tro-giang-vien/viec-can-lam'),
  });
}

export function useDemViecCanLam() {
  return useQuery({
    queryKey: ['ho-tro-gv', 'viec-can-lam', 'dem'],
    queryFn: () => apiFetch<{ do: number; de_nghi?: number }>('/ho-tro-giang-vien/viec-can-lam/dem'),
  });
}
