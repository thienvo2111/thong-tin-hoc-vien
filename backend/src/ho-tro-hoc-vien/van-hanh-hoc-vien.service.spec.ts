import { VanHanhHocVienService } from './van-hanh-hoc-vien.service';
import { PrismaService } from '../prisma/prisma.service';
import { HoTroHocVienScopeService } from './ho-tro-hoc-vien-scope.service';
import { NhatKyService } from '../nhat-ky/nhat-ky.service';
import { DoiBuoiHocQueryService } from '../doi-buoi-hoc/doi-buoi-hoc-query.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { NotFoundAppException } from '../common/exceptions/app.exceptions';

// Spec đổi buổi (R9): báo vắng ở buổi chốt của học viên đổi buổi vào.
describe('VanHanhHocVienService.baoVang — đổi buổi', () => {
  const user = { id: 'nd-ht', vai_tro: 'ho_tro_hoc_vien' } as AuthenticatedUser;
  const dto = { lich_hoc_id: 'lich-b', ly_do: 'Ốm đột xuất' };
  let prisma: {
    lich_hoc_lop: { findUnique: jest.Mock };
    dang_ky_hoc: { findFirst: jest.Mock };
    bao_vang: { upsert: jest.Mock };
  };
  let doiBuoi: { doiBuoiDaDuyetCuaDangKy: jest.Mock };
  let service: VanHanhHocVienService;

  beforeEach(() => {
    prisma = {
      lich_hoc_lop: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'lich-b',
          lop_id: 'lop-b',
          giai_doan_id: 'gd-1',
          buoi_so: 1,
          thoi_gian_ket_thuc: new Date(Date.now() + 86_400_000),
        }),
      },
      dang_ky_hoc: { findFirst: jest.fn() },
      bao_vang: { upsert: jest.fn().mockResolvedValue({ id: 'bv-1' }) },
    };
    doiBuoi = { doiBuoiDaDuyetCuaDangKy: jest.fn().mockResolvedValue([]) };
    service = new VanHanhHocVienService(
      prisma as unknown as PrismaService,
      {
        cumIdsCuaToi: jest.fn().mockResolvedValue(['cum-1']),
      } as unknown as HoTroHocVienScopeService,
      { ghi: jest.fn() } as unknown as NhatKyService,
      doiBuoi as unknown as DoiBuoiHocQueryService,
    );
  });

  it('thuộc lớp của buổi → ghi, không tra đổi buổi', async () => {
    prisma.dang_ky_hoc.findFirst.mockResolvedValue({
      id: 'dk-1',
      khoa_id: 'k',
    });
    await service.baoVang(user, 'hv-1', dto);
    expect(prisma.bao_vang.upsert).toHaveBeenCalled();
    expect(prisma.dang_ky_hoc.findFirst).toHaveBeenCalledTimes(1);
    expect(doiBuoi.doiBuoiDaDuyetCuaDangKy).not.toHaveBeenCalled();
  });

  it('không thuộc lớp, có đổi buổi hiệu lực vào buổi → ghi báo vắng', async () => {
    prisma.dang_ky_hoc.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'dk-1', khoa_id: 'k' });
    doiBuoi.doiBuoiDaDuyetCuaDangKy.mockResolvedValue([
      {
        dang_ky_hoc_id: 'dk-1',
        lich_nguon_id: 'lich-a',
        lich_chot_id: 'lich-b',
      },
    ]);
    await service.baoVang(user, 'hv-1', dto);
    expect(prisma.dang_ky_hoc.findFirst.mock.calls[1][0].where).toMatchObject({
      hoc_vien_id: 'hv-1',
      cum_id: { in: ['cum-1'] },
      doi_buoi_hoc: {
        some: { trang_thai: 'da_duyet', lich_chot_id: 'lich-b' },
      },
    });
    expect(prisma.bao_vang.upsert.mock.calls[0][0].create).toMatchObject({
      dang_ky_hoc_id: 'dk-1',
      lich_hoc_id: 'lich-b',
    });
  });

  it('bản ghi đổi buổi đã mất hiệu lực (phân lớp đổi) → 404', async () => {
    prisma.dang_ky_hoc.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'dk-1', khoa_id: 'k' });
    await expect(service.baoVang(user, 'hv-1', dto)).rejects.toBeInstanceOf(
      NotFoundAppException,
    );
    expect(prisma.bao_vang.upsert).not.toHaveBeenCalled();
  });
});
