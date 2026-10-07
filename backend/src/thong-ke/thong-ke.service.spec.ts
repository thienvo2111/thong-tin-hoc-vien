import { ThongKeService } from './thong-ke.service';
import { PrismaService } from '../prisma/prisma.service';
import { ThongKeScopeService } from './thong-ke-scope.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { PhamViThongKe } from './thong-ke.types';

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
