import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiFetchBlob } from './client';
import type { TrangThaiDanhSachTruong, YKienTruong } from './truongDanhSach';

// Issue #58 / ADR 0015 M3, M6, S1, S3, T7 — Quản trị nạp Excel danh sách HSG theo đợt (Cổng đơn vị).
export type GiaiDoanThamGia = 'ca_hai' | 'chi_gd1' | 'chi_gd2';
export type TrangThaiKhop = 'khop_ma' | 'khop_ten' | 'khong_khop' | 'thieu_truong' | 'nhieu_ket_qua';

export interface TruongPhamVi {
  id: string;
  ma_don_vi: string | null;
  ten_don_vi: string;
}

export interface DongXemTruoc {
  /** Số dòng trên file Excel. */
  so_dong: number;
  ho_ten: string;
  /** 'YYYY-MM-DD' hoặc null. */
  ngay_sinh: string | null;
  gioi_tinh: string | null;
  ma_goc: string | null;
  lop: string | null;
  ma_truong: string | null;
  ten_truong: string | null;
  /** null khi giai đoạn sai (có lỗi). */
  giai_doan: GiaiDoanThamGia | null;
  ty_le_suat: 1 | 0.5 | null;
  ghi_chu: string | null;
  trang_thai_khop: TrangThaiKhop;
  don_vi_id: string | null;
  ten_don_vi_khop: string | null;
  /** Có lỗi → không nạp được. */
  loi: string[];
}

export interface KetQuaXemTruoc {
  dong: DongXemTruoc[];
  tong_hop: Record<TrangThaiKhop | 'loi' | 'tong', number>;
}

export interface DongNap {
  so_dong: number;
  don_vi_id: string;
  ho_ten: string;
  ngay_sinh: string | null;
  gioi_tinh: string | null;
  ma_goc: string | null;
  lop: string | null;
  giai_doan: GiaiDoanThamGia;
  ty_le_suat: 1 | 0.5;
  ghi_chu: string | null;
}

export interface KetQuaNap {
  so_truong: number;
  so_dong: number;
  tong_suat: number;
}

export interface DongDanhSach {
  id: string;
  don_vi_id: string;
  ho_ten: string;
  ngay_sinh: string | null;
  gioi_tinh: string | null;
  ma_goc: string | null;
  lop: string | null;
  giai_doan: GiaiDoanThamGia;
  ty_le_suat: number;
  ghi_chu: string | null;
  /** Issue #61: ý kiến của trường; null = chưa có ý kiến. */
  y_kien_truong: YKienTruong | null;
  hoc_vien_id: string | null;
  /** Issue #62: dòng đang có đề nghị sửa/bớt chờ xử lý. */
  co_de_nghi_cho?: boolean;
}

export interface TongHopTruong {
  don_vi_id: string;
  ten_don_vi: string;
  ma_don_vi: string | null;
  so_nguoi: number;
  tong_suat: number;
  /** Issue #61 / X1: null nếu trường chưa có dòng hợp đồng. */
  trang_thai_danh_sach: TrangThaiDanhSachTruong | null;
  /** Issue #62: số đề nghị chờ của trường. */
  so_de_nghi_cho?: number;
}

export interface DanhSachThamGia {
  tong_hop: TongHopTruong[];
  dong: DongDanhSach[];
}

const url = (dotId: string, duoi: string) => `/cong-don-vi/dot-trien-khai/${dotId}/${duoi}`;
export const danhSachKey = (dotId: string) => ['cong-don-vi', 'danh-sach-tham-gia', dotId] as const;

export function taiMauDanhSach(dotId: string) {
  return apiFetchBlob(url(dotId, 'danh-sach/mau-excel'));
}

export function xemTruocDanhSach(dotId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return apiFetch<KetQuaXemTruoc>(url(dotId, 'danh-sach/xem-truoc'), { method: 'POST', body: form });
}

export function napDanhSach(dotId: string, dong: DongNap[]) {
  return apiFetch<KetQuaNap>(url(dotId, 'danh-sach/nap'), { method: 'POST', body: JSON.stringify({ dong }) });
}

export function useTruongTrongPhamVi(dotId: string | null) {
  return useQuery({
    queryKey: ['cong-don-vi', 'truong-trong-pham-vi', dotId],
    queryFn: () => apiFetch<TruongPhamVi[]>(url(dotId as string, 'truong-trong-pham-vi')),
    enabled: !!dotId,
  });
}

export function useDanhSachThamGia(dotId: string | null) {
  return useQuery({
    queryKey: danhSachKey(dotId ?? ''),
    queryFn: () => apiFetch<DanhSachThamGia>(url(dotId as string, 'danh-sach')),
    enabled: !!dotId,
  });
}

export function useXemTruocDanhSach() {
  return useMutation({ mutationFn: ({ dotId, file }: { dotId: string; file: File }) => xemTruocDanhSach(dotId, file) });
}

export function useNapDanhSach() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dotId, dong }: { dotId: string; dong: DongNap[] }) => napDanhSach(dotId, dong),
    onSuccess: (_kq, { dotId }) => queryClient.invalidateQueries({ queryKey: danhSachKey(dotId) }),
  });
}

// Issue #59 / ADR 0015 X3: Quản trị sửa/thêm/xóa từng dòng (bắt buộc lý do) + xuất Excel danh sách hiện tại.
export interface TruongDongDanhSach {
  don_vi_id: string;
  ho_ten: string;
  ngay_sinh: string | null;
  gioi_tinh: string | null;
  ma_goc: string | null;
  lop: string | null;
  giai_doan: GiaiDoanThamGia;
  ty_le_suat: 1 | 0.5;
  ghi_chu: string | null;
}

/** PATCH: chỉ các trường đã đổi + lý do. */
export type SuaDongDanhSach = Partial<TruongDongDanhSach> & { ly_do: string };
export type ThemDongDanhSach = TruongDongDanhSach & { ly_do: string };

export function suaDongDanhSach(dongId: string, body: SuaDongDanhSach) {
  return apiFetch<DongDanhSach>(`/cong-don-vi/danh-sach-tham-gia/${dongId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function themDongDanhSach(dotId: string, body: ThemDongDanhSach) {
  return apiFetch<DongDanhSach>(url(dotId, 'danh-sach'), { method: 'POST', body: JSON.stringify(body) });
}

/** DELETE kèm body { ly_do }. */
export function xoaDongDanhSach(dongId: string, ly_do: string) {
  return apiFetch<void>(`/cong-don-vi/danh-sach-tham-gia/${dongId}`, {
    method: 'DELETE',
    body: JSON.stringify({ ly_do }),
  });
}

export function xuatExcelDanhSach(dotId: string, donViId?: string) {
  const qs = donViId ? `?${new URLSearchParams({ don_vi_id: donViId })}` : '';
  return apiFetchBlob(url(dotId, `danh-sach/xuat-excel${qs}`));
}

export function useSuaDongDanhSach(dotId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dongId, body }: { dongId: string; body: SuaDongDanhSach }) => suaDongDanhSach(dongId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: danhSachKey(dotId) }),
  });
}

export function useThemDongDanhSach(dotId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ThemDongDanhSach) => themDongDanhSach(dotId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: danhSachKey(dotId) }),
  });
}

export function useXoaDongDanhSach(dotId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dongId, ly_do }: { dongId: string; ly_do: string }) => xoaDongDanhSach(dongId, ly_do),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: danhSachKey(dotId) }),
  });
}
