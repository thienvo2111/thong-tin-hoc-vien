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
    diem_danh: {
      findMany: jest.fn(async (_a?: unknown) => [] as { lich_hoc_id: string }[]),
    },
  };
  const prisma = {
    $transaction: jest.fn((cb: (t: unknown) => unknown) => cb(tx)),
    $queryRaw: jest.fn(async (..._a: unknown[]) => [] as { id: string; ly_do?: string }[]),
    diem_danh: {
      findFirst: jest.fn(async (_a?: unknown) => null as { id: string } | null),
    },
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
        [] as { dang_ky_hoc_id: string; lich_nguon_id: string; lich_chot_id: string; loai?: string }[],
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
      select: { id: true, lich_nguon_id: true, trang_thai: true, lich_chot_id: true, loai: true },
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

  it('gui: buoi nguon da diem danh -> 400 DA_DIEM_DANH, khong tao (D12)', async () => {
    const { svc, tx } = setup();
    tx.diem_danh.findMany.mockResolvedValueOnce([{ lich_hoc_id: 'ln' }]);
    await expect(svc.gui(user, dto)).rejects.toMatchObject({
      status: 400,
      response: {
        error: expect.objectContaining({
          message: 'Thầy/Cô đã điểm danh buổi này, không thể đổi',
        }),
      },
    });
    expect(tx.diem_danh.findMany).toHaveBeenCalledWith({
      where: { dang_ky_hoc_id: 'dk1', lich_hoc_id: { in: ['ln'] } },
      select: { lich_hoc_id: true, trang_thai: true },
    });
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.diem_danh.findMany.mock.invocationCallOrder[0],
    );
    expect(tx.doi_buoi_hoc.create).not.toHaveBeenCalled();
  });

  it('gui doi lai: buoi chot hien tai da diem danh -> 400 DA_DIEM_DANH, khong tao', async () => {
    const { svc, tx } = setup({
      hoatDong: [
        { lich_nguon_id: 'ln', trang_thai: 'da_duyet', lich_chot_id: 'lc' },
      ],
    });
    tx.diem_danh.findMany.mockResolvedValueOnce([{ lich_hoc_id: 'lc' }]);
    await expect(svc.gui(user, dto)).rejects.toMatchObject({ status: 400 });
    expect(tx.diem_danh.findMany).toHaveBeenCalledWith({
      where: { dang_ky_hoc_id: 'dk1', lich_hoc_id: { in: ['ln', 'lc'] } },
      select: { lich_hoc_id: true, trang_thai: true },
    });
    expect(tx.doi_buoi_hoc.create).not.toHaveBeenCalled();
  });

  it('sua: buoi nguon da diem danh -> 400, khong tao', async () => {
    const { svc, tx } = setup();
    tx.diem_danh.findMany.mockResolvedValueOnce([{ lich_hoc_id: 'ln' }]);
    await expect(svc.sua(user, 'x1', dto)).rejects.toMatchObject({ status: 400 });
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
        loai: 'doi_buoi',
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

  it('lua-chon: buoi nguon da diem danh -> 400 DA_DIEM_DANH, khong tim ung vien (D12)', async () => {
    const { svc, prisma, lichFindMany } = setupDoc();
    prisma.diem_danh.findFirst.mockResolvedValueOnce({ id: 'dd1' });
    await expect(svc.luaChonHocVien(user, 'ln')).rejects.toMatchObject({
      status: 400,
      response: {
        error: expect.objectContaining({
          message: 'Thầy/Cô đã điểm danh buổi này, không thể đổi',
        }),
      },
    });
    expect(prisma.diem_danh.findFirst).toHaveBeenCalledWith({
      where: { dang_ky_hoc_id: 'dk1', lich_hoc_id: { in: ['ln'] } },
      select: { id: true },
    });
    expect(lichFindMany).not.toHaveBeenCalled();
  });

  it('lua-chon doi lai: kiem diem danh ca buoi chot hien tai', async () => {
    const { svc, prisma } = setupDoc();
    prisma.doi_buoi_hoc.findFirst.mockResolvedValueOnce({
      lich_chot_id: 'ld',
    } as never);
    await svc.luaChonHocVien(user, 'ln');
    expect(prisma.diem_danh.findFirst).toHaveBeenCalledWith({
      where: { dang_ky_hoc_id: 'dk1', lich_hoc_id: { in: ['ln', 'ld'] } },
      select: { id: true },
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
      ly_do_qua_han: 'buoi_dang_hoc_bat_dau',
      thu_tu_hang: null,
    });
  });

  it('tong quan: de nghi cho co buoi nguon da diem danh -> qua han (truy van loc theo dang ky)', async () => {
    const s = setupDoc();
    const row = {
      id: 'a',
      trang_thai: 'cho_duyet',
      dang_ky_hoc_id: 'dk1',
      lich_nguon_id: 'ln',
      lich_de_nghi_id: 'ld',
      lich_chot_id: null,
      ly_do: 'abcde',
      tao_luc: new Date(Date.now() - 5000),
      ghi_chu_xu_ly: null,
      nguoi_xu_ly: null,
    };
    (s.prisma.doi_buoi_hoc as Record<string, unknown>).findMany = jest
      .fn()
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([]);
    s.prisma.$queryRaw.mockResolvedValueOnce([{ id: 'a', ly_do: 'da_diem_danh_buoi_goc' }]);
    s.query.lichTomTat.mockResolvedValue(
      new Map([
        ['ln', lich('ln', 'lopA')],
        ['ld', lich('ld', 'lopB')],
      ]),
    );
    const r = await s.svc.tongQuanHocVien(user, 'k1');
    expect(r.de_nghi[0]).toMatchObject({
      id: 'a',
      qua_han: true,
      ly_do_qua_han: 'da_diem_danh_buoi_goc',
      thu_tu_hang: null,
    });
    expect(s.prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(s.prisma.$queryRaw.mock.calls[0])).toContain('dk1');
  });

  it('tong quan: khong co de nghi cho -> khong truy van qua han', async () => {
    const s = setupDoc();
    (s.prisma.doi_buoi_hoc as Record<string, unknown>).findMany = jest
      .fn()
      .mockResolvedValueOnce([]);
    await s.svc.tongQuanHocVien(user, 'k1');
    expect(s.prisma.$queryRaw).not.toHaveBeenCalled();
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
      $queryRaw: jest.fn(async (..._a: unknown[]) => [] as { id: string; ly_do?: string }[]),
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
      diem_danh: {
        findMany: jest.fn(async (_a?: unknown) => [] as { lich_hoc_id: string }[]),
        findFirst: jest.fn(async (_a?: unknown) => null as { id: string } | null),
      },
    };
    const prisma = {
      $transaction: jest.fn((cb: (t: unknown) => unknown) => cb(tx)),
      $queryRaw: jest.fn(async (..._a: unknown[]) => [] as { id: string; ly_do?: string }[]),
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
    expect(where.OR[1].lich_nguon.thoi_gian_bat_dau.gt).toBeInstanceOf(Date);
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
        select: { id: true, lich_chot_id: true, loai: true },
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

    it('buoi chot cu da diem danh -> 400 DA_DIEM_DANH trong tx, khong cap nhat', async () => {
      const { svc, tx, nhatKy } = setupDoiLai();
      tx.diem_danh.findMany.mockResolvedValueOnce([{ lich_hoc_id: 'lc' }]);
      await expect(svc.duyet(quanTri, 'x1', {})).rejects.toMatchObject({
        status: 400,
        response: {
          error: expect.objectContaining({
            message: 'Học viên đã điểm danh buổi này, không thể đổi',
          }),
        },
      });
      expect(tx.diem_danh.findMany).toHaveBeenCalledWith({
        where: { dang_ky_hoc_id: 'dk1', lich_hoc_id: { in: ['ln', 'lc'] } },
        select: { lich_hoc_id: true, trang_thai: true },
      });
      expect(tx.doi_buoi_hoc.updateMany).not.toHaveBeenCalled();
      expect(nhatKy.ghi).not.toHaveBeenCalled();
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

  it('duyet: buoi nguon da diem danh -> 400 DA_DIEM_DANH (ca quan tri), doc trong tx truoc cap nhat', async () => {
    const { svc, tx, prisma, nhatKy } = setupDuyet();
    tx.diem_danh.findMany.mockResolvedValueOnce([{ lich_hoc_id: 'ln' }]);
    await expect(svc.duyet(quanTri, 'x1', {})).rejects.toMatchObject({
      status: 400,
      response: {
        error: expect.objectContaining({
          message: 'Học viên đã điểm danh buổi này, không thể đổi',
        }),
      },
    });
    expect(tx.diem_danh.findMany).toHaveBeenCalledWith({
      where: { dang_ky_hoc_id: 'dk1', lich_hoc_id: { in: ['ln'] } },
      select: { lich_hoc_id: true, trang_thai: true },
    });
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.diem_danh.findMany.mock.invocationCallOrder[0],
    );
    expect(tx.doi_buoi_hoc.updateMany).not.toHaveBeenCalled();
    expect(prisma.doi_buoi_hoc.updateMany).not.toHaveBeenCalled();
    expect(nhatKy.ghi).not.toHaveBeenCalled();
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

  it('huyDuyet: da diem danh o buoi chot -> 400, khong cap nhat (D12)', async () => {
    const { svc, tx, nhatKy } = setupDuyet({
      trangThai: 'da_duyet',
      lichChot: 'lk',
    });
    tx.diem_danh.findFirst.mockResolvedValueOnce({ id: 'dd1' });
    await expect(svc.huyDuyet(quanTri, 'x1', ghiChu)).rejects.toMatchObject({
      status: 400,
      response: {
        error: expect.objectContaining({
          message: 'Học viên đã điểm danh buổi chốt, không thể hủy duyệt',
        }),
      },
    });
    expect(tx.diem_danh.findFirst).toHaveBeenCalledWith({
      where: { dang_ky_hoc_id: 'dk1', lich_hoc_id: 'lk' },
      select: { id: true },
    });
    expect(tx.doi_buoi_hoc.updateMany).not.toHaveBeenCalled();
    expect(nhatKy.ghi).not.toHaveBeenCalled();
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
    expect(where.OR[1].lich_nguon.thoi_gian_bat_dau.gt).toBeInstanceOf(Date);
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

  it('idQuaHanThem: SQL chi xet de nghi co buoi nguon + buoi de nghi chua bat dau, cung moc now', async () => {
    const { svc, prisma } = setupDuyet();
    await svc.demChoDuyet(quanTri);
    const [strings, ...values] = prisma.$queryRaw.mock.calls[0] as [
      TemplateStringsArray,
      ...unknown[],
    ];
    const sql = strings.join('?').replace(/\s+/g, ' ');
    expect(sql).toContain('JOIN lich_hoc_lop ln ON ln.id = c.lich_nguon_id');
    expect(sql).toContain('JOIN lich_hoc_lop ld ON ld.id = c.lich_de_nghi_id');
    expect(sql).toContain('ln.thoi_gian_bat_dau > ?) AND ld.thoi_gian_bat_dau > ?');
    expect(sql).toContain('l.thoi_gian_bat_dau <= ?');
    expect(sql).toContain('FROM diem_danh dd');
    const ngay = values.filter((v): v is Date => v instanceof Date);
    // 3 trong WHERE + 1 trong CASE ly_do (buoi dang hoc da bat dau).
    expect(ngay).toHaveLength(4);
    expect(new Set(ngay.map((d) => d.getTime())).size).toBe(1);
    const where = (prisma.doi_buoi_hoc.count.mock.calls[0][0] as { where: any })
      .where;
    expect(where.OR[1].lich_nguon.thoi_gian_bat_dau.gt).toBe(ngay[0]);
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

  it('danhSach tat ca: de nghi cho trong tap qua han (vd da diem danh) -> qua_han', async () => {
    const { svc, prisma } = setupDuyet();
    prisma.doi_buoi_hoc.findMany.mockResolvedValueOnce([
      {
        id: 'x1',
        trang_thai: 'cho_duyet',
        dang_ky_hoc_id: 'dk1',
        lich_nguon_id: 'ln',
        lich_de_nghi_id: 'ld',
        lich_chot_id: null,
        ly_do: 'abcde',
        tao_luc: taoLuc,
        ghi_chu_xu_ly: null,
        nguoi_xu_ly: null,
        dang_ky_hoc: {
          hoc_vien: { id: 'hv1', ho_ten: 'A', don_vi_cong_tac: { ten_don_vi: 'T' } },
          cum: null,
        },
        xu_ly_boi: null,
      },
    ]);
    prisma.$queryRaw.mockResolvedValue([{ id: 'x1' }]);
    const r = await svc.danhSach(quanTri, {});
    expect(r[0]).toMatchObject({ id: 'x1', qua_han: true, thu_tu_hang: null });
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
    expect(arg.where.OR).toEqual([
      { loai: 'hoc_bu' },
      { lich_nguon: { thoi_gian_bat_dau: { gt: expect.any(Date) } } },
    ]);
    expect(arg.where.lich_de_nghi.thoi_gian_bat_dau.gt).toBeInstanceOf(Date);
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

  it('danhSach: da_xu_ly -> 3 trang thai da xu ly, xu_ly_luc giam, van gioi han cum, trang 50', async () => {
    const { svc, prisma } = setupDuyet();
    await svc.danhSach(hoTro, { da_xu_ly: true });
    const arg = prisma.doi_buoi_hoc.findMany.mock.calls[0][0] as any;
    expect(arg.where).toEqual({
      trang_thai: { in: ['da_duyet', 'tu_choi', 'da_huy'] },
      dang_ky_hoc: { cum_id: { in: ['c1'] } },
    });
    expect(arg.orderBy).toEqual([
      { xu_ly_luc: { sort: 'desc', nulls: 'last' } },
      { id: 'asc' },
    ]);
    expect(arg.take).toBe(50);
    expect(arg.skip).toBeUndefined();
  });

  it('danhSach: da_xu_ly trang=3 -> skip 100, take 50', async () => {
    const { svc, prisma } = setupDuyet();
    await svc.danhSach(hoTro, { da_xu_ly: true, trang: 3 });
    const arg = prisma.doi_buoi_hoc.findMany.mock.calls[0][0] as any;
    expect(arg.take).toBe(50);
    expect(arg.skip).toBe(100);
  });

  it('danhSach: trang bi bo qua ngoai da_xu_ly', async () => {
    const { svc, prisma } = setupDuyet();
    await svc.danhSach(hoTro, { trang_thai: 'cho_duyet', trang: 2 });
    const arg = prisma.doi_buoi_hoc.findMany.mock.calls[0][0] as any;
    expect(arg.take).toBe(500);
    expect(arg.skip).toBeUndefined();
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

  it('danhSach: cho_duyet qua_han=true -> chi qua han, gui truoc len dau, 100', async () => {
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
    expect(arg.orderBy).toEqual({ tao_luc: 'asc' });
    expect(arg.take).toBe(100);
  });

  it('danhSach: qua_han bi bo qua khi khong phai cho_duyet', async () => {
    const { svc, prisma } = setupDuyet();
    await svc.danhSach(hoTro, { da_xu_ly: true, qua_han: true });
    const arg = prisma.doi_buoi_hoc.findMany.mock.calls[0][0] as any;
    expect(arg.where.OR).toBeUndefined();
    expect(arg.take).toBe(50);
  });

  // ---- Bộ lọc màn duyệt: cụm / lớp / tìm học viên + quá hạn thu hẹp ----

  const sqlCua = (call: unknown[]) => {
    const [strings, ...values] = call as [TemplateStringsArray, ...unknown[]];
    // Prisma.sql lồng: lấy cả strings của fragment để kiểm.
    const phan = values
      .filter(
        (v): v is { sql: string; values: unknown[] } =>
          typeof v === 'object' && v !== null && 'sql' in v,
      )
      .map((v) => `${v.sql} ${JSON.stringify(v.values)}`);
    return `${strings.join('?')} ${phan.join(' ')}`.replace(/\s+/g, ' ');
  };

  it('danhSach: cum_id trong pham vi -> loc dung cum do', async () => {
    const { svc, prisma, scope } = setupDuyet();
    scope.cumIdsCuaToi.mockResolvedValueOnce(['c1', 'c2']);
    await svc.danhSach(hoTro, { trang_thai: 'cho_duyet', cum_id: 'c2' });
    const arg = prisma.doi_buoi_hoc.findMany.mock.calls[0][0] as any;
    expect(arg.where.dang_ky_hoc).toEqual({ cum_id: { in: ['c2'] } });
  });

  it('danhSach: cum_id ngoai pham vi ho tro -> [] khong truy van', async () => {
    const { svc, prisma } = setupDuyet();
    await expect(
      svc.danhSach(hoTro, { trang_thai: 'cho_duyet', cum_id: 'c9' }),
    ).resolves.toEqual([]);
    expect(prisma.doi_buoi_hoc.findMany).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('danhSach: quan tri cum_id bat ky -> loc cum', async () => {
    const { svc, prisma } = setupDuyet();
    await svc.danhSach(quanTri, { da_xu_ly: true, cum_id: 'c9', khoa_id: 'k1' });
    const arg = prisma.doi_buoi_hoc.findMany.mock.calls[0][0] as any;
    expect(arg.where.dang_ky_hoc).toEqual({ cum_id: { in: ['c9'] }, khoa_id: 'k1' });
  });

  it('danhSach: lop_id -> lop goc HOAC lop de nghi', async () => {
    const { svc, prisma } = setupDuyet();
    await svc.danhSach(quanTri, { da_xu_ly: true, lop_id: 'lop1' });
    const arg = prisma.doi_buoi_hoc.findMany.mock.calls[0][0] as any;
    expect(arg.where.AND).toEqual([
      {
        OR: [
          { lich_nguon: { lop_id: 'lop1' } },
          { lich_de_nghi: { lop_id: 'lop1' } },
        ],
      },
    ]);
  });

  it('danhSach: q -> ho ten khong dau (trong khoa) HOAC ma MOET bo so 0 dau', async () => {
    const { svc, prisma } = setupDuyet();
    prisma.$queryRaw.mockResolvedValueOnce([{ id: 'hvA' }]);
    await svc.danhSach(quanTri, { da_xu_ly: true, khoa_id: 'k1', q: '  0123 ' });
    // Prisma.sql (không phải tagged call): câu SQL nằm trong đối tượng Sql.
    const tim = prisma.$queryRaw.mock.calls[0][0] as unknown as Prisma.Sql;
    expect(tim.sql).toContain('unaccent(lower(h.ho_ten))');
    expect(tim.sql).toContain('d.khoa_id = ?::uuid');
    expect(tim.values[0]).toBe('k1');
    const arg = prisma.doi_buoi_hoc.findMany.mock.calls[0][0] as any;
    expect(arg.where.AND).toEqual([
      {
        dang_ky_hoc: {
          OR: [
            { hoc_vien_id: { in: ['hvA'] } },
            {
              hoc_vien: {
                ma_dinh_danh_moet: { contains: '123', mode: 'insensitive' },
              },
            },
          ],
        },
      },
    ]);
  });

  it('danhSach: q < 2 ky tu -> bo qua, khong truy van ten', async () => {
    const { svc, prisma } = setupDuyet();
    await svc.danhSach(quanTri, { da_xu_ly: true, q: ' a ' });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    const arg = prisma.doi_buoi_hoc.findMany.mock.calls[0][0] as any;
    expect(arg.where.AND).toBeUndefined();
  });

  it('danhSach cho_duyet: quaHanThem thu hep JOIN dang_ky_hoc theo khoa + cum', async () => {
    const { svc, prisma } = setupDuyet();
    await svc.danhSach(hoTro, { trang_thai: 'cho_duyet', khoa_id: 'k1' });
    const sql = sqlCua(prisma.$queryRaw.mock.calls[0]);
    expect(sql).toContain('JOIN dang_ky_hoc k ON k.id = c.dang_ky_hoc_id');
    expect(sql).toContain('k.khoa_id =');
    expect(sql).toContain('k.cum_id = ANY(');
    expect(sql).toContain('"k1"');
    expect(sql).toContain('["c1"]');
  });

  it('danhSach cho_duyet: quan tri khong loc -> quaHanThem khong JOIN dang_ky_hoc (nhu cu)', async () => {
    const { svc, prisma } = setupDuyet();
    await svc.danhSach(quanTri, { trang_thai: 'cho_duyet' });
    const sql = sqlCua(prisma.$queryRaw.mock.calls[0]);
    expect(sql).not.toContain('JOIN dang_ky_hoc k');
  });

  it('demChoDuyet: ho tro -> quaHanThem chi xet cum cua minh', async () => {
    const { svc, prisma } = setupDuyet();
    await svc.demChoDuyet(hoTro);
    const sql = sqlCua(prisma.$queryRaw.mock.calls[0]);
    expect(sql).toContain('k.cum_id = ANY(');
    expect(sql).not.toContain('k.khoa_id');
  });

  it('duyet / luaChonDuyet: hang cho (whereChoTruoc) dung tap qua han KHONG thu hep', async () => {
    const { svc, prisma, tx } = setupDuyet();
    await svc.luaChonDuyet(hoTro, 'x1').catch(() => undefined);
    await svc.duyet(hoTro, 'x1', {}).catch(() => undefined);
    const calls = [...prisma.$queryRaw.mock.calls, ...tx.$queryRaw.mock.calls];
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) expect(sqlCua(c)).not.toContain('JOIN dang_ky_hoc k');
  });

  it('danhSach loc cum/lop/q: thu_tu_hang van tinh tren TOAN hang cho cua buoi de nghi', async () => {
    const { svc, prisma } = setupDuyet();
    const dong = {
      id: 'x2',
      trang_thai: 'cho_duyet',
      dang_ky_hoc_id: 'dk2',
      lich_nguon_id: 'ln',
      lich_de_nghi_id: 'ld',
      lich_chot_id: null,
      ly_do: 'abcde',
      tao_luc: taoLuc,
      ghi_chu_xu_ly: null,
      nguoi_xu_ly: null,
      loai: 'doi_buoi',
      dang_ky_hoc: {
        hoc_vien: { id: 'hv2', ho_ten: 'B', don_vi_cong_tac: { ten_don_vi: 'X' } },
        cum: { ten_cum: 'Cum 1' },
      },
      xu_ly_boi: null,
    };
    // Hàng chờ buổi ld: 1 đề nghị cụm khác gửi trước (x0) + x2.
    const hangDoi = [
      { id: 'x0', tao_luc: new Date(taoLuc.getTime() - 1000), lich_de_nghi_id: 'ld', loai: 'doi_buoi', lich_nguon: { thoi_gian_bat_dau: ngayMai } },
      { id: 'x2', tao_luc: taoLuc, lich_de_nghi_id: 'ld', loai: 'doi_buoi', lich_nguon: { thoi_gian_bat_dau: ngayMai } },
    ];
    prisma.doi_buoi_hoc.findMany.mockImplementation(async (a: any) => {
      if (a.select?.dang_ky_hoc) return [dong];
      if (a.where?.lich_de_nghi_id) return hangDoi;
      return [];
    });
    const r = await svc.danhSach(hoTro, {
      trang_thai: 'cho_duyet',
      cum_id: 'c1',
      lop_id: 'lopB',
      q: 'Bình',
    });
    const truyVanHang = prisma.doi_buoi_hoc.findMany.mock.calls
      .map((c) => c[0] as any)
      .find((a) => a.where?.lich_de_nghi_id);
    expect(truyVanHang.where).toEqual({
      trang_thai: 'cho_duyet',
      lich_de_nghi_id: { in: ['ld'] },
    });
    expect(r[0].thu_tu_hang).toEqual({ k: 2, n: 2 });
  });

  it('boLoc: ho tro -> 3 truy van gop theo cum cua minh', async () => {
    const { svc, prisma } = setupDuyet();
    const p = prisma as any;
    p.khoa_boi_duong = { findMany: jest.fn(async () => [{ id: 'k1' }]) };
    p.cum_hoc_vien = { findMany: jest.fn(async () => [{ id: 'c1' }]) };
    p.lop_hoc = { findMany: jest.fn(async () => [{ id: 'lop1' }]) };
    const r = await svc.boLoc(hoTro);
    expect(r).toEqual({ khoa: [{ id: 'k1' }], cum: [{ id: 'c1' }], lop: [{ id: 'lop1' }] });
    expect(p.khoa_boi_duong.findMany.mock.calls[0][0].where).toEqual({
      dang_ky_hoc: {
        some: { cum_id: { in: ['c1'] }, doi_buoi_hoc: { some: {} } },
      },
    });
    expect(p.cum_hoc_vien.findMany.mock.calls[0][0].where).toEqual({
      id: { in: ['c1'] },
      dang_ky_hoc: { some: { doi_buoi_hoc: { some: {} } } },
    });
    const dn = { some: { dang_ky_hoc: { cum_id: { in: ['c1'] } } } };
    expect(p.lop_hoc.findMany.mock.calls[0][0].where).toEqual({
      lich_hoc: { some: { OR: [{ doi_buoi_nguon: dn }, { doi_buoi_de_nghi: dn }] } },
    });
    expect(p.khoa_boi_duong.findMany.mock.calls[0][0].select).toEqual({
      id: true,
      ma_khoa: true,
      ten_khoa: true,
      thoi_gian_bat_dau: true,
      thoi_gian_ket_thuc: true,
    });
    for (const m of [p.khoa_boi_duong, p.cum_hoc_vien, p.lop_hoc])
      expect(m.findMany).toHaveBeenCalledTimes(1);
  });

  it('boLoc: quan tri -> khong gioi han cum', async () => {
    const { svc, prisma } = setupDuyet();
    const p = prisma as any;
    p.khoa_boi_duong = { findMany: jest.fn(async () => []) };
    p.cum_hoc_vien = { findMany: jest.fn(async () => []) };
    p.lop_hoc = { findMany: jest.fn(async () => []) };
    await svc.boLoc(quanTri);
    expect(p.cum_hoc_vien.findMany.mock.calls[0][0].where).toEqual({
      dang_ky_hoc: { some: { doi_buoi_hoc: { some: {} } } },
    });
    expect(p.lop_hoc.findMany.mock.calls[0][0].where).toEqual({
      lich_hoc: {
        some: { OR: [{ doi_buoi_nguon: { some: {} } }, { doi_buoi_de_nghi: { some: {} } }] },
      },
    });
  });

  it('boLoc: ho tro khong co cum -> rong, khong truy van', async () => {
    const { svc, scope } = setupDuyet();
    scope.cumIdsCuaToi.mockResolvedValueOnce([]);
    await expect(svc.boLoc(hoTro)).resolves.toEqual({ khoa: [], cum: [], lop: [] });
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

  it('lichThucTe hoc bu: buoi goc e1 GIU NGUYEN, buoi chot e1x la o THEM', async () => {
    const { svc, p, query } = setupTrung();
    query.doiBuoiDaDuyetCuaDangKy.mockResolvedValue([
      { dang_ky_hoc_id: 'dk1', lich_nguon_id: 'e1', lich_chot_id: 'e1x', loai: 'hoc_bu' },
    ]);
    const trungGioGoc = gio('lg', 'lopG', 9, 10);
    p.lich_hoc_lop.findMany.mockImplementation(
      async (a: { where: { OR?: unknown } }) =>
        a.where.OR ? [ln, a4, e1, e1x] : [trungGioGoc, lfull],
    );
    const r = await svc.luaChonHocVien(user, 'ln');
    expect(r.map((x) => [x.lich.id, x.trung_lich.map((b) => b.id)])).toEqual([
      ['lg', ['e1']],
      ['lfull', ['a4', 'e1x']],
    ]);
    expect(query.doiBuoiDaDuyetCuaDangKy).toHaveBeenCalledTimes(1);
    expect(p.lich_hoc_lop.findMany).toHaveBeenCalledTimes(2);
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

// ---------------------------------------------------------------------------
// ADR 0012 — học bù (loai = hoc_bu) dùng chung cơ chế đổi buổi.
// ---------------------------------------------------------------------------
describe('DoiBuoiHocService hoc bu (hoc vien)', () => {
  const dtoHb = { ...dto, loai: 'hoc_bu' as const, ly_do: 'Bi om hom do' };
  const gocDaQua = () => lich('ln', 'lopA', { thoi_gian_bat_dau: hqua });

  function setupHb(
    opts: Parameters<typeof setup>[0] & { doi?: number; hocBu?: number } = {},
  ) {
    const s = setup(opts);
    s.prisma.khoa_boi_duong.findUnique.mockResolvedValue({
      so_buoi_doi_toi_da: opts.doi ?? 0,
      so_buoi_hoc_bu_toi_da: opts.hocBu ?? 1,
    } as never);
    s.query.lichTomTat.mockResolvedValue(
      new Map([
        ['ln', gocDaQua()],
        ['ld', lich('ld', 'lopB')],
        ['lc', lich('lc', 'lopC')],
      ]),
    );
    return s;
  }

  const loiVoi = (status: number, message: string) => ({
    status,
    response: { error: expect.objectContaining({ message }) },
  });

  it('gui: khoa chua bat hoc bu (doi buoi van bat) -> 403, khong vao tx', async () => {
    const { svc, prisma } = setupHb({ doi: 2, hocBu: 0 });
    await expect(svc.gui(user, dtoHb)).rejects.toMatchObject(
      loiVoi(403, 'Khóa học chưa mở đăng ký học bù'),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('gui: doi buoi tat nhung hoc bu bat -> tao loai hoc_bu, nhat ky co loai', async () => {
    const { svc, tx, nhatKy } = setupHb({ doi: 0, hocBu: 1 });
    await expect(svc.gui(user, dtoHb)).resolves.toEqual({ id: 'moi' });
    expect(tx.doi_buoi_hoc.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ loai: 'hoc_bu', lich_nguon_id: 'ln' }),
      select: { id: true },
    });
    expect(nhatKy.ghi).toHaveBeenCalledWith(
      expect.objectContaining({
        hanh_dong: 'de_nghi_doi_buoi',
        chi_tiet: expect.objectContaining({ loai: 'hoc_bu' }),
      }),
    );
  });

  it('gui: doc diem_danh buoi goc trong tx sau lock; co_mat -> 400 DA_CO_MAT, khong tao', async () => {
    const { svc, tx } = setupHb();
    tx.diem_danh.findMany.mockResolvedValueOnce([
      { lich_hoc_id: 'ln', trang_thai: 'co_mat' },
    ] as never);
    await expect(svc.gui(user, dtoHb)).rejects.toMatchObject(
      loiVoi(400, 'Thầy/Cô đã có mặt buổi này, không cần học bù'),
    );
    expect(tx.diem_danh.findMany).toHaveBeenCalledWith({
      where: { dang_ky_hoc_id: 'dk1', lich_hoc_id: { in: ['ln'] } },
      select: { lich_hoc_id: true, trang_thai: true },
    });
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.diem_danh.findMany.mock.invocationCallOrder[0],
    );
    expect(tx.doi_buoi_hoc.create).not.toHaveBeenCalled();
  });

  it.each(['vang', 'vang_co_phep'])('gui: buoi goc diem danh %s -> tao', async (t) => {
    const { svc, tx } = setupHb();
    tx.diem_danh.findMany.mockResolvedValueOnce([
      { lich_hoc_id: 'ln', trang_thai: t },
    ] as never);
    await expect(svc.gui(user, dtoHb)).resolves.toEqual({ id: 'moi' });
  });

  it('gui: buoi goc chua dien ra -> 400 CHUA_DIEN_RA', async () => {
    const { svc, tx, query } = setupHb();
    query.lichTomTat.mockResolvedValue(
      new Map([
        ['ln', lich('ln', 'lopA')],
        ['ld', lich('ld', 'lopB')],
      ]),
    );
    await expect(svc.gui(user, dtoHb)).rejects.toMatchObject(
      loiVoi(400, 'Buổi này chưa diễn ra — hãy dùng đổi buổi'),
    );
    expect(tx.doi_buoi_hoc.create).not.toHaveBeenCalled();
  });

  it('gui: buoi goc da co doi buoi da_duyet -> 400 DA_DOI_BUOI truoc unique (khong 409/500)', async () => {
    const { svc, tx } = setupHb({
      hoatDong: [
        { lich_nguon_id: 'ln', trang_thai: 'da_duyet', lich_chot_id: 'lc', loai: 'doi_buoi' } as never,
      ],
    });
    await expect(svc.gui(user, dtoHb)).rejects.toMatchObject(
      loiVoi(400, 'Buổi này đã được đổi, liên hệ người hỗ trợ'),
    );
    expect(tx.doi_buoi_hoc.create).not.toHaveBeenCalled();
  });

  it('gui: luot tach theo loai — doi buoi khong tinh vao luot hoc bu', async () => {
    const { svc, tx } = setupHb({
      hocBu: 1,
      hoatDong: [
        { lich_nguon_id: 'n1', trang_thai: 'da_duyet', lich_chot_id: 'c1', loai: 'doi_buoi' },
        { lich_nguon_id: 'n2', trang_thai: 'cho_duyet', lich_chot_id: null, loai: 'doi_buoi' },
      ] as never,
    });
    await expect(svc.gui(user, dtoHb)).resolves.toEqual({ id: 'moi' });
    expect(tx.doi_buoi_hoc.findMany).toHaveBeenCalledWith({
      where: {
        dang_ky_hoc_id: 'dk1',
        trang_thai: { in: ['cho_duyet', 'da_duyet'] },
      },
      select: { id: true, lich_nguon_id: true, trang_thai: true, lich_chot_id: true, loai: true },
    });
  });

  it('gui: het luot hoc bu -> 400 thong diep hoc bu', async () => {
    const { svc, tx } = setupHb({
      hocBu: 1,
      hoatDong: [
        { lich_nguon_id: 'n1', trang_thai: 'cho_duyet', lich_chot_id: null, loai: 'hoc_bu' },
      ] as never,
    });
    await expect(svc.gui(user, dtoHb)).rejects.toMatchObject(
      loiVoi(400, 'Thầy/Cô đã dùng hết 1 lượt học bù của khóa này'),
    );
    expect(tx.doi_buoi_hoc.create).not.toHaveBeenCalled();
  });

  it('gui doi buoi: de nghi hoc bu khong tieu luot doi buoi', async () => {
    const { svc, tx } = setup({
      soBuoi: 1,
      hoatDong: [
        { lich_nguon_id: 'n1', trang_thai: 'da_duyet', lich_chot_id: 'c1', loai: 'hoc_bu' },
      ] as never,
    });
    await expect(svc.gui(user, dto)).resolves.toEqual({ id: 'moi' });
    expect(tx.doi_buoi_hoc.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ loai: 'doi_buoi' }),
      select: { id: true },
    });
  });

  it('gui doi lai hoc bu: ban hoc bu da duyet cung buoi goc -> khong ton luot, kiem diem danh buoi chot', async () => {
    const { svc, tx } = setupHb({
      hocBu: 1,
      hoatDong: [
        { lich_nguon_id: 'ln', trang_thai: 'da_duyet', lich_chot_id: 'lc', loai: 'hoc_bu' },
      ] as never,
    });
    await expect(svc.gui(user, dtoHb)).resolves.toEqual({ id: 'moi' });
    expect(tx.diem_danh.findMany).toHaveBeenCalledWith({
      where: { dang_ky_hoc_id: 'dk1', lich_hoc_id: { in: ['ln', 'lc'] } },
      select: { lich_hoc_id: true, trang_thai: true },
    });
  });

  it('sua: khong doi duoc loai -> 400, khong vao tx', async () => {
    const { svc, prisma } = setupHb();
    await expect(svc.sua(user, 'x1', dtoHb)).rejects.toMatchObject(
      loiVoi(400, 'Không đổi được loại đề nghị khi sửa'),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('sua hoc bu: giu loai cua ban cu (body khong gui loai), gate theo hoc bu', async () => {
    const { svc, prisma, tx } = setupHb({ doi: 0, hocBu: 1 });
    prisma.doi_buoi_hoc.findFirst.mockResolvedValueOnce({
      id: 'x1',
      dang_ky_hoc_id: 'dk1',
      lich_nguon_id: 'ln',
      trang_thai: 'cho_duyet',
      loai: 'hoc_bu',
      dang_ky_hoc: { khoa_id: 'k1' },
    } as never);
    await expect(svc.sua(user, 'x1', dto)).resolves.toEqual({ id: 'moi' });
    expect(tx.doi_buoi_hoc.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ loai: 'hoc_bu' }),
      select: { id: true },
    });
  });

  it('huy hoc bu: doi buoi tat nhung hoc bu bat -> huy duoc', async () => {
    const { svc, prisma } = setupHb({ doi: 0, hocBu: 1 });
    prisma.doi_buoi_hoc.findFirst.mockResolvedValueOnce({
      id: 'x1',
      dang_ky_hoc_id: 'dk1',
      lich_nguon_id: 'ln',
      trang_thai: 'cho_duyet',
      loai: 'hoc_bu',
      dang_ky_hoc: { khoa_id: 'k1' },
    } as never);
    await expect(svc.huyHocVien(user, 'x1')).resolves.toEqual({
      trang_thai: 'da_huy',
    });
  });
});

describe('DoiBuoiHocService hoc bu (tong quan / lua chon)', () => {
  function setupTq(opts: { doi?: number; hocBu?: number } = {}) {
    const s = setup();
    const p = s.prisma as Record<string, any>;
    p.khoa_boi_duong.findUnique.mockResolvedValue({
      so_buoi_doi_toi_da: opts.doi ?? 2,
      so_buoi_hoc_bu_toi_da: opts.hocBu ?? 2,
    });
    p.phan_lop_giai_doan = {
      findFirst: jest.fn(async () => ({ lop_id: 'lopA' })),
      findMany: jest.fn(async () => [{ giai_doan_id: 'gd1', lop_id: 'lopA' }]),
    };
    const qua = (id: string, ms: number) =>
      lich(id, 'lopA', { thoi_gian_bat_dau: new Date(Date.now() - ms) });
    const lichFindMany = jest.fn(async (a: any) =>
      a.where.thoi_gian_bat_dau?.lte
        ? [qua('p1', 1000), qua('p2', 2000), qua('p3', 3000), qua('p4', 4000)]
        : [lich('ln', 'lopA')],
    );
    p.lich_hoc_lop = { findMany: lichFindMany };
    p.diem_danh.findMany = jest.fn(async () => [
      { lich_hoc_id: 'p1', trang_thai: 'co_mat' },
      { lich_hoc_id: 'p2', trang_thai: 'vang' },
    ]);
    const row = (id: string, over: object) => ({
      id,
      trang_thai: 'cho_duyet',
      dang_ky_hoc_id: 'dk1',
      lich_nguon_id: 'p3',
      lich_de_nghi_id: 'ld',
      lich_chot_id: null,
      ly_do: 'abcde',
      tao_luc: new Date(Date.now() - 5000),
      ghi_chu_xu_ly: null,
      nguoi_xu_ly: null,
      loai: 'hoc_bu',
      ...over,
    });
    p.doi_buoi_hoc.findMany = jest
      .fn()
      .mockResolvedValueOnce([
        row('hb', {}),
        row('db', { lich_nguon_id: 'p4', trang_thai: 'da_duyet', lich_chot_id: 'lc', loai: 'doi_buoi' }),
      ])
      .mockResolvedValue([
        {
          id: 'hb',
          tao_luc: new Date(Date.now() - 5000),
          lich_de_nghi_id: 'ld',
          loai: 'hoc_bu',
          lich_nguon: { thoi_gian_bat_dau: hqua },
        },
      ]);
    s.query.lichTomTat.mockResolvedValue(
      new Map([
        ['p3', qua('p3', 3000)],
        ['p4', qua('p4', 4000)],
        ['ld', lich('ld', 'lopB')],
        ['lc', lich('lc', 'lopC')],
      ]),
    );
    return { ...s, lichFindMany };
  }

  it('tong quan: so_buoi_hoc_bu_toi_da, luot tach loai, buoi_co_the_hoc_bu (bo co_mat + da doi buoi), truy van co dinh', async () => {
    const s = setupTq();
    const r = await s.svc.tongQuanHocVien(user, 'k1');
    expect(r.so_buoi_hoc_bu_toi_da).toBe(2);
    expect(r.so_luot_hoc_bu_da_dung).toBe(1);
    expect(r.so_luot_da_dung).toBe(1);
    expect(r.buoi_co_the_hoc_bu.map((b) => b.lich_nguon.id)).toEqual(['p2', 'p3']);
    expect(r.buoi_co_the_hoc_bu[0]).toMatchObject({
      trang_thai_diem_danh: 'vang',
      de_nghi: null,
    });
    expect(r.buoi_co_the_hoc_bu[1]).toMatchObject({
      trang_thai_diem_danh: null,
      de_nghi: { id: 'hb', loai: 'hoc_bu', qua_han: false, thu_tu_hang: { k: 1, n: 1 } },
    });
    expect(r.de_nghi.map((d) => [d.id, d.loai])).toEqual([
      ['hb', 'hoc_bu'],
      ['db', 'doi_buoi'],
    ]);
    // buổi đã qua: 30 gần nhất, 1 truy vấn; điểm danh: 1 truy vấn.
    const daQua = s.lichFindMany.mock.calls.filter(
      (c) => (c[0] as any).where.thoi_gian_bat_dau?.lte,
    );
    expect(daQua).toHaveLength(1);
    expect(daQua[0][0]).toMatchObject({
      orderBy: { thoi_gian_bat_dau: 'desc' },
      take: 30,
    });
    expect((s.prisma as any).diem_danh.findMany).toHaveBeenCalledTimes(1);
    expect((s.prisma as any).diem_danh.findMany).toHaveBeenCalledWith({
      where: { dang_ky_hoc_id: 'dk1', lich_hoc_id: { in: ['p1', 'p2', 'p3', 'p4'] } },
      select: { lich_hoc_id: true, trang_thai: true },
    });
  });

  it('tong quan: hoc bu tat -> khong truy van buoi da qua / diem danh', async () => {
    const s = setupTq({ hocBu: 0 });
    const r = await s.svc.tongQuanHocVien(user, 'k1');
    expect(r.buoi_co_the_hoc_bu).toEqual([]);
    expect(
      s.lichFindMany.mock.calls.some((c) => (c[0] as any).where.thoi_gian_bat_dau?.lte),
    ).toBe(false);
    expect((s.prisma as any).diem_danh.findMany).not.toHaveBeenCalled();
  });

  it('tong quan: doi buoi tat + hoc bu bat -> khong 403, buoi_sap_toi rong', async () => {
    const s = setupTq({ doi: 0 });
    const r = await s.svc.tongQuanHocVien(user, 'k1');
    expect(r.buoi_sap_toi).toEqual([]);
    expect(r.buoi_co_the_hoc_bu.length).toBeGreaterThan(0);
  });

  it('tong quan: ca hai tat -> 403', async () => {
    const s = setupTq({ doi: 0, hocBu: 0 });
    await expect(s.svc.tongQuanHocVien(user, 'k1')).rejects.toMatchObject({
      status: 403,
    });
  });

  describe('luaChonHocVien loai=hoc_bu', () => {
    function setupLc() {
      const s = setupTq();
      const p = s.prisma as Record<string, any>;
      s.query.lichTomTat.mockResolvedValue(
        new Map([['ln', lich('ln', 'lopA', { thoi_gian_bat_dau: hqua })]]),
      );
      p.lich_hoc_lop.findMany = jest.fn(async () => [lich('ld', 'lopB')]);
      p.diem_danh.findMany = jest.fn(async () => [] as unknown[]);
      p.doi_buoi_hoc.findFirst = jest.fn(async () => null);
      s.query.siSoBuoi.mockResolvedValue(
        new Map([['ld', { si_so: 1, si_so_toi_da: 40, so_cho_duyet: 0 }]]),
      );
      return { ...s, p };
    }

    it('buoi goc da qua, khong co mat -> ung vien chua bat dau', async () => {
      const { svc, p } = setupLc();
      const r = await svc.luaChonHocVien(user, 'ln', 'hoc_bu');
      expect(r.map((x) => x.lich.id)).toEqual(['ld']);
      expect(p.diem_danh.findMany).toHaveBeenCalledWith({
        where: { dang_ky_hoc_id: 'dk1', lich_hoc_id: { in: ['ln'] } },
        select: { lich_hoc_id: true, trang_thai: true },
      });
    });

    it('buoi goc chua dien ra -> 400 CHUA_DIEN_RA', async () => {
      const { svc, query } = setupLc();
      query.lichTomTat.mockResolvedValue(new Map([['ln', lich('ln', 'lopA')]]));
      await expect(svc.luaChonHocVien(user, 'ln', 'hoc_bu')).rejects.toMatchObject({
        status: 400,
      });
    });

    it('co mat -> 400 DA_CO_MAT', async () => {
      const { svc, p } = setupLc();
      p.diem_danh.findMany.mockResolvedValueOnce([
        { lich_hoc_id: 'ln', trang_thai: 'co_mat' },
      ]);
      await expect(svc.luaChonHocVien(user, 'ln', 'hoc_bu')).rejects.toMatchObject({
        status: 400,
        response: {
          error: expect.objectContaining({
            message: 'Thầy/Cô đã có mặt buổi này, không cần học bù',
          }),
        },
      });
    });

    it('buoi goc da doi buoi da_duyet -> 400 DA_DOI_BUOI', async () => {
      const { svc, p } = setupLc();
      p.doi_buoi_hoc.findFirst.mockResolvedValueOnce({
        loai: 'doi_buoi',
        lich_chot_id: 'lc',
      });
      await expect(svc.luaChonHocVien(user, 'ln', 'hoc_bu')).rejects.toMatchObject({
        status: 400,
        response: {
          error: expect.objectContaining({
            message: 'Buổi này đã được đổi, liên hệ người hỗ trợ',
          }),
        },
      });
    });

    it('khoa chua bat hoc bu -> 403', async () => {
      const { svc, p } = setupLc();
      p.khoa_boi_duong.findUnique.mockResolvedValue({
        so_buoi_doi_toi_da: 2,
        so_buoi_hoc_bu_toi_da: 0,
      });
      await expect(svc.luaChonHocVien(user, 'ln', 'hoc_bu')).rejects.toMatchObject({
        status: 403,
      });
    });
  });
});

describe('DoiBuoiHocService hoc bu (nguoi duyet)', () => {
  const quanTri = { id: 'qt', vai_tro: 'quan_tri' } as AuthenticatedUser;
  const ghiChu = { ghi_chu: 'Da trao doi voi hoc vien' };
  const deNghiHb = (over: object = {}) => ({
    id: 'x1',
    trang_thai: 'cho_duyet',
    dang_ky_hoc_id: 'dk1',
    lich_nguon_id: 'ln',
    lich_de_nghi_id: 'ld',
    lich_chot_id: null,
    tao_luc: new Date(Date.now() - 60_000),
    loai: 'hoc_bu',
    dang_ky_hoc: { hoc_vien_id: 'hv1' },
    ...over,
  });

  function setupD(over: object = {}) {
    const tx = {
      $executeRaw: jest.fn(async (..._a: unknown[]) => 0),
      $queryRaw: jest.fn(async (..._a: unknown[]) => [] as unknown[]),
      doi_buoi_hoc: {
        findUnique: jest.fn(async () => deNghiHb(over)),
        findFirst: jest.fn(async (_a?: unknown) => null as unknown),
        count: jest.fn(async (_a?: unknown) => 0),
        updateMany: jest.fn(async (_a?: unknown) => ({ count: 1 })),
      },
      phan_lop_giai_doan: { findFirst: jest.fn(async () => ({ lop_id: 'lopA' })) },
      diem_danh: {
        findMany: jest.fn(async (_a?: unknown) => [] as unknown[]),
        findFirst: jest.fn(async (_a?: unknown) => null as unknown),
      },
    };
    const prisma = {
      $transaction: jest.fn((cb: (t: unknown) => unknown) => cb(tx)),
      $queryRaw: jest.fn(async (..._a: unknown[]) => [] as unknown[]),
      doi_buoi_hoc: {
        findFirst: jest.fn(async (_a?: unknown) => deNghiHb(over) as unknown),
        findMany: jest.fn(async (_a?: unknown) => [] as unknown[]),
        count: jest.fn(async (_a?: unknown) => 0),
        groupBy: jest.fn(async (_a?: unknown) => [] as unknown[]),
        updateMany: jest.fn(async (_a?: unknown) => ({ count: 1 })),
      },
      lich_hoc_lop: { findMany: jest.fn(async () => [lich('ld', 'lopB')]) },
      phan_lop_giai_doan: { findMany: jest.fn(async () => [] as unknown[]) },
    };
    const lichMap = new Map([
      ['ln', lich('ln', 'lopA', { thoi_gian_bat_dau: hqua })],
      ['ld', lich('ld', 'lopB')],
      ['lc', lich('lc', 'lopC')],
    ]);
    const query = {
      lichTomTat: jest.fn(async (..._a: unknown[]) => lichMap),
      siSoBuoi: jest.fn(
        async (ids: string[], ..._r: unknown[]) =>
          new Map(ids.map((i) => [i, { si_so: 5, si_so_toi_da: 40, so_cho_duyet: 0 }])),
      ),
      doiBuoiDaDuyetCuaDangKy: jest.fn(async () => [] as unknown[]),
    };
    const nhatKy = { ghi: jest.fn(async (_a?: unknown) => undefined) };
    const svc = new DoiBuoiHocService(
      prisma as never,
      query as never,
      nhatKy as never,
      { cumIdsCuaToi: jest.fn(async () => ['c1']) } as never,
    );
    return { svc, tx, prisma, query, nhatKy, lichMap };
  }

  it('duyet: buoi goc da qua + vang -> duyet, khong chan D2/D12 buoi goc; nhat ky co loai', async () => {
    const { svc, tx, nhatKy } = setupD();
    tx.diem_danh.findMany.mockResolvedValueOnce([
      { lich_hoc_id: 'ln', trang_thai: 'vang' },
    ]);
    await expect(svc.duyet(quanTri, 'x1', {})).resolves.toEqual({
      trang_thai: 'da_duyet',
      canh_bao: [],
    });
    expect(tx.$executeRaw.mock.calls[0][1]).toBe('doi_buoi:ld');
    expect(nhatKy.ghi).toHaveBeenCalledWith(
      expect.objectContaining({
        hanh_dong: 'duyet_doi_buoi',
        chi_tiet: expect.objectContaining({ loai: 'hoc_bu', lich_chot_id: 'ld' }),
      }),
    );
  });

  it('duyet: hoc vien duoc ghi co_mat SAU khi gui -> 400 DA_CO_MAT (doc trong tx sau lock), khong cap nhat', async () => {
    const { svc, tx, nhatKy } = setupD();
    tx.diem_danh.findMany.mockResolvedValueOnce([
      { lich_hoc_id: 'ln', trang_thai: 'co_mat' },
    ]);
    await expect(svc.duyet(quanTri, 'x1', {})).rejects.toMatchObject({
      status: 400,
      response: {
        error: expect.objectContaining({
          message: 'Học viên đã có mặt buổi này, không cần học bù',
        }),
      },
    });
    expect(tx.diem_danh.findMany).toHaveBeenCalledWith({
      where: { dang_ky_hoc_id: 'dk1', lich_hoc_id: { in: ['ln'] } },
      select: { lich_hoc_id: true, trang_thai: true },
    });
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.diem_danh.findMany.mock.invocationCallOrder[0],
    );
    expect(tx.doi_buoi_hoc.updateMany).not.toHaveBeenCalled();
    expect(nhatKy.ghi).not.toHaveBeenCalled();
  });

  it('duyet: buoi goc co doi buoi da_duyet -> 400 DA_DOI_BUOI, khong ha ban doi buoi', async () => {
    const { svc, tx } = setupD();
    tx.doi_buoi_hoc.findFirst.mockResolvedValueOnce({
      id: 'db',
      lich_chot_id: 'lc',
      loai: 'doi_buoi',
    });
    await expect(svc.duyet(quanTri, 'x1', {})).rejects.toMatchObject({
      status: 400,
      response: {
        error: expect.objectContaining({
          message: 'Buổi này đã được đổi, liên hệ người hỗ trợ',
        }),
      },
    });
    expect(tx.doi_buoi_hoc.findFirst).toHaveBeenCalledWith({
      where: {
        dang_ky_hoc_id: 'dk1',
        lich_nguon_id: 'ln',
        trang_thai: 'da_duyet',
        id: { not: 'x1' },
      },
      select: { id: true, lich_chot_id: true, loai: true },
    });
    expect(tx.doi_buoi_hoc.updateMany).not.toHaveBeenCalled();
  });

  it('duyet doi lai hoc bu: ha ban hoc bu cu roi nang ban moi', async () => {
    const { svc, tx } = setupD();
    tx.doi_buoi_hoc.findFirst.mockResolvedValueOnce({
      id: 'cu',
      lich_chot_id: 'lc',
      loai: 'hoc_bu',
    });
    await expect(svc.duyet(quanTri, 'x1', {})).resolves.toMatchObject({
      trang_thai: 'da_duyet',
    });
    expect(tx.doi_buoi_hoc.updateMany).toHaveBeenCalledTimes(2);
  });

  it('tuChoi: nhat ky co loai hoc_bu', async () => {
    const { svc, nhatKy } = setupD();
    await svc.tuChoi(quanTri, 'x1', ghiChu);
    expect(nhatKy.ghi).toHaveBeenCalledWith(
      expect.objectContaining({
        chi_tiet: { de_nghi_id: 'x1', tu_choi: true, loai: 'hoc_bu' },
      }),
    );
  });

  it('huyDuyet hoc bu: buoi goc da qua khong chan, khong doc si so buoi goc', async () => {
    const { svc, query, tx } = setupD({ trang_thai: 'da_duyet', lich_chot_id: 'lc' });
    await expect(svc.huyDuyet(quanTri, 'x1', ghiChu)).resolves.toEqual({
      trang_thai: 'da_huy',
      canh_bao: [],
    });
    expect(query.siSoBuoi).not.toHaveBeenCalled();
    expect(tx.doi_buoi_hoc.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'x1', trang_thai: 'da_duyet' } }),
    );
  });

  it('huyDuyet hoc bu: buoi hoc bu da bat dau -> 400', async () => {
    const { svc, lichMap, tx } = setupD({ trang_thai: 'da_duyet', lich_chot_id: 'lc' });
    lichMap.set('lc', lich('lc', 'lopC', { thoi_gian_bat_dau: hqua }));
    await expect(svc.huyDuyet(quanTri, 'x1', ghiChu)).rejects.toMatchObject({
      status: 400,
    });
    expect(tx.doi_buoi_hoc.updateMany).not.toHaveBeenCalled();
  });

  it('luaChonDuyet hoc bu: duyet_duoc du buoi goc da qua', async () => {
    const { svc, prisma } = setupD();
    prisma.doi_buoi_hoc.findFirst
      .mockResolvedValueOnce(deNghiHb())
      .mockResolvedValueOnce(null);
    const r = await svc.luaChonDuyet(quanTri, 'x1');
    expect(r.map((x) => [x.lich.id, x.duyet_duoc])).toEqual([['ld', true]]);
  });

  it('danhSach: tra loai; cho duyet con han khong loai hoc bu co buoi goc da qua; loc loai', async () => {
    const { svc, prisma } = setupD();
    prisma.doi_buoi_hoc.findMany.mockResolvedValueOnce([
      {
        ...deNghiHb(),
        ly_do: 'abcde',
        ghi_chu_xu_ly: null,
        nguoi_xu_ly: null,
        dang_ky_hoc: {
          hoc_vien: { id: 'hv1', ho_ten: 'A', don_vi_cong_tac: { ten_don_vi: 'T' } },
          cum: null,
        },
        xu_ly_boi: null,
      },
    ]);
    prisma.doi_buoi_hoc.findMany.mockResolvedValueOnce([]); // đổi lại: bản đã duyệt
    prisma.doi_buoi_hoc.findMany.mockResolvedValueOnce([
      {
        id: 'x1',
        tao_luc: new Date(Date.now() - 60_000),
        lich_de_nghi_id: 'ld',
        loai: 'hoc_bu',
        lich_nguon: { thoi_gian_bat_dau: hqua },
      },
    ]);
    const r = await svc.danhSach(quanTri, { trang_thai: 'cho_duyet', loai: 'hoc_bu' });
    expect(r[0]).toMatchObject({ id: 'x1', loai: 'hoc_bu', qua_han: false, thu_tu_hang: { k: 1, n: 1 } });
    const where = (prisma.doi_buoi_hoc.findMany.mock.calls[0][0] as any).where;
    expect(where.loai).toBe('hoc_bu');
    expect(where.OR).toEqual([
      { loai: 'hoc_bu' },
      { lich_nguon: { thoi_gian_bat_dau: { gt: expect.any(Date) } } },
    ]);
    expect(where.lich_de_nghi.thoi_gian_bat_dau.gt).toBeInstanceOf(Date);
  });

  it('danhSach qua han: buoi goc da bat dau chi tinh cho doi buoi', async () => {
    const { svc, prisma } = setupD();
    await svc.danhSach(quanTri, { trang_thai: 'cho_duyet', qua_han: true });
    const where = (prisma.doi_buoi_hoc.findMany.mock.calls[0][0] as any).where;
    expect(where.OR[0]).toEqual({
      loai: 'doi_buoi',
      lich_nguon: { thoi_gian_bat_dau: { lte: expect.any(Date) } },
    });
  });

  it('demChoDuyet: loc loai + hoc bu khong bi loai vi buoi goc da qua', async () => {
    const { svc, prisma } = setupD();
    await svc.demChoDuyet(quanTri, 'hoc_bu');
    const where = (prisma.doi_buoi_hoc.count.mock.calls[0][0] as any).where;
    expect(where.loai).toBe('hoc_bu');
    expect(where.OR).toEqual([
      { loai: 'hoc_bu' },
      { lich_nguon: { thoi_gian_bat_dau: { gt: expect.any(Date) } } },
    ]);
  });

  it('idQuaHanThem: hoc bu xet buoi goc co_mat va ban da duyet khac loai', async () => {
    const { svc, prisma } = setupD();
    await svc.demChoDuyet(quanTri);
    const [strings] = prisma.$queryRaw.mock.calls[0] as [TemplateStringsArray];
    const sql = strings.join('?').replace(/\s+/g, ' ');
    expect(sql).toContain("(c.loai = 'hoc_bu' OR ln.thoi_gian_bat_dau > ?)");
    expect(sql).toContain("(c.loai = 'doi_buoi' OR dd.trang_thai = 'co_mat')");
    expect(sql).toContain('d.loai <> c.loai');
  });

  // Hoc bu da gui, sau do ho tro diem danh bo sung co_mat o buoi goc -> qua han,
  // ly do phai noi ro (khong phai "buoi da bat dau").
  const rowDuyet = (over: object = {}) => ({
    ...deNghiHb(),
    ly_do: 'abcde',
    ghi_chu_xu_ly: null,
    nguoi_xu_ly: null,
    dang_ky_hoc: {
      hoc_vien: { id: 'hv1', ho_ten: 'A', don_vi_cong_tac: { ten_don_vi: 'T' } },
      cum: null,
    },
    xu_ly_boi: null,
    ...over,
  });

  it('ly_do_qua_han: hoc bu, buoi goc da co_mat -> da_co_mat', async () => {
    const { svc, prisma } = setupD();
    prisma.doi_buoi_hoc.findMany.mockResolvedValueOnce([rowDuyet()]);
    prisma.$queryRaw.mockResolvedValue([{ id: 'x1', ly_do: 'da_co_mat' }]);
    const r = await svc.danhSach(quanTri, {});
    expect(r[0]).toMatchObject({ id: 'x1', qua_han: true, ly_do_qua_han: 'da_co_mat' });
  });

  it('ly_do_qua_han: hoc bu, buoi hoc bu da bat dau -> buoi_de_nghi_bat_dau', async () => {
    const { svc, prisma, lichMap } = setupD();
    lichMap.set('ld', lich('ld', 'lopB', { thoi_gian_bat_dau: hqua }));
    prisma.doi_buoi_hoc.findMany.mockResolvedValueOnce([rowDuyet()]);
    const r = await svc.danhSach(quanTri, {});
    expect(r[0]).toMatchObject({ qua_han: true, ly_do_qua_han: 'buoi_de_nghi_bat_dau' });
  });

  it('ly_do_qua_han: doi buoi, buoi goc da bat dau -> buoi_goc_bat_dau', async () => {
    const { svc, prisma } = setupD();
    prisma.doi_buoi_hoc.findMany.mockResolvedValueOnce([rowDuyet({ loai: 'doi_buoi' })]);
    const r = await svc.danhSach(quanTri, {});
    expect(r[0]).toMatchObject({ qua_han: true, ly_do_qua_han: 'buoi_goc_bat_dau' });
  });

  it('ly_do_qua_han: hoc bu con han -> null', async () => {
    const { svc, prisma } = setupD();
    prisma.doi_buoi_hoc.findMany.mockResolvedValueOnce([rowDuyet()]);
    const r = await svc.danhSach(quanTri, {});
    expect(r[0]).toMatchObject({ qua_han: false, ly_do_qua_han: null });
  });

  it('quaHanThem: SQL tra ly do theo tung nhanh', async () => {
    const { svc, prisma } = setupD();
    await svc.demChoDuyet(quanTri);
    const [strings] = prisma.$queryRaw.mock.calls[0] as [TemplateStringsArray];
    const sql = strings.join('?');
    for (const m of ['da_co_mat', 'da_diem_danh_buoi_goc', 'buoi_goc_da_duyet_khac', 'buoi_dang_hoc_bat_dau', 'da_diem_danh_buoi_dang_hoc'])
      expect(sql).toContain(`'${m}'`);
  });
});

// Review fix 1: đổi buổi chờ (đã quá hạn) cùng buổi gốc → tự hủy rồi tạo học bù.
describe('DoiBuoiHocService hoc bu: tu huy doi buoi cho qua han', () => {
  function setupTuHuy(hoatDong: unknown[]) {
    const s = setup({ hoatDong: hoatDong as never });
    s.prisma.khoa_boi_duong.findUnique.mockResolvedValue({
      so_buoi_doi_toi_da: 0,
      so_buoi_hoc_bu_toi_da: 1,
    } as never);
    s.query.lichTomTat.mockResolvedValue(
      new Map([
        ['ln', lich('ln', 'lopA', { thoi_gian_bat_dau: hqua })],
        ['ld', lich('ld', 'lopB')],
      ]),
    );
    return s;
  }
  const dtoHb = { ...dto, loai: 'hoc_bu' as const };

  it('doi buoi cho_duyet cung buoi goc -> updateMany da_huy (co dieu kien) roi create, khong 409; nhat ky tu_dong sau commit', async () => {
    const { svc, tx, nhatKy, order } = setupTuHuy([
      { id: 'cu-db', lich_nguon_id: 'ln', trang_thai: 'cho_duyet', lich_chot_id: null, loai: 'doi_buoi' },
    ]);
    tx.doi_buoi_hoc.create.mockImplementation(async () => {
      order.push('create');
      return { id: 'moi' };
    });
    await expect(svc.gui(user, dtoHb)).resolves.toEqual({ id: 'moi' });
    expect(tx.doi_buoi_hoc.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'cu-db',
        trang_thai: 'cho_duyet',
        loai: 'doi_buoi',
        dang_ky_hoc_id: 'dk1',
      },
      data: {
        trang_thai: 'da_huy',
        xu_ly_luc: expect.any(Date),
        ghi_chu_xu_ly: 'Tự hủy: đã quá hạn, học viên chuyển sang đăng ký học bù',
        nguoi_xu_ly: null,
      },
    });
    expect(order.indexOf('updateMany')).toBeLessThan(order.indexOf('create'));
    expect(order.indexOf('lock')).toBeLessThan(order.indexOf('updateMany'));
    expect(nhatKy.ghi).toHaveBeenCalledWith({
      hanh_dong: 'de_nghi_doi_buoi',
      hoc_vien_id: 'hv1',
      mo_ta: 'Tự hủy đổi buổi quá hạn khi đăng ký học bù',
      chi_tiet: { de_nghi_id: 'cu-db', tu_dong: true },
    });
    expect(tx.doi_buoi_hoc.create.mock.invocationCallOrder[0]).toBeLessThan(
      nhatKy.ghi.mock.invocationCallOrder[0],
    );
  });

  it('updateMany tu huy count=0 (doi buoi vua thay doi) -> 409, khong create', async () => {
    const { svc, tx } = setupTuHuy([
      { id: 'cu-db', lich_nguon_id: 'ln', trang_thai: 'cho_duyet', lich_chot_id: null, loai: 'doi_buoi' },
    ]);
    tx.doi_buoi_hoc.updateMany.mockResolvedValueOnce({ count: 0 } as never);
    await expect(svc.gui(user, dtoHb)).rejects.toMatchObject({
      status: 409,
      response: expect.objectContaining({
        error: expect.objectContaining({
          message: 'Đề nghị đổi buổi của buổi này vừa thay đổi, vui lòng thử lại',
        }),
      }),
    });
    expect(tx.doi_buoi_hoc.create).not.toHaveBeenCalled();
  });

  it('khong co doi buoi cho -> khong updateMany, khong nhat ky tu huy', async () => {
    const { svc, tx, nhatKy } = setupTuHuy([]);
    await svc.gui(user, dtoHb);
    expect(tx.doi_buoi_hoc.updateMany).not.toHaveBeenCalled();
    expect(nhatKy.ghi).toHaveBeenCalledTimes(1);
  });

  it('kiem tra hoc bu that bai (co_mat) -> khong tu huy', async () => {
    const { svc, tx } = setupTuHuy([
      { id: 'cu-db', lich_nguon_id: 'ln', trang_thai: 'cho_duyet', lich_chot_id: null, loai: 'doi_buoi' },
    ]);
    tx.diem_danh.findMany.mockResolvedValueOnce([
      { lich_hoc_id: 'ln', trang_thai: 'co_mat' },
    ] as never);
    await expect(svc.gui(user, dtoHb)).rejects.toMatchObject({ status: 400 });
    expect(tx.doi_buoi_hoc.updateMany).not.toHaveBeenCalled();
  });

  it('gui doi buoi khong tu huy gi', async () => {
    const { svc, tx } = setup({
      hoatDong: [
        { id: 'k', lich_nguon_id: 'khac', trang_thai: 'cho_duyet', lich_chot_id: null },
      ] as never,
    });
    await svc.gui(user, dto);
    expect(tx.doi_buoi_hoc.updateMany).not.toHaveBeenCalled();
  });

  it('lyDoHuy: ghi chu tu huy qua han -> hoc_vien_huy', () => {
    expect(
      lyDoHuy({
        trang_thai: 'da_huy',
        nguoi_xu_ly: null,
        ghi_chu_xu_ly: 'Tự hủy: đã quá hạn, học viên chuyển sang đăng ký học bù',
      }),
    ).toBe('hoc_vien_huy');
  });
});
