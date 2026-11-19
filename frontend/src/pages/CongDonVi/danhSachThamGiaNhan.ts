import type { GiaiDoanThamGia } from '@/api/danhSachThamGia';
import type { YKienTruong } from '@/api/truongDanhSach';

// Issue #58: nhãn dùng chung cho màn Danh sách tham gia.
export const NHAN_GIAI_DOAN: Record<GiaiDoanThamGia, string> = {
  ca_hai: 'Cả 2',
  chi_gd1: 'Chỉ GĐ1',
  chi_gd2: 'Chỉ GĐ2',
};

/** Issue #61 / X2: ý kiến của trường trên 1 dòng ('chua_co' = null). */
export const NHAN_Y_KIEN: Record<YKienTruong | 'chua_co', { nhan: string; mau: string }> = {
  dong_y: { nhan: 'Đồng ý', mau: 'green' },
  khong_dong_y: { nhan: 'Không đồng ý', mau: 'red' },
  chua_co: { nhan: 'Chưa có ý kiến', mau: 'gray' },
};

/** 0.5 → '0,5'; 12 → '12'. */
export function dinhDangSuat(suat: number): string {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(suat);
}
