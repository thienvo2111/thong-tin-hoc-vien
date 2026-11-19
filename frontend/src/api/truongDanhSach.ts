import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { GiaiDoanThamGia } from './danhSachThamGia';
import type { ChuongTrinhBoiDuong } from './dotTrienKhai';

// Issue #60 / ADR 0015 U1, X6, S5: trường xem đợt + danh sách tham gia của chính trường (Cổng đơn vị).
export type TrangThaiDanhSachTruong = 'cho_xac_nhan' | 'da_xac_nhan' | 'bao_sai_lech';
export type TrangThaiHopDong = 'chua_nop' | 'da_nop';
/** Issue #61 / X2: ý kiến của trường trên 1 dòng; null = chưa có ý kiến. */
export type YKienTruong = 'dong_y' | 'khong_dong_y';

export interface DotCuaTruong {
  id: string;
  ten: string;
  chuong_trinh: ChuongTrinhBoiDuong;
  /** ISO UTC — 23:59:59 giờ Việt Nam của han_nop_ngay. */
  han_nop: string;
  /** 'YYYY-MM-DD' theo giờ Việt Nam. */
  han_nop_ngay: string;
}

export interface TheDotTruong {
  dot: DotCuaTruong;
  so_nguoi: number;
  tong_suat: number;
  /** VNĐ, null = chưa có đơn giá. */
  don_gia: number | null;
  /** Đã làm tròn đến đồng; null khi chưa có đơn giá. */
  gia_tri_tam_tinh: number | null;
  trang_thai_danh_sach: TrangThaiDanhSachTruong;
  trang_thai_hop_dong: TrangThaiHopDong;
}

export interface DongDanhSachTruong {
  id: string;
  ho_ten: string;
  /** 'YYYY-MM-DD' hoặc null. */
  ngay_sinh: string | null;
  gioi_tinh: string | null;
  lop: string | null;
  giai_doan: GiaiDoanThamGia;
  ty_le_suat: number;
  ghi_chu: string | null;
  y_kien_truong: YKienTruong | null;
}

export interface DanhSachCuaTruong {
  dot: DotCuaTruong;
  dong: DongDanhSachTruong[];
  tong_suat: number;
  don_gia: number | null;
  gia_tri_tam_tinh: number | null;
  trang_thai_danh_sach: TrangThaiDanhSachTruong;
  /** X2: bật nút "Xác nhận danh sách" được không; không → lý do. */
  co_the_xac_nhan: boolean;
  ly_do_khong_xac_nhan: string | null;
}

const URL = '/cong-don-vi/truong/dot';

export function useDotCuaTruong() {
  return useQuery({
    queryKey: ['cong-don-vi', 'truong', 'dot'],
    queryFn: () => apiFetch<TheDotTruong[]>(URL),
  });
}

const danhSachKey = (dotId: string) => ['cong-don-vi', 'truong', 'dot', dotId, 'danh-sach'] as const;

export function useDanhSachCuaTruong(dotId: string) {
  return useQuery({
    queryKey: danhSachKey(dotId),
    queryFn: () => apiFetch<DanhSachCuaTruong>(`${URL}/${dotId}/danh-sach`),
  });
}

// Issue #61 / ADR 0015 X1, X2: mọi thao tác trả lại cả danh sách → ghi thẳng vào cache, làm mới thẻ đợt.
function useThaoTacDanhSach<V>(dotId: string, goi: (v: V) => Promise<DanhSachCuaTruong>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: goi,
    onSuccess: (ds) => {
      queryClient.setQueryData(danhSachKey(dotId), ds);
      void queryClient.invalidateQueries({ queryKey: ['cong-don-vi', 'truong', 'dot'], exact: true });
    },
  });
}

export function useYKienDong(dotId: string) {
  return useThaoTacDanhSach(dotId, ({ dongId, y_kien }: { dongId: string; y_kien: YKienTruong | null }) =>
    apiFetch<DanhSachCuaTruong>(`${URL}/${dotId}/danh-sach/${dongId}/y-kien`, {
      method: 'PUT',
      body: JSON.stringify({ y_kien }),
    }),
  );
}

export function useDongYTatCa(dotId: string) {
  return useThaoTacDanhSach(dotId, () =>
    apiFetch<DanhSachCuaTruong>(`${URL}/${dotId}/danh-sach/dong-y-tat-ca`, { method: 'POST' }),
  );
}

export function useXacNhanDanhSach(dotId: string) {
  return useThaoTacDanhSach(dotId, () =>
    apiFetch<DanhSachCuaTruong>(`${URL}/${dotId}/danh-sach/xac-nhan`, { method: 'POST' }),
  );
}
