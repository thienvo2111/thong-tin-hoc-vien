import * as ExcelJS from 'exceljs';
import { NHAN_LOAI_LOP } from '../doi-buoi-hoc/thong-ke-doi-buoi.excel';
import { nhanDoiTuong, oKhaoSat, tenSheet } from './xuat-danh-sach-cum.util';

// ADR 0008 L5: file xuất danh sách LỚP cho người hỗ trợ theo lớp. CÓ NGÀY SINH
// theo yêu cầu người dùng (để đối chiếu khi hỗ trợ Zoom) — lưu ý ngày sinh =
// mật khẩu mặc định, file có thể bị chuyển qua Zalo; người dùng đã chấp nhận
// rủi ro (ADR 0008). Khác ADR 0003 H6 — H6 chỉ áp cho file cụm. Có MÃ MOET
// theo yêu cầu người dùng 2026-10-17 (ô văn bản, giữ số 0 đầu). Vẫn KHÔNG có
// số định danh/CCCD, nơi sinh. ADR 0008 L8: thêm cột chuyên cần "x/y".

/** Cột chung của file lớp và file buổi. */
export interface DongXuatCoBan {
  ho_ten: string;
  ma_dinh_danh_moet: string | null;
  ngay_sinh: string; // dd/mm/yyyy
  don_vi_cong_tac_ten: string;
  doi_tuong: string | null;
  so_dien_thoai_lien_he: string | null;
  email_lien_he: string | null;
  cum: string | null;
  day_du: boolean;
  dang_nhap_lan_cuoi: Date | null;
  khao_sat: { loai: string; trang_thai: string }[];
}

export interface DongXuatLop extends DongXuatCoBan {
  chuyen_can: { co_mat: number; da_dien_ra: number };
}

export interface SheetLop {
  ten_lop: string;
  loai_lop: string;
  khoa: { ma_khoa: string; ten_khoa: string };
  hoc_vien: DongXuatLop[];
}

export const COT_CO_BAN = [
  'STT',
  'Họ tên',
  'Mã MOET',
  'Ngày sinh',
  'Đơn vị công tác',
  'Đối tượng',
  'Số điện thoại',
  'Email',
  'Cụm hỗ trợ',
  'Hồ sơ đầy đủ',
  'Đã đăng nhập',
  'Khảo sát',
];

export const COT_CHUYEN_CAN = 'Có mặt / đã diễn ra';
export const COT_DANH_SACH_LOP = [...COT_CO_BAN, COT_CHUYEN_CAN];

const pad2 = (n: number) => String(n).padStart(2, '0');

/** dd/mm/yyyy từ 3 cột ngày/tháng/năm sinh của hồ sơ. */
export function dinhDangNgaySinh(ngay: number, thang: number, nam: number) {
  return `${pad2(ngay)}/${pad2(thang)}/${nam}`;
}

export async function buildDanhSachLopWorkbook(
  sheets: SheetLop[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const daDung = new Set<string>();
  if (sheets.length === 0) wb.addWorksheet('Danh sách');
  for (const s of sheets) {
    const ws = wb.addWorksheet(tenSheet(s.ten_lop, daDung));
    ws.addRow([tieuDeLop(s)]).font = { bold: true, size: 12 };
    ws.addRow(COT_DANH_SACH_LOP).font = { bold: true };
    s.hoc_vien.forEach((h, i) =>
      ws.addRow([...oDongCoBan(h, i + 1), oChuyenCan(h.chuyen_can)]),
    );
    datDoRongCot(ws);
    ws.views = [{ state: 'frozen', ySplit: 2 }];
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Tiêu đề đầu sheet: khóa · loại lớp: tên lớp. */
export function tieuDeLop(s: Omit<SheetLop, 'hoc_vien'>): string {
  const loai = NHAN_LOAI_LOP[s.loai_lop as keyof typeof NHAN_LOAI_LOP];
  return `Khóa ${s.khoa.ma_khoa} – ${s.khoa.ten_khoa} · Lớp ${loai ?? s.loai_lop}: ${s.ten_lop}`;
}

/** "x/y" — số buổi có mặt / số buổi đã diễn ra. */
export function oChuyenCan(c: { co_mat: number; da_dien_ra: number }) {
  return `${c.co_mat}/${c.da_dien_ra}`;
}

/** Các ô của 1 dòng học viên theo COT_CO_BAN (mã MOET để dạng văn bản). */
export function oDongCoBan(h: DongXuatCoBan, stt: number): (string | number)[] {
  return [
    stt,
    h.ho_ten,
    h.ma_dinh_danh_moet ?? '',
    h.ngay_sinh,
    h.don_vi_cong_tac_ten,
    nhanDoiTuong(h.doi_tuong),
    h.so_dien_thoai_lien_he ?? '',
    h.email_lien_he ?? '',
    h.cum ?? '',
    h.day_du ? 'Đủ' : 'Chưa đủ',
    h.dang_nhap_lan_cuoi ? 'Rồi' : 'Chưa',
    oKhaoSat(h.doi_tuong, h.khao_sat),
  ];
}

export function datDoRongCot(ws: ExcelJS.Worksheet) {
  ws.columns.forEach((c) => (c.width = 16));
  ws.getColumn(1).width = 6;
  ws.getColumn(2).width = 28;
  ws.getColumn(3).numFmt = '@';
  ws.getColumn(5).width = 36;
}
