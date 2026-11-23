import { Prisma } from '@prisma/client';
import {
  KHOA_DONG_DANH_SACH_SO_PHONG,
  KHOA_DONG_TIEN_DO_SO_PHONG,
  chieuDongDanhSachSoPhong,
  chieuSoPhong,
} from './don-vi-tien-do';
import type { DongTienDo } from './tien-do-dot.service';

// Issue #71 / ADR 0015 O3: chiếu dữ liệu cho Sở/Phòng theo danh sách trắng — output đúng tập khóa cho phép,
// mọi khóa lạ (kể cả cột thêm sau này) bị bỏ. Dữ liệu BỊA.

const dongQuanTri = (): DongTienDo => ({
  don_vi: {
    id: 'tr-1',
    ma: 'TR-BIA-1',
    ten: 'Trường Bịa Một',
    dia_ban: 'Xã Bịa',
  },
  so_nguoi: 3,
  tong_suat: 2.5,
  gia_tri: 2_500_000,
  trang_thai_danh_sach: 'da_xac_nhan',
  trang_thai_hop_dong: 'da_nop',
  nop_luc: '2026-11-19T03:04:00.000Z',
  han_rieng: '2026-12-31T16:59:59.000Z',
  han_hieu_luc: '2026-12-31T16:59:59.000Z',
  han_hieu_luc_ngay: '2026-12-31',
  qua_han: false,
  so_de_nghi_cho: 1,
  ho_so_du: true,
  co_ho_so: true,
  thao_tac_cuoi_luc: '2026-11-19T03:04:00.000Z',
  thao_tac_cuoi_boi: { ho_ten: 'Người Bịa', ten_dang_nhap: 'bia@mau.test' },
});

const tapKhoa = (o: object) => Object.keys(o).sort();

describe('chieuSoPhong — dòng tiến độ Sở/Phòng', () => {
  it('chỉ đúng các khóa được phép, đúng giá trị', () => {
    const ra = chieuSoPhong(dongQuanTri());
    expect(tapKhoa(ra)).toEqual([...KHOA_DONG_TIEN_DO_SO_PHONG].sort());
    expect(tapKhoa(ra.don_vi)).toEqual(['dia_ban', 'id', 'ma', 'ten']);
    expect(ra).toEqual({
      don_vi: {
        id: 'tr-1',
        ma: 'TR-BIA-1',
        ten: 'Trường Bịa Một',
        dia_ban: 'Xã Bịa',
      },
      so_nguoi: 3,
      tong_suat: 2.5,
      gia_tri: 2_500_000,
      trang_thai_danh_sach: 'da_xac_nhan',
      trang_thai_hop_dong: 'da_nop',
      nop_luc: '2026-11-19T03:04:00.000Z',
      han_hieu_luc_ngay: '2026-12-31',
      qua_han: false,
      so_de_nghi_cho: 1,
      thao_tac_cuoi_luc: '2026-11-19T03:04:00.000Z',
    });
  });

  it('bỏ người thao tác, hồ sơ, hạn riêng và mọi khóa lạ (kể cả trong don_vi)', () => {
    const vao = {
      ...dongQuanTri(),
      so_tai_khoan: '0000111122223333',
      nguoi_nhan: 'Người Nhận Bịa',
      don_vi: { ...dongQuanTri().don_vi, sdt: '0900000000' },
    } as unknown as DongTienDo;
    const ra = chieuSoPhong(vao);
    const json = JSON.stringify(ra);
    for (const cam of [
      'thao_tac_cuoi_boi',
      'ho_so_du',
      'co_ho_so',
      'han_rieng',
      'han_hieu_luc"',
      'so_tai_khoan',
      'nguoi_nhan',
      'sdt',
      'bia@mau.test',
      '0000111122223333',
    ]) {
      expect(json).not.toContain(cam);
    }
    expect(tapKhoa(ra)).toEqual([...KHOA_DONG_TIEN_DO_SO_PHONG].sort());
  });

  it('chưa có đơn giá, chưa nộp, chưa thao tác → giữ null', () => {
    const ra = chieuSoPhong({
      ...dongQuanTri(),
      gia_tri: null,
      nop_luc: null,
      thao_tac_cuoi_luc: null,
      thao_tac_cuoi_boi: null,
      trang_thai_hop_dong: 'chua_nop',
      qua_han: true,
    });
    expect(ra.gia_tri).toBeNull();
    expect(ra.nop_luc).toBeNull();
    expect(ra.thao_tac_cuoi_luc).toBeNull();
    expect(ra.qua_han).toBe(true);
  });
});

describe('chieuDongDanhSachSoPhong — dòng danh sách GV', () => {
  const dongDb = {
    id: 'd-1',
    dot_trien_khai_id: 'dot-1',
    don_vi_id: 'tr-1',
    ho_ten: 'GV Bịa',
    ngay_sinh: new Date('1990-02-01T00:00:00Z'),
    gioi_tinh: 'Nữ',
    ma_goc: 'MA-GOC-BIA',
    lop: '6A',
    giai_doan: 'chi_gd1' as const,
    ty_le_suat: new Prisma.Decimal(0.5),
    ghi_chu: null,
    y_kien_truong: 'dong_y',
    hoc_vien_id: 'hv-bia',
    created_by: 'nd-bia',
    created_at: new Date(),
    updated_at: new Date(),
  };

  it('dòng DB đủ cột → đúng 9 khóa cho phép, không ma_goc/hoc_vien_id/created_by', () => {
    const ra = chieuDongDanhSachSoPhong(dongDb);
    expect(tapKhoa(ra)).toEqual([...KHOA_DONG_DANH_SACH_SO_PHONG].sort());
    expect(ra).toEqual({
      id: 'd-1',
      ho_ten: 'GV Bịa',
      ngay_sinh: '1990-02-01',
      gioi_tinh: 'Nữ',
      lop: '6A',
      giai_doan: 'chi_gd1',
      ty_le_suat: 0.5,
      ghi_chu: null,
      y_kien_truong: 'dong_y',
    });
    const json = JSON.stringify(ra);
    for (const cam of ['MA-GOC-BIA', 'hv-bia', 'nd-bia', 'ma_goc']) {
      expect(json).not.toContain(cam);
    }
  });

  it('ngày sinh / ý kiến trống → null', () => {
    const ra = chieuDongDanhSachSoPhong({
      ...dongDb,
      ngay_sinh: null,
      y_kien_truong: null,
      ty_le_suat: new Prisma.Decimal(1),
    });
    expect(ra.ngay_sinh).toBeNull();
    expect(ra.y_kien_truong).toBeNull();
    expect(ra.ty_le_suat).toBe(1);
  });
});
