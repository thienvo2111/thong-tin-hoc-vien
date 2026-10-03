import * as ExcelJS from 'exceljs';
import { cellToPlainText, readMoetWorkbookRows } from './moet-excel.util';
import { ValidationException } from '../../common/exceptions/app.exceptions';

async function toBuffer(rows: unknown[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('data');
  rows.forEach((r) => sheet.addRow(r));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

const SINGLE_TIER_HEADER = [
  'Đơn vị',
  'Mã định danh (CDSL moet)',
  'Họ và tên',
  'Ngày',
  'Tháng',
  'Năm',
  'Chức vụ',
  'Chuyên môn',
  'Số điện thoại',
  'Ghi chú',
];

describe('moet-excel.util', () => {
  describe('cellToPlainText', () => {
    it('số nguyên -> chuỗi không ".0"/ký hiệu khoa học', () => {
      expect(cellToPlainText(9115131060)).toBe('9115131060');
      expect(cellToPlainText(912345678)).toBe('912345678');
    });

    it('null/undefined -> chuỗi rỗng', () => {
      expect(cellToPlainText(null)).toBe('');
      expect(cellToPlainText(undefined)).toBe('');
    });

    it('rich text object -> nối text', () => {
      expect(
        cellToPlainText({ richText: [{ text: 'Nguyễn ' }, { text: 'An' }] }),
      ).toBe('Nguyễn An');
    });

    it('formula result -> lấy result', () => {
      expect(cellToPlainText({ formula: '=A1', result: 42 })).toBe('42');
    });

    it('hyperlink -> text hiển thị (cả khi text là rich text)', () => {
      expect(cellToPlainText({ text: 'abc', hyperlink: 'http://x' })).toBe(
        'abc',
      );
      expect(
        cellToPlainText({
          text: { richText: [{ text: 'a' }, { text: 'b' }] },
          hyperlink: 'http://x',
        }),
      ).toBe('ab');
    });

    it('ô lỗi Excel -> rỗng', () => {
      expect(cellToPlainText({ error: '#N/A' })).toBe('');
    });

    it('Date giữ nguyên hành vi cũ (ISO)', () => {
      const d = new Date(Date.UTC(2026, 0, 1));
      expect(cellToPlainText(d)).toBe(d.toISOString());
    });
  });

  describe('readMoetWorkbookRows', () => {
    it('header đúng dòng 1 (đơn tầng, khớp hệt file mẫu hiện có) -> đọc đúng', async () => {
      const buffer = await toBuffer([
        SINGLE_TIER_HEADER,
        [
          'Trường A',
          'MOET-001',
          'Trần Thị Bình',
          10,
          3,
          1990,
          'Giáo viên',
          'Toán;Lý',
          '0912345678',
          '',
        ],
      ]);
      const rows = await readMoetWorkbookRows(buffer);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({
        dong: 2,
        values: {
          'Đơn vị': 'Trường A',
          'Mã định danh (CDSL moet)': 'MOET-001',
          'Họ và tên': 'Trần Thị Bình',
          Ngày: '10',
          Tháng: '3',
          Năm: '1990',
          'Chức vụ': 'Giáo viên',
          'Chuyên môn': 'Toán;Lý',
          'Số điện thoại': '0912345678',
          'Ghi chú': '',
        },
      });
    });

    it('bỏ qua các dòng tiêu đề/ghi chú phía trên trước khi tới dòng header thật', async () => {
      const buffer = await toBuffer([
        ['DANH SÁCH GIÁO VIÊN TIẾP NHẬN'],
        ['Đơn vị: Sở GD&ĐT An Giang'],
        [],
        SINGLE_TIER_HEADER,
        [
          'Trường B',
          'MOET-002',
          'Nguyễn Văn C',
          '08',
          '9',
          1985,
          '',
          'Văn',
          '0911111111',
          '',
        ],
      ]);
      const rows = await readMoetWorkbookRows(buffer);
      expect(rows).toHaveLength(1);
      expect(rows[0].values['Đơn vị']).toBe('Trường B');
      expect(rows[0].values['Ngày']).toBe('08');
    });

    it('tiêu đề 2 tầng: ô gộp "Ngày tháng năm sinh" ở dòng trên, Ngày/Tháng/Năm ở dòng dưới', async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('data');
      sheet.addRow([
        'Đơn vị',
        'Mã định danh (CDSL moet)',
        'Họ và tên',
        'Ngày tháng năm sinh',
        '',
        '',
        'Chức vụ',
        'Chuyên môn',
        'Số điện thoại',
        'Ghi chú',
      ]);
      sheet.mergeCells(1, 4, 1, 6); // D1:F1 gộp cho "Ngày tháng năm sinh"
      sheet.addRow(['', '', '', 'Ngày', 'Tháng', 'Năm', '', '', '', '']);
      sheet.addRow([
        'Trường C',
        'MOET-003',
        'Lê Thị D',
        15,
        6,
        1988,
        'TTCM',
        'Hóa',
        '0933333333',
        'Ghi chú test',
      ]);
      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

      const rows = await readMoetWorkbookRows(buffer);
      expect(rows).toHaveLength(1);
      expect(rows[0].values).toEqual({
        'Đơn vị': 'Trường C',
        'Mã định danh (CDSL moet)': 'MOET-003',
        'Họ và tên': 'Lê Thị D',
        Ngày: '15',
        Tháng: '6',
        Năm: '1988',
        'Chức vụ': 'TTCM',
        'Chuyên môn': 'Hóa',
        'Số điện thoại': '0933333333',
        'Ghi chú': 'Ghi chú test',
      });
    });

    it('cột "Mã đơn vị" tùy chọn được đọc đúng khi có trong file', async () => {
      const buffer = await toBuffer([
        ['Mã đơn vị', ...SINGLE_TIER_HEADER],
        [
          'DV-001',
          'Trường trùng tên',
          'MOET-004',
          'Phạm Văn E',
          1,
          1,
          1995,
          '',
          'Sinh',
          '0944444444',
          '',
        ],
      ]);
      const rows = await readMoetWorkbookRows(buffer);
      expect(rows[0].values['Mã đơn vị']).toBe('DV-001');
    });

    it('không phân biệt hoa/thường, khoảng trắng thừa, phần trong ngoặc của tên cột', async () => {
      const buffer = await toBuffer([
        [
          '  đơn vị  ',
          'MÃ ĐỊNH DANH (CDSL moet)',
          'họ VÀ tên',
          'ngày',
          'tháng',
          'NĂM',
          'chức vụ',
          'chuyên môn',
          'số điện thoại',
          'ghi chú',
        ],
        [
          'Trường D',
          'MOET-005',
          'Võ Thị F',
          2,
          2,
          1992,
          '',
          'Sử',
          '0955555555',
          '',
        ],
      ]);
      const rows = await readMoetWorkbookRows(buffer);
      expect(rows).toHaveLength(1);
      expect(rows[0].values['Đơn vị']).toBe('Trường D');
    });

    it('mã MOET / SĐT lưu dạng number -> đọc về chuỗi không ".0"', async () => {
      const buffer = await toBuffer([
        SINGLE_TIER_HEADER,
        [
          'Trường E',
          9115131060, // number, không phải string
          'Đinh Văn G',
          8,
          8,
          1980,
          '',
          'Địa',
          912345678, // number, mất số 0 đầu — xử lý ở ImportService, không ở đây
          '',
        ],
      ]);
      const rows = await readMoetWorkbookRows(buffer);
      expect(rows[0].values['Mã định danh (CDSL moet)']).toBe('9115131060');
      expect(rows[0].values['Số điện thoại']).toBe('912345678');
    });

    it('bỏ qua dòng trống hoàn toàn giữa các dòng dữ liệu', async () => {
      const buffer = await toBuffer([
        SINGLE_TIER_HEADER,
        [
          'Trường F',
          'MOET-006',
          'Bùi Văn H',
          1,
          1,
          2000,
          '',
          'Toán',
          '0966666666',
          '',
        ],
        [],
        [
          'Trường F',
          'MOET-007',
          'Bùi Thị I',
          2,
          2,
          2001,
          '',
          'Lý',
          '0977777777',
          '',
        ],
      ]);
      const rows = await readMoetWorkbookRows(buffer);
      expect(rows).toHaveLength(2);
    });

    it('không tìm được dòng header (thiếu cả "Đơn vị" và "Mã định danh") -> ValidationException', async () => {
      const buffer = await toBuffer([
        ['cot_sai_1', 'cot_sai_2'],
        ['a', 'b'],
      ]);
      await expect(readMoetWorkbookRows(buffer)).rejects.toBeInstanceOf(
        ValidationException,
      );
    });

    // T4b (2026-09-29): "Mã định danh (CDSL moet)" chuyển thành tùy chọn ở
    // cấp file — dò dòng tiêu đề giờ neo CHỈ theo "Đơn vị".
    it('file KHÔNG có cột "Mã định danh" nhưng CÓ "Đơn vị" -> vẫn dò đúng dòng tiêu đề', async () => {
      const HEADER_KHONG_MA_MOET = [
        'Đơn vị',
        'Số định danh cá nhân',
        'Họ và tên',
        'Ngày',
        'Tháng',
        'Năm',
        'Chức vụ',
        'Chuyên môn',
        'Số điện thoại',
        'Ghi chú',
      ];
      const buffer = await toBuffer([
        HEADER_KHONG_MA_MOET,
        [
          'Trường G',
          '123456789012',
          'Ngô Thị K',
          3,
          3,
          1993,
          '',
          'Anh',
          '0988888888',
          '',
        ],
      ]);
      const rows = await readMoetWorkbookRows(buffer);
      expect(rows).toHaveLength(1);
      expect(rows[0].values['Số định danh cá nhân']).toBe('123456789012');
      expect(rows[0].values['Mã định danh (CDSL moet)']).toBeUndefined();
    });

    it('file KHÔNG có cột "Số định danh cá nhân" -> vẫn đọc được (chỉ có mã MOET, hành vi cũ)', async () => {
      const buffer = await toBuffer([
        SINGLE_TIER_HEADER,
        [
          'Trường H',
          'MOET-009',
          'Đặng Văn L',
          4,
          4,
          1994,
          '',
          'Sinh',
          '0999999999',
          '',
        ],
      ]);
      const rows = await readMoetWorkbookRows(buffer);
      expect(rows[0].values['Mã định danh (CDSL moet)']).toBe('MOET-009');
      expect(rows[0].values['Số định danh cá nhân']).toBeUndefined();
    });

    it.each(['Số định danh cá nhân', 'CCCD', 'Số CCCD'])(
      'nhận diện alias cột CCCD: "%s"',
      async (tieuDe) => {
        const buffer = await toBuffer([
          [
            'Đơn vị',
            tieuDe,
            'Họ và tên',
            'Ngày',
            'Tháng',
            'Năm',
            'Chuyên môn',
            'Số điện thoại',
          ],
          [
            'Trường I',
            '123456789013',
            'Mai Thị M',
            5,
            5,
            1996,
            'Toán',
            '0900000000',
          ],
        ]);
        const rows = await readMoetWorkbookRows(buffer);
        expect(rows[0].values['Số định danh cá nhân']).toBe('123456789013');
      },
    );

    it('có "Đơn vị"/"Mã định danh" nhưng thiếu cột bắt buộc khác -> ValidationException', async () => {
      const buffer = await toBuffer([
        ['Đơn vị', 'Mã định danh (CDSL moet)', 'Họ và tên'],
        ['Trường A', 'MOET-008', 'Test'],
      ]);
      await expect(readMoetWorkbookRows(buffer)).rejects.toBeInstanceOf(
        ValidationException,
      );
    });
  });
});
