import { BaoCaoTheo } from './dto/tong-hop-query.dto';

// Enum sets dùng để khởi tạo đếm 0 cho mọi giá trị — kể cả giá trị không xuất
// hiện trong dữ liệu — để FE không phải tự xử lý field thiếu.
export const TRANG_THAI_HO_SO = [
  'nhap',
  'cho_duyet',
  'da_duyet',
  'tu_choi',
  'loi',
] as const;
export const CAP_GIANG_DAY = ['mam_non', 'tieu_hoc', 'thcs', 'thpt'] as const;
export const KHONG_XAC_DINH = 'khong_xac_dinh';
export const TRANG_THAI_DANG_KY = [
  'cho_duyet',
  'da_duyet',
  'tu_choi',
  'da_phan_lop',
] as const;
export const KET_QUA_HOC = ['dang_hoc', 'dat', 'khong_dat', 'vang'] as const;
export const CHUA_CO_KET_QUA = 'chua_co_ket_qua';

export type DemTheoTrangThai = Record<string, number>;
export type DemTheoCapGiangDay = Record<string, number>;

export interface TongHopDonViRow {
  don_vi_id: string;
  ten_don_vi: string;
  tong_so: number;
  theo_trang_thai: DemTheoTrangThai;
  theo_cap_giang_day: DemTheoCapGiangDay;
}

export interface TongHopDiaBanRow {
  dia_ban_id: string;
  ten_dia_ban: string;
  tong_so: number;
  theo_trang_thai: DemTheoTrangThai;
  theo_cap_giang_day: DemTheoCapGiangDay;
}

export interface TongHopKhoaRow {
  khoa_id: string;
  ma_khoa: string;
  ten_khoa: string;
  don_vi_to_chuc: string;
  trang_thai_khoa: string;
  tong_dang_ky: number;
  theo_trang_thai_dang_ky: Record<string, number>;
  theo_ket_qua: Record<string, number>;
}

export type TongHopRow = TongHopDonViRow | TongHopDiaBanRow | TongHopKhoaRow;

export interface TongHopResult {
  theo: BaoCaoTheo;
  tu_ngay: string | null;
  den_ngay: string | null;
  rows: TongHopRow[];
}
