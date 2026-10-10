import { Prisma, doi_tuong_hoc_vien, muc_nang_luc } from '@prisma/client';
import type { NguonMucDanhGia } from '../khoa-boi-duong/util/muc-hoc.util';

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
  /** tham_gia trừ nhân viên — mẫu số đúng cho 3 tỷ lệ khảo sát dưới đây
   * (nhân viên chưa triển khai khảo sát, xem doi-tuong-khao-sat.util.ts). */
  tham_gia_khao_sat: number;
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
  /** Mẫu số của ty_le_ky_nang_so/dau_vao/dau_ra: so_hv trừ nhân viên (chưa
   * triển khai khảo sát — xem doi-tuong-khao-sat.util.ts). */
  so_hv_khao_sat: number;
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

/** Hồ sơ học viên: số HV phân biệt thiếu từng mục; tỷ lệ 0..1, mẫu 0 -> null. */
export interface DemChatLuongHoSo {
  so_hv: number;
  thieu_doi_tuong: number;
  thieu_cap: number;
  thieu_email: number;
  thieu_sdt: number;
  du_ho_so: number;
  ty_le_du: number | null;
}

export interface ChatLuongHoSoDong extends DemChatLuongHoSo {
  don_vi_id: string;
  ten_don_vi: string;
  ten_don_vi_cha: string | null;
}

export interface ChatLuongHoSoResult {
  tong: DemChatLuongHoSo;
  /** Sắp theo ten_don_vi (vi). */
  theo_truong: ChatLuongHoSoDong[];
}

/** Một HV đã khử trùng, dùng cho tổng hợp và sheet "Cần bổ sung". */
export interface DongHoSoHocVien {
  hoc_vien_id: string;
  ho_ten: string;
  doi_tuong: string | null;
  cap_giang_day: string | null;
  email: string | null;
  so_dien_thoai: string | null;
  don_vi_id: string;
  ten_don_vi: string;
  ten_don_vi_cha: string | null;
}

// Báo cáo "Đánh giá NLS theo mức". Mẫu số: % mức/chưa xếp mức theo đã làm; % đã làm/chưa làm theo số HV.
export type LoaiMucNls = 'dau_vao' | 'dau_ra';

export interface DemMucNls {
  so_hv: number;
  da_lam: number;
  chua_lam: number;
  theo_muc: { ma: string; nhan: string; so_luong: number }[];
  chua_xep_muc: number;
}

export interface MucNlsTruongDong extends DemMucNls {
  don_vi_id: string;
  ten_don_vi: string;
  ten_don_vi_cha: string | null;
}

export interface MucNlsResult {
  loai: LoaiMucNls;
  thang: { ma: string; nhan: string }[];
  tong: DemMucNls;
  /** Sắp theo ten_don_vi (vi). */
  theo_truong: MucNlsTruongDong[];
}

/** Một HV đã khử trùng. ho_ten chỉ có khi xuất Excel (còn lại ''). */
export interface DongHocVienMuc {
  hoc_vien_id: string;
  ho_ten: string;
  doi_tuong: string | null;
  cap_giang_day: string | null;
  don_vi_id: string;
  ten_don_vi: string;
  ten_don_vi_cha: string | null;
  da_lam: boolean;
  muc_goc: string | null;
  hoan_thanh_luc: Date | null;
}

export interface MucNlsTongHop extends Omit<MucNlsResult, 'loai'> {
  theo_doi_tuong: Record<DoiTuongKey, DemMucNls>;
  theo_cap: Record<CapKey, DemMucNls>;
}

/**
 * "Nhu cầu mức học" (2026-10-09) — khác thang với khảo sát NLS (M1..M4): mức đánh giá làm
 * mốc = dang_ky_hoc.muc_dau_vao (admin chốt) ?? mức quy đổi từ bài khảo sát NLS đầu vào ĐÃ
 * hoàn thành (xem muc-hoc.util.ts#mucDanhGiaLamMoc), và muc_hoc_chon (học viên tự chọn mức
 * thấp hơn hoặc bằng mốc, xem muc-hoc.util.ts#mucHocHieuLuc). muc_hoc_chon gắn với TỪNG khóa
 * (dang_ky_hoc), không phải học viên — đếm theo lượt đăng ký, không khử trùng HV.
 */
export interface NhuCauMucHocTheoMuc {
  muc: muc_nang_luc;
  nhan: string;
  theo_danh_gia: number;
  theo_nhu_cau: number;
}

export interface NhuCauMucHocResult {
  /** Tổng lượt đăng ký trong phạm vi. */
  so_dang_ky: number;
  /** Không có mức đánh giá làm mốc (chưa chốt và chưa hoàn thành khảo sát đầu vào). */
  chua_co_muc: number;
  /** muc_hoc_chon khác null và khác mức đánh giá làm mốc. */
  da_dieu_chinh: number;
  /** Trong số có mức đánh giá, mốc lấy từ bài khảo sát (chưa chốt muc_dau_vao). */
  moc_tu_khao_sat: number;
  /** Luôn đủ 3 dòng, thứ tự co_ban, thanh_thao, nang_cao; loại trừ chua_co_muc. */
  theo_muc: NhuCauMucHocTheoMuc[];
  /** Chỉ các cặp có so_luong > 0; sắp theo tu giảm dần rồi den giảm dần (theo thứ tự mức). */
  dieu_chinh: { tu: muc_nang_luc; den: muc_nang_luc; so_luong: number }[];
  /** Sắp theo ten_don_vi (vi). */
  theo_truong: NhuCauMucHocTruongDong[];
  /** 2026-10-10: số lượt đăng ký của nhân viên (không xếp lớp đợt này) đã loại khỏi mọi đếm trên. */
  so_nhan_vien_loai_tru: number;
}

export interface NhuCauMucHocTruongDong {
  don_vi_id: string;
  ten_don_vi: string;
  ten_don_vi_cha: string | null;
  so_dang_ky: number;
  chua_co_muc: number;
  da_dieu_chinh: number;
  moc_tu_khao_sat: number;
  theo_muc: NhuCauMucHocTheoMuc[];
  /** Xem NhuCauMucHocResult.so_nhan_vien_loai_tru, tính riêng cho trường này. */
  so_nhan_vien_loai_tru: number;
}

/** Một lượt đăng ký (dang_ky_hoc) — nguồn cho tongHopNhuCauMucHoc. ho_ten/ma_dinh_danh_moet/
 * ma_khoa/ten_khoa chỉ có khi xuất Excel (còn lại rỗng). */
export interface DongDangKyNhuCauMuc {
  /** Mức đánh giá làm mốc — xem mucDanhGiaLamMoc. */
  muc_danh_gia: muc_nang_luc | null;
  /** Nguồn của muc_danh_gia: 'chot' = muc_dau_vao đã chốt, 'khao_sat' = quy đổi từ khảo sát. */
  nguon_muc: NguonMucDanhGia | null;
  muc_hoc_chon: muc_nang_luc | null;
  muc_hoc_chon_luc: Date | null;
  don_vi_id: string;
  ten_don_vi: string;
  ten_don_vi_cha: string | null;
  ho_ten: string;
  ma_dinh_danh_moet: string | null;
  ma_khoa: string;
  ten_khoa: string;
  /** 2026-10-10: nhan_vien -> loại khỏi mọi đếm (xem doi-tuong-khao-sat.util.ts#phaiXepLop). */
  doi_tuong: doi_tuong_hoc_vien | null;
}
