import type { GiaiDoanThamGia } from '@/api/danhSachThamGia';

// Issue #58: nhãn dùng chung cho màn Danh sách tham gia.
export const NHAN_GIAI_DOAN: Record<GiaiDoanThamGia, string> = {
  ca_hai: 'Cả 2',
  chi_gd1: 'Chỉ GĐ1',
  chi_gd2: 'Chỉ GĐ2',
};

/** 0.5 → '0,5'; 12 → '12'. */
export function dinhDangSuat(suat: number): string {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(suat);
}
