import { Prisma } from '@prisma/client';
import {
  DoiBuoiHocService,
  GHI_CHU_THAY_THE,
  lyDoHuy,
} from './doi-buoi-hoc.service';
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
    // DB: thoi_gian_ket_thuc NOT NULL (cần cho cảnh báo trùng lịch).
    thoi_gian_ket_thuc: new Date(ngayMai.getTime() + 3_600_000),
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
  opts: {
    soBuoi?: number;
    luot?: number;
    capNhat?: number;
    hoatDong?: { lich_nguon_id: string; trang_thai: string; lich_chot_id: string | null }[];
  } = {},
) {
  const order: string[] = [];
  // Mặc định: `luot` đề nghị hoạt động ở các buổi nguồn KHÁC buổi đang gửi.
  const hoatDong =
    opts.hoatDong ??
    Array.from({ length: opts.luot ?? 0 }, (_v, i) => ({
      lich_nguon_id: `khac${i}`,
      trang_thai: 'da_duyet',
      lich_chot_id: `chot${i}`,
    }));
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
      findMany: jest.fn(async (_a?: unknown) => {
        order.push('luot');
        return hoatDong;
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
          ['lc', lich('lc', 'lopC')],
        ]),
    ),
    siSoBuoi: jest.fn(
      async () =>
        new Map([
          ['ld', { si_so: 5, si_so_toi_da: 40, so_cho_duyet: 0 }],
          ['lc', { si_so: 5, si_so_toi_da: 40, so_cho_duyet: 0 }],
        ]),
    ),
    doiBuoiDaDuyetCuaDangKy: jest.fn(
      async (_ids: string[]) =>
        [] as { dang_ky_hoc_id: string; lich_nguon_id: string; lich_chot_id: string }[],
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
      tx.doi_buoi_hoc.findMany.mock.invocationCallOrder[0],
    );
    expect(tx.doi_buoi_hoc.findMany).toHaveBeenCalledWith({
      where: {
        dang_ky_hoc_id: 'dk1',
        trang_thai: { in: ['cho_duyet', 'da_duyet'] },
      },
      select: { lich_nguon_id: true, trang_thai: true, lich_chot_id: true },
    });
  });

  it('gui: luot dem theo buoi nguon khac nhau (2 dong cung nguon = 1 luot)', async () => {
    const { svc, tx } = setup({
      soBuoi: 2,
      hoatDong: [
        { lich_nguon_id: 'n1', trang_thai: 'da_duyet', lich_chot_id: 'c1' },
        { lich_nguon_id: 'n1', trang_thai: 'cho_duyet', lich_chot_id: null },
      ],
    });
    await expect(svc.gui(user, dto)).resolves.toEqual({ id: 'moi' });
    expect(tx.doi_buoi_hoc.create).toHaveBeenCalledTimes(1);
  });

  it('gui doi lai: da co da_duyet cung buoi nguon -> tao, khong ton them luot', async () => {
    // Đã dùng hết 1/1 lượt chính bằng bản đã duyệt của buổi nguồn này.
    const { svc, tx, query } = setup({
      soBuoi: 1,
      hoatDong: [
        { lich_nguon_id: 'ln', trang_thai: 'da_duyet', lich_chot_id: 'lc' },
      ],
    });
    await expect(svc.gui(user, dto)).resolves.toEqual({ id: 'moi' });
    expect(query.lichTomTat).toHaveBeenCalledWith(['lc'], tx);
    expect(tx.doi_buoi_hoc.create).toHaveBeenCalledTimes(1);
  });

  it('gui doi lai: buoi dich trung buoi chot hien tai -> 400 TRUNG_BUOI_CHOT', async () => {
    const { svc, tx } = setup({
      hoatDong: [
        { lich_nguon_id: 'ln', trang_thai: 'da_duyet', lich_chot_id: 'lc' },
      ],
    });
    await expect(
      svc.gui(user, { ...dto, lich_de_nghi_id: 'lc' }),
    ).rejects.toMatchObject({
      status: 400,
      response: {
        error: expect.objectContaining({
          message: 'Thầy/Cô đang học buổi này rồi',
        }),
      },
    });
    expect(tx.doi_buoi_hoc.create).not.toHaveBeenCalled();
  });

  it('gui doi lai: buoi chot hien tai da bat dau -> 400, khong tao', async () => {
    const { svc, tx, query } = setup({
      hoatDong: [
        { lich_nguon_id: 'ln', trang_thai: 'da_duyet', lich_chot_id: 'lq' },
      ],
    });
    (query.lichTomTat as jest.Mock).mockImplementation(async (ids: unknown) =>
      (ids as string[])[0] === 'lq'
        ? new Map([['lq', lich('lq', 'lopC', { thoi_gian_bat_dau: hqua })]])
        : new Map([
            ['ln', lich('ln', 'lopA')],
            ['ld', lich('ld', 'lopB')],
          ]),
    );
    await expect(svc.gui(user, dto)).rejects.toMatchObject({ status: 400 });
    expect(tx.doi_buoi_hoc.create).not.toHaveBeenCalled();
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
      data: {
        trang_thai: 'da_huy',
        xu_ly_luc: expect.any(Date),
        ghi_chu_xu_ly: 'Học viên đã sửa (thay bằng đề nghị mới)',
      },
    });
  });

  it('sua: lock -> huy ban cu -> dem luot -> tao; luot khong tang', async () => {
    const { svc, tx, order } = setup({ soBuoi: 1, luot: 0 });
    await expect(svc.sua(user, 'x1', dto)).resolves.toEqual({ id: 'moi' });
    expect(order).toEqual(['lock', 'updateMany', 'luot']);
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
      data: {
        trang_thai: 'da_huy',
        xu_ly_luc: expect.any(Date),
        ghi_chu_xu_ly: 'Học viên tự hủy',
      },
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

  it('lua-chon: buoi nguon da co da_duyet -> loai buoi chot hien tai', async () => {
    const { svc, prisma } = setupDoc();
    prisma.doi_buoi_hoc.findFirst.mockResolvedValueOnce({
      lich_chot_id: 'ld',
    } as never);
    const r = await svc.luaChonHocVien(user, 'ln');
    expect(r.map((x) => x.lich.id)).toEqual(['lfull']);
    expect(prisma.doi_buoi_hoc.findFirst).toHaveBeenCalledWith({
      where: { dang_ky_hoc_id: 'dk1', lich_nguon_id: 'ln', trang_thai: 'da_duyet' },
      select: { lich_chot_id: true },
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

  it('tong quan doi lai: buoi dang hoc da bat dau -> de nghi cho la qua han', async () => {
    const s = setupDoc();
    const row = (id: string, trang_thai: string, over: object = {}) => ({
      id,
      trang_thai,
      dang_ky_hoc_id: 'dk1',
      lich_nguon_id: 'ln',
      lich_de_nghi_id: 'ld',
      lich_chot_id: null,
      ly_do: 'abcde',
      tao_luc: new Date(Date.now() - 5000),
      ghi_chu_xu_ly: null,
      nguoi_xu_ly: null,
      ...over,
    });
    (s.prisma.doi_buoi_hoc as Record<string, unknown>).findMany = jest
      .fn()
      .mockResolvedValueOnce([
        row('moi', 'cho_duyet'),
        row('cu', 'da_duyet', { lich_chot_id: 'lq' }),
      ])
      .mockResolvedValueOnce([]);
    s.query.lichTomTat.mockResolvedValue(
      new Map([
        ['ln', lich('ln', 'lopA')],
        ['ld', lich('ld', 'lopB')],
        ['lq', lich('lq', 'lopC', { thoi_gian_bat_dau: hqua })],
      ]),
    );
    const r = await s.svc.tongQuanHocVien(user, 'k1');
    expect(r.de_nghi.find((d) => d.id === 'moi')).toMatchObject({
      qua_han: true,
      thu_tu_hang: null,
    });
  });

  it('tong quan doi lai: 1 luot, de_nghi = ban da duyet, de_nghi_doi_lai + doi_lai_tu', async () => {
    const s = setupDoc();
    const t0 = new Date(Date.now() - 5000);
    const row = (id: string, trang_thai: string, over: object = {}) => ({
      id,
      trang_thai,
      dang_ky_hoc_id: 'dk1',
      lich_nguon_id: 'ln',
      lich_de_nghi_id: 'ld',
      lich_chot_id: null,
      ly_do: 'abcde',
      tao_luc: t0,
      ghi_chu_xu_ly: null,
      nguoi_xu_ly: null,
      ...over,
    });
    (s.prisma.doi_buoi_hoc as Record<string, unknown>).findMany = jest
      .fn()
      .mockResolvedValueOnce([
        row('moi', 'cho_duyet', { lich_de_nghi_id: 'lfull' }),
        row('cu', 'da_duyet', { lich_chot_id: 'ld' }),
      ])
      .mockResolvedValueOnce([]);
    s.query.lichTomTat.mockResolvedValue(
      new Map([
        ['ln', lich('ln', 'lopA')],
        ['ld', lich('ld', 'lopB')],
        ['lfull', lich('lfull', 'lopD')],
      ]),
    );
    const r = await s.svc.tongQuanHocVien(user, 'k1');
    expect(r.so_luot_da_dung).toBe(1);
    const moi = r.de_nghi.find((d) => d.id === 'moi');
    const cu = r.de_nghi.find((d) => d.id === 'cu');
    expect(moi?.doi_lai_tu).toMatchObject({ id: 'ld', lop: { ten_lop: 'lopB' } });
    expect(cu?.doi_lai_tu).toBeNull();
    const b = r.buoi_sap_toi.find((x) => x.lich_nguon.id === 'ln');
    expect(b?.de_nghi?.id).toBe('cu');
    expect(b?.de_nghi_doi_lai?.id).toBe('moi');
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
      $queryRaw: jest.fn(async (..._a: unknown[]) => [] as { id: string }[]),
      doi_buoi_hoc: {
        findUnique: jest.fn(async () => deNghi),
        findFirst: jest.fn(
          async (_a?: unknown) =>
            null as { id: string; lich_chot_id: string | null } | null,
        ),
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
      $queryRaw: jest.fn(async (..._a: unknown[]) => [] as { id: string }[]),
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
      phan_lop_giai_doan: { findMany: jest.fn(async (_a?: unknown) => [] as unknown[]) },
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
      doiBuoiDaDuyetCuaDangKy: jest.fn(
        async (_ids: string[]) =>
          [] as { dang_ky_hoc_id: string; lich_nguon_id: string; lich_chot_id: string }[],
      ),
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

  describe('duyet doi lai', () => {
    function setupDoiLai() {
      const s = setupDuyet();
      s.tx.doi_buoi_hoc.findFirst.mockResolvedValue({
        id: 'cu',
        lich_chot_id: 'lc',
      });
      s.lichMap.set('lc', lich('lc', 'lopC'));
      s.tx.doi_buoi_hoc.updateMany.mockImplementation(async (a?: unknown) => {
        const w = (a as { where: { trang_thai: string } }).where;
        s.order.push(w.trang_thai === 'da_duyet' ? 'ha_ban_cu' : 'nang_ban_moi');
        return { count: 1 };
      });
      return s;
    }

    it('lock -> ... -> ha ban cu TRUOC -> nang ban moi; nhat ky co thay_the_id', async () => {
      const { svc, tx, order, query, nhatKy } = setupDoiLai();
      await expect(svc.duyet(quanTri, 'x1', {})).resolves.toMatchObject({
        trang_thai: 'da_duyet',
      });
      expect(order).toEqual([
        'lock',
        'siSo',
        'count',
        'ha_ban_cu',
        'nang_ban_moi',
      ]);
      expect(tx.doi_buoi_hoc.findFirst).toHaveBeenCalledWith({
        where: {
          dang_ky_hoc_id: 'dk1',
          lich_nguon_id: 'ln',
          trang_thai: 'da_duyet',
          id: { not: 'x1' },
        },
        select: { id: true, lich_chot_id: true },
      });
      expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
        tx.doi_buoi_hoc.findFirst.mock.invocationCallOrder[0],
      );
      expect(query.lichTomTat).toHaveBeenCalledWith(['ln', 'ld', 'lc'], tx);
      expect(tx.doi_buoi_hoc.updateMany).toHaveBeenNthCalledWith(1, {
        where: {
          dang_ky_hoc_id: 'dk1',
          lich_nguon_id: 'ln',
          trang_thai: 'da_duyet',
          id: { not: 'x1' },
        },
        data: {
          trang_thai: 'da_huy',
          xu_ly_luc: expect.any(Date),
          ghi_chu_xu_ly: 'Đã thay bằng đề nghị đổi lại',
          nguoi_xu_ly: null,
        },
      });
      expect(tx.doi_buoi_hoc.updateMany).toHaveBeenNthCalledWith(2, {
        where: { id: 'x1', trang_thai: 'cho_duyet' },
        data: expect.objectContaining({
          trang_thai: 'da_duyet',
          lich_chot_id: 'ld',
        }),
      });
      expect(nhatKy.ghi).toHaveBeenCalledWith(
        expect.objectContaining({
          chi_tiet: expect.objectContaining({ thay_the_id: 'cu' }),
        }),
      );
    });

    it('ban moi updateMany 0 dong -> 409 (rollback ca ban cu), khong ghi nhat ky', async () => {
      const { svc, tx, nhatKy, order } = setupDoiLai();
      tx.doi_buoi_hoc.updateMany.mockImplementation(async (a?: unknown) => {
        const w = (a as { where: { trang_thai: string } }).where;
        order.push(w.trang_thai);
        return { count: w.trang_thai === 'da_duyet' ? 1 : 0 };
      });
      await expect(svc.duyet(quanTri, 'x1', {})).rejects.toMatchObject({
        status: 409,
      });
      expect(order.slice(-2)).toEqual(['da_duyet', 'cho_duyet']);
      expect(nhatKy.ghi).not.toHaveBeenCalled();
    });

    it('chot dung buoi dang hoc -> 400 TRUNG_BUOI_CHOT, khong cap nhat', async () => {
      const { svc, tx } = setupDoiLai();
      await expect(
        svc.duyet(quanTri, 'x1', { lich_chot_id: 'lc' }),
      ).rejects.toMatchObject({ status: 400 });
      expect(tx.doi_buoi_hoc.updateMany).not.toHaveBeenCalled();
    });

    it('buoi dang hoc da bat dau -> 400, khong cap nhat', async () => {
      const { svc, tx, lichMap } = setupDoiLai();
      lichMap.set('lc', lich('lc', 'lopC', { thoi_gian_bat_dau: hqua }));
      await expect(svc.duyet(quanTri, 'x1', {})).rejects.toMatchObject({
        status: 400,
      });
      expect(tx.doi_buoi_hoc.updateMany).not.toHaveBeenCalled();
    });

    it('khong co ban da duyet -> chi 1 updateMany (de nghi thuong)', async () => {
      const { svc, tx, nhatKy } = setupDuyet();
      await svc.duyet(quanTri, 'x1', {});
      expect(tx.doi_buoi_hoc.updateMany).toHaveBeenCalledTimes(1);
      expect(
        (nhatKy.ghi.mock.calls[0][0] as { chi_tiet: object }).chi_tiet,
      ).not.toHaveProperty('thay_the_id');
    });
  });

  it('duyet: P2002 trong giao dich -> 409 Đề nghị đã được xử lý (khong 500)', async () => {
    const { svc, tx, nhatKy } = setupDuyet();
    tx.doi_buoi_hoc.updateMany.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'x',
      }),
    );
    await expect(svc.duyet(quanTri, 'x1', {})).rejects.toMatchObject({
      status: 409,
      response: {
        error: expect.objectContaining({ message: 'Đề nghị đã được xử lý' }),
      },
    });
    expect(nhatKy.ghi).not.toHaveBeenCalled();
  });

  it('duyet: so_truoc khong tinh doi lai qua han (buoi dang hoc da bat dau)', async () => {
    const { svc, tx } = setupDuyet();
    tx.$queryRaw.mockResolvedValueOnce([{ id: 'q1' }]);
    await svc.duyet(quanTri, 'x1', {});
    const where = (tx.doi_buoi_hoc.count.mock.calls[0][0] as { where: any })
      .where;
    expect(where.id).toEqual({ not: 'x1', notIn: ['q1'] });
  });

  it('tuChoi doi lai: chi cap nhat de nghi moi, ban cu giu nguyen', async () => {
    const { svc, prisma, tx } = setupDuyet();
    await svc.tuChoi(quanTri, 'x1', ghiChu);
    expect(prisma.doi_buoi_hoc.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.doi_buoi_hoc.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'x1', trang_thai: 'cho_duyet' } }),
    );
    expect(tx.doi_buoi_hoc.updateMany).not.toHaveBeenCalled();
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

  it('demChoDuyet: loai doi lai qua han (buoi dang hoc da bat dau)', async () => {
    const { svc, prisma } = setupDuyet();
    prisma.$queryRaw.mockResolvedValueOnce([{ id: 'q1' }]);
    await svc.demChoDuyet(quanTri);
    const where = (prisma.doi_buoi_hoc.count.mock.calls[0][0] as { where: any })
      .where;
    expect(where.id).toEqual({ notIn: ['q1'] });
  });

  it('danhSach cho_duyet: doi lai qua han bi loai khoi danh sach chinh, vao danh sach qua han', async () => {
    const { svc, prisma } = setupDuyet();
    prisma.$queryRaw.mockResolvedValue([{ id: 'q1' }]);
    await svc.danhSach(hoTro, { trang_thai: 'cho_duyet' });
    await svc.danhSach(hoTro, { trang_thai: 'cho_duyet', qua_han: true });
    const [chinh, quaHan] = prisma.doi_buoi_hoc.findMany.mock.calls.map(
      (c) => (c[0] as any).where,
    );
    expect(chinh.id).toEqual({ notIn: ['q1'] });
    expect(quaHan.OR).toHaveLength(3);
    expect(quaHan.OR[2]).toEqual({ id: { in: ['q1'] } });
  });

  it('danhSach da_xu_ly: khong truy van doi lai qua han', async () => {
    const { svc, prisma } = setupDuyet();
    await svc.danhSach(hoTro, { da_xu_ly: true });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
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
    expect(arg.orderBy).toEqual({ xu_ly_luc: { sort: 'desc', nulls: 'last' } });
  });

  it('danhSach: da_xu_ly -> 3 trang thai da xu ly, xu_ly_luc giam, van gioi han cum + 500', async () => {
    const { svc, prisma } = setupDuyet();
    await svc.danhSach(hoTro, { da_xu_ly: true });
    const arg = prisma.doi_buoi_hoc.findMany.mock.calls[0][0] as any;
    expect(arg.where).toEqual({
      trang_thai: { in: ['da_duyet', 'tu_choi', 'da_huy'] },
      dang_ky_hoc: { cum_id: { in: ['c1'] } },
    });
    expect(arg.orderBy).toEqual({ xu_ly_luc: { sort: 'desc', nulls: 'last' } });
    expect(arg.take).toBe(500);
  });

  it('danhSach: ly_do_huy phan biet hoc vien sua / tu huy / huy duyet', async () => {
    const { svc, prisma } = setupDuyet();
    const dong = (id: string, ghiChu: string | null, nguoi: string | null, trangThai = 'da_huy') => ({
      id,
      trang_thai: trangThai,
      lich_nguon_id: 'ln',
      lich_de_nghi_id: 'ld',
      lich_chot_id: null,
      ly_do: 'abcde',
      tao_luc: taoLuc,
      ghi_chu_xu_ly: ghiChu,
      nguoi_xu_ly: nguoi ? 'nd1' : null,
      dang_ky_hoc: {
        hoc_vien: { id: 'hv1', ho_ten: 'A', don_vi_cong_tac: { ten_don_vi: 'X' } },
        cum: null,
      },
      xu_ly_boi: nguoi ? { ho_ten: nguoi } : null,
    });
    prisma.doi_buoi_hoc.findMany.mockResolvedValueOnce([
      dong('s', 'Học viên đã sửa (thay bằng đề nghị mới)', null),
      dong('h', 'Học viên tự hủy', null),
      dong('cu', null, null),
      dong('d', 'Học viên xin ở lại', 'Cán bộ B'),
      dong('t', 'Không phù hợp', 'Cán bộ B', 'tu_choi'),
      dong('th', 'Đã thay bằng đề nghị đổi lại', null),
    ]);
    const r = await svc.danhSach(quanTri, { da_xu_ly: true });
    expect(r.map((x) => [x.id, x.ly_do_huy])).toEqual([
      ['s', 'hoc_vien_sua'],
      ['h', 'hoc_vien_huy'],
      ['cu', 'hoc_vien_huy'],
      ['d', 'huy_duyet'],
      ['t', null],
      ['th', 'thay_the'],
    ]);
    expect(r.every((x) => x.doi_lai_tu === null)).toBe(true);
  });

  it('danhSach: doi_lai_tu bang 1 truy van gop (khong N+1)', async () => {
    const { svc, prisma } = setupDuyet();
    const dong = (id: string, dk: string) => ({
      id,
      trang_thai: 'cho_duyet',
      dang_ky_hoc_id: dk,
      lich_nguon_id: 'ln',
      lich_de_nghi_id: 'ld',
      lich_chot_id: null,
      ly_do: 'abcde',
      tao_luc: taoLuc,
      ghi_chu_xu_ly: null,
      nguoi_xu_ly: null,
      dang_ky_hoc: {
        hoc_vien: { id: dk, ho_ten: 'A', don_vi_cong_tac: { ten_don_vi: 'X' } },
        cum: null,
      },
      xu_ly_boi: null,
    });
    prisma.doi_buoi_hoc.findMany
      .mockResolvedValueOnce([dong('x1', 'dk1'), dong('x2', 'dk2')])
      .mockResolvedValueOnce([
        { dang_ky_hoc_id: 'dk1', lich_nguon_id: 'ln', lich_chot_id: 'lk' },
      ]);
    const r = await svc.danhSach(quanTri, { trang_thai: 'cho_duyet' });
    const truyVanDaDuyet = prisma.doi_buoi_hoc.findMany.mock.calls.filter(
      (c) => (c[0] as any).where.trang_thai === 'da_duyet',
    );
    expect(truyVanDaDuyet).toHaveLength(1);
    expect((truyVanDaDuyet[0][0] as any).where).toEqual({
      trang_thai: 'da_duyet',
      OR: [
        { dang_ky_hoc_id: 'dk1', lich_nguon_id: 'ln' },
        { dang_ky_hoc_id: 'dk2', lich_nguon_id: 'ln' },
      ],
    });
    expect(r.find((x) => x.id === 'x1')?.doi_lai_tu).toMatchObject({
      id: 'lk',
      lop: { ten_lop: 'lopC' },
    });
    expect(r.find((x) => x.id === 'x2')?.doi_lai_tu).toBeNull();
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

  it('luaChonDuyet doi lai: loai buoi hoc vien dang hoc (chot cua ban da duyet)', async () => {
    const { svc, prisma } = setupDuyet();
    prisma.lich_hoc_lop.findMany.mockResolvedValueOnce([
      lich('ld', 'lopB'),
      lich('lk', 'lopC'),
    ]);
    prisma.doi_buoi_hoc.findFirst
      .mockResolvedValueOnce({
        id: 'x1',
        trang_thai: 'cho_duyet',
        dang_ky_hoc_id: 'dk1',
        lich_nguon_id: 'ln',
        lich_de_nghi_id: 'ld',
        lich_chot_id: null,
        tao_luc: taoLuc,
        dang_ky_hoc: { hoc_vien_id: 'hv1' },
      })
      .mockResolvedValueOnce({ lich_chot_id: 'lk' });
    const r = await svc.luaChonDuyet(quanTri, 'x1');
    expect(r.map((x) => x.lich.id)).toEqual(['ld']);
  });
});

describe('lyDoHuy', () => {
  it('thay_the chi khi ghi chu he thong va khong co nguoi xu ly', () => {
    expect(
      lyDoHuy({ trang_thai: 'da_huy', nguoi_xu_ly: null, ghi_chu_xu_ly: GHI_CHU_THAY_THE }),
    ).toBe('thay_the');
    expect(
      lyDoHuy({ trang_thai: 'da_huy', nguoi_xu_ly: 'nd1', ghi_chu_xu_ly: GHI_CHU_THAY_THE }),
    ).toBe('huy_duyet');
  });
});

describe('DoiBuoiHocService trung lich', () => {
  const T0 = new Date(Date.now() + 3 * 86_400_000).getTime();
  const h = (n: number) => new Date(T0 + n * 3_600_000);
  const gio = (
    id: string,
    lopId: string,
    bd: number,
    kt: number,
    over: Partial<LichTomTat> = {},
  ) =>
    lich(id, lopId, {
      thoi_gian_bat_dau: h(bd),
      thoi_gian_ket_thuc: h(kt),
      ...over,
    });
  const lt = (l: LichTomTat) => ({
    id: l.id,
    buoi_so: l.buoi_so,
    thoi_gian_bat_dau: l.thoi_gian_bat_dau,
    thoi_gian_ket_thuc: l.thoi_gian_ket_thuc,
    lop: { ten_lop: l.lop.ten_lop },
  });

  // Lịch thực tế của dk1: lớp lopA (gd1) + lớp lopE (gd2).
  //   ln  (gd1 buổi 3) 08–12  = buổi nguồn → luôn bỏ qua
  //   a4  (gd1 buổi 4) 13–17  → trùng ứng viên lfull (14–18)
  //   e1  (gd2 buổi 1) 08–10  → đã đổi (da_duyet) sang e1x 15–16 → dùng giờ e1x
  const ln = gio('ln', 'lopA', 8, 12);
  const a4 = gio('a4', 'lopA', 13, 17, { buoi_so: 4 });
  const e1 = gio('e1', 'lopE', 8, 10, { giai_doan_id: 'gd2', buoi_so: 1 });
  const e1x = gio('e1x', 'lopF', 15, 16, { giai_doan_id: 'gd2', buoi_so: 1 });
  const ld = gio('ld', 'lopB', 8, 12);
  const lfull = gio('lfull', 'lopD', 14, 18);

  function setupTrung() {
    const s = setup();
    const p = s.prisma as Record<string, any>;
    p.phan_lop_giai_doan = {
      findFirst: jest.fn(async () => ({ lop_id: 'lopA' })),
      findMany: jest.fn(async (_a?: unknown) => [
        { dang_ky_hoc_id: 'dk1', giai_doan_id: 'gd1', lop_id: 'lopA' },
        { dang_ky_hoc_id: 'dk1', giai_doan_id: 'gd2', lop_id: 'lopE' },
      ]),
    };
    // Ứng viên có where.buoi_so; lịch thực tế có where.OR.
    p.lich_hoc_lop = {
      findMany: jest.fn(async (a: { where: { OR?: unknown } }) =>
        a.where.OR ? [ln, a4, e1, e1x] : [ld, lfull],
      ),
    };
    s.query.lichTomTat.mockResolvedValue(new Map([['ln', ln]]));
    s.query.doiBuoiDaDuyetCuaDangKy.mockResolvedValue([
      { dang_ky_hoc_id: 'dk1', lich_nguon_id: 'e1', lich_chot_id: 'e1x' },
    ]);
    return { ...s, p };
  }

  it('luaChonHocVien: trung_lich bo buoi nguon, buoi da doi dung gio buoi chot, so truy van co dinh', async () => {
    const { svc, p, query } = setupTrung();
    const r = await svc.luaChonHocVien(user, 'ln');
    expect(r.map((x) => [x.lich.id, x.trung_lich.map((b) => b.id)])).toEqual([
      ['ld', []],
      ['lfull', ['a4', 'e1x']],
    ]);
    expect(r[1].trung_lich[0]).toEqual(lt(a4));
    expect(query.doiBuoiDaDuyetCuaDangKy).toHaveBeenCalledTimes(1);
    expect(query.doiBuoiDaDuyetCuaDangKy).toHaveBeenCalledWith(['dk1']);
    expect(p.phan_lop_giai_doan.findMany).toHaveBeenCalledTimes(1);
    expect(p.phan_lop_giai_doan.findMany).toHaveBeenCalledWith({
      where: { dang_ky_hoc_id: { in: ['dk1'] } },
      select: { dang_ky_hoc_id: true, giai_doan_id: true, lop_id: true },
    });
    expect(p.lich_hoc_lop.findMany).toHaveBeenCalledTimes(2);
    const lichArg = p.lich_hoc_lop.findMany.mock.calls.find(
      (c: any[]) => c[0].where.OR,
    )[0];
    expect(lichArg.where).toEqual({
      OR: [
        { lop_id: 'lopA', giai_doan_id: 'gd1' },
        { lop_id: 'lopE', giai_doan_id: 'gd2' },
        { id: { in: ['e1x'] } },
      ],
    });
  });

  it('luaChonHocVien: buoi da doi (e1) khong con trong lich -> ung vien trung gio goc e1 khong bi canh bao', async () => {
    const { svc, p } = setupTrung();
    const trungGioGoc = gio('lg', 'lopG', 9, 10);
    p.lich_hoc_lop.findMany.mockImplementation(
      async (a: { where: { OR?: unknown } }) =>
        a.where.OR ? [ln, a4, e1, e1x] : [trungGioGoc],
    );
    const r = await svc.luaChonHocVien(user, 'ln');
    // lg 09–10 trùng ln (bỏ: buổi nguồn) và e1 gốc (bỏ: đã đổi sang e1x).
    expect(r[0].trung_lich).toEqual([]);
  });

  it('luaChonDuyet doi lai: bo buoi chot hien tai cua buoi nguon', async () => {
    const { svc, p, query } = setupTrung();
    const lk = gio('lk', 'lopC', 13, 15);
    p.doi_buoi_hoc.findFirst = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'x1',
        trang_thai: 'cho_duyet',
        dang_ky_hoc_id: 'dk1',
        lich_nguon_id: 'ln',
        lich_de_nghi_id: 'lfull',
        lich_chot_id: null,
        tao_luc: new Date(Date.now() - 60_000),
        dang_ky_hoc: { hoc_vien_id: 'hv1' },
      })
      .mockResolvedValueOnce({ lich_chot_id: 'lk' });
    p.doi_buoi_hoc.groupBy = jest.fn(async () => []);
    p.$queryRaw = jest.fn(async () => []);
    const qt = { id: 'qt', vai_tro: 'quan_tri' } as AuthenticatedUser;
    query.doiBuoiDaDuyetCuaDangKy.mockResolvedValue([
      { dang_ky_hoc_id: 'dk1', lich_nguon_id: 'ln', lich_chot_id: 'lk' },
    ]);
    p.lich_hoc_lop.findMany.mockImplementation(
      async (a: { where: { OR?: unknown } }) =>
        a.where.OR ? [ln, a4, lk] : [ld, lfull, lk],
    );
    const r = await svc.luaChonDuyet(qt, 'x1');
    // lk (đang học, 13–15) trùng lfull 14–18 nhưng là chốt cũ của chính ln → bỏ.
    expect(r.map((x) => [x.lich.id, x.trung_lich.map((b) => b.id)])).toEqual([
      ['ld', []],
      ['lfull', ['a4']],
    ]);
  });

  it('tongQuanHocVien: de nghi cho_duyet co trung_lich cho buoi de nghi', async () => {
    const { svc, p, query } = setupTrung();
    const row = (id: string, trang_thai: string, over: object = {}) => ({
      id,
      trang_thai,
      dang_ky_hoc_id: 'dk1',
      lich_nguon_id: 'ln',
      lich_de_nghi_id: 'lfull',
      lich_chot_id: null,
      ly_do: 'abcde',
      tao_luc: new Date(Date.now() - 5000),
      ghi_chu_xu_ly: null,
      nguoi_xu_ly: null,
      ...over,
    });
    p.doi_buoi_hoc.findMany = jest
      .fn()
      .mockResolvedValueOnce([
        row('a', 'cho_duyet'),
        row('b', 'tu_choi', { lich_nguon_id: 'a4' }),
      ])
      .mockResolvedValueOnce([]);
    query.lichTomTat.mockResolvedValue(
      new Map([
        ['ln', ln],
        ['lfull', lfull],
        ['a4', a4],
      ]),
    );
    const r = await svc.tongQuanHocVien(user, 'k1');
    expect(r.de_nghi.find((d) => d.id === 'a')?.trung_lich.map((b) => b.id)).toEqual(
      ['a4', 'e1x'],
    );
    expect(r.de_nghi.find((d) => d.id === 'b')?.trung_lich).toEqual([]);
    expect(query.doiBuoiDaDuyetCuaDangKy).toHaveBeenCalledTimes(1);
  });

  it('danhSach: trung_lich gop moi dang ky trong 1 lan (khong N+1), chi cho_duyet', async () => {
    const { svc, p, query } = setupTrung();
    const dong = (id: string, dk: string, trang_thai = 'cho_duyet') => ({
      id,
      trang_thai,
      dang_ky_hoc_id: dk,
      lich_nguon_id: 'ln',
      lich_de_nghi_id: 'lfull',
      lich_chot_id: trang_thai === 'da_duyet' ? 'lfull' : null,
      ly_do: 'abcde',
      tao_luc: new Date(Date.now() - 5000),
      ghi_chu_xu_ly: null,
      nguoi_xu_ly: null,
      dang_ky_hoc: {
        hoc_vien: { id: dk, ho_ten: 'A', don_vi_cong_tac: { ten_don_vi: 'X' } },
        cum: null,
      },
      xu_ly_boi: null,
    });
    p.$queryRaw = jest.fn(async () => []);
    p.doi_buoi_hoc.findMany = jest
      .fn()
      .mockResolvedValueOnce([
        dong('x1', 'dk1'),
        dong('x2', 'dk2'),
        dong('x3', 'dk3', 'da_duyet'),
      ])
      .mockResolvedValue([]);
    p.phan_lop_giai_doan.findMany.mockResolvedValue([
      { dang_ky_hoc_id: 'dk1', giai_doan_id: 'gd1', lop_id: 'lopA' },
      { dang_ky_hoc_id: 'dk1', giai_doan_id: 'gd2', lop_id: 'lopE' },
      { dang_ky_hoc_id: 'dk2', giai_doan_id: 'gd1', lop_id: 'lopA' },
    ]);
    query.lichTomTat.mockResolvedValue(
      new Map([
        ['ln', ln],
        ['lfull', lfull],
      ]),
    );
    query.siSoBuoi.mockResolvedValue(new Map());
    const qt = { id: 'qt', vai_tro: 'quan_tri' } as AuthenticatedUser;
    const r = await svc.danhSach(qt, {});
    expect(r.map((x) => [x.id, x.trung_lich.map((b) => b.id)])).toEqual([
      ['x1', ['a4', 'e1x']],
      ['x2', ['a4']],
      ['x3', []],
    ]);
    expect(query.doiBuoiDaDuyetCuaDangKy).toHaveBeenCalledTimes(1);
    expect(query.doiBuoiDaDuyetCuaDangKy).toHaveBeenCalledWith(['dk1', 'dk2']);
    expect(p.phan_lop_giai_doan.findMany).toHaveBeenCalledTimes(1);
    expect(p.phan_lop_giai_doan.findMany).toHaveBeenCalledWith({
      where: { dang_ky_hoc_id: { in: ['dk1', 'dk2'] } },
      select: { dang_ky_hoc_id: true, giai_doan_id: true, lop_id: true },
    });
    expect(p.lich_hoc_lop.findMany).toHaveBeenCalledTimes(1);
    // dk1 + dk2 cùng lớp lopA/gd1 → 1 nhánh OR (khử trùng).
    expect(p.lich_hoc_lop.findMany.mock.calls[0][0].where).toEqual({
      OR: [
        { lop_id: 'lopA', giai_doan_id: 'gd1' },
        { lop_id: 'lopE', giai_doan_id: 'gd2' },
        { id: { in: ['e1x'] } },
      ],
    });
  });

  it('luaChonHocVien: khong co ung vien -> [] va khong truy van lich thuc te', async () => {
    const { svc, p, query } = setupTrung();
    p.lich_hoc_lop.findMany.mockImplementation(async () => []);
    await expect(svc.luaChonHocVien(user, 'ln')).resolves.toEqual([]);
    expect(p.phan_lop_giai_doan.findMany).not.toHaveBeenCalled();
    expect(query.doiBuoiDaDuyetCuaDangKy).not.toHaveBeenCalled();
    expect(query.siSoBuoi).not.toHaveBeenCalled();
    expect(p.lich_hoc_lop.findMany).toHaveBeenCalledTimes(1);
  });
});
