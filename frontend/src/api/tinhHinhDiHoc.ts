import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiFetchBlob } from './client';
import type { LoaiLop, MaDiemDanhBuoi, NguonTinhDiemDanh, PaginatedResult } from './types';

// ADR 0010 — Tình hình đi học + điểm danh bổ sung. Cùng API cho người hỗ trợ học viên
// (/ho-tro-hoc-vien/di-hoc, phạm vi cụm ∪ lớp gốc) và Quản trị (/thong-ke/di-hoc, mọi học viên).

export type CheDoDiHoc = 'ho_tro' | 'admin';

const GOC: Record<CheDoDiHoc, string> = {
  ho_tro: '/ho-tro-hoc-vien/di-hoc',
  admin: '/thong-ke/di-hoc',
};

export type TrangThaiDiemDanh = 'co_mat' | 'vang' | 'vang_co_phep';

export interface LocTinhHinhDiHoc {
  khoa_id: string;
  q?: string;
  don_vi_cong_tac_id?: string;
  cum_id?: string;
  lop_id?: string;
  co_vang?: boolean;
  chua_diem_danh?: boolean;
  page?: number;
  page_size?: number;
}

export interface TongDiHoc {
  da_dien_ra: number;
  co_mat: number;
  vang: number;
  vang_co_phep: number;
  da_bao_vang: number;
  chua_diem_danh: number;
}

export interface LopTheoGiaiDoan {
  giai_doan_id: string;
  thu_tu: number;
  ten_giai_doan: string;
  lop_id: string;
  ten_lop: string;
}

export interface DongTinhHinhDiHoc {
  hoc_vien_id: string;
  dang_ky_hoc_id: string;
  ho_ten: string;
  ma_dinh_danh_moet: string | null;
  don_vi_cong_tac_ten: string;
  cum: string | null;
  lop_theo_giai_doan: LopTheoGiaiDoan[];
  tong: TongDiHoc;
}

export interface KhoaLocDiHoc {
  khoa_id: string;
  ma_khoa: string;
  ten_khoa: string;
  cum: { id: string; ten_cum: string }[];
  lop: { id: string; ten_lop: string; loai_lop: LoaiLop }[];
}

export interface BuoiDiHoc {
  lich_hoc_id: string;
  lich_nguon_id: string;
  giai_doan: { id: string; thu_tu: number; ten_giai_doan: string };
  buoi_so: number;
  lop: { id: string; ten_lop: string };
  doi_buoi: null | { tu_lop: { id: string; ten_lop: string }; sang_lop: { id: string; ten_lop: string } };
  thoi_gian_bat_dau: string;
  thoi_gian_ket_thuc: string;
  diem_danh: {
    ma: MaDiemDanhBuoi;
    nhan: string;
    /** ADR 0010 T7: lớp của dòng được tính (học bù / lớp cũ = lop_khac); null khi chưa có. */
    nguon_tinh: NguonTinhDiemDanh | null;
    lop_tinh: { id: string; ten_lop: string } | null;
    trang_thai: TrangThaiDiemDanh | null;
    nguon: string | null;
    ghi_chu: string | null;
    nguoi_sua: string | null;
    cap_nhat_luc: string | null;
    tu_diem_danh_luc: string | null;
  };
  bo_sung_duoc: boolean;
  ly_do_khong: string | null;
}

export interface ChiTietDiHoc extends DongTinhHinhDiHoc {
  khoa: { id: string; ma_khoa: string; ten_khoa: string };
  trang_thai_duoc: TrangThaiDiemDanh[];
  buoi: BuoiDiHoc[];
}

export interface DiemDanhBoSungDto {
  lich_hoc_id: string;
  trang_thai: TrangThaiDiemDanh;
  ly_do?: string;
}

function xayQueryString(params: object): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '' && v !== false) qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

const KHOA_QUERY = ['tinh-hinh-di-hoc'] as const;

export function useKhoaDiHoc(cheDo: CheDoDiHoc) {
  return useQuery({
    queryKey: [...KHOA_QUERY, cheDo, 'khoa'],
    queryFn: () => apiFetch<KhoaLocDiHoc[]>(`${GOC[cheDo]}/khoa`),
  });
}

export function useTinhHinhDiHoc(cheDo: CheDoDiHoc, params: LocTinhHinhDiHoc | null) {
  return useQuery({
    queryKey: [...KHOA_QUERY, cheDo, 'ds', params],
    queryFn: () => apiFetch<PaginatedResult<DongTinhHinhDiHoc>>(`${GOC[cheDo]}${xayQueryString(params!)}`),
    enabled: !!params,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useChiTietDiHoc(cheDo: CheDoDiHoc, dangKyHocId: string | null) {
  return useQuery({
    queryKey: [...KHOA_QUERY, cheDo, 'chi-tiet', dangKyHocId],
    queryFn: () => apiFetch<ChiTietDiHoc>(`${GOC[cheDo]}/${dangKyHocId}`),
    enabled: !!dangKyHocId,
    retry: false,
  });
}

/** Xuất .xlsx đủ mọi dòng khớp bộ lọc (bỏ phân trang). */
export function xuatTinhHinhDiHoc(cheDo: CheDoDiHoc, params: LocTinhHinhDiHoc): Promise<Blob> {
  const { page: _p, page_size: _ps, ...loc } = params;
  return apiFetchBlob(`${GOC[cheDo]}/xuat${xayQueryString(loc)}`);
}

export function useDiemDanhBoSung(cheDo: CheDoDiHoc, dangKyHocId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: DiemDanhBoSungDto) =>
      apiFetch<unknown>(`${GOC[cheDo]}/${dangKyHocId}/diem-danh`, { method: 'PUT', body: JSON.stringify(dto) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...KHOA_QUERY, cheDo] }),
  });
}
