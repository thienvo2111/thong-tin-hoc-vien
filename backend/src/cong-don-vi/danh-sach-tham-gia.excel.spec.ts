import * as ExcelJS from 'exceljs';
import { ValidationException } from '../common/exceptions/app.exceptions';
import {
  COT_MAU,
  COT_XUAT_THEM,
  DongXuatDanhSach,
  docFileDanhSach,
  docNgaySinh,
  taoFileMauDanhSach,
  taoFileXuatDanhSach,
} from './danh-sach-tham-gia.excel';

// Dữ liệu bịa hoàn toàn — không có PII thật.
async function taoFile(dong: unknown[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sh = wb.addWorksheet('S');
  dong.forEach((d) => sh.addRow(d));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

async function loiCua(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(ValidationException);
    return JSON.stringify((e as ValidationException).getResponse());
  }
  throw new Error('Không ném lỗi');
}

describe('docNgaySinh', () => {
  it.each([
    ['05/03/1990', '1990-03-05'],
    ['5/3/1990', '1990-03-05'],
    ['05-03-1990', '1990-03-05'],
    ['05.03.1990', '1990-03-05'],
    ['1990-03-05', '1990-03-05'],
    [new Date(Date.UTC(1985, 11, 31)), '1985-12-31'],
    [
      { formula: 'DATE(1990,3,5)', result: new Date(Date.UTC(1990, 2, 5)) },
      '1990-03-05',
    ],
  ])('%p → %s', (raw, ky) => {
    expect(docNgaySinh(raw)).toBe(ky);
  });

  it.each([null, undefined, '', '   '])('trống %p → null', (raw) => {
    expect(docNgaySinh(raw)).toBeNull();
  });

  it.each(['30/02/1990', '1990', 'abc', '05/13/1990', '01/01/1800', 32874])(
    'sai %p → undefined',
    (raw) => {
      expect(docNgaySinh(raw)).toBeUndefined();
    },
  );
});

describe('docFileDanhSach', () => {
  it('tìm dòng tiêu đề dưới các dòng tiêu đề văn bản, bí danh cột, thứ tự cột tùy ý', async () => {
    const buf = await taoFile([
      ['DANH SÁCH GIÁO VIÊN THAM GIA BỒI DƯỠNG'],
      [],
      [
        'STT',
        'Trường',
        'HỌ TÊN',
        'Ngày sinh (dd/mm/yyyy)',
        'Giới tính',
        'Mã GV',
        'Lớp bồi dưỡng',
        'Mã trường',
        'Giai đoạn tham gia *',
        'Ghi chú',
      ],
      [
        1,
        'Trường THCS Thử Nghiệm',
        'Nguyễn Văn Bịa',
        '05/03/1990',
        'Nam',
        'GV-001',
        'Lớp 1',
        'TR-001',
        'Chỉ GĐ2',
        'ghi chú bịa',
      ],
    ]);
    const ds = await docFileDanhSach(buf);
    expect(ds).toEqual([
      {
        so_dong: 4,
        ho_ten: 'Nguyễn Văn Bịa',
        ngay_sinh: '1990-03-05',
        gioi_tinh: 'Nam',
        ma_goc: 'GV-001',
        lop: 'Lớp 1',
        ma_truong: 'TR-001',
        ten_truong: 'Trường THCS Thử Nghiệm',
        giai_doan: 'chi_gd2',
        ty_le_suat: 0.5,
        ghi_chu: 'ghi chú bịa',
        loi: [],
      },
    ]);
  });

  it('ô ngày Excel, giai đoạn trống = ca_hai/1, bỏ dòng trống, số dòng là dòng Excel thật', async () => {
    const buf = await taoFile([
      ['Họ và tên', 'Ngày sinh', 'Tên trường', 'Giai đoạn tham gia'],
      ['Trần Thị Giả', new Date(Date.UTC(1988, 0, 2)), 'THCS A', ''],
      [null, null, null, null],
      ['Lê Văn Thử', '', 'THCS B', 'Cả 2'],
    ]);
    const ds = await docFileDanhSach(buf);
    expect(
      ds.map((d) => [d.so_dong, d.ngay_sinh, d.giai_doan, d.ty_le_suat]),
    ).toEqual([
      [2, '1988-01-02', 'ca_hai', 1],
      [4, null, 'ca_hai', 1],
    ]);
    expect(ds[1].ma_truong).toBeNull();
  });

  it('dòng lỗi: thiếu họ tên, ngày sai, giai đoạn lạ, quá độ dài — gom đủ lý do', async () => {
    const buf = await taoFile([
      ['Họ tên', 'Ngày sinh', 'Mã trường', 'Giai đoạn', 'Giới tính'],
      ['', '31/02/1990', 'TR-1', 'Chỉ GĐ3', 'x'.repeat(21)],
    ]);
    const [d] = await docFileDanhSach(buf);
    expect(d.loi).toHaveLength(4);
    expect(d.loi.join('|')).toMatch(/Thiếu họ tên/);
    expect(d.loi.join('|')).toMatch(/Ngày sinh không hợp lệ/);
    expect(d.loi.join('|')).toMatch(/Giai đoạn tham gia "Chỉ GĐ3"/);
    expect(d.loi.join('|')).toMatch(/Giới tính dài quá 20/);
    expect(d.giai_doan).toBeNull();
    expect(d.ty_le_suat).toBeNull();
  });

  it('không có cột Họ tên → 400', async () => {
    const buf = await taoFile([
      ['Tên', 'Trường'],
      ['A', 'B'],
    ]);
    expect(await loiCua(docFileDanhSach(buf))).toMatch(/Họ và tên/);
  });

  it('không có cột mã trường lẫn tên trường → 400', async () => {
    const buf = await taoFile([
      ['Họ và tên', 'Ngày sinh'],
      ['A', ''],
    ]);
    expect(await loiCua(docFileDanhSach(buf))).toMatch(/Mã trường/);
  });

  it('file không phải xlsx → 400', async () => {
    expect(
      await loiCua(docFileDanhSach(Buffer.from('khong phai excel'))),
    ).toMatch(/Không đọc được file Excel/);
  });

  it('file mẫu đọc lại được, sheet đầu không có dòng dữ liệu', async () => {
    const buf = await taoFileMauDanhSach();
    expect(await docFileDanhSach(buf)).toEqual([]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    expect(wb.worksheets[0].getRow(1).values).toEqual([
      undefined,
      ...COT_MAU.map(([, nhan]) => nhan),
    ]);
  });
});

// Issue #59: xuất danh sách hiện tại — sửa trên Excel rồi nạp lại được.
describe('taoFileXuatDanhSach', () => {
  const DS: DongXuatDanhSach[] = [
    {
      ho_ten: 'GV Bịa Một',
      ngay_sinh: '1990-02-01',
      gioi_tinh: 'Nam',
      ma_goc: '00123',
      lop: 'Lớp A',
      ma_truong: 'TR-MAU-001',
      ten_truong: 'Trường THCS Mẫu Một',
      giai_doan: 'ca_hai',
      ty_le_suat: 0.5,
      ghi_chu: 'Thay giữa chừng',
      y_kien_truong: 'Đúng',
    },
    {
      ho_ten: 'GV Bịa Hai',
      ngay_sinh: null,
      gioi_tinh: null,
      ma_goc: null,
      lop: null,
      ma_truong: null,
      ten_truong: 'Trường TH Mẫu Hai',
      giai_doan: 'chi_gd2',
      ty_le_suat: 0.5,
      ghi_chu: null,
      y_kien_truong: null,
    },
  ];

  async function moFile(buf: Buffer) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    return wb.worksheets[0];
  }

  it('dòng tiêu đề = đúng tiêu đề file mẫu + 2 cột thêm ở cuối', async () => {
    const sh = await moFile(await taoFileXuatDanhSach(DS));
    expect(sh.getRow(1).values).toEqual([
      undefined,
      ...COT_MAU.map(([, nhan]) => nhan),
      ...COT_XUAT_THEM,
    ]);
    expect(COT_XUAT_THEM).toEqual(['Tỷ lệ suất', 'Ý kiến của trường']);
  });

  it('ngày sinh là ô ngày Excel định dạng dd/mm/yyyy; giai đoạn ghi nhãn; suất là số', async () => {
    const sh = await moFile(await taoFileXuatDanhSach(DS));
    const o = sh.getRow(2).getCell(2);
    expect(o.value).toEqual(new Date(Date.UTC(1990, 1, 1)));
    expect(o.numFmt).toBe('dd/mm/yyyy');
    expect(sh.getRow(2).getCell(8).value).toBe('Cả 2');
    expect(sh.getRow(3).getCell(8).value).toBe('Chỉ GĐ2');
    expect(sh.getRow(2).getCell(10).value).toBe(0.5);
    expect(sh.getRow(2).getCell(11).value).toBe('Đúng');
    expect(sh.getRow(3).getCell(2).value).toBeNull();
  });

  it('xuất → đọc lại bằng bộ đọc file nạp: đúng dữ liệu, bỏ qua 2 cột thêm (suất suy lại từ giai đoạn)', async () => {
    const ds = await docFileDanhSach(await taoFileXuatDanhSach(DS));
    expect(ds).toEqual([
      {
        so_dong: 2,
        ho_ten: 'GV Bịa Một',
        ngay_sinh: '1990-02-01',
        gioi_tinh: 'Nam',
        ma_goc: '00123',
        lop: 'Lớp A',
        ma_truong: 'TR-MAU-001',
        ten_truong: 'Trường THCS Mẫu Một',
        giai_doan: 'ca_hai',
        ty_le_suat: 1,
        ghi_chu: 'Thay giữa chừng',
        loi: [],
      },
      {
        so_dong: 3,
        ho_ten: 'GV Bịa Hai',
        ngay_sinh: null,
        gioi_tinh: null,
        ma_goc: null,
        lop: null,
        ma_truong: null,
        ten_truong: 'Trường TH Mẫu Hai',
        giai_doan: 'chi_gd2',
        ty_le_suat: 0.5,
        ghi_chu: null,
        loi: [],
      },
    ]);
  });

  it('danh sách rỗng → chỉ có dòng tiêu đề', async () => {
    const buf = await taoFileXuatDanhSach([]);
    expect(await docFileDanhSach(buf)).toEqual([]);
  });
});
