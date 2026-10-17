import * as ExcelJS from 'exceljs';
import {
  COT_DANH_SACH_LOP,
  DongXuatLop,
  buildDanhSachLopWorkbook,
  dinhDangNgaySinh,
} from './xuat-danh-sach-lop.util';
import { buildDanhSachCumWorkbook } from './xuat-danh-sach-cum.util';

// ADR 0008 L5: file danh sách lớp — có Ngày sinh dd/mm/yyyy và mã MOET (yêu
// cầu 2026-10-17), KHÔNG có CCCD/số định danh, nơi sinh; 1 sheet/lớp; rỗng →
// 1 sheet chờ. L8: cột cuối "Có mặt / đã diễn ra" dạng x/y.
const dong = (over: Partial<DongXuatLop> = {}): DongXuatLop => ({
  ho_ten: 'Nguyễn Văn Một',
  ma_dinh_danh_moet: '0079123456',
  ngay_sinh: dinhDangNgaySinh(2, 3, 1988),
  don_vi_cong_tac_ten: 'Trường A',
  doi_tuong: 'giao_vien',
  so_dien_thoai_lien_he: '0912345678',
  email_lien_he: 'a@b.vn',
  cum: 'Cụm X',
  day_du: true,
  dang_nhap_lan_cuoi: new Date(),
  khao_sat: [{ loai: 'danh-gia', trang_thai: 'hoan_thanh' }],
  chuyen_can: { co_mat: 2, da_dien_ra: 3 },
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
  it('đủ cột, có Mã MOET sau Họ tên + Ngày sinh, không có CCCD/nơi sinh', async () => {
    const wb = await doc(
      await buildDanhSachLopWorkbook([
        { ten_lop: 'Zoom 01', loai_lop: 'zoom', khoa, hoc_vien: [dong()] },
      ]),
    );
    const ws = wb.worksheets[0];
    expect(hang(ws, 1)[0]).toContain('Zoom 01');
    expect(hang(ws, 1)[0]).toContain('K1');
    expect(hang(ws, 2)).toEqual(COT_DANH_SACH_LOP);
    expect(COT_DANH_SACH_LOP.join('|')).not.toMatch(/CCCD|định danh|Nơi sinh/i);
    expect(COT_DANH_SACH_LOP.slice(1, 4)).toEqual([
      'Họ tên',
      'Mã MOET',
      'Ngày sinh',
    ]);
    expect(COT_DANH_SACH_LOP.at(-1)).toBe('Có mặt / đã diễn ra');
    // Mã MOET là ô văn bản, giữ số 0 đầu.
    expect(ws.getRow(3).getCell(3).value).toBe('0079123456');
    expect(hang(ws, 3)).toEqual([
      '1',
      'Nguyễn Văn Một',
      '0079123456',
      '02/03/1988',
      'Trường A',
      'Giáo viên',
      '0912345678',
      'a@b.vn',
      'Cụm X',
      'Đủ',
      'Rồi',
      'danh-gia: hoàn thành',
      '2/3',
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
              ma_dinh_danh_moet: null,
              chuyen_can: { co_mat: 0, da_dien_ra: 0 },
            }),
          ],
        },
      ]),
    );
    const r = hang(wb.worksheets[0], 3);
    expect(r[2]).toBe('');
    expect(r[8]).toBe('');
    expect(r.slice(9)).toEqual(['Chưa đủ', 'Chưa', 'Không áp dụng', '0/0']);
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

  it('file CỤM vẫn không có mã MOET (ADR 0003 H6 giữ nguyên)', async () => {
    const wb = await doc(
      await buildDanhSachCumWorkbook([
        {
          ten_cum: 'Cụm X',
          giai_doan: [],
          hoc_vien: [{ ...dong(), lop_theo_giai_doan: {}, khao_sat: [] }],
        },
      ]),
    );
    const ws = wb.worksheets[0];
    expect(hang(ws, 1).join('|')).not.toMatch(/MOET|Ngày sinh/i);
    expect(hang(ws, 2)).not.toContain('0079123456');
  });
});
