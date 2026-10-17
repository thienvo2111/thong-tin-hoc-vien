import { HoTroHocVienService } from './ho-tro-hoc-vien.service';
import { PrismaService } from '../prisma/prisma.service';
import { HoTroHocVienScopeService } from './ho-tro-hoc-vien-scope.service';
import { HocVienService } from '../hoc-vien/hoc-vien.service';
import { KhoaBoiDuongService } from '../khoa-boi-duong/khoa-boi-duong.service';
import { NhatKyService } from '../nhat-ky/nhat-ky.service';
import { AuthService } from '../auth/auth.service';
import { NhacLichService } from '../nhac-lich/nhac-lich.service';
import { DoiBuoiHocQueryService } from '../doi-buoi-hoc/doi-buoi-hoc-query.service';

// Spec đổi buổi §5: lịch học của cụm tính buổi chốt; số học viên cụm theo
// buổi = phân vào lớp − đổi ra + đổi vào.
describe('HoTroHocVienService.lichHoc — đổi buổi', () => {
  const buoi = (id: string, lop_id: string) => ({
    id,
    lop_id,
    giai_doan_id: 'gd',
    lop: {
      id: lop_id,
      ten_lop: lop_id,
      loai_lop: 'truc_tiep',
      khoa: { id: 'k', ma_khoa: 'K', ten_khoa: 'K', phan_cong_ho_tro_gv: [] },
      nhan_su: [],
    },
  });

  it('buổi chốt có trong lịch, so_hoc_vien_cum = cơ sở − ra + vào', async () => {
    const prisma = {
      phan_lop_giai_doan: {
        groupBy: jest.fn().mockResolvedValue([
          { lop_id: 'lop-a', giai_doan_id: 'gd', _count: { _all: 5 } },
          { lop_id: 'lop-b', giai_doan_id: 'gd', _count: { _all: 3 } },
        ]),
      },
      lich_hoc_lop: {
        findMany: jest
          .fn()
          .mockResolvedValue([buoi('a1', 'lop-a'), buoi('b1', 'lop-b')]),
      },
      nhan_su_thuc_dia: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const doi = [
      {
        cum_id: 'c1',
        ho_ten: 'An',
        lich_nguon_id: 'a1',
        lich_chot_id: 'b1',
        xu_ly_luc: new Date(),
      },
    ];
    const nhacLich = {
      doiBuoiCuaCum: jest.fn().mockResolvedValue(doi),
      trangThaiCumTheoBuoi: jest.fn().mockResolvedValue(new Map()),
    };
    const service = new HoTroHocVienService(
      prisma as unknown as PrismaService,
      {
        cumLoc: jest.fn().mockResolvedValue(['c1']),
      } as unknown as HoTroHocVienScopeService,
      {} as HocVienService,
      {} as KhoaBoiDuongService,
      {} as NhatKyService,
      {} as AuthService,
      nhacLich as unknown as NhacLichService,
      {} as DoiBuoiHocQueryService,
    );

    const kq = await service.lichHoc('nd-1', {});

    expect(prisma.lich_hoc_lop.findMany.mock.calls[0][0].where.OR).toEqual([
      { lop_id: 'lop-a', giai_doan_id: 'gd' },
      { lop_id: 'lop-b', giai_doan_id: 'gd' },
      { id: { in: ['b1'] } },
    ]);
    const a1 = kq.find((b) => b.id === 'a1');
    const b1 = kq.find((b) => b.id === 'b1');
    expect(a1).toMatchObject({ so_hoc_vien_cum: 4, hoc_vien_doi_buoi: [] });
    expect(b1).toMatchObject({ so_hoc_vien_cum: 4, hoc_vien_doi_buoi: ['An'] });
    // Đổi buổi đã nạp được dùng lại cho trạng thái nhắc (không truy vấn lần 2).
    expect(nhacLich.trangThaiCumTheoBuoi).toHaveBeenCalledWith(
      ['c1'],
      expect.any(Array),
      doi,
    );
  });

  // Buổi chốt hôm qua (ngoài cửa sổ), buổi nguồn ngày mai: vẫn trừ người đổi ra.
  it('buổi chốt sớm hơn cửa sổ, buổi nguồn trong cửa sổ → vẫn trừ đổi ra ở buổi nguồn', async () => {
    const prisma = {
      phan_lop_giai_doan: {
        groupBy: jest
          .fn()
          .mockResolvedValue([
            { lop_id: 'lop-a', giai_doan_id: 'gd', _count: { _all: 5 } },
          ]),
      },
      lich_hoc_lop: {
        findMany: jest.fn().mockResolvedValue([buoi('a1', 'lop-a')]),
      },
      nhan_su_thuc_dia: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const nhacLich = {
      doiBuoiCuaCum: jest.fn().mockResolvedValue([
        {
          cum_id: 'c1',
          ho_ten: 'An',
          lich_nguon_id: 'a1',
          lich_chot_id: 'b-hom-qua',
          xu_ly_luc: new Date(),
        },
      ]),
      trangThaiCumTheoBuoi: jest.fn().mockResolvedValue(new Map()),
    };
    const service = new HoTroHocVienService(
      prisma as unknown as PrismaService,
      {
        cumLoc: jest.fn().mockResolvedValue(['c1']),
      } as unknown as HoTroHocVienScopeService,
      {} as HocVienService,
      {} as KhoaBoiDuongService,
      {} as NhatKyService,
      {} as AuthService,
      nhacLich as unknown as NhacLichService,
      {} as DoiBuoiHocQueryService,
    );

    const kq = await service.lichHoc('nd-1', { tu_ngay: '2026-11-10' });

    // Cửa sổ của lịch được truyền cho doiBuoiCuaCum (lọc theo chốt HOẶC nguồn).
    expect(nhacLich.doiBuoiCuaCum).toHaveBeenCalledWith(
      ['c1'],
      new Date('2026-11-10T00:00:00+07:00'),
    );
    expect(kq).toHaveLength(1);
    expect(kq[0]).toMatchObject({ id: 'a1', so_hoc_vien_cum: 4 });
  });
});
