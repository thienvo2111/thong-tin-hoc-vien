import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { GiaiDoanThamGia } from './danhSachThamGia';
import type { ChuongTrinhBoiDuong } from './dotTrienKhai';
import { laLoiHetHan, type ThongTinHan } from '@/lib/hanNop';

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

/** Issue #66: + han_rieng / han_hieu_luc / han_hieu_luc_ngay / da_het_han (server tính) của chính trường. */
export interface TheDotTruong extends ThongTinHan {
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

/** Issue #66: da_het_han → chỉ xem (như da_nop). */
export interface DanhSachCuaTruong extends ThongTinHan {
  dot: DotCuaTruong;
  dong: DongDanhSachTruong[];
  tong_suat: number;
  don_gia: number | null;
  gia_tri_tam_tinh: number | null;
  trang_thai_danh_sach: TrangThaiDanhSachTruong;
  /** Issue #64 / X5: da_nop → danh sách chỉ xem. */
  trang_thai_hop_dong: TrangThaiHopDong;
  /** X2: bật nút "Xác nhận danh sách" được không; không → lý do. */
  co_the_xac_nhan: boolean;
  ly_do_khong_xac_nhan: string | null;
  /** Issue #62: đề nghị của trường trong đợt, mới nhất trước. */
  de_nghi: DeNghiCuaTruong[];
  so_de_nghi_cho: number;
}

// Issue #62 / ADR 0015 X2: đề nghị sửa / thêm / bớt người của trường — HCMUE Áp dụng / Từ chối.
export type LoaiDeNghi = 'sua' | 'them' | 'bot';
export type TrangThaiDeNghi = 'cho' | 'da_ap_dung' | 'tu_choi';

/** Thông tin trường được đề nghị (suất, trường, mã gốc, ghi chú là của HCMUE). */
export interface GiaTriDeNghi {
  ho_ten?: string;
  ngay_sinh?: string | null;
  gioi_tinh?: string | null;
  lop?: string | null;
  giai_doan?: GiaiDoanThamGia;
}

/** Bản chụp dòng lúc gửi đề nghị sửa/bớt. */
export interface BanChupDong {
  ho_ten: string;
  ngay_sinh: string | null;
  gioi_tinh: string | null;
  lop: string | null;
  giai_doan: GiaiDoanThamGia;
  ty_le_suat: number;
}

export interface DeNghiCuaTruong {
  id: string;
  loai: LoaiDeNghi;
  /** null khi thêm người hoặc dòng đã bị xóa. */
  dong_id: string | null;
  gia_tri: GiaTriDeNghi;
  gia_tri_cu: BanChupDong | null;
  /** Ghi chú / lý do của trường. */
  ly_do: string | null;
  trang_thai: TrangThaiDeNghi;
  ly_do_tu_choi: string | null;
  gui_luc: string;
  xu_ly_luc: string | null;
}

/** POST de-nghi: sửa chỉ gửi trường đã đổi; bớt bắt buộc lý do; thêm không có dong_id. */
export interface GuiDeNghi {
  loai: LoaiDeNghi;
  dong_id?: string;
  gia_tri?: GiaTriDeNghi;
  ly_do?: string;
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
    // Issue #66 / T2: server báo hết hạn (403 HET_HAN_DOT) → tải lại để màn hình vào chế độ chỉ xem.
    onError: (err) => {
      if (!laLoiHetHan(err)) return;
      void queryClient.invalidateQueries({ queryKey: danhSachKey(dotId) });
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

export function useGuiDeNghi(dotId: string) {
  return useThaoTacDanhSach(dotId, (body: GuiDeNghi) =>
    apiFetch<DanhSachCuaTruong>(`${URL}/${dotId}/de-nghi`, { method: 'POST', body: JSON.stringify(body) }),
  );
}
