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

// GET /hoc-vien (danh sách quản trị) hỗ trợ phân trang server-side thật (page, page_size)
// — xác nhận trong backend/src/common/dto/pagination-query.dto.ts + hoc-vien.service.ts#findAll,
// KHÔNG có trong api-contract.md (chỉ ghi query lọc, không ghi phân trang). Flag: improvised.
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
}

// Hàng của GET /hoc-vien (danh sách) là bản ghi hoc_vien thô, KHÔNG kèm chuyen_mon hay các *_ten đã
// join (khác với GET /hoc-vien/toi và GET /hoc-vien/{id} — xem hoc-vien.service.ts#findAll: không
// include quan hệ nào, chỉ findMany({where, skip, take})). Không bịa thêm field không có ở đây.
export type HocVienDanhSachItem = Omit<
  HocVien,
  'chuyen_mon' | 'noi_sinh_ten' | 'phuong_xa_ten' | 'don_vi_cong_tac_ten' | 'mon_giang_day_ten'
>;

export type BaoCaoTheo = 'don_vi' | 'dia_ban' | 'khoa';

// GET /bao-cao/tong-hop?theo=don_vi — hình dạng lấy từ backend/src/bao-cao/bao-cao.types.ts
// (TongHopDonViRow), không ghi chi tiết trong api-contract.md. Flag: improvised. FE hiện chỉ dùng
// theo=don_vi (Tổng quan) nên chỉ khai báo shape của theo=don_vi, không khai báo theo=dia_ban/khoa.
export interface TongHopDonViRow {
  don_vi_id: string;
  ten_don_vi: string;
  tong_so: number;
  theo_trang_thai: Record<string, number>;
  theo_cap_giang_day: Record<string, number>;
}

