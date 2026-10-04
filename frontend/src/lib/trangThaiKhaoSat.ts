import type { SsoTarget } from '@/api/hocVien';
import type { TrangThaiKhaoSat } from '@/api/ketQuaKhaoSat';
import type { MucNangLuc } from '@/api/types';

export const TEN_BAI_KHAO_SAT: Record<SsoTarget, string> = {
  'khao-sat': 'Phiếu khảo sát kĩ năng số',
  'danh-gia': 'Phiếu đánh giá năng lực số',
  'dau-ra': 'Khảo sát đầu ra',
};

export const NHAN_MUC_NANG_LUC: Record<MucNangLuc, string> = {
  co_ban: 'Cơ bản',
  thanh_thao: 'Thành thạo',
  nang_cao: 'Nâng cao',
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
