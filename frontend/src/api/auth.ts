import { apiFetch } from './client';
import type { KieuDangNhap } from '@/lib/kieuDangNhap';
import type { DaDatLaiResponse, DaGuiResponse, DaXacMinhResponse, DangNhapResponse, ThongTinToi } from './types';

// 2026-10-09: kieu_dang_nhap tùy chọn ('ma' mặc định ở server) — 'sdt' tìm học viên theo số điện thoại.
export function dangNhap(ten_dang_nhap: string, mat_khau: string, kieu_dang_nhap?: KieuDangNhap) {
  return apiFetch<DangNhapResponse>('/auth/dang-nhap', {
    method: 'POST',
    coXacThuc: false,
    body: JSON.stringify({ ten_dang_nhap, mat_khau, kieu_dang_nhap }),
  });
}

export function dangXuat() {
  return apiFetch<void>('/auth/dang-xuat', { method: 'POST' });
}

export function layThongTinToi() {
  return apiFetch<ThongTinToi>('/auth/toi');
}

export function doiMatKhau(mat_khau_cu: string, mat_khau_moi: string) {
  return apiFetch<void>('/auth/doi-mat-khau', {
    method: 'POST',
    body: JSON.stringify({ mat_khau_cu, mat_khau_moi }),
  });
}

// 2026-09-30: quên/đặt lại mật khẩu — luôn trả cùng 1 dạng response thành công
// bất kể tài khoản có tồn tại/đủ điều kiện hay không (docs/api-contract.md).
export function quenMatKhau(ten_dang_nhap: string, kieu_dang_nhap?: KieuDangNhap) {
  return apiFetch<DaGuiResponse>('/auth/quen-mat-khau', {
    method: 'POST',
    coXacThuc: false,
    body: JSON.stringify({ ten_dang_nhap, kieu_dang_nhap }),
  });
}

export function datLaiMatKhau(token: string, mat_khau_moi: string) {
  return apiFetch<DaDatLaiResponse>('/auth/dat-lai-mat-khau', {
    method: 'POST',
    coXacThuc: false,
    body: JSON.stringify({ token, mat_khau_moi }),
  });
}

export function xacMinhEmail(token: string) {
  return apiFetch<DaXacMinhResponse>('/auth/xac-minh-email', {
    method: 'POST',
    coXacThuc: false,
    body: JSON.stringify({ token }),
  });
}
