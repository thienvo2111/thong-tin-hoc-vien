// Tài khoản đơn vị (ADR 0002) — 1 dòng import loại tai_khoan_don_vi đã tra
// cứu xong đơn vị (don_vi_id) theo ma_don_vi.
export interface TaiKhoanDonViRowDto {
  ma_don_vi: string;
  ten_don_vi: string;
  don_vi_id: string;
  ten_dang_nhap?: string;
  ho_ten?: string;
  email?: string;
}
