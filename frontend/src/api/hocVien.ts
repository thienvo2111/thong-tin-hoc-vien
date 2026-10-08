import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type {
  DaGuiResponse,
  DanhGiaDauVao,
  DotXacNhan,
  HocVien,
  KhoaHocDangKy,
  KiemTraTruocXacNhan,
  MucDoDayDu,
  MucNangLuc,
  XacNhanResponse,
} from './types';

export function layHoSoToi() {
  return apiFetch<HocVien>('/hoc-vien/toi');
}

export function suaHoSoToi(patch: Partial<HocVien>) {
  return apiFetch<HocVien & { xac_nhan_bi_huy?: boolean }>('/hoc-vien/toi', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export function themChuyenMon(chuyen_mon: string) {
  return apiFetch<void>('/hoc-vien/toi/chuyen-mon', {
    method: 'POST',
    body: JSON.stringify({ chuyen_mon }),
  });
}

export function xoaChuyenMon(chuyen_mon: string) {
  return apiFetch<void>('/hoc-vien/toi/chuyen-mon', {
    method: 'DELETE',
    body: JSON.stringify({ chuyen_mon }),
  });
}

export function kiemTraTrungCccd(so_dinh_danh_ca_nhan: string) {
  const qs = new URLSearchParams({ so_dinh_danh_ca_nhan });
  return apiFetch<{ trung: boolean }>(`/hoc-vien/kiem-tra-trung?${qs.toString()}`, { coXacThuc: false });
}

export function layDotXacNhan() {
  return apiFetch<DotXacNhan>('/hoc-vien/toi/dot-xac-nhan');
}

export function layMucDoDayDu() {
  return apiFetch<MucDoDayDu>('/hoc-vien/toi/muc-do-day-du');
}

export function kiemTraTruocXacNhan() {
  return apiFetch<KiemTraTruocXacNhan>('/hoc-vien/toi/kiem-tra-truoc-xac-nhan', { method: 'POST' });
}

export function xacNhanHoSo() {
  return apiFetch<XacNhanResponse>('/hoc-vien/toi/xac-nhan', { method: 'POST' });
}

// 2026-09-30: gửi lại email xác minh cho email_lien_he hiện tại (M4 — badge trạng thái email).
export function guiLaiXacMinhEmail() {
  return apiFetch<DaGuiResponse>('/hoc-vien/toi/gui-lai-xac-minh-email', { method: 'POST' });
}

export function layDanhGiaDauVao() {
  return apiFetch<DanhGiaDauVao>('/hoc-vien/toi/danh-gia-dau-vao');
}

/** Bài trên hệ thống khảo sát; bỏ trống -> bên khảo sát hiện danh sách bài cần làm. */
export type SsoTarget = 'khao-sat' | 'danh-gia' | 'dau-ra';

// 2026-10-02: cấp mã dùng 1 lần (hết hạn sau vài phút) rồi chuyển sang hệ thống khảo sát — chỉ gọi lúc
// học viên bấm nút, không gọi sẵn khi tải trang.
export function capMaSso(target?: SsoTarget) {
  return apiFetch<{ url: string; het_han: string }>('/sso/cap-ma', {
    method: 'POST',
    body: JSON.stringify(target ? { target } : {}),
  });
}

export function layKhoaHocToi() {
  return apiFetch<KhoaHocDangKy[]>('/hoc-vien/toi/khoa-hoc');
}

export const hoSoToiKey = ['hoc-vien', 'toi'] as const;
export function useHoSoToi(enabled = true) {
  return useQuery({ queryKey: hoSoToiKey, queryFn: layHoSoToi, enabled });
}

export const dotXacNhanKey = ['hoc-vien', 'toi', 'dot-xac-nhan'] as const;
export function useDotXacNhan(enabled = true) {
  return useQuery({ queryKey: dotXacNhanKey, queryFn: layDotXacNhan, enabled });
}

export const mucDoDayDuKey = ['hoc-vien', 'toi', 'muc-do-day-du'] as const;
export function useMucDoDayDu(enabled = true) {
  return useQuery({ queryKey: mucDoDayDuKey, queryFn: layMucDoDayDu, enabled });
}

export const danhGiaDauVaoKey = ['hoc-vien', 'toi', 'danh-gia-dau-vao'] as const;
// M6 (dac-ta § M6): phản hồi chứa tài khoản VLE + mật khẩu tạm — không được lưu lâu trong cache
// (gcTime: 0 dọn ngay khi rời trang) và không tự làm mới nền (mỗi lần vào lại trang phải gọi API mới).
export function useDanhGiaDauVao(enabled = true) {
  return useQuery({
    queryKey: danhGiaDauVaoKey,
    queryFn: layDanhGiaDauVao,
    enabled,
    gcTime: 0,
    refetchOnReconnect: false,
  });
}

export const khoaHocToiKey = ['hoc-vien', 'toi', 'khoa-hoc'] as const;
export function useKhoaHocToi(enabled = true) {
  return useQuery({ queryKey: khoaHocToiKey, queryFn: layKhoaHocToi, enabled });
}

// 2026-10-08: học viên tự điều chỉnh mức lớp học (chỉ ≤ mức đánh giá, khi khóa mở điều chỉnh).
// muc=null = quay về học theo mức đánh giá.
export interface KetQuaChonMucHoc {
  muc_dau_vao: MucNangLuc;
  muc_hoc_chon: MucNangLuc | null;
  muc_hoc: MucNangLuc;
  muc_hoc_chon_luc: string | null;
}

export function chonMucHoc(khoaId: string, muc: MucNangLuc | null) {
  return apiFetch<KetQuaChonMucHoc>(`/hoc-vien/toi/khoa-hoc/${khoaId}/muc-hoc`, {
    method: 'PUT',
    body: JSON.stringify({ muc }),
  });
}

export function useChonMucHoc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ khoaId, muc }: { khoaId: string; muc: MucNangLuc | null }) => chonMucHoc(khoaId, muc),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: khoaHocToiKey });
    },
  });
}
