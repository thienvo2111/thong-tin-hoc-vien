import * as ExcelJS from 'exceljs';
import {
  buildTongHopWorkbook,
  buildTienDoTruongWorkbook,
  buildBieuMauDangKyTruyCapWorkbook,
  buildTongQuanWorkbook,
  buildVanHanhWorkbook,
} from './report-excel.util';
import { TienDoTruongDong, DongHocVienBieuMau } from '../../thong-ke/thong-ke.types';
import { tongHopDangKyTruyCap } from '../../thong-ke/bieu-mau.service';
import { TongHopResult, TongQuanResult, VanHanhResult } from '../bao-cao.types';

async function readSheetValues(buffer: Buffer, sheetIndex = 0): Promise<unknown[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[sheetIndex];
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
      'Trung cấp nghề',
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
          don_vi_dat_hang: 'Trường Tiểu học Đống Đa',
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
      'Đơn vị đặt hàng',
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

  it('van-hanh: đúng header + dòng lớp + dòng "Tổng cộng", giữ dấu tiếng Việt', async () => {
    const result: VanHanhResult = {
      khoa_id: 'k1',
      rows: [
        {
          lop_id: 'l1',
          ten_lop: 'Lớp Zoom – Nhóm 1',
          nhom_hoc_vien: 1,
          muc_nang_luc: 'co_ban',
          si_so: 2,
          so_co_email: 1,
          so_ho_so_day_du: 1,
          theo_muc_dau_vao: {
            co_ban: 1,
            thanh_thao: 1,
            nang_cao: 0,
            khong_xac_dinh: 0,
          },
        },
        {
          lop_id: 'l2',
          ten_lop: 'Lớp Zoom – Nhóm 2',
          nhom_hoc_vien: 2,
          muc_nang_luc: null,
          si_so: 1,
          so_co_email: 0,
          so_ho_so_day_du: 0,
          theo_muc_dau_vao: {
            co_ban: 0,
            thanh_thao: 0,
            nang_cao: 0,
            khong_xac_dinh: 1,
          },
        },
      ],
      tong: {
        si_so: 3,
        so_co_email: 1,
        so_ho_so_day_du: 1,
        theo_muc_dau_vao: {
          co_ban: 1,
          thanh_thao: 1,
          nang_cao: 0,
          khong_xac_dinh: 1,
        },
      },
    };

    const buffer = await buildVanHanhWorkbook(result);
    const rows = await readSheetValues(buffer);

    expect(rows[0]).toEqual([
      'Tên lớp',
      'Nhóm học viên',
      'Mức năng lực lớp',
      'Sĩ số',
      'Số có email',
      'Số hồ sơ đầy đủ',
      'Mức đầu vào: Cơ bản',
      'Mức đầu vào: Thành thạo',
      'Mức đầu vào: Nâng cao',
      'Mức đầu vào: Không xác định',
    ]);
    expect(rows[1]).toEqual([
      'Lớp Zoom – Nhóm 1',
      1,
      'Cơ bản',
      2,
      1,
      1,
      1,
      1,
      0,
      0,
    ]);
    expect(rows[2]).toEqual(['Lớp Zoom – Nhóm 2', 2, '', 1, 0, 0, 0, 0, 0, 1]);
    expect(rows[3]).toEqual(['Tổng cộng', '', '', 3, 1, 1, 1, 1, 0, 1]);
  });

  // Sửa 2026-10-07: mức theo muc_goc (thang cấu hình, không còn 3 bậc cứng);
  // "Kết quả theo hình thức" thay bằng "Tham gia học" (theo điểm danh).
  it('tong-quan: sheet "Khảo sát" theo đúng thang mức + sheet "Tham gia học"', async () => {
    const result: TongQuanResult = {
      tong_hoc_vien_tham_gia: 10,
      da_dang_nhap: 7,
      da_chinh_sua_ho_so: 4,
      khao_sat: {
        dau_vao: {
          da_lam: 3,
          theo_muc: [
            { ma: 'M1', nhan: 'Chưa đạt', so_luong: 0 },
            { ma: 'M2', nhan: 'Cơ bản', so_luong: 1 },
            { ma: 'M3', nhan: 'Thành thạo', so_luong: 1 },
            { ma: 'M4', nhan: 'Nâng cao', so_luong: 0 },
          ],
          chua_xep_muc: 1,
        },
        dau_ra: {
          da_lam: 0,
          theo_muc: [
            { ma: 'M1', nhan: 'Chưa đạt', so_luong: 0 },
            { ma: 'M2', nhan: 'Cơ bản', so_luong: 0 },
            { ma: 'M3', nhan: 'Thành thạo', so_luong: 0 },
            { ma: 'M4', nhan: 'Nâng cao', so_luong: 0 },
          ],
          chua_xep_muc: 0,
        },
      },
      tham_gia_hoc: [
        {
          giai_doan_id: 'gd-1',
          ma_khoa: 'K-001',
          thu_tu: 1,
          ten_giai_doan: 'Trực tiếp – đợt 1',
          so_buoi: 3,
          co_mat: 8,
          vang_co_phep: 1,
          vang: 1,
        },
      ],
    };

    const buffer = await buildTongQuanWorkbook(result);
    const sheetKhaoSat = await readSheetValues(buffer, 1);
    const sheetThamGiaHoc = await readSheetValues(buffer, 2);

    expect(sheetKhaoSat[0]).toEqual([
      'Đợt khảo sát',
      'Đã làm',
      'M1 – Chưa đạt',
      'M2 – Cơ bản',
      'M3 – Thành thạo',
      'M4 – Nâng cao',
      'Chưa xếp mức',
    ]);
    expect(sheetKhaoSat[1]).toEqual(['Đầu vào', 3, 0, 1, 1, 0, 1]);
    expect(sheetKhaoSat[2]).toEqual(['Đầu ra', 0, 0, 0, 0, 0, 0]);

    expect(sheetThamGiaHoc[0]).toEqual([
      'Khóa',
      'Giai đoạn',
      'Số buổi đã điểm danh',
      'Có mặt',
      'Vắng có phép',
      'Vắng',
      'Tỉ lệ có mặt',
    ]);
    expect(sheetThamGiaHoc[1]).toEqual([
      'K-001',
      'GĐ1 – Trực tiếp – đợt 1',
      3,
      8,
      1,
      1,
      '80,0%',
    ]);
  });

  it('buildTienDoTruongWorkbook: đủ 21 tiêu đề đúng thứ tự, dòng có cả số lượng lẫn %', async () => {
    const dong: TienDoTruongDong = {
      don_vi_id: 'x',
      ten_don_vi: 'Trường A',
      ten_don_vi_cha: 'Sở B',
      so_hv: 8,
      so_truy_cap: 6,
      ty_le_truy_cap: 0.75,
      so_ky_nang_so: 4,
      ty_le_ky_nang_so: 0.5,
      so_dau_vao: 2,
      ty_le_dau_vao: 0.25,
      so_dau_ra: 1,
      ty_le_dau_ra: 0.125,
      so_luot_diem_danh: 10,
      so_luot_co_mat: 9,
      ty_le_co_mat: 0.9,
      so_hv_co_vle: 0,
      so_hv_vle_dat: 0,
      ty_le_vle_dat: null,
      so_dang_ky: 8,
      so_dat: 3,
      ty_le_dat: 0.375,
    };
    const rows = await readSheetValues(await buildTienDoTruongWorkbook([dong]));
    expect(rows[0]).toEqual([
      'STT',
      'Trường',
      'Đơn vị quản lý',
      'Số HV',
      'Đã truy cập',
      '% Truy cập',
      'Đã làm KS kĩ năng số',
      '% KS kĩ năng số',
      'Đã làm đánh giá NLS đầu vào',
      '% Đánh giá NLS đầu vào',
      'Đã làm đánh giá NLS đầu ra',
      '% Đánh giá NLS đầu ra',
      'Lượt điểm danh',
      'Lượt có mặt',
      '% Có mặt',
      'HV có dữ liệu VLE',
      'HV VLE ≥ 50%',
      '% VLE ≥ 50%',
      'Lượt đăng ký',
      'Đạt',
      '% Đạt',
    ]);
    expect(rows[1]).toEqual([
      1, 'Trường A', 'Sở B', 8,
      6, 75, 4, 50, 2, 25, 1, 12.5,
      10, 9, 90,
      0, 0, undefined, // ô trống đọc lại là undefined
      8, 3, 37.5,
    ]);
  });
});

