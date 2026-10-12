import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiFetchBlob } from './client';
import { taiFileTuBlob } from '@/lib/taiFile';
import type { BaoCaoTheo, HocVien, HocVienDanhSachItem, PaginatedResult, TongHopResult } from './types';

export interface DanhSachHocVienParams {
  trang_thai?: string;
  don_vi_cong_tac_id?: string;
  cap_giang_day?: string;
  nguon_tao?: string;
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

export function layDanhSachHocVien(params: DanhSachHocVienParams) {
  return apiFetch<PaginatedResult<HocVienDanhSachItem>>(`/hoc-vien${xayQueryString(params)}`);
}

export function danhSachHocVienKey(params: DanhSachHocVienParams) {
  return ['admin', 'hoc-vien', params] as const;
}

/** Danh sách học viên (quản trị) — phân trang server-side thật, xem PaginatedResult trong types.ts. */
export function useDanhSachHocVien(params: DanhSachHocVienParams) {
  return useQuery({
    queryKey: danhSachHocVienKey(params),
    queryFn: () => layDanhSachHocVien(params),
    placeholderData: keepPreviousData,
  });
}

/** GET /hoc-vien/xuat-excel — danh sách học viên 1 trường (có PII) để trường đối chiếu. */
export async function xuatHocVienTheoTruong(donViId: string): Promise<void> {
  const blob = await apiFetchBlob(`/hoc-vien/xuat-excel?don_vi_cong_tac_id=${encodeURIComponent(donViId)}`);
  taiFileTuBlob(blob, 'ds-hoc-vien-truong.xlsx');
}

// POST /hoc-vien/tao-le (chỉ quan_tri) — tạo lẻ 1 học viên, cùng quy tắc import MOET: cần ít nhất 1 trong
// mã MOET/CCCD, tên đăng nhập = mã MOET ?? CCCD, mật khẩu ban đầu = ngày sinh ddmmyyyy (không trả về).
export interface TaoHocVienLeDto {
  ma_dinh_danh_moet?: string;
  so_dinh_danh_ca_nhan?: string;
  ho_ten: string;
  ngay_sinh: number;
  thang_sinh: number;
  nam_sinh: number;
  chuc_vu?: string;
  don_vi_cong_tac_id: string;
  so_dien_thoai_lien_he?: string;
  chuyen_mon?: string[];
  khoa_id?: string;
  cum_id?: string;
}

export interface TaoHocVienLeResult {
  hoc_vien_id: string;
  ten_dang_nhap: string;
  dang_ky_hoc_id: string | null;
}

export function taoHocVienLe(dto: TaoHocVienLeDto) {
  return apiFetch<TaoHocVienLeResult>('/hoc-vien/tao-le', { method: 'POST', body: JSON.stringify(dto) });
}

export function useTaoHocVienLe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: taoHocVienLe,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'hoc-vien'] });
    },
  });
}

export function layHocVienTheoId(id: string) {
  return apiFetch<HocVien>(`/hoc-vien/${id}`);
}

export function hocVienTheoIdKey(id: string) {
  return ['admin', 'hoc-vien', 'chi-tiet', id] as const;
}

export function useHocVienTheoId(id: string | undefined) {
  return useQuery({
    queryKey: hocVienTheoIdKey(id ?? ''),
    queryFn: () => layHocVienTheoId(id as string),
    enabled: !!id,
  });
}

// 2026-10-09 (spec khớp mã MOET Q-E): Quản trị sửa mã định danh MOET — chỉ quan_tri; 409 khi trùng
// học viên khác (kể cả khác số 0 đầu), mã mới là tên đăng nhập của TK khác, hoặc HV đã có kết quả khảo sát.
export interface SuaMaMoetDto {
  ma_dinh_danh_moet: string;
  ly_do: string;
}

export interface SuaMaMoetResult {
  id: string;
  ma_dinh_danh_moet: string;
  ten_dang_nhap: string | null;
  da_doi_ten_dang_nhap: boolean;
}

export function suaMaDinhDanhMoet(id: string, dto: SuaMaMoetDto) {
  return apiFetch<SuaMaMoetResult>(`/hoc-vien/${id}/ma-dinh-danh-moet`, {
    method: 'PATCH',
    body: JSON.stringify(dto),
  });
}

