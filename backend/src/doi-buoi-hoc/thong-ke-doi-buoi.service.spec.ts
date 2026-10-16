import * as ExcelJS from 'exceljs';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ValidationException } from '../common/exceptions/app.exceptions';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ThongKeDoiBuoiService } from './thong-ke-doi-buoi.service';
import { LocThongKeDoiBuoiDto } from './dto/doi-buoi-hoc.dto';
import { buildThongKeDoiBuoiWorkbook } from './thong-ke-doi-buoi.excel';

const GIO = 3_600_000;
const sau = (h: number) => new Date(Date.now() + h * GIO);

const quanTri = { id: 'qt', vai_tro: 'quan_tri' } as AuthenticatedUser;
const hoTro = { id: 'ht', vai_tro: 'ho_tro_hoc_vien' } as AuthenticatedUser;

const KHOA_1 = { id: 'k1', ma_khoa: 'K1', ten_khoa: 'Khóa 1' };
const KHOA_2 = { id: 'k2', ma_khoa: 'K2', ten_khoa: 'Khóa 2' };

function lich(
  id: string,
  over: {
    lop?: string;
    muc?: 'co_ban' | 'thanh_thao' | 'nang_cao' | null;
    loai?: 'truc_tiep' | 'zoom' | 'vle';
    khoa?: typeof KHOA_1;
    gd?: string;
    batDau?: Date;
    toiDa?: number | null;
  } = {},
) {
  const khoa = over.khoa ?? KHOA_1;
  const lop = over.lop ?? `lop-${id}`;
  const gd = over.gd ?? 'gd1';
  const batDau = over.batDau ?? sau(48);
  return {
    id,
    lop_id: lop,
    giai_doan_id: gd,
    buoi_so: 1,
    thoi_gian_bat_dau: batDau,
    thoi_gian_ket_thuc: new Date(batDau.getTime() + 3 * GIO),
    lop: {
      id: lop,
      ten_lop: `Lớp ${id}`,
      muc_nang_luc: over.muc === undefined ? 'co_ban' : over.muc,
      loai_lop: over.loai ?? 'zoom',
      si_so_toi_da: over.toiDa === undefined ? 30 : over.toiDa,
      khoa,
    },
    giai_doan: { id: gd, khoa_id: khoa.id, thu_tu: 1, ten_giai_doan: 'GĐ 1' },
  };
}

type TrangThai = 'cho_duyet' | 'da_duyet' | 'tu_choi' | 'da_huy';

function deNghi(
  id: string,
  trang_thai: TrangThai,
  nguon: string,
  deNghiId: string,
  chot: string | null = null,
  cum: string | null = 'c1',
) {
  return {
    id,
    trang_thai,
    lich_nguon_id: nguon,
    lich_de_nghi_id: deNghiId,
    lich_chot_id: chot,
    ly_do: 'Bận công tác',
    tao_luc: new Date('2026-10-10T01:00:00Z'),
    xu_ly_luc:
      trang_thai === 'cho_duyet' ? null : new Date('2026-10-11T01:00:00Z'),
    ghi_chu_xu_ly: null as string | null,
    nguoi_xu_ly: null as string | null,
    xu_ly_boi: null as { ho_ten: string } | null,
    dang_ky_hoc: {
      cum: cum ? { id: cum, ten_cum: `Cụm ${cum}` } : null,
      hoc_vien: {
        ho_ten: `HV ${id}`,
        don_vi_cong_tac: { ten_don_vi: 'THPT A' },
      },
    },
  };
}

