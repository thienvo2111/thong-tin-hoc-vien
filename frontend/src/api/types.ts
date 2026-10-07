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
  // Deprecated (sửa 2026-09-30, rồi T17 2026-10-01): thay bởi "noi_sinh" (text tự do) rồi
  // noi_sinh_tinh/huyen/xa — giữ nguyên 2 field này trong kiểu để không vỡ chỗ nào còn đọc dữ liệu cũ.
  noi_sinh_id?: string | null;
  phuong_xa_id?: string | null;
  // T17 (2026-10-01): tách "noi_sinh" (1 ô text tự do) thành 3 trường riêng — vẫn text tự do
  // (giấy khai sinh có thể ghi theo địa giới hành chính CŨ, khác địa giới HIỆN TẠI mà dia_danh
  // quản lý), tất cả hoàn toàn tùy chọn, KHÔNG tính vào "Hồ sơ đầy đủ".
  noi_sinh_tinh?: string | null;
  noi_sinh_huyen?: string | null;
  noi_sinh_xa?: string | null;
  // Thêm 2026-09-30: "Cư trú" — tùy chọn, dùng đúng địa giới hành chính HIỆN
  // TẠI (dia_danh đang có, 2 cấp tỉnh/thành -> phường/xã).
  cu_tru_tinh_id?: string | null;
  cu_tru_phuong_xa_id?: string | null;
  cu_tru_tinh_ten?: string | null;
  cu_tru_phuong_xa_ten?: string | null;
  don_vi_cong_tac_id: string | null;
  chuc_vu: string | null;
  // 2026-10-02: học viên tự chọn — bắt buộc cho "hồ sơ đầy đủ", gửi sang hệ thống khảo sát qua SSO.
  doi_tuong?: DoiTuongHocVien | null;
  so_dien_thoai_lien_he: string | null;
  email_lien_he: string | null;
  // Thêm 2026-09-30: xác minh email liên hệ (backend hoc_vien.email_da_xac_minh) — đổi email_lien_he
  // tự reset về false, xem POST /hoc-vien/toi/gui-lai-xac-minh-email + POST /auth/xac-minh-email.
  email_da_xac_minh: boolean;
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
  dia_ban_id: string;
  don_vi_cha_id?: string | null;
  // Thêm 2026-10-01 — don-vi-cong-tac.service.ts#findAll trả kèm (include dia_ban + parent) để
  // hiển thị "Tên trường — Phường/xã" / lọc theo tỉnh mà không cần gọi riêng GET /danh-muc/dia-danh.
  dia_ban_ten: string;
  tinh_id: string | null;
  tinh_ten: string | null;
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
  dang_mo: boolean;
  da_xac_nhan: boolean;
  xac_nhan_luc: string | null;
  /** 2026-10-05: đã xác nhận ở đợt đang mở rồi sửa hồ sơ (xác nhận tự hủy) -> phải xác nhận lại. */
  can_xac_nhan_lai: boolean;
  /** Thời điểm hồ sơ bị điều chỉnh làm hủy xác nhận (khi can_xac_nhan_lai). */
  dieu_chinh_luc: string | null;
  /** Không có đợt mở: xác nhận còn hiệu lực gần nhất ở đợt trước. */
  xac_nhan_gan_nhat: { dot_ten: string; xac_nhan_luc: string } | null;
  /** false = hồ sơ tự đăng ký, không áp dụng đợt xác nhận. */
  ap_dung_dot: boolean;
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

// Xác minh email liên hệ & quên/đặt lại mật khẩu (2026-09-30, api-contract.md
// mục cùng tên) — cả 3 response chỉ có đúng 1 field boolean cố định true.
export interface DaGuiResponse {
  da_gui: true;
}

export interface DaDatLaiResponse {
  da_dat_lai: true;
}

