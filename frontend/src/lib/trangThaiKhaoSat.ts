import type { SsoTarget } from '@/api/hocVien';
import type { MucNangLuc } from '@/api/types';
import { NHAN_MUC_NANG_LUC as NHAN_MUC } from '@/lib/mucNangLuc';
import type { TrangThaiKhaoSat } from '@/api/ketQuaKhaoSat';
export { NHAN_MUC_NANG_LUC } from '@/lib/mucNangLuc';

// Khớp backend common/utils/doi-tuong-khao-sat.util.ts (2026-10-10): nhân viên chưa triển khai khảo
// sát – đánh giá. null (chưa khai đối tượng) vẫn phải khảo sát.
const DOI_TUONG_KHONG_KHAO_SAT: readonly string[] = ['nhan_vien'];
export const NHAN_KHONG_AP_DUNG_KHAO_SAT = 'Không áp dụng';

export function phaiKhaoSat(doiTuong: string | null | undefined): boolean {
  return doiTuong == null || !DOI_TUONG_KHONG_KHAO_SAT.includes(doiTuong);
}

export const TEN_BAI_KHAO_SAT: Record<SsoTarget, string> = {
  'khao-sat': 'Phiếu khảo sát kĩ năng số',
  'danh-gia': 'Phiếu đánh giá năng lực số',
  'dau-ra': 'Khảo sát đầu ra',
};

const NHAN_TRANG_THAI: Record<TrangThaiKhaoSat, { nhan: string; mau: string }> = {
  chua_lam: { nhan: 'Chưa làm', mau: 'gray' },
  da_mo: { nhan: 'Đã mở, chưa nộp', mau: 'yellow' },
  dang_lam: { nhan: 'Đang làm', mau: 'blue' },
  hoan_thanh: { nhan: 'Đã hoàn thành', mau: 'green' },
};

/** Nhãn + màu Badge (Mantine) cho trạng thái 1 bài; "cần kiểm tra" ưu tiên hơn trạng thái gốc. */
export function nhanTrangThaiKhaoSat(trangThai: TrangThaiKhaoSat, canKiemTra: boolean): { nhan: string; mau: string } {
  if (canKiemTra) return { nhan: 'Cần kiểm tra lại', mau: 'orange' };
  return NHAN_TRANG_THAI[trangThai];
}

/** Nhãn mức cho người xem: ưu tiên thang gốc của hệ thống khảo sát (vd "M1 – Chưa đạt") để khớp
 * với trang kết quả bên đó; không có thì dùng 3 mức của cổng. */
export function nhanMucKetQua(kq: {
  muc: MucNangLuc | null;
  muc_goc: string | null;
  nhan_muc_goc: string | null;
}): string | null {
  if (kq.muc_goc) return kq.nhan_muc_goc ?? kq.muc_goc;
  return kq.muc ? NHAN_MUC[kq.muc] : null;
}

const so = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 2 });

/** "13,75 / 44 (31,25%)" — thiếu điểm tối đa thì chỉ "13,75". */
export function dinhDangDiem(diem: number | null, toiDa: number | null): string | null {
  if (diem === null) return null;
  if (!toiDa) return so(diem);
  return `${so(diem)} / ${so(toiDa)} (${so((diem / toiDa) * 100)}%)`;
}
