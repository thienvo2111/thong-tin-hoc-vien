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

// GET /bao-cao/tong-quan — dashboard "Tổng quan hệ thống" (thêm 2026-09-30). Shape lấy từ
// backend/src/bao-cao/bao-cao.types.ts (TongQuanResult) — không mô tả chi tiết trong api-contract.md,
// flag: improvised. loai_lop dùng lại type LoaiLop khai báo ở dưới (khóa bồi dưỡng).
export interface KhaoSatMucRow {
  da_lam: number;
  co_ban: number;
  thanh_thao: number;
  nang_cao: number;
}

export interface KetQuaTheoHinhThucRow {
  loai_lop: LoaiLop;
  dang_hoc: number;
  dat: number;
  khong_dat: number;
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
  ket_qua_theo_hinh_thuc: KetQuaTheoHinhThucRow[];
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
  | 'nhan_su_lop';

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
}

export interface YeuCauHoTroQuanTri extends YeuCauHoTro {
  hoi_lai: boolean;
  hoc_vien_ho_ten: string;
  nguoi_tra_loi_ten: string | null;
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
