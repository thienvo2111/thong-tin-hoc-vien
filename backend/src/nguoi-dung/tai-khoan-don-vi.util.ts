import { randomInt } from 'crypto';
import { loai_don_vi } from '@prisma/client';

// Tài khoản đơn vị (ADR 0002). Bỏ các ký tự dễ đọc nhầm khi gửi qua Zalo /
// đọc qua điện thoại: 0 O o 1 l I L.
export const MAT_KHAU_TAM_KY_TU =
  'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const DO_DAI_MAT_KHAU_TAM = 10;

export const THOI_HAN_KICH_HOAT_MS = 72 * 60 * 60 * 1000;

const TEN_DANG_NHAP_REGEX = /^[a-z0-9][a-z0-9._-]{2,49}$/;

export type VaiTroDonVi = 'so_gddt' | 'phong_vhxh' | 'truong';
export const VAI_TRO_DON_VI: VaiTroDonVi[] = ['so_gddt', 'phong_vhxh', 'truong'];

export function sinhMatKhauTam(): string {
  for (;;) {
    let mk = '';
    for (let i = 0; i < DO_DAI_MAT_KHAU_TAM; i++) {
      mk += MAT_KHAU_TAM_KY_TU[randomInt(MAT_KHAU_TAM_KY_TU.length)];
    }
    if (/[A-Za-z]/.test(mk) && /[0-9]/.test(mk)) return mk;
  }
}

export function chuanHoaTenDangNhap(raw: string): string {
  return raw.trim().toLowerCase();
}

export function laTenDangNhapHopLe(s: string): boolean {
  return TEN_DANG_NHAP_REGEX.test(s);
}

export function vaiTroTheoLoaiDonVi(loai: loai_don_vi): VaiTroDonVi | null {
  return (VAI_TRO_DON_VI as string[]).includes(loai)
    ? (loai as VaiTroDonVi)
    : null;
}
