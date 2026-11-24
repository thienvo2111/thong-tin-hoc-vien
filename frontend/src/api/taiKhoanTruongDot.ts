import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import { danhSachKey } from './danhSachThamGia';

// ADR 0015 T4: tài khoản trường của đợt — tài khoản đơn vị (ADR 0002), chỉ cho trường có trong danh sách của đợt.
export interface DonViGon {
  id: string;
  ma: string | null;
  ten: string;
}

export interface TaiKhoanTruong {
  id: string;
  ten_dang_nhap: string;
  trang_thai: 'active' | 'ngung';
  /** ISO UTC; null = chưa đăng nhập lần nào. */
  lan_dang_nhap_cuoi: string | null;
}

export interface TaiKhoanTruongCuaDot {
  tong: { so_truong: number; so_co_tai_khoan: number; so_chua_co: number; so_chua_dang_nhap: number };
  truong: { don_vi: DonViGon; tai_khoan: TaiKhoanTruong | null }[];
}

export interface KetQuaCapTaiKhoanTruong {
  so_tao: number;
  bo_qua: { don_vi: DonViGon; ly_do: string }[];
  /** File .xlsx mật khẩu tạm (base64) — server không lưu; null khi không tạo tài khoản nào. */
  file_mat_khau: string | null;
}

const url = (dotId: string, duoi = '') => `/cong-don-vi/dot-trien-khai/${dotId}/tai-khoan-truong${duoi}`;
// Dưới khóa danh sách của đợt: nạp/sửa danh sách (đổi tập trường) làm mới luôn bảng tài khoản.
export const taiKhoanTruongKey = (dotId: string) => [...danhSachKey(dotId), 'tai-khoan-truong'] as const;

export function useTaiKhoanTruongCuaDot(dotId: string) {
  return useQuery({
    queryKey: taiKhoanTruongKey(dotId),
    queryFn: () => apiFetch<TaiKhoanTruongCuaDot>(url(dotId)),
  });
}

/** gcTime: 0 — kết quả chứa file mật khẩu tạm, không nằm lại trong cache TanStack. */
export function useCapTaiKhoanTruong(dotId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<KetQuaCapTaiKhoanTruong>(url(dotId, '/cap'), { method: 'POST' }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: taiKhoanTruongKey(dotId) }),
    gcTime: 0,
  });
}

/** base64 → Blob .xlsx để tải bằng taiFileTuBlob (như file mật khẩu của import tài khoản đơn vị). */
export function blobTuBase64Xlsx(base64: string): Blob {
  const nhiPhan = atob(base64);
  const bytes = new Uint8Array(nhiPhan.length);
  for (let i = 0; i < nhiPhan.length; i++) bytes[i] = nhiPhan.charCodeAt(i);
  return new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
