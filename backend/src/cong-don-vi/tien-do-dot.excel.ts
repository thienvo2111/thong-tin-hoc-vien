import * as ExcelJS from 'exceljs';
import type {
  trang_thai_danh_sach_truong,
  trang_thai_hop_dong,
} from '@prisma/client';
import { ngayTenFile, slugTenDot } from './sua-dong-danh-sach';

// Issue #65 / ADR 0015 T5: Excel các trường chưa xong (chưa nộp hợp đồng) kèm người liên hệ từ Hồ sơ đơn vị
// Phần 1 — để HCMUE tự nhắc qua Zalo/điện thoại. Có SĐT/email → controller trả no-store, service ghi nhật ký.

export const TEN_SHEET_TIEN_DO = 'Trường chưa xong';

export const COT_TIEN_DO = [
  'STT',
  'Mã trường',
  'Tên trường',
  'Số người',
  'Tổng suất',
  'Giá trị',
  'Trạng thái danh sách',
  'Đề nghị chờ',
  'Hồ sơ đơn vị',
  'Trạng thái hợp đồng',
  'Hạn hiệu lực',
  'Hạn riêng',
  'Thao tác gần nhất',
  'Người liên hệ',
  'SĐT liên hệ',
  'Email',
] as const;

export const CHUA_KHAI_HO_SO = 'Chưa khai hồ sơ';
/** Issue #66: đánh dấu trường có hạn riêng (ô trống = theo hạn đợt). */
export const CO_HAN_RIENG = 'Có';

export type TinhTrangHoSoTienDo = 'du' | 'con_thieu' | 'chua_khai';

export const NHAN_HO_SO: Record<TinhTrangHoSoTienDo, string> = {
  du: 'Đủ',
  con_thieu: 'Còn thiếu',
  chua_khai: 'Chưa khai',
};

export const NHAN_DANH_SACH: Record<trang_thai_danh_sach_truong, string> = {
  cho_xac_nhan: 'Chờ xác nhận',
  da_xac_nhan: 'Đã xác nhận',
  bao_sai_lech: 'Báo sai lệch',
};

export const NHAN_HOP_DONG: Record<trang_thai_hop_dong, string> = {
  chua_nop: 'Chưa nộp',
  da_nop: 'Đã nộp',
};

export interface DongXuatTienDo {
  ma: string | null;
  ten: string;
  so_nguoi: number;
  tong_suat: number;
  gia_tri: number | null;
  trang_thai_danh_sach: trang_thai_danh_sach_truong;
  so_de_nghi_cho: number;
  ho_so: TinhTrangHoSoTienDo;
  trang_thai_hop_dong: trang_thai_hop_dong;
  /** Issue #66: ngày hạn hiệu lực 'YYYY-MM-DD' (giờ VN) + trường có hạn riêng không. */
  han_hieu_luc_ngay: string;
  co_han_rieng: boolean;
  thao_tac_cuoi_luc: Date | null;
  /** null = trường chưa khai hồ sơ. */
  lien_he: {
    nguoi: string | null;
    sdt: string | null;
    email: string | null;
  } | null;
}

const LECH_GIO_VN_MS = 7 * 60 * 60 * 1000;

/** exceljs ghi Date theo UTC → dời +7 giờ để ô hiện đúng giờ Việt Nam. */
function oGioVietNam(luc: Date | null): Date | null {
  return luc ? new Date(luc.getTime() + LECH_GIO_VN_MS) : null;
}

const DO_RONG = [6, 16, 40, 10, 10, 16, 20, 12, 14, 18, 14, 10, 18, 26, 14, 30];

/** Ô ngày: 'YYYY-MM-DD' → Date 00:00Z (exceljs ghi theo UTC → ô hiện đúng ngày, không lệch múi giờ). */
function oNgay(ngay: string): Date {
  return new Date(`${ngay}T00:00:00Z`);
}

export async function taoFileTienDo(ds: DongXuatTienDo[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(TEN_SHEET_TIEN_DO, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sheet.addRow([...COT_TIEN_DO]);
  sheet.getRow(1).font = { bold: true };
  DO_RONG.forEach((w, i) => (sheet.getColumn(i + 1).width = w));
  // Text: giữ số 0 đầu của mã trường / SĐT.
  for (const c of [2, 15]) sheet.getColumn(c).numFmt = '@';
  sheet.getColumn(6).numFmt = '#,##0';
  sheet.getColumn(11).numFmt = 'dd/mm/yyyy';
  sheet.getColumn(13).numFmt = 'dd/mm/yyyy hh:mm';
  ds.forEach((d, i) => {
    sheet.addRow([
      i + 1,
      d.ma,
      d.ten,
      d.so_nguoi,
      d.tong_suat,
      d.gia_tri,
      NHAN_DANH_SACH[d.trang_thai_danh_sach],
      d.so_de_nghi_cho,
      NHAN_HO_SO[d.ho_so],
      NHAN_HOP_DONG[d.trang_thai_hop_dong],
      oNgay(d.han_hieu_luc_ngay),
      d.co_han_rieng ? CO_HAN_RIENG : null,
      oGioVietNam(d.thao_tac_cuoi_luc),
      d.lien_he ? d.lien_he.nguoi : CHUA_KHAI_HO_SO,
      d.lien_he?.sdt ?? null,
      d.lien_he?.email ?? null,
    ]);
  });
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: COT_TIEN_DO.length },
  };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** tien-do-<slug đợt>-chua-xong-<YYYYMMDD theo giờ Việt Nam>.xlsx */
export function tenFileTienDo(tenDot: string, luc: Date): string {
  return `tien-do-${slugTenDot(tenDot)}-chua-xong-${ngayTenFile(luc)}.xlsx`;
}
