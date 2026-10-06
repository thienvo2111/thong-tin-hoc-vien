import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { LoaiLop, TrangThaiActive, VaiTroNhanSuLop } from './types';

// Khu người hỗ trợ giảng viên (ADR 0004) — API /ho-tro-giang-vien/*, backend tự lọc theo nhóm của khóa.
export interface LopCuaToiGv {
  id: string;
  ten_lop: string;
  loai_lop: LoaiLop;
  trang_thai: TrangThaiActive;
  khoa: { id: string; ma_khoa: string; ten_khoa: string };
  _count: { lich_hoc: number };
}

export interface DotCuaLop {
  lop: { id: string; ten_lop: string; loai_lop: LoaiLop; khoa: { id: string; ma_khoa: string; ten_khoa: string } };
  dot: { id: string; thu_tu: number; ten_giai_doan: string; thoi_gian_bat_dau: string; thoi_gian_ket_thuc: string; so_buoi: number }[];
}

// Trang lớp (ADR 0004 G9) — tập trường đã lọc theo vai trò ở backend.
export interface GiangVienBuoiTrangLop {
  id: string;
  ho_ten: string;
  vai_tro: VaiTroNhanSuLop;
  so_dien_thoai?: string;
  email?: string | null;
  so_gio?: number | null;
  da_xac_nhan_gio?: boolean;
  /** ADR 0004 G8 (issue #20) — không có ở trang lớp của giảng viên. */
  tai_khoan?: import('./congGiangVien').TrangThaiTaiKhoanGv;
}

export interface TrangLop {
  lop: { id: string; ten_lop: string; loai_lop: LoaiLop; si_so_toi_da: number | null; khoa: { id: string; ma_khoa: string; ten_khoa: string } };
  giai_doan: { id: string; thu_tu: number; ten_giai_doan: string; hinh_thuc: string; thoi_gian_bat_dau: string; thoi_gian_ket_thuc: string };
  buoi: {
    id: string;
    buoi_so: number;
    thoi_gian_bat_dau: string;
    thoi_gian_ket_thuc: string;
    dia_diem_hoac_link: string | null;
    phong: string | null;
    trang_thai: string;
    diem_hoc: {
      id: string;
      ma_diem_hoc: string;
      ten: string;
      dia_chi: string;
      nguoi_lien_he: string | null;
      sdt_lien_he: string | null;
      so_phong: number | null;
      ghi_chu_csvc: string | null;
    } | null;
    giang_vien: GiangVienBuoiTrangLop[];
  }[];
  hoc_vien: {
    dang_ky_hoc_id: string;
    hoc_vien_id: string;
    ho_ten: string;
    gioi_tinh: string | null;
    don_vi: string;
    doi_tuong: string | null;
    chuc_vu: string | null;
    muc_dau_vao: string | null;
    so_dien_thoai?: string | null;
    email?: string | null;
    cum?: { id: string; ten_cum: string; nguoi_ho_tro: { ho_ten: string; email: string | null }[] } | null;
    diem_danh: Record<string, string>;
    /** ADR 0004 G13 (issue #18): lich_hoc_id → lý do báo vắng. */
    bao_vang?: Record<string, string>;
    ket_qua: { ty_le_hoan_thanh: number | null; diem: number | null } | null;
  }[];
  // ADR 0004 G14 (issue #18): đề nghị đổi lớp đang chờ, ra hoặc vào lớp này.
  de_nghi_cho?: {
    id: string;
    ho_ten: string;
    chieu: 'ra' | 'vao';
    tu_lop: string | null;
    den_lop: string;
    ly_do: string;
    tao_luc: string;
  }[];
  nhom_ho_tro_gv: { ho_ten: string; email: string | null }[];
  // ADR 0004 L3 (issue #16): hậu cần giảng viên + thực địa của đợt.
  hau_can: HauCanGiangVien[];
  thuc_dia: ThucDia[];
}

export interface HauCanGiangVien {
  id: string;
  giang_vien_id: string;
  noi_o_ten: string | null;
  noi_o_dia_chi: string | null;
  nhan_phong: string | null;
  tra_phong: string | null;
  phuong_tien: string | null;
  don_luc: string | null;
  diem_don: string | null;
  lien_he_don: string | null;
  ghi_chu: string | null;
  da_xac_nhan_noi_o: boolean;
  da_xac_nhan_di_chuyen: boolean;
  cap_nhat_luc: string;
  nguoi_sua: string | null;
}

