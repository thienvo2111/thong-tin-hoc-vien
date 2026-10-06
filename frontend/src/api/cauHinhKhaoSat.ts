import { apiFetch } from './client';

// Cấu hình khảo sát đầu vào + chế độ triển khai — backend cau-hinh-khao-sat.controller.ts.
// Chỉ dùng apiFetch (không TanStack Query) vì M0 đọc file này và phải giữ chunk nhẹ.

export type CheDoHocVien = 'khao_sat' | 'dang_nhap';

export interface LienKetKhaoSat {
  nhan: string;
  /** Chuỗi rỗng = chưa có đường dẫn. */
  url: string;
}

export interface PhieuKhaoSat {
  ten: string;
  mo_ta: string;
  lien_ket: LienKetKhaoSat[];
}

/** Kênh làm bài đánh giá đầu vào ở M6: 'sso' = chuyển sang hệ thống khảo sát; 'vle' = tài khoản VLE (T15). */
export type KenhDanhGia = 'sso' | 'vle';

export interface CauHinhKhaoSat {
  che_do_hoc_vien: CheDoHocVien;
  danh_gia_dau_vao_trong_cong: boolean;
  hien_khao_sat: boolean;
  /** Thiếu ở cấu hình lưu trước 2026-10-02 -> coi là 'vle'. Khi lưu (PUT) luôn bắt buộc. */
  kenh_danh_gia?: KenhDanhGia;
  /** 2026-10-05: khối khảo sát đầu vào trên trang chủ học viên đã đăng nhập (tách khỏi hien_khao_sat — chỉ còn
   * điều khiển trang giới thiệu công khai). Thiếu -> xem khaoSatDauVaoMo(). */
  khao_sat_dau_vao_mo?: boolean;
  /** Mở khảo sát đầu ra (SSO target 'dau-ra'). Thiếu = chưa mở. */
  khao_sat_dau_ra_mo?: boolean;
  phieu: PhieuKhaoSat[];
}

/** Cấu hình lưu trước 2026-10-05 chưa có khao_sat_dau_vao_mo -> giữ hành vi cũ (bật khi hiện khối trang chủ
 * hoặc bật mục Đánh giá đầu vào). */
export function khaoSatDauVaoMo(c: Pick<CauHinhKhaoSat, 'khao_sat_dau_vao_mo' | 'hien_khao_sat' | 'danh_gia_dau_vao_trong_cong'>): boolean {
  return c.khao_sat_dau_vao_mo ?? (c.hien_khao_sat || c.danh_gia_dau_vao_trong_cong);
}

/** Cấu hình đến từ đâu (2026-10-02): cấu hình chung, hay cấu hình riêng của 1 khóa. */
export type PhamViCauHinh =
  | { loai: 'chung' }
  | {
      loai: 'khoa';
      khoa_id: string;
      ma_khoa: string;
      ten_khoa: string;
      tinh_id: string | null;
      ten_tinh: string | null;
    };

export interface KetQuaCauHinhKhaoSat {
  /** null = chưa lưu lần nào — dùng giá trị mặc định trong content/trienKhai.ts. */
  cau_hinh: CauHinhKhaoSat | null;
  cap_nhat_luc: string | null;
  /** Thiếu ở backend cũ -> coi như cấu hình chung. */
  pham_vi?: PhamViCauHinh;
}

export interface TinhCoCauHinh {
  tinh_id: string;
  ten_tinh: string;
}

/** Công khai: cấu hình chung, hoặc của khóa gắn tỉnh `tinh` (tỉnh không gắn khóa -> chung). */
export function layCauHinhKhaoSat(tinh?: string | null) {
  const q = tinh ? `?tinh=${encodeURIComponent(tinh)}` : '';
  return apiFetch<KetQuaCauHinhKhaoSat>(`/cau-hinh-khao-sat${q}`, { coXacThuc: false });
}

/** Công khai: các tỉnh có khóa dùng cấu hình riêng (ô "Chọn tỉnh/thành" ở trang chủ). */
export function layDanhSachTinhKhaoSat() {
  return apiFetch<TinhCoCauHinh[]>('/cau-hinh-khao-sat/tinh', { coXacThuc: false });
}

/** Học viên đã đăng nhập: cấu hình theo khóa đã ghi danh (không có -> chung). */
export function layCauHinhCuaToi() {
  return apiFetch<KetQuaCauHinhKhaoSat>('/cau-hinh-khao-sat/cua-toi');
}

// ---- Quản trị: cấu hình riêng theo khóa ----
export function layCauHinhKhoa(khoaId: string) {
  return apiFetch<KetQuaCauHinhKhaoSat>(`/cau-hinh-khao-sat/khoa/${khoaId}`);
}

export function luuCauHinhKhoa(khoaId: string, cauHinh: CauHinhKhaoSat, tinhId: string | null) {
  return apiFetch<KetQuaCauHinhKhaoSat>(`/cau-hinh-khao-sat/khoa/${khoaId}`, {
    method: 'PUT',
    body: JSON.stringify({ ...cauHinh, tinh_id: tinhId }),
  });
}

export function xoaCauHinhKhoa(khoaId: string) {
  return apiFetch<void>(`/cau-hinh-khao-sat/khoa/${khoaId}`, { method: 'DELETE' });
}

export function luuCauHinhKhaoSat(cauHinh: CauHinhKhaoSat) {
  return apiFetch<KetQuaCauHinhKhaoSat>('/cau-hinh-khao-sat', {
    method: 'PUT',
    body: JSON.stringify(cauHinh),
  });
}
