import { DoiBuoiHocQueryService } from './doi-buoi-hoc-query.service';

const NOW = new Date('2026-10-16T00:00:00Z');
const TUONG_LAI = new Date('2026-10-20T00:00:00Z');
const QUA_KHU = new Date('2026-10-01T00:00:00Z');

function lichRow(id: string, lopId: string, bd: Date, max: number | null = 30) {
  return {
    id,
    lop_id: lopId,
    giai_doan_id: 'gd1',
    buoi_so: 1,
    thoi_gian_bat_dau: bd,
    lop: {
      khoa_id: 'k1',
      loai_lop: 'nang_luc',
      muc_nang_luc: 'co_ban',
      trang_thai: 'active',
      si_so_toi_da: max,
      ten_lop: `Lop ${lopId}`,
    },
  };
}

function dd(dk: string, nguon: string, chot: string, lopNguon = 'A') {
  return {
    dang_ky_hoc_id: dk,
    lich_nguon_id: nguon,
    lich_chot_id: chot,
    lich_nguon: {
      lop_id: lopNguon,
      giai_doan_id: 'gd1',
      lop: { id: lopNguon, ten_lop: `Lop ${lopNguon}` },
    },
    lich_chot: { lop: { id: 'B', ten_lop: 'Lop B' } },
  };
}

function setup(o: {
  lich: any[];
  soPhanLop: number;
  daDuyet: unknown[];
  phanLopHienTai: { dang_ky_hoc_id: string; lop_id: string }[];
  choDuyet?: { lich_de_nghi_id: string; _count: { _all: number } }[];
}) {
  const prisma = {
    lich_hoc_lop: { findMany: jest.fn().mockResolvedValue(o.lich) },
    phan_lop_giai_doan: {
      groupBy: jest.fn().mockResolvedValue(
        o.lich.map((l) => ({
          lop_id: l.lop_id,
          giai_doan_id: l.giai_doan_id,
          _count: { _all: o.soPhanLop },
        })),
      ),
      findMany: jest
        .fn()
        .mockResolvedValue(
          o.phanLopHienTai.map((p) => ({ ...p, giai_doan_id: 'gd1' })),
        ),
    },
    doi_buoi_hoc: {
      findMany: jest.fn().mockResolvedValue(o.daDuyet),
      groupBy: jest.fn().mockResolvedValue(o.choDuyet ?? []),
    },
  };
  return { prisma, svc: new DoiBuoiHocQueryService(prisma as any) };
}

const RONG = { lich: [], soPhanLop: 0, daDuyet: [], phanLopHienTai: [] };

