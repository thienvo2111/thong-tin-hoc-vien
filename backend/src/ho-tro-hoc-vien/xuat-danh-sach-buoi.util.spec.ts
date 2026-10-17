import * as ExcelJS from 'exceljs';
import {
  COT_DANH_SACH_BUOI,
  DongXuatBuoi,
  SheetBuoi,
  TIEU_DE_DOI_RA,
  buildDanhSachBuoiWorkbook,
} from './xuat-danh-sach-buoi.util';
import { COT_CO_BAN } from './xuat-danh-sach-lop.util';
import { DiemDanhDong } from './diem-danh-lop-buoi.util';

// ADR 0008 L7: file danh sách theo buổi — cột cơ bản (có Mã MOET) + Điểm danh,
// Giờ tự điểm danh (L8) + Ghi chú; người đổi ra ở mục riêng cuối sheet (chỉ
// khi có); 1 sheet/buổi; dòng 3 là tổng hợp điểm danh.
const CO_MAT: DiemDanhDong = {
  ma: 'co_mat',
  nhan: 'Có mặt – tự điểm danh 08:05',
  tu_diem_danh_luc: '2026-10-20T01:05:00.000Z',
};
const dong = (
  ho_ten: string,
  ghi_chu: string | null = null,
  diem_danh: DiemDanhDong | null = CO_MAT,
): DongXuatBuoi => ({
  ho_ten,
  ma_dinh_danh_moet: '0079000001',
  ngay_sinh: '02/03/1988',
  don_vi_cong_tac_ten: 'Trường A',
  doi_tuong: 'giao_vien',
  so_dien_thoai_lien_he: '0912345678',
  email_lien_he: null,
  cum: null,
  day_du: true,
  dang_nhap_lan_cuoi: null,
  khao_sat: [],
  ghi_chu,
  diem_danh,
});

const lop = {
  ten_lop: 'Zoom 01',
  loai_lop: 'zoom',
  khoa: { ma_khoa: 'K1', ten_khoa: 'Khóa 1' },
};

// 2026-10-20 08:00 giờ VN = 01:00Z.
const sheet = (over: Partial<SheetBuoi> = {}): SheetBuoi => ({
  lop,
  buoi: {
    giai_doan: { thu_tu: 1, ten_giai_doan: 'Học Zoom' },
    buoi_so: 2,
    thoi_gian_bat_dau: new Date('2026-10-20T01:00:00Z'),
    thoi_gian_ket_thuc: new Date('2026-10-20T04:00:00Z'),
    tong_diem_danh: {
      co_mat: 1,
      vang: 1,
      vang_co_phep: 0,
      da_bao_vang: 0,
      chua_diem_danh: 0,
      chua_den_gio: 0,
    },
  },
  hoc_vien: [
    dong('An'),
    dong('Bình', 'Đổi buổi – từ lớp Zoom 02', {
      ma: 'vang',
      nhan: 'Vắng',
      tu_diem_danh_luc: null,
    }),
  ],
  doi_ra: [],
  ...over,
});

async function doc(buf: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  return wb;
}

const hang = (ws: ExcelJS.Worksheet, i: number) =>
  (ws.getRow(i).values as unknown[])
    .slice(1)
    .map((v) => (v == null ? '' : String(v)));

describe('buildDanhSachBuoiWorkbook', () => {
  it('đầu sheet có khóa/lớp, buổi + giờ VN, tổng điểm danh; cột cơ bản + Điểm danh + Giờ tự điểm danh + Ghi chú', async () => {
    const wb = await doc(await buildDanhSachBuoiWorkbook([sheet()]));
    const ws = wb.worksheets[0];
    expect(ws.name).toBe('GĐ1 B2 20-10');
    expect(hang(ws, 1)[0]).toContain('K1');
    expect(hang(ws, 1)[0]).toContain('Zoom 01');
    expect(hang(ws, 2)[0]).toContain('Buổi 2');
    expect(hang(ws, 2)[0]).toContain('20/10/2026 08:00–11:00');
    expect(hang(ws, 3)[0]).toBe(
      'Điểm danh: Có mặt 1 · Vắng 1 · Có phép 0 · Báo vắng 0 · Chưa điểm danh 0',
    );
    expect(hang(ws, 4)).toEqual([
      ...COT_CO_BAN,
      'Điểm danh',
      'Giờ tự điểm danh',
      'Ghi chú',
    ]);
    expect(COT_DANH_SACH_BUOI.slice(1, 4)).toEqual([
      'Họ tên',
      'Mã MOET',
      'Ngày sinh',
    ]);
    expect(COT_DANH_SACH_BUOI).not.toContain('Có mặt / đã diễn ra');
    expect(hang(ws, 5).slice(0, 4)).toEqual([
      '1',
      'An',
      '0079000001',
      '02/03/1988',
    ]);
    expect(ws.getRow(5).getCell(3).value).toBe('0079000001');
    expect(hang(ws, 5).slice(-3)).toEqual([
      'Có mặt – tự điểm danh 08:05',
      '20/10/2026 08:05',
      '',
    ]);
    expect(hang(ws, 6)[1]).toBe('Bình');
    expect(hang(ws, 6).slice(-3)).toEqual([
      'Vắng',
      '',
      'Đổi buổi – từ lớp Zoom 02',
    ]);
  });

  it('không có người đổi ra -> không có mục tách riêng', async () => {
    const wb = await doc(await buildDanhSachBuoiWorkbook([sheet()]));
    const ws = wb.worksheets[0];
    expect(ws.rowCount).toBe(6);
    const tatCa = Array.from({ length: ws.rowCount }, (_, i) =>
      hang(ws, i + 1).join('|'),
    ).join('\n');
    expect(tatCa).not.toContain(TIEU_DE_DOI_RA);
  });

  it('có người đổi ra -> dòng trống, tiêu đề đậm, STT đánh lại kèm ghi chú', async () => {
    const ghiChu = 'Đã chuyển sang lớp Zoom 03 – không học buổi này';
    const wb = await doc(
      await buildDanhSachBuoiWorkbook([
        sheet({
          doi_ra: [dong('Cường', ghiChu, null), dong('Dũng', ghiChu, null)],
        }),
      ]),
    );
    const ws = wb.worksheets[0];
    expect(hang(ws, 7).every((v) => v === '')).toBe(true);
    expect(hang(ws, 8)[0]).toBe(TIEU_DE_DOI_RA);
    expect(ws.getRow(8).font?.bold).toBe(true);
    expect(hang(ws, 9).slice(0, 2)).toEqual(['1', 'Cường']);
    // Người đổi ra không có điểm danh tại buổi này.
    expect(hang(ws, 9).slice(-3)).toEqual(['', '', ghiChu]);
    expect(hang(ws, 10).slice(0, 2)).toEqual(['2', 'Dũng']);
  });

  it('nhiều buổi -> 1 sheet/buổi, tên sheet không trùng', async () => {
    const b = sheet().buoi;
    const wb = await doc(
      await buildDanhSachBuoiWorkbook([
        sheet(),
        sheet({ buoi: { ...b, buoi_so: 3 } }),
        sheet({ buoi: { ...b, buoi_so: 3 } }),
      ]),
    );
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'GĐ1 B2 20-10',
      'GĐ1 B3 20-10',
      'GĐ1 B3 20-10 (2)',
    ]);
  });

  it('không có buổi -> 1 sheet rỗng', async () => {
    const wb = await doc(await buildDanhSachBuoiWorkbook([]));
    expect(wb.worksheets).toHaveLength(1);
  });
});
