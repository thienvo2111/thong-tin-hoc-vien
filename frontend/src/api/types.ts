// Kiểu dữ liệu dùng chung, theo api-contract.md + mo-rong-nls-an-giang.md (T1, T9, T14, T15)

export interface NguoiDung {
  id: string;
  ten_dang_nhap: string;
  vai_tro: string;
  hoc_vien_id: string | null;
}

export interface DangNhapResponse {
  token: string;
  phai_doi_mat_khau: boolean;
  nguoi_dung: NguoiDung;
}

// GET /auth/toi — hình dạng chính xác không có trong api-contract.md (chỉ ghi "Thông tin tài khoản hiện tại +
// phạm vi quyền suy ra"); giả định tối thiểu cần cho việc khôi phục phiên khi tải lại trang. Flag: improvised.
export interface ThongTinToi {
  nguoi_dung: NguoiDung;
  phai_doi_mat_khau: boolean;
}

export type TrinhDoChuyenMon =
  | 'trung_cap'
  | 'cao_dang'
  | 'dai_hoc'
  | 'thac_si'
  | 'tien_si'
  | 'khac';

export type CapGiangDay = 'mam_non' | 'tieu_hoc' | 'thcs' | 'thpt';

export interface HocVien {
  id: string;
  ma_dinh_danh_moet: string | null;
  so_dinh_danh_ca_nhan: string | null;
  ho_ten: string | null;
  ngay_sinh: number | null;
  thang_sinh: number | null;
  nam_sinh: number | null;
  gioi_tinh: 'nam' | 'nu' | 'khac' | null;
  noi_sinh_id: string | null;
  phuong_xa_id: string | null;
  don_vi_cong_tac_id: string | null;
  chuc_vu: string | null;
  so_dien_thoai_lien_he: string | null;
  email_lien_he: string | null;
  trinh_do_chuyen_mon: TrinhDoChuyenMon | null;
  trinh_do_chuyen_mon_khac: string | null;
  cap_giang_day: CapGiangDay | null;
  mon_giang_day_id: string | null;
  chuyen_mon: string[];
  nguon_tao: 'tu_dang_ky' | 'import_moet';
  trang_thai: 'nhap' | 'cho_duyet' | 'da_duyet' | 'tu_choi';
  // Giả định: hồ sơ trả kèm tên đã join của các id danh mục, để M3/M4/M5 hiển thị tên thay vì id
  // (M5: "tên danh mục thay cho id") mà không cần endpoint lấy-theo-id riêng (không có trong api-contract.md).
  // Improvised — cần backend xác nhận hình dạng response thật.
  noi_sinh_ten?: string;
  phuong_xa_ten?: string;
  don_vi_cong_tac_ten?: string;
  mon_giang_day_ten?: string;
}

export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  fields?: ApiFieldError[];
  khoa_den?: string;
}

export interface DiaDanh {
  id: string;
  ma: string;
  ten: string;
  cap: 'tinh_thanh' | 'phuong_xa_dac_khu';
  parent_id: string | null;
  trang_thai: 'active' | 'ngung';
}

export interface DonViCongTac {
  id: string;
  ma_don_vi: string;
  ten_don_vi: string;
  loai_don_vi: string;
  phuong_xa_id: string | null;
  /** Giả định: API trả kèm tên phường/xã đã join sẵn để hiển thị "Tên trường — Phường/xã" (dac-ta § M4 mục 3).
   *  api-contract.md không ghi rõ hình dạng response này — improvised, cần backend xác nhận. */
  ten_phuong_xa?: string;
  trang_thai: 'active' | 'ngung';
}

export interface MonHoc {
  id: string;
  ten_mon: string;
  cap_hoc: CapGiangDay;
}

export interface DotXacNhan {
  dot: {
    id: string;
    ten: string;
    loai: 'kiem_tra_bo_sung' | 'xac_nhan_truoc_danh_gia';
    mo_luc: string;
    dong_luc: string;
  } | null;
  dot_sap_mo: { ten: string; mo_luc: string } | null;
  da_xac_nhan: boolean;
  xac_nhan_luc: string | null;
  day_du: boolean;
  thieu: ApiFieldError[];
}

export interface MucDoDayDu {
  day_du: boolean;
  thieu: ApiFieldError[];
}

export interface KiemTraTruocXacNhan {
  loi: ApiFieldError[];
  canh_bao: ApiFieldError[];
}

export interface XacNhanResponse {
  xac_nhan_luc: string;
  email_lien_he: string | null;
}

export interface DanhGiaDauVaoDuDieuKien {
  du_dieu_kien: true;
  duong_dan: string;
  ten_dang_nhap_vle: string;
  mat_khau_tam: string | null;
}

export interface DanhGiaDauVaoChuaDu {
  du_dieu_kien: false;
  het_han?: boolean;
  // ly_do là danh sách câu tiếng Việt hoàn chỉnh do backend dựng sẵn (T15,
  // hoc-vien.service.ts#danhGiaDauVaoCuaToi — vd "Chưa xác nhận hồ sơ ở đợt
  // xác nhận trước đánh giá (đợt 2)" hoặc thieu[].message của muc-do-day-du),
  // KHÔNG phải field code — không map qua nhanTruong.ts.
  ly_do?: string[];
  dot?: {
    id: string;
    ten: string;
    loai: 'kiem_tra_bo_sung' | 'xac_nhan_truoc_danh_gia';
    mo_luc: string;
    dong_luc: string;
  } | null;
}

export type DanhGiaDauVao = DanhGiaDauVaoDuDieuKien | DanhGiaDauVaoChuaDu;
