import { HoTroGiangVienScopeService } from './ho-tro-giang-vien-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundAppException } from '../common/exceptions/app.exceptions';

// ADR 0004 G3: phạm vi = lớp của các khóa trong nhóm; ngoài phạm vi → 404.
describe('HoTroGiangVienScopeService', () => {
  let prisma: {
    phan_cong_ho_tro_gv: { findMany: jest.Mock };
    lop_hoc: { findMany: jest.Mock; count: jest.Mock };
  };
  let scope: HoTroGiangVienScopeService;

  beforeEach(() => {
    prisma = {
      phan_cong_ho_tro_gv: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ khoa_id: 'k1' }, { khoa_id: 'k2' }]),
      },
      lop_hoc: {
        findMany: jest.fn().mockResolvedValue([{ id: 'l1' }]),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    scope = new HoTroGiangVienScopeService(prisma as unknown as PrismaService);
  });

  it('whereLopTrongPhamVi = lớp thuộc các khóa trong nhóm', async () => {
    expect(await scope.whereLopTrongPhamVi('nd')).toEqual({
      khoa_id: { in: ['k1', 'k2'] },
    });
  });

  it('không có phân công → điều kiện rỗng (không khớp lớp nào), không lỗi', async () => {
    prisma.phan_cong_ho_tro_gv.findMany.mockResolvedValueOnce([]);
    expect(await scope.whereLopTrongPhamVi('nd')).toEqual({
      khoa_id: { in: [] },
    });
  });

  it('damBaoLopTrongPhamVi: lớp ngoài phạm vi → 404', async () => {
    prisma.lop_hoc.count.mockResolvedValueOnce(0);
    await expect(
      scope.damBaoLopTrongPhamVi('nd', 'l-x'),
    ).rejects.toBeInstanceOf(NotFoundAppException);
  });

  it('damBaoKhoaTrongPhamVi: khóa ngoài nhóm → 404, trong nhóm → ok', async () => {
    await expect(
      scope.damBaoKhoaTrongPhamVi('nd', 'k9'),
    ).rejects.toBeInstanceOf(NotFoundAppException);
    await expect(
      scope.damBaoKhoaTrongPhamVi('nd', 'k1'),
    ).resolves.toBeUndefined();
  });
});