export interface ThucDia {
  id?: string;
  ho_ten: string;
  so_dien_thoai: string;
  nhiem_vu: string | null;
  ghi_chu?: string | null;
}

export type LuuHauCanDto = Partial<Omit<HauCanGiangVien, 'id' | 'giang_vien_id' | 'nguoi_sua' | 'cap_nhat_luc'>> & {
  cap_nhat_luc?: string;
};

export interface SuaBuoiGvDto {
  thoi_gian_bat_dau?: string;
  thoi_gian_ket_thuc?: string;
  diem_hoc_id?: string;
  phong?: string | null;
  ly_do: string;
}

export interface BuoiLichDay {
  id: string;
  buoi_so: number;
  thoi_gian_bat_dau: string;
  thoi_gian_ket_thuc: string;
  dia_diem_hoac_link: string | null;
  phong: string | null;
  lop: { id: string; ten_lop: string; loai_lop: LoaiLop; khoa: { id: string; ma_khoa: string } };
  giai_doan: { id: string; ten_giai_doan: string; hinh_thuc: string };
  diem_hoc: { id: string; ten: string; dia_chi: string } | null;
  phan_cong: { vai_tro: VaiTroNhanSuLop; giang_vien: { id: string; ho_ten: string } }[];
}

export function useLopCuaToiGv() {
  return useQuery({
    queryKey: ['ho-tro-gv', 'lop-cua-toi'],
    queryFn: () => apiFetch<LopCuaToiGv[]>('/ho-tro-giang-vien/lop-cua-toi'),
  });
}

export function useDotCuaLop(lopId: string) {
  return useQuery({
    queryKey: ['ho-tro-gv', 'dot', lopId],
    queryFn: () => apiFetch<DotCuaLop>(`/ho-tro-giang-vien/lop/${lopId}/dot`),
  });
}

export function useTrangLopGv(lopId: string, gdId: string) {
  return useQuery({
    queryKey: ['ho-tro-gv', 'trang-lop', lopId, gdId],
    queryFn: () => apiFetch<TrangLop>(`/ho-tro-giang-vien/lop/${lopId}/giai-doan/${gdId}`),
  });
}

export function useLichDayGv(params: { tu_ngay?: string; den_ngay?: string }) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => !!v) as [string, string][]).toString();
  return useQuery({
    queryKey: ['ho-tro-gv', 'lich-day', params],
    queryFn: () => apiFetch<BuoiLichDay[]>(`/ho-tro-giang-vien/lich-day${qs ? `?${qs}` : ''}`),
  });
}

function useLamMoiGv() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['ho-tro-gv'] });
}

export function useSuaBuoiGv() {
  const lamMoi = useLamMoiGv();
  return useMutation({
    mutationFn: ({ lichHocId, dto }: { lichHocId: string; dto: SuaBuoiGvDto }) =>
      apiFetch<{ canh_bao?: string[] }>(`/ho-tro-giang-vien/lich-hoc/${lichHocId}`, { method: 'PATCH', body: JSON.stringify(dto) }),
    onSuccess: lamMoi,
  });
}

export function useLuuHauCan(lopId: string, gdId: string) {
  const lamMoi = useLamMoiGv();
  return useMutation({
    mutationFn: ({ giangVienId, dto }: { giangVienId: string; dto: LuuHauCanDto }) =>
      apiFetch<HauCanGiangVien>(`/ho-tro-giang-vien/lop/${lopId}/giai-doan/${gdId}/hau-can/${giangVienId}`, {
        method: 'PUT',
        body: JSON.stringify(dto),
      }),
    onSettled: lamMoi,
  });
}

export function useThayThucDia(lopId: string, gdId: string) {
  const lamMoi = useLamMoiGv();
  return useMutation({
    mutationFn: (nhan_su: { ho_ten: string; so_dien_thoai: string; nhiem_vu?: string }[]) =>
      apiFetch<ThucDia[]>(`/ho-tro-giang-vien/lop/${lopId}/giai-doan/${gdId}/thuc-dia`, {
        method: 'PUT',
        body: JSON.stringify({ nhan_su }),
      }),
    onSuccess: lamMoi,
  });
}
