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
    { cumIdsCuaToi: jest.fn(async () => []) } as never,
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

  it('gui: dang ky bi tu choi -> 400 khong con hieu luc, khong tao', async () => {
    const { svc, prisma, tx } = setup();
    prisma.dang_ky_hoc.findFirst.mockResolvedValueOnce({
      id: 'dk1',
      trang_thai: 'tu_choi',
    } as never);
    await expect(svc.gui(user, dto)).rejects.toMatchObject({
      status: 400,
      response: { error: expect.objectContaining({ message: 'Đăng ký không còn hiệu lực' }) },
    });
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it.each(['cho_duyet', 'da_duyet', 'da_phan_lop'])(
    'gui: dang ky %s van gui duoc',
    async (tt) => {
      const { svc, prisma } = setup();
      prisma.dang_ky_hoc.findFirst.mockResolvedValueOnce({
        id: 'dk1',
        trang_thai: tt,
      } as never);
      await expect(svc.gui(user, dto)).resolves.toEqual({ id: 'moi' });
    },
  );

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

  it('lua-chon: dia diem theo loai lop, zoom khong bao gio lo link', async () => {
    const mk = (id: string, lopId: string, loai: string, extra: object) => {
      const l = lich(id, lopId, extra as Partial<LichTomTat>);
      l.lop = { ...l.lop, loai_lop: loai as never };
      return l;
    };
    const ketThuc = new Date(ngayMai.getTime() + 3_600_000);
    const link = 'https://zoom.example/j/1';
    const loai = (l: string) => {
      const s = setupDoc();
      s.query.lichTomTat.mockResolvedValueOnce(
        new Map([['ln', mk('ln', 'lopA', l, {})]]),
      );
      (s.prisma as any).lich_hoc_lop.findMany.mockResolvedValueOnce([
        mk('ld', 'lopB', l, {
          thoi_gian_ket_thuc: ketThuc,
          phong: 'P1',
          dia_diem_hoac_link: link,
          diem_hoc: { ten: 'THPT A', dia_chi: '1 Duong B' },
        }),
      ]);
      return s.svc.luaChonHocVien(user, 'ln');
    };
    const zoom = (await loai('zoom'))[0];
    expect(zoom.dia_diem_hoac_link).toBeNull();
    expect(zoom.diem_hoc).toBeNull();
    expect(zoom.thoi_gian_ket_thuc).toBe(ketThuc);
    const tt = (await loai('truc_tiep'))[0];
    expect(tt).toMatchObject({
      diem_hoc: { ten: 'THPT A', dia_chi: '1 Duong B' },
      phong: 'P1',
      dia_diem_hoac_link: null,
    });
    expect((await loai('vle'))[0]).toMatchObject({
      dia_diem_hoac_link: link,
      diem_hoc: null,
      phong: null,
    });
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

describe('DoiBuoiHocService tongQuan buoi chot', () => {
  it('da_duyet chot buoi khac buoi de nghi: nap lich_chot_id, tra buoi_chot', async () => {
    const s = setup({ soBuoi: 2 });
    const p = s.prisma as Record<string, any>;
    p.phan_lop_giai_doan = { findMany: jest.fn(async () => []) };
    p.lich_hoc_lop = { findMany: jest.fn(async () => []) };
    p.doi_buoi_hoc.findMany = jest.fn().mockResolvedValueOnce([
      {
        id: 'd1',
        trang_thai: 'da_duyet',
        lich_nguon_id: 'ln',
        lich_de_nghi_id: 'ld',
        lich_chot_id: 'lc',
        ly_do: 'abcde',
        tao_luc: new Date(Date.now() - 5000),
        ghi_chu_xu_ly: null,
      },
    ]);
    s.query.lichTomTat.mockResolvedValue(
      new Map([
        ['ln', lich('ln', 'lopA')],
        ['ld', lich('ld', 'lopB')],
        ['lc', lich('lc', 'lopChot')],
      ]),
    );
    const r = await s.svc.tongQuanHocVien(user, 'k1');
    expect((s.query.lichTomTat.mock.calls as unknown[][])[0][0]).toEqual(
      expect.arrayContaining(['ln', 'ld', 'lc']),
    );
    expect(r.de_nghi[0].buoi_chot).toMatchObject({
      id: 'lc',
      lop: { ten_lop: 'lopChot' },
    });
  });
});

describe('DoiBuoiHocService nguoi duyet', () => {
  const quanTri = { id: 'qt', vai_tro: 'quan_tri' } as AuthenticatedUser;
  const hoTro = { id: 'ht', vai_tro: 'ho_tro_hoc_vien' } as AuthenticatedUser;
  const taoLuc = new Date(Date.now() - 60_000);
  const ghiChu = { ghi_chu: 'Da trao doi voi hoc vien' };

  function setupDuyet(
    opts: {
      siSo?: number;
      soTruoc?: number;
      capNhat?: number;
      trangThai?: string;
      lopPhan?: string;
      lichChot?: string;
    } = {},
  ) {
    const order: string[] = [];
    const deNghi = {
      id: 'x1',
      trang_thai: opts.trangThai ?? 'cho_duyet',
      dang_ky_hoc_id: 'dk1',
      lich_nguon_id: 'ln',
      lich_de_nghi_id: 'ld',
      lich_chot_id: opts.lichChot ?? null,
      tao_luc: taoLuc,
      dang_ky_hoc: { hoc_vien_id: 'hv1' },
    };
    const tx = {
      $executeRaw: jest.fn(async (..._a: unknown[]) => {
        order.push('lock');
        return 0;
      }),
      doi_buoi_hoc: {
        findUnique: jest.fn(async () => deNghi),
        count: jest.fn(async (_a?: unknown) => {
          order.push('count');
          return opts.soTruoc ?? 0;
        }),
        updateMany: jest.fn(async (_a?: unknown) => ({
          count: opts.capNhat ?? 1,
        })),
      },
      phan_lop_giai_doan: {
        findFirst: jest.fn(async () => ({ lop_id: opts.lopPhan ?? 'lopA' })),
      },
    };
    const prisma = {
      $transaction: jest.fn((cb: (t: unknown) => unknown) => cb(tx)),
      doi_buoi_hoc: {
        findFirst: jest.fn(async (_a?: unknown) => deNghi as unknown),
        findMany: jest.fn(async (_a?: unknown) => [] as unknown[]),
        count: jest.fn(async (_a?: unknown) => 3),
        groupBy: jest.fn(async (_a?: unknown) => [] as unknown[]),
        updateMany: jest.fn(async (_a?: unknown) => ({
          count: opts.capNhat ?? 1,
        })),
      },
      lich_hoc_lop: { findMany: jest.fn(async () => [] as LichTomTat[]) },
    };
    const lichMap = new Map([
      ['ln', lich('ln', 'lopA')],
      ['ld', lich('ld', 'lopB')],
      ['lk', lich('lk', 'lopC')],
    ]);
    const query = {
      lichTomTat: jest.fn(async (..._a: unknown[]) => lichMap),
      siSoBuoi: jest.fn(async (ids: string[], ..._r: unknown[]) => {
        order.push('siSo');
        return new Map(
          ids.map((i) => [
            i,
            { si_so: opts.siSo ?? 5, si_so_toi_da: 40, so_cho_duyet: 0 },
          ]),
        );
      }),
    };
    const nhatKy = { ghi: jest.fn(async (_a?: unknown) => undefined) };
    const scope = { cumIdsCuaToi: jest.fn(async () => ['c1']) };
    const svc = new DoiBuoiHocService(
      prisma as never,
      query as never,
      nhatKy as never,
      scope as never,
    );
    return { svc, prisma, tx, query, nhatKy, scope, order, lichMap };
  }

  it('duyet: lock truoc khi doc si so va dem so_truoc', async () => {
    const { svc, tx, order } = setupDuyet();
    await svc.duyet(quanTri, 'x1', {});
    expect(order).toEqual(['lock', 'siSo', 'count']);
    expect(tx.$executeRaw.mock.calls[0][1]).toBe('doi_buoi:ld');
    const where = (tx.doi_buoi_hoc.count.mock.calls[0][0] as { where: any })
      .where;
    expect(where).toMatchObject({
      trang_thai: 'cho_duyet',
      lich_de_nghi_id: 'ld',
      tao_luc: { lt: taoLuc },
      id: { not: 'x1' },
    });
    expect(where.lich_nguon.thoi_gian_bat_dau.gt).toBeInstanceOf(Date);
    expect(where.lich_de_nghi.thoi_gian_bat_dau.gt).toBeInstanceOf(Date);
  });

  it('duyet: ho tro cum + day -> 409 BUOI_DAY, khong cap nhat', async () => {
    const { svc, tx } = setupDuyet({ siSo: 40 });
    await expect(svc.duyet(hoTro, 'x1', {})).rejects.toMatchObject({
      status: 409,
    });
    expect(tx.doi_buoi_hoc.updateMany).not.toHaveBeenCalled();
  });

  it('duyet: ho tro cum + con cho nhung giu cho -> 409', async () => {
    const { svc } = setupDuyet({ siSo: 38, soTruoc: 2 });
    await expect(svc.duyet(hoTro, 'x1', {})).rejects.toMatchObject({
      status: 409,
    });
  });

  it('duyet: quan tri + day -> da_duyet + canh_bao, nhat ky sau commit', async () => {
    const { svc, tx, nhatKy } = setupDuyet({ siSo: 40 });
    const r = await svc.duyet(quanTri, 'x1', { ghi_chu: '  Dong y nhe ' });
    expect(r.trang_thai).toBe('da_duyet');
    expect(r.canh_bao.length).toBeGreaterThan(0);
    expect(tx.doi_buoi_hoc.updateMany).toHaveBeenCalledWith({
      where: { id: 'x1', trang_thai: 'cho_duyet' },
      data: expect.objectContaining({
        trang_thai: 'da_duyet',
        lich_chot_id: 'ld',
        nguoi_xu_ly: 'qt',
        ghi_chu_xu_ly: 'Dong y nhe',
      }),
    });
    expect(nhatKy.ghi).toHaveBeenCalledWith(
      expect.objectContaining({
        hanh_dong: 'duyet_doi_buoi',
        hoc_vien_id: 'hv1',
        chi_tiet: {
          de_nghi_id: 'x1',
          lich_nguon_id: 'ln',
          lich_de_nghi_id: 'ld',
          lich_chot_id: 'ld',
          vuot_si_so: true,
          vuot_thu_tu: false,
        },
      }),
    );
    expect(tx.doi_buoi_hoc.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      nhatKy.ghi.mock.invocationCallOrder[0],
    );
  });

  it('duyet: quan tri vuot thu tu -> vuot_thu_tu trong nhat ky', async () => {
    const { svc, nhatKy } = setupDuyet({ siSo: 38, soTruoc: 2 });
    const r = await svc.duyet(quanTri, 'x1', {});
    expect(r.canh_bao).toHaveLength(1);
    expect(nhatKy.ghi).toHaveBeenCalledWith(
      expect.objectContaining({
        chi_tiet: expect.objectContaining({
          vuot_si_so: false,
          vuot_thu_tu: true,
        }),
      }),
    );
  });

  it('duyet: chot buoi khac -> lock + updateMany theo buoi chot', async () => {
    const { svc, tx, query } = setupDuyet();
    await svc.duyet(quanTri, 'x1', { lich_chot_id: 'lk' });
    expect(tx.$executeRaw.mock.calls[0][1]).toBe('doi_buoi:lk');
    expect(query.siSoBuoi).toHaveBeenCalledWith(['lk'], expect.any(Date), tx);
    expect(tx.doi_buoi_hoc.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lich_chot_id: 'lk' }),
      }),
    );
  });

  it('duyet: updateMany 0 dong -> 409, khong ghi nhat ky', async () => {
    const { svc, nhatKy } = setupDuyet({ capNhat: 0 });
    await expect(svc.duyet(quanTri, 'x1', {})).rejects.toMatchObject({
      status: 409,
    });
    expect(nhatKy.ghi).not.toHaveBeenCalled();
  });

  it('duyet: phan lop da doi -> 409', async () => {
    const { svc } = setupDuyet({ lopPhan: 'lopZ' });
    await expect(svc.duyet(quanTri, 'x1', {})).rejects.toMatchObject({
      status: 409,
    });
  });

  it('duyet: cum khac -> 404, loc theo cum cua toi', async () => {
    const { svc, prisma, tx } = setupDuyet();
    prisma.doi_buoi_hoc.findFirst.mockResolvedValueOnce(null);
    await expect(svc.duyet(hoTro, 'x1', {})).rejects.toMatchObject({
      status: 404,
    });
    expect(prisma.doi_buoi_hoc.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'x1', dang_ky_hoc: { cum_id: { in: ['c1'] } } },
      }),
    );
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('duyet: ho tro khong co cum nao -> 404', async () => {
    const { svc, scope, prisma } = setupDuyet();
    scope.cumIdsCuaToi.mockResolvedValueOnce([]);
    await expect(svc.duyet(hoTro, 'x1', {})).rejects.toMatchObject({
      status: 404,
    });
    expect(prisma.doi_buoi_hoc.findFirst).not.toHaveBeenCalled();
  });

  it('duyet: lop dich ngung (inactive) -> 400', async () => {
    const { svc, lichMap, tx } = setupDuyet();
    const ld = lich('ld', 'lopB');
    ld.lop = { ...ld.lop, trang_thai: 'ngung' };
    lichMap.set('ld', ld);
    await expect(svc.duyet(quanTri, 'x1', {})).rejects.toMatchObject({
      status: 400,
    });
    expect(tx.doi_buoi_hoc.updateMany).not.toHaveBeenCalled();
  });

  it('duyet: ghi chu qua ngan -> 400', async () => {
    const { svc } = setupDuyet();
    await expect(
      svc.duyet(quanTri, 'x1', { ghi_chu: 'abc' }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('tuChoi: ghi chu 3 ky tu -> 400, khong cap nhat', async () => {
    const { svc, prisma } = setupDuyet();
    await expect(
      svc.tuChoi(quanTri, 'x1', { ghi_chu: ' ab c ' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.doi_buoi_hoc.updateMany).not.toHaveBeenCalled();
  });

  it('tuChoi: updateMany co dieu kien cho_duyet + nhat ky', async () => {
    const { svc, prisma, nhatKy } = setupDuyet();
    await expect(svc.tuChoi(quanTri, 'x1', ghiChu)).resolves.toEqual({
      trang_thai: 'tu_choi',
    });
    expect(prisma.doi_buoi_hoc.updateMany).toHaveBeenCalledWith({
      where: { id: 'x1', trang_thai: 'cho_duyet' },
      data: expect.objectContaining({
        trang_thai: 'tu_choi',
        nguoi_xu_ly: 'qt',
        ghi_chu_xu_ly: 'Da trao doi voi hoc vien',
      }),
    });
    expect(nhatKy.ghi).toHaveBeenCalledWith(
      expect.objectContaining({
        hanh_dong: 'duyet_doi_buoi',
        chi_tiet: { de_nghi_id: 'x1', tu_choi: true },
      }),
    );
  });

  it('huyDuyet: buoi da bat dau (doc lai trong tx) -> 400', async () => {
    const { svc, lichMap, prisma, tx, query } = setupDuyet({
      trangThai: 'da_duyet',
      lichChot: 'lk',
    });
    lichMap.set('lk', lich('lk', 'lopC', { thoi_gian_bat_dau: hqua }));
    await expect(svc.huyDuyet(quanTri, 'x1', ghiChu)).rejects.toMatchObject({
      status: 400,
    });
    expect(query.lichTomTat).toHaveBeenCalledWith(['ln', 'lk'], tx);
    expect(prisma.doi_buoi_hoc.updateMany).not.toHaveBeenCalled();
    expect(tx.doi_buoi_hoc.updateMany).not.toHaveBeenCalled();
  });

  it('huyDuyet: thanh cong -> lock buoi nguon truoc si so, updateMany da_duyet trong tx', async () => {
    const { svc, tx, query, nhatKy, order } = setupDuyet({
      trangThai: 'da_duyet',
      lichChot: 'lk',
    });
    await expect(svc.huyDuyet(quanTri, 'x1', ghiChu)).resolves.toEqual({
      trang_thai: 'da_huy',
      canh_bao: [],
    });
    expect(tx.$executeRaw.mock.calls[0][1]).toBe('doi_buoi:ln');
    expect(order.slice(0, 2)).toEqual(['lock', 'siSo']);
    expect(query.siSoBuoi).toHaveBeenCalledWith(['ln'], expect.any(Date), tx);
    expect(tx.doi_buoi_hoc.updateMany).toHaveBeenCalledWith({
      where: { id: 'x1', trang_thai: 'da_duyet' },
      data: expect.objectContaining({
        trang_thai: 'da_huy',
        nguoi_xu_ly: 'qt',
      }),
    });
    expect(nhatKy.ghi).toHaveBeenCalledWith(
      expect.objectContaining({
        chi_tiet: { de_nghi_id: 'x1', huy_duyet: true, vuot_si_so: false },
      }),
    );
    expect(tx.doi_buoi_hoc.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      nhatKy.ghi.mock.invocationCallOrder[0],
    );
  });

  it('huyDuyet: ho tro cum + buoi goc da du -> 409, khong cap nhat', async () => {
    const { svc, tx, nhatKy } = setupDuyet({
      trangThai: 'da_duyet',
      lichChot: 'lk',
      siSo: 40,
    });
    await expect(svc.huyDuyet(hoTro, 'x1', ghiChu)).rejects.toMatchObject({
      status: 409,
      response: {
        error: expect.objectContaining({
          message: 'Buổi gốc đã đủ sĩ số 40/40 — không thể hủy duyệt',
        }),
      },
    });
    expect(tx.doi_buoi_hoc.updateMany).not.toHaveBeenCalled();
    expect(nhatKy.ghi).not.toHaveBeenCalled();
  });

  it('huyDuyet: quan tri + buoi goc da du -> van huy, canh_bao + vuot_si_so', async () => {
    const { svc, tx, nhatKy } = setupDuyet({
      trangThai: 'da_duyet',
      lichChot: 'lk',
      siSo: 40,
    });
    const r = await svc.huyDuyet(quanTri, 'x1', ghiChu);
    expect(r.trang_thai).toBe('da_huy');
    expect(r.canh_bao).toHaveLength(1);
    expect(tx.doi_buoi_hoc.updateMany).toHaveBeenCalled();
    expect(nhatKy.ghi).toHaveBeenCalledWith(
      expect.objectContaining({
        chi_tiet: { de_nghi_id: 'x1', huy_duyet: true, vuot_si_so: true },
      }),
    );
  });

  it('huyDuyet: phan lop da doi -> khong ve buoi nguon, khong chan theo si so', async () => {
    const { svc, query } = setupDuyet({
      trangThai: 'da_duyet',
      lichChot: 'lk',
      siSo: 40,
      lopPhan: 'lopZ',
    });
    await expect(svc.huyDuyet(hoTro, 'x1', ghiChu)).resolves.toEqual({
      trang_thai: 'da_huy',
      canh_bao: [],
    });
    expect(query.siSoBuoi).not.toHaveBeenCalled();
  });

  it('huyDuyet: updateMany 0 dong -> 409', async () => {
    const { svc, nhatKy } = setupDuyet({
      trangThai: 'da_duyet',
      lichChot: 'lk',
      capNhat: 0,
    });
    await expect(svc.huyDuyet(quanTri, 'x1', ghiChu)).rejects.toMatchObject({
      status: 409,
    });
    expect(nhatKy.ghi).not.toHaveBeenCalled();
  });

  it('huyDuyet: chua duyet -> 409', async () => {
    const { svc } = setupDuyet();
    await expect(svc.huyDuyet(quanTri, 'x1', ghiChu)).rejects.toMatchObject({
      status: 409,
    });
  });

  it('demChoDuyet: khong dem qua han, loc theo cum', async () => {
    const { svc, prisma } = setupDuyet();
    await expect(svc.demChoDuyet(hoTro)).resolves.toBe(3);
    const where = (prisma.doi_buoi_hoc.count.mock.calls[0][0] as { where: any })
      .where;
    expect(where).toMatchObject({
      trang_thai: 'cho_duyet',
      dang_ky_hoc: { cum_id: { in: ['c1'] } },
    });
    expect(where.lich_nguon.thoi_gian_bat_dau.gt).toBeInstanceOf(Date);
    expect(where.lich_de_nghi.thoi_gian_bat_dau.gt).toBeInstanceOf(Date);
  });

  it('demChoDuyet: ho tro khong co cum -> 0', async () => {
    const { svc, scope, prisma } = setupDuyet();
    scope.cumIdsCuaToi.mockResolvedValueOnce([]);
    await expect(svc.demChoDuyet(hoTro)).resolves.toBe(0);
    expect(prisma.doi_buoi_hoc.count).not.toHaveBeenCalled();
  });

  it('danhSach: quan tri loc khoa + trang thai, gan hoc vien va si so', async () => {
    const { svc, prisma, query } = setupDuyet();
    prisma.doi_buoi_hoc.findMany.mockResolvedValueOnce([
      {
        id: 'x1',
        trang_thai: 'cho_duyet',
        lich_nguon_id: 'ln',
        lich_de_nghi_id: 'ld',
        lich_chot_id: null,
        ly_do: 'abcde',
        tao_luc: taoLuc,
        ghi_chu_xu_ly: null,
        dang_ky_hoc: {
          hoc_vien: {
            id: 'hv1',
            ho_ten: 'A',
            don_vi_cong_tac: { ten_don_vi: 'Truong X' },
          },
          cum: { ten_cum: 'Cum 1' },
        },
        xu_ly_boi: null,
      },
    ]);
    const r = await svc.danhSach(quanTri, {
      trang_thai: 'cho_duyet',
      khoa_id: 'k1',
    });
    const arg = prisma.doi_buoi_hoc.findMany.mock.calls[0][0] as any;
    expect(arg.where).toMatchObject({
      trang_thai: 'cho_duyet',
      dang_ky_hoc: { khoa_id: 'k1' },
    });
    // Mac dinh chi de nghi con han: ca buoi nguon lan buoi de nghi chua bat dau.
    expect(arg.where.lich_nguon.thoi_gian_bat_dau.gt).toBeInstanceOf(Date);
    expect(arg.where.lich_de_nghi.thoi_gian_bat_dau.gt).toBeInstanceOf(Date);
    expect(arg.where.OR).toBeUndefined();
    expect(arg.orderBy).toEqual({ tao_luc: 'asc' });
    expect(arg.take).toBe(500);
    expect(query.siSoBuoi).toHaveBeenCalledTimes(1);
    expect(r[0]).toMatchObject({
      id: 'x1',
      hoc_vien: { id: 'hv1', ho_ten: 'A', don_vi: 'Truong X', cum: 'Cum 1' },
      buoi_nguon: { id: 'ln', buoi_so: 3, lop: { ten_lop: 'lopA' } },
      buoi_de_nghi: { id: 'ld', lop: { ten_lop: 'lopB' } },
      buoi_chot: null,
      si_so: 5,
      si_so_toi_da: 40,
      nguoi_xu_ly: null,
    });
  });

  it('danhSach: ho tro loc cum; trang thai khac sap xu_ly_luc giam', async () => {
    const { svc, prisma } = setupDuyet();
    await svc.danhSach(hoTro, { trang_thai: 'da_duyet' });
    const arg = prisma.doi_buoi_hoc.findMany.mock.calls[0][0] as any;
    expect(arg.where).toEqual({
      trang_thai: 'da_duyet',
      dang_ky_hoc: { cum_id: { in: ['c1'] } },
    });
    expect(arg.orderBy).toEqual({ xu_ly_luc: 'desc' });
  });

  it('danhSach: da_xu_ly -> 3 trang thai da xu ly, xu_ly_luc giam, van gioi han cum + 500', async () => {
    const { svc, prisma } = setupDuyet();
    await svc.danhSach(hoTro, { da_xu_ly: true });
    const arg = prisma.doi_buoi_hoc.findMany.mock.calls[0][0] as any;
    expect(arg.where).toEqual({
      trang_thai: { in: ['da_duyet', 'tu_choi', 'da_huy'] },
      dang_ky_hoc: { cum_id: { in: ['c1'] } },
    });
    expect(arg.orderBy).toEqual({ xu_ly_luc: 'desc' });
    expect(arg.take).toBe(500);
  });

  it('danhSach: cho_duyet qua_han=true -> chi qua han, moi nhat truoc, 100', async () => {
    const { svc, prisma } = setupDuyet();
    await svc.danhSach(hoTro, { trang_thai: 'cho_duyet', qua_han: true });
    const arg = prisma.doi_buoi_hoc.findMany.mock.calls[0][0] as any;
    expect(arg.where).toMatchObject({
      trang_thai: 'cho_duyet',
      dang_ky_hoc: { cum_id: { in: ['c1'] } },
    });
    expect(arg.where.OR).toHaveLength(2);
    expect(arg.where.OR[0].lich_nguon.thoi_gian_bat_dau.lte).toBeInstanceOf(
      Date,
    );
    expect(arg.where.OR[1].lich_de_nghi.thoi_gian_bat_dau.lte).toBeInstanceOf(
      Date,
    );
    expect(arg.where.lich_nguon).toBeUndefined();
    expect(arg.orderBy).toEqual({ tao_luc: 'desc' });
    expect(arg.take).toBe(100);
  });

  it('danhSach: qua_han bi bo qua khi khong phai cho_duyet', async () => {
    const { svc, prisma } = setupDuyet();
    await svc.danhSach(hoTro, { da_xu_ly: true, qua_han: true });
    const arg = prisma.doi_buoi_hoc.findMany.mock.calls[0][0] as any;
    expect(arg.where.OR).toBeUndefined();
    expect(arg.take).toBe(500);
  });

  it('danhSach: ho tro khong co cum -> []', async () => {
    const { svc, scope, prisma } = setupDuyet();
    scope.cumIdsCuaToi.mockResolvedValueOnce([]);
    await expect(svc.danhSach(hoTro, {})).resolves.toEqual([]);
    expect(prisma.doi_buoi_hoc.findMany).not.toHaveBeenCalled();
  });

  it('luaChonDuyet: so_truoc bang 1 groupBy, duyet_duoc theo cho', async () => {
    const { svc, prisma, query } = setupDuyet();
    prisma.lich_hoc_lop.findMany.mockResolvedValueOnce([
      lich('ld', 'lopB'),
      lich('lk', 'lopC'),
    ]);
    query.siSoBuoi.mockResolvedValueOnce(
      new Map([
        ['ld', { si_so: 38, si_so_toi_da: 40, so_cho_duyet: 3 }],
        ['lk', { si_so: 10, si_so_toi_da: 40, so_cho_duyet: 0 }],
      ]),
    );
    prisma.doi_buoi_hoc.groupBy.mockResolvedValueOnce([
      { lich_de_nghi_id: 'ld', _count: { _all: 2 } },
    ]);
    const r = await svc.luaChonDuyet(quanTri, 'x1');
    expect(prisma.doi_buoi_hoc.groupBy).toHaveBeenCalledTimes(1);
    const where = (
      prisma.doi_buoi_hoc.groupBy.mock.calls[0][0] as { where: any }
    ).where;
    expect(where).toMatchObject({
      trang_thai: 'cho_duyet',
      lich_de_nghi_id: { in: ['ld', 'lk'] },
      tao_luc: { lt: taoLuc },
      id: { not: 'x1' },
    });
    expect(r.map((x) => [x.lich.id, x.so_truoc, x.duyet_duoc])).toEqual([
      ['ld', 2, false],
      ['lk', 0, true],
    ]);
  });
});
