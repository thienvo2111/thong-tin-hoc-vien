import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { HoSoDonViDuLieu, TruongHoSo } from '@/lib/hoSoDonVi';

// Issue #63 / ADR 0015 M4, U2, O3: Hồ sơ đơn vị (Cổng đơn vị).
export interface HoSoDonViPhanHoi {
  don_vi: { id: string; ten: string };
  /** null = trường chưa khai lần nào. */
  ho_so: (HoSoDonViDuLieu & { updated_at: string }) | null;
  tinh_trang: { du: boolean; thieu: TruongHoSo[]; so_thieu: number };
  /** U2: suy ra từ mã QHNS, không lưu; null khi chưa có mã QHNS hợp lệ. */
  chuyen_khoan: { stk: string; don_vi_tiep_nhan: string; ngan_hang: string } | null;
  goi_y: { ten_truong: string };
}

const URL = '/cong-don-vi/ho-so-don-vi';
const KEY_TRUONG = ['cong-don-vi', 'truong', 'ho-so-don-vi'] as const;

/** Hồ sơ của chính trường đang đăng nhập (đơn vị lấy từ token). */
export function useHoSoDonVi() {
  return useQuery({ queryKey: KEY_TRUONG, queryFn: () => apiFetch<HoSoDonViPhanHoi>(URL) });
}

/** PUT thay toàn bộ: ô null/vắng = xóa. Trả lại cùng dạng GET → ghi thẳng vào cache (badge trang chủ cập nhật). */
export function useLuuHoSoDonVi() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: HoSoDonViDuLieu) =>
      apiFetch<HoSoDonViPhanHoi>(URL, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: (data) => queryClient.setQueryData(KEY_TRUONG, data),
  });
}

/** Quản trị đọc hồ sơ của 1 trường bất kỳ. */
export function useHoSoDonViQuanTri(donViId: string) {
  return useQuery({
    queryKey: ['cong-don-vi', 'quan-tri', 'ho-so-don-vi', donViId],
    queryFn: () => apiFetch<HoSoDonViPhanHoi>(`${URL}/${donViId}`),
  });
}
