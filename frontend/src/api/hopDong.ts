import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import { danhSachKey as danhSachQuanTriKey } from './danhSachThamGia';
import type { ChuongTrinhBoiDuong } from './dotTrienKhai';
import type { TrangThaiDanhSachTruong, TrangThaiHopDong } from './truongDanhSach';
import type { HoSoDonViDuLieu } from '@/lib/hoSoDonVi';
import type { NhapHopDong } from '@/lib/hopDong';

// Issue #64 / ADR 0015 M5, S4–S6, X4, X5: hợp đồng — nháp Phần 3–4, Nộp, Quản trị xem / Mở lại.

/** Mã lý do chưa nộp được (backend lyDoChanNop). */
export type MaLyDoChanNop =
  | 'da_nop'
  | 'danh_sach_chua_xac_nhan'
  | 'chua_co_don_gia'
  | 'ho_so_chua_du'
  | 'thieu_hau_can'
  | 'phan_3_chua_du'
  | 'thieu_so_qd'
  | 'thieu_ngay_qd'
  | 'dot_chua_cau_hinh_ngay_qd'
  | 'ngay_qd_ngoai_khoang';

export interface LyDoChanNop {
  ma: MaLyDoChanNop;
  thong_diep: string;
}

/** M5: bản chụp Hồ sơ đơn vị lúc nộp. */
export type BanChupHoSo = HoSoDonViDuLieu & {
  stk_chuyen_khoan: string | null;
  don_vi_tiep_nhan: string;
  ngan_hang_tiep_nhan: string;
  chup_luc: string;
};

export interface HopDongPhanHoi {
  dot: {
    id: string;
    ten: string;
    chuong_trinh: ChuongTrinhBoiDuong;
    don_gia: number | null;
    /** 'YYYY-MM-DD' hoặc null (đợt chưa cấu hình). */
    ngay_qd_tu: string | null;
    ngay_qd_den: string | null;
    han_nop: string;
    han_nop_ngay: string;
  };
  trang_thai_danh_sach: TrangThaiDanhSachTruong;
  trang_thai_hop_dong: TrangThaiHopDong;
  phan_3: Pick<NhapHopDong, 'nguoi_nhan' | 'sdt_nguoi_nhan' | 'dia_chi_nhan' | 'ghi_chu'>;
  phan_4: Pick<NhapHopDong, 'so_qd' | 'ngay_qd'>;
  diem_hoc_truc_tiep: boolean;
  /** Chưa nộp: tạm tính từ danh sách; đã nộp: số liệu lúc nộp. */
  so_nguoi: number;
  tong_suat: number;
  don_gia: number | null;
  gia_tri: number | null;
  can_phan_4: boolean;
  ho_so_tinh_trang: { du: boolean; so_thieu: number };
  chuyen_khoan: { stk: string; don_vi_tiep_nhan: string; ngan_hang: string } | null;
  co_the_nop: boolean;
  ly_do_chan: LyDoChanNop[];
  nop_luc: string | null;
  ban_chup_ho_so: BanChupHoSo | null;
}

export interface HopDongQuanTri extends HopDongPhanHoi {
  don_vi: { id: string; ten: string };
  nop_boi: { ho_ten: string; ten_dang_nhap: string } | null;
  /** Chưa nộp: hồ sơ hiện tại (null = chưa khai). Đã nộp: null — xem ban_chup_ho_so. */
  ho_so_hien_tai: HoSoDonViDuLieu | null;
}

const urlTruong = (dotId: string) => `/cong-don-vi/truong/dot/${dotId}/hop-dong`;
const urlQuanTri = (dotId: string, donViId: string) => `/cong-don-vi/dot-trien-khai/${dotId}/hop-dong/${donViId}`;
const keyTruong = (dotId: string) => ['cong-don-vi', 'truong', 'dot', dotId, 'hop-dong'] as const;
const keyQuanTri = (dotId: string, donViId: string) => ['cong-don-vi', 'quan-tri', 'hop-dong', dotId, donViId] as const;

export function useHopDongTruong(dotId: string) {
  return useQuery({ queryKey: keyTruong(dotId), queryFn: () => apiFetch<HopDongPhanHoi>(urlTruong(dotId)) });
}

/** Lưu nháp / Nộp trả lại cùng dạng GET → ghi thẳng vào cache; làm mới thẻ đợt + danh sách (khóa X5). */
function useThaoTacHopDong<V>(dotId: string, goi: (v: V) => Promise<HopDongPhanHoi>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: goi,
    onSuccess: (data) => {
      queryClient.setQueryData(keyTruong(dotId), data);
      void queryClient.invalidateQueries({ queryKey: ['cong-don-vi', 'truong', 'dot'], exact: true });
      void queryClient.invalidateQueries({ queryKey: ['cong-don-vi', 'truong', 'dot', dotId, 'danh-sach'] });
    },
  });
}

export function useLuuNhapHopDong(dotId: string) {
  return useThaoTacHopDong(dotId, (body: NhapHopDong) =>
    apiFetch<HopDongPhanHoi>(urlTruong(dotId), { method: 'PUT', body: JSON.stringify(body) }),
  );
}

export function useNopHopDong(dotId: string) {
  return useThaoTacHopDong(dotId, () => apiFetch<HopDongPhanHoi>(`${urlTruong(dotId)}/nop`, { method: 'POST' }));
}

export function useHopDongQuanTri(dotId: string, donViId: string) {
  return useQuery({
    queryKey: keyQuanTri(dotId, donViId),
    queryFn: () => apiFetch<HopDongQuanTri>(urlQuanTri(dotId, donViId)),
  });
}

export function useMoLaiHopDong(dotId: string, donViId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ly_do: string) =>
      apiFetch<HopDongQuanTri>(`${urlQuanTri(dotId, donViId)}/mo-lai`, {
        method: 'POST',
        body: JSON.stringify({ ly_do }),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(keyQuanTri(dotId, donViId), data);
      void queryClient.invalidateQueries({ queryKey: danhSachQuanTriKey(dotId) });
    },
  });
}
