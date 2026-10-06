import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { TrangLop } from './hoTroGv';
import type { LoaiLop, VaiTroNhanSuLop } from './types';

// ADR 0004 G8 (issue #20): cổng giảng viên (chỉ đọc) — API /cong-giang-vien/*, trang /giang-day.

export type TrangThaiTaiKhoanGv = 'chua_co' | 'chua_kich_hoat' | 'hoat_dong' | 'bi_khoa';

export const NHAN_TAI_KHOAN_GV: Record<TrangThaiTaiKhoanGv, { nhan: string; mau: string }> = {
  chua_co: { nhan: 'Chưa có tài khoản', mau: 'gray' },
  chua_kich_hoat: { nhan: 'Đã gửi link, chưa kích hoạt', mau: 'yellow' },
  hoat_dong: { nhan: 'Tài khoản hoạt động', mau: 'green' },
  bi_khoa: { nhan: 'Tài khoản bị khóa', mau: 'red' },
};

export function trangThaiTaiKhoan(
  tk: { trang_thai: string; phai_doi_mat_khau: boolean } | null | undefined,
): TrangThaiTaiKhoanGv {
  if (!tk) return 'chua_co';
  if (tk.trang_thai !== 'active') return 'bi_khoa';
  return tk.phai_doi_mat_khau ? 'chua_kich_hoat' : 'hoat_dong';
}

export interface BuoiDayCuaToi {
  id: string;
  buoi_so: number;
  thoi_gian_bat_dau: string;
  thoi_gian_ket_thuc: string;
  dia_diem_hoac_link: string | null;
  phong: string | null;
  trang_thai: string;
  vai_tro: VaiTroNhanSuLop | null;
  lop: { id: string; ten_lop: string; loai_lop: LoaiLop; khoa: { id: string; ma_khoa: string; ten_khoa: string } };
  giai_doan: { id: string; thu_tu: number; ten_giai_doan: string; hinh_thuc: string };
  diem_hoc: { ten: string; dia_chi: string; nguoi_lien_he: string | null; sdt_lien_he: string | null } | null;
  giang_vien_khac: { ho_ten: string; vai_tro: VaiTroNhanSuLop }[];
  hau_can: {
    noi_o_ten: string | null;
    noi_o_dia_chi: string | null;
    nhan_phong: string | null;
    tra_phong: string | null;
    phuong_tien: string | null;
    don_luc: string | null;
    diem_don: string | null;
    lien_he_don: string | null;
    ghi_chu: string | null;
  } | null;
  thuc_dia: { ho_ten: string; so_dien_thoai: string; nhiem_vu: string | null }[];
  nhom_ho_tro_gv: { ho_ten: string; email: string | null }[];
}

export function useLichDayCuaToi() {
  return useQuery({
    queryKey: ['cong-gv', 'lich-day'],
    queryFn: () => apiFetch<BuoiDayCuaToi[]>('/cong-giang-vien/lich-day'),
  });
}

export function useTrangLopGiangVien(lopId: string, gdId: string) {
  return useQuery({
    queryKey: ['cong-gv', 'trang-lop', lopId, gdId],
    queryFn: () => apiFetch<TrangLop>(`/cong-giang-vien/lop/${lopId}/giai-doan/${gdId}`),
  });
}

/** Gửi link kích hoạt — Quản trị (/giang-vien) hoặc hỗ trợ GV (/ho-tro-giang-vien/giang-vien, GV trong khóa của nhóm). */
export function useGuiLinkKichHoatGv(khu: 'quan_tri' | 'ho_tro_gv') {
  const qc = useQueryClient();
  const base = khu === 'quan_tri' ? '/giang-vien' : '/ho-tro-giang-vien/giang-vien';
  return useMutation({
    mutationFn: (giangVienId: string) =>
      apiFetch<{ da_gui: true; tao_moi: boolean; email: string }>(`${base}/${giangVienId}/gui-link-kich-hoat`, {
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['giang-vien'] });
      qc.invalidateQueries({ queryKey: ['ho-tro-gv'] });
    },
  });
}

/** Chỉ Quản trị: khóa / mở khóa tài khoản giảng viên. */
export function useDatTrangThaiTaiKhoanGv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ giangVienId, trang_thai }: { giangVienId: string; trang_thai: 'active' | 'ngung' }) =>
      apiFetch(`/giang-vien/${giangVienId}/tai-khoan`, { method: 'PATCH', body: JSON.stringify({ trang_thai }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['giang-vien'] }),
  });
}
