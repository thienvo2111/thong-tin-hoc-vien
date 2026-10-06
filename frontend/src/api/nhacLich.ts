import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';

// ADR 0004 G10/G11 (issue #21): tin nhắn nhắc lịch soạn sẵn — cán bộ sao chép gửi qua Zalo/SMS rồi bấm
// "Đã gửi". Không email, không tự động.

export type TrangThaiNhac = 'chua_nhac' | 'can_nhac_lai' | 'da_nhac';

export const NHAN_NHAC: Record<TrangThaiNhac, { nhan: string; mau: string }> = {
  chua_nhac: { nhan: 'Chưa nhắc', mau: 'gray' },
  can_nhac_lai: { nhan: 'Cần nhắc lại', mau: 'orange' },
  da_nhac: { nhan: 'Đã nhắc', mau: 'green' },
};

const UU_TIEN: Record<TrangThaiNhac, number> = { da_nhac: 0, chua_nhac: 1, can_nhac_lai: 2 };

/** Gộp nhiều buổi: cần nhắc lại > chưa nhắc > đã nhắc. */
export function gopNhac(ds: (TrangThaiNhac | undefined)[]): TrangThaiNhac {
  return ds.reduce<TrangThaiNhac>((a, b) => (b && UU_TIEN[b] > UU_TIEN[a] ? b : a), 'da_nhac');
}

export interface TinNhanNhacGv {
  giang_vien: { id: string; ho_ten: string; so_dien_thoai: string | null; email: string | null };
  lich_hoc_ids: string[];
  noi_dung: string;
  trang_thai_nhac: TrangThaiNhac;
  lan_gui_cuoi: { gui_luc: string; nguoi_gui: string | null } | null;
}

export interface TinNhanNhacCum {
  cum: { id: string; ten_cum: string };
  ngay: string;
  buoi: { id: string; buoi_so: number; ten_lop: string; thoi_gian_bat_dau: string; thoi_gian_ket_thuc: string; trang_thai_nhac: TrangThaiNhac }[];
  lich_hoc_ids: string[];
  noi_dung: string | null;
  trang_thai_nhac: TrangThaiNhac | null;
}

// ---------------- Hỗ trợ giảng viên ----------------
export function useTinNhanNhacGv(lopId: string, gdId: string, giangVienId: string | null) {
  return useQuery({
    queryKey: ['ho-tro-gv', 'tin-nhan-nhac', lopId, gdId, giangVienId],
    queryFn: () =>
      apiFetch<TinNhanNhacGv>(`/ho-tro-giang-vien/lop/${lopId}/giai-doan/${gdId}/tin-nhan-nhac/${giangVienId}`),
    enabled: !!giangVienId,
    gcTime: 0,
  });
}

export function useDaGuiNhacGv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { giang_vien_id: string; lich_hoc_ids: string[]; noi_dung: string }) =>
      apiFetch('/ho-tro-giang-vien/nhac-lich', { method: 'POST', body: JSON.stringify(dto) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ho-tro-gv'] }),
  });
}

// ---------------- Hỗ trợ học viên ----------------
export function useTinNhanNhacCum(cumId: string | null, ngay: string | null) {
  return useQuery({
    queryKey: ['ho-tro', 'tin-nhan-nhac', cumId, ngay],
    queryFn: () => apiFetch<TinNhanNhacCum>(`/ho-tro-hoc-vien/cum/${cumId}/tin-nhan-nhac?ngay=${ngay}`),
    enabled: !!cumId && !!ngay,
    gcTime: 0,
  });
}

export function useDaGuiNhacCum() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { cum_id: string; lich_hoc_ids: string[]; noi_dung: string }) =>
      apiFetch('/ho-tro-hoc-vien/nhac-lich', { method: 'POST', body: JSON.stringify(dto) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ho-tro'] }),
  });
}

export function useDemNhacLichCum() {
  return useQuery({
    queryKey: ['ho-tro', 'nhac-lich', 'dem'],
    queryFn: () => apiFetch<{ can_nhac: number }>('/ho-tro-hoc-vien/nhac-lich/dem'),
  });
}