describe('DoiBuoiHocQueryService', () => {
  describe('siSoBuoi', () => {
    it('28 phân lớp, 2 ra, 3 vào -> 29', async () => {
      const { svc } = setup({
        lich: [lichRow('LA', 'A', TUONG_LAI)],
        soPhanLop: 28,
        daDuyet: [
          dd('d1', 'LA', 'LB'),
          dd('d2', 'LA', 'LB'),
          dd('d3', 'LC', 'LA', 'C'),
          dd('d4', 'LC', 'LA', 'C'),
          dd('d5', 'LC', 'LA', 'C'),
        ],
        phanLopHienTai: [
          { dang_ky_hoc_id: 'd1', lop_id: 'A' },
          { dang_ky_hoc_id: 'd2', lop_id: 'A' },
          { dang_ky_hoc_id: 'd3', lop_id: 'C' },
          { dang_ky_hoc_id: 'd4', lop_id: 'C' },
          { dang_ky_hoc_id: 'd5', lop_id: 'C' },
        ],
      });
      const r = await svc.siSoBuoi(['LA'], NOW);
      expect(r.get('LA')).toEqual({
        si_so: 29,
        si_so_toi_da: 30,
        so_cho_duyet: 0,
      });
    });

    it('bỏ qua bản ghi ra của HV đã bị phân sang lớp khác (28-1+3=30)', async () => {
      const { svc } = setup({
        lich: [lichRow('LA', 'A', TUONG_LAI)],
        soPhanLop: 28,
        daDuyet: [
          dd('d1', 'LA', 'LB'),
          dd('d2', 'LA', 'LB'), // d2 nay thuộc lớp Z -> mất hiệu lực
          dd('d3', 'LC', 'LA', 'C'),
          dd('d4', 'LC', 'LA', 'C'),
          dd('d5', 'LC', 'LA', 'C'),
        ],
        phanLopHienTai: [
          { dang_ky_hoc_id: 'd1', lop_id: 'A' },
          { dang_ky_hoc_id: 'd2', lop_id: 'Z' },
          { dang_ky_hoc_id: 'd3', lop_id: 'C' },
          { dang_ky_hoc_id: 'd4', lop_id: 'C' },
          { dang_ky_hoc_id: 'd5', lop_id: 'C' },
        ],
      });
      const r = await svc.siSoBuoi(['LA'], NOW);
      expect(r.get('LA')!.si_so).toBe(30);
    });

    it('bỏ qua bản ghi vào mất hiệu lực', async () => {
      const { svc } = setup({
        lich: [lichRow('LA', 'A', TUONG_LAI)],
        soPhanLop: 10,
        daDuyet: [dd('d3', 'LC', 'LA', 'C')],
        phanLopHienTai: [{ dang_ky_hoc_id: 'd3', lop_id: 'Z' }],
      });
      expect((await svc.siSoBuoi(['LA'], NOW)).get('LA')!.si_so).toBe(10);
    });

    it('so_cho_duyet đếm khi chưa bắt đầu, bằng 0 khi đã bắt đầu', async () => {
      const cho = [{ lich_de_nghi_id: 'LA', _count: { _all: 4 } }];
      const a = setup({
        lich: [lichRow('LA', 'A', TUONG_LAI)],
        soPhanLop: 1,
        daDuyet: [],
        phanLopHienTai: [],
        choDuyet: cho,
      });
      const ra = await a.svc.siSoBuoi(['LA'], NOW);
      expect(ra.get('LA')!.so_cho_duyet).toBe(4);
      const b = setup({
        lich: [lichRow('LA', 'A', QUA_KHU)],
        soPhanLop: 1,
        daDuyet: [],
        phanLopHienTai: [],
        choDuyet: cho,
      });
      const rb = await b.svc.siSoBuoi(['LA'], NOW);
      expect(rb.get('LA')!.so_cho_duyet).toBe(0);
    });

    it('rỗng -> Map rỗng, không truy vấn', async () => {
      const { svc, prisma } = setup(RONG);
      expect((await svc.siSoBuoi([], NOW)).size).toBe(0);
      expect(prisma.lich_hoc_lop.findMany).not.toHaveBeenCalled();
    });

    it('số truy vấn cố định, không theo từng dòng', async () => {
      const { svc, prisma } = setup({
        lich: [lichRow('LA', 'A', TUONG_LAI)],
        soPhanLop: 1,
        daDuyet: [dd('d1', 'LA', 'LB'), dd('d2', 'LA', 'LB')],
        phanLopHienTai: [
          { dang_ky_hoc_id: 'd1', lop_id: 'A' },
          { dang_ky_hoc_id: 'd2', lop_id: 'A' },
        ],
      });
      await svc.siSoBuoi(['LA'], NOW);
      expect(prisma.phan_lop_giai_doan.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.doi_buoi_hoc.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('lichTomTat', () => {
    it('dùng db truyền vào (transaction)', async () => {
      const { svc, prisma } = setup(RONG);
      const tx = {
        lich_hoc_lop: { findMany: jest.fn().mockResolvedValue([]) },
      };
      await svc.lichTomTat(['x'], tx as any);
      expect(tx.lich_hoc_lop.findMany).toHaveBeenCalled();
      expect(prisma.lich_hoc_lop.findMany).not.toHaveBeenCalled();
    });
  });

  describe('dieuChinhTheoBuoi', () => {
    it('trả ra/vao kèm tên lớp, loại bản ghi mất hiệu lực', async () => {
      const { svc } = setup({
        ...RONG,
        daDuyet: [dd('d1', 'LA', 'LB'), dd('d2', 'LA', 'LB')],
        phanLopHienTai: [
          { dang_ky_hoc_id: 'd1', lop_id: 'A' },
          { dang_ky_hoc_id: 'd2', lop_id: 'Z' },
        ],
      });
      const r = await svc.dieuChinhTheoBuoi(['LA', 'LB']);
      expect(r.get('LA')!.ra).toEqual([
        { dang_ky_hoc_id: 'd1', lop_chot: { id: 'B', ten_lop: 'Lop B' } },
      ]);
      expect(r.get('LB')!.vao).toEqual([
        {
          dang_ky_hoc_id: 'd1',
          lich_nguon_id: 'LA',
          lop_nguon: { id: 'A', ten_lop: 'Lop A' },
        },
      ]);
      expect(r.get('LA')!.vao).toEqual([]);
    });
  });

  describe('doiBuoiDaDuyetCuaDangKy', () => {
    it('chỉ trả bản ghi còn hiệu lực', async () => {
      const { svc } = setup({
        ...RONG,
        daDuyet: [dd('d1', 'LA', 'LB'), dd('d2', 'LA', 'LB')],
        phanLopHienTai: [
          { dang_ky_hoc_id: 'd1', lop_id: 'A' },
          { dang_ky_hoc_id: 'd2', lop_id: 'Z' },
        ],
      });
      expect(await svc.doiBuoiDaDuyetCuaDangKy(['d1', 'd2'])).toEqual([
        { dang_ky_hoc_id: 'd1', lich_nguon_id: 'LA', lich_chot_id: 'LB' },
      ]);
    });
    it('rỗng -> []', async () => {
      const { svc } = setup(RONG);
      expect(await svc.doiBuoiDaDuyetCuaDangKy([])).toEqual([]);
    });
  });

  describe('where của truy vấn', () => {
    it('siSoBuoi lọc đúng da_duyet, cho_duyet, cặp lớp/giai đoạn, tập lịch', async () => {
      const { svc, prisma } = setup({
        lich: [lichRow('LA', 'A', TUONG_LAI)],
        soPhanLop: 1,
        daDuyet: [dd('d1', 'LA', 'LB')],
        phanLopHienTai: [{ dang_ky_hoc_id: 'd1', lop_id: 'A' }],
      });
      await svc.siSoBuoi(['LA'], NOW);
      expect(prisma.phan_lop_giai_doan.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { OR: [{ lop_id: 'A', giai_doan_id: 'gd1' }] },
        }),
      );
      expect(prisma.doi_buoi_hoc.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { lich_nguon_id: { in: ['LA'] } },
              { lich_chot_id: { in: ['LA'] } },
            ],
            trang_thai: 'da_duyet',
          },
        }),
      );
      expect(prisma.phan_lop_giai_doan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { OR: [{ dang_ky_hoc_id: 'd1', giai_doan_id: 'gd1' }] },
        }),
      );
      expect(prisma.doi_buoi_hoc.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { lich_de_nghi_id: { in: ['LA'] }, trang_thai: 'cho_duyet' },
        }),
      );
    });

    it('dieuChinhTheoBuoi lọc da_duyet theo tập lịch', async () => {
      const { svc, prisma } = setup(RONG);
      await svc.dieuChinhTheoBuoi(['LA', 'LB']);
      expect(prisma.doi_buoi_hoc.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            trang_thai: 'da_duyet',
            OR: [
              { lich_nguon_id: { in: ['LA', 'LB'] } },
              { lich_chot_id: { in: ['LA', 'LB'] } },
            ],
          },
        }),
      );
    });

    it('doiBuoiDaDuyetCuaDangKy lọc da_duyet theo tập đăng ký', async () => {
      const { svc, prisma } = setup(RONG);
      await svc.doiBuoiDaDuyetCuaDangKy(['d1', 'd2']);
      expect(prisma.doi_buoi_hoc.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            dang_ky_hoc_id: { in: ['d1', 'd2'] },
            trang_thai: 'da_duyet',
          },
        }),
      );
    });
  });
});
