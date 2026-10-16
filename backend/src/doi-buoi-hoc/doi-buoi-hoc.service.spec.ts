import { Prisma } from '@prisma/client';
import { DoiBuoiHocService } from './doi-buoi-hoc.service';
import { LichTomTat } from './doi-buoi-hoc.rules';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

const ngayMai = new Date(Date.now() + 86_400_000);
const hqua = new Date(Date.now() - 86_400_000);

function lich(
  id: string,
  lopId: string,
  over: Partial<LichTomTat> = {},
): LichTomTat {
  return {
    id,
    lop_id: lopId,
    giai_doan_id: 'gd1',
    buoi_so: 3,
    thoi_gian_bat_dau: ngayMai,
    lop: {
      khoa_id: 'k1',
      loai_lop: 'zoom',
      muc_nang_luc: 'co_ban',
      trang_thai: 'active',
      si_so_toi_da: 40,
      ten_lop: lopId,
    },
    ...over,
  } as LichTomTat;
}

const user = { id: 'u1', hoc_vien_id: 'hv1' } as AuthenticatedUser;
const dto = {
  lich_nguon_id: 'ln',
  lich_de_nghi_id: 'ld',
  ly_do: 'Ban viec dot xuat',
};

function setup(
  opts: { soBuoi?: number; luot?: number; capNhat?: number } = {},
) {
  const order: string[] = [];
  const tx = {
    $executeRaw: jest.fn(async () => {
      order.push('lock');
      return 0;
    }),
    doi_buoi_hoc: {
      updateMany: jest.fn(async () => {
        order.push('updateMany');
        return { count: opts.capNhat ?? 1 };
      }),
      count: jest.fn(async () => {
        order.push('count');
        return opts.luot ?? 0;
      }),
      create: jest.fn(async () => ({ id: 'moi' })),
    },
    phan_lop_giai_doan: {
      findFirst: jest.fn(async () => ({ lop_id: 'lopA' })),
    },
  };
  const prisma = {
    $transaction: jest.fn((cb: (t: unknown) => unknown) => cb(tx)),
    dang_ky_hoc: { findFirst: jest.fn(async () => ({ id: 'dk1' })) },
    khoa_boi_duong: {
      findUnique: jest.fn(async () => ({
        so_buoi_doi_toi_da: opts.soBuoi ?? 2,
      })),
    },
    doi_buoi_hoc: {
      findFirst: jest.fn(async () => ({
        id: 'x1',
        dang_ky_hoc_id: 'dk1',
        lich_nguon_id: 'ln',
        trang_thai: 'cho_duyet',
        dang_ky_hoc: { khoa_id: 'k1' },
      })),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
  };
  const query = {
    lichTomTat: jest.fn(
      async () =>
        new Map([
          ['ln', lich('ln', 'lopA')],
          ['ld', lich('ld', 'lopB')],
        ]),
    ),
    siSoBuoi: jest.fn(
      async () =>
        new Map([['ld', { si_so: 5, si_so_toi_da: 40, so_cho_duyet: 0 }]]),
    ),
  };
  const nhatKy = { ghi: jest.fn(async () => undefined) };
  const svc = new DoiBuoiHocService(
    prisma as never,
    query as never,
    nhatKy as never,
  );
  return { svc, prisma, tx, query, nhatKy, order };
}

describe('DoiBuoiHocService (hoc vien)', () => {
  it('gui: khoa tat -> 403, khong tao', async () => {
    const { svc, tx } = setup({ soBuoi: 0 });
    await expect(svc.gui(user, dto)).rejects.toMatchObject({ status: 403 });
    expect(tx.doi_buoi_hoc.create).not.toHaveBeenCalled();
  });

  it('gui: hoc_vien_id null -> 403', async () => {
    const { svc } = setup();
    await expect(
      svc.gui({ ...user, hoc_vien_id: null }, dto),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('gui: goi advisory lock truoc khi dem luot', async () => {
    const { svc, tx } = setup();
    await svc.gui(user, dto);
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.doi_buoi_hoc.count.mock.invocationCallOrder[0],
    );
    expect(tx.doi_buoi_hoc.count).toHaveBeenCalledWith({
      where: {
        dang_ky_hoc_id: 'dk1',
        trang_thai: { in: ['cho_duyet', 'da_duyet'] },
      },
    });
  });

  it('gui: het luot -> 400, khong tao', async () => {
    const { svc, tx } = setup({ soBuoi: 1, luot: 1 });
    await expect(svc.gui(user, dto)).rejects.toMatchObject({ status: 400 });
    expect(tx.doi_buoi_hoc.create).not.toHaveBeenCalled();
  });

  it('gui: tao dung du lieu, nhat ky ghi SAU transaction', async () => {
    const { svc, tx, nhatKy } = setup();
    await expect(svc.gui(user, dto)).resolves.toEqual({ id: 'moi' });
    expect(tx.doi_buoi_hoc.create).toHaveBeenCalledWith({
      data: {
        dang_ky_hoc_id: 'dk1',
        lich_nguon_id: 'ln',
        lich_de_nghi_id: 'ld',
        ly_do: 'Ban viec dot xuat',
        nguoi_tao: 'u1',
      },
      select: { id: true },
    });
    expect(nhatKy.ghi).toHaveBeenCalledWith(
      expect.objectContaining({
        hanh_dong: 'de_nghi_doi_buoi',
        hoc_vien_id: 'hv1',
      }),
    );
    expect(tx.doi_buoi_hoc.create.mock.invocationCallOrder[0]).toBeLessThan(
      nhatKy.ghi.mock.invocationCallOrder[0],
    );
  });

  it('gui: P2002 -> 409, khong ghi nhat ky', async () => {
    const { svc, tx, nhatKy } = setup();
    tx.doi_buoi_hoc.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'x',
      }),
    );
    await expect(svc.gui(user, dto)).rejects.toMatchObject({ status: 409 });
    expect(nhatKy.ghi).not.toHaveBeenCalled();
  });

  it('gui: buoi nguon khong ton tai -> 404', async () => {
    const { svc, query } = setup();
    query.lichTomTat.mockResolvedValueOnce(new Map());
    await expect(svc.gui(user, dto)).rejects.toMatchObject({ status: 404 });
  });

  it('gui: khong co dang ky khoa cua caller -> 404', async () => {
    const { svc, prisma } = setup();
    prisma.dang_ky_hoc.findFirst.mockResolvedValueOnce(null as never);
    await expect(svc.gui(user, dto)).rejects.toMatchObject({ status: 404 });
    expect(prisma.dang_ky_hoc.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { hoc_vien_id: 'hv1', khoa_id: 'k1' } }),
    );
  });

  it('gui: buoi nguon khong thuoc lop hien tai -> 400', async () => {
    const { svc, tx } = setup();
    tx.phan_lop_giai_doan.findFirst.mockResolvedValueOnce({ lop_id: 'lopZ' });
    await expect(svc.gui(user, dto)).rejects.toMatchObject({ status: 400 });
  });

  it('sua: updateMany 0 dong -> 409, khong create', async () => {
    const { svc, tx } = setup({ capNhat: 0 });
    await expect(svc.sua(user, 'x1', dto)).rejects.toMatchObject({
      status: 409,
    });
    expect(tx.doi_buoi_hoc.create).not.toHaveBeenCalled();
    expect(tx.doi_buoi_hoc.updateMany).toHaveBeenCalledWith({
      where: { id: 'x1', trang_thai: 'cho_duyet', dang_ky_hoc_id: 'dk1' },
      data: { trang_thai: 'da_huy' },
    });
  });

  it('sua: lock -> huy ban cu -> dem luot -> tao; luot khong tang', async () => {
    const { svc, tx, order } = setup({ soBuoi: 1, luot: 0 });
    await expect(svc.sua(user, 'x1', dto)).resolves.toEqual({ id: 'moi' });
    expect(order).toEqual(['lock', 'updateMany', 'count']);
    expect(tx.doi_buoi_hoc.create).toHaveBeenCalledTimes(1);
  });

  it('sua: doi buoi nguon -> 400, khong vao transaction', async () => {
    const { svc, tx } = setup();
    await expect(
      svc.sua(user, 'x1', { ...dto, lich_nguon_id: 'khac' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('sua: de nghi cua nguoi khac -> 404', async () => {
    const { svc, prisma } = setup();
    prisma.doi_buoi_hoc.findFirst.mockResolvedValueOnce(null as never);
    await expect(svc.sua(user, 'x1', dto)).rejects.toMatchObject({
      status: 404,
    });
    expect(prisma.doi_buoi_hoc.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'x1', dang_ky_hoc: { hoc_vien_id: 'hv1' } },
      }),
    );
  });

  it('huy: dang ky cua nguoi khac -> 404', async () => {
    const { svc, prisma } = setup();
    prisma.doi_buoi_hoc.findFirst.mockResolvedValueOnce(null as never);
    await expect(svc.huyHocVien(user, 'x1')).rejects.toMatchObject({
      status: 404,
    });
    expect(prisma.doi_buoi_hoc.updateMany).not.toHaveBeenCalled();
  });

  it('huy: updateMany co dieu kien trang thai + dang ky; 0 dong -> 409', async () => {
    const { svc, prisma } = setup();
    prisma.doi_buoi_hoc.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(svc.huyHocVien(user, 'x1')).rejects.toMatchObject({
      status: 409,
    });
    expect(prisma.doi_buoi_hoc.updateMany).toHaveBeenCalledWith({
      where: { id: 'x1', trang_thai: 'cho_duyet', dang_ky_hoc_id: 'dk1' },
      data: { trang_thai: 'da_huy' },
    });
  });

  it('huy: thanh cong ghi nhat ky', async () => {
    const { svc, nhatKy } = setup();
    await expect(svc.huyHocVien(user, 'x1')).resolves.toEqual({
      trang_thai: 'da_huy',
    });
    expect(nhatKy.ghi).toHaveBeenCalledWith(
      expect.objectContaining({
        hanh_dong: 'de_nghi_doi_buoi',
        hoc_vien_id: 'hv1',
      }),
    );
  });

  it('huy: khoa tat -> 403', async () => {
    const { svc } = setup({ soBuoi: 0 });
    await expect(svc.huyHocVien(user, 'x1')).rejects.toMatchObject({
      status: 403,
    });
  });
});

