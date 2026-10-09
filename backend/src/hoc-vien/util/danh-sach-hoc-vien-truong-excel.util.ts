import * as ExcelJS from 'exceljs';
import {
  NHAN_CAP_GIANG_DAY,
  NHAN_TRANG_THAI_HO_SO,
} from '../../bao-cao/util/report-excel.util';
import {
  DOI_TUONG_LABEL,
  GIOI_TINH_LABEL,
} from '../../thong-bao/mau-email/mau-email';

// GET /hoc-vien/xuat-excel — danh sách học viên 1 trường để trường đối chiếu
// (có PII: CCCD, ngày sinh, mã MOET, SĐT, email).

export interface DongHocVienTruong {
  ma_dinh_danh_moet: string | null;
  ho_ten: string;
  ngay_sinh: number;
  thang_sinh: number;
  nam_sinh: number;
  gioi_tinh: string | null;
  so_dinh_danh_ca_nhan: string | null;
  chuc_vu: string | null;
  doi_tuong: string | null;
  cap_giang_day: string | null;
  mon_giang_day: string | null;
  chuyen_mon: string[];
  so_dien_thoai_lien_he: string | null;
  email_lien_he: string | null;
  nguon_tao: string;
  trang_thai: string;
  day_du: boolean;
  thieu: string[];
  ten_dang_nhap: string | null;
  dang_nhap_lan_cuoi: Date | null;
}

export interface MoTaDanhSachTruong {
  ten_truong: string;
  ten_don_vi_quan_ly: string | null;
  thoi_diem_xuat: Date;
}

const NHAN_NGUON_TAO: Record<string, string> = {
  import_moet: 'Import MOET',
  tu_dang_ky: 'Tự đăng ký',
};

// Cột chuỗi giữ số 0 đầu (định dạng Text '@').
const COT: { nhan: string; rong: number; text?: boolean }[] = [
  { nhan: 'STT', rong: 6 },
  { nhan: 'Mã định danh MOET', rong: 18, text: true },
  { nhan: 'Họ tên', rong: 28 },
  { nhan: 'Ngày sinh', rong: 12 },
  { nhan: 'Giới tính', rong: 10 },
  { nhan: 'Số CCCD', rong: 16, text: true },
  { nhan: 'Chức vụ', rong: 18 },
  { nhan: 'Đối tượng', rong: 16 },
  { nhan: 'Cấp giảng dạy', rong: 14 },
  { nhan: 'Môn giảng dạy', rong: 20 },
  { nhan: 'Chuyên môn', rong: 24 },
  { nhan: 'Số điện thoại', rong: 14, text: true },
  { nhan: 'Email', rong: 26 },
  { nhan: 'Nguồn tạo', rong: 13 },
  { nhan: 'Trạng thái hồ sơ', rong: 14 },
  { nhan: 'Hồ sơ đầy đủ', rong: 10 },
  { nhan: 'Còn thiếu', rong: 40 },
  { nhan: 'Tên đăng nhập', rong: 18, text: true },
  { nhan: 'Đăng nhập lần cuối', rong: 18 },
];

export const COT_DANH_SACH_HOC_VIEN_TRUONG = COT.map((c) => c.nhan);

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

const pad2 = (n: number) => String(n).padStart(2, '0');

function ngaySinh(d: DongHocVienTruong): string {
  return `${pad2(d.ngay_sinh)}/${pad2(d.thang_sinh)}/${d.nam_sinh}`;
}

/** dd/mm/yyyy HH:mm theo giờ Việt Nam. */
export function thoiDiemVn(d: Date): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

const nhan = (map: Record<string, string>, v: string | null) =>
  v ? (map[v] ?? v) : '';

function giaTriDong(d: DongHocVienTruong, stt: number): (string | number)[] {
  return [
    stt,
    d.ma_dinh_danh_moet ?? '',
    d.ho_ten,
    ngaySinh(d),
    nhan(GIOI_TINH_LABEL, d.gioi_tinh),
    d.so_dinh_danh_ca_nhan ?? '',
    d.chuc_vu ?? '',
    nhan(DOI_TUONG_LABEL, d.doi_tuong),
    nhan(NHAN_CAP_GIANG_DAY, d.cap_giang_day),
    d.mon_giang_day ?? '',
    d.chuyen_mon.join('; '),
    d.so_dien_thoai_lien_he ?? '',
    d.email_lien_he ?? '',
    nhan(NHAN_NGUON_TAO, d.nguon_tao),
    nhan(NHAN_TRANG_THAI_HO_SO, d.trang_thai),
    d.day_du ? 'Có' : 'Chưa',
    d.thieu.join('; '),
    d.ten_dang_nhap ?? '',
    d.dang_nhap_lan_cuoi ? thoiDiemVn(d.dang_nhap_lan_cuoi) : '',
  ];
}

export async function buildDanhSachHocVienTruongWorkbook(
  moTa: MoTaDanhSachTruong,
  dong: DongHocVienTruong[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Danh sách học viên');
  const soCot = COT.length;

  const tieuDe: [string, Partial<ExcelJS.Font>?][] = [
    [`DANH SÁCH HỌC VIÊN — ${moTa.ten_truong}`, { bold: true, size: 14 }],
    [`Đơn vị quản lý: ${moTa.ten_don_vi_quan_ly ?? ''}`],
    [`Thời điểm xuất: ${thoiDiemVn(moTa.thoi_diem_xuat)}`],
    [`Tổng số: ${dong.length}`],
  ];
  tieuDe.forEach(([chu, font], i) => {
    const r = i + 1;
    sheet.mergeCells(r, 1, r, soCot);
    const o = sheet.getCell(r, 1);
    o.value = chu;
    if (font) o.font = font as ExcelJS.Font;
    o.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  const hangHeader = tieuDe.length + 2;
  COT.forEach((c, i) => {
    const o = sheet.getCell(hangHeader, i + 1);
    o.value = c.nhan;
    o.font = { bold: true };
    o.fill = NEN_HEADER;
    o.border = BORDER_MONG;
    o.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    sheet.getColumn(i + 1).width = c.rong;
  });

  dong.forEach((d, i) => {
    const r = hangHeader + 1 + i;
    giaTriDong(d, i + 1).forEach((v, c) => {
      const o = sheet.getCell(r, c + 1);
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
    { state: 'frozen', xSplit: 3, ySplit: hangHeader } as ExcelJS.WorksheetView,
  ];

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
