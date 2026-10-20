import * as ExcelJS from 'exceljs';
import type { muc_nang_luc, nguon_moc_nhu_cau } from '@prisma/client';
import { NHAN_MUC } from '../khoa-boi-duong/util/muc-hoc.util';
import type { TongDiHoc } from '../ho-tro-hoc-vien/diem-danh-lop-buoi.util';
import { thoiDiemVn } from '../hoc-vien/util/danh-sach-hoc-vien-truong-excel.util';
import { tongHopNhuCauMucDot } from './nhu-cau-muc-dot.tong-hop';
import { DongNhuCauMucDot, DotThongKe, MoTaBieuMau } from './thong-ke.types';

// GET /thong-ke/nhu-cau-muc-dot/xuat-excel (ADR 0013 D9) — sheet "Danh sách"
// có PII, mỗi đăng ký 1 dòng; chưa chọn vẫn có dòng "Chưa chọn".

export const NHAN_NGUON_MOC: Record<nguon_moc_nhu_cau, string> = {
  lop: 'Lớp',
  muc_chot: 'Mức chốt',
};

const COT: { nhan: string; rong: number; text?: boolean }[] = [
  { nhan: 'STT', rong: 6 },
  { nhan: 'Họ tên', rong: 28 },
  { nhan: 'Mã MOET', rong: 18, text: true },
  { nhan: 'SĐT', rong: 14, text: true },
  { nhan: 'Đơn vị', rong: 30 },
  { nhan: 'Trường', rong: 30 },
  { nhan: 'Lớp hiện tại', rong: 22 },
  { nhan: 'Mức hiện tại', rong: 14 },
  { nhan: 'Nguồn mốc', rong: 12 },
  { nhan: 'Lớp lúc chọn', rong: 22 },
  { nhan: 'Mức lúc chọn', rong: 14 },
  { nhan: 'Nhu cầu chọn', rong: 14 },
  { nhan: 'Chọn lúc', rong: 18 },
  { nhan: 'Cập nhật lúc', rong: 18 },
  { nhan: 'Buổi đã diễn ra', rong: 12 },
  { nhan: 'Buổi có mặt', rong: 12 },
  { nhan: 'Buổi vắng', rong: 12 },
  { nhan: 'Vắng có phép', rong: 12 },
  { nhan: 'Đã báo vắng', rong: 12 },
  { nhan: 'Chưa điểm danh', rong: 12 },
  { nhan: '# Mức chốt', rong: 14 },
  { nhan: '# Nhu cầu lần 1', rong: 16 },
];

export const COT_NHU_CAU_MUC_DOT = COT.map((c) => c.nhan);
export const CHUA_CHON = 'Chưa chọn';
const GHI_CHU_SO_BUOI =
  'Số buổi tính đến thời điểm xuất, cùng cách tính màn Tình hình đi học';

/** Tổng đi học theo dang_ky_hoc_id; thiếu = 0 buổi. */
export type SoBuoiTheoDangKy = ReadonlyMap<string, TongDiHoc>;

const BORDER_MONG: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};
const NEN_HEADER: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE7E6E6' },
};

const muc = (m: muc_nang_luc | null | undefined) => (m ? NHAN_MUC[m] : '');
const gio = (d: Date | null | undefined) => (d ? thoiDiemVn(d) : '');

function giaTriDong(
  d: DongNhuCauMucDot,
  stt: number,
  t: TongDiHoc | undefined,
): (string | number)[] {
  const lc = d.lua_chon;
  return [
    stt,
    d.hoc_vien.ho_ten,
    d.hoc_vien.ma_moet ?? '',
    d.hoc_vien.so_dien_thoai ?? '',
    d.hoc_vien.don_vi.ten,
    d.hoc_vien.truong?.ten ?? '',
    d.lop_hien_tai ?? '',
    muc(d.moc_hien_tai?.muc),
    d.moc_hien_tai ? NHAN_NGUON_MOC[d.moc_hien_tai.nguon] : '',
    lc?.lop_luc_chon ?? '',
    muc(lc?.muc_moc),
    lc ? NHAN_MUC[lc.muc_chon] : CHUA_CHON,
    gio(lc?.chon_luc),
    gio(lc?.cap_nhat_luc),
    t?.da_dien_ra ?? 0,
    t?.co_mat ?? 0,
    t?.vang ?? 0,
    t?.vang_co_phep ?? 0,
    t?.da_bao_vang ?? 0,
    t?.chua_diem_danh ?? 0,
    muc(d.muc_dau_vao),
    muc(d.muc_hoc_chon),
  ];
}

function oHeader(o: ExcelJS.Cell, chu: string) {
  o.value = chu;
  o.font = { bold: true };
  o.fill = NEN_HEADER;
  o.border = BORDER_MONG;
  o.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
}

