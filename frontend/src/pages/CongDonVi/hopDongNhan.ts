import type { ChuongTrinhBoiDuong } from '@/api/dotTrienKhai';
import type { TrangThaiDanhSachTruong, TrangThaiHopDong } from '@/api/truongDanhSach';
import { dinhDangTien } from '@/lib/ngayLich';

// Issue #60 / ADR 0015 U1, X1, M5: nhãn ngắn dùng trên trang chủ trường và màn danh sách của trường.
export const NHAN_CHUONG_TRINH_NGAN: Record<ChuongTrinhBoiDuong, string> = { hsg: 'HSG', nls: 'NLS' };

export const TRANG_THAI_DANH_SACH: Record<TrangThaiDanhSachTruong, { nhan: string; mau: string }> = {
  cho_xac_nhan: { nhan: 'Chờ xác nhận', mau: 'yellow' },
  da_xac_nhan: { nhan: 'Đã xác nhận', mau: 'green' },
  bao_sai_lech: { nhan: 'Báo sai lệch', mau: 'red' },
};

export const TRANG_THAI_HOP_DONG: Record<TrangThaiHopDong, { nhan: string; mau: string }> = {
  chua_nop: { nhan: 'Chưa nộp', mau: 'gray' },
  da_nop: { nhan: 'Đã nộp', mau: 'green' },
};

/** ADR 0015 S5: giá trị tạm tính đã làm tròn ở backend; null → chưa có đơn giá (không hiện số). */
export function dinhDangGiaTri(giaTri: number | null): string {
  return giaTri === null ? 'Chưa có đơn giá' : dinhDangTien(giaTri);
}
