import * as ExcelJS from 'exceljs';
import { NHAN_CAP_GIANG_DAY } from '../bao-cao/util/report-excel.util';
import { thoiDiemVn } from '../hoc-vien/util/danh-sach-hoc-vien-truong-excel.util';
import {
  DOI_TUONG_LABEL,
  GIOI_TINH_LABEL,
} from '../thong-bao/mau-email/mau-email';
import { MoTaBieuMau } from './thong-ke.types';

// GET /thong-ke/danh-sach-hoc-vien/xuat-excel — mỗi học viên 1 dòng (có PII)
// kèm tình trạng truy cập, khảo sát kĩ năng số, đánh giá NLS đầu vào.

/** null = đối tượng không phải làm phiếu (nhân viên) -> "Không áp dụng". */
export type TinhTrangPhieu = 'da_lam' | 'dang_lam' | 'chua_lam' | null;

export interface DongDanhSachHocVien {
  ma_dinh_danh_moet: string | null;
  ho_ten: string;
  ngay_sinh: number;
  thang_sinh: number;
  nam_sinh: number;
  gioi_tinh: string | null;
  ten_don_vi: string;
  ten_don_vi_cha: string | null;
  doi_tuong: string | null;
  cap_giang_day: string | null;
  so_dien_thoai: string | null;
  email: string | null;
  ten_khoa: string[];
  dang_nhap_lan_cuoi: Date | null;
  ky_nang_so: TinhTrangPhieu;
  danh_gia_nls: TinhTrangPhieu;
  /** "M3 – Thành thạo"; null khi chưa có kết quả. */
  muc_danh_gia: string | null;
  danh_gia_hoan_thanh_luc: Date | null;
}

export const KHONG_AP_DUNG = 'Không áp dụng (nhân viên)';

const NHAN_PHIEU: Record<Exclude<TinhTrangPhieu, null>, string> = {
  da_lam: 'Đã làm',
  dang_lam: 'Đang làm (chưa nộp)',
  chua_lam: 'Chưa làm',
};

const COT: { nhan: string; rong: number; text?: boolean }[] = [
  { nhan: 'STT', rong: 6 },
  { nhan: 'Mã định danh MOET', rong: 18, text: true },
  { nhan: 'Họ tên', rong: 28 },
  { nhan: 'Ngày sinh', rong: 12 },
  { nhan: 'Giới tính', rong: 10 },
  { nhan: 'Đơn vị công tác', rong: 32 },
  { nhan: 'Đơn vị quản lý', rong: 24 },
  { nhan: 'Đối tượng', rong: 16 },
  { nhan: 'Cấp giảng dạy', rong: 14 },
  { nhan: 'Số điện thoại', rong: 14, text: true },
  { nhan: 'Email', rong: 28 },
  { nhan: 'Khóa', rong: 28 },
  { nhan: 'Truy cập hệ thống', rong: 14 },
  { nhan: 'Đăng nhập lần cuối', rong: 18 },
  { nhan: 'KS kĩ năng số (đầu vào)', rong: 22 },
  { nhan: 'Đánh giá NLS đầu vào', rong: 22 },
  { nhan: 'Kết quả đánh giá NLS', rong: 20 },
  { nhan: 'Hoàn thành đánh giá lúc', rong: 18 },
];

export const COT_DANH_SACH_HOC_VIEN = COT.map((c) => c.nhan);

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
const nhan = (map: Record<string, string>, v: string | null) =>
  v ? (map[v] ?? v) : '';
const phieu = (t: TinhTrangPhieu) =>
  t === null ? KHONG_AP_DUNG : NHAN_PHIEU[t];

function giaTriDong(d: DongDanhSachHocVien, stt: number): (string | number)[] {
  return [
    stt,
    d.ma_dinh_danh_moet ?? '',
    d.ho_ten,
    `${pad2(d.ngay_sinh)}/${pad2(d.thang_sinh)}/${d.nam_sinh}`,
    nhan(GIOI_TINH_LABEL, d.gioi_tinh),
    d.ten_don_vi,
    d.ten_don_vi_cha ?? '',
    d.doi_tuong ? nhan(DOI_TUONG_LABEL, d.doi_tuong) : 'Chưa xác định',
    nhan(NHAN_CAP_GIANG_DAY, d.cap_giang_day),
    d.so_dien_thoai ?? '',
    d.email ?? '',
    d.ten_khoa.join('; '),
    d.dang_nhap_lan_cuoi ? 'Đã truy cập' : 'Chưa truy cập',
    d.dang_nhap_lan_cuoi ? thoiDiemVn(d.dang_nhap_lan_cuoi) : '',
    phieu(d.ky_nang_so),
    phieu(d.danh_gia_nls),
    d.danh_gia_nls === null ? KHONG_AP_DUNG : (d.muc_danh_gia ?? ''),
    d.danh_gia_hoan_thanh_luc ? thoiDiemVn(d.danh_gia_hoan_thanh_luc) : '',
  ];
}

const dem = (
  dong: DongDanhSachHocVien[],
  f: (d: DongDanhSachHocVien) => boolean,
) => dong.filter(f).length;

export async function buildDanhSachHocVienWorkbook(
  moTa: MoTaBieuMau,
  dong: DongDanhSachHocVien[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Danh sách học viên');
  const soCot = COT.length;

  const phaiLam = dong.filter((d) => d.danh_gia_nls !== null);
  const tieuDe: [string, Partial<ExcelJS.Font>?][] = [
    ['DANH SÁCH HỌC VIÊN', { bold: true, size: 14 }],
    [
      `Khóa: ${moTa.khoa} — Phạm vi: ${moTa.pham_vi} — Đối tượng: ${moTa.doi_tuong}`,
    ],
    [`Thời điểm xuất: ${thoiDiemVn(moTa.ngay_xuat)}`],
    [
      `Tổng số: ${dong.length} — Đã truy cập: ${dem(dong, (d) => !!d.dang_nhap_lan_cuoi)}` +
        ` — Đã làm KS kĩ năng số: ${dem(phaiLam, (d) => d.ky_nang_so === 'da_lam')}/${phaiLam.length}` +
        ` — Đã làm đánh giá NLS: ${dem(phaiLam, (d) => d.danh_gia_nls === 'da_lam')}/${phaiLam.length}` +
        ` (nhân viên tạm thời không áp dụng khảo sát/đánh giá)`,
    ],
  ];
  tieuDe.forEach(([chu, font], i) => {
    const r = i + 1;
    sheet.mergeCells(r, 1, r, soCot);
    const o = sheet.getCell(r, 1);
    o.value = chu;
    if (font) o.font = font as ExcelJS.Font;
    o.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
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