function setup(opts: {
  deNghi: ReturnType<typeof deNghi>[];
  lich: ReturnType<typeof lich>[];
  cumCuaToi?: string[];
}) {
  const prisma = {
    doi_buoi_hoc: { findMany: jest.fn(async () => opts.deNghi) },
    lich_hoc_lop: {
      findMany: jest.fn(
        async ({ where }: { where: { id: { in: string[] } } }) =>
          opts.lich.filter((l) => where.id.in.includes(l.id)),
      ),
    },
    phan_lop_giai_doan: {
      groupBy: jest.fn(async () =>
        opts.lich.map((l) => ({
          lop_id: l.lop_id,
          giai_doan_id: l.giai_doan_id,
          _count: { _all: 20 },
        })),
      ),
    },
  };
  const query = {
    siSoBuoi: jest.fn(async (ids: string[]) => {
      const m = new Map<
        string,
        { si_so: number; si_so_toi_da: number | null; so_cho_duyet: number }
      >();
      for (const id of ids) {
        const l = opts.lich.find((x) => x.id === id)!;
        m.set(id, {
          si_so: id === 'day' ? 30 : 21,
          si_so_toi_da: l.lop.si_so_toi_da,
          so_cho_duyet: 0,
        });
      }
      return m;
    }),
    lichTomTat: jest.fn(async (ids: string[]) => {
      const m = new Map();
      for (const l of opts.lich.filter((x) => ids.includes(x.id)))
        m.set(l.id, {
          ...l,
          lop: { ...l.lop, khoa_id: l.lop.khoa.id, trang_thai: 'active' },
        });
      return m;
    }),
  };
  const scope = { cumIdsCuaToi: jest.fn(async () => opts.cumCuaToi ?? ['c1']) };
  const nhatKy = { ghi: jest.fn(async () => undefined) };
  const service = new ThongKeDoiBuoiService(
    prisma as never,
    query as never,
    scope as never,
    nhatKy as never,
  );
  return { service, prisma, query, scope, nhatKy };
}

const dongCua = (kq: { dong: { lich: { id: string } }[] }, id: string) =>
  kq.dong.find((d) => d.lich.id === id);

