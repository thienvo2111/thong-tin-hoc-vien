import { ThongKeScopeService } from './thong-ke-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeService } from '../auth/scope/scope.service';
import { HoTroHocVienScopeService } from '../ho-tro-hoc-vien/ho-tro-hoc-vien-scope.service';
import {
  ForbiddenAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

const T1 = '00000000-0000-4000-8000-0000000000a1';
const CON = '00000000-0000-4000-8000-0000000000a2';
const NGOAI = '00000000-0000-4000-8000-0000000000b1';
const K1 = '00000000-0000-4000-8000-0000000000c1';
const K2 = '00000000-0000-4000-8000-0000000000c2';
const CUM1 = '00000000-0000-4000-8000-0000000000d1';
const CUM2 = '00000000-0000-4000-8000-0000000000d2';

function caller(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 'u-1',
    ten_dang_nhap: 'admin',
    vai_tro: 'quan_tri',
    don_vi_id: null,
    hoc_vien_id: null,
    phai_doi_mat_khau: false,
    jti: 'jti-1',
    exp: 9999999999,
    ...overrides,
  };
}

const truong = () => caller({ vai_tro: 'truong', don_vi_id: T1 });
const so = () => caller({ vai_tro: 'so_gddt', don_vi_id: T1 });
const hoTro = () => caller({ vai_tro: 'ho_tro_hoc_vien' });

