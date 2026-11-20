import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import { danhSachKey } from './danhSachThamGia';
import type { BanChupDong, GiaTriDeNghi, LoaiDeNghi, TrangThaiDeNghi, YKienTruong } from './truongDanhSach';

// Issue #62 / ADR 0015 X2: hàng đợi đề nghị của trường — Quản trị Áp dụng / Từ chối.
export interface MucDeNghi {
  id: string;
  don_vi: { id: string; ten: string };
  loai: LoaiDeNghi;
  dong_id: string | null;
  /** Giá trị hiện tại của dòng; null khi thêm người hoặc dòng đã bị xóa. */
  dong_hien_tai: (BanChupDong & { y_kien_truong: YKienTruong | null }) | null;
  gia_tri: GiaTriDeNghi;
  gia_tri_cu: BanChupDong | null;
  ly_do: string | null;
  trang_thai: TrangThaiDeNghi;
  ly_do_tu_choi: string | null;
  gui_luc: string;
  gui_boi: { id: string; ho_ten: string; ten_dang_nhap: string };
  xu_ly_luc: string | null;
  xu_ly_boi: { id: string; ho_ten: string } | null;
}

export interface HangDoiDeNghi {
  items: MucDeNghi[];
  /** Tổng đề nghị chờ của cả đợt (badge). */
  so_cho: number;
}

const hangDoiKey = (dotId: string) => ['cong-don-vi', 'de-nghi', dotId] as const;

export function useHangDoiDeNghi(dotId: string, trangThai: TrangThaiDeNghi = 'cho', donViId: string | null = null) {
  return useQuery({
    queryKey: [...hangDoiKey(dotId), trangThai, donViId],
    queryFn: () => {
      const qs = new URLSearchParams({ trang_thai: trangThai });
      if (donViId) qs.set('don_vi_id', donViId);
      return apiFetch<HangDoiDeNghi>(`/cong-don-vi/dot-trien-khai/${dotId}/de-nghi?${qs}`);
    },
  });
}

/** Sau Áp dụng / Từ chối: làm mới hàng đợi (mọi bộ lọc) + danh sách của đợt. */
function useXuLyDeNghi<V>(dotId: string, goi: (v: V) => Promise<MucDeNghi>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: goi,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: hangDoiKey(dotId) });
      void queryClient.invalidateQueries({ queryKey: danhSachKey(dotId) });
    },
  });
}

export function useApDungDeNghi(dotId: string) {
  return useXuLyDeNghi(dotId, (id: string) =>
    apiFetch<MucDeNghi>(`/cong-don-vi/de-nghi-sua/${id}/ap-dung`, { method: 'POST' }),
  );
}

export function useTuChoiDeNghi(dotId: string) {
  return useXuLyDeNghi(dotId, ({ id, ly_do }: { id: string; ly_do: string }) =>
    apiFetch<MucDeNghi>(`/cong-don-vi/de-nghi-sua/${id}/tu-choi`, {
      method: 'POST',
      body: JSON.stringify({ ly_do }),
    }),
  );
}
