import { randomInt } from 'crypto';
import { loai_don_vi, vai_tro_nguoi_dung } from '@prisma/client';

// Tài khoản đơn vị (ADR 0002). Bỏ các ký tự dễ đọc nhầm khi gửi qua Zalo /
// đọc qua điện thoại: 0 O o 1 l I L.
export const MAT_KHAU_TAM_KY_TU =
  'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const DO_DAI_MAT_KHAU_TAM = 10;

export const THOI_HAN_KICH_HOAT_MS = 72 * 60 * 60 * 1000;

const TEN_DANG_NHAP_REGEX = /^[a-z0-9][a-z0-9._-]{2,49}$/;

export type VaiTroDonVi = 'so_gddt' | 'phong_vhxh' | 'truong';
export const VAI_TRO_DON_VI: VaiTroDonVi[] = [
  'so_gddt',
  'phong_vhxh',
  'truong',
];

// Tài khoản do Quản trị cấp (đơn vị — ADR 0002, người hỗ trợ học viên — ADR
// 0003): tên đăng nhập lưu chữ thường, đăng nhập khớp không phân biệt hoa/
// thường, có email thì tự lấy lại mật khẩu qua POST /auth/quen-mat-khau.
export const VAI_TRO_TAI_KHOAN_CAP: vai_tro_nguoi_dung[] = [
  ...VAI_TRO_DON_VI,
  'ho_tro_hoc_vien',
  // ADR 0004 L1 (issue #14).
  'ho_tro_giang_vien',
  // ADR 0004 L7 (issue #20).
  'giang_vien',
];

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
