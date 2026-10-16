import {
  capNhatTheoDoiBuoi,
  DoiBuoiCum,
  NhacLichService,
} from './nhac-lich.service';
import { trangThaiNhac } from './nhac-lich.util';
import { PrismaService } from '../prisma/prisma.service';
import { DoiBuoiHocQueryService } from '../doi-buoi-hoc/doi-buoi-hoc-query.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

// Spec đổi buổi §5: buổi chốt của học viên cụm là buổi của cụm; duyệt đổi
// buổi sau lần nhắc cuối → "cần nhắc lại".
const doi = (ghiDe: Partial<DoiBuoiCum> = {}): DoiBuoiCum => ({
  cum_id: 'c1',
  ho_ten: 'An',
  lich_nguon_id: 'a1',
  lich_chot_id: 'b1',
  xu_ly_luc: new Date('2026-11-03T00:00:00Z'),
  ...ghiDe,
});

describe('capNhatTheoDoiBuoi', () => {
  const buoi = { id: 'b1', cap_nhat_luc: new Date('2026-11-01T00:00:00Z') };
  const guiLuc = (iso: string) => [
    { lich_hoc_ids: ['b1'], gui_luc: new Date(iso) },
  ];

  it('duyệt SAU lần gửi cuối → cần nhắc lại', () => {
    const b = capNhatTheoDoiBuoi(buoi, [doi()]);
    expect(trangThaiNhac(b, guiLuc('2026-11-02T00:00:00Z'))).toBe(
      'can_nhac_lai',
    );
  });

  it('duyệt TRƯỚC lần gửi cuối → đã nhắc', () => {
    const b = capNhatTheoDoiBuoi(buoi, [doi()]);
    expect(trangThaiNhac(b, guiLuc('2026-11-04T00:00:00Z'))).toBe('da_nhac');
  });

  it('đổi buổi vào buổi khác hoặc chưa có xu_ly_luc → bỏ qua', () => {
    const b = capNhatTheoDoiBuoi(buoi, [
      doi({ lich_chot_id: 'b9' }),
      doi({ xu_ly_luc: null }),
    ]);
    expect(b.cap_nhat_luc).toEqual(buoi.cap_nhat_luc);
  });
});

describe('NhacLichService — đổi buổi của cụm', () => {
  let prisma: {
    doi_buoi_hoc: { findMany: jest.Mock };
    phan_lop_giai_doan: { findMany: jest.Mock };
    nhat_ky_nhac_lich: { findMany: jest.Mock; create: jest.Mock };
    lich_hoc_lop: { count: jest.Mock };
  };
  let query: { doiBuoiDaDuyetCuaDangKy: jest.Mock };
  let service: NhacLichService;

  beforeEach(() => {
    prisma = {
      doi_buoi_hoc: { findMany: jest.fn().mockResolvedValue([]) },
      phan_lop_giai_doan: { findMany: jest.fn().mockResolvedValue([]) },
      nhat_ky_nhac_lich: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'nk-1' }),
      },
      lich_hoc_lop: { count: jest.fn() },
    };
    query = { doiBuoiDaDuyetCuaDangKy: jest.fn().mockResolvedValue([]) };
    service = new NhacLichService(
      prisma as unknown as PrismaService,
      query as unknown as DoiBuoiHocQueryService,
    );
  });

  const banGhi = (dk: string, chot: string, ho_ten: string) => ({
    dang_ky_hoc_id: dk,
    lich_chot_id: chot,
    xu_ly_luc: new Date('2026-11-03T00:00:00Z'),
    dang_ky_hoc: { cum_id: 'c1', hoc_vien: { ho_ten } },
  });

  it('doiBuoiCuaCum: lọc theo cụm + cửa sổ thời gian, chỉ giữ bản ghi hiệu lực khớp (đăng ký, buổi chốt)', async () => {
    prisma.doi_buoi_hoc.findMany.mockResolvedValue([
      banGhi('dk1', 'b1', 'An'),
      banGhi('dk2', 'b2', 'Bình'),
    ]);
    query.doiBuoiDaDuyetCuaDangKy.mockResolvedValue([
      { dang_ky_hoc_id: 'dk1', lich_nguon_id: 'a1', lich_chot_id: 'b1' },
      // dk2 còn hiệu lực nhưng ở buổi chốt khác → không khớp.
      { dang_ky_hoc_id: 'dk2', lich_nguon_id: 'a2', lich_chot_id: 'b9' },
    ]);
    const tu = new Date('2026-10-01T00:00:00Z');
    const kq = await service.doiBuoiCuaCum(['c1'], tu);
    expect(prisma.doi_buoi_hoc.findMany.mock.calls[0][0].where).toEqual({
      trang_thai: 'da_duyet',
      // Buổi chốt có thể sớm hơn buổi nguồn: giữ nếu 1 trong 2 còn trong cửa sổ.
      OR: [
        { lich_chot: { thoi_gian_bat_dau: { gte: tu } } },
        { lich_nguon: { thoi_gian_bat_dau: { gte: tu } } },
      ],
      dang_ky_hoc: { cum_id: { in: ['c1'] } },
    });
    expect(query.doiBuoiDaDuyetCuaDangKy).toHaveBeenCalledWith(['dk1', 'dk2']);
    expect(kq).toEqual([
      {
        cum_id: 'c1',
        ho_ten: 'An',
        lich_nguon_id: 'a1',
        lich_chot_id: 'b1',
        xu_ly_luc: new Date('2026-11-03T00:00:00Z'),
      },
    ]);
  });

  it('trangThaiCumTheoBuoi: cụm không có ai phân vào lớp vẫn có buổi chốt; dùng đổi buổi đã nạp', async () => {
    const kq = await service.trangThaiCumTheoBuoi(
      ['c1'],
      [
        {
          id: 'b1',
          lop_id: 'lop-b',
          giai_doan_id: 'gd',
          cap_nhat_luc: new Date('2026-11-01T00:00:00Z'),
        },
      ],
      [doi()],
    );
    expect(kq.get('b1')).toEqual([{ cum_id: 'c1', trang_thai: 'chua_nhac' }]);
    expect(prisma.doi_buoi_hoc.findMany).not.toHaveBeenCalled();
  });

  it('ghiNhacCum: chấp nhận buổi chốt của cụm', async () => {
    prisma.doi_buoi_hoc.findMany.mockResolvedValue([banGhi('dk1', 'b1', 'An')]);
    query.doiBuoiDaDuyetCuaDangKy.mockResolvedValue([
      { dang_ky_hoc_id: 'dk1', lich_nguon_id: 'a1', lich_chot_id: 'b1' },
    ]);
    prisma.lich_hoc_lop.count.mockResolvedValue(1);
    await service.ghiNhacCum({ id: 'nd-1' } as AuthenticatedUser, {
      cum_id: 'c1',
      lich_hoc_ids: ['b1'],
      noi_dung: 'Nhắc',
    });
    expect(prisma.lich_hoc_lop.count).toHaveBeenCalledWith({
      where: { id: { in: ['b1'] }, OR: [{ id: { in: ['b1'] } }] },
    });
    expect(prisma.nhat_ky_nhac_lich.create).toHaveBeenCalled();
  });
});