/** Tiêu đề chung (merge ngang soCot cột); trả về số dòng đã dùng. */
function tieuDe(
  sheet: ExcelJS.Worksheet,
  dot: DotThongKe,
  moTa: MoTaBieuMau,
  soCot: number,
  ghiChu?: string,
): number {
  const dong: [string, Partial<ExcelJS.Font>?][] = [
    ['NHU CẦU MỨC HỌC THEO ĐỢT', { bold: true, size: 14 }],
    [`Khóa: ${dot.ten_khoa} (${dot.ma_khoa}) — Đợt: ${dot.ten_dot}`],
    [`Thời gian đợt: ${thoiDiemVn(dot.mo_luc)} – ${thoiDiemVn(dot.dong_luc)}`],
    [`Phạm vi: ${moTa.pham_vi} — Đối tượng: ${moTa.doi_tuong}`],
    [`Thời điểm xuất: ${thoiDiemVn(moTa.ngay_xuat)}`],
  ];
  if (ghiChu) dong.push([ghiChu, { italic: true }]);
  dong.forEach(([chu, font], i) => {
    sheet.mergeCells(i + 1, 1, i + 1, soCot);
    const o = sheet.getCell(i + 1, 1);
    o.value = chu;
    if (font) o.font = font as ExcelJS.Font;
    o.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  return dong.length;
}

/** Bảng có header ở hàng `r`; trả về hàng cuối đã ghi. */
function bang(
  sheet: ExcelJS.Worksheet,
  r: number,
  header: string[],
  rows: (string | number)[][],
): number {
  header.forEach((h, c) => oHeader(sheet.getCell(r, c + 1), h));
  rows.forEach((row, i) =>
    row.forEach((v, c) => {
      const o = sheet.getCell(r + 1 + i, c + 1);
      o.value = v;
      o.border = BORDER_MONG;
    }),
  );
  return r + rows.length;
}

function sheetTongHop(
  wb: ExcelJS.Workbook,
  dot: DotThongKe,
  rows: DongNhuCauMucDot[],
  moTa: MoTaBieuMau,
) {
  const kq = tongHopNhuCauMucDot(rows);
  const sheet = wb.addWorksheet('Tổng hợp');
  [36, 14, 14, 14, 14, 14].forEach(
    (w, i) => (sheet.getColumn(i + 1).width = w),
  );
  let r = tieuDe(sheet, dot, moTa, 6) + 2;

  const kpi: [string, number][] = [
    ['Đủ điều kiện', kq.tong_du_dieu_kien],
    ['Đã chọn', kq.da_chon],
    ['Chưa chọn', kq.chua_chon],
    ['Tỷ lệ đã chọn (%)', kq.ty_le_da_chon],
  ];
  r = bang(sheet, r, ['Chỉ tiêu', 'Số lượng'], kpi) + 2;

  sheet.getCell(r, 1).value = 'Ma trận Mốc lúc chọn × Nhu cầu chọn';
  sheet.getCell(r, 1).font = { bold: true };
  const muc3: muc_nang_luc[] = ['co_ban', 'thanh_thao', 'nang_cao'];
  const soO = (moc: muc_nang_luc, chon: muc_nang_luc) =>
    kq.ma_tran.find((o) => o.muc_moc === moc && o.muc_chon === chon)
      ?.so_luong ?? 0;
  r =
    bang(
      sheet,
      r + 1,
      ['Mốc \\ Chọn', ...muc3.map((m) => NHAN_MUC[m])],
      muc3.map((moc) => [NHAN_MUC[moc], ...muc3.map((c) => soO(moc, c))]),
    ) + 2;

  sheet.getCell(r, 1).value = 'Theo trường';
  sheet.getCell(r, 1).font = { bold: true };
  bang(
    sheet,
    r + 1,
    ['Trường / đơn vị', 'Tổng', 'Đã chọn', 'Chưa chọn', 'Chọn thấp hơn mốc'],
    kq.theo_truong.map((t) => [
      t.ten,
      t.tong,
      t.da_chon,
      t.chua_chon,
      t.ha_muc,
    ]),
  );
}

function sheetDanhSach(
  wb: ExcelJS.Workbook,
  dot: DotThongKe,
  rows: DongNhuCauMucDot[],
  moTa: MoTaBieuMau,
  soBuoi: SoBuoiTheoDangKy,
) {
  const sheet = wb.addWorksheet('Danh sách');
  const soCot = COT.length;
  const hangHeader = tieuDe(sheet, dot, moTa, soCot, GHI_CHU_SO_BUOI) + 2;
  COT.forEach((c, i) => {
    oHeader(sheet.getCell(hangHeader, i + 1), c.nhan);
    sheet.getColumn(i + 1).width = c.rong;
  });
  rows.forEach((d, i) => {
    giaTriDong(d, i + 1, soBuoi.get(d.dang_ky_hoc_id)).forEach((v, c) => {
      const o = sheet.getCell(hangHeader + 1 + i, c + 1);
      o.value = v;
      o.border = BORDER_MONG;
      if (COT[c].text) o.numFmt = '@';
    });
  });
  sheet.autoFilter = {
    from: { row: hangHeader, column: 1 },
    to: { row: hangHeader, column: soCot },
  };
  sheet.views = [
    { state: 'frozen', xSplit: 2, ySplit: hangHeader } as ExcelJS.WorksheetView,
  ];
}

export async function buildNhuCauMucDotWorkbook(
  dot: DotThongKe,
  rows: DongNhuCauMucDot[],
  moTa: MoTaBieuMau,
  soBuoi: SoBuoiTheoDangKy = new Map(),
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  sheetTongHop(wb, dot, rows, moTa);
  sheetDanhSach(wb, dot, rows, moTa, soBuoi);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
