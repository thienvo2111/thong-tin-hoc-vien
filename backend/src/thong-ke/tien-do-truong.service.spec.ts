import * as ExcelJS from 'exceljs';
import { TienDoTruongService } from './tien-do-truong.service';
import { PrismaService } from '../prisma/prisma.service';
import { ThongKeScopeService } from './thong-ke-scope.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ForbiddenAppException } from '../common/exceptions/app.exceptions';

function caller(vai_tro: AuthenticatedUser['vai_tro']): AuthenticatedUser {
  return {
    id: 'u-1',
    ten_dang_nhap: 'x',
    vai_tro,
    don_vi_id: null,
    hoc_vien_id: null,
    phai_doi_mat_khau: false,
    jti: 'jti-1',
    exp: 9999999999,
  };
}

interface HvOpt {
  dangNhap?: boolean;
  ks?: string[];
  ketQua?: string | null;
}
let dem = 0;
// Một dòng dang_ky_hoc; `hv` cố định để mô phỏng HV học 2 khóa.
function dk(
  donVi: string,
  hv: string,
  { dangNhap = false, ks = [], ketQua = null }: HvOpt = {},
  cha: string | null = 'Sở A',
  ten = `Trường ${donVi}`,
) {
  return {
    id: `dk-${++dem}`,
    ket_qua: ketQua,
    hoc_vien_id: hv,
    hoc_vien: {
      don_vi_cong_tac_id: donVi,
      don_vi_cong_tac: {
        ten_don_vi: ten,
        don_vi_cha: cha ? { ten_don_vi: cha } : null,
      },
      nguoi_dung_account: {
        dang_nhap_lan_cuoi: dangNhap ? new Date() : null,
      },
      ket_qua_khao_sat: ks.map((loai) => ({ loai })),
    },
  };
}