describe('buildBieuMauDangKyTruyCapWorkbook', () => {
  const hv = (
    id: string,
    donVi: string,
    doiTuong: string | null,
    cap: string | null,
    tc: boolean,
  ): DongHocVienBieuMau => ({
    hoc_vien_id: id,
    doi_tuong: doiTuong,
    cap_giang_day: cap,
    don_vi_id: donVi,
    ten_don_vi: `Trường ${donVi}`,
    ten_don_vi_cha: 'Sở A',
    da_truy_cap: tc,
  });
  // 4 giáo viên THCS (3 đã truy cập) ở t1, 1 CBQL chưa xác định cấp ở t2.
  const data = tongHopDangKyTruyCap([
    hv('1', 't1', 'giao_vien', 'thcs', true),
    hv('2', 't1', 'giao_vien', 'thcs', true),
    hv('3', 't1', 'giao_vien', 'thcs', true),
    hv('4', 't1', 'giao_vien', 'thcs', false),
    hv('5', 't2', 'can_bo_quan_ly', null, false),
  ]);
  const moTa = {
    khoa: 'Tất cả khóa',
    pham_vi: 'Toàn bộ phạm vi tài khoản',
    doi_tuong: 'Tất cả đối tượng',
    ngay_xuat: new Date('2026-10-08T03:30:00Z'),
  };

  async function mo(d = data) {
    const wb = new ExcelJS.Workbook();
    const buf = await buildBieuMauDangKyTruyCapWorkbook(d, moTa);
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    return wb;
  }
  const hangCua = (s: ExcelJS.Worksheet, r: number) =>
    (s.getRow(r).values as unknown[]).slice(1);

  it('3 sheet đúng tên và thứ tự', async () => {
    const wb = await mo();
    expect(wb.worksheets.map((s) => s.name)).toEqual([
      'Tổng hợp',
      'Theo đối tượng',
      'Theo cấp',
    ]);
  });

  it('4 dòng tiêu đề (gộp ô) ở mỗi sheet', async () => {
    const wb = await mo();
    for (const s of wb.worksheets) {
      expect(s.getCell('A1').value).toBe(
        'BIỂU THỐNG KÊ SỐ LƯỢNG ĐĂNG KÝ VÀ TRUY CẬP HỆ THỐNG',
      );
      expect(s.getCell('A1').font?.bold).toBe(true);
      expect(s.getCell('A1').font?.size).toBe(14);
      expect(s.getCell('A2').value).toBe('Khóa: Tất cả khóa');
      expect(s.getCell('A3').value).toBe(
        'Phạm vi: Toàn bộ phạm vi tài khoản · Đối tượng: Tất cả đối tượng',
      );
      expect(s.getCell('A4').value).toBe('Ngày xuất: 08/10/2026 10:30');
      expect(s.getCell('A1').isMerged).toBe(true);
    }
  });

  it('Tổng hợp: header nhóm/cột con và số liệu', async () => {
    const s = (await mo()).getWorksheet('Tổng hợp')!;
    expect(s.getCell('B6').value).toBe('Mầm non');
    expect(s.getCell('E6').value).toBe('Tiểu học');
    expect(s.getCell('N6').value).toBe('Trung cấp nghề');
    expect(s.getCell('Q6').value).toBe('Chưa xác định');
    expect(s.getCell('T6').value).toBe('Tổng');
    expect(hangCua(s, 7).slice(1, 4)).toEqual(['ĐK', 'Đã truy cập', 'Tỷ lệ (%)']);
    expect(hangCua(s, 8)[0]).toBe('Giáo viên');
    expect(hangCua(s, 9)[0]).toBe('Cán bộ quản lý');
    expect(hangCua(s, 10)[0]).toBe('Nhân viên');
    expect(hangCua(s, 11)[0]).toBe('Chưa xác định');
    const gv = hangCua(s, 8);
    // THCS (nhóm thứ 3): cột H,I,J -> 4, 3, 75.
    expect(s.getCell('H8').value).toBe(4);
    expect(s.getCell('I8').value).toBe(3);
    expect(s.getCell('J8').value).toBe(75);
    // ĐK = 0 -> % trống.
    expect(s.getCell('B8').value).toBe(0);
    expect(s.getCell('D8').value).toBeNull();
    expect(gv.length).toBeGreaterThan(20);
    const tong = hangCua(s, 12);
    expect(tong[0]).toBe('Tổng cộng');
    expect(s.getCell('T12').value).toBe(5);
    expect(s.getCell('U12').value).toBe(3);
    expect(s.getCell('V12').value).toBe(60);
    expect(s.getCell('A12').font?.bold).toBe(true);
  });

  it('Theo đối tượng: dòng trường, nhóm Tổng, dòng Tổng cộng', async () => {
    const s = (await mo()).getWorksheet('Theo đối tượng')!;
    expect(hangCua(s, 6).slice(0, 3)).toEqual(['STT', 'Trường', 'Đơn vị quản lý']);
    expect(s.getCell('D6').value).toBe('Tổng');
    expect(s.getCell('G6').value).toBe('Giáo viên');
    expect(s.getCell('M6').value).toBe('Nhân viên');
    expect(s.getCell('P6').value).toBe('Chưa xác định');
    expect(hangCua(s, 8).slice(0, 3)).toEqual([1, 'Trường t1', 'Sở A']);
    expect(s.getCell('D8').value).toBe(4);
    expect(s.getCell('F8').value).toBe(75);
    expect(s.getCell('G8').value).toBe(4);
    expect(hangCua(s, 9).slice(0, 3)).toEqual([2, 'Trường t2', 'Sở A']);
    expect(s.getCell('D9').value).toBe(1);
    expect(s.getCell('F9').value).toBe(0);
    expect(s.getCell('B10').value).toBe('Tổng cộng');
    expect(s.getCell('D10').value).toBe(5);
    expect(s.getCell('E10').value).toBe(3);
    expect(s.getCell('F10').value).toBe(60);
    expect(s.getCell('B10').font?.bold).toBe(true);
    expect(s.views[0]).toMatchObject({ state: 'frozen', xSplit: 3, ySplit: 7 });
  });

  it('Theo cấp: nhóm theo cấp, ĐK 0 để % trống', async () => {
    const s = (await mo()).getWorksheet('Theo cấp')!;
    expect(s.getCell('D6').value).toBe('Tổng');
    expect(s.getCell('G6').value).toBe('Mầm non');
    expect(s.getCell('S6').value).toBe('Trung cấp nghề');
    expect(s.getCell('V6').value).toBe('Chưa xác định');
    expect(s.getCell('M6').value).toBe('THCS');
    expect(s.getCell('M8').value).toBe(4);
    expect(s.getCell('O8').value).toBe(75);
    expect(s.getCell('G8').value).toBe(0);
    expect(s.getCell('I8').value).toBeNull();
  });

  it('dữ liệu rỗng: vẫn đủ 3 sheet, Tổng cộng = 0, % trống', async () => {
    const s = (await mo(tongHopDangKyTruyCap([]))).getWorksheet('Theo đối tượng')!;
    expect(s.getCell('B8').value).toBe('Tổng cộng');
    expect(s.getCell('D8').value).toBe(0);
    expect(s.getCell('F8').value).toBeNull();
  });
});
