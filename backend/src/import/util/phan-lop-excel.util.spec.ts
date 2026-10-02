import * as ExcelJS from 'exceljs';
import {
  parseThuTuCotGiaiDoan,
  readPhanLopWorkbook,
  tieuDeCotGiaiDoan,
} from './phan-lop-excel.util';

async function xlsx(rows: (string | undefined)[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Mau');
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('parseThuTuCotGiaiDoan', () => {
  it.each([
    ['GĐ2 - Học trực tuyến qua zoom', 2],
    ['  gđ 10 -  tên khác ', 10],
    ['GD3', 3],
    ['gd 4 - Học trực tiếp', 4],
    ['ten_cum', null],
    ['Giai đoạn 2', null],
  ])('%s -> %s', (h, kq) => expect(parseThuTuCotGiaiDoan(h)).toBe(kq));
});

it('tieuDeCotGiaiDoan', () => {
  expect(tieuDeCotGiaiDoan({ thu_tu: 2, ten_giai_doan: 'Zoom' })).toBe(
    'GĐ2 - Zoom',
  );
});

describe('readPhanLopWorkbook', () => {
  const hopLe = new Set([1, 2, 3]);

  it('đọc cột cố định + cột GĐ (thứ tự tùy ý, thiếu GĐ được), bỏ dòng trống', async () => {
    const buf = await xlsx([
      [
        'ma_dinh_danh_moet',
        'GĐ3 - VLE',
        'so_dinh_danh_ca_nhan',
        'GD 2 - tên cũ',
        'ten_cum',
      ],
      ['0890', 'Lớp VLE 3', '', '-', 'Cụm 1'],
      [],
    ]);
    const { rows } = await readPhanLopWorkbook(buf, hopLe);
    expect(rows).toEqual([
      {
        dong: 2,
        values: {
          ma_dinh_danh_moet: '0890',
          so_dinh_danh_ca_nhan: '',
          ten_cum: 'Cụm 1',
          'gd:3': 'Lớp VLE 3',
          'gd:2': '-',
        },
      },
    ]);
  });

  it('thiếu ten_cum -> vẫn đọc, ten_cum = ""', async () => {
    const buf = await xlsx([
      ['so_dinh_danh_ca_nhan', 'ma_dinh_danh_moet', 'GĐ1 - x'],
      ['', '1', 'A'],
    ]);
    const { rows } = await readPhanLopWorkbook(buf, hopLe);
    expect(rows[0].values.ten_cum).toBe('');
  });

  it.each([
    [['so_dinh_danh_ca_nhan', 'ma_dinh_danh_moet', 'ten_lop'], 'mẫu cũ'],
    [['so_dinh_danh_ca_nhan', 'ma_dinh_danh_moet', 'ten_lop_zoom'], 'mẫu cũ'],
    [['so_dinh_danh_ca_nhan', 'ma_dinh_danh_moet', 'GĐ9 - x'], 'GĐ9'],
    [
      ['so_dinh_danh_ca_nhan', 'ma_dinh_danh_moet', 'GĐ2 - a', 'GD2 - b'],
      'trùng',
    ],
    [['so_dinh_danh_ca_nhan', 'ma_dinh_danh_moet', 'cot_la'], 'cot_la'],
    [['ma_dinh_danh_moet', 'GĐ2 - a'], 'so_dinh_danh_ca_nhan'],
  ])('tiêu đề %j -> lỗi chứa "%s"', async (header, chua) => {
    const buf = await xlsx([header, ['1', '2', '3']]);
    // ValidationException giữ thông điệp ở response.error.message.
    await expect(readPhanLopWorkbook(buf, hopLe)).rejects.toMatchObject({
      response: { error: { message: expect.stringContaining(chua) } },
    });
  });
});
