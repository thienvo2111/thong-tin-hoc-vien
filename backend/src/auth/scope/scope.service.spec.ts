import { ScopeService } from './scope.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ScopeService', () => {
  let service: ScopeService;
  let findMany: jest.Mock;
  let findUniqueDonVi: jest.Mock;
  let findManyTheoDoi: jest.Mock;

  beforeEach(() => {
    findMany = jest.fn();
    findUniqueDonVi = jest.fn();
    findManyTheoDoi = jest.fn();
    const prisma = {
      don_vi_cong_tac: { findMany, findUnique: findUniqueDonVi },
      khoa_don_vi_theo_doi: { findMany: findManyTheoDoi },
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

  describe('getKhoaIdsTheoDoi (T2, QĐ2)', () => {
    it('quan_tri -> mảng rỗng, không truy vấn (phạm vi ALL đã bao trọn)', async () => {
      const ids = await service.getKhoaIdsTheoDoi({
        vai_tro: 'quan_tri',
        don_vi_id: null,
      });
      expect(ids).toEqual([]);
      expect(findManyTheoDoi).not.toHaveBeenCalled();
    });

    it('hoc_vien -> mảng rỗng (không quản lý don_vi)', async () => {
      const ids = await service.getKhoaIdsTheoDoi({
        vai_tro: 'hoc_vien',
        don_vi_id: null,
      });
      expect(ids).toEqual([]);
    });

    it('không có don_vi_id -> mảng rỗng, không throw', async () => {
      const ids = await service.getKhoaIdsTheoDoi({
        vai_tro: 'truong',
        don_vi_id: null,
      });
      expect(ids).toEqual([]);
    });

    it('truong -> chỉ xét đơn vị của chính mình (không có cha) -> tra 1 lần', async () => {
      findUniqueDonVi.mockResolvedValueOnce({ don_vi_cha_id: null });
      findManyTheoDoi.mockResolvedValueOnce([{ khoa_id: 'khoa-1' }]);

      const ids = await service.getKhoaIdsTheoDoi({
        vai_tro: 'truong',
        don_vi_id: 'truong-A',
      });
      expect(ids).toEqual(['khoa-1']);
      expect(findManyTheoDoi).toHaveBeenCalledWith({
        where: { don_vi_id: { in: ['truong-A'] } },
        select: { khoa_id: true },
      });
    });

    it('phong_vhxh nằm dưới so_gddt đang theo dõi -> đi LÊN cây, tìm thấy khóa theo dõi ở cấp Sở', async () => {
      // phong-B -> cha so-A -> không còn cha.
      findUniqueDonVi
        .mockResolvedValueOnce({ don_vi_cha_id: 'so-A' })
        .mockResolvedValueOnce({ don_vi_cha_id: null });
      findManyTheoDoi.mockResolvedValueOnce([
        { khoa_id: 'khoa-hcmue' },
        { khoa_id: 'khoa-khac' },
      ]);

      const ids = await service.getKhoaIdsTheoDoi({
        vai_tro: 'phong_vhxh',
        don_vi_id: 'phong-B',
      });
      expect(ids).toEqual(['khoa-hcmue', 'khoa-khac']);
      expect(findManyTheoDoi).toHaveBeenCalledWith({
        where: { don_vi_id: { in: ['phong-B', 'so-A'] } },
        select: { khoa_id: true },
      });
    });

    it('không có khóa nào theo dõi trong toàn bộ chuỗi cha -> mảng rỗng', async () => {
      findUniqueDonVi.mockResolvedValueOnce({ don_vi_cha_id: null });
      findManyTheoDoi.mockResolvedValueOnce([]);

      const ids = await service.getKhoaIdsTheoDoi({
        vai_tro: 'so_gddt',
        don_vi_id: 'so-doc-lap',
      });
      expect(ids).toEqual([]);
    });

    it('an toàn với chu trình don_vi_cha_id (không lặp vô hạn)', async () => {
      // don-A -> cha don-B -> cha don-A (chu trình).
      findUniqueDonVi
        .mockResolvedValueOnce({ don_vi_cha_id: 'don-B' })
        .mockResolvedValueOnce({ don_vi_cha_id: 'don-A' });
      findManyTheoDoi.mockResolvedValueOnce([]);

      const ids = await service.getKhoaIdsTheoDoi({
        vai_tro: 'truong',
        don_vi_id: 'don-A',
      });
      expect(ids).toEqual([]);
      expect(findManyTheoDoi).toHaveBeenCalledWith({
        where: { don_vi_id: { in: ['don-A', 'don-B'] } },
        select: { khoa_id: true },
      });
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
