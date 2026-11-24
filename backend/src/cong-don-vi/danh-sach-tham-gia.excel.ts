import * as ExcelJS from 'exceljs';
import { ValidationException } from '../common/exceptions/app.exceptions';
import { cellToPlainText } from '../import/util/moet-excel.util';
import {
  GiaiDoanKhongHopLeError,
  GiaiDoanThamGia,
  TyLeSuat,
  YKienTruong,
  suatTuGiaiDoan,
} from './quy-tac-hop-dong';

// Issue #58: đọc file Excel danh sách HSG. Dòng tiêu đề tìm theo tên cột (bí danh, không phân biệt
// hoa/thường/dấu), không cố định thứ tự cột; file thật thường có vài dòng tiêu đề văn bản phía trên.

export type CotDanhSach =
  | 'ho_ten'
  | 'ngay_sinh'
  | 'gioi_tinh'
  | 'ma_goc'
  | 'lop'
  | 'ma_truong'
  | 'ten_truong'
  | 'giai_doan'
  | 'ghi_chu';

export interface DongExcelDanhSach {
  so_dong: number;
  ho_ten: string;
  ngay_sinh: string | null;
  gioi_tinh: string | null;
  ma_goc: string | null;
  lop: string | null;
  ma_truong: string | null;
  ten_truong: string | null;
  giai_doan: GiaiDoanThamGia | null;
  ty_le_suat: TyLeSuat | null;
  ghi_chu: string | null;
  loi: string[];
}

/** Tiêu đề cột trong file mẫu (cũng là bí danh chính). */
export const COT_MAU: [CotDanhSach, string][] = [
  ['ho_ten', 'Họ và tên'],
  ['ngay_sinh', 'Ngày sinh'],
  ['gioi_tinh', 'Giới tính'],
  ['ma_goc', 'Mã gốc'],
  ['lop', 'Lớp'],
  ['ma_truong', 'Mã trường'],
  ['ten_truong', 'Tên trường'],
  ['giai_doan', 'Giai đoạn tham gia'],
  ['ghi_chu', 'Ghi chú'],
];

// Cột chỉ dùng lúc đọc: file danh sách tổng hợp tách "Họ và" / "Tên" và Ngày / Tháng / Năm sinh.
type CotDoc = CotDanhSach | 'ho' | 'ten' | 'thang_sinh' | 'nam_sinh';

// Khóa: tiêu đề đã chuẩn hóa (bỏ dấu, bỏ phần trong ngoặc, bỏ '*', xuống dòng/khoảng trắng thừa → 1 dấu cách).
const BI_DANH: Record<string, CotDoc> = {
  'ho ten': 'ho_ten',
  'ho va ten': 'ho_ten',
  'ngay sinh': 'ngay_sinh',
  'ngay thang nam sinh': 'ngay_sinh',
  'gioi tinh': 'gioi_tinh',
  'ma goc': 'ma_goc',
  'ma dinh danh': 'ma_goc',
  'ma gv': 'ma_goc',
  'ma giao vien': 'ma_goc',
  'ma so hoc vien': 'ma_goc',
  'ma hoc vien': 'ma_goc',
  lop: 'lop',
  'lop boi duong': 'lop',
  'ma lop': 'lop',
  'ma truong': 'ma_truong',
  'ma don vi': 'ma_truong',
  truong: 'ten_truong',
  'ten truong': 'ten_truong',
  'don vi': 'ten_truong',
  'ten don vi': 'ten_truong',
  'don vi cong tac': 'ten_truong',
  'giai doan tham gia': 'giai_doan',
  'giai doan': 'giai_doan',
  'ghi chu': 'ghi_chu',
  'ho va': 'ho',
  ho: 'ho',
  'ho dem': 'ho',
  ten: 'ten',
  'thang sinh': 'thang_sinh',
  'nam sinh': 'nam_sinh',
};

// Giới hạn độ dài theo cột DB (danh_sach_tham_gia).
const DO_DAI_TOI_DA: Partial<Record<CotDanhSach, [number, string]>> = {
  ho_ten: [255, 'Họ tên'],
  gioi_tinh: [20, 'Giới tính'],
  ma_goc: [50, 'Mã gốc'],
  lop: [100, 'Lớp'],
};

