import { apiFetch } from './client';
import type { DangNhapResponse, ThongTinToi } from './types';

export function dangNhap(ten_dang_nhap: string, mat_khau: string) {
  return apiFetch<DangNhapResponse>('/auth/dang-nhap', {
    method: 'POST',
    coXacThuc: false,
    body: JSON.stringify({ ten_dang_nhap, mat_khau }),
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