describe('ThongKeDoiBuoiService.thongKe', () => {
  it('đếm ra/vào theo trạng thái: vào đã duyệt theo buổi chốt, vào từ chối theo buổi đề nghị, hủy theo chốt ?? đề nghị', async () => {
    const { service } = setup({
      lich: [lich('A'), lich('B'), lich('C'), lich('D')],
      deNghi: [
        deNghi('1', 'da_duyet', 'A', 'B', 'C'), // vào C (chốt khác đề nghị)
        deNghi('2', 'tu_choi', 'A', 'B'),
        deNghi('3', 'cho_duyet', 'A', 'B'),
        deNghi('4', 'da_huy', 'A', 'B', 'D'), // hủy duyệt: vào D
        deNghi('5', 'da_huy', 'D', 'B'), // học viên hủy: vào B
      ],
    });
    const kq = await service.thongKe(quanTri, {});
    expect(dongCua(kq, 'A')).toMatchObject({
      ra_da_duyet: 1,
      ra_cho: 1,
      ra_qua_han: 0,
      ra_tu_choi: 1,
      ra_huy: 1,
      vao_da_duyet: 0,
    });
    expect(dongCua(kq, 'B')).toMatchObject({
      vao_da_duyet: 0,
      vao_cho: 1,
      vao_tu_choi: 1,
      vao_huy: 1,
    });
    expect(dongCua(kq, 'C')).toMatchObject({ vao_da_duyet: 1, ra_da_duyet: 0 });
    expect(dongCua(kq, 'D')).toMatchObject({ vao_huy: 1, ra_huy: 1 });
  });

  it('chờ duyệt quá hạn (buổi nguồn hoặc buổi đề nghị đã bắt đầu) đếm riêng, không gộp vào chờ', async () => {
    const { service } = setup({
      lich: [
        lich('A', { batDau: sau(-1) }),
        lich('B'),
        lich('C'),
        lich('E', { batDau: sau(-2) }),
      ],
      deNghi: [
        deNghi('1', 'cho_duyet', 'A', 'B'),
        deNghi('2', 'cho_duyet', 'C', 'E'),
      ],
    });
    const kq = await service.thongKe(quanTri, {});
    expect(dongCua(kq, 'A')).toMatchObject({ ra_cho: 0, ra_qua_han: 1 });
    expect(dongCua(kq, 'B')).toMatchObject({ vao_cho: 0, vao_qua_han: 1 });
    expect(dongCua(kq, 'C')).toMatchObject({ ra_cho: 0, ra_qua_han: 1 });
    expect(kq.tong).toMatchObject({ cho_duyet: 0, qua_han: 2 });
  });

  it('tong đếm mỗi đề nghị 1 lần dù góp vào 2 dòng', async () => {
    const { service } = setup({
      lich: [lich('A'), lich('B'), lich('C')],
      deNghi: [
        deNghi('1', 'da_duyet', 'A', 'B', 'B'),
        deNghi('2', 'cho_duyet', 'A', 'C'),
        deNghi('3', 'tu_choi', 'B', 'C'),
        deNghi('4', 'da_huy', 'C', 'A'),
      ],
    });
    const kq = await service.thongKe(quanTri, {});
    expect(kq.dong).toHaveLength(3);
    expect(kq.tong).toEqual({
      de_nghi: 4,
      cho_duyet: 1,
      qua_han: 0,
      da_duyet: 1,
      tu_choi: 1,
      da_huy: 1,
      so_buoi_day: 0,
    });
  });

  it('sĩ số: phân lớp từ groupBy, sau đổi từ siSoBuoi, đầy khi si_so >= tối đa', async () => {
    const { service, prisma } = setup({
      lich: [
        lich('A', { lop: 'L1' }),
        lich('day', { lop: 'L2', toiDa: 30 }),
        lich('X', { toiDa: null }),
      ],
      deNghi: [
        deNghi('1', 'cho_duyet', 'A', 'day'),
        deNghi('2', 'cho_duyet', 'X', 'A'),
      ],
    });
    const kq = await service.thongKe(quanTri, {});
    expect(dongCua(kq, 'day')).toMatchObject({
      si_so_phan_lop: 20,
      si_so: 30,
      si_so_toi_da: 30,
      day: true,
    });
    expect(dongCua(kq, 'A')).toMatchObject({ si_so: 21, day: false });
    expect(dongCua(kq, 'X')).toMatchObject({ si_so_toi_da: null, day: false });
    expect(kq.tong.so_buoi_day).toBe(1);
    expect(prisma.phan_lop_giai_doan.groupBy).toHaveBeenCalledWith({
      by: ['lop_id', 'giai_doan_id'],
      where: {
        lop_id: { in: expect.arrayContaining(['L1', 'L2', 'lop-X']) },
        giai_doan_id: { in: ['gd1'] },
      },
      _count: { _all: true },
    });
  });

  it('số truy vấn cố định, không N+1; assert where các truy vấn Prisma', async () => {
    const ds = Array.from({ length: 30 }, (_, i) =>
      deNghi(`${i}`, 'cho_duyet', i % 2 ? 'A' : 'B', i % 3 ? 'C' : 'D'),
    );
    const { service, prisma, query, scope } = setup({
      lich: [lich('A'), lich('B'), lich('C'), lich('D')],
      deNghi: ds,
    });
    await service.thongKe(hoTro, {});
    expect(scope.cumIdsCuaToi).toHaveBeenCalledTimes(1);
    expect(prisma.doi_buoi_hoc.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.lich_hoc_lop.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.phan_lop_giai_doan.groupBy).toHaveBeenCalledTimes(1);
    expect(query.siSoBuoi).toHaveBeenCalledTimes(1);
    const arg = (
      prisma.doi_buoi_hoc.findMany.mock.calls[0] as unknown[]
    )[0] as Record<string, unknown>;
    expect(arg.where).toEqual({ dang_ky_hoc: { cum_id: { in: ['c1'] } } });
    expect(arg.take).toBe(20_001);
    const argLich = (
      prisma.lich_hoc_lop.findMany.mock.calls[0] as unknown[]
    )[0] as { where: { id: { in: string[] } } };
    expect([...argLich.where.id.in].sort()).toEqual(['A', 'B', 'C', 'D']);
    expect(
      [...((query.siSoBuoi.mock.calls[0] as unknown[])[0] as string[])].sort(),
    ).toEqual(['A', 'B', 'C', 'D']);
  });

  it('quan_tri: không lọc phạm vi cụm', async () => {
    const { service, prisma, scope } = setup({
      lich: [lich('A'), lich('B')],
      deNghi: [deNghi('1', 'cho_duyet', 'A', 'B')],
    });
    await service.thongKe(quanTri, {});
    expect(scope.cumIdsCuaToi).not.toHaveBeenCalled();
    const arg = (
      prisma.doi_buoi_hoc.findMany.mock.calls[0] as unknown[]
    )[0] as Record<string, unknown>;
    expect(arg.where).toEqual({});
  });

  it('ho_tro không có cụm → rỗng, không truy vấn đề nghị', async () => {
    const { service, prisma } = setup({
      lich: [lich('A'), lich('B')],
      deNghi: [deNghi('1', 'cho_duyet', 'A', 'B')],
      cumCuaToi: [],
    });
    const kq = await service.thongKe(hoTro, {});
    expect(kq.dong).toEqual([]);
    expect(kq.tong.de_nghi).toBe(0);
    expect(prisma.doi_buoi_hoc.findMany).not.toHaveBeenCalled();
  });

  it('lọc cụm: chỉ đề nghị của học viên thuộc cụm chọn; ho_tro chọn cụm ngoài phạm vi → rỗng', async () => {
    const data = {
      lich: [lich('A'), lich('B'), lich('C')],
      deNghi: [
        deNghi('1', 'cho_duyet', 'A', 'B', null, 'c1'),
        deNghi('2', 'cho_duyet', 'C', 'B', null, 'c2'),
      ],
      cumCuaToi: ['c1'],
    };
    const qt = await setup(data).service.thongKe(quanTri, { cum_id: ['c2'] });
    expect(qt.dong.map((d) => d.lich.id).sort()).toEqual(['B', 'C']);
    expect(qt.tong.de_nghi).toBe(1);
    // ho_tro: DB đã lọc theo cụm của mình (mock trả cả 2 → lọc bộ nhớ phải giao lại)
    const ht = await setup(data).service.thongKe(hoTro, { cum_id: ['c2'] });
    expect(ht.dong).toEqual([]);
  });

  it('lọc buổi áp lên dòng: mức/lớp/khóa/loại/giai đoạn — đề nghị A→B chỉ còn dòng qua lọc', async () => {
    const data = {
      lich: [
        lich('A', { muc: 'co_ban', lop: 'L1' }),
        lich('B', { muc: 'nang_cao', lop: 'L2', loai: 'truc_tiep' }),
        lich('K', { khoa: KHOA_2, gd: 'gd2' }),
        lich('K2', { khoa: KHOA_2, gd: 'gd2' }),
      ],
      deNghi: [
        deNghi('1', 'cho_duyet', 'A', 'B'),
        deNghi('2', 'cho_duyet', 'K', 'K2'),
      ],
    };
    const ids = async (loc: LocThongKeDoiBuoiDto) =>
      (await setup(data).service.thongKe(quanTri, loc)).dong
        .map((d) => d.lich.id)
        .sort();
    expect(await ids({ muc_nang_luc: ['nang_cao'] })).toEqual(['B']);
    expect(await ids({ lop_id: ['L1'] })).toEqual(['A']);
    expect(await ids({ khoa_id: 'k2' })).toEqual(['K', 'K2']);
    expect(await ids({ giai_doan_id: 'gd1' })).toEqual(['A', 'B']);
    expect(await ids({ loai_lop: ['zoom'] })).toEqual(['A', 'K', 'K2']);
    const kq = await setup(data).service.thongKe(quanTri, {
      muc_nang_luc: ['nang_cao'],
    });
    expect(kq.tong.de_nghi).toBe(1);
  });

  it('lọc ngày theo giờ VN: buổi 23:30 VN ngày 20 (16:30Z) thuộc ngày 20', async () => {
    const data = {
      lich: [
        lich('A', { batDau: new Date('2026-11-20T16:30:00Z') }), // 23:30 VN 20/11
        lich('B', { batDau: new Date('2026-11-20T17:30:00Z') }), // 00:30 VN 21/11
        lich('C', { batDau: new Date('2026-11-19T16:59:00Z') }), // 23:59 VN 19/11
      ],
      deNghi: [
        deNghi('1', 'cho_duyet', 'A', 'B'),
        deNghi('2', 'cho_duyet', 'C', 'A'),
      ],
    };
    const kq = await setup(data).service.thongKe(quanTri, {
      tu_ngay: '2026-11-20',
      den_ngay: '2026-11-20',
    });
    expect(kq.dong.map((d) => d.lich.id)).toEqual(['A']);
  });

  it('chi_co_cho: chỉ giữ buổi có ra_cho + vao_cho > 0', async () => {
    const { service } = setup({
      lich: [lich('A'), lich('B'), lich('C'), lich('D')],
      deNghi: [
        deNghi('1', 'cho_duyet', 'A', 'B'),
        deNghi('2', 'tu_choi', 'C', 'D'),
      ],
    });
    const kq = await service.thongKe(quanTri, { chi_co_cho: true });
    expect(kq.dong.map((d) => d.lich.id).sort()).toEqual(['A', 'B']);
    expect(kq.tong.de_nghi).toBe(1);
  });

  it('bo_loc lấy từ đề nghị trong phạm vi, trước lọc buổi/cụm', async () => {
    const { service } = setup({
      lich: [
        lich('A'),
        lich('K', { khoa: KHOA_2, gd: 'gd2' }),
        lich('K2', { khoa: KHOA_2, gd: 'gd2' }),
      ],
      deNghi: [
        deNghi('1', 'cho_duyet', 'A', 'A', null, 'c1'),
        deNghi('2', 'cho_duyet', 'K', 'K2', null, 'c2'),
      ],
    });
    const kq = await service.thongKe(quanTri, {
      khoa_id: 'k1',
      cum_id: ['c1'],
    });
    expect(kq.bo_loc.khoa.map((k) => k.id)).toEqual(['k1', 'k2']);
    expect(kq.bo_loc.giai_doan.map((g) => g.id).sort()).toEqual(['gd1', 'gd2']);
    expect(kq.bo_loc.lop).toHaveLength(3);
    expect(kq.bo_loc.lop[0]).toEqual({
      id: 'lop-A',
      khoa_id: 'k1',
      ten_lop: 'Lớp A',
      muc_nang_luc: 'co_ban',
      loai_lop: 'zoom',
    });
    expect(kq.bo_loc.cum).toEqual([
      { id: 'c1', ten_cum: 'Cụm c1' },
      { id: 'c2', ten_cum: 'Cụm c2' },
    ]);
  });

  it('sắp theo giờ bắt đầu rồi tên lớp; dòng có thông tin lớp/giai đoạn/khóa', async () => {
    const t = sau(10);
    const { service } = setup({
      lich: [
        lich('Z', { batDau: t }),
        lich('B', { batDau: t }),
        lich('A', { batDau: sau(20) }),
      ],
      deNghi: [
        deNghi('1', 'cho_duyet', 'Z', 'A'),
        deNghi('2', 'cho_duyet', 'B', 'A'),
      ],
    });
    const kq = await service.thongKe(quanTri, {});
    expect(kq.dong.map((d) => d.lich.id)).toEqual(['B', 'Z', 'A']);
    expect(kq.dong[0].lich).toEqual({
      id: 'B',
      buoi_so: 1,
      thoi_gian_bat_dau: t,
      thoi_gian_ket_thuc: new Date(t.getTime() + 3 * GIO),
      lop: {
        id: 'lop-B',
        ten_lop: 'Lớp B',
        muc_nang_luc: 'co_ban',
        loai_lop: 'zoom',
      },
      giai_doan: { id: 'gd1', thu_tu: 1, ten_giai_doan: 'GĐ 1' },
      khoa: KHOA_1,
    });
    expect(kq.gioi_han).toBe(false);
  });

  it('tu_ngay > den_ngay → 400, không truy vấn', async () => {
    const { service, prisma } = setup({ lich: [], deNghi: [] });
    const loc = { tu_ngay: '2026-11-21', den_ngay: '2026-11-20' };
    await expect(service.thongKe(quanTri, loc)).rejects.toThrow(
      ValidationException,
    );
    await expect(service.thongKe(quanTri, loc)).rejects.toMatchObject({
      response: {
        error: { message: 'Từ ngày phải trước hoặc bằng đến ngày' },
      },
    });
    await expect(service.xuatExcel(quanTri, loc)).rejects.toThrow(
      ValidationException,
    );
    expect(prisma.doi_buoi_hoc.findMany).not.toHaveBeenCalled();
    // bằng nhau thì hợp lệ
    await expect(
      service.thongKe(quanTri, {
        tu_ngay: '2026-11-20',
        den_ngay: '2026-11-20',
      }),
    ).resolves.toBeDefined();
  });

  it('DTO: ngày không tồn tại (2026-02-31) hoặc sai dạng bị từ chối', async () => {
    const loi = async (q: Record<string, string>) =>
      (await validate(plainToInstance(LocThongKeDoiBuoiDto, q))).map(
        (e) => e.property,
      );
    expect(await loi({ tu_ngay: '2026-02-31' })).toEqual(['tu_ngay']);
    expect(await loi({ den_ngay: '2026-2-3' })).toEqual(['den_ngay']);
    expect(
      await loi({ tu_ngay: '2026-02-28', den_ngay: '2024-02-29' }),
    ).toEqual([]);
  });

  it('bo_loc.giai_doan sắp theo ma_khoa (không theo UUID) rồi thu_tu', async () => {
    const khoaA = { id: 'zz-uuid', ma_khoa: 'A01', ten_khoa: 'Khóa A' };
    const khoaB = { id: 'aa-uuid', ma_khoa: 'B01', ten_khoa: 'Khóa B' };
    const { service } = setup({
      lich: [
        lich('B', { khoa: khoaB, gd: 'gdB' }),
        lich('A', { khoa: khoaA, gd: 'gdA' }),
      ],
      deNghi: [deNghi('1', 'cho_duyet', 'B', 'A')],
    });
    const kq = await service.thongKe(quanTri, {});
    expect(kq.bo_loc.giai_doan.map((g) => g.id)).toEqual(['gdA', 'gdB']);
  });

  it('so_buoi_day đếm trước khi cắt 1.000 dòng', async () => {
    const ds = Array.from({ length: 1000 }, (_, i) =>
      lich(`L${i}`, { batDau: sau(10 + i) }),
    );
    ds.push(lich('day', { batDau: sau(5000) })); // dòng thứ 1001 — bị cắt, nhưng đầy
    const { service } = setup({
      lich: ds,
      deNghi: ds.map((l, i) => deNghi(`${i}`, 'cho_duyet', l.id, l.id)),
    });
    const kq = await service.thongKe(quanTri, {});
    expect(kq.gioi_han).toBe(true);
    expect(kq.dong).toHaveLength(1000);
    expect(kq.dong.some((d) => d.lich.id === 'day')).toBe(false);
    expect(kq.tong.so_buoi_day).toBe(1);
  });

  it('vượt 20.000 đề nghị → gioi_han và cắt', async () => {
    const ds = Array.from({ length: 20_001 }, (_, i) =>
      deNghi(`${i}`, 'cho_duyet', 'A', 'B'),
    );
    const { service } = setup({ lich: [lich('A'), lich('B')], deNghi: ds });
    const kq = await service.thongKe(quanTri, {});
    expect(kq.gioi_han).toBe(true);
    expect(kq.tong.de_nghi).toBe(20_000);
  });

  it('không có đề nghị → rỗng, không gọi siSoBuoi', async () => {
    const { service, query } = setup({ lich: [], deNghi: [] });
    const kq = await service.thongKe(quanTri, {});
    expect(kq.dong).toEqual([]);
    expect(query.siSoBuoi).not.toHaveBeenCalled();
  });
});

