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
  don_vi_dat_hang: string;
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

// T14 (mo-rong-nls-an-giang.md) — GET /bao-cao/xac-nhan.
export const TRANG_THAI_XAC_NHAN = [
  'chua_dang_nhap',
  'dang_bo_sung',
  'da_xac_nhan',
] as const;
export type TrangThaiXacNhan = (typeof TRANG_THAI_XAC_NHAN)[number];

export interface XacNhanRow {
  hoc_vien_id: string;
  ho_ten: string;
  ma_dinh_danh_moet: string | null;
  don_vi_cong_tac_ten: string;
  dang_nhap_lan_cuoi: Date | null;
  trang_thai: TrangThaiXacNhan;
}

// T14 — GET /bao-cao/sua-truong-moet.
export interface SuaTruongMoetRow {
  id: string;
  hoc_vien_id: string;
  ho_ten_hoc_vien: string;
  ma_dinh_danh_moet: string | null;
  truong: string;
  gia_tri_cu: string | null;
  gia_tri_moi: string | null;
  nguoi_sua: string;
  vai_tro_nguoi_sua: string;
  sua_luc: Date;
}

// T15 (mo-rong-nls-an-giang.md) — GET /bao-cao/xuat-cho-vle,
// GET /bao-cao/dieu-kien-danh-gia.
export interface XuatChoVleRow {
  ma_dinh_danh_moet: string | null;
  ho_ten: string;
  email: string | null;
  don_vi: string;
  trang_thai_dot_1: 'da_xac_nhan' | 'chua_xac_nhan';
}

export interface DieuKienDanhGiaRow {
  hoc_vien_id: string;
  ho_ten: string;
  ma_dinh_danh_moet: string | null;
  don_vi_cong_tac_ten: string;
  du_dieu_kien: boolean;
  ly_do: string[];
  da_xem_vle: boolean;
}

// T7 (mo-rong-nls-an-giang.md) — GET /bao-cao/van-hanh. muc_nang_luc dùng
// chung với lop_hoc.muc_nang_luc/dang_ky_hoc.muc_dau_vao (T5/T6) — thêm
// KHONG_XAC_DINH cho các dòng NULL (chưa có kết quả đánh giá đầu vào).
export const MUC_NANG_LUC = ['co_ban', 'thanh_thao', 'nang_cao'] as const;

export interface VanHanhRow {
  lop_id: string;
  ten_lop: string;
  nhom_hoc_vien: number | null;
  muc_nang_luc: string | null;
  si_so: number;
  so_co_email: number;
  so_ho_so_day_du: number;
  theo_muc_dau_vao: Record<string, number>;
}

export interface VanHanhTong {
  si_so: number;
  so_co_email: number;
  so_ho_so_day_du: number;
  theo_muc_dau_vao: Record<string, number>;
}

export interface VanHanhResult {
  khoa_id: string | null;
  rows: VanHanhRow[];
  tong: VanHanhTong;
}

// -----------------------------------------------------------------------
// Dashboard "Tổng quan hệ thống" (thêm 2026-09-30) — GET /bao-cao/tong-quan.
// Xem BaoCaoService.tongQuan cho định nghĩa từng số liệu.
// -----------------------------------------------------------------------

// Sửa 2026-10-07: mức dùng `muc_goc` (thang quản trị cấu hình, xem
// ThangMucService) thay cho `muc` — hệ thống khảo sát chỉ gửi muc_goc, cổng
// không tự quy đổi (quyết định 2026-10-05).
export interface KhaoSatMucRow {
  da_lam: number;
  theo_muc: { ma: string; nhan: string; so_luong: number }[];
  /** Đã hoàn thành bài nhưng hệ thống khảo sát chưa báo mức. */
  chua_xep_muc: number;
}

// Sửa 2026-10-07: thay "Kết quả học theo hình thức" (dang_ky_hoc_lop, đã bỏ)
// bằng tình hình tham gia học THEO ĐIỂM DANH (diem_danh), nhóm theo giai đoạn.
export interface ThamGiaHocRow {
  giai_doan_id: string;
  ma_khoa: string;
  thu_tu: number;
  ten_giai_doan: string;
  /** Số buổi (lich_hoc_lop) đã có ít nhất 1 lượt điểm danh. */
  so_buoi: number;
  co_mat: number;
  vang_co_phep: number;
  vang: number;
}

export interface TongQuanResult {
  tong_hoc_vien_tham_gia: number;
  da_dang_nhap: number;
  da_chinh_sua_ho_so: number;
  khao_sat: {
    dau_vao: KhaoSatMucRow;
    dau_ra: KhaoSatMucRow;
  };
  tham_gia_hoc: ThamGiaHocRow[];
}
