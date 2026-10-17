import * as ExcelJS from 'exceljs';
import { gioVn, ngayVn } from '../nhac-lich/nhac-lich.util';
import { tenSheet } from './xuat-danh-sach-cum.util';
import {
  COT_CO_BAN,
  datDoRongCot,
  DongXuatCoBan,
  oDongCoBan,
  SheetLop,
  tieuDeLop,
} from './xuat-danh-sach-lop.util';
import { DiemDanhDong, TongDiemDanh } from './diem-danh-lop-buoi.util';

// ADR 0008 L7: file danh sách THEO BUỔI cho người hỗ trợ lớp. Cùng cột với file
// lớp (có ngày sinh — L5) + cột Ghi chú. Danh sách buổi = phân lớp − đổi ra +
// đổi vào (DoiBuoiHocQueryService); người đổi ra liệt kê riêng ở cuối sheet.
// ADR 0008 L8: thêm cột Điểm danh + Giờ tự điểm danh và dòng tổng hợp điểm
// danh ở đầu sheet (người đổi ra không có điểm danh tại buổi này).

export interface DongXuatBuoi extends DongXuatCoBan {
  ghi_chu: string | null;
  diem_danh: DiemDanhDong | null;
}

export interface BuoiXuat {
  giai_doan: { thu_tu: number; ten_giai_doan: string };
  buoi_so: number;
  thoi_gian_bat_dau: Date;
  thoi_gian_ket_thuc: Date;
  tong_diem_danh: TongDiemDanh;
}

export interface SheetBuoi {
  lop: Omit<SheetLop, 'hoc_vien'>;
  buoi: BuoiXuat;
  hoc_vien: DongXuatBuoi[];
  doi_ra: DongXuatBuoi[];
}

export const COT_DANH_SACH_BUOI = [
  ...COT_CO_BAN,
  'Điểm danh',
  'Giờ tự điểm danh',
  'Ghi chú',
];
export const TIEU_DE_DOI_RA = 'Đã chuyển sang lớp khác (không học buổi này)';

const p2 = (n: number) => String(n).padStart(2, '0');

/** "dd-mm" theo giờ Việt Nam — dùng trong tên sheet. */
function ngayThangVn(d: Date): string {
  const v = new Date(d.getTime() + 7 * 3600 * 1000);
  return `${p2(v.getUTCDate())}-${p2(v.getUTCMonth() + 1)}`;
}

export function tenSheetBuoi(b: BuoiXuat): string {
  return `GĐ${b.giai_doan.thu_tu} B${b.buoi_so} ${ngayThangVn(b.thoi_gian_bat_dau)}`;
}

/** "dd/mm/yyyy HH:mm" theo giờ Việt Nam. */
export function ngayGioVn(d: Date): string {
  const v = new Date(d.getTime() + 7 * 3600 * 1000);
  return `${p2(v.getUTCDate())}/${p2(v.getUTCMonth() + 1)}/${v.getUTCFullYear()} ${p2(v.getUTCHours())}:${p2(v.getUTCMinutes())}`;
}

/** Dòng tổng hợp điểm danh của buổi (dùng chung với màn hình). */
export function moTaTongDiemDanh(t: TongDiemDanh): string {
  return `Có mặt ${t.co_mat} · Vắng ${t.vang} · Có phép ${t.vang_co_phep} · Báo vắng ${t.da_bao_vang} · Chưa điểm danh ${t.chua_diem_danh}`;
}

function oDongBuoi(h: DongXuatBuoi, stt: number) {
  const tu = h.diem_danh?.tu_diem_danh_luc;
  return [
    ...oDongCoBan(h, stt),
    h.diem_danh?.nhan ?? '',
    tu ? ngayGioVn(new Date(tu)) : '',
    h.ghi_chu ?? '',
  ];
}

export function moTaBuoi(b: BuoiXuat): string {
  return `Buổi ${b.buoi_so} – GĐ${b.giai_doan.thu_tu} ${b.giai_doan.ten_giai_doan} · ${ngayVn(b.thoi_gian_bat_dau)} ${gioVn(b.thoi_gian_bat_dau)}–${gioVn(b.thoi_gian_ket_thuc)}`;
}

export async function buildDanhSachBuoiWorkbook(
  sheets: SheetBuoi[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const daDung = new Set<string>();
  if (sheets.length === 0) wb.addWorksheet('Danh sách');
  for (const s of sheets) {
    const ws = wb.addWorksheet(tenSheet(tenSheetBuoi(s.buoi), daDung));
    ws.addRow([tieuDeLop(s.lop)]).font = { bold: true, size: 12 };
    ws.addRow([`${moTaBuoi(s.buoi)} · ${s.hoc_vien.length} học viên`]).font = {
      bold: true,
    };
    ws.addRow([`Điểm danh: ${moTaTongDiemDanh(s.buoi.tong_diem_danh)}`]);
    ws.addRow(COT_DANH_SACH_BUOI).font = { bold: true };
    s.hoc_vien.forEach((h, i) => ws.addRow(oDongBuoi(h, i + 1)));
    if (s.doi_ra.length > 0) {
      ws.addRow([]);
      ws.addRow([TIEU_DE_DOI_RA]).font = { bold: true };
      s.doi_ra.forEach((h, i) => ws.addRow(oDongBuoi(h, i + 1)));
    }
    datDoRongCot(ws);
    ws.getColumn(COT_DANH_SACH_BUOI.length - 2).width = 36;
    ws.getColumn(COT_DANH_SACH_BUOI.length).width = 44;
    ws.views = [{ state: 'frozen', ySplit: 4 }];
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
