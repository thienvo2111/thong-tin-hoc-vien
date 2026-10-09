import * as ExcelJS from 'exceljs';
import { NhuCauMucHocService, tongHopNhuCauMucHoc } from './nhu-cau-muc-hoc.service';
import { PrismaService } from '../prisma/prisma.service';
import { ThongKeScopeService } from './thong-ke-scope.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { DongDangKyNhuCauMuc } from './thong-ke.types';

const caller: AuthenticatedUser = {
  id: 'u-1',
  ten_dang_nhap: 'x',
  vai_tro: 'quan_tri',
  don_vi_id: null,
  hoc_vien_id: null,
  phai_doi_mat_khau: false,
  jti: 'jti-1',
  exp: 9999999999,
};

function dk(
  donVi: string,
  ghiDe: Partial<DongDangKyNhuCauMuc> = {},
): DongDangKyNhuCauMuc {
  return {
    muc_danh_gia: 'co_ban',
    nguon_muc: 'chot',
    muc_hoc_chon: null,
    muc_hoc_chon_luc: null,
    don_vi_id: donVi,
    ten_don_vi: `Trường ${donVi}`,
    ten_don_vi_cha: 'Sở A',
    ho_ten: '',
    ma_dinh_danh_moet: null,
    ma_khoa: '',
    ten_khoa: '',
    ...ghiDe,
  };
}

describe('tongHopNhuCauMucHoc (hàm thuần)', () => {
  it('đầu vào rỗng -> mọi số 0, đủ 3 mức, không điều chỉnh, theo_truong rỗng', () => {
    const r = tongHopNhuCauMucHoc([]);
    expect(r).toEqual({
      so_dang_ky: 0,
      chua_co_muc: 0,
      da_dieu_chinh: 0,
      moc_tu_khao_sat: 0,
      theo_muc: [
        { muc: 'co_ban', nhan: 'Cơ bản', theo_danh_gia: 0, theo_nhu_cau: 0 },
        { muc: 'thanh_thao', nhan: 'Thành thạo', theo_danh_gia: 0, theo_nhu_cau: 0 },
        { muc: 'nang_cao', nhan: 'Nâng cao', theo_danh_gia: 0, theo_nhu_cau: 0 },
      ],
      dieu_chinh: [],
      theo_truong: [],
    });
  });

  it('tổng hợp đúng số đăng ký, chưa có mức, đã điều chỉnh, theo mức và điều chỉnh', () => {
    const r = tongHopNhuCauMucHoc([
      dk('t1', { muc_danh_gia: 'co_ban', muc_hoc_chon: null }), // co_ban, không đổi
      dk('t1', { muc_danh_gia: 'co_ban', muc_hoc_chon: null }),
      dk('t1', { muc_danh_gia: 'co_ban', muc_hoc_chon: null }),
      dk('t1', { muc_danh_gia: 'nang_cao', muc_hoc_chon: 'thanh_thao' }), // NC -> TT
      dk('t1', { muc_danh_gia: 'nang_cao', muc_hoc_chon: 'thanh_thao' }),
      dk('t1', { muc_danh_gia: 'nang_cao', muc_hoc_chon: 'co_ban' }), // NC -> CB
      dk('t1', { muc_danh_gia: 'thanh_thao', muc_hoc_chon: null }), // thanh_thao, không đổi
      dk('t1', { muc_danh_gia: null, nguon_muc: null, muc_hoc_chon: null }), // chưa có mức
      dk('t1', { muc_danh_gia: null, nguon_muc: null, muc_hoc_chon: null }),
    ]);

    expect(r.so_dang_ky).toBe(9);
    expect(r.chua_co_muc).toBe(2);
    expect(r.da_dieu_chinh).toBe(3);
    expect(r.theo_muc).toEqual([
      { muc: 'co_ban', nhan: 'Cơ bản', theo_danh_gia: 3, theo_nhu_cau: 4 },
      { muc: 'thanh_thao', nhan: 'Thành thạo', theo_danh_gia: 1, theo_nhu_cau: 3 },
      { muc: 'nang_cao', nhan: 'Nâng cao', theo_danh_gia: 3, theo_nhu_cau: 0 },
    ]);
    expect(r.dieu_chinh).toEqual([
      { tu: 'nang_cao', den: 'thanh_thao', so_luong: 2 },
      { tu: 'nang_cao', den: 'co_ban', so_luong: 1 },
    ]);
  });

  it('muc_hoc_chon bằng mức đánh giá -> KHÔNG tính là điều chỉnh', () => {
    const r = tongHopNhuCauMucHoc([
      dk('t1', { muc_danh_gia: 'co_ban', muc_hoc_chon: 'co_ban' }),
    ]);
    expect(r.da_dieu_chinh).toBe(0);
    expect(r.dieu_chinh).toEqual([]);
    expect(r.theo_muc.find((m) => m.muc === 'co_ban')).toMatchObject({
      theo_danh_gia: 1,
      theo_nhu_cau: 1,
    });
  });

  it('theo_truong: 2 trường, mỗi trường tự đếm riêng, sắp theo tên (vi)', () => {
    const r = tongHopNhuCauMucHoc([
      dk('t2', { ten_don_vi: 'Trường B', muc_danh_gia: 'co_ban', muc_hoc_chon: null }),
      dk('t2', { ten_don_vi: 'Trường B', muc_danh_gia: 'nang_cao', muc_hoc_chon: 'co_ban' }),
      dk('t1', { ten_don_vi: 'Trường A', muc_danh_gia: null, nguon_muc: null, muc_hoc_chon: null }),
      dk('t1', { ten_don_vi: 'Trường A', muc_danh_gia: 'thanh_thao', muc_hoc_chon: null }),
    ]);
    expect(r.so_dang_ky).toBe(4);
    expect(r.theo_truong.map((t) => t.don_vi_id)).toEqual(['t1', 't2']);

    const t1 = r.theo_truong[0];
    expect(t1).toMatchObject({
      ten_don_vi: 'Trường A',
      ten_don_vi_cha: 'Sở A',
      so_dang_ky: 2,
      chua_co_muc: 1,
      da_dieu_chinh: 0,
    });
    expect(t1.theo_muc.find((m) => m.muc === 'thanh_thao')).toMatchObject({
      theo_danh_gia: 1,
      theo_nhu_cau: 1,
    });

    const t2 = r.theo_truong[1];
    expect(t2).toMatchObject({
      ten_don_vi: 'Trường B',
      so_dang_ky: 2,
      chua_co_muc: 0,
      da_dieu_chinh: 1,
    });
    expect(t2.theo_muc).toEqual([
      { muc: 'co_ban', nhan: 'Cơ bản', theo_danh_gia: 1, theo_nhu_cau: 2 },
      { muc: 'thanh_thao', nhan: 'Thành thạo', theo_danh_gia: 0, theo_nhu_cau: 0 },
      { muc: 'nang_cao', nhan: 'Nâng cao', theo_danh_gia: 1, theo_nhu_cau: 0 },
    ]);

    // Tổng theo trường khớp tổng chung.
    expect(r.theo_truong.reduce((s, t) => s + t.so_dang_ky, 0)).toBe(r.so_dang_ky);
    expect(r.theo_truong.reduce((s, t) => s + t.chua_co_muc, 0)).toBe(r.chua_co_muc);
    expect(r.theo_truong.reduce((s, t) => s + t.da_dieu_chinh, 0)).toBe(r.da_dieu_chinh);
  });
});