describe('ThongKeDoiBuoiService.chiTietBuoi', () => {
  it('tách ra/vào, buổi kia, nhãn lý do hủy; where lọc buổi + cụm', async () => {
    const huyDuyet = {
      ...deNghi('4', 'da_huy', 'B', 'A', 'A'),
      nguoi_xu_ly: 'u9',
      xu_ly_boi: { ho_ten: 'Cô Hà' },
    };
    const { service, prisma } = setup({
      lich: [lich('A'), lich('B'), lich('C')],
      deNghi: [
        deNghi('1', 'da_duyet', 'A', 'B', 'C'),
        deNghi('2', 'cho_duyet', 'B', 'A'),
        deNghi('3', 'da_duyet', 'B', 'A', 'C'), // đề nghị A nhưng chốt C → không vào A
        huyDuyet,
      ],
      cumCuaToi: ['c1', 'c2'],
    });
    const kq = await service.chiTietBuoi(hoTro, 'A', { cum_id: ['c2', 'c9'] });
    expect(prisma.doi_buoi_hoc.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { lich_nguon_id: 'A' },
            { lich_de_nghi_id: 'A' },
            { lich_chot_id: 'A' },
          ],
          dang_ky_hoc: { cum_id: { in: ['c2'] } },
        },
      }),
    );
    expect(kq.ra.map((r) => r.de_nghi_id)).toEqual(['1']);
    expect(kq.ra[0]).toMatchObject({
      ho_ten: 'HV 1',
      don_vi: 'THPT A',
      cum: 'Cụm c1',
      trang_thai: 'da_duyet',
    });
    expect(kq.ra[0].buoi_kia?.id).toBe('C');
    expect(kq.vao.map((r) => r.de_nghi_id)).toEqual(['2', '4']);
    expect(kq.vao[0].buoi_kia?.id).toBe('B');
    expect(kq.vao[1]).toMatchObject({
      ly_do_huy: 'huy_duyet',
      nguoi_xu_ly: 'Cô Hà',
    });
  });

  it('ho_tro không có cụm → rỗng', async () => {
    const { service, prisma } = setup({ lich: [], deNghi: [], cumCuaToi: [] });
    expect(await service.chiTietBuoi(hoTro, 'A', {})).toEqual({
      ra: [],
      vao: [],
    });
    expect(prisma.doi_buoi_hoc.findMany).not.toHaveBeenCalled();
  });
});

