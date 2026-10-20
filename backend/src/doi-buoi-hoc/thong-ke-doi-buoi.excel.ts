import * as ExcelJS from 'exceljs';
import { loai_doi_buoi, loai_lop_hoc, muc_nang_luc } from '@prisma/client';
import { gioVn, ngayVn } from '../nhac-lich/nhac-lich.util';
import { NHAN_MUC } from '../khoa-boi-duong/util/muc-hoc.util';

// Tab Thống kê đổi buổi — file xuất 2 sheet. Sheet "Học viên" có PII (họ tên,
// đơn vị, cụm) như các file xuất danh sách khác; service ghi nhật ký mỗi lần xuất.

export interface DongThongKeExcel {
  lich: {
    buoi_so: number;
    thoi_gian_bat_dau: Date;
    thoi_gian_ket_thuc: Date | null;
    lop: {
      ten_lop: string;
      muc_nang_luc: muc_nang_luc | null;
      loai_lop: loai_lop_hoc;
    };
    giai_doan: { thu_tu: number; ten_giai_doan: string };
    khoa: { ma_khoa: string; ten_khoa: string };
  };
  si_so_phan_lop: number;
  si_so: number;
  si_so_toi_da: number | null;
  day: boolean;
  ra_da_duyet: number;
  ra_cho: number;
  ra_qua_han: number;
  ra_tu_choi: number;
  ra_huy: number;
  vao_da_duyet: number;
  vao_cho: number;
  vao_qua_han: number;
  vao_tu_choi: number;
  vao_huy: number;
  /** ADR 0012: học bù đã duyệt vào buổi (thiếu = 0). */
  vao_hoc_bu?: number;
}

export interface DongHocVienExcel {
  ho_ten: string;
  don_vi: string;
  cum: string;
  buoi_goc: string;
  buoi_de_nghi: string;
  buoi_chot: string;
  trang_thai: string;
  gui_luc: Date;
  xu_ly_luc: Date | null;
  nguoi_xu_ly: string;
  ly_do: string;
  /** ADR 0012: "Đổi buổi" / "Học bù" (thiếu = Đổi buổi). */
  loai?: string;
}

export interface DuLieuExcelThongKe {
  mo_ta_bo_loc: string;
  ngay_xuat: Date;
  dong: DongThongKeExcel[];
  hoc_vien: DongHocVienExcel[];
}

export { NHAN_MUC };

export const NHAN_LOAI_DOI_BUOI: Record<loai_doi_buoi, string> = {
  doi_buoi: 'Đổi buổi',
  hoc_bu: 'Học bù',
};

export const NHAN_LOAI_LOP: Record<loai_lop_hoc, string> = {
  truc_tiep: 'Trực tiếp',
  zoom: 'Zoom',
  vle: 'VLE',
};

const TIEU_DE = 'THỐNG KÊ ĐỀ NGHỊ ĐỔI BUỔI HỌC';
const HANG_TIEU_DE = 4;

const COT_BUOI = [
  'Khóa',
  'Giai đoạn',
  'Lớp',
  'Trình độ',
  'Hình thức',
  'Buổi',
  'Ngày',
  'Giờ',
  'Sĩ số phân lớp',
  'Sĩ số buổi',
  'Tối đa',
  'Đầy',
  'Ra đã duyệt',
  'Ra chờ',
  'Ra quá hạn',
  'Ra từ chối',
  'Ra hủy',
  'Vào đã duyệt',
  'Vào chờ',
  'Vào quá hạn',
  'Vào từ chối',
  'Vào hủy',
  'Học bù vào (đã duyệt)',
];

const COT_HOC_VIEN = [
  'Học viên',
  'Đơn vị',
  'Cụm',
  'Buổi gốc',
  'Buổi đề nghị',
  'Buổi chốt',
  'Trạng thái',
  'Gửi lúc',
  'Xử lý lúc',
  'Người xử lý',
  'Lý do',
  'Loại',
];

