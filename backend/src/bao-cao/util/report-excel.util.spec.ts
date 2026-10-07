import * as ExcelJS from 'exceljs';
import {
  buildTongHopWorkbook,
  buildTienDoTruongWorkbook,
  buildTongQuanWorkbook,
  buildVanHanhWorkbook,
} from './report-excel.util';
import { TienDoTruongDong } from '../../thong-ke/thong-ke.types';
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
      'Đã làm KS kỹ năng số',
      '% KS kỹ năng số',
      'Đã làm đánh giá đầu vào',
      '% Đánh giá đầu vào',
      'Đã làm đánh giá đầu ra',
      '% Đánh giá đầu ra',
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