describe('ThongKeDoiBuoiService.xuatExcel', () => {
  it('dựng file 2 sheet và ghi nhật ký xuất', async () => {
    const { service, nhatKy } = setup({
      lich: [lich('A'), lich('B'), lich('C')],
      deNghi: [
        deNghi('1', 'da_duyet', 'A', 'B', 'B'),
        deNghi('2', 'cho_duyet', 'C', 'B'),
      ],
    });
    const buf = await service.xuatExcel(quanTri, {});
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Thống kê theo buổi',
      'Học viên',
    ]);
    expect(nhatKy.ghi).toHaveBeenCalledWith(
      expect.objectContaining({
        hanh_dong: 'xuat_thong_ke_doi_buoi',
        nguoi_dung: { id: 'qt', vai_tro: 'quan_tri' },
        chi_tiet: expect.objectContaining({ so_buoi: 3, so_de_nghi: 2 }),
      }),
    );
  });
});

describe('buildThongKeDoiBuoiWorkbook', () => {
  it('2 sheet, đúng tiêu đề cột, đúng số dòng', async () => {
    const t = new Date('2026-11-20T01:00:00Z');
    const dong = {
      lich: {
        id: 'A',
        buoi_so: 2,
        thoi_gian_bat_dau: t,
        thoi_gian_ket_thuc: new Date('2026-11-20T04:00:00Z'),
        lop: {
          id: 'L',
          ten_lop: 'Lớp 01',
          muc_nang_luc: 'co_ban' as const,
          loai_lop: 'zoom' as const,
        },
        giai_doan: { id: 'g', thu_tu: 1, ten_giai_doan: 'GĐ 1' },
        khoa: KHOA_1,
      },
      si_so_phan_lop: 20,
      si_so: 30,
      si_so_toi_da: 30,
      day: true,
      ra_da_duyet: 1,
      ra_cho: 2,
      ra_qua_han: 0,
      ra_tu_choi: 0,
      ra_huy: 0,
      vao_da_duyet: 0,
      vao_cho: 0,
      vao_qua_han: 0,
      vao_tu_choi: 0,
      vao_huy: 1,
    };
    const hv = {
      ho_ten: 'Nguyễn Văn A',
      don_vi: 'THPT A',
      cum: 'Cụm 1',
      buoi_goc: 'Lớp 01 · Buổi 2',
      buoi_de_nghi: 'Lớp 02 · Buổi 2',
      buoi_chot: '',
      trang_thai: 'Học viên tự hủy',
      gui_luc: t,
      xu_ly_luc: null,
      nguoi_xu_ly: '',
      ly_do: 'Bận',
    };
    const buf = await buildThongKeDoiBuoiWorkbook({
      mo_ta_bo_loc: 'Tất cả',
      ngay_xuat: t,
      dong: [dong, dong],
      hoc_vien: [hv, hv, hv],
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const [s1, s2] = wb.worksheets;
    const tieuDe1 = (s1.getRow(4).values as unknown[]).slice(1);
    expect(tieuDe1).toEqual([
      'Khóa',
      'Giai đoạn',
      'Lớp',
      'Trình độ',
      'Hình thức',
      'Buổi',
      'Ngày',
      'Giờ',
      'Sĩ số phân lớp',
      'Sĩ số buổi',
      'Tối đa',
      'Đầy',
      'Ra đã duyệt',
      'Ra chờ',
      'Ra quá hạn',
      'Ra từ chối',
      'Ra hủy',
      'Vào đã duyệt',
      'Vào chờ',
      'Vào quá hạn',
      'Vào từ chối',
      'Vào hủy',
    ]);
    expect(s1.getRow(4).font?.bold).toBe(true);
    expect(s1.views[0]).toMatchObject({ state: 'frozen', ySplit: 4 });
    expect(String(s1.getCell(2, 1).value)).toContain('Tất cả');
    expect(s1.rowCount).toBe(4 + 2);
    expect(s1.getCell(5, 7).value).toBe('Thứ sáu, 20/11/2026');
    expect(s1.getCell(5, 8).value).toBe('08:00–11:00');
    expect(s1.getCell(5, 12).value).toBe('x');
    const tieuDe2 = (s2.getRow(4).values as unknown[]).slice(1);
    expect(tieuDe2).toEqual([
      'Học viên',
      'Đơn vị',
      'Cụm',
      'Buổi gốc',
      'Buổi đề nghị',
      'Buổi chốt',
      'Trạng thái',
      'Gửi lúc',
      'Xử lý lúc',
      'Người xử lý',
      'Lý do',
    ]);
    expect(s2.rowCount).toBe(4 + 3);
    expect(s2.getCell(5, 8).value).toBe('20/11/2026 08:00');
  });
});
