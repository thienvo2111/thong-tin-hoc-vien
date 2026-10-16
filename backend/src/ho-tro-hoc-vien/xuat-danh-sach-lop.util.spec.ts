import * as ExcelJS from 'exceljs';
import {
  COT_DANH_SACH_LOP,
  DongXuatLop,
  buildDanhSachLopWorkbook,
  dinhDangNgaySinh,
} from './xuat-danh-sach-lop.util';

// ADR 0008 L5: file danh sách lớp — có Ngày sinh dd/mm/yyyy, KHÔNG có
// CCCD/số định danh, mã MOET, nơi sinh; 1 sheet/lớp; rỗng → 1 sheet chờ.
const dong = (over: Partial<DongXuatLop> = {}): DongXuatLop => ({
  ho_ten: 'Nguyễn Văn Một',
  ngay_sinh: dinhDangNgaySinh(2, 3, 1988),
  don_vi_cong_tac_ten: 'Trường A',
  doi_tuong: 'giao_vien',
  so_dien_thoai_lien_he: '0912345678',
  email_lien_he: 'a@b.vn',
  cum: 'Cụm X',
  day_du: true,
  dang_nhap_lan_cuoi: new Date(),
  khao_sat: [{ loai: 'danh-gia', trang_thai: 'hoan_thanh' }],
  ...over,
});

const khoa = { ma_khoa: 'K1', ten_khoa: 'Khóa 1' };

async function doc(buf: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  return wb;
}

const hang = (ws: ExcelJS.Worksheet, i: number) =>
  (ws.getRow(i).values as unknown[])
    .slice(1)
    .map((v) => (v == null ? '' : String(v)));

describe('buildDanhSachLopWorkbook', () => {
  it('đủ cột, có Ngày sinh dd/mm/yyyy, không có CCCD/MOET/nơi sinh', async () => {
    const wb = await doc(
      await buildDanhSachLopWorkbook([
        { ten_lop: 'Zoom 01', loai_lop: 'zoom', khoa, hoc_vien: [dong()] },
      ]),
    );
    const ws = wb.worksheets[0];
    expect(hang(ws, 1)[0]).toContain('Zoom 01');
    expect(hang(ws, 1)[0]).toContain('K1');
    expect(hang(ws, 2)).toEqual(COT_DANH_SACH_LOP);
    expect(COT_DANH_SACH_LOP.join('|')).not.toMatch(
      /CCCD|định danh|MOET|Nơi sinh/i,
    );
    expect(hang(ws, 3)).toEqual([
      '1',
      'Nguyễn Văn Một',
      '02/03/1988',
      'Trường A',
      'Giáo viên',
      '0912345678',
      'a@b.vn',
      'Cụm X',
      'Đủ',
      'Rồi',
      'danh-gia: hoàn thành',
    ]);
  });

  it('nhân viên → Khảo sát "Không áp dụng"; thiếu cụm/chưa đăng nhập', async () => {
    const wb = await doc(
      await buildDanhSachLopWorkbook([
        {
          ten_lop: 'Zoom 01',
          loai_lop: 'zoom',
          khoa,
          hoc_vien: [
            dong({
              doi_tuong: 'nhan_vien',
              cum: null,
              dang_nhap_lan_cuoi: null,
              day_du: false,
            }),
          ],
        },
      ]),
    );
    const r = hang(wb.worksheets[0], 3);
    expect(r[7]).toBe('');
    expect(r.slice(8)).toEqual(['Chưa đủ', 'Chưa', 'Không áp dụng']);
  });

  it('1 sheet mỗi lớp; tên trùng (khác khóa) được đánh số', async () => {
    const wb = await doc(
      await buildDanhSachLopWorkbook([
        { ten_lop: 'Zoom 01', loai_lop: 'zoom', khoa, hoc_vien: [dong()] },
        { ten_lop: 'Zoom 02', loai_lop: 'zoom', khoa, hoc_vien: [] },
        {
          ten_lop: 'Zoom 01',
          loai_lop: 'zoom',
          khoa: { ma_khoa: 'K2', ten_khoa: 'Khóa 2' },
          hoc_vien: [],
        },
      ]),
    );
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Zoom 01',
      'Zoom 02',
      'Zoom 01 (2)',
    ]);
  });

  it('không có lớp nào → 1 sheet chờ "Danh sách"', async () => {
    const wb = await doc(await buildDanhSachLopWorkbook([]));
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Danh sách']);
  });

  it('dinhDangNgaySinh đệm 0', () => {
    expect(dinhDangNgaySinh(9, 12, 2000)).toBe('09/12/2000');
  });
});
