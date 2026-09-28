import * as ExcelJS from 'exceljs';
import { ValidationException } from '../../common/exceptions/app.exceptions';

// Parser RIÊNG cho ho_so_nhan_su_moet (T4, mo-rong-nls-an-giang.md) — file
// thực tế từ Sở/Bộ có vài dòng tiêu đề phía trên, tiêu đề gộp ô 2 tầng cho
// "Ngày tháng năm sinh", và các cột số (Mã định danh, Số điện thoại) bị Excel
// lưu dạng number. readWorkbookRows() (excel.util.ts) dùng cho 4 loại import
// còn lại vẫn giữ nguyên hành vi cũ (khớp cột CHÍNH XÁC ở dòng 1, đúng thứ tự)
// — KHÔNG sửa chung vì rủi ro phá luồng đã ổn định của các loại đó.

export interface MoetParsedRow {
  dong: number; // số dòng Excel thực tế — dùng để báo lỗi đúng vị trí
  values: Record<string, string>;
}

// Cột bắt buộc phải khớp được, ngoại trừ 'Mã đơn vị' (tùy chọn, T4).
const REQUIRED_CANONICAL = [
  'Đơn vị',
  'Mã định danh (CDSL moet)',
  'Họ và tên',
  'Ngày',
  'Tháng',
  'Năm',
  'Chuyên môn',
  'Số điện thoại',
] as const;

// key: chuỗi đã chuẩn hóa (bỏ phần trong ngoặc, gọn khoảng trắng, chữ thường)
// value: tên cột chuẩn (canonical) dùng làm key trong values trả về — khớp
// nguyên văn với getColumns('ho_so_nhan_su_moet') ở import.service.ts.
const HEADER_MAP: Record<string, string> = {
  'đơn vị': 'Đơn vị',
  'mã đơn vị': 'Mã đơn vị',
  'mã định danh': 'Mã định danh (CDSL moet)',
  'họ và tên': 'Họ và tên',
  ngày: 'Ngày',
  tháng: 'Tháng',
  năm: 'Năm',
  'chức vụ': 'Chức vụ',
  'chuyên môn': 'Chuyên môn',
  'số điện thoại': 'Số điện thoại',
  'ghi chú': 'Ghi chú',
};

const MAX_HEADER_SCAN_ROWS = 20;
const MAX_COLUMN_SCAN = 30;

function normalizeHeader(raw: string): string {
  return raw
    .replace(/\(.*?\)/g, '') // bỏ phần trong ngoặc, vd "(CDSL moet)"
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

// Cell Excel có thể là number (mã MOET/SĐT lưu dạng number), Date, rich text,
// hoặc formula { result } — quy hết về chuỗi hiển thị, KHÔNG có ".0"/ký hiệu
// khoa học cho số nguyên.
export function cellToPlainText(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'number') {
    return Number.isInteger(raw) ? raw.toFixed(0) : String(raw);
  }
  if (raw instanceof Date) return raw.toISOString();
  if (typeof raw === 'object') {
    const obj = raw as {
      text?: string;
      result?: unknown;
      richText?: { text: string }[];
    };
    if (Array.isArray(obj.richText)) {
      return obj.richText.map((r) => r.text).join('');
    }
    if ('result' in obj) return cellToPlainText(obj.result);
    if (typeof obj.text === 'string') return obj.text;
  }
  return String(raw).trim();
}

function cellAt(row: ExcelJS.Row, col: number): string {
  return cellToPlainText(row.getCell(col).value);
}

export async function readMoetWorkbookRows(
  buffer: Buffer,
): Promise<MoetParsedRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new ValidationException('File Excel không có sheet dữ liệu nào');
  }

  const maxCol = Math.max(sheet.columnCount, MAX_COLUMN_SCAN);
  const maxHeaderRow = Math.min(sheet.rowCount, MAX_HEADER_SCAN_ROWS);

  // 1. Tìm dòng tiêu đề chính: dòng đầu tiên có cả 1 cột khớp "đơn vị" và 1
  // cột khớp "mã định danh" (bỏ qua các dòng tiêu đề/ghi chú phía trên).
  let headerRowNum = -1;
  const columnMap = new Map<number, string>();
  for (let r = 1; r <= maxHeaderRow; r++) {
    const row = sheet.getRow(r);
    const candidateMap = new Map<number, string>();
    for (let c = 1; c <= maxCol; c++) {
      const norm = normalizeHeader(cellAt(row, c));
      const canonical = HEADER_MAP[norm];
      if (canonical) candidateMap.set(c, canonical);
    }
    const canonicalValues = new Set(candidateMap.values());
    if (
      canonicalValues.has('Đơn vị') &&
      canonicalValues.has('Mã định danh (CDSL moet)')
    ) {
      headerRowNum = r;
      candidateMap.forEach((v, k) => columnMap.set(k, v));
      break;
    }
  }

  if (headerRowNum === -1) {
    throw new ValidationException(
      'Không tìm được dòng tiêu đề chứa cả cột "Đơn vị" và "Mã định danh" trong file — kiểm tra lại mẫu file',
    );
  }

  // 2. Tiêu đề 2 tầng: nếu dòng chính chưa có Ngày/Tháng/Năm (ô gộp
  // "Ngày tháng năm sinh"), tìm ở dòng NGAY DƯỚI.
  let dataStartRow = headerRowNum + 1;
  const missingBirthCols = ['Ngày', 'Tháng', 'Năm'].filter(
    (k) => ![...columnMap.values()].includes(k),
  );
  if (missingBirthCols.length > 0 && headerRowNum + 1 <= sheet.rowCount) {
    const subRow = sheet.getRow(headerRowNum + 1);
    let foundAny = false;
    for (let c = 1; c <= maxCol; c++) {
      const norm = normalizeHeader(cellAt(subRow, c));
      const canonical = HEADER_MAP[norm];
      if (
        canonical &&
        missingBirthCols.includes(canonical) &&
        !columnMap.has(c)
      ) {
        columnMap.set(c, canonical);
        foundAny = true;
      }
    }
    if (foundAny) dataStartRow = headerRowNum + 2;
  }

  const foundCanonical = new Set(columnMap.values());
  const stillMissing = REQUIRED_CANONICAL.filter(
    (k) => !foundCanonical.has(k),
  );
  if (stillMissing.length > 0) {
    throw new ValidationException(
      `File thiếu cột bắt buộc: ${stillMissing.join(', ')}`,
    );
  }

  const rows: MoetParsedRow[] = [];
  for (let r = dataStartRow; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const values: Record<string, string> = {};
    columnMap.forEach((canonical, col) => {
      values[canonical] = cellAt(row, col);
    });
    const isBlankRow = Object.values(values).every((v) => v === '');
    if (!isBlankRow) {
      rows.push({ dong: r, values });
    }
  }

  return rows;
}