describe('ThongKeScopeService', () => {
  let service: ThongKeScopeService;
  let prisma: {
    khoa_boi_duong: { findMany: jest.Mock };
    don_vi_cong_tac: { findMany: jest.Mock; findUnique: jest.Mock };
    cum_hoc_vien: { findMany: jest.Mock; findUnique: jest.Mock };
  };
  let scope: { getAccessibleDonViIds: jest.Mock; getKhoaIdsXemDuoc: jest.Mock };
  let hoTroScope: { cumIdsCuaToi: jest.Mock };

  beforeEach(() => {
    prisma = {
      khoa_boi_duong: { findMany: jest.fn().mockResolvedValue([]) },
      don_vi_cong_tac: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      cum_hoc_vien: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    scope = {
      getAccessibleDonViIds: jest.fn().mockResolvedValue([T1]),
      getKhoaIdsXemDuoc: jest.fn().mockResolvedValue([K1]),
    };
    hoTroScope = { cumIdsCuaToi: jest.fn().mockResolvedValue([CUM1]) };
    service = new ThongKeScopeService(
      prisma as unknown as PrismaService,
      scope as unknown as ScopeService,
      hoTroScope as unknown as HoTroHocVienScopeService,
    );
  });

  describe('resolve', () => {
    it('quan_tri không lọc → where {} và rong=false', async () => {
      const r = await service.resolve(caller(), {});
      expect(r).toEqual({ where: {}, rong: false, khoaIds: 'ALL' });
    });

    it('quan_tri lọc khoa_id → khoaIds=[khoa_id], where.AND chứa khoa_id', async () => {
      const r = await service.resolve(caller(), { khoa_id: K1 });
      expect(r.khoaIds).toEqual([K1]);
      expect(r.where.AND).toContainEqual({ khoa_id: K1 });
    });

    it('truong không lọc → where.OR chứa R1 và R2 theo phạm vi', async () => {
      scope.getAccessibleDonViIds.mockResolvedValue([T1]);
      const r = await service.resolve(truong(), {});
      expect(r.rong).toBe(false);
      expect(r.where.OR).toEqual([
        { khoa: { don_vi_dat_hang_id: { in: [T1] } } },
        { hoc_vien: { don_vi_cong_tac_id: { in: [T1] } } },
      ]);
      expect(r.khoaIds).toEqual([K1]);
    });

    it('so lọc don_vi_id con → where.AND chứa don_vi_cong_tac_id in cây con', async () => {
      scope.getAccessibleDonViIds.mockImplementation(
        async (c: { vai_tro: string; don_vi_id: string }) =>
          c.vai_tro === 'so_gddt' && c.don_vi_id === CON ? [CON] : [T1, CON],
      );
      const r = await service.resolve(so(), { don_vi_id: CON });
      expect(r.where.AND).toContainEqual({
        hoc_vien: { don_vi_cong_tac_id: { in: [CON] } },
      });
    });

    it('so lọc don_vi_id ngoài cây → ForbiddenAppException', async () => {
      scope.getAccessibleDonViIds.mockResolvedValue([T1, CON]);
      await expect(
        service.resolve(so(), { don_vi_id: NGOAI }),
      ).rejects.toBeInstanceOf(ForbiddenAppException);
    });

    it('truong lọc khoa_id không thuộc getKhoaIdsXemDuoc → ForbiddenAppException', async () => {
      await expect(
        service.resolve(truong(), { khoa_id: K2 }),
      ).rejects.toBeInstanceOf(ForbiddenAppException);
    });

    it('truong lọc khoa_id hợp lệ → khoaIds thu về [khoa_id]', async () => {
      const r = await service.resolve(truong(), { khoa_id: K1 });
      expect(r.khoaIds).toEqual([K1]);
      expect(r.where.AND).toContainEqual({ khoa_id: K1 });
    });

    it('ho_tro lọc cum_id không được phân công → ForbiddenAppException', async () => {
      prisma.cum_hoc_vien.findMany.mockResolvedValue([
        { id: CUM1, khoa_id: K1 },
      ]);
      await expect(
        service.resolve(hoTro(), { khoa_id: K1, cum_id: CUM2 }),
      ).rejects.toBeInstanceOf(ForbiddenAppException);
    });

    it('ho_tro không lọc → where.cum_id in cụm phân công, khoaIds theo cụm', async () => {
      prisma.cum_hoc_vien.findMany.mockResolvedValue([
        { id: CUM1, khoa_id: K1 },
      ]);
      const r = await service.resolve(hoTro(), {});
      expect(r.where).toEqual({ cum_id: { in: [CUM1] } });
      expect(r.khoaIds).toEqual([K1]);
    });

    it('ho_tro lọc cum_id hợp lệ → where.AND chứa cum_id', async () => {
      prisma.cum_hoc_vien.findMany.mockResolvedValue([
        { id: CUM1, khoa_id: K1 },
      ]);
      const r = await service.resolve(hoTro(), { khoa_id: K1, cum_id: CUM1 });
      expect(r.where.AND).toContainEqual({ cum_id: CUM1 });
    });

    it('ho_tro lọc khoa_id không thuộc khóa của cụm → ForbiddenAppException', async () => {
      prisma.cum_hoc_vien.findMany.mockResolvedValue([
        { id: CUM1, khoa_id: K1 },
      ]);
      await expect(
        service.resolve(hoTro(), { khoa_id: K2 }),
      ).rejects.toBeInstanceOf(ForbiddenAppException);
    });

    it('ho_tro gửi don_vi_id → ValidationException', async () => {
      await expect(
        service.resolve(hoTro(), { don_vi_id: T1 }),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('truong gửi cum_id → ValidationException', async () => {
      await expect(
        service.resolve(truong(), { khoa_id: K1, cum_id: CUM1 }),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('cum_id thiếu khoa_id → ValidationException', async () => {
      await expect(
        service.resolve(caller(), { cum_id: CUM1 }),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('don_vi_id + cum_id → ValidationException', async () => {
      await expect(
        service.resolve(caller(), { khoa_id: K1, don_vi_id: T1, cum_id: CUM1 }),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('quan_tri cum_id thuộc khóa khác khoa_id → ForbiddenAppException', async () => {
      prisma.cum_hoc_vien.findUnique.mockResolvedValue({
        id: CUM1,
        khoa_id: K2,
      });
      await expect(
        service.resolve(caller(), { khoa_id: K1, cum_id: CUM1 }),
      ).rejects.toBeInstanceOf(ForbiddenAppException);
    });

    it('quan_tri cum_id hợp lệ → where.AND chứa cum_id', async () => {
      prisma.cum_hoc_vien.findUnique.mockResolvedValue({
        id: CUM1,
        khoa_id: K1,
      });
      const r = await service.resolve(caller(), { khoa_id: K1, cum_id: CUM1 });
      expect(r.where.AND).toContainEqual({ cum_id: CUM1 });
    });

    it('truong có don_vi_id null → rong=true', async () => {
      scope.getAccessibleDonViIds.mockResolvedValue([]);
      const r = await service.resolve(
        caller({ vai_tro: 'truong', don_vi_id: null }),
        {},
      );
      expect(r.rong).toBe(true);
    });

    it('ho_tro chưa phân công cụm → rong=true', async () => {
      hoTroScope.cumIdsCuaToi.mockResolvedValue([]);
      const r = await service.resolve(hoTro(), {});
      expect(r.rong).toBe(true);
    });

    it('hoc_vien → ForbiddenAppException', async () => {
      await expect(
        service.resolve(caller({ vai_tro: 'hoc_vien' }), {}),
      ).rejects.toBeInstanceOf(ForbiddenAppException);
    });
  });

  describe('boLoc', () => {
    it('truong → don_vi null, cum null, don_vi_co_dinh = đơn vị của mình', async () => {
      prisma.khoa_boi_duong.findMany.mockResolvedValue([
        { id: K1, ten_khoa: 'Khóa 1' },
      ]);
      prisma.don_vi_cong_tac.findUnique.mockResolvedValue({
        id: T1,
        ten_don_vi: 'Trường A',
      });
      const r = await service.boLoc(truong());
      expect(r.don_vi).toBeNull();
      expect(r.cum).toBeNull();
      expect(r.don_vi_co_dinh).toEqual({ id: T1, ten_don_vi: 'Trường A' });
      expect(r.khoa).toEqual([{ id: K1, ten_khoa: 'Khóa 1' }]);
    });

    it('so → có don_vi trong scope, cum null', async () => {
      scope.getAccessibleDonViIds.mockResolvedValue([T1, CON]);
      prisma.don_vi_cong_tac.findMany.mockResolvedValue([
        { id: T1, ten_don_vi: 'A', loai_don_vi: 'so_gddt' },
      ]);
      const r = await service.boLoc(so());
      expect(r.cum).toBeNull();
      expect(r.don_vi_co_dinh).toBeNull();
      expect(r.don_vi).toHaveLength(1);
      expect(prisma.don_vi_cong_tac.findMany.mock.calls[0][0].where).toEqual({
        id: { in: [T1, CON] },
      });
    });

    it('quan_tri → mọi khóa, đơn vị loai ≠ khac, mọi cụm', async () => {
      prisma.cum_hoc_vien.findMany.mockResolvedValue([
        { id: CUM1, ten_cum: 'C1', khoa_id: K1 },
      ]);
      const r = await service.boLoc(caller());
      expect(prisma.khoa_boi_duong.findMany.mock.calls[0][0].where).toEqual({});
      expect(prisma.don_vi_cong_tac.findMany.mock.calls[0][0].where).toEqual({
        loai_don_vi: { not: 'khac' },
      });
      expect(r.don_vi).not.toBeNull();
      expect(r.cum).toHaveLength(1);
    });

    it('ho_tro chưa phân công cụm → khoa = [], cum = []', async () => {
      hoTroScope.cumIdsCuaToi.mockResolvedValue([]);
      const r = await service.boLoc(hoTro());
      expect(r.khoa).toEqual([]);
      expect(r.cum).toEqual([]);
      expect(r.don_vi).toBeNull();
    });

    it('ho_tro có phân công → khóa của cụm, don_vi null, cum phân công', async () => {
      prisma.cum_hoc_vien.findMany.mockResolvedValue([
        { id: CUM1, ten_cum: 'C1', khoa_id: K1 },
      ]);
      prisma.khoa_boi_duong.findMany.mockResolvedValue([
        { id: K1, ten_khoa: 'Khóa 1' },
      ]);
      const r = await service.boLoc(hoTro());
      expect(r.don_vi).toBeNull();
      expect(r.cum).toEqual([{ id: CUM1, ten_cum: 'C1', khoa_id: K1 }]);
      expect(prisma.khoa_boi_duong.findMany.mock.calls[0][0].where).toEqual({
        id: { in: [K1] },
      });
    });
  });
});
