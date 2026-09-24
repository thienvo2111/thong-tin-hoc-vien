import { ScopeService } from './scope.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ScopeService', () => {
  let service: ScopeService;
  let findMany: jest.Mock;

  beforeEach(() => {
    findMany = jest.fn();
    const prisma = {
      don_vi_cong_tac: { findMany },
    } as unknown as PrismaService;
    service = new ScopeService(prisma);
  });

  describe('getAccessibleDonViIds', () => {
    it('quan_tri -> ALL, không cần đơn vị', async () => {
      const scope = await service.getAccessibleDonViIds({
        vai_tro: 'quan_tri',
        don_vi_id: null,
      });
      expect(scope).toBe('ALL');
      expect(findMany).not.toHaveBeenCalled();
    });

    it('hoc_vien -> mảng rỗng (phạm vi theo ho_so, không theo don_vi)', async () => {
      const scope = await service.getAccessibleDonViIds({
        vai_tro: 'hoc_vien',
        don_vi_id: null,
      });
      expect(scope).toEqual([]);
    });

    it('không có don_vi_id (dữ liệu bất thường) -> mảng rỗng, không throw', async () => {
      const scope = await service.getAccessibleDonViIds({
        vai_tro: 'truong',
        don_vi_id: null,
      });
      expect(scope).toEqual([]);
    });

    it('truong -> chỉ đơn vị của chính mình, không đi xuống cây', async () => {
      const scope = await service.getAccessibleDonViIds({
        vai_tro: 'truong',
        don_vi_id: 'don-vi-A',
      });
      expect(scope).toEqual(['don-vi-A']);
      expect(findMany).not.toHaveBeenCalled();
    });

    it('so_gddt không có con -> chỉ đơn vị của mình', async () => {
      findMany.mockResolvedValueOnce([]);
      const scope = await service.getAccessibleDonViIds({
        vai_tro: 'so_gddt',
        don_vi_id: 'so-A',
      });
      expect(scope).toEqual(['so-A']);
    });

    it('so_gddt đi xuống nhiều tầng (BFS) -> gom hết con cháu', async () => {
      // so-A -> [phong-B, truong-C] -> phong-B -> [truong-D] -> truong-D -> []
      findMany
        .mockResolvedValueOnce([{ id: 'phong-B' }, { id: 'truong-C' }])
        .mockResolvedValueOnce([{ id: 'truong-D' }])
        .mockResolvedValueOnce([]);

      const scope = await service.getAccessibleDonViIds({
        vai_tro: 'so_gddt',
        don_vi_id: 'so-A',
      });
      expect(scope).toEqual(
        expect.arrayContaining(['so-A', 'phong-B', 'truong-C', 'truong-D']),
      );
      expect((scope as string[]).length).toBe(4);
    });

    it('phong_vhxh cũng đi xuống cây giống so_gddt', async () => {
      findMany
        .mockResolvedValueOnce([{ id: 'truong-E' }])
        .mockResolvedValueOnce([]);
      const scope = await service.getAccessibleDonViIds({
        vai_tro: 'phong_vhxh',
        don_vi_id: 'phong-X',
      });
      expect(scope).toEqual(expect.arrayContaining(['phong-X', 'truong-E']));
    });

    it('an toàn với chu trình (đơn vị con trỏ ngược lại đơn vị đã thăm)', async () => {
      // so-A -> [con-B]; con-B -> [so-A] (chu trình) — không được lặp vô hạn
      findMany
        .mockResolvedValueOnce([{ id: 'con-B' }])
        .mockResolvedValueOnce([{ id: 'so-A' }]);
      const scope = await service.getAccessibleDonViIds({
        vai_tro: 'so_gddt',
        don_vi_id: 'so-A',
      });
      expect(scope).toEqual(expect.arrayContaining(['so-A', 'con-B']));
      expect((scope as string[]).length).toBe(2);
    });
  });

  describe('canAccessDonVi', () => {
    it('quan_tri luôn true', async () => {
      const ok = await service.canAccessDonVi(
        { vai_tro: 'quan_tri', don_vi_id: null },
        'bat-ky-id',
      );
      expect(ok).toBe(true);
    });

    it('truong chỉ true với đúng đơn vị mình', async () => {
      const caller = { vai_tro: 'truong' as const, don_vi_id: 'don-vi-A' };
      expect(await service.canAccessDonVi(caller, 'don-vi-A')).toBe(true);
      expect(await service.canAccessDonVi(caller, 'don-vi-B')).toBe(false);
    });
  });

  describe('canAccessHocSo', () => {
    it('hoc_vien chỉ truy cập đúng hoc_vien_id của mình', () => {
      const caller = { vai_tro: 'hoc_vien' as const, hoc_vien_id: 'hv-1' };
      expect(service.canAccessHocSo(caller, 'hv-1')).toBe(true);
      expect(service.canAccessHocSo(caller, 'hv-2')).toBe(false);
    });

    it('gọi với vai_tro khác hoc_vien -> throw (dùng sai API)', () => {
      const caller = { vai_tro: 'quan_tri' as const, hoc_vien_id: null };
      expect(() => service.canAccessHocSo(caller, 'hv-1')).toThrow();
    });
  });
});
