import * as ExcelJS from 'exceljs';
import { ValidationException } from '../../common/exceptions/app.exceptions';
import { cellToPlainText } from './moet-excel.util';

export interface ParsedRow {
  dong: number; // số dòng trên file Excel thực tế (tính cả dòng header) để báo lỗi đúng vị trí người dùng nhìn thấy
  values: Record<string, string>;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

// Quy giá trị ô Excel về chuỗi: hyperlink/rich text/công thức lấy phần hiển
// thị (cellToPlainText); ô ngày -> "dd/mm/yyyy hh:mm" (khớp parseVnDateTime).
// exceljs đọc ngày Excel như UTC nên giờ hiển thị trong Excel = thành phần
// UTC — không cộng/trừ 7 giờ.
export function cellToImportText(raw: unknown): string {
  if (raw instanceof Date) {
    return `${pad2(raw.getUTCDate())}/${pad2(raw.getUTCMonth() + 1)}/${raw.getUTCFullYear()} ${pad2(raw.getUTCHours())}:${pad2(raw.getUTCMinutes())}`;
  }
  return cellToPlainText(raw).trim();
}

// Đọc worksheet đầu tiên: dòng 1 = header (khớp columns truyền vào, không
// phân biệt hoa/thường/khoảng trắng thừa), các dòng sau là dữ liệu.
export async function readWorkbookRows(
  buffer: Buffer,
  expectedColumns: string[],
): Promise<ParsedRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new ValidationException('File Excel không có sheet dữ liệu nào');
  }

  const headerRow = sheet.getRow(1);
  const actualHeaders: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    actualHeaders[colNumber - 1] = String(cell.value ?? '').trim();
  });

  const normalize = (s: string) => s.trim().toLowerCase();
  const headersMatch =
    expectedColumns.length === actualHeaders.filter((h) => h).length &&
    expectedColumns.every(
      (col, i) => normalize(actualHeaders[i] ?? '') === normalize(col),
    );
  if (!headersMatch) {
    throw new ValidationException(
      `Cột file không đúng mẫu. Cột yêu cầu: ${expectedColumns.join(', ')}. Cột đọc được: ${actualHeaders.filter(Boolean).join(', ')}`,
    );
  }

  const rows: ParsedRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const values: Record<string, string> = {};
    expectedColumns.forEach((col, i) => {
      values[col] = cellToImportText(row.getCell(i + 1).value);
    });
    const isBlankRow = Object.values(values).every((v) => v === '');
    if (!isBlankRow) {
      rows.push({ dong: rowNumber, values });
    }
  });

  return rows;
}

// columnNotes: ghi chú (Excel cell comment) cho từng cột, vd đánh dấu cột tùy
// chọn — không đổi tên cột (header vẫn phải khớp nguyên văn để readWorkbookRows
// nhận diện khi người dùng nộp lại đúng file mẫu).
export async function buildTemplateWorkbook(
  columns: string[],
  columnNotes?: Record<string, string>,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Mau');
  sheet.addRow(columns);
  sheet.getRow(1).font = { bold: true };
  // Định dạng Text cho mọi cột: Excel không cắt số 0 đầu (CCCD "089...", mã
  // địa danh "01") và không tự đổi "dd/mm/yyyy hh:mm" thành ô ngày.
  columns.forEach((_, i) => {
    sheet.getColumn(i + 1).numFmt = '@';
  });
  if (columnNotes) {
    columns.forEach((col, i) => {
      const note = columnNotes[col];
      if (note) {
        sheet.getRow(1).getCell(i + 1).note = note;
      }
    });
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function buildLoiWorkbook(
  columns: string[],
  loiRows: { dong: number; values: Record<string, string>; ly_do: string }[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Loi');
  sheet.addRow([...columns, 'Lý do']);
  sheet.getRow(1).font = { bold: true };
  for (const row of loiRows) {
    sheet.addRow([...columns.map((c) => row.values[c] ?? ''), row.ly_do]);
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
