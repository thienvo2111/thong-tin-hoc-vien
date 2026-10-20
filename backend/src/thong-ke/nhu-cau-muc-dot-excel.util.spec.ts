import * as ExcelJS from 'exceljs';
import {
  COT_NHU_CAU_MUC_DOT,
  buildNhuCauMucDotWorkbook,
} from './nhu-cau-muc-dot-excel.util';
import { DongNhuCauMucDot, DotThongKe, MoTaBieuMau } from './thong-ke.types';

const DOT: DotThongKe = {
  id: 'dot-1',
  ten_dot: 'Đợt 1',
  khoa_id: 'k-1',
  ma_khoa: 'K01',
  ten_khoa: 'Khóa 1',
  mo_luc: new Date('2026-10-01T01:00:00Z'),
  dong_luc: new Date('2026-10-10T10:00:00Z'),
  trang_thai: 'dang_mo',
};
const MO_TA: MoTaBieuMau = {
  khoa: 'Khóa 1',
  pham_vi: 'Toàn bộ phạm vi tài khoản',
  doi_tuong: 'Tất cả đối tượng',
  ngay_xuat: new Date('2026-10-20T03:00:00Z'),
};

const HV = {
  ho_ten: 'Nguyễn Văn A',
  ma_moet: '0123',
  so_dien_thoai: '0900000001',
  don_vi: { id: 'dv-1', ten: 'Trường X' },
  truong: { id: 'dv-1', ten: 'Trường X' },
};

const DA_CHON: DongNhuCauMucDot = {
  dang_ky_hoc_id: 'dk-1',
  hoc_vien: HV,
  moc_hien_tai: {
    muc: 'nang_cao',
    nguon: 'lop',
    lop: { id: 'l-1', ten_lop: 'Lớp NC 1' },
    giai_doan: null,
  },
  lop_hien_tai: 'Lớp NC 1',
  muc_dau_vao: 'nang_cao',
  muc_hoc_chon: 'thanh_thao',
  lua_chon: {
    muc_chon: 'co_ban',
    muc_moc: 'nang_cao',
    nguon_moc: 'lop',
    lop_luc_chon: 'Lớp NC 1',
    // 23:05 UTC = 06:05 ngày hôm sau giờ VN
    chon_luc: new Date('2026-10-05T23:05:00Z'),
    cap_nhat_luc: new Date('2026-10-06T02:30:00Z'),
  },
};
const CHUA_CHON: DongNhuCauMucDot = {
  ...DA_CHON,
  dang_ky_hoc_id: 'dk-2',
  hoc_vien: { ...HV, ho_ten: 'Trần Thị B', ma_moet: null },
  moc_hien_tai: {
    muc: 'thanh_thao',
    nguon: 'muc_chot',
    lop: null,
    giai_doan: null,
  },
  lop_hien_tai: null,
  muc_dau_vao: null,
  muc_hoc_chon: null,
  lua_chon: null,
};

const HEADER = [
  'STT',
  'Họ tên',
  'Mã MOET',
  'SĐT',
  'Đơn vị',
  'Trường',
  'Lớp hiện tại',
  'Mức hiện tại',
  'Nguồn mốc',
  'Lớp lúc chọn',
  'Mức lúc chọn',
  'Nhu cầu chọn',
  'Chọn lúc',
  'Cập nhật lúc',
  '# Mức chốt',
  '# Nhu cầu lần 1',
];

async function docLai(buf: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  return wb;
}

function hangCo(ws: ExcelJS.Worksheet, giaTriCot1: string): number {
  for (let r = 1; r <= ws.rowCount; r++) {
    if (ws.getCell(r, 1).value === giaTriCot1) return r;
  }
  return -1;
}

describe('buildNhuCauMucDotWorkbook', () => {
  it('có 2 sheet "Tổng hợp" và "Danh sách"', async () => {
    const wb = await docLai(
      await buildNhuCauMucDotWorkbook(DOT, [DA_CHON, CHUA_CHON], MO_TA),
    );
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Tổng hợp', 'Danh sách']);
  });

  it('sheet Danh sách: header đúng thứ tự, dòng đã chọn/chưa chọn đúng giá trị', async () => {
    expect(COT_NHU_CAU_MUC_DOT).toEqual(HEADER);
    const wb = await docLai(
      await buildNhuCauMucDotWorkbook(DOT, [DA_CHON, CHUA_CHON], MO_TA),
    );
    const ws = wb.getWorksheet('Danh sách')!;
    const rHeader = hangCo(ws, 'STT');
    expect(rHeader).toBeGreaterThan(0);
    const header = HEADER.map((_, i) => ws.getCell(rHeader, i + 1).value);
    expect(header).toEqual(HEADER);

    const dong = (r: number) =>
      HEADER.map((_, i) => ws.getCell(r, i + 1).value);
    expect(dong(rHeader + 1)).toEqual([
      1,
      'Nguyễn Văn A',
      '0123',
      '0900000001',
      'Trường X',
      'Trường X',
      'Lớp NC 1',
      'Nâng cao',
      'Lớp',
      'Lớp NC 1',
      'Nâng cao',
      'Cơ bản',
      '06/10/2026 06:05',
      '06/10/2026 09:30',
      'Nâng cao',
      'Thành thạo',
    ]);
    const chua = dong(rHeader + 2);
    expect(chua[1]).toBe('Trần Thị B');
    expect(chua[7]).toBe('Thành thạo');
    expect(chua[8]).toBe('Mức chốt');
    expect(chua[11]).toBe('Chưa chọn');
    expect(chua[12]).toBe('');
  });

  it('sheet Tổng hợp có KPI, ma trận và theo trường', async () => {
    const wb = await docLai(
      await buildNhuCauMucDotWorkbook(DOT, [DA_CHON, CHUA_CHON], MO_TA),
    );
    const ws = wb.getWorksheet('Tổng hợp')!;
    const text: string[] = [];
    ws.eachRow((row) => row.eachCell((c) => text.push(String(c.value ?? ''))));
    const all = text.join('|');
    expect(all).toContain('Đợt 1');
    expect(all).toContain('Đủ điều kiện');
    expect(all).toContain('Tỷ lệ đã chọn (%)|50');
    expect(all).not.toContain('NaN');
    const rKpi = hangCo(ws, 'Đã chọn');
    expect(ws.getCell(rKpi, 2).value).toBe(1);
    expect(all).toContain('Trường X');
  });

  it('không có dòng nào → vẫn ra file, tỷ lệ 0', async () => {
    const wb = await docLai(await buildNhuCauMucDotWorkbook(DOT, [], MO_TA));
    const ws = wb.getWorksheet('Danh sách')!;
    expect(hangCo(ws, 'STT')).toBeGreaterThan(0);
    const th = wb.getWorksheet('Tổng hợp')!;
    expect(th.getCell(hangCo(th, 'Tỷ lệ đã chọn (%)'), 2).value).toBe(0);
  });
});