/** "dd/mm/yyyy HH:mm" giờ Việt Nam. */
export function ngayGioVn(d: Date): string {
  return `${ngayVn(d).split(', ')[1]} ${gioVn(d)}`;
}

/** 3 dòng đầu: tên biểu mẫu, bộ lọc đang áp dụng, ngày xuất; dòng 4 là tiêu đề cột (đậm, cố định). */
function themDauSheet(
  ws: ExcelJS.Worksheet,
  du: DuLieuExcelThongKe,
  cot: string[],
): void {
  const dong: [string, Partial<ExcelJS.Font>?][] = [
    [TIEU_DE, { bold: true, size: 14 }],
    [`Bộ lọc: ${du.mo_ta_bo_loc}`],
    [`Ngày xuất: ${ngayGioVn(du.ngay_xuat)}`],
  ];
  dong.forEach(([chu, font], i) => {
    ws.mergeCells(i + 1, 1, i + 1, cot.length);
    const o = ws.getCell(i + 1, 1);
    o.value = chu;
    if (font) o.font = font as ExcelJS.Font;
  });
  const hang = ws.getRow(HANG_TIEU_DE);
  hang.values = cot;
  hang.font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: HANG_TIEU_DE }];
}

export async function buildThongKeDoiBuoiWorkbook(
  du: DuLieuExcelThongKe,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  const s1 = wb.addWorksheet('Thống kê theo buổi');
  themDauSheet(s1, du, COT_BUOI);
  for (const d of du.dong) {
    const l = d.lich;
    s1.addRow([
      `${l.khoa.ma_khoa} – ${l.khoa.ten_khoa}`,
      `GĐ${l.giai_doan.thu_tu} – ${l.giai_doan.ten_giai_doan}`,
      l.lop.ten_lop,
      l.lop.muc_nang_luc ? NHAN_MUC[l.lop.muc_nang_luc] : '',
      NHAN_LOAI_LOP[l.lop.loai_lop],
      l.buoi_so,
      ngayVn(l.thoi_gian_bat_dau),
      `${gioVn(l.thoi_gian_bat_dau)}${l.thoi_gian_ket_thuc ? `–${gioVn(l.thoi_gian_ket_thuc)}` : ''}`,
      d.si_so_phan_lop,
      d.si_so,
      d.si_so_toi_da ?? '',
      d.day ? 'x' : '',
      d.ra_da_duyet,
      d.ra_cho,
      d.ra_qua_han,
      d.ra_tu_choi,
      d.ra_huy,
      d.vao_da_duyet,
      d.vao_cho,
      d.vao_qua_han,
      d.vao_tu_choi,
      d.vao_huy,
      d.vao_hoc_bu ?? 0,
    ]);
  }
  COT_BUOI.forEach((_, i) => (s1.getColumn(i + 1).width = i < 8 ? 16 : 11));
  s1.getColumn(1).width = 28;
  s1.getColumn(3).width = 24;
  s1.getColumn(7).width = 22;

  const s2 = wb.addWorksheet('Học viên');
  themDauSheet(s2, du, COT_HOC_VIEN);
  for (const h of du.hoc_vien) {
    s2.addRow([
      h.ho_ten,
      h.don_vi,
      h.cum,
      h.buoi_goc,
      h.buoi_de_nghi,
      h.buoi_chot,
      h.trang_thai,
      ngayGioVn(h.gui_luc),
      h.xu_ly_luc ? ngayGioVn(h.xu_ly_luc) : '',
      h.nguoi_xu_ly,
      h.ly_do,
      h.loai ?? NHAN_LOAI_DOI_BUOI.doi_buoi,
    ]);
  }
  COT_HOC_VIEN.forEach((_, i) => (s2.getColumn(i + 1).width = 18));
  [1, 2, 4, 5, 6, 7, 11].forEach((c) => (s2.getColumn(c).width = 32));

  return Buffer.from(await wb.xlsx.writeBuffer());
}
