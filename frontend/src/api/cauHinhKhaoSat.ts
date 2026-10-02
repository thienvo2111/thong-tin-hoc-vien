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
  phieu: PhieuKhaoSat[];
}

export interface KetQuaCauHinhKhaoSat {
  /** null = quản trị chưa lưu lần nào — dùng giá trị mặc định trong content/trienKhai.ts. */
  cau_hinh: CauHinhKhaoSat | null;
  cap_nhat_luc: string | null;
}

export function layCauHinhKhaoSat() {
  return apiFetch<KetQuaCauHinhKhaoSat>('/cau-hinh-khao-sat', { coXacThuc: false });
}

export function luuCauHinhKhaoSat(cauHinh: CauHinhKhaoSat) {
  return apiFetch<KetQuaCauHinhKhaoSat>('/cau-hinh-khao-sat', {
    method: 'PUT',
    body: JSON.stringify(cauHinh),
  });
}
