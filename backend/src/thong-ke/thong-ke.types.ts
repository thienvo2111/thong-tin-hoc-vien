import { Prisma } from '@prisma/client';

export interface PhamViThongKe {
  /** Phạm vi ∩ bộ lọc, dùng trực tiếp cho truy vấn dang_ky_hoc. */
  where: Prisma.dang_ky_hocWhereInput;
  /** true → trả kết quả rỗng, không truy vấn. */
  rong: boolean;
  /** Khóa nằm trong where (sau lọc). */
  khoaIds: string[] | 'ALL';
}

export interface BoLocResult {
  khoa: { id: string; ten_khoa: string }[];
  /** null = không hiện ô đơn vị. */
  don_vi: { id: string; ten_don_vi: string; loai_don_vi: string }[] | null;
  /** null = không hiện ô cụm. */
  cum: { id: string; ten_cum: string; khoa_id: string }[] | null;
  /** Đơn vị cố định của vai trò truong. */
  don_vi_co_dinh: { id: string; ten_don_vi: string } | null;
}

export interface PheuCounts {
  tham_gia: number;
  da_truy_cap: number;
  khao_sat_ky_nang_so: number;
  danh_gia_dau_vao: number;
  danh_gia_dau_ra: number;
}

export interface PheuResult extends PheuCounts {
  /** null nếu vai trò không duyệt hồ sơ (ho_tro_hoc_vien). */
  ho_so_cho_duyet: number | null;
}

export interface MucDem {
  ma: string;
  nhan: string;
  so_luong: number;
}

interface KhoiMuc {
  theo_muc: MucDem[];
  chua_xep_muc: number;
  chua_lam: number;
}

export interface KhaoSatResult {
  ky_nang_so: { hoan_thanh: number; chua: number };
  dau_vao: KhoiMuc;
  dau_ra: KhoiMuc;
}

export interface ChuyenMucResult {
  thang: { ma: string; nhan: string }[];
  /** Mọi cặp thang×thang, kể cả 0. */
  o: { tu: string; den: string; so_luong: number }[];
  tong: number;
  tang: number;
  giu: number;
  giam: number;
}

export interface KetQuaHocCot {
  khoa_id: string;
  ten_khoa: string;
  dat: number;
  khong_dat: number;
  vang: number;
  dang_hoc: number;
}

export interface KetQuaHocTruongDong {
  don_vi_id: string;
  ten_don_vi: string;
  dat: number;
  khong_dat: number;
  vang: number;
  dang_hoc: number;
}

export interface SoSanhKhoaCot {
  khoa_id: string;
  ten_khoa: string;
  tham_gia: number;
  ty_le_truy_cap: number | null;
  ty_le_dau_vao: number | null;
  ty_le_dat: number | null;
}

export interface BuoiChuyenCan {
  nhan: string;
  giai_doan_thu_tu: number;
  buoi_so: number;
  co_mat: number;
  vang_co_phep: number;
  vang: number;
  /** 0..1; null khi chưa có điểm danh nào. */
  ty_le_co_mat: number | null;
}

export type KhoangVle = '0-25' | '25-50' | '50-75' | '75-100';

export interface VleKhoang {
  khoang: KhoangVle;
  so_luong: number;
}

export interface ChuyenCanResult {
  /** null khi không chọn khóa. */
  truc_tiep: BuoiChuyenCan[] | null;
  vle: { khoang: VleKhoang[]; chua_co_du_lieu: number };
}

export interface XepHangDong {
  don_vi_id: string;
  ten_don_vi: string;
  so_hv: number;
  /** 0..1 */
  gia_tri: number;
}

export type XepHangResult =
  | { kieu: 'bang'; top: XepHangDong[]; bottom: XepHangDong[]; tong_so: number }
  | {
      kieu: 'vi_tri';
      thu_hang: number | null;
      tong_so: number;
      gia_tri: number | null;
      trung_binh: number | null;
    };

export interface CanDonDocDong {
  hoc_vien_id: string;
  ho_ten: string;
  ten_don_vi: string;
  ten_khoa: string;
  so_dien_thoai: string | null;
  email: string | null;
  /** "Vắng 3 buổi", "VLE 42%" hoặc '' */
  chi_tiet: string;
}

export interface CanDonDocResult {
  tong: number;
  page: number;
  items: CanDonDocDong[];
}

export interface TienDoTruongDong {
  don_vi_id: string;
  ten_don_vi: string;
  /** Tên đơn vị cha trực tiếp (Sở/Phòng), null nếu không có. */
  ten_don_vi_cha: string | null;
  so_hv: number;
  so_truy_cap: number;
  ty_le_truy_cap: number | null;
  so_ky_nang_so: number;
  ty_le_ky_nang_so: number | null;
  so_dau_vao: number;
  ty_le_dau_vao: number | null;
  so_dau_ra: number;
  ty_le_dau_ra: number | null;
  /** Mẫu số của ty_le_co_mat (số dòng điểm danh). */
  so_luot_diem_danh: number;
  so_luot_co_mat: number;
  ty_le_co_mat: number | null;
  /** Mẫu số của ty_le_vle_dat (HV có dữ liệu VLE). */
  so_hv_co_vle: number;
  so_hv_vle_dat: number;
  ty_le_vle_dat: number | null;
  /** Mẫu số của ty_le_dat (lượt đăng ký). */
  so_dang_ky: number;
  so_dat: number;
  ty_le_dat: number | null;
}

// Biểu mẫu "Thống kê đăng ký và truy cập hệ thống".
export const DOI_TUONG_BIEU_MAU = [
  'giao_vien',
  'can_bo_quan_ly',
  'nhan_vien',
  'chua_xac_dinh',
] as const;
export type DoiTuongKey = (typeof DOI_TUONG_BIEU_MAU)[number];

export const CAP_BIEU_MAU = [
  'mam_non',
  'tieu_hoc',
  'thcs',
  'thpt',
  'trung_cap_nghe',
  'chua_xac_dinh',
] as const;
export type CapKey = (typeof CAP_BIEU_MAU)[number];

/** dk = số HV phân biệt đăng ký; tc = trong số đó đã truy cập hệ thống. */
export interface DemDkTc {
  dk: number;
  tc: number;
}

export interface DongHocVienBieuMau {
  hoc_vien_id: string;
  doi_tuong: string | null;
  cap_giang_day: string | null;
  don_vi_id: string;
  ten_don_vi: string;
  ten_don_vi_cha: string | null;
  da_truy_cap: boolean;
}

export interface DongTruongBieuMau {
  don_vi_id: string;
  ten_don_vi: string;
  ten_don_vi_cha: string | null;
  tong: DemDkTc;
  theo_doi_tuong: Record<DoiTuongKey, DemDkTc>;
  theo_cap: Record<CapKey, DemDkTc>;
}

export interface BieuMauDangKyTruyCap {
  tong: DemDkTc;
  ma_tran: Record<DoiTuongKey, Record<CapKey, DemDkTc>>;
  theo_truong: DongTruongBieuMau[];
}

export interface MoTaBieuMau {
  khoa: string;
  pham_vi: string;
  doi_tuong: string;
  ngay_xuat: Date;
}