export interface TongHopResult {
  theo: BaoCaoTheo;
  tu_ngay: string | null;
  den_ngay: string | null;
  rows: TongHopDonViRow[];
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

// Phase 4 redesign — module Khóa bồi dưỡng (Admin), docs/api-contract.md mục 3 + database-ddl.sql
// (CREATE TABLE khoa_boi_duong/giai_doan_khoa/lop_hoc). GET /khoa-boi-duong trả bản ghi thô (không
// join tên đơn vị), giống HocVienDanhSachItem — FE tự dựng map id->tên qua GET /danh-muc/don-vi-cong-tac.
export type TrangThaiKhoa = 'nhap' | 'cho_duyet' | 'da_duyet' | 'tu_choi' | 'dong_dang_ky';

export interface KhoaBoiDuong {
  id: string;
  ma_khoa: string;
  ten_khoa: string;
  don_vi_to_chuc_id: string;
  dia_diem: string | null;
  thoi_gian_bat_dau: string;
  thoi_gian_ket_thuc: string;
  trang_thai: TrangThaiKhoa;
  nguoi_duyet_id: string | null;
  cap_duyet_thuc_te: string | null;
  ngay_duyet: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface GiaiDoanKhoa {
  id: string;
  khoa_id: string;
  thu_tu: number;
  ten_giai_doan: string;
  hinh_thuc: string;
  thoi_gian_bat_dau: string;
  thoi_gian_ket_thuc: string;
  trang_thai: string;
}

export interface NhanSuLop {
  id: string;
  lop_id: string;
  ho_ten: string;
  vai_tro: string;
  so_dien_thoai: string | null;
}

export interface LichHocLop {
  id: string;
  lop_id: string;
  giai_doan_id: string;
  buoi_so: number;
  thoi_gian_bat_dau: string;
  thoi_gian_ket_thuc: string;
  dia_diem_hoac_link: string | null;
  giai_doan?: GiaiDoanKhoa;
}

export interface LopHoc {
  id: string;
  khoa_id: string;
  ten_lop: string;
  si_so_toi_da: number | null;
  trang_thai: string;
  nhom_hoc_vien: number | null;
  muc_nang_luc: string | null;
  nhan_su?: NhanSuLop[];
  lich_hoc?: LichHocLop[];
}

// GET /khoa-boi-duong/{id} — "Chi tiết khóa kèm giai đoạn + lớp" (api-contract.md mục 3), hình dạng
// lấy từ backend/src/khoa-boi-duong/khoa-boi-duong.service.ts#findOne (include giai_doan, lop_hoc
// kèm nhan_su + lich_hoc.giai_doan) chứ không có trong api-contract.md — improvised, đúng theo code.
export interface KhoaBoiDuongChiTiet extends KhoaBoiDuong {
  giai_doan: GiaiDoanKhoa[];
  lop_hoc: LopHoc[];
}

// Body POST /khoa-boi-duong — backend/src/khoa-boi-duong/dto/create-khoa-boi-duong.dto.ts.
// don_vi_to_chuc_id: bỏ qua nếu caller là truong (suy ra từ tài khoản), bắt buộc nếu quan_tri.
export interface TaoKhoaBoiDuongDto {
  ma_khoa: string;
  ten_khoa: string;
  dia_diem?: string;
  thoi_gian_bat_dau: string;
  thoi_gian_ket_thuc: string;
  don_vi_to_chuc_id?: string;
}

// Phase 5 redesign — Trung tâm báo cáo (docs/api-contract.md mục 7 + mục "Đợt xác nhận" mục 2). Hàng
// dữ liệu của bao-cao/xac-nhan, sua-truong-moet, dieu-kien-danh-gia, van-hanh KHÔNG có shape cụ thể
// trong api-contract.md (chỉ tong-hop có, xem TongHopDonViRow) — dùng kiểu hàng động, hiển thị đúng
// key/value thật trả về, không bịa thêm cột. Flag: improvised (wrapper { rows: [...] }, theo đúng quy
// ước duy nhất đã biết của nhóm bao-cao/* — TongHopResult).
export type BaoCaoRow = Record<string, unknown>;

export interface BaoCaoRowsResult {
  rows: BaoCaoRow[];
}

// GET /dot-xac-nhan — "Danh sách đợt" (api-contract.md mục "Đợt xác nhận & lịch sử thay đổi hồ sơ").
// Hình dạng response không ghi rõ — improvised, theo đúng quy ước { data: [...] } của các endpoint
// danh mục dùng chung (mục 4).
export interface DotXacNhanDanhMuc {
  id: string;
  khoa_id: string | null;
  ten: string;
  loai: 'kiem_tra_bo_sung' | 'xac_nhan_truoc_danh_gia';
  mo_luc: string;
  dong_luc: string;
}

// Phase 5 redesign — Nhập dữ liệu (docs/api-contract.md mục 5). 8 loại import thật hỗ trợ qua
// `loai_danh_muc_import` — không bịa thêm/bớt loại nào ngoài danh sách này.
export type LoaiDanhMucImport =
  | 'ho_so_nhan_su_moet'
  | 'phan_lop_hoc_vien'
  | 'lop_va_lich_hoc'
  | 'ket_qua_danh_gia'
  | 'tai_khoan_vle'
  | 'don_vi_cong_tac'
  | 'dia_danh'
  | 'mon_hoc';

export interface TaoImportResponse {
  import_id: string;
  trang_thai: string;
}

export interface ImportLoiDong {
  dong: number;
  ly_do: string;
}

// GET /import/{id} — shape đúng theo api-contract.md mục 5.
export interface ImportChiTiet {
  id: string;
  trang_thai: string;
  tong_so_dong: number;
  so_dong_thanh_cong: number;
  so_dong_loi: number;
  danh_sach_loi: ImportLoiDong[];
  danh_sach_canh_bao: ImportLoiDong[];
  so_hoc_vien_chua_co_email: number;
}

// GET /import — "Nhật ký import" (api-contract.md mục 5), shape hàng không ghi rõ — improvised, giả
// định cùng field với ImportChiTiet (đã xác nhận) + loai/created_at để hiển thị danh sách.
export interface NhatKyImportItem extends ImportChiTiet {
  loai: LoaiDanhMucImport;
  created_at: string;
}
