import { ThongKeService } from './thong-ke.service';
import { PrismaService } from '../prisma/prisma.service';
import { ThongKeScopeService } from './thong-ke-scope.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { PhamViThongKe } from './thong-ke.types';
import { ThangMucService } from '../sso/thang-muc.service';

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

const WHERE_SCOPE = { khoa_id: { in: ['k1'] } };

describe('ThongKeService.pheu', () => {
  let service: ThongKeService;
  let prisma: { hoc_vien: { count: jest.Mock } };
  let scope: { resolve: jest.Mock };

  const phamVi = (p: Partial<PhamViThongKe> = {}): PhamViThongKe => ({
    where: WHERE_SCOPE,
    rong: false,
    khoaIds: ['k1'],
    ...p,
  });

  beforeEach(() => {
    prisma = { hoc_vien: { count: jest.fn().mockResolvedValue(7) } };
    scope = { resolve: jest.fn().mockResolvedValue(phamVi()) };
    service = new ThongKeService(
      prisma as unknown as PrismaService,
      scope as unknown as ThongKeScopeService,
      { thang: jest.fn() } as unknown as ThangMucService,
    );
  });

  it('rong=true -> mọi số 0, không gọi prisma', async () => {
    scope.resolve.mockResolvedValue(phamVi({ rong: true }));
    const r = await service.pheu(caller('quan_tri'), {});
    expect(r).toEqual({
      tham_gia: 0,
      da_truy_cap: 0,
      khao_sat_ky_nang_so: 0,
      danh_gia_dau_vao: 0,
      danh_gia_dau_ra: 0,
      ho_so_cho_duyet: 0,
    });
    expect(prisma.hoc_vien.count).not.toHaveBeenCalled();
  });

  it('rong=true + ho_tro_hoc_vien -> ho_so_cho_duyet null', async () => {
    scope.resolve.mockResolvedValue(phamVi({ rong: true }));
    const r = await service.pheu(caller('ho_tro_hoc_vien'), {});
    expect(r.ho_so_cho_duyet).toBeNull();
  });

  it('đếm học viên phân biệt: 5 phễu + 1 chờ duyệt, mọi where chứa dang_ky_hoc.some = where scope', async () => {
    const r = await service.pheu(caller('quan_tri'), {});
    expect(prisma.hoc_vien.count).toHaveBeenCalledTimes(6);
    for (const [arg] of prisma.hoc_vien.count.mock.calls) {
      expect(arg.where.dang_ky_hoc).toEqual({ some: WHERE_SCOPE });
    }
    expect(r).toEqual({
      tham_gia: 7,
      da_truy_cap: 7,
      khao_sat_ky_nang_so: 7,
      danh_gia_dau_vao: 7,
      danh_gia_dau_ra: 7,
      ho_so_cho_duyet: 7,
    });
  });

  it('da_truy_cap: where có nguoi_dung_account.dang_nhap_lan_cuoi not null', async () => {
    await service.pheu(caller('quan_tri'), {});
    const wheres = prisma.hoc_vien.count.mock.calls.map(([a]) => a.where);
    expect(
      wheres.some(
        (w) =>
          JSON.stringify(w.nguoi_dung_account) ===
          JSON.stringify({ dang_nhap_lan_cuoi: { not: null } }),
      ),
    ).toBe(true);
  });

  it('3 khảo sát: lọc ket_qua_khao_sat theo loai + hoan_thanh', async () => {
    await service.pheu(caller('quan_tri'), {});
    const ks = prisma.hoc_vien.count.mock.calls
      .map(([a]) => a.where.ket_qua_khao_sat?.some)
      .filter(Boolean);
    expect(ks).toEqual([
      { loai: 'khao-sat', trang_thai: 'hoan_thanh' },
      { loai: 'danh-gia', trang_thai: 'hoan_thanh' },
      { loai: 'dau-ra', trang_thai: 'hoan_thanh' },
    ]);
  });

  it('ho_so_cho_duyet: hoc_vien.trang_thai = cho_duyet giao với phạm vi', async () => {
    await service.pheu(caller('truong'), {});
    const w = prisma.hoc_vien.count.mock.calls
      .map(([a]) => a.where)
      .find((x) => x.trang_thai === 'cho_duyet');
    expect(w).toEqual({
      trang_thai: 'cho_duyet',
      dang_ky_hoc: { some: WHERE_SCOPE },
    });
  });

  it('ho_tro_hoc_vien -> ho_so_cho_duyet null, chỉ 5 lần count', async () => {
    const r = await service.pheu(caller('ho_tro_hoc_vien'), {});
    expect(r.ho_so_cho_duyet).toBeNull();
    expect(prisma.hoc_vien.count).toHaveBeenCalledTimes(5);
  });

  it('truyền đúng user và q vào ThongKeScopeService.resolve', async () => {
    const u = caller('so_gddt');
    const q = { khoa_id: 'k1' };
    await service.pheu(u, q);
    expect(scope.resolve).toHaveBeenCalledWith(u, q);
  });
});

