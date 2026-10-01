import * as ExcelJS from 'exceljs';
import {
  buildLoiWorkbook,
  buildTemplateWorkbook,
  cellToImportText,
  readWorkbookRows,
} from './excel.util';
import { ValidationException } from '../../common/exceptions/app.exceptions';
import { parseVnDateTime } from '../../common/utils/vn-datetime.util';

async function toBuffer(rows: unknown[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('data');
  rows.forEach((r) => sheet.addRow(r));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('excel.util', () => {
  describe('readWorkbookRows', () => {
    it('đọc đúng dòng dữ liệu, bỏ qua dòng trống hoàn toàn', async () => {
      const buffer = await toBuffer([
        ['ten_mon', 'cap_hoc'],
        ['Toán', 'thpt'],
        ['', ''],
        ['Văn', 'thcs'],
      ]);
      const rows = await readWorkbookRows(buffer, ['ten_mon', 'cap_hoc']);
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({
        dong: 2,
        values: { ten_mon: 'Toán', cap_hoc: 'thpt' },
      });
      expect(rows[1]).toEqual({
        dong: 4,
        values: { ten_mon: 'Văn', cap_hoc: 'thcs' },
      });
    });

    it('header sai cột -> ValidationException, không trả dòng nào', async () => {
      const buffer = await toBuffer([
        ['cot_sai_1', 'cot_sai_2'],
        ['a', 'b'],
      ]);
      await expect(
        readWorkbookRows(buffer, ['ten_mon', 'cap_hoc']),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('file không có dòng dữ liệu nào (chỉ header) -> mảng rỗng, không lỗi', async () => {
      const buffer = await toBuffer([['ten_mon', 'cap_hoc']]);
      const rows = await readWorkbookRows(buffer, ['ten_mon', 'cap_hoc']);
      expect(rows).toEqual([]);
    });
  });

  describe('readWorkbookRows — kiểu ô Excel không phải chuỗi', () => {
    const readOne = async (cell: unknown) => {
      const buffer = await toBuffer([['a'], [cell]]);
      const rows = await readWorkbookRows(buffer, ['a']);
      return rows[0]?.values.a;
    };

    it('hyperlink (Excel tự tạo khi gõ URL) -> text hiển thị', async () => {
      expect(
        await readOne({
          text: 'https://vle.hcmue.edu.vn',
          hyperlink: 'https://vle.hcmue.edu.vn',
        }),
      ).toBe('https://vle.hcmue.edu.vn');
    });

    it('hyperlink có text dạng rich text -> nối các đoạn text', async () => {
      expect(
        await readOne({
          text: { richText: [{ text: 'https://' }, { text: 'zoom.us/j/1' }] },
          hyperlink: 'https://zoom.us/j/1',
        }),
      ).toBe('https://zoom.us/j/1');
    });

    it('rich text -> nối các đoạn text', async () => {
      expect(
        await readOne({ richText: [{ text: 'Lớp ' }, { text: '1' }] }),
      ).toBe('Lớp 1');
    });

    it('công thức -> lấy kết quả (số hoặc chuỗi)', async () => {
      expect(await readOne({ formula: '1+1', result: 2 })).toBe('2');
      expect(await readOne({ formula: '"ab"&"c"', result: 'abc' })).toBe('abc');
    });

    it('ô ngày giờ -> "dd/mm/yyyy hh:mm", parseVnDateTime nhận được', async () => {
      const text = await readOne(new Date(Date.UTC(2026, 9, 1, 8, 5)));
      expect(text).toBe('01/10/2026 08:05');
      expect(parseVnDateTime(text as string)?.toISOString()).toBe(
        '2026-10-01T01:05:00.000Z',
      );
    });

    it('số nguyên không có ".0", số thập phân giữ nguyên', async () => {
      expect(await readOne(12)).toBe('12');
      expect(await readOne(8.5)).toBe('8.5');
    });

    it('chuỗi CCCD giữ nguyên số 0 đầu', async () => {
      expect(await readOne('089123456789')).toBe('089123456789');
    });

    it('ô lỗi Excel -> rỗng, dòng chỉ có ô lỗi bị bỏ qua như dòng trống', async () => {
      const buffer = await toBuffer([
        ['a', 'b'],
        [{ error: '#N/A' }, ''],
        ['x', { error: '#REF!' }],
      ]);
      const rows = await readWorkbookRows(buffer, ['a', 'b']);
      expect(rows).toEqual([{ dong: 3, values: { a: 'x', b: '' } }]);
    });
  });

  describe('cellToImportText', () => {
    it('null/undefined -> rỗng', () => {
      expect(cellToImportText(null)).toBe('');
      expect(cellToImportText(undefined)).toBe('');
    });

    it('ngày lúc nửa đêm -> giờ 00:00', () => {
      expect(cellToImportText(new Date(Date.UTC(2026, 11, 31)))).toBe(
        '31/12/2026 00:00',
      );
    });

    it('đệm 0 cho ngày/tháng/giờ/phút 1 chữ số', () => {
      expect(cellToImportText(new Date(Date.UTC(2026, 0, 5, 7, 3)))).toBe(
        '05/01/2026 07:03',
      );
    });

    it('chuỗi có khoảng trắng thừa -> trim', () => {
      expect(cellToImportText('  abc ')).toBe('abc');
    });
  });

  describe('buildTemplateWorkbook', () => {
    it('sinh file mẫu đúng cột header, không có dòng dữ liệu', async () => {
      const buffer = await buildTemplateWorkbook(['ma', 'ten']);
      const rows = await readWorkbookRows(buffer, ['ma', 'ten']);
      expect(rows).toEqual([]); // chỉ có header, không dòng dữ liệu -> hợp lệ, rỗng
    });

    it('mọi cột định dạng Text, giữ header và ghi chú', async () => {
      const columns = ['so_dinh_danh_ca_nhan', 'ma_khoa', 'bat_dau'];
      const buffer = await buildTemplateWorkbook(columns, {
        ma_khoa: 'Ghi chú mã khóa',
      });
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
      const sheet = workbook.worksheets[0];
      columns.forEach((_, i) => {
        expect(sheet.getColumn(i + 1).numFmt).toBe('@');
      });
      expect(sheet.getRow(1).values).toEqual([undefined, ...columns]);
      expect(sheet.getRow(1).font?.bold).toBe(true);
      expect(sheet.getCell('B1').note).toBe('Ghi chú mã khóa');
      expect(sheet.getCell('A1').note).toBeUndefined();
    });
  });

  describe('buildLoiWorkbook', () => {
    it('thêm cột "Lý do" và chỉ chứa các dòng lỗi', async () => {
      const buffer = await buildLoiWorkbook(
        ['ten_mon', 'cap_hoc'],
        [
          {
            dong: 3,
            values: { ten_mon: 'X', cap_hoc: 'thpt' },
            ly_do: 'Trùng dữ liệu',
          },
        ],
      );
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
      const sheet = workbook.worksheets[0];
      expect(sheet.getRow(1).values).toEqual([
        undefined,
        'ten_mon',
        'cap_hoc',
        'Lý do',
      ]);
      expect(sheet.getRow(2).values).toEqual([
        undefined,
        'X',
        'thpt',
        'Trùng dữ liệu',
      ]);
    });
  });
});