describe('TienDoTruongService', () => {
  let service: TienDoTruongService;
  let prisma: {
    dang_ky_hoc: { findMany: jest.Mock };
    diem_danh: { groupBy: jest.Mock };
    ket_qua_giai_doan: { findMany: jest.Mock };
  };
  let scope: { resolve: jest.Mock };

  const setup = (
    dangKy: unknown[],
    diemDanh: unknown[] = [],
    giaiDoan: unknown[] = [],
    rong = false,
  ) => {
    prisma.dang_ky_hoc.findMany.mockResolvedValue(dangKy);
    prisma.diem_danh.groupBy.mockResolvedValue(diemDanh);
    prisma.ket_qua_giai_doan.findMany.mockResolvedValue(giaiDoan);
    scope.resolve.mockResolvedValue({
      where: { SCOPE: 1 },
      rong,
      khoaIds: 'ALL',
    });
  };

  beforeEach(() => {
    dem = 0;
    prisma = {
      dang_ky_hoc: { findMany: jest.fn() },
      diem_danh: { groupBy: jest.fn() },
      ket_qua_giai_doan: { findMany: jest.fn() },
    };
    scope = { resolve: jest.fn() };
    service = new TienDoTruongService(
      prisma as unknown as PrismaService,
      scope as unknown as ThongKeScopeService,
    );
  });

  it('truong -> Forbidden, không gọi resolve/prisma', async () => {
    await expect(service.danhSach(caller('truong'), {})).rejects.toBeInstanceOf(
      ForbiddenAppException,
    );
    await expect(
      service.xuatExcel(caller('truong'), {}),
    ).rejects.toBeInstanceOf(ForbiddenAppException);
    expect(scope.resolve).not.toHaveBeenCalled();
    expect(prisma.dang_ky_hoc.findMany).not.toHaveBeenCalled();
  });

  it('rong -> [] và không truy vấn', async () => {
    setup([], [], [], true);
    expect(await service.danhSach(caller('quan_tri'), {})).toEqual([]);
    expect(prisma.dang_ky_hoc.findMany).not.toHaveBeenCalled();
    expect(prisma.diem_danh.groupBy).not.toHaveBeenCalled();
    expect(prisma.ket_qua_giai_doan.findMany).not.toHaveBeenCalled();
  });

  it('2 trường: so_hv phân biệt, tỷ lệ truy cập/khảo sát/đạt đúng', async () => {
    setup([
      // T1: 3 HV (h1 học 2 khóa)
      dk('t1', 'h1', {
        dangNhap: true,
        ks: ['khao-sat', 'danh-gia'],
        ketQua: 'dat',
      }),
      dk('t1', 'h1', {
        dangNhap: true,
        ks: ['khao-sat', 'danh-gia'],
        ketQua: null,
      }),
      dk('t1', 'h2', { dangNhap: true, ks: ['dau-ra'] }),
      dk('t1', 'h3', {}),
      // T2: 1 HV
      dk('t2', 'h4', { ks: ['danh-gia'], ketQua: 'dat' }),
    ]);
    const rows = await service.danhSach(caller('quan_tri'), {});
    const t1 = rows.find((r) => r.don_vi_id === 't1')!;
    const t2 = rows.find((r) => r.don_vi_id === 't2')!;
    expect(t1.so_hv).toBe(3);
    expect(t1.ty_le_truy_cap).toBeCloseTo(2 / 3);
    expect(t1.ty_le_ky_nang_so).toBeCloseTo(1 / 3);
    expect(t1.ty_le_dau_vao).toBeCloseTo(1 / 3);
    expect(t1.ty_le_dau_ra).toBeCloseTo(1 / 3);
    expect(t1.ty_le_dat).toBeCloseTo(1 / 4); // 1 đạt / 4 đăng ký
    expect(t1.so_truy_cap).toBe(2);
    expect(t1.so_ky_nang_so).toBe(1);
    expect(t1.so_dau_vao).toBe(1);
    expect(t1.so_dau_ra).toBe(1);
    expect(t1.so_dang_ky).toBe(4);
    expect(t1.so_dat).toBe(1);
    expect(t2.so_truy_cap).toBe(0);
    expect(t2.so_dau_vao).toBe(1);
    expect(t2.so_dang_ky).toBe(1);
    expect(t2.so_dat).toBe(1);
    expect(t2.so_hv).toBe(1);
    expect(t2.ty_le_truy_cap).toBe(0);
    expect(t2.ty_le_dau_vao).toBe(1);
    expect(t2.ty_le_ky_nang_so).toBe(0);
    expect(t2.ty_le_dat).toBe(1);
  });

  it('ty_le_co_mat: 3 co_mat + 1 vang -> 0.75; trường không điểm danh -> null', async () => {
    const a = dk('t1', 'h1');
    const b = dk('t1', 'h2');
    const c = dk('t2', 'h3');
    setup(
      [a, b, c],
      [
        { dang_ky_hoc_id: a.id, trang_thai: 'co_mat', _count: 2 },
        { dang_ky_hoc_id: b.id, trang_thai: 'co_mat', _count: 1 },
        { dang_ky_hoc_id: b.id, trang_thai: 'vang', _count: 1 },
      ],
    );
    const rows = await service.danhSach(caller('quan_tri'), {});
    const t1 = rows.find((r) => r.don_vi_id === 't1')!;
    const t2 = rows.find((r) => r.don_vi_id === 't2')!;
    expect(t1.ty_le_co_mat).toBe(0.75);
    expect(t1.so_luot_co_mat).toBe(3);
    expect(t1.so_luot_diem_danh).toBe(4);
    expect(t2.ty_le_co_mat).toBeNull();
    expect(t2.so_luot_co_mat).toBe(0);
    expect(t2.so_luot_diem_danh).toBe(0);
  });

  it('ty_le_vle_dat: A min 60 đạt, B có 40 không đạt -> 0.5; không ai có VLE -> null', async () => {
    const a = dk('t1', 'hA');
    const b = dk('t1', 'hB');
    const c = dk('t1', 'hC'); // không có VLE: không vào mẫu số
    const d = dk('t2', 'hD');
    setup(
      [a, b, c, d],
      [],
      [
        { dang_ky_hoc_id: a.id, ty_le_hoan_thanh: '60' },
        { dang_ky_hoc_id: a.id, ty_le_hoan_thanh: '90.5' },
        { dang_ky_hoc_id: b.id, ty_le_hoan_thanh: '80' },
        { dang_ky_hoc_id: b.id, ty_le_hoan_thanh: '40' },
      ],
    );
    const rows = await service.danhSach(caller('quan_tri'), {});
    const t1 = rows.find((r) => r.don_vi_id === 't1')!;
    const t2 = rows.find((r) => r.don_vi_id === 't2')!;
    expect(t1.ty_le_vle_dat).toBe(0.5);
    expect(t1.so_hv_vle_dat).toBe(1);
    expect(t1.so_hv_co_vle).toBe(2);
    expect(t2.ty_le_vle_dat).toBeNull();
    expect(t2.so_hv_vle_dat).toBe(0);
    expect(t2.so_hv_co_vle).toBe(0);
  });

  it('VLE: HV học 2 khóa, 1 khóa dưới 50 -> không đạt', async () => {
    const a1 = dk('t1', 'hA');
    const a2 = dk('t1', 'hA');
    setup(
      [a1, a2],
      [],
      [
        { dang_ky_hoc_id: a1.id, ty_le_hoan_thanh: '70' },
        { dang_ky_hoc_id: a2.id, ty_le_hoan_thanh: '49.99' },
      ],
    );
    const rows = await service.danhSach(caller('quan_tri'), {});
    expect(rows[0].ty_le_vle_dat).toBe(0);
  });

  it('bất biến: mỗi ty_le = tử/mẫu tương ứng, null khi mẫu 0', async () => {
    const a = dk('t1', 'h1', {
      dangNhap: true,
      ks: ['khao-sat', 'dau-ra'],
      ketQua: 'dat',
    });
    const b = dk('t1', 'h2', { ks: ['danh-gia'] });
    const c = dk('t2', 'h3');
    setup(
      [a, b, c],
      [
        { dang_ky_hoc_id: a.id, trang_thai: 'co_mat', _count: 2 },
        { dang_ky_hoc_id: b.id, trang_thai: 'vang', _count: 1 },
      ],
      [{ dang_ky_hoc_id: a.id, ty_le_hoan_thanh: '80' }],
    );
    const rows = await service.danhSach(caller('quan_tri'), {});
    const chia = (tu: number, mau: number) => (mau === 0 ? null : tu / mau);
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.ty_le_truy_cap).toBe(chia(r.so_truy_cap, r.so_hv));
      expect(r.ty_le_ky_nang_so).toBe(chia(r.so_ky_nang_so, r.so_hv));
      expect(r.ty_le_dau_vao).toBe(chia(r.so_dau_vao, r.so_hv));
      expect(r.ty_le_dau_ra).toBe(chia(r.so_dau_ra, r.so_hv));
      expect(r.ty_le_co_mat).toBe(chia(r.so_luot_co_mat, r.so_luot_diem_danh));
      expect(r.ty_le_vle_dat).toBe(chia(r.so_hv_vle_dat, r.so_hv_co_vle));
      expect(r.ty_le_dat).toBe(chia(r.so_dat, r.so_dang_ky));
    }
  });

  it('ten_don_vi_cha đúng, null khi không có cha; sắp theo tên (vi)', async () => {
    setup([
      dk('z', 'h1', {}, null, 'Trường Z'),
      dk('a', 'h2', {}, 'Phòng P', 'Trường A'),
      dk('b', 'h3', {}, 'Sở S', 'Trường B'),
    ]);
    const rows = await service.danhSach(caller('phong_vhxh'), {});
    expect(rows.map((r) => r.ten_don_vi)).toEqual([
      'Trường A',
      'Trường B',
      'Trường Z',
    ]);
    expect(rows.map((r) => r.ten_don_vi_cha)).toEqual([
      'Phòng P',
      'Sở S',
      null,
    ]);
  });

  it('ho_tro_hoc_vien được dùng, where của resolve được truyền xuống truy vấn', async () => {
    setup([dk('t1', 'h1')]);
    await service.danhSach(caller('ho_tro_hoc_vien'), {});
    expect(prisma.dang_ky_hoc.findMany.mock.calls[0][0].where).toEqual({
      SCOPE: 1,
    });
    expect(prisma.diem_danh.groupBy.mock.calls[0][0].where).toEqual({
      dang_ky_hoc: { SCOPE: 1 },
    });
  });

  it('xuatExcel: Buffer có header Trường và % làm tròn 1 chữ số, null để trống', async () => {
    setup([dk('t1', 'h1', { dangNhap: true }), dk('t1', 'h2'), dk('t1', 'h3')]);
    const buf = await service.xuatExcel(caller('quan_tri'), {});
    expect(Buffer.isBuffer(buf)).toBe(true);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    const sheet = wb.worksheets[0];
    expect(sheet.getRow(1).values as unknown[]).toContain('Trường');
    const row = sheet.getRow(2);
    expect(row.getCell(2).value).toBe('Trường t1');
    expect(row.getCell(3).value).toBe('Sở A');
    expect(row.getCell(4).value).toBe(3);
    expect(row.getCell(5).value).toBe(1); // Đã truy cập
    expect(row.getCell(6).value).toBe(33.3); // % Truy cập
    expect(row.getCell(13).value).toBe(0); // Lượt điểm danh
    expect(row.getCell(15).value).toBeNull(); // % Có mặt: không điểm danh
  });

  it('xuatExcel rong -> chỉ header', async () => {
    setup([], [], [], true);
    const buf = await service.xuatExcel(caller('quan_tri'), {});
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    expect(wb.worksheets[0].rowCount).toBe(1);
  });
});