const THANG = [
  { ma: 'M1', nhan: 'Chưa đạt' },
  { ma: 'M2', nhan: 'Cơ bản' },
  { ma: 'M3', nhan: 'Thành thạo' },
  { ma: 'M4', nhan: 'Nâng cao' },
];

describe('ThongKeService khối khảo sát + chuyển mức', () => {
  let service: ThongKeService;
  let prisma: {
    hoc_vien: { count: jest.Mock };
    ket_qua_khao_sat: { groupBy: jest.Mock; findMany: jest.Mock };
  };
  let scope: { resolve: jest.Mock };

  beforeEach(() => {
    prisma = {
      hoc_vien: { count: jest.fn().mockResolvedValue(10) },
      ket_qua_khao_sat: {
        groupBy: jest.fn().mockResolvedValue([]),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    scope = {
      resolve: jest.fn().mockResolvedValue({
        where: WHERE_SCOPE,
        rong: false,
        khoaIds: ['k1'],
      }),
    };
    service = new ThongKeService(
      prisma as unknown as PrismaService,
      scope as unknown as ThongKeScopeService,
      {
        thang: jest.fn().mockResolvedValue(THANG),
      } as unknown as ThangMucService,
    );
  });

  const nhom = (loai: string, muc_goc: string | null, n: number) => ({
    loai,
    muc_goc,
    _count: { _all: n },
  });
  const kq = (hoc_vien_id: string, loai: string, muc_goc: string | null) => ({
    hoc_vien_id,
    loai,
    muc_goc,
  });

  describe('khaoSat', () => {
    it("muc_goc 'M5' và null rơi vào chua_xep_muc", async () => {
      prisma.ket_qua_khao_sat.groupBy.mockResolvedValue([
        nhom('danh-gia', 'M2', 3),
        nhom('danh-gia', 'M5', 2),
        nhom('danh-gia', null, 1),
      ]);
      const r = await service.khaoSat(caller('quan_tri'), {});
      expect(r.dau_vao.chua_xep_muc).toBe(3);
      expect(r.dau_vao.theo_muc.find((m) => m.ma === 'M2')?.so_luong).toBe(3);
      expect(r.dau_vao.chua_lam).toBe(4); // 10 - 6 hoàn thành
    });

    it('theo_muc luôn đủ 4 mức theo thứ tự thang, mức không có dữ liệu = 0', async () => {
      prisma.ket_qua_khao_sat.groupBy.mockResolvedValue([
        nhom('dau-ra', 'M3', 5),
      ]);
      const r = await service.khaoSat(caller('quan_tri'), {});
      expect(r.dau_ra.theo_muc).toEqual([
        { ma: 'M1', nhan: 'Chưa đạt', so_luong: 0 },
        { ma: 'M2', nhan: 'Cơ bản', so_luong: 0 },
        { ma: 'M3', nhan: 'Thành thạo', so_luong: 5 },
        { ma: 'M4', nhan: 'Nâng cao', so_luong: 0 },
      ]);
      expect(r.dau_vao.theo_muc.map((m) => m.so_luong)).toEqual([0, 0, 0, 0]);
      expect(r.dau_ra.chua_lam).toBe(5);
    });

    it('kỹ năng số: hoan_thanh và chua = tham_gia - hoan_thanh; where đúng phạm vi', async () => {
      prisma.ket_qua_khao_sat.groupBy.mockResolvedValue([
        nhom('khao-sat', null, 4),
      ]);
      const r = await service.khaoSat(caller('quan_tri'), {});
      expect(r.ky_nang_so).toEqual({ hoan_thanh: 4, chua: 6 });
      const arg = prisma.ket_qua_khao_sat.groupBy.mock.calls[0][0];
      expect(arg.where).toEqual({
        trang_thai: 'hoan_thanh',
        hoc_vien: { dang_ky_hoc: { some: WHERE_SCOPE } },
      });
    });

    it('rong=true -> toàn 0, không truy vấn', async () => {
      scope.resolve.mockResolvedValue({ where: {}, rong: true, khoaIds: [] });
      const r = await service.khaoSat(caller('quan_tri'), {});
      expect(r.ky_nang_so).toEqual({ hoan_thanh: 0, chua: 0 });
      expect(r.dau_vao.theo_muc).toHaveLength(4);
      expect(prisma.ket_qua_khao_sat.groupBy).not.toHaveBeenCalled();
    });
  });

  describe('chuyenMuc', () => {
    it('HV chỉ có danh-gia bị loại; tong = số HV đủ hai đầu', async () => {
      prisma.ket_qua_khao_sat.findMany.mockResolvedValue([
        kq('a', 'danh-gia', 'M2'),
        kq('a', 'dau-ra', 'M3'),
        kq('b', 'danh-gia', 'M1'),
      ]);
      const r = await service.chuyenMuc(caller('quan_tri'), {});
      expect(r.tong).toBe(1);
    });

    it('M2→M3 tăng, M3→M3 giữ, M3→M2 giảm; o đủ 16 phần tử; tổng so_luong = tong', async () => {
      prisma.ket_qua_khao_sat.findMany.mockResolvedValue([
        kq('a', 'danh-gia', 'M2'),
        kq('a', 'dau-ra', 'M3'),
        kq('b', 'danh-gia', 'M3'),
        kq('b', 'dau-ra', 'M3'),
        kq('c', 'danh-gia', 'M3'),
        kq('c', 'dau-ra', 'M2'),
      ]);
      const r = await service.chuyenMuc(caller('quan_tri'), {});
      expect(r).toMatchObject({ tong: 3, tang: 1, giu: 1, giam: 1 });
      expect(r.thang).toEqual(THANG);
      expect(r.o).toHaveLength(16);
      expect(r.o.reduce((s, x) => s + x.so_luong, 0)).toBe(r.tong);
      const o = (tu: string, den: string) =>
        r.o.find((x) => x.tu === tu && x.den === den)?.so_luong;
      expect(o('M2', 'M3')).toBe(1);
      expect(o('M3', 'M3')).toBe(1);
      expect(o('M3', 'M2')).toBe(1);
      expect(o('M1', 'M1')).toBe(0);
    });

    it("HV có dau-ra muc_goc 'M5' bị loại", async () => {
      prisma.ket_qua_khao_sat.findMany.mockResolvedValue([
        kq('a', 'danh-gia', 'M2'),
        kq('a', 'dau-ra', 'M5'),
        kq('b', 'danh-gia', null),
        kq('b', 'dau-ra', 'M2'),
      ]);
      const r = await service.chuyenMuc(caller('quan_tri'), {});
      expect(r.tong).toBe(0);
      expect(r.o).toHaveLength(16);
    });

    it('findMany lọc loai in [danh-gia, dau-ra], hoan_thanh, trong phạm vi', async () => {
      await service.chuyenMuc(caller('quan_tri'), {});
      const arg = prisma.ket_qua_khao_sat.findMany.mock.calls[0][0];
      expect(arg.where).toEqual({
        loai: { in: ['danh-gia', 'dau-ra'] },
        trang_thai: 'hoan_thanh',
        hoc_vien: { dang_ky_hoc: { some: WHERE_SCOPE } },
      });
    });

    it('rong=true -> ma trận 16 ô 0, không truy vấn', async () => {
      scope.resolve.mockResolvedValue({ where: {}, rong: true, khoaIds: [] });
      const r = await service.chuyenMuc(caller('quan_tri'), {});
      expect(r).toMatchObject({ tong: 0, tang: 0, giu: 0, giam: 0 });
      expect(r.o).toHaveLength(16);
      expect(prisma.ket_qua_khao_sat.findMany).not.toHaveBeenCalled();
    });
  });
});
