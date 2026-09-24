import * as ExcelJS from 'exceljs';
import {
  buildLoiWorkbook,
  buildTemplateWorkbook,
  readWorkbookRows,
} from './excel.util';
import { ValidationException } from '../../common/exceptions/app.exceptions';

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

  describe('buildTemplateWorkbook', () => {
    it('sinh file mẫu đúng cột header, không có dòng dữ liệu', async () => {
      const buffer = await buildTemplateWorkbook(['ma', 'ten']);
      const rows = await readWorkbookRows(buffer, ['ma', 'ten']);
      expect(rows).toEqual([]); // chỉ có header, không dòng dữ liệu -> hợp lệ, rỗng
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