export interface DaXacMinhResponse {
  da_xac_minh: true;
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

// GET /bao-cao/tong-quan — dashboard "Tổng quan hệ thống" (thêm 2026-09-30, sửa 2026-10-07). Shape lấy
// từ backend/src/bao-cao/bao-cao.types.ts (TongQuanResult) — không mô tả chi tiết trong
// api-contract.md, flag: improvised. Mức dùng muc_goc (thang quản trị cấu hình) — quyết định
// 2026-10-05: cổng KHÔNG quy đổi sang 3 bậc cứng co_ban/thanh_thao/nang_cao nữa.
export interface KhaoSatMucRow {
  da_lam: number;
  theo_muc: { ma: string; nhan: string; so_luong: number }[];
  /** Đã hoàn thành bài nhưng hệ thống khảo sát chưa báo mức. */
  chua_xep_muc: number;
}

// Sửa 2026-10-07: thay "Kết quả học theo hình thức" (dang_ky_hoc_lop, đã bỏ) — tình hình tham gia học
// THEO ĐIỂM DANH thật, nhóm theo giai đoạn.
export interface ThamGiaHocRow {
  giai_doan_id: string;
  ma_khoa: string;
  thu_tu: number;
  ten_giai_doan: string;
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

export type DoiTuongHocVien = 'giao_vien' | 'can_bo_quan_ly';

/** Kênh làm bài đánh giá đầu vào (cấu hình admin): 'sso' = chuyển sang hệ thống khảo sát; 'vle' = T15. */
export type KenhDanhGia = 'sso' | 'vle';

export interface DanhGiaDauVaoDuDieuKien {
  kenh: 'vle';
  du_dieu_kien: true;
  duong_dan: string;
  ten_dang_nhap_vle: string;
  mat_khau_tam: string | null;
}

/** Kênh SSO: chỉ báo đủ điều kiện — link (mã dùng 1 lần) được cấp lúc bấm qua POST /sso/cap-ma. */
export interface DanhGiaDauVaoSsoDuDieuKien {
  kenh: 'sso';
  du_dieu_kien: true;
}

export interface DanhGiaDauVaoChuaDu {
  kenh: KenhDanhGia;
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

export type DanhGiaDauVao = DanhGiaDauVaoDuDieuKien | DanhGiaDauVaoSsoDuDieuKien | DanhGiaDauVaoChuaDu;

// Phase 4 redesign — module Khóa bồi dưỡng (Admin), docs/api-contract.md mục 3 + database-ddl.sql
// (CREATE TABLE khoa_boi_duong/giai_doan_khoa/lop_hoc). GET /khoa-boi-duong trả bản ghi thô (không
// join tên đơn vị), giống HocVienDanhSachItem — FE tự dựng map id->tên qua GET /danh-muc/don-vi-cong-tac.
export type TrangThaiKhoa = 'nhap' | 'cho_duyet' | 'da_duyet' | 'tu_choi' | 'dong_dang_ky';

export interface KhoaBoiDuong {
  id: string;
  ma_khoa: string;
  ten_khoa: string;
  don_vi_dat_hang_id: string;
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

// Thêm 2026-09-30 — enum thật của backend (prisma/schema.prisma) dùng cho form CRUD giai đoạn/nhân
// sự (AdminKhoaChiTiet). trang_thai_active dùng chung cho giai_doan/lop_hoc/cum_hoc_vien (vô hiệu
// hóa = 'ngung', không xóa cứng).
export type HinhThucGiaiDoan = 'truc_tiep' | 'truc_tuyen' | 'danh_gia' | 'khac';
export type VaiTroNhanSuLop = 'giang_vien' | 'ho_tro';
export type TrangThaiActive = 'active' | 'ngung';
export type TrangThaiLichHoc = 'chua_dien_ra' | 'dang_dien_ra' | 'ket_thuc';

export interface GiaiDoanKhoa {
  id: string;
  khoa_id: string;
  thu_tu: number;
  ten_giai_doan: string;
  hinh_thuc: HinhThucGiaiDoan;
  thoi_gian_bat_dau: string;
  thoi_gian_ket_thuc: string;
  trang_thai: TrangThaiActive;
  // Phân lớp theo giai đoạn (spec 2026-10-02): thông tin chung cho giai đoạn không gán lớp.
  link_hoac_dia_diem: string | null;
  huong_dan: string | null;
}

export interface NhanSuLop {
  id: string;
  lop_id: string;
  ho_ten: string;
  vai_tro: VaiTroNhanSuLop;
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
  trang_thai: TrangThaiLichHoc;
  giai_doan?: GiaiDoanKhoa;
  // T10 (issue #2, 2026-10-07): điểm học (bắt buộc với giai đoạn trực tiếp), phòng, mốc đổi giờ/địa điểm.
  diem_hoc_id?: string | null;
  phong?: string | null;
  cap_nhat_luc?: string;
  diem_hoc?: DiemHocTomTat | null;
  /** Chỉ có trong response tạo/sửa buổi: cảnh báo 🟡 vượt số phòng của điểm học (không chặn). */
  canh_bao?: string[];
  // T11 (issue #3): giảng viên phân công vào buổi (GET /khoa-boi-duong/{id} — không có SĐT/email).
  phan_cong?: PhanCongBuoi[];
}

export interface PhanCongBuoi {
  id: string;
  vai_tro: VaiTroNhanSuLop;
  so_gio: string | number | null;
  da_xac_nhan_gio: boolean;
  giang_vien: { id: string; ho_ten: string };
}

// T11 (issue #3): danh mục giảng viên — GET /giang-vien (chỉ Quản trị).
export interface GiangVien {
  id: string;
  ho_ten: string;
  so_dien_thoai: string;
  email: string | null;
  don_vi_cong_tac: string | null;
  ghi_chu: string | null;
  trang_thai: TrangThaiActive;
  so_buoi?: number;
  // ADR 0004 G8 (issue #20): tài khoản cổng giảng viên (chỉ Quản trị thấy).
  tai_khoan?: {
    ten_dang_nhap: string;
    trang_thai: TrangThaiActive;
    phai_doi_mat_khau: boolean;
    dang_nhap_lan_cuoi: string | null;
  } | null;
}

export interface LichDayGiangVien {
  giang_vien: GiangVien;
  phan_cong: {
    id: string;
    vai_tro: VaiTroNhanSuLop;
    so_gio: string | number | null;
    da_xac_nhan_gio: boolean;
    xac_nhan_luc: string | null;
    lich_hoc: {
      id: string;
      buoi_so: number;
      thoi_gian_bat_dau: string;
      thoi_gian_ket_thuc: string;
      giai_doan: { id: string; ten_giai_doan: string; hinh_thuc: string };
      lop: { id: string; ten_lop: string; loai_lop: LoaiLop; khoa: { id: string; ma_khoa: string; ten_khoa: string } };
      diem_hoc: { id: string; ten: string; dia_chi: string } | null;
    };
  }[];
}

// T10 (issue #2): danh mục điểm học trực tiếp — GET /diem-hoc.
export interface DiemHocTomTat {
  id: string;
  ma_diem_hoc: string;
  ten: string;
  dia_chi: string;
  nguoi_lien_he: string | null;
  sdt_lien_he: string | null;
}

export interface DiemHoc extends DiemHocTomTat {
  dia_ban_id: string;
  don_vi_id: string | null;
  suc_chua: number | null;
  so_phong: number | null;
  ghi_chu_csvc: string | null;
  trang_thai: TrangThaiActive;
  dia_ban?: { id: string; ten: string; parent_id: string | null };
  don_vi?: { id: string; ten_don_vi: string } | null;
}

// QĐ10 (mo-rong-nls-an-giang.md, 2026-09-30): 3 loại lớp độc lập nhau — xem
// docs/api-contract.md mục 3 "Lưu ý (QĐ10, 2026-09-30)".
export type LoaiLop = 'truc_tiep' | 'zoom' | 'vle';

export interface LopHoc {
  id: string;
  khoa_id: string;
  loai_lop: LoaiLop;
  ten_lop: string;
  si_so_toi_da: number | null;
  trang_thai: TrangThaiActive;
  nhom_hoc_vien: number | null;
  muc_nang_luc: MucNangLuc | null;
  nhan_su?: NhanSuLop[];
  lich_hoc?: LichHocLop[];
  // Chỉ có trong GET /khoa-boi-duong/{id}: số đăng ký khác nhau đang được phân vào lớp.
  si_so_hien_tai?: number;
}

// cum_hoc_vien (QĐ10) — nhóm Zalo hỗ trợ theo địa lý, độc lập với cây đơn vị công tác VÀ với 3 loại
// lớp; chứa học viên trực tiếp qua dang_ky_hoc.cum_id (không qua lớp nào).
export interface CumHocVien {
  id: string;
  khoa_id: string;
  ten_cum: string;
  link_zalo: string | null;
  ghi_chu: string | null;
  trang_thai: TrangThaiActive;
  created_at: string;
  /** ADR 0003 — chỉ có khi người gọi là quan_tri. */
  nguoi_ho_tro?: NguoiHoTroRutGon[];
}

export interface NguoiHoTroRutGon {
  id: string;
  ho_ten: string;
}

// GET /khoa-boi-duong/{id} — "Chi tiết khóa kèm giai đoạn + lớp" (api-contract.md mục 3), hình dạng
// lấy từ backend/src/khoa-boi-duong/khoa-boi-duong.service.ts#findOne (include giai_doan, lop_hoc
// kèm nhan_su + lich_hoc.giai_doan, cum_hoc_vien) chứ không có trong api-contract.md — improvised,
// đúng theo code. Sửa 2026-09-30 (QĐ10): thêm cum_hoc_vien (song song với giai_doan/lop_hoc).
// Sửa 2026-10-03 (đơn vị đặt hàng): thêm pham_vi_hoc_vien — phạm vi học viên caller được xem trong
// khóa này ('toan_bo' nếu thuộc R1, 'don_vi' nếu chỉ R2 — xem findOne#phamViHocVien).
export interface KhoaBoiDuongChiTiet extends KhoaBoiDuong {
  giai_doan: GiaiDoanKhoa[];
  lop_hoc: LopHoc[];
  cum_hoc_vien: CumHocVien[];
  pham_vi_hoc_vien: 'toan_bo' | 'don_vi';
  /** ADR 0004 G3 — chỉ có khi người xem là quan_tri. */
  nhom_ho_tro_gv?: NguoiHoTroRutGon[];
}

// Body POST /khoa-boi-duong — backend/src/khoa-boi-duong/dto/create-khoa-boi-duong.dto.ts. Chỉ
// quan_tri tạo khóa (2026-10-03, mọi endpoint ghi chỉ quan_tri) — don_vi_dat_hang_id luôn bắt buộc.
export interface TaoKhoaBoiDuongDto {
  ma_khoa: string;
  ten_khoa: string;
  dia_diem?: string;
  thoi_gian_bat_dau: string;
  thoi_gian_ket_thuc: string;
  don_vi_dat_hang_id: string;
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

// GET /dot-xac-nhan (quan_tri) — dot-xac-nhan.controller.ts + dot-xac-nhan.service.ts#layDanhSach: trả
// THẲNG mảng dot_xac_nhan thô (findMany, không include quan hệ khoa), KHÔNG bọc { data: [...] } — sửa lại
// 2026-09-30 sau khi đối chiếu trực tiếp service thật (bản trước đó "improvised" đoán sai là có bọc).
export interface DotXacNhanDanhMuc {
  id: string;
  khoa_id: string | null;
  ten: string;
  loai: 'kiem_tra_bo_sung' | 'xac_nhan_truoc_danh_gia';
  mo_luc: string;
  dong_luc: string;
  created_by: string | null;
  created_at: string;
}

// Phase 5 redesign — Nhập dữ liệu (docs/api-contract.md mục 5). 10 loại import thật hỗ trợ qua
// `loai_danh_muc_import` (thêm diem_danh/ket_qua_giai_doan ở T12, 2026-09-30) — không bịa thêm/bớt
// loại nào ngoài danh sách này.
export type LoaiDanhMucImport =
  | 'ho_so_nhan_su_moet'
  | 'phan_lop_hoc_vien'
  | 'lop_va_lich_hoc'
  | 'ket_qua_danh_gia'
  | 'tai_khoan_vle'
  | 'don_vi_cong_tac'
  | 'dia_danh'
  | 'mon_hoc'
  | 'diem_danh'
  | 'ket_qua_giai_doan'
  | 'nhan_su_lop'
  | 'tai_khoan_don_vi'
  | 'ket_qua_khao_sat'
  | 'giang_vien'
  | 'phan_cong_giang_day';

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

export type MucNangLuc = 'co_ban' | 'thanh_thao' | 'nang_cao';

// GET /hoc-vien/toi/khoa-hoc (M7) — backend/src/khoa-boi-duong/dang-ky-hoc.controller.ts +
// khoa-boi-duong.service.ts#khoaHocCuaToi: trả thẳng bản ghi dang_ky_hoc (không select riêng nên đủ
// scalar field) kèm include khoa + lop.nhan_su + lop.lich_hoc.giai_doan. lop_hoc.lich_hoc đã sắp theo
// giai_doan.thu_tu, buoi_so, thoi_gian_bat_dau, dia_diem_hoac_link ở backend — FE không sort lại.
export interface GiaiDoanKhoaToi {
  id: string;
  thu_tu: number;
  ten_giai_doan: string;
  hinh_thuc: 'truc_tiep' | 'truc_tuyen' | 'danh_gia' | 'khac';
  thoi_gian_bat_dau: string;
  thoi_gian_ket_thuc: string;
}

export type TrangThaiDiemDanh = 'co_mat' | 'vang' | 'vang_co_phep';

// Thêm 2026-09-30 (T12) — điểm danh nhập qua IMPORT EXCEL (không có giao diện chấm tay từng buổi).
export interface LichHocLopToi {
  id: string;
  giai_doan_id: string;
  buoi_so: number;
  thoi_gian_bat_dau: string;
  thoi_gian_ket_thuc: string;
  dia_diem_hoac_link: string | null;
  trang_thai: 'chua_dien_ra' | 'dang_dien_ra' | 'ket_thuc';
  giai_doan: GiaiDoanKhoaToi;
  // null = chưa được điểm danh cho buổi này (KHÔNG suy diễn thành "vắng").
  trang_thai_diem_danh: TrangThaiDiemDanh | null;
  // T10 (issue #2): điểm học + phòng của buổi trực tiếp (null/thiếu với buổi trực tuyến).
  diem_hoc?: DiemHocTomTat | null;
  phong?: string | null;
  // T11 (issue #3): giảng viên của buổi — chỉ họ tên + vai trò.
  giang_vien?: { ho_ten: string; vai_tro: VaiTroNhanSuLop }[];
}

export interface NhanSuLopToi {
  id: string;
  ho_ten: string;
  vai_tro: VaiTroNhanSuLop;
  so_dien_thoai: string | null;
}

export interface LopHocToi {
  id: string;
  ten_lop: string;
  loai_lop: LoaiLop;
  si_so_toi_da: number | null;
  nhom_hoc_vien: number | null;
  muc_nang_luc: MucNangLuc | null;
  nhan_su: NhanSuLopToi[];
  lich_hoc: LichHocLopToi[];
}

// Phân lớp theo giai đoạn (spec 2026-10-02 mục 5.1): 1 phần tử/giai đoạn active của khóa, theo thu_tu.
// lop = lớp học viên được gán ở giai đoạn này (lich_hoc chỉ gồm buổi của giai đoạn này) hoặc null.
export interface GiaiDoanCuaToi {
  id: string;
  thu_tu: number;
  ten_giai_doan: string;
  hinh_thuc: HinhThucGiaiDoan;
  thoi_gian_bat_dau: string;
  thoi_gian_ket_thuc: string;
  link_hoac_dia_diem: string | null;
  huong_dan: string | null;
  lop: LopHocToi | null;
  tien_do: { ty_le_hoan_thanh: number | null; diem: number | null } | null;
  // ADR 0004 G4 (issue #16): người hỗ trợ thực địa của đợt (lớp × giai đoạn) — họ tên, SĐT.
  thuc_dia?: { ho_ten: string; so_dien_thoai: string; nhiem_vu: string | null }[];
}

export interface KhoaHocDangKy {
  id: string;
  hoc_vien_id: string;
  khoa_id: string;
  ngay_dang_ky: string;
  trang_thai: 'cho_duyet' | 'da_duyet' | 'tu_choi' | 'da_phan_lop';
  ket_qua: 'dang_hoc' | 'dat' | 'khong_dat' | 'vang' | null;
  ngay_hoan_thanh: string | null;
  muc_dau_vao: MucNangLuc | null;
  muc_dau_ra: MucNangLuc | null;
  cum_id: string | null;
  khoa: {
    id: string;
    ma_khoa: string;
    ten_khoa: string;
    dia_diem: string | null;
    thoi_gian_bat_dau: string;
    thoi_gian_ket_thuc: string;
    trang_thai: TrangThaiKhoa;
  };
  cum: CumHocVien | null;
  // Phân lớp theo giai đoạn (spec 2026-10-02) — thay lop_truc_tiep/lop_zoom/lop_vle/tien_do_giai_doan.
  giai_doan: GiaiDoanCuaToi[];
}

// GET /import — "Nhật ký import" (api-contract.md mục 5). Hàng là bản ghi thô của bảng nhat_ky_import
// (backend/src/import/import.service.ts#lichSu trả thẳng kết quả findMany, KHÔNG map qua shape của
// ImportChiTiet) — xác nhận qua DevTools Network + đối chiếu backend, KHÔNG có danh_sach_loi/
// danh_sach_canh_bao/so_hoc_vien_chua_co_email (những field đó chỉ có ở GET /import/{id}).
export interface NhatKyImportItem {
  id: string;
  loai_danh_muc: LoaiDanhMucImport;
  ten_file_goc: string;
  nguoi_import_id: string;
  thoi_gian_import: string;
  tong_so_dong: number;
  so_dong_thanh_cong: number;
  so_dong_loi: number;
  file_loi_url: string | null;
  trang_thai: string;
}

// M8 (2026-10-01): Yêu cầu hỗ trợ.
export type TrangThaiYeuCauHoTro = 'cho_xu_ly' | 'da_phan_hoi' | 'da_dong';
export type DanhGiaYeuCauHoTro = 'hai_long' | 'chua_hai_long';

export interface YeuCauHoTro {
  id: string;
  hoc_vien_id: string;
  /** Ticket cũ (trước 2026-10-03) gắn loại vấn đề; ticket mới gắn tinh_huong. */
  loai_van_de_id: string | null;
  tinh_huong: string | null;
  /** Tên hiển thị: tinh_huong, hoặc tên loại vấn đề với ticket cũ. */
  chu_de: string;
  noi_dung_hoi: string;
  noi_dung_tra_loi: string | null;
  trang_thai: TrangThaiYeuCauHoTro;
  danh_gia: DanhGiaYeuCauHoTro | null;
  da_dong_hieu_luc: boolean;
  thoi_gian_tao: string;
  thoi_gian_phan_hoi: string | null;
  thoi_gian_dong: string | null;
  /** ADR 0003 H12: Quản trị đã đính chính câu trả lời lúc này (null = chưa sửa). */
  thoi_gian_sua_tra_loi: string | null;
  /** Chỉ phía học viên (H14): "Cụm hỗ trợ N" hoặc "Ban tổ chức (HCMUE)"; null = chưa trả lời. */
  nguoi_tra_loi_hien_thi?: string | null;
}

export interface YeuCauHoTroQuanTri extends YeuCauHoTro {
  hoi_lai: boolean;
  hoc_vien_ho_ten: string;
  nguoi_tra_loi_ten: string | null;
  /** Cụm của học viên (phía người hỗ trợ: chỉ cụm trong phạm vi). Rỗng = chưa có cụm. */
  ten_cum: string[];
  da_sua_boi_quan_tri: boolean;
}

export interface YeuCauHoTroChiTietHoTro extends YeuCauHoTroQuanTri {
  ticket_truoc: Pick<
    YeuCauHoTro,
    'id' | 'chu_de' | 'noi_dung_hoi' | 'noi_dung_tra_loi' | 'trang_thai' | 'danh_gia' | 'thoi_gian_tao'
  >[];
}

// Tài khoản đơn vị (ADR 0002) — /nguoi-dung/don-vi, chỉ quan_tri.
export type VaiTroDonVi = 'so_gddt' | 'phong_vhxh' | 'truong';

export interface TaiKhoanDonVi {
  id: string;
  ten_dang_nhap: string;
  ho_ten: string;
  email: string | null;
  vai_tro: VaiTroDonVi;
  trang_thai: TrangThaiActive;
  dang_nhap_lan_cuoi: string | null;
  don_vi: {
    id: string;
    ma_don_vi: string;
    ten_don_vi: string;
    loai_don_vi: string;
    trang_thai: TrangThaiActive;
  } | null;
}

export interface DonViChuaCap {
  id: string;
  ma_don_vi: string;
  ten_don_vi: string;
  loai_don_vi: VaiTroDonVi;
}

export interface TaoTaiKhoanDonViDto {
  don_vi_id: string;
  ten_dang_nhap?: string;
  ho_ten?: string;
  email?: string;
  cach_cap?: 'mat_khau_tam' | 'email';
}

export interface SuaTaiKhoanDonViDto {
  ten_dang_nhap?: string;
  ho_ten?: string;
  email?: string;
  trang_thai?: TrangThaiActive;
}

export interface KetQuaTaoTaiKhoanDonVi {
  tai_khoan: TaiKhoanDonVi;
  mat_khau_tam?: string;
}

export interface MatKhauTamResponse {
  ten_dang_nhap: string;
  mat_khau_tam: string;
}

// Người hỗ trợ học viên (ADR 0003) — /nguoi-dung/ho-tro, chỉ quan_tri.
export interface CumPhanCong {
  cum_id: string;
  ten_cum: string;
  khoa_id: string;
  ma_khoa: string;
  ten_khoa: string;
}

export interface TaiKhoanHoTro {
  id: string;
  ten_dang_nhap: string;
  ho_ten: string;
  email: string;
  vai_tro: VaiTroHoTro;
  trang_thai: TrangThaiActive;
  dang_nhap_lan_cuoi: string | null;
  cum: CumPhanCong[];
  // ADR 0004 L1: khóa mà người hỗ trợ giảng viên thuộc nhóm.
  khoa?: { khoa_id: string; ma_khoa: string; ten_khoa: string }[];
}

export type VaiTroHoTro = 'ho_tro_hoc_vien' | 'ho_tro_giang_vien';

export interface TaoTaiKhoanHoTroDto {
  ho_ten: string;
  email: string;
  ten_dang_nhap?: string;
  cach_cap?: 'email' | 'mat_khau_tam';
  vai_tro?: VaiTroHoTro;
}

export interface SuaTaiKhoanHoTroDto {
  ho_ten?: string;
  email?: string;
  trang_thai?: TrangThaiActive;
}

export interface KetQuaTaoTaiKhoanHoTro {
  tai_khoan: TaiKhoanHoTro;
  mat_khau_tam?: string;
}

// Tài khoản học viên — /nguoi-dung/hoc-vien, chỉ quan_tri. Không bao giờ có mat_khau_hash.
export type TinhTrangTaiKhoanHocVien = 'tam_khoa' | 'chua_dang_nhap' | 'phai_doi_mat_khau';

export interface TaiKhoanHocVien {
  id: string;
  ten_dang_nhap: string;
  trang_thai: TrangThaiActive;
  phai_doi_mat_khau: boolean;
  so_lan_dang_nhap_sai: number;
  khoa_den: string | null;
  dang_nhap_lan_cuoi: string | null;
  created_at: string;
  hoc_vien: {
    id: string;
    ho_ten: string | null;
    so_dinh_danh_ca_nhan: string | null;
    ngay_sinh: number | null;
    thang_sinh: number | null;
    nam_sinh: number | null;
    so_dien_thoai_lien_he: string | null;
    email_lien_he: string | null;
    don_vi_cong_tac: { id: string; ten_don_vi: string } | null;
  } | null;
}

/** POST /nguoi-dung/:id/dat-lai-mat-khau — mật khẩu về ngày sinh ddmmyyyy. */
export interface DatLaiMatKhauHocVienResponse {
  nguoi_dung: { id: string; ten_dang_nhap: string };
  luu_y: string;
}

// GET /hoc-vien/:id/nhat-ky — dòng thời gian (backend nhat-ky.service.ts MucDongThoiGian).
export type NhomNhatKy = 'tai_khoan' | 'ho_so' | 'khao_sat' | 'hoc_tap' | 'thong_bao' | 'ho_tro';

export interface MucNhatKy {
  id: string;
  thoi_gian: string;
  nhom: NhomNhatKy;
  tieu_de: string;
  noi_dung: string | null;
  truong: string | null;
  nguoi_thuc_hien: string | null;
  ip: string | null;
  thiet_bi: string | null;
}

export interface NhatKyHocVien {
  hoc_vien: { id: string; ho_ten: string };
  muc: MucNhatKy[];
}

// ---------------------------------------------------------------------------------------------------
// Khu người hỗ trợ học viên (ADR 0003) — /ho-tro/*, chỉ ho_tro_hoc_vien.
export interface CumCuaToi {
  cum_id: string;
  ten_cum: string;
  link_zalo: string | null;
  trang_thai: TrangThaiActive;
  khoa_id: string;
  ma_khoa: string;
  ten_khoa: string;
  so_hoc_vien: number;
}

export interface KhaoSatTomTat {
  loai: string;
  trang_thai: 'da_mo' | 'dang_lam' | 'hoan_thanh';
  muc: MucNangLuc | null;
}

export interface HocVienHoTroDong {
  id: string;
  ho_ten: string;
  ma_dinh_danh_moet: string | null;
  ten_dang_nhap: string | null;
  dang_nhap_lan_cuoi: string | null;
  don_vi_cong_tac_ten: string;
  doi_tuong: DoiTuongHocVien | null;
  so_dien_thoai_lien_he: string | null;
  email_lien_he: string | null;
  day_du: boolean;
  cum: { cum_id: string; ten_cum: string }[];
  khao_sat: KhaoSatTomTat[];
}

export interface HocVienHoTroChiTiet {
  ho_so: HocVien & { day_du: boolean; thieu: ApiFieldError[] };
  tai_khoan: {
    id: string;
    ten_dang_nhap: string;
    trang_thai: TrangThaiActive;
    dang_nhap_lan_cuoi: string | null;
    phai_doi_mat_khau: boolean;
    khoa_den: string | null;
    dang_bi_khoa: boolean;
    email_da_xac_minh: boolean;
  } | null;
  hoc_tap: KhoaHocDangKy[];
  khao_sat: (KhaoSatTomTat & { hoan_thanh_luc: string | null; cap_nhat_luc: string })[];
  yeu_cau_ho_tro: {
    id: string;
    tinh_huong: string | null;
    noi_dung_hoi: string;
    trang_thai: 'cho_xu_ly' | 'da_phan_hoi' | 'da_dong';
    thoi_gian_tao: string;
    thoi_gian_phan_hoi: string | null;
  }[];
  lich_su_thay_doi: {
    truong: string;
    gia_tri_cu: string | null;
    gia_tri_moi: string | null;
    vai_tro_nguoi_sua: string;
    sua_luc: string;
    nguoi_sua_ten: string;
    /** ADR 0003 H7: lý do khi người hỗ trợ sửa hộ; null với các luồng khác. */
    ly_do: string | null;
  }[];
  // ADR 0004 G13/G14 (issue #18).
  bao_vang?: import('./doiLop').BaoVangHocVien[];
  de_nghi_doi_lop?: import('./doiLop').DeNghiDoiLopHocVien[];
}

export interface BuoiHocHoTro {
  id: string;
  lop_id: string;
  giai_doan_id: string;
  buoi_so: number;
  thoi_gian_bat_dau: string;
  thoi_gian_ket_thuc: string;
  dia_diem_hoac_link: string | null;
  trang_thai: TrangThaiLichHoc;
  lop: { id: string; ten_lop: string; loai_lop: LoaiLop };
  giai_doan: { id: string; thu_tu: number; ten_giai_doan: string };
  khoa: { id: string; ma_khoa: string; ten_khoa: string };
  nhan_su: { ho_ten: string; vai_tro: VaiTroNhanSuLop; so_dien_thoai: string | null }[];
  so_hoc_vien_cum: number;
  // ADR 0004 G11 (issue #21): trạng thái nhắc của từng cụm có học viên trong lớp.
  nhac_cum?: { cum_id: string; trang_thai: import('./nhacLich').TrangThaiNhac }[];
  // ADR 0004 G9 (issue #15): liên thông — điểm học, phòng, nhóm hỗ trợ giảng viên của khóa.
  phong?: string | null;
  diem_hoc?: { id: string; ten: string; dia_chi: string; nguoi_lien_he: string | null; sdt_lien_he: string | null } | null;
  nhom_ho_tro_gv?: { ho_ten: string; email: string | null }[];
  thuc_dia?: { ho_ten: string; so_dien_thoai: string; nhiem_vu: string | null }[];
}

// --- Dashboard thong ke (copy nguyen tu backend/src/thong-ke/thong-ke.types.ts) ---
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
  ty_le_truy_cap: number | null;
  ty_le_ky_nang_so: number | null;
  ty_le_dau_vao: number | null;
  ty_le_dau_ra: number | null;
  ty_le_co_mat: number | null;
  ty_le_vle_dat: number | null;
  ty_le_dat: number | null;
}