const SO_DONG_DO_TIEU_DE = 20;
const SO_COT_DO = 40;

function chuanHoaTieuDe(s: string): string {
  return s
    .replace(/\(.*?\)/g, ' ')
    .replace(/\*/g, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Ô công thức → kết quả; còn lại giữ nguyên giá trị thô. */
function giaTriO(raw: unknown): unknown {
  if (raw && typeof raw === 'object' && 'result' in raw) {
    return (raw as { result: unknown }).result;
  }
  return raw;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

function ngayHopLe(nam: number, thang: number, ngay: number): string | null {
  const d = new Date(Date.UTC(nam, thang - 1, ngay));
  const dung =
    d.getUTCFullYear() === nam &&
    d.getUTCMonth() === thang - 1 &&
    d.getUTCDate() === ngay;
  return dung && nam >= 1900 ? `${nam}-${pad2(thang)}-${pad2(ngay)}` : null;
}

/** Ô ngày Excel (exceljs đọc như UTC) hoặc chữ dd/mm/yyyy (cho phép '-', '.') hoặc yyyy-mm-dd. Trống → null; sai → undefined. */
export function docNgaySinh(raw: unknown): string | null | undefined {
  const v = giaTriO(raw);
  if (v instanceof Date) {
    return (
      ngayHopLe(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate()) ??
      undefined
    );
  }
  const s = cellToPlainText(v).trim();
  if (s === '') return null;
  const vn = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (vn) return ngayHopLe(+vn[3], +vn[2], +vn[1]) ?? undefined;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return ngayHopLe(+iso[1], +iso[2], +iso[3]) ?? undefined;
  return undefined;
}

/** Dòng tiêu đề hợp lệ: có "Họ và tên", hoặc có cả "Họ và"/"Họ"/"Họ đệm" lẫn "Tên". */
function timDongTieuDe(sheet: ExcelJS.Worksheet) {
  const soDong = Math.min(sheet.rowCount, SO_DONG_DO_TIEU_DE);
  const soCot = Math.max(sheet.columnCount, SO_COT_DO);
  for (let r = 1; r <= soDong; r++) {
    const row = sheet.getRow(r);
    const cot = new Map<CotDoc, number>();
    for (let c = 1; c <= soCot; c++) {
      const loai =
        BI_DANH[chuanHoaTieuDe(cellToPlainText(row.getCell(c).value))];
      if (loai && !cot.has(loai)) cot.set(loai, c);
    }
    if (cot.has('ho_ten') || (cot.has('ho') && cot.has('ten'))) {
      return { dongTieuDe: r, cot };
    }
  }
  return null;
}

/** Sheet đầu tiên (theo thứ tự trong file) có dòng tiêu đề hợp lệ trong 20 dòng đầu. */
async function moSheetCoTieuDe(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new ValidationException('Không đọc được file Excel (.xlsx)');
  }
  if (workbook.worksheets.length === 0)
    throw new ValidationException('File Excel không có sheet dữ liệu nào');
  for (const sheet of workbook.worksheets) {
    const tieuDe = timDongTieuDe(sheet);
    if (tieuDe) return { sheet, ...tieuDe };
  }
  throw new ValidationException(
    'Không tìm thấy dòng tiêu đề có cột "Họ và tên" (hoặc 2 cột "Họ và" + "Tên") trong 20 dòng đầu — tải file mẫu để xem đúng tên cột',
  );
}

/** Số nguyên dương từ ô số hoặc chữ số; trống → null; khác → undefined. */
function soNguyen(raw: unknown): number | null | undefined {
  const v = giaTriO(raw);
  if (typeof v === 'number') {
    return Number.isInteger(v) && v > 0 ? v : undefined;
  }
  const s = cellToPlainText(v).trim();
  if (s === '') return null;
  return /^\d{1,4}$/.test(s) ? +s : undefined;
}

/** Ngày sinh tách 3 cột Ngày / Tháng / Năm. Cả 3 trống → null; thiếu/sai → undefined. */
function docNgaySinhTach(
  ngay: unknown,
  thang: unknown,
  nam: unknown,
): string | null | undefined {
  const [d, m, y] = [soNguyen(ngay), soNguyen(thang), soNguyen(nam)];
  if (d === null && m === null && y === null) return null;
  if (!d || !m || !y) return undefined;
  return ngayHopLe(y, m, d) ?? undefined;
}

/** Đọc file danh sách HSG (sheet đầu tiên có dòng tiêu đề) → các dòng (bỏ dòng trống) kèm lỗi từng dòng. */
export async function docFileDanhSach(
  buffer: Buffer,
): Promise<DongExcelDanhSach[]> {
  const { sheet, dongTieuDe, cot } = await moSheetCoTieuDe(buffer);
  if (!cot.has('ma_truong') && !cot.has('ten_truong')) {
    throw new ValidationException(
      'File thiếu cột trường: cần cột "Mã trường" hoặc "Tên trường"',
    );
  }
  // Có cột Tháng sinh + Năm sinh → cột "Ngày sinh" chỉ là số ngày.
  const ngayTach = cot.has('thang_sinh') && cot.has('nam_sinh');

  const ketQua: DongExcelDanhSach[] = [];
  for (let r = dongTieuDe + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const rawCua = (k: CotDoc) => {
      const c = cot.get(k);
      return c === undefined ? null : row.getCell(c).value;
    };
    const chu = (k: CotDoc) => cellToPlainText(giaTriO(rawCua(k))).trim();
    // Ô ngày (Date) thành chuỗi ISO, khác rỗng — chỉ dùng để nhận dòng trống; ngày đọc lại từ ô thô.
    const giaTri = Object.fromEntries(
      COT_MAU.map(([k]) => [k, chu(k)]),
    ) as Record<CotDanhSach, string>;
    if (!cot.has('ho_ten')) {
      giaTri.ho_ten = [chu('ho'), chu('ten')]
        .filter((s) => s !== '')
        .join(' ')
        .normalize('NFC');
    }
    const ngayPhu = ngayTach ? chu('thang_sinh') + chu('nam_sinh') : '';
    if (Object.values(giaTri).every((v) => v === '') && ngayPhu === '') {
      continue;
    }
    const ngay_sinh = ngayTach
      ? docNgaySinhTach(
          rawCua('ngay_sinh'),
          rawCua('thang_sinh'),
          rawCua('nam_sinh'),
        )
      : docNgaySinh(rawCua('ngay_sinh'));
    ketQua.push(taoDong(r, giaTri, ngay_sinh));
  }
  return ketQua;
}

function taoDong(
  so_dong: number,
  g: Record<CotDanhSach, string>,
  ngay_sinh: string | null | undefined,
): DongExcelDanhSach {
  const loi: string[] = [];
  if (!g.ho_ten) loi.push('Thiếu họ tên');
  for (const [k, [toiDa, nhan]] of Object.entries(DO_DAI_TOI_DA) as [
    CotDanhSach,
    [number, string],
  ][]) {
    if (g[k].length > toiDa) loi.push(`${nhan} dài quá ${toiDa} ký tự`);
  }
  if (ngay_sinh === undefined) {
    loi.push('Ngày sinh không hợp lệ (dùng dd/mm/yyyy)');
  }
  let giai_doan: GiaiDoanThamGia | null = null;
  let ty_le_suat: TyLeSuat | null = null;
  try {
    ({ giai_doan, ty_le_suat } = suatTuGiaiDoan(g.giai_doan));
  } catch (e) {
    if (!(e instanceof GiaiDoanKhongHopLeError)) throw e;
    loi.push(e.message);
  }
  const hoacNull = (s: string) => (s === '' ? null : s);
  return {
    so_dong,
    ho_ten: g.ho_ten,
    ngay_sinh: ngay_sinh ?? null,
    gioi_tinh: hoacNull(g.gioi_tinh),
    ma_goc: hoacNull(g.ma_goc),
    lop: hoacNull(g.lop),
    ma_truong: hoacNull(g.ma_truong),
    ten_truong: hoacNull(g.ten_truong),
    giai_doan,
    ty_le_suat,
    ghi_chu: hoacNull(g.ghi_chu),
    loi,
  };
}

/** File mẫu: sheet 1 chỉ có dòng tiêu đề (nạp thẳng được); sheet "Ví dụ" có 1 dòng bịa để tham khảo. */
export async function taoFileMauDanhSach(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const tieuDe = COT_MAU.map(([, nhan]) => nhan);
  const mau = workbook.addWorksheet('Danh sach');
  const viDu = workbook.addWorksheet('Vi du');
  for (const sheet of [mau, viDu]) {
    sheet.addRow(tieuDe);
    sheet.getRow(1).font = { bold: true };
    // Định dạng Text: giữ số 0 đầu của mã, không để Excel tự đổi ngày.
    tieuDe.forEach((_, i) => {
      sheet.getColumn(i + 1).numFmt = '@';
      sheet.getColumn(i + 1).width = 22;
    });
  }
  viDu.addRow([
    'Nguyễn Văn Mẫu',
    '01/01/1990',
    'Nam',
    'GV-MAU-001',
    'Lớp HSG 1',
    'TR-MAU-001',
    'Trường THCS Mẫu',
    'Chỉ GĐ1',
    'Dòng ví dụ (dữ liệu bịa)',
  ]);
  mau.getRow(1).getCell(8).note =
    'Cả 2 / Chỉ GĐ1 / Chỉ GĐ2 — để trống = Cả 2 (1 suất); chỉ 1 giai đoạn = 0,5 suất';
  mau.getRow(1).getCell(2).note = 'dd/mm/yyyy';
  mau.getRow(1).getCell(6).note =
    'Ưu tiên khớp theo mã trường; không có mã thì khớp theo tên trường';
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// Issue #59: xuất danh sách hiện tại. Sheet 1 dùng đúng tiêu đề file mẫu để sửa rồi nạp lại được;
// 2 cột thêm ở cuối chỉ để xem (bộ đọc bỏ qua cột lạ — suất khi nạp lại suy từ giai đoạn).
export const COT_XUAT_THEM = ['Tỷ lệ suất', 'Ý kiến của trường'] as const;

export interface DongXuatDanhSach {
  ho_ten: string;
  ngay_sinh: string | null;
  gioi_tinh: string | null;
  ma_goc: string | null;
  lop: string | null;
  ma_truong: string | null;
  ten_truong: string;
  giai_doan: GiaiDoanThamGia;
  ty_le_suat: number;
  ghi_chu: string | null;
  y_kien_truong: string | null;
}

const NHAN_GIAI_DOAN: Record<GiaiDoanThamGia, string> = {
  ca_hai: 'Cả 2',
  chi_gd1: 'Chỉ GĐ1',
  chi_gd2: 'Chỉ GĐ2',
};

// Issue #61: ý kiến lưu dạng mã → xuất nhãn; chưa có ý kiến → ô trống.
const NHAN_Y_KIEN: Record<YKienTruong, string> = {
  dong_y: 'Đồng ý',
  khong_dong_y: 'Không đồng ý',
};

function nhanYKien(yKien: string | null): string | null {
  return (yKien && NHAN_Y_KIEN[yKien as YKienTruong]) || null;
}

export async function taoFileXuatDanhSach(
  ds: DongXuatDanhSach[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Danh sach');
  const tieuDe = [...COT_MAU.map(([, nhan]) => nhan), ...COT_XUAT_THEM];
  sheet.addRow(tieuDe);
  sheet.getRow(1).font = { bold: true };
  tieuDe.forEach((_, i) => (sheet.getColumn(i + 1).width = 22));
  // Text: giữ số 0 đầu của mã; ngày là ô ngày thật.
  for (const c of [4, 6]) sheet.getColumn(c).numFmt = '@';
  sheet.getColumn(2).numFmt = 'dd/mm/yyyy';
  for (const d of ds) {
    sheet.addRow([
      d.ho_ten,
      d.ngay_sinh ? new Date(`${d.ngay_sinh}T00:00:00.000Z`) : null,
      d.gioi_tinh,
      d.ma_goc,
      d.lop,
      d.ma_truong,
      d.ten_truong,
      NHAN_GIAI_DOAN[d.giai_doan],
      d.ghi_chu,
      d.ty_le_suat,
      nhanYKien(d.y_kien_truong),
    ]);
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
