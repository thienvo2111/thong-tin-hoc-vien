import * as ExcelJS from 'exceljs';
import {
  DongChiaLop,
  GiaiDoanChiaLop,
  LopChiaLop,
  buildDanhSachChiaLopWorkbook,
} from './danh-sach-chia-lop-excel.util';
import { readPhanLopWorkbook } from '../../import/util/phan-lop-excel.util';
import { THANG_MUC_MAC_DINH } from '../../sso/thang-muc.service';

const giaiDoan: GiaiDoanChiaLop[] = [
  { id: 'gd-1', thu_tu: 1, ten_giai_doan: 'Trực tiếp' },
  { id: 'gd-2', thu_tu: 2, ten_giai_doan: 'Zoom' },
];

const lopHoc: LopChiaLop[] = [
  { ten_lop: 'Lớp A', loai_lop: 'truc_tiep', muc_nang_luc: 'co_ban', si_so_toi_da: 30 },
  { ten_lop: 'Lớp B', loai_lop: 'zoom', muc_nang_luc: 'nang_cao', si_so_toi_da: 40 },
];

function hocVien(overrides: Partial<DongChiaLop>): DongChiaLop {
  return {
    ho_ten: 'Mặc định',
    ma_dinh_danh_moet: null,
    trang_thai_ho_so: 'da_duyet',
    doi_tuong: null,
    cap_giang_day: null,
    ten_truong: 'Trường X',
    ten_don_vi_quan_ly: null,
    bai_dau_vao: null,
    muc_dau_vao: null,
    muc_hoc_chon: null,
    muc_hoc_chon_luc: null,
    ten_cum: null,
    phan_lop: [],
    ...overrides,
  };
}

const nangCao = hocVien({
  ho_ten: 'Nguyễn Văn B',
  ma_dinh_danh_moet: '0890000001',
  ten_truong: 'Trường B',
  muc_dau_vao: 'nang_cao',
  phan_lop: [{ giai_doan_id: 'gd-1', ten_lop: 'Lớp A', loai_lop: 'truc_tiep' }],
});
const coBan = hocVien({
  ho_ten: 'Lê Thị A',
  ma_dinh_danh_moet: '1000000002',
  ten_truong: 'Trường A',
  muc_hoc_chon: 'co_ban',
  muc_dau_vao: 'nang_cao',
});
const chuaDuyet = hocVien({
  ho_ten: 'Chưa Duyệt C',
  ma_dinh_danh_moet: '1000000003',
  ten_truong: 'Trường C',
  trang_thai_ho_so: 'cho_duyet',
});

async function layHeader(buf: Buffer, tenSheet: string): Promise<string[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  const sheet = wb.getWorksheet(tenSheet)!;
  const header: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    header[col - 1] = String(cell.value ?? '');
  });
  return header;
}

describe('buildDanhSachChiaLopWorkbook', () => {
  it('đủ 4 sheet đúng thứ tự, có dòng "Chưa duyệt" khi có học viên chưa duyệt', async () => {
    const buf = await buildDanhSachChiaLopWorkbook(
      'K1',
      giaiDoan,
      lopHoc,
      [nangCao, coBan, chuaDuyet],
      THANG_MUC_MAC_DINH,
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    expect(wb.worksheets.map((s) => s.name)).toEqual([
      'Phân lớp',
      'Hướng dẫn',
      'Tổng hợp theo mức học',
      'Chưa duyệt',
    ]);
  });

  it('không có học viên chưa duyệt -> không tạo sheet "Chưa duyệt"', async () => {
    const buf = await buildDanhSachChiaLopWorkbook(
      'K1',
      giaiDoan,
      lopHoc,
      [nangCao, coBan],
      THANG_MUC_MAC_DINH,
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    expect(wb.worksheets.map((s) => s.name)).toEqual([
      'Phân lớp',
      'Hướng dẫn',
      'Tổng hợp theo mức học',
    ]);
  });

  it('sheet "Phân lớp": header dòng 1 có cột "#", cột "GĐ1 - Trực tiếp" và "so_dinh_danh_ca_nhan"', async () => {
    const buf = await buildDanhSachChiaLopWorkbook(
      'K1',
      giaiDoan,
      lopHoc,
      [nangCao, coBan],
      THANG_MUC_MAC_DINH,
    );
    const header = await layHeader(buf, 'Phân lớp');
    expect(header[0]).toBe('ma_dinh_danh_moet');
    expect(header).toContain('# Họ tên');
    expect(header).toContain('GĐ1 - Trực tiếp');
    expect(header[header.length - 1]).toBe('so_dinh_danh_ca_nhan');
  });

  it('ma_dinh_danh_moet giữ số 0 đầu dạng text; GĐ import để trống, "# GĐ1 hiện tại" có tên lớp; sắp xếp mức hiệu lực giảm dần rồi Trường/Họ tên', async () => {
    const buf = await buildDanhSachChiaLopWorkbook(
      'K1',
      giaiDoan,
      lopHoc,
      [coBan, nangCao],
      THANG_MUC_MAC_DINH,
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    const sheet = wb.getWorksheet('Phân lớp')!;
    const header = await layHeader(buf, 'Phân lớp');

    // nangCao (mức hiệu lực "nang_cao") phải đứng TRƯỚC coBan (mức hiệu lực "co_ban").
    const colMaDinhDanh = header.indexOf('ma_dinh_danh_moet') + 1;
    expect(sheet.getRow(2).getCell(colMaDinhDanh).value).toBe('0890000001');
    expect(sheet.getRow(2).getCell(colMaDinhDanh).text).toBe('0890000001');
    expect(sheet.getRow(3).getCell(colMaDinhDanh).value).toBe('1000000002');

    const colGd1HienTai = header.indexOf('# GĐ1 hiện tại') + 1;
    const colGd1Nhap = header.indexOf('GĐ1 - Trực tiếp') + 1;
    expect(sheet.getRow(2).getCell(colGd1HienTai).value).toBe('Lớp A');
    expect(sheet.getRow(2).getCell(colGd1Nhap).value ?? '').toBe('');
  });

  it('học viên chưa duyệt chỉ xuất hiện ở sheet "Chưa duyệt", không có ở sheet "Phân lớp"', async () => {
    const buf = await buildDanhSachChiaLopWorkbook(
      'K1',
      giaiDoan,
      lopHoc,
      [nangCao, chuaDuyet],
      THANG_MUC_MAC_DINH,
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    const sheet1 = wb.getWorksheet('Phân lớp')!;
    expect(sheet1.rowCount).toBe(2); // header + 1 học viên đã duyệt

    const sheet4 = wb.getWorksheet('Chưa duyệt')!;
    const tenCoMat = sheet4.getRows(3, sheet4.rowCount - 2)?.map((r) => r.getCell(2).value);
    expect(tenCoMat).toContain('Chưa Duyệt C');
  });

  it('round-trip: nhập lại ngay file xuất ra (chưa điền gì) -> đọc được, mọi gd/ten_cum rỗng, không còn key "#"', async () => {
    const buf = await buildDanhSachChiaLopWorkbook(
      'K1',
      giaiDoan,
      lopHoc,
      [nangCao, coBan],
      THANG_MUC_MAC_DINH,
    );
    const { rows } = await readPhanLopWorkbook(buf, new Set([1, 2]));
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.values['gd:1']).toBe('');
      expect(r.values['gd:2']).toBe('');
      expect(r.values.ten_cum).toBe('');
      expect(Object.keys(r.values).some((k) => k.startsWith('#'))).toBe(false);
    }
  });
});
