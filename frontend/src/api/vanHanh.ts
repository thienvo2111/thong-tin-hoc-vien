import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client';

// ADR 0004 G15 (issue #22): màn giám sát vận hành của Quản trị — chỉ đọc.

export interface VanHanh {
  dot_do: {
    lop: { id: string; ten_lop: string; khoa: { id: string; ma_khoa: string; ten_khoa: string } };
    giai_doan: { id: string; thu_tu: number; ten_giai_doan: string };
    buoi_dau: string | null;
    so_qua_han: number;
    muc_qua_han: string[];
    nhom_ho_tro_gv: string[];
  }[];
  de_nghi_cho_lau: {
    id: string;
    tao_luc: string;
    ly_do: string;
    hoc_vien: { id: string; ho_ten: string };
    tu_lop: string | null;
    den_lop: string;
    khoa: { id: string; ma_khoa: string };
    nguoi_tao: string | null;
  }[];
  thay_doi_lich: {
    id: string;
    thoi_gian: string;
    nguoi: string | null;
    vai_tro: string | null;
    mo_ta: string | null;
    ly_do: string | null;
    truoc: Record<string, string | null> | null;
    sau: Record<string, string | null> | null;
    lop: { id: string; ten_lop: string; khoa: { id: string; ma_khoa: string } } | null;
    giai_doan_id: string | null;
  }[];
  khoa_chua_nhom_gv: { id: string; ma_khoa: string; ten_khoa: string; thoi_gian_bat_dau: string }[];
  cum_chua_ho_tro: { id: string; ten_cum: string; khoa: { id: string; ma_khoa: string }; so_hoc_vien: number }[];
  danh_muc_moi: {
    diem_hoc: { id: string; ma_diem_hoc: string; ten: string; dia_chi: string; created_at: string; nguoi_tao: string | null }[];
    giang_vien: { id: string; ho_ten: string; so_dien_thoai: string; email: string | null; created_at: string; nguoi_tao: string | null }[];
  };
}

export function useVanHanh() {
  return useQuery({
    queryKey: ['van-hanh'],
    queryFn: () => apiFetch<VanHanh>('/van-hanh'),
  });
}
