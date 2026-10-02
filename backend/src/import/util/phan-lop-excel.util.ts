import * as ExcelJS from 'exceljs';
import { ValidationException } from '../../common/exceptions/app.exceptions';
import { cellToImportText } from './excel.util';

// Import phan_lop_hoc_vien dạng mỗi học viên 1 dòng, mỗi giai đoạn 1 cột
// (spec 2026-10-02-phan-lop-theo-giai-doan mục 4). Cột giai đoạn nhận diện
// bằng tiền tố "GĐ<số>" — phần tên phía sau bỏ qua để đổi tên giai đoạn không
// làm hỏng file đã tải. Cột cố định đọc theo TÊN (không theo vị trí).
export const COT_CO_DINH_PHAN_LOP = [
  'so_dinh_danh_ca_nhan',
  'ma_dinh_danh_moet',
  'ten_cum',
] as const;
const COT_MAU_CU = ['ten_lop', 'ten_lop_zoom', 'ten_lop_vle', 'ma_khoa'];
const COT_BAT_BUOC = ['so_dinh_danh_ca_nhan', 'ma_dinh_danh_moet'];

export function parseThuTuCotGiaiDoan(header: string): number | null {
  const m = /^\s*g[đd]\s*(\d+)/i.exec(header);
  return m ? Number(m[1]) : null;
}

export function tieuDeCotGiaiDoan(gd: {
  thu_tu: number;
  ten_giai_doan: string;
}): string {
  return `GĐ${gd.thu_tu} - ${gd.ten_giai_doan}`;
}

// Tiêu đề cột -> key trong values ("gd:<thu_tu>" hoặc tên cột cố định);
// ném lỗi cả file cho mẫu cũ, cột lạ, GĐ không tồn tại/đã ngừng, cột trùng.
function keyCuaCot(header: string, thuTuHopLe: Set<number>): string {
  const thuong = header.toLowerCase();
  if (COT_MAU_CU.includes(thuong)) {
    throw new ValidationException(
      `File theo mẫu cũ (có cột "${header}"), vui lòng tải mẫu mới theo giai đoạn của khóa`,
    );
  }
  const thuTu = parseThuTuCotGiaiDoan(header);
  if (thuTu !== null) {
    if (!thuTuHopLe.has(thuTu)) {
      throw new ValidationException(
        `Cột "${header}": khóa không có giai đoạn đang hoạt động GĐ${thuTu}`,
      );
    }
    return `gd:${thuTu}`;
  }
  if ((COT_CO_DINH_PHAN_LOP as readonly string[]).includes(thuong)) {
    return thuong;
  }
  throw new ValidationException(
    `Cột lạ "${header}". Cột hợp lệ: ${COT_CO_DINH_PHAN_LOP.join(', ')} và các cột "GĐ<số> - <tên giai đoạn>"`,
  );
}

export async function readPhanLopWorkbook(
  buffer: Buffer,
  thuTuHopLe: Set<number>,
): Promise<{
  headers: string[];
  rows: { dong: number; values: Record<string, string> }[];
}> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new ValidationException('File Excel không có sheet dữ liệu nào');
  }

  const headers: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col - 1] = String(cell.value ?? '').trim();
  });

  const keys: (string | null)[] = [];
  const daGap = new Set<string>();
  for (const h of headers) {
    if (!h) {
      keys.push(null);
      continue;
    }
    const key = keyCuaCot(h, thuTuHopLe);
    if (daGap.has(key)) {
      throw new ValidationException(
        `Cột "${h}" trùng với cột khác cùng ${key.startsWith('gd:') ? 'giai đoạn' : 'tên'}`,
      );
    }
    daGap.add(key);
    keys.push(key);
  }
  for (const cot of COT_BAT_BUOC) {
    if (!daGap.has(cot)) throw new ValidationException(`Thiếu cột "${cot}"`);
  }

  const rows: { dong: number; values: Record<string, string> }[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const values: Record<string, string> = { ten_cum: '' };
    keys.forEach((key, i) => {
      if (key) values[key] = cellToImportText(row.getCell(i + 1).value);
    });
    if (Object.values(values).some((v) => v !== '')) {
      rows.push({ dong: rowNumber, values });
    }
  });
  return { headers: headers.filter(Boolean), rows };
}

// File lỗi re-export dòng gốc theo đúng tiêu đề người dùng đã nộp: đổi key
// "gd:<n>" ngược về tiêu đề cột giai đoạn tương ứng.
export function valuesTheoTieuDe(
  headers: string[],
  values: Record<string, string>,
): Record<string, string> {
  const kq: Record<string, string> = {};
  for (const h of headers) {
    const thuTu = parseThuTuCotGiaiDoan(h);
    kq[h] = values[thuTu !== null ? `gd:${thuTu}` : h.toLowerCase()] ?? '';
  }
  return kq;
}
