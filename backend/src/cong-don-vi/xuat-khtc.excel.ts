import * as ExcelJS from 'exceljs';
import {
  COT_CHI_HO_TRO_KHTC,
  COT_GIAO_VIEN_KHTC,
  COT_HOP_DONG_KHTC,
  CotKhtc,
  GiaTriO,
  GiaoVienKhtc,
  HopDongKhtc,
  KieuCot,
  TEN_SHEET_CHI_HO_TRO,
  TEN_SHEET_GIAO_VIEN,
  TEN_SHEET_HOP_DONG,
  TONG_CONG,
  dongChiHoTroKhtc,
  dongGiaoVienKhtc,
  dongHopDongKhtc,
  sapXepHopDong,
} from './xuat-khtc';

// Issue #67 / ADR 0015 O1, O4: file Excel 3 sheet cho Phòng KHTC. Có STK cá nhân (đầy đủ) → controller trả
// no-store, service ghi nhật ký mỗi lần xuất.

const DINH_DANG: Partial<Record<KieuCot, string>> = {
  ma: '@',
  ngay: 'dd/mm/yyyy',
  ngay_gio: 'dd/mm/yyyy hh:mm:ss',
  suat: '#,##0.0',
  tien: '#,##0',
};

const DO_RONG: Record<KieuCot, number> = {
  chu: 26,
  ma: 18,
  ngay: 12,
  ngay_gio: 20,
  so: 8,
  suat: 10,
  tien: 14,
};

/** Tiêu đề in đậm + cố định + lọc; định dạng cột theo kiểu; rồi các dòng. */
function themSheet(
  wb: ExcelJS.Workbook,
  ten: string,
  cot: readonly CotKhtc[],
  dong: GiaTriO[][],
): ExcelJS.Worksheet {
  const sheet = wb.addWorksheet(ten, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sheet.addRow(cot.map((c) => c.nhan));
  sheet.getRow(1).font = { bold: true };
  cot.forEach((c, i) => {
    const col = sheet.getColumn(i + 1);
    col.width = DO_RONG[c.kieu];
    const fmt = DINH_DANG[c.kieu];
    if (fmt) col.numFmt = fmt;
  });
  for (const d of dong) sheet.addRow(d);
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: cot.length },
  };
  return sheet;
}

export async function taoFileKhtc(
  hopDong: readonly HopDongKhtc[],
  giaoVien: readonly GiaoVienKhtc[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  themSheet(
    wb,
    TEN_SHEET_HOP_DONG,
    COT_HOP_DONG_KHTC,
    sapXepHopDong(hopDong).map(dongHopDongKhtc),
  );
  themSheet(
    wb,
    TEN_SHEET_GIAO_VIEN,
    COT_GIAO_VIEN_KHTC,
    dongGiaoVienKhtc(giaoVien),
  );
  const chi = dongChiHoTroKhtc(hopDong);
  const sheetChi = themSheet(
    wb,
    TEN_SHEET_CHI_HO_TRO,
    COT_CHI_HO_TRO_KHTC,
    chi.dong,
  );
  // Dòng "Tổng cộng" chỉ khi có dòng chi (đợt chưa ai nộp → file chỉ có tiêu đề).
  if (chi.dong.length) {
    const tong: GiaTriO[] = COT_CHI_HO_TRO_KHTC.map(() => null);
    tong[0] = TONG_CONG;
    tong[tong.length - 1] = chi.tong;
    sheetChi.addRow(tong).font = { bold: true };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