describe('DoiBuoiHocService luaChon / tongQuan', () => {
  function setupDoc() {
    const s = setup();
    const p = s.prisma as Record<string, unknown>;
    p.phan_lop_giai_doan = {
      findFirst: jest.fn(async () => ({ lop_id: 'lopA' })),
      findMany: jest.fn(async () => [{ giai_doan_id: 'gd1', lop_id: 'lopA' }]),
    };
    const khacLoai = lich('lk', 'lopC');
    khacLoai.lop = { ...khacLoai.lop, loai_lop: 'truc_tiep' };
    const lichFindMany = jest.fn(async (_arg?: unknown) => [
      lich('ld', 'lopB'),
      khacLoai,
      lich('lfull', 'lopD'),
      lich('ln', 'lopA'),
    ]);
    p.lich_hoc_lop = { findMany: lichFindMany };
    s.query.siSoBuoi.mockResolvedValue(
      new Map([
        ['ld', { si_so: 5, si_so_toi_da: 40, so_cho_duyet: 1 }],
        ['lfull', { si_so: 40, si_so_toi_da: 40, so_cho_duyet: 0 }],
      ]),
    );
    return { ...s, lichFindMany };
  }

  it('lua-chon: loc tuong duong, tinh da_du, loc DB dung dieu kien', async () => {
    const { svc, lichFindMany } = setupDoc();
    const r = await svc.luaChonHocVien(user, 'ln');
    expect(r.map((x) => x.lich.id)).toEqual(['ld', 'lfull']);
    expect(r[0]).toMatchObject({ si_so: 5, so_cho_duyet: 1, da_du: false });
    expect(r[1].da_du).toBe(true);
    const arg = lichFindMany.mock.calls[0][0] as {
      where: Record<string, unknown> & { thoi_gian_bat_dau: { gt: Date } };
    };
    expect(arg.where).toMatchObject({
      giai_doan_id: 'gd1',
      buoi_so: 3,
      lop: { khoa_id: 'k1', loai_lop: 'zoom' },
    });
    expect(arg.where.thoi_gian_bat_dau.gt).toBeInstanceOf(Date);
  });

  it('lua-chon: buoi nguon da bat dau -> 400', async () => {
    const { svc, query } = setupDoc();
    query.lichTomTat.mockResolvedValueOnce(
      new Map([['ln', lich('ln', 'lopA', { thoi_gian_bat_dau: hqua })]]),
    );
    await expect(svc.luaChonHocVien(user, 'ln')).rejects.toMatchObject({
      status: 400,
    });
  });

  it('lua-chon: buoi nguon khong thuoc phan lop hien tai -> 404', async () => {
    const { svc, prisma } = setupDoc();
    (
      prisma as never as { phan_lop_giai_doan: { findFirst: jest.Mock } }
    ).phan_lop_giai_doan.findFirst.mockResolvedValueOnce({ lop_id: 'lopZ' });
    await expect(svc.luaChonHocVien(user, 'ln')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('lua-chon: khoa tat -> 403', async () => {
    const s = setupDoc();
    s.prisma.khoa_boi_duong.findUnique.mockResolvedValue({
      so_buoi_doi_toi_da: 0,
    });
    await expect(s.svc.luaChonHocVien(user, 'ln')).rejects.toMatchObject({
      status: 403,
    });
  });

  it('tong quan: khoa tat -> 403', async () => {
    const s = setupDoc();
    s.prisma.khoa_boi_duong.findUnique.mockResolvedValue({
      so_buoi_doi_toi_da: 0,
    });
    await expect(s.svc.tongQuanHocVien(user, 'k1')).rejects.toMatchObject({
      status: 403,
    });
  });

  it('tong quan: buoi sap toi + de nghi, thu tu hang chi cho_duyet', async () => {
    const s = setupDoc();
    const t0 = new Date(Date.now() - 5000);
    const row = (id: string, trang_thai: string, over: object = {}) => ({
      id,
      trang_thai,
      lich_nguon_id: 'ln',
      lich_de_nghi_id: 'ld',
      lich_chot_id: null,
      ly_do: 'abcde',
      tao_luc: t0,
      ghi_chu_xu_ly: null,
      ...over,
    });
    (s.prisma.doi_buoi_hoc as Record<string, unknown>).findMany = jest
      .fn()
      .mockResolvedValueOnce([
        row('a', 'cho_duyet'),
        row('b', 'da_huy', { lich_nguon_id: 'lx' }),
      ])
      .mockResolvedValueOnce([
        {
          id: 'z',
          tao_luc: new Date(t0.getTime() - 1000),
          lich_de_nghi_id: 'ld',
          lich_nguon: { thoi_gian_bat_dau: ngayMai },
        },
        {
          id: 'a',
          tao_luc: t0,
          lich_de_nghi_id: 'ld',
          lich_nguon: { thoi_gian_bat_dau: ngayMai },
        },
      ]);
    s.query.lichTomTat.mockResolvedValue(
      new Map([
        ['ln', lich('ln', 'lopA')],
        ['ld', lich('ld', 'lopB')],
        ['lx', lich('lx', 'lopA')],
      ]),
    );
    const r = await s.svc.tongQuanHocVien(user, 'k1');
    expect(r.so_buoi_doi_toi_da).toBe(2);
    expect(r.so_luot_da_dung).toBe(1);
    expect(r.de_nghi).toHaveLength(2);
    expect(r.de_nghi[0]).toMatchObject({
      id: 'a',
      qua_han: false,
      thu_tu_hang: { k: 2, n: 2 },
    });
    expect(r.de_nghi[1]).toMatchObject({ id: 'b', thu_tu_hang: null });
    expect(
      r.buoi_sap_toi.find((b) => b.lich_nguon.id === 'ln')?.de_nghi?.id,
    ).toBe('a');
  });
});
