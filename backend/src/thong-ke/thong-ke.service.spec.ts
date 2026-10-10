import { ThongKeService } from './thong-ke.service';
import { PrismaService } from '../prisma/prisma.service';
import { ThongKeScopeService } from './thong-ke-scope.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { PhamViThongKe } from './thong-ke.types';
import { ThangMucService } from '../sso/thang-muc.service';
import { ValidationException } from '../common/exceptions/app.exceptions';

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

describe('ThongKeService khối kết quả học tập + so sánh khóa', () => {
  let service: ThongKeService;
  let prisma: {
    hoc_vien: { count: jest.Mock };
    dang_ky_hoc: {
      groupBy: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
    };
    khoa_boi_duong: { findMany: jest.Mock };
  };
  let scope: { resolve: jest.Mock };

  beforeEach(() => {
    prisma = {
      hoc_vien: { count: jest.fn().mockResolvedValue(0) },
      dang_ky_hoc: {
        groupBy: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      khoa_boi_duong: { findMany: jest.fn().mockResolvedValue([]) },
    };
    scope = {
      resolve: jest.fn().mockResolvedValue({
        where: WHERE_SCOPE,
        rong: false,
        khoaIds: ['k1', 'k2'],
      }),
    };
    service = new ThongKeService(
      prisma as unknown as PrismaService,
      scope as unknown as ThongKeScopeService,
      { thang: jest.fn().mockResolvedValue([]) } as unknown as ThangMucService,
    );
  });

  // where của từng khóa = { AND: [scope, { khoa_id, ... }] }
  const khoaCua = (w: unknown) =>
    (w as { AND: { khoa_id?: string }[] }).AND[1].khoa_id;
  const kqRow = (khoa_id: string, ket_qua: string | null, n: number) => ({
    khoa_id,
    ket_qua,
    _count: { _all: n },
  });

  describe('ketQuaHoc', () => {
    it('ket_qua null đếm vào dang_hoc', async () => {
      prisma.dang_ky_hoc.groupBy.mockResolvedValue([
        kqRow('k1', null, 3),
        kqRow('k1', 'dang_hoc', 2),
        kqRow('k1', 'dat', 4),
      ]);
      prisma.khoa_boi_duong.findMany.mockResolvedValue([
        { id: 'k1', ten_khoa: 'Khóa 1' },
      ]);
      const r = await service.ketQuaHoc(caller('quan_tri'), {});
      expect(r).toEqual([
        {
          khoa_id: 'k1',
          ten_khoa: 'Khóa 1',
          dat: 4,
          khong_dat: 0,
          vang: 0,
          dang_hoc: 5,
        },
      ]);
      const arg = prisma.dang_ky_hoc.groupBy.mock.calls[0][0];
      expect(arg.by).toEqual(['khoa_id', 'ket_qua']);
      expect(arg.where).toEqual(WHERE_SCOPE);
    });

    it('2 khóa -> 2 cột, sắp theo ten_khoa', async () => {
      prisma.dang_ky_hoc.groupBy.mockResolvedValue([
        kqRow('k1', 'dat', 1),
        kqRow('k2', 'khong_dat', 2),
        kqRow('k2', 'vang', 3),
      ]);
      prisma.khoa_boi_duong.findMany.mockResolvedValue([
        { id: 'k1', ten_khoa: 'B khóa' },
        { id: 'k2', ten_khoa: 'A khóa' },
      ]);
      const r = await service.ketQuaHoc(caller('quan_tri'), {});
      expect(r.map((c) => c.khoa_id)).toEqual(['k2', 'k1']);
      expect(r[0]).toMatchObject({ khong_dat: 2, vang: 3, dat: 0 });
    });

    it('rong=true -> [] không truy vấn', async () => {
      scope.resolve.mockResolvedValue({ where: {}, rong: true, khoaIds: [] });
      expect(await service.ketQuaHoc(caller('truong'), {})).toEqual([]);
      expect(prisma.dang_ky_hoc.groupBy).not.toHaveBeenCalled();
    });
  });

  describe('ketQuaHocTheoTruong', () => {
    const dkRow = (id: string | null, ten: string, ket_qua: string | null) => ({
      ket_qua,
      hoc_vien: {
        don_vi_cong_tac_id: id,
        don_vi_cong_tac: id ? { ten_don_vi: ten } : null,
      },
    });

    it('thiếu khoa_id -> ValidationException, không gọi resolve', async () => {
      const loi = await service
        .ketQuaHocTheoTruong(caller('quan_tri'), {})
        .catch((e: unknown) => e);
      expect(loi).toBeInstanceOf(ValidationException);
      expect(
        (loi as ValidationException).getResponse() as {
          error: { message: string };
        },
      ).toMatchObject({
        error: { message: 'Cần chọn một khóa để xem kết quả theo trường' },
      });
      expect(scope.resolve).not.toHaveBeenCalled();
    });

    it('rong=true -> [] không truy vấn', async () => {
      scope.resolve.mockResolvedValue({ where: {}, rong: true, khoaIds: [] });
      const r = await service.ketQuaHocTheoTruong(caller('truong'), {
        khoa_id: 'k1',
      });
      expect(r).toEqual([]);
      expect(prisma.dang_ky_hoc.findMany).not.toHaveBeenCalled();
    });

    it('đếm đúng theo trường; ket_qua null -> dang_hoc; sắp theo tên', async () => {
      prisma.dang_ky_hoc.findMany.mockResolvedValue([
        dkRow('t1', 'Trường B', 'dat'),
        dkRow('t1', 'Trường B', null),
        dkRow('t1', 'Trường B', 'dang_hoc'),
        dkRow('t2', 'Trường A', 'khong_dat'),
        dkRow('t2', 'Trường A', 'vang'),
        dkRow('t2', 'Trường A', 'dat'),
        dkRow(null, '', 'dat'),
      ]);
      const r = await service.ketQuaHocTheoTruong(caller('quan_tri'), {
        khoa_id: 'k1',
      });
      expect(r).toEqual([
        {
          don_vi_id: 't2',
          ten_don_vi: 'Trường A',
          dat: 1,
          khong_dat: 1,
          vang: 1,
          dang_hoc: 0,
        },
        {
          don_vi_id: 't1',
          ten_don_vi: 'Trường B',
          dat: 1,
          khong_dat: 0,
          vang: 0,
          dang_hoc: 2,
        },
      ]);
      expect(prisma.dang_ky_hoc.findMany.mock.calls[0][0].where).toEqual(
        WHERE_SCOPE,
      );
    });
  });

  describe('soSanhKhoa', () => {
    it('có khoa_id -> ValidationException', async () => {
      const loi = await service
        .soSanhKhoa(caller('quan_tri'), { khoa_id: 'k1' })
        .catch((e) => e);
      expect(loi).toBeInstanceOf(ValidationException);
      expect(loi.getResponse().error.message).toBe(
        'So sánh khóa chỉ dùng khi chọn Tất cả khóa',
      );
      expect(prisma.dang_ky_hoc.groupBy).not.toHaveBeenCalled();
    });

    it('tính tỷ lệ theo từng khóa, sắp theo ten_khoa', async () => {
      prisma.dang_ky_hoc.groupBy.mockResolvedValue([
        { khoa_id: 'k1' },
        { khoa_id: 'k2' },
      ]);
      prisma.khoa_boi_duong.findMany.mockResolvedValue([
        { id: 'k1', ten_khoa: 'B' },
        { id: 'k2', ten_khoa: 'A' },
      ]);
      jest.spyOn(service, 'demPheu').mockImplementation(async (w) => {
        const k1 = khoaCua(w) === 'k1';
        return {
          tham_gia: k1 ? 10 : 4,
          da_truy_cap: k1 ? 5 : 4,
          khao_sat_ky_nang_so: 0,
          danh_gia_dau_vao: k1 ? 2 : 1,
          danh_gia_dau_ra: 0,
        };
      });
      prisma.dang_ky_hoc.count.mockImplementation(async ({ where }) =>
        khoaCua(where) === 'k1' ? 8 : 2,
      );
      const r = await service.soSanhKhoa(caller('quan_tri'), {});
      expect(r).toEqual([
        {
          khoa_id: 'k2',
          ten_khoa: 'A',
          tham_gia: 4,
          ty_le_truy_cap: 1,
          ty_le_dau_vao: 0.25,
          ty_le_dat: 0.5,
        },
        {
          khoa_id: 'k1',
          ten_khoa: 'B',
          tham_gia: 10,
          ty_le_truy_cap: 0.5,
          ty_le_dau_vao: 0.2,
          ty_le_dat: 0.8,
        },
      ]);
    });

    it('khóa 0 HV -> các tỷ lệ null', async () => {
      prisma.dang_ky_hoc.groupBy.mockResolvedValue([{ khoa_id: 'k1' }]);
      prisma.khoa_boi_duong.findMany.mockResolvedValue([
        { id: 'k1', ten_khoa: 'K' },
      ]);
      const r = await service.soSanhKhoa(caller('quan_tri'), {});
      expect(r).toEqual([
        {
          khoa_id: 'k1',
          ten_khoa: 'K',
          tham_gia: 0,
          ty_le_truy_cap: null,
          ty_le_dau_vao: null,
          ty_le_dat: null,
        },
      ]);
    });

    it('rong=true -> [] không truy vấn', async () => {
      scope.resolve.mockResolvedValue({ where: {}, rong: true, khoaIds: [] });
      expect(await service.soSanhKhoa(caller('truong'), {})).toEqual([]);
      expect(prisma.dang_ky_hoc.groupBy).not.toHaveBeenCalled();
    });
  });
});

describe('ThongKeService.chuyenCan', () => {
  let service: ThongKeService;
  let prisma: {
    diem_danh: { findMany: jest.Mock };
    phan_lop_giai_doan: { findMany: jest.Mock };
    ket_qua_giai_doan: { findMany: jest.Mock };
    dang_ky_hoc: { count: jest.Mock };
  };
  let scope: { resolve: jest.Mock };

  const dong = (
    dang_ky_hoc_id: string,
    lop_id: string,
    giai_doan_id: string,
    thu_tu: number,
    buoi_so: number,
    trang_thai: string,
    che_do_chuyen_can = 'theo_lop_hien_tai',
    loai_lop = 'zoom',
  ) => ({
    dang_ky_hoc_id,
    trang_thai,
    lich_hoc: {
      lop_id,
      giai_doan_id,
      buoi_so,
      giai_doan: { thu_tu },
      lop: { loai_lop },
    },
    dang_ky_hoc: { khoa: { che_do_chuyen_can } },
  });
  const phan = (
    dang_ky_hoc_id: string,
    giai_doan_id: string,
    lop_id: string,
  ) => ({
    dang_ky_hoc_id,
    giai_doan_id,
    lop_id,
  });
  const vle = (...tyLe: (number | null)[]) =>
    prisma.ket_qua_giai_doan.findMany.mockResolvedValue(
      tyLe.map((t) => ({ ty_le_hoan_thanh: t === null ? null : String(t) })),
    );

  beforeEach(() => {
    prisma = {
      diem_danh: { findMany: jest.fn().mockResolvedValue([]) },
      phan_lop_giai_doan: { findMany: jest.fn().mockResolvedValue([]) },
      ket_qua_giai_doan: { findMany: jest.fn().mockResolvedValue([]) },
      dang_ky_hoc: { count: jest.fn().mockResolvedValue(0) },
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
      { thang: jest.fn() } as unknown as ThangMucService,
    );
  });

  it('không khoa_id -> truc_tiep null, không truy vấn điểm danh', async () => {
    const r = await service.chuyenCan(caller('quan_tri'), {});
    expect(r.truc_tiep).toBeNull();
    expect(prisma.diem_danh.findMany).not.toHaveBeenCalled();
  });

  it('có khoa_id nhưng không có điểm danh -> truc_tiep []', async () => {
    const r = await service.chuyenCan(caller('quan_tri'), { khoa_id: 'k1' });
    expect(r.truc_tiep).toEqual([]);
  });

  it('truy vấn điểm danh chỉ lớp trực tiếp/zoom trong phạm vi', async () => {
    await service.chuyenCan(caller('quan_tri'), { khoa_id: 'k1' });
    expect(prisma.diem_danh.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          dang_ky_hoc: WHERE_SCOPE,
          lich_hoc: { lop: { loai_lop: { in: ['truc_tiep', 'zoom'] } } },
        },
      }),
    );
  });

  it('gộp 2 lớp cùng (GĐ1, Buổi 1) vào một cột, sắp tăng, tính tỷ lệ', async () => {
    prisma.diem_danh.findMany.mockResolvedValue([
      ...Array.from({ length: 6 }, (_, i) =>
        dong(`a${i}`, 'lop-a', 'gd1', 1, 1, 'co_mat'),
      ),
      dong('a6', 'lop-a', 'gd1', 1, 1, 'vang_co_phep'),
      dong('b0', 'lop-b', 'gd1', 1, 1, 'co_mat'),
      dong('b1', 'lop-b', 'gd1', 1, 1, 'co_mat'),
      dong('b2', 'lop-b', 'gd1', 1, 1, 'vang'),
      ...Array.from({ length: 3 }, (_, i) =>
        dong(`c${i}`, 'lop-c', 'gd2', 2, 1, 'vang'),
      ),
    ]);
    prisma.phan_lop_giai_doan.findMany.mockResolvedValue([
      ...['a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6'].map((id) =>
        phan(id, 'gd1', 'lop-a'),
      ),
      ...['b0', 'b1', 'b2'].map((id) => phan(id, 'gd1', 'lop-b')),
      ...['c0', 'c1', 'c2'].map((id) => phan(id, 'gd2', 'lop-c')),
    ]);
    const r = await service.chuyenCan(caller('quan_tri'), { khoa_id: 'k1' });
    expect(r.truc_tiep).toEqual([
      {
        nhan: 'GĐ1 · Buổi 1',
        giai_doan_thu_tu: 1,
        buoi_so: 1,
        co_mat: 8,
        vang_co_phep: 1,
        vang: 1,
        ty_le_co_mat: 0.8,
      },
      {
        nhan: 'GĐ2 · Buổi 1',
        giai_doan_thu_tu: 2,
        buoi_so: 1,
        co_mat: 0,
        vang_co_phep: 0,
        vang: 3,
        ty_le_co_mat: 0,
      },
    ]);
  });

  // ADR 0005 Z8 (issue #27): học viên chuyển lớp có dòng ở cả 2 lớp.
  const chuyenLop = (che_do: 'theo_lop_hien_tai' | 'cong_nhan_lop_cu') => {
    prisma.diem_danh.findMany.mockResolvedValue([
      dong('dk1', 'lop-cu', 'gd1', 1, 1, 'co_mat', che_do),
      dong('dk1', 'lop-moi', 'gd1', 1, 1, 'vang', che_do),
      dong('dk1', 'lop-cu', 'gd1', 1, 2, 'co_mat', che_do),
      dong('dk2', 'lop-moi', 'gd1', 1, 1, 'co_mat', che_do),
    ]);
    prisma.phan_lop_giai_doan.findMany.mockResolvedValue([
      phan('dk1', 'gd1', 'lop-moi'),
      phan('dk2', 'gd1', 'lop-moi'),
    ]);
  };

  it('chuyển lớp, theo_lop_hien_tai: chỉ lớp hiện tại, không đếm 2 lần', async () => {
    chuyenLop('theo_lop_hien_tai');
    const r = await service.chuyenCan(caller('quan_tri'), { khoa_id: 'k1' });
    expect(r.truc_tiep).toEqual([
      expect.objectContaining({ buoi_so: 1, co_mat: 1, vang: 1 }),
    ]);
  });

  it('chuyển lớp, cong_nhan_lop_cu: lấy tốt nhất, mỗi học viên 1 lần', async () => {
    chuyenLop('cong_nhan_lop_cu');
    const r = await service.chuyenCan(caller('quan_tri'), { khoa_id: 'k1' });
    expect(r.truc_tiep).toEqual([
      expect.objectContaining({ buoi_so: 1, co_mat: 2, vang: 0 }),
      expect.objectContaining({ buoi_so: 2, co_mat: 1, vang: 0 }),
    ]);
  });

  it('trực tiếp, mặc định: học bù lớp khác + HV không phân lớp vẫn tính, mỗi HV 1 lần', async () => {
    const tt = (dk: string, lop: string, trang_thai: string) =>
      dong(dk, lop, 'gd1', 1, 1, trang_thai, 'theo_lop_hien_tai', 'truc_tiep');
    prisma.diem_danh.findMany.mockResolvedValue([
      tt('dk1', 'lop-a', 'vang'),
      tt('dk1', 'lop-b', 'co_mat'),
      tt('dk3', 'lop-a', 'vang'),
    ]);
    prisma.phan_lop_giai_doan.findMany.mockResolvedValue([
      phan('dk1', 'gd1', 'lop-a'),
    ]);
    const r = await service.chuyenCan(caller('quan_tri'), { khoa_id: 'k1' });
    expect(r.truc_tiep).toEqual([
      expect.objectContaining({ buoi_so: 1, co_mat: 1, vang: 1 }),
    ]);
  });

  it('phân lớp lấy theo cùng phạm vi đăng ký', async () => {
    chuyenLop('theo_lop_hien_tai');
    await service.chuyenCan(caller('quan_tri'), { khoa_id: 'k1' });
    expect(prisma.phan_lop_giai_doan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { dang_ky_hoc: WHERE_SCOPE } }),
    );
  });

  it('VLE chia khoảng: biên thuộc khoảng trên, 100 thuộc 75-100', async () => {
    vle(0, 24.99, 25, 50, 75, 100);
    prisma.dang_ky_hoc.count.mockResolvedValue(4);
    const r = await service.chuyenCan(caller('quan_tri'), {});
    expect(r.vle).toEqual({
      khoang: [
        { khoang: '0-25', so_luong: 2 },
        { khoang: '25-50', so_luong: 1 },
        { khoang: '50-75', so_luong: 1 },
        { khoang: '75-100', so_luong: 2 },
      ],
      chua_co_du_lieu: 4,
    });
  });

  it('chua_co_du_lieu đếm đăng ký không có tỷ lệ VLE nào', async () => {
    await service.chuyenCan(caller('quan_tri'), {});
    expect(prisma.dang_ky_hoc.count).toHaveBeenCalledWith({
      where: {
        AND: [
          WHERE_SCOPE,
          { ket_qua_giai_doan: { none: { ty_le_hoan_thanh: { not: null } } } },
        ],
      },
    });
  });

  it('rong=true -> rỗng đủ 4 khoảng, không truy vấn; có khoa_id -> truc_tiep []', async () => {
    scope.resolve.mockResolvedValue({ where: {}, rong: true, khoaIds: [] });
    const khoang = ['0-25', '25-50', '50-75', '75-100'].map((k) => ({
      khoang: k,
      so_luong: 0,
    }));
    expect(await service.chuyenCan(caller('truong'), {})).toEqual({
      truc_tiep: null,
      vle: { khoang, chua_co_du_lieu: 0 },
    });
    expect(
      (await service.chuyenCan(caller('truong'), { khoa_id: 'k1' })).truc_tiep,
    ).toEqual([]);
    expect(prisma.diem_danh.findMany).not.toHaveBeenCalled();
    expect(prisma.ket_qua_giai_doan.findMany).not.toHaveBeenCalled();
  });
});
