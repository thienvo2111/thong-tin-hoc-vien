import * as ExcelJS from 'exceljs';
import { buildTongHopWorkbook } from './report-excel.util';
import { TongHopResult } from '../bao-cao.types';

async function readSheetValues(buffer: Buffer): Promise<unknown[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  const rows: unknown[][] = [];
  sheet.eachRow((row) => {
    rows.push((row.values as unknown[]).slice(1)); // exceljs values[0] luôn undefined (1-indexed)
  });
  return rows;
}

describe('report-excel.util', () => {
  it('theo=don_vi: sinh đúng header + dòng dữ liệu, giữ nguyên dấu tiếng Việt (round-trip)', async () => {
    const result: TongHopResult = {
      theo: 'don_vi',
      tu_ngay: null,
      den_ngay: null,
      rows: [
        {
          don_vi_id: 'x',
          ten_don_vi: 'Trường Tiểu học Nguyễn Trãi – Xã Đông Anh',
          tong_so: 3,
          theo_trang_thai: {
            nhap: 1,
            cho_duyet: 0,
            da_duyet: 2,
            tu_choi: 0,
            loi: 0,
          },
          theo_cap_giang_day: {
            mam_non: 0,
            tieu_hoc: 3,
            thcs: 0,
            thpt: 0,
            khong_xac_dinh: 0,
          },
        },
      ],
    };

    const buffer = await buildTongHopWorkbook(result);
    const rows = await readSheetValues(buffer);

    expect(rows[0]).toEqual([
      'Đơn vị',
      'Tổng số',
      'Nháp',
      'Chờ duyệt',
      'Đã duyệt',
      'Từ chối',
      'Lỗi',
      'Mầm non',
      'Tiểu học',
      'THCS',
      'THPT',
      'Không xác định',
    ]);
    expect(rows[1]).toEqual([
      'Trường Tiểu học Nguyễn Trãi – Xã Đông Anh',
      3,
      1,
      0,
      2,
      0,
      0,
      0,
      3,
      0,
      0,
      0,
    ]);
  });

  it('theo=dia_ban: cột đầu là "Địa bàn", giữ dấu tiếng Việt', async () => {
    const result: TongHopResult = {
      theo: 'dia_ban',
      tu_ngay: '2026-01-01',
      den_ngay: '2026-12-31',
      rows: [
        {
          dia_ban_id: 'y',
          ten_dia_ban: 'Phường Vị Hoàng',
          tong_so: 1,
          theo_trang_thai: {
            nhap: 0,
            cho_duyet: 0,
            da_duyet: 1,
            tu_choi: 0,
            loi: 0,
          },
          theo_cap_giang_day: {
            mam_non: 0,
            tieu_hoc: 0,
            thcs: 1,
            thpt: 0,
            khong_xac_dinh: 0,
          },
        },
      ],
    };

    const buffer = await buildTongHopWorkbook(result);
    const rows = await readSheetValues(buffer);
    expect(rows[0][0]).toBe('Địa bàn');
    expect(rows[1][0]).toBe('Phường Vị Hoàng');
  });

  it('theo=khoa: đúng header + số liệu đăng ký/kết quả, giữ dấu tiếng Việt', async () => {
    const result: TongHopResult = {
      theo: 'khoa',
      tu_ngay: null,
      den_ngay: null,
      rows: [
        {
          khoa_id: 'k1',
          ma_khoa: 'K-001',
          ten_khoa: 'Bồi dưỡng Tiếng Việt lớp 1 – đợt 1',
          don_vi_to_chuc: 'Trường Tiểu học Đống Đa',
          trang_thai_khoa: 'da_duyet',
          tong_dang_ky: 2,
          theo_trang_thai_dang_ky: {
            cho_duyet: 0,
            da_duyet: 1,
            tu_choi: 0,
            da_phan_lop: 1,
          },
          theo_ket_qua: {
            dang_hoc: 1,
            dat: 0,
            khong_dat: 0,
            vang: 0,
            chua_co_ket_qua: 1,
          },
        },
      ],
    };

    const buffer = await buildTongHopWorkbook(result);
    const rows = await readSheetValues(buffer);

    expect(rows[0]).toEqual([
      'Mã khóa',
      'Tên khóa',
      'Đơn vị tổ chức',
      'Trạng thái khóa',
      'Tổng đăng ký',
      'Chờ duyệt',
      'Đã duyệt',
      'Từ chối',
      'Đã phân lớp',
      'Đang học',
      'Đạt',
      'Không đạt',
      'Vắng',
      'Chưa có kết quả',
    ]);
    expect(rows[1]).toEqual([
      'K-001',
      'Bồi dưỡng Tiếng Việt lớp 1 – đợt 1',
      'Trường Tiểu học Đống Đa',
      'da_duyet',
      2,
      0,
      1,
      0,
      1,
      1,
      0,
      0,
      0,
      1,
    ]);
  });
});
