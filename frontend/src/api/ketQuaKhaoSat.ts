import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { SsoTarget } from './hocVien';
import type { MucNangLuc, PaginatedResult } from './types';

// Kết quả khảo sát (2026-10-04, api-contract.md mục 10): hệ thống khảo sát báo về cổng; cổng tự ghi
// "đã mở" khi học viên vào bài qua SSO. Loại bài = đúng giá trị target của SSO.

export type TrangThaiKhaoSat = 'chua_lam' | 'da_mo' | 'dang_lam' | 'hoan_thanh';

/** GET /sso/tinh-trang (học viên) — không có điểm/chi tiết. */
export interface TinhTrangBaiKhaoSat {
  loai: SsoTarget;
  trang_thai: TrangThaiKhaoSat;
  /** Đã mở / đang làm mà quá 24 giờ không có cập nhật -> nhắc kiểm tra lại. */
  can_kiem_tra: boolean;
  mo_gan_nhat_luc: string | null;
  hoan_thanh_luc: string | null;
  muc: MucNangLuc | null;
  /** Mã mức theo thang hệ thống khảo sát (vd "M1"). */
  muc_goc: string | null;
  /** Nhãn backend ghép theo thang quản trị cấu hình (vd "M1 – Chưa đạt") — ưu tiên hiển thị hơn `muc`. */
  nhan_muc_goc: string | null;
  /** Trang kết quả chi tiết bên hệ thống khảo sát. */
  url_ket_qua: string | null;
}

export const tinhTrangKhaoSatKey = ['sso', 'tinh-trang'] as const;

// refetchOnWindowFocus: học viên làm xong bên trang khảo sát rồi quay lại tab -> thấy trạng thái mới.
export function useTinhTrangKhaoSat(enabled = true) {
  return useQuery({
    queryKey: tinhTrangKhaoSatKey,
    queryFn: () => apiFetch<TinhTrangBaiKhaoSat[]>('/sso/tinh-trang'),
    enabled,
    refetchOnWindowFocus: true,
  });
}

// --- Quản trị ---

export type LocTinhHinhKhaoSat = TrangThaiKhaoSat | 'can_kiem_tra';

export interface KetQuaBaiQuanTri {
  loai: SsoTarget;
  trang_thai: Exclude<TrangThaiKhaoSat, 'chua_lam'>;
  can_kiem_tra: boolean;
  so_lan_mo: number;
  mo_gan_nhat_luc: string | null;
  hoan_thanh_luc: string | null;
  muc: MucNangLuc | null;
  muc_goc: string | null;
  nhan_muc_goc: string | null;
  url_ket_qua: string | null;
  diem: number | null;
  diem_toi_da: number | null;
  nguon: 'sso' | 'api' | 'import';
  cap_nhat_luc: string;
}

export interface HocVienTinhHinhKhaoSat {
  id: string;
  ho_ten: string;
  ma_dinh_danh_moet: string | null;
  doi_tuong: 'giao_vien' | 'can_bo_quan_ly' | 'nhan_vien' | null;
  ten_don_vi: string;
  ket_qua: KetQuaBaiQuanTri[];
}

export interface ThongKeLoaiKhaoSat {
  loai: SsoTarget;
  chua_lam: number;
  da_mo: number;
  dang_lam: number;
  hoan_thanh: number;
  can_kiem_tra: number;
  /** Mức GỐC (muc_goc) theo thang quản trị cấu hình — không quy đổi sang MucNangLuc (2026-10-05). */
  theo_muc_goc: { ma: string; nhan: string; so_luong: number }[];
  /** Đã hoàn thành bài nhưng hệ thống khảo sát chưa báo mức. */
  chua_xep_muc: number;
}

export interface ThongKeKhaoSat {
  tong_hoc_vien: number;
  theo_loai: ThongKeLoaiKhaoSat[];
}

export interface DanhSachTinhHinhParams {
  khoa_id?: string;
  loai?: SsoTarget;
  trang_thai?: LocTinhHinhKhaoSat;
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

export function useThongKeKhaoSat(khoaId?: string) {
  return useQuery({
    queryKey: ['admin', 'ket-qua-khao-sat', 'thong-ke', khoaId ?? 'tat-ca'],
    queryFn: () => apiFetch<ThongKeKhaoSat>(`/sso/ket-qua/thong-ke${xayQueryString({ khoa_id: khoaId })}`),
  });
}

export function useDanhSachTinhHinhKhaoSat(params: DanhSachTinhHinhParams) {
  return useQuery({
    queryKey: ['admin', 'ket-qua-khao-sat', 'danh-sach', params],
    queryFn: () => apiFetch<PaginatedResult<HocVienTinhHinhKhaoSat>>(`/sso/ket-qua${xayQueryString(params)}`),
    placeholderData: (truoc) => truoc,
  });
}

// --- Thang mức kết quả (quản trị, 2026-10-05) ---

export interface MucThang {
  ma: string;
  nhan: string;
}

export interface ThangMuc {
  thang: MucThang[];
  cap_nhat_luc: string | null;
}

export function layThangMuc() {
  return apiFetch<ThangMuc>('/sso/thang-muc');
}

export function luuThangMuc(muc: MucThang[]) {
  return apiFetch<ThangMuc>('/sso/thang-muc', { method: 'PUT', body: JSON.stringify({ muc }) });
}