// Issue #30: Quản trị xóa cứng 1 học viên + mọi dữ liệu liên quan (không hoàn tác). xac_nhan = mã MOET
// (nếu hồ sơ có) hoặc họ tên — backend kiểm lại, sai -> 400.
export interface XoaHocVienDto {
  ly_do: string;
  xac_nhan: string;
}

export interface XoaHocVienResult {
  id: string;
  nhat_ky_id: string;
  so_dang_ky_da_xoa: number;
}

export function xoaHocVien(id: string, dto: XoaHocVienDto) {
  return apiFetch<XoaHocVienResult>(`/hoc-vien/${id}`, {
    method: 'DELETE',
    body: JSON.stringify(dto),
  });
}

export function useXoaHocVien(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: XoaHocVienDto) => xoaHocVien(id, dto),
    onSuccess: () => {
      // refetchType 'none': chỉ đánh dấu cũ — không tải lại chi tiết hồ sơ vừa xóa (sẽ 404) trước khi rời trang.
      queryClient.invalidateQueries({ queryKey: ['admin', 'hoc-vien'], refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['thong-ke'], refetchType: 'none' });
    },
  });
}

// Issue #31: mức ảnh hưởng nếu xóa — server đếm tại thời điểm gọi (không tính nhat_ky_hoat_dong, bảng đó được giữ).
export interface AnhHuongXoaHocVien {
  ho_ten: string;
  ma_dinh_danh_moet: string | null;
  so_dang_ky: number;
  so_buoi_diem_danh: number;
  so_ket_qua_khao_sat: number;
  so_yeu_cau_ho_tro: number;
  co_tai_khoan: boolean;
  ten_dang_nhap_vle: string | null;
}

export function anhHuongXoaKey(id: string) {
  return ['admin', 'hoc-vien', 'anh-huong-xoa', id] as const;
}

export function useAnhHuongXoaHocVien(id: string, enabled: boolean) {
  return useQuery({
    queryKey: anhHuongXoaKey(id),
    queryFn: () => apiFetch<AnhHuongXoaHocVien>(`/hoc-vien/${id}/anh-huong-xoa`),
    enabled,
    // Luôn đếm lại mỗi lần mở modal, không dùng số cũ trong cache.
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });
}

// Issue #32: nhật ký học viên đã xóa (chỉ quan_tri, chỉ đọc).
export interface HocVienDaXoa {
  id: string;
  hoc_vien_id_cu: string;
  ho_ten: string;
  ma_dinh_danh_moet: string | null;
  ten_don_vi: string;
  so_dang_ky_da_xoa: number;
  ten_dang_nhap_vle: string | null;
  ly_do: string;
  thoi_gian: string;
  nguoi_xoa: { id: string; ho_ten: string; ten_dang_nhap: string };
}

export interface DanhSachDaXoaParams {
  q?: string;
  page?: number;
  page_size?: number;
}

export function useDanhSachHocVienDaXoa(params: DanhSachDaXoaParams) {
  return useQuery({
    queryKey: ['admin', 'hoc-vien', 'da-xoa', params] as const,
    queryFn: () => apiFetch<PaginatedResult<HocVienDaXoa>>(`/hoc-vien/da-xoa${xayQueryString(params)}`),
    placeholderData: keepPreviousData,
  });
}

export function useSuaMaDinhDanhMoet(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: SuaMaMoetDto) => suaMaDinhDanhMoet(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hocVienTheoIdKey(id) });
    },
  });
}

export function layBaoCaoTongHop(theo: BaoCaoTheo) {
  return apiFetch<TongHopResult>(`/bao-cao/tong-hop?theo=${theo}`);
}

export function baoCaoTongHopKey(theo: BaoCaoTheo) {
  return ['admin', 'bao-cao', 'tong-hop', theo] as const;
}

export function useBaoCaoTongHop(theo: BaoCaoTheo) {
  return useQuery({ queryKey: baoCaoTongHopKey(theo), queryFn: () => layBaoCaoTongHop(theo) });
}
