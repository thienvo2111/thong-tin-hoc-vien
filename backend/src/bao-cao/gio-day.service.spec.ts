import { GioDayService } from './gio-day.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeService } from '../auth/scope/scope.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ForbiddenAppException } from '../common/exceptions/app.exceptions';

const quanTri = { id: 'qt', vai_tro: 'quan_tri' } as AuthenticatedUser;
const so = {
  id: 'so',
  vai_tro: 'so_gddt',
  don_vi_id: 'dv-so',
} as AuthenticatedUser;

const pc = (
  gv: string,
  lop: string,
  soGio: number | null,
  xacNhan: boolean,
) => ({
  so_gio: soGio,
  da_xac_nhan_gio: xacNhan,
  giang_vien: {
    id: gv,
    ho_ten: `GV ${gv}`,
    so_dien_thoai: '0900000000',
    email: `${gv}@x.vn`,
  },
  lich_hoc: {
    lop: { id: lop, ten_lop: `Lớp ${lop}`, khoa: { ma_khoa: 'K1' } },
  },
});

describe('GioDayService.baoCao (T11)', () => {
  let prisma: {
    khoa_boi_duong: { findUnique: jest.Mock };
    phan_cong_giang_day: { findMany: jest.Mock };
  };
  let scope: { getKhoaIdsXemDuoc: jest.Mock };
  let service: GioDayService;

  beforeEach(() => {
    prisma = {
      khoa_boi_duong: { findUnique: jest.fn().mockResolvedValue({ id: 'k1' }) },
      phan_cong_giang_day: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            pc('a', 'l1', 4, true),
            pc('a', 'l1', 3, false),
            pc('a', 'l1', 2.5, true),
            pc('b', 'l1', 4, false),
          ]),
      },
    };
    scope = { getKhoaIdsXemDuoc: jest.fn().mockResolvedValue(['k1']) };
    service = new GioDayService(
      prisma as unknown as PrismaService,
      scope as unknown as ScopeService,
    );
  });

  it('chỉ cộng giờ của phân công đã xác nhận; đếm đủ số buổi', async () => {
    const kq = await service.baoCao({}, quanTri);
    const a = kq.rows.find((r) => r.giang_vien_id === 'a')!;
    expect(a).toEqual(
      expect.objectContaining({
        so_buoi: 3,
        so_buoi_da_xac_nhan: 2,
        tong_gio_da_xac_nhan: 6.5,
      }),
    );
    const b = kq.rows.find((r) => r.giang_vien_id === 'b')!;
    expect(b.tong_gio_da_xac_nhan).toBe(0);
    expect(kq.tong).toEqual({
      so_buoi: 4,
      so_buoi_da_xac_nhan: 2,
      tong_gio_da_xac_nhan: 6.5,
    });
  });

  it('Quản trị thấy SĐT/email; Sở không có các field này', async () => {
    const qt = await service.baoCao({}, quanTri);
    expect(qt.rows[0]).toHaveProperty('so_dien_thoai', '0900000000');
    const s = await service.baoCao({}, so);
    expect(s.rows[0]).not.toHaveProperty('so_dien_thoai');
    expect(s.rows[0]).not.toHaveProperty('email');
  });

  it('Sở: chỉ lọc trong khóa xem được', async () => {
    await service.baoCao({}, so);
    expect(prisma.phan_cong_giang_day.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { lich_hoc: { lop: { khoa_id: { in: ['k1'] } } } },
      }),
    );
  });

  it('Sở chọn khóa ngoài phạm vi → 403', async () => {
    scope.getKhoaIdsXemDuoc.mockResolvedValueOnce(['k-khac']);
    await expect(service.baoCao({ khoa_id: 'k1' }, so)).rejects.toBeInstanceOf(
      ForbiddenAppException,
    );
  });
});
