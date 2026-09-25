import * as ExcelJS from 'exceljs';
import { ValidationException } from '../../common/exceptions/app.exceptions';

export interface ParsedRow {
  dong: number; // số dòng trên file Excel thực tế (tính cả dòng header) để báo lỗi đúng vị trí người dùng nhìn thấy
  values: Record<string, string>;
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
      const cell = row.getCell(i + 1);
      values[col] =
        cell.value === null || cell.value === undefined
          ? ''
          : String(cell.value).trim();
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
