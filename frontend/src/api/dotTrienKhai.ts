import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';

// Issue #56 / ADR 0015 M1, M2, S4, S6, T1, T3 — Quản trị quản lý đợt triển khai trên Cổng đơn vị.
export type ChuongTrinhBoiDuong = 'nls' | 'hsg';

/** Issue #68 / ADR 0015 M1: khóa NLS gắn vào đợt (ngày 'YYYY-MM-DD'). */
export interface KhoaCuaDot {
  id: string;
  ma_khoa: string;
  ten_khoa: string;
  thoi_gian_bat_dau: string;
  thoi_gian_ket_thuc: string;
}

/** Khóa trong phạm vi Sở của đợt cho ô chọn — kèm đợt đang gắn (nếu có). */
export interface KhoaCoTheGan extends KhoaCuaDot {
  trang_thai: string;
  dot_trien_khai_id: string | null;
  dot_trien_khai_ten: string | null;
}

export interface DotTrienKhai {
  id: string;
  chuong_trinh: ChuongTrinhBoiDuong;
  ten: string;
  /** VNĐ, null = chưa có. */
  don_gia: number | null;
  /** 'YYYY-MM-DD' hoặc null (cùng null hoặc cùng có). */
  ngay_qd_tu: string | null;
  ngay_qd_den: string | null;
  /** ISO UTC — 23:59:59 giờ Việt Nam của han_nop_ngay. */
  han_nop: string;
  /** 'YYYY-MM-DD' theo giờ Việt Nam. */
  han_nop_ngay: string;
  so_gddt: { id: string; ten_don_vi: string };
  /** Issue #68: khóa NLS đã gắn (HSG: rỗng). */
  khoa: KhoaCuaDot[];
  created_at: string;
  updated_at: string;
}

export interface TaoDotTrienKhaiDto {
  chuong_trinh: ChuongTrinhBoiDuong;
  ten: string;
  don_gia: number | null;
  ngay_qd_tu: string | null;
  ngay_qd_den: string | null;
  han_nop_ngay: string;
  so_gddt_id: string;
}

/** Chương trình cố định sau khi tạo; đổi han_nop_ngay = gia hạn cả đợt (T3). */
export type SuaDotTrienKhaiDto = Partial<Omit<TaoDotTrienKhaiDto, 'chuong_trinh'>>;

const URL = '/cong-don-vi/dot-trien-khai';
export const dotTrienKhaiKey = ['cong-don-vi', 'dot-trien-khai'] as const;

export function layDanhSachDotTrienKhai() {
  return apiFetch<DotTrienKhai[]>(URL);
}

export function layDotTrienKhai(id: string) {
  return apiFetch<DotTrienKhai>(`${URL}/${id}`);
}

export function taoDotTrienKhai(dto: TaoDotTrienKhaiDto) {
  return apiFetch<DotTrienKhai>(URL, { method: 'POST', body: JSON.stringify(dto) });
}

export function suaDotTrienKhai(id: string, dto: SuaDotTrienKhaiDto) {
  return apiFetch<DotTrienKhai>(`${URL}/${id}`, { method: 'PATCH', body: JSON.stringify(dto) });
}

export function useDanhSachDotTrienKhai() {
  return useQuery({ queryKey: dotTrienKhaiKey, queryFn: layDanhSachDotTrienKhai });
}

export function useTaoDotTrienKhai() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: taoDotTrienKhai,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dotTrienKhaiKey }),
  });
}

export function useSuaDotTrienKhai() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: { id: string } & SuaDotTrienKhaiDto) => suaDotTrienKhai(id, dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dotTrienKhaiKey }),
  });
}

// Issue #68 / ADR 0015 M1: gắn khóa NLS vào đợt (thay trọn tập khóa).
export const khoaCoTheGanKey = (dotId: string) => [...dotTrienKhaiKey, dotId, 'khoa-co-the-gan'] as const;

export function layKhoaCoTheGan(dotId: string) {
  return apiFetch<KhoaCoTheGan[]>(`${URL}/${dotId}/khoa-co-the-gan`);
}

export function ganKhoaDot(dotId: string, khoaIds: string[]) {
  return apiFetch<DotTrienKhai>(`${URL}/${dotId}/khoa`, {
    method: 'PUT',
    body: JSON.stringify({ khoa_ids: khoaIds }),
  });
}

export function useKhoaCoTheGan(dotId: string | null) {
  return useQuery({
    queryKey: khoaCoTheGanKey(dotId ?? ''),
    queryFn: () => layKhoaCoTheGan(dotId as string),
    enabled: !!dotId,
  });
}

export function useGanKhoaDot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dotId, khoaIds }: { dotId: string; khoaIds: string[] }) => ganKhoaDot(dotId, khoaIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dotTrienKhaiKey }),
  });
}