describe('NhuCauMucHocService', () => {
  let service: NhuCauMucHocService;
  let prisma: {
    dang_ky_hoc: { findMany: jest.Mock };
    khoa_boi_duong: { findUnique: jest.Mock };
    don_vi_cong_tac: { findUnique: jest.Mock };
    cum_hoc_vien: { findUnique: jest.Mock };
  };
  let scope: { resolve: jest.Mock };

  const phamVi = { where: { khoa_id: 'k' }, rong: false, khoaIds: ['k'] };
  const rongVi = { where: { id: { in: [] } }, rong: true, khoaIds: [] };

  beforeEach(() => {
    prisma = {
      dang_ky_hoc: { findMany: jest.fn().mockResolvedValue([]) },
      khoa_boi_duong: { findUnique: jest.fn() },
      don_vi_cong_tac: { findUnique: jest.fn() },
      cum_hoc_vien: { findUnique: jest.fn() },
    };
    scope = { resolve: jest.fn() };
    service = new NhuCauMucHocService(
      prisma as unknown as PrismaService,
      scope as unknown as ThongKeScopeService,
    );
  });

  it('rong -> toàn 0, theo_truong [], không truy vấn', async () => {
    scope.resolve.mockResolvedValue(rongVi);
    const r = await service.danhSach(caller, {});
    expect(r.so_dang_ky).toBe(0);
    expect(r.theo_truong).toEqual([]);
    expect(prisma.dang_ky_hoc.findMany).not.toHaveBeenCalled();
  });

  it('danhSach: dùng đúng where, KHÔNG lấy ho_ten/ma_dinh_danh_moet/khoa, CÓ lấy ket_qua_khao_sat loại đầu vào', async () => {
    scope.resolve.mockResolvedValue(phamVi);
    await service.danhSach(caller, { khoa_id: 'k' });
    const arg = prisma.dang_ky_hoc.findMany.mock.calls[0][0];
    expect(arg.where).toBe(phamVi.where);
    expect(arg.select.hoc_vien.select.ho_ten).toBeUndefined();
    expect(arg.select.hoc_vien.select.ma_dinh_danh_moet).toBeUndefined();
    expect(arg.select.khoa).toBeUndefined();
    expect(arg.select.hoc_vien.select.ket_qua_khao_sat).toEqual({
      where: { loai: 'danh-gia' },
      select: { trang_thai: true, muc: true, muc_goc: true },
    });
  });

  it('xuatExcel: lấy kèm ho_ten/ma_dinh_danh_moet/khoa (kemTen=true)', async () => {
    scope.resolve.mockResolvedValue(phamVi);
    prisma.dang_ky_hoc.findMany.mockResolvedValue([
      {
        muc_dau_vao: 'co_ban',
        muc_hoc_chon: null,
        muc_hoc_chon_luc: null,
        hoc_vien: {
          don_vi_cong_tac_id: 't1',
          don_vi_cong_tac: { ten_don_vi: 'Trường t1', don_vi_cha: { ten_don_vi: 'Sở A' } },
          ket_qua_khao_sat: [],
          ho_ten: 'Nguyễn Văn A',
          ma_dinh_danh_moet: 'GV001',
        },
        khoa: { ma_khoa: 'K1', ten_khoa: 'Khóa 1' },
      },
    ]);
    const buf = await service.xuatExcel(caller, { khoa_id: 'k' });
    expect(Buffer.isBuffer(buf)).toBe(true);
    const arg = prisma.dang_ky_hoc.findMany.mock.calls[0][0];
    expect(arg.select.hoc_vien.select.ho_ten).toBe(true);
    expect(arg.select.hoc_vien.select.ma_dinh_danh_moet).toBe(true);
    expect(arg.select.khoa).toEqual({ select: { ma_khoa: true, ten_khoa: true } });
  });

  it('muc_dau_vao null, khảo sát đầu vào hoàn thành muc_goc M4 -> mốc nang_cao từ khảo sát; muc_hoc_chon thanh_thao -> điều chỉnh', async () => {
    scope.resolve.mockResolvedValue(phamVi);
    prisma.dang_ky_hoc.findMany.mockResolvedValue([
      {
        muc_dau_vao: null,
        muc_hoc_chon: 'thanh_thao',
        muc_hoc_chon_luc: new Date('2026-10-05'),
        hoc_vien: {
          don_vi_cong_tac_id: 't1',
          don_vi_cong_tac: { ten_don_vi: 'Trường t1', don_vi_cha: null },
          ket_qua_khao_sat: [{ trang_thai: 'hoan_thanh', muc: null, muc_goc: 'M4' }],
        },
      },
    ]);
    const r = await service.danhSach(caller, {});
    expect(r.chua_co_muc).toBe(0);
    expect(r.moc_tu_khao_sat).toBe(1);
    expect(r.da_dieu_chinh).toBe(1);
    expect(r.theo_muc.find((m) => m.muc === 'nang_cao')).toMatchObject({
      theo_danh_gia: 1,
      theo_nhu_cau: 0,
    });
    expect(r.theo_muc.find((m) => m.muc === 'thanh_thao')).toMatchObject({
      theo_danh_gia: 0,
      theo_nhu_cau: 1,
    });
  });

  it('muc_dau_vao null, khảo sát đầu vào chưa hoàn thành -> chưa có mức', async () => {
    scope.resolve.mockResolvedValue(phamVi);
    prisma.dang_ky_hoc.findMany.mockResolvedValue([
      {
        muc_dau_vao: null,
        muc_hoc_chon: null,
        muc_hoc_chon_luc: null,
        hoc_vien: {
          don_vi_cong_tac_id: 't1',
          don_vi_cong_tac: { ten_don_vi: 'Trường t1', don_vi_cha: null },
          ket_qua_khao_sat: [{ trang_thai: 'dang_lam', muc: null, muc_goc: null }],
        },
      },
    ]);
    const r = await service.danhSach(caller, {});
    expect(r.chua_co_muc).toBe(1);
    expect(r.moc_tu_khao_sat).toBe(0);
  });

  it('muc_dau_vao null, khảo sát đầu vào hoàn thành muc_goc M1 -> mốc co_ban', async () => {
    scope.resolve.mockResolvedValue(phamVi);
    prisma.dang_ky_hoc.findMany.mockResolvedValue([
      {
        muc_dau_vao: null,
        muc_hoc_chon: null,
        muc_hoc_chon_luc: null,
        hoc_vien: {
          don_vi_cong_tac_id: 't1',
          don_vi_cong_tac: { ten_don_vi: 'Trường t1', don_vi_cha: null },
          ket_qua_khao_sat: [{ trang_thai: 'hoan_thanh', muc: null, muc_goc: 'M1' }],
        },
      },
    ]);
    const r = await service.danhSach(caller, {});
    expect(r.chua_co_muc).toBe(0);
    expect(r.moc_tu_khao_sat).toBe(1);
    expect(r.theo_muc.find((m) => m.muc === 'co_ban')).toMatchObject({
      theo_danh_gia: 1,
    });
  });

  it('xuatExcel rong: không truy vấn, vẫn trả buffer hợp lệ (3 sheet)', async () => {
    scope.resolve.mockResolvedValue(rongVi);
    const buf = await service.xuatExcel(caller, {});
    expect(prisma.dang_ky_hoc.findMany).not.toHaveBeenCalled();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    expect(wb.worksheets.map((s) => s.name)).toEqual([
      'Tổng hợp',
      'Theo trường',
      'Danh sách điều chỉnh',
    ]);
  });
});
