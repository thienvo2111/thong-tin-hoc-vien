import { Prisma } from '@prisma/client';
import { napChuyenCan } from './nap-chuyen-can';
import { PrismaService } from '../prisma/prisma.service';
import { khoaBuoi } from '../common/utils/chuyen-can.util';

// ADR 0010 T7: trạng thái 1 buổi (giai đoạn, buổi số) = tinhChuyenCan (ADR
// 0005 Z8) trên MỌI dòng diem_danh của đăng ký — học bù, lớp cũ, đổi buổi.
// Học viên dk1 hiện ở lop-a (GĐ g1). Lớp: lop-a/lop-z zoom, lop-t trực tiếp,
// lop-c zoom (buổi chốt đổi buổi), lop-cu zoom (lớp cũ trước khi chuyển).
type CheDo = 'theo_lop_hien_tai' | 'cong_nhan_lop_cu';
type TT = 'co_mat' | 'vang' | 'vang_co_phep';

const LOAI: Record<string, string> = {
  'lop-a': 'zoom',
  'lop-z': 'zoom',
  'lop-t': 'truc_tiep',
  'lop-c': 'zoom',
  'lop-cu': 'zoom',
};

const row = (
  lich: string,
  lop: string,
  buoi_so: number,
  trang_thai: TT,
  cheDo: CheDo,
  dk = 'dk1',
) => ({
  dang_ky_hoc_id: dk,
  lich_hoc_id: lich,
  trang_thai,
  nguon: 'thu_cong',
  tu_diem_danh_luc: null,
  lop_id: lop,
  giai_doan_id: 'g1',
  buoi_so,
  loai_lop: LOAI[lop],
  ten_lop: `Lớp ${lop}`,
  che_do_chuyen_can: cheDo,
});

function setup(
  rows: ReturnType<typeof row>[],
  doi: { lich_nguon_id: string; lich_chot_id: string; loai?: string }[] = [],
) {
  // $queryRaw: điểm danh (kèm buổi, lớp, chế độ khóa) / phân lớp theo mảng đăng ký.
  const prisma = {
    $queryRaw: jest.fn((sql: Prisma.Sql) => {
      const ids = sql.values[0] as string[];
      return Promise.resolve(
        sql.sql.includes('FROM diem_danh')
          ? rows.filter((r) => ids.includes(r.dang_ky_hoc_id))
          : ids.map((id) => ({
              dang_ky_hoc_id: id,
              giai_doan_id: 'g1',
              lop_id: 'lop-a',
            })),
      );
    }),
  };
  const doiBuoi = {
    doiBuoiDaDuyetCuaDangKy: jest
      .fn()
      .mockResolvedValue(doi.map((d) => ({ dang_ky_hoc_id: 'dk1', ...d }))),
    lichTomTat: jest
      .fn()
      .mockResolvedValue(
        new Map(
          doi.map((d) => [
            d.lich_nguon_id,
            { lop_id: 'lop-a', giai_doan_id: 'g1', buoi_so: 2 },
          ]),
        ),
      ),
  };
  return {
    prisma,
    doiBuoi,
    nap: (ids = ['dk1']) =>
      napChuyenCan(prisma as unknown as PrismaService, doiBuoi as never, ids),
  };
}

const slot = async (s: ReturnType<typeof setup>, buoi = 1) =>
  (await s.nap()).get('dk1')?.get(khoaBuoi('g1', buoi));

describe('napChuyenCan', () => {
  it('có mặt ở lớp hiện tại -> tu_lop_cu false, dòng của lớp hiện tại', async () => {
    const kq = await slot(
      setup([row('a1', 'lop-a', 1, 'co_mat', 'theo_lop_hien_tai')]),
    );
    expect(kq).toMatchObject({
      trang_thai: 'co_mat',
      tu_lop_cu: false,
      dong: { lich_hoc_id: 'a1', lop_id: 'lop-a', ten_lop: 'Lớp lop-a' },
    });
  });

  it.each<CheDo>(['theo_lop_hien_tai', 'cong_nhan_lop_cu'])(
    'học bù ở lớp trực tiếp khác cùng (giai đoạn, buổi số) -> luôn tính (%s)',
    async (cheDo) => {
      const kq = await slot(setup([row('t1', 'lop-t', 1, 'co_mat', cheDo)]));
      expect(kq).toMatchObject({
        trang_thai: 'co_mat',
        tu_lop_cu: true,
        dong: { lop_id: 'lop-t' },
      });
    },
  );

  it('học bù ở lớp Zoom khác -> chỉ tính khi khóa công nhận lớp cũ', async () => {
    expect(
      await slot(setup([row('z1', 'lop-z', 1, 'co_mat', 'theo_lop_hien_tai')])),
    ).toBeUndefined();
    expect(
      await slot(setup([row('z1', 'lop-z', 1, 'co_mat', 'cong_nhan_lop_cu')])),
    ).toMatchObject({
      trang_thai: 'co_mat',
      tu_lop_cu: true,
      dong: { lop_id: 'lop-z' },
    });
  });

  it('điểm danh ở lớp cũ (Zoom) sau khi chuyển lớp -> chỉ tính khi công nhận lớp cũ', async () => {
    expect(
      await slot(
        setup([row('cu1', 'lop-cu', 1, 'co_mat', 'theo_lop_hien_tai')]),
      ),
    ).toBeUndefined();
    expect(
      await slot(
        setup([row('cu1', 'lop-cu', 1, 'co_mat', 'cong_nhan_lop_cu')]),
      ),
    ).toMatchObject({
      tu_lop_cu: true,
      dong: { lop_id: 'lop-cu' },
    });
  });

  it('đổi buổi: dòng ở buổi chốt tính THAY buổi nguồn, như lớp hiện tại; lop_tinh là lớp chốt', async () => {
    const s = setup(
      [
        row('a2', 'lop-a', 2, 'vang', 'theo_lop_hien_tai'),
        row('c2', 'lop-c', 2, 'co_mat', 'theo_lop_hien_tai'),
      ],
      [{ lich_nguon_id: 'a2', lich_chot_id: 'c2' }],
    );
    expect(await slot(s, 2)).toMatchObject({
      trang_thai: 'co_mat',
      tu_lop_cu: false,
      dong: { lich_hoc_id: 'c2', lop_id: 'lop-c' },
    });
  });

  it('học bù đã duyệt (ADR 0012): buổi gốc vắng + có mặt ở buổi chốt -> có mặt, như đổi buổi', async () => {
    const s = setup(
      [
        row('a2', 'lop-a', 2, 'vang', 'theo_lop_hien_tai'),
        row('c2', 'lop-c', 2, 'co_mat', 'theo_lop_hien_tai'),
      ],
      [{ lich_nguon_id: 'a2', lich_chot_id: 'c2', loai: 'hoc_bu' }],
    );
    expect(await slot(s, 2)).toMatchObject({
      trang_thai: 'co_mat',
      tu_lop_cu: false,
      dong: { lich_hoc_id: 'c2', lop_id: 'lop-c' },
    });
    // Vắng cả buổi chốt -> buổi gốc vẫn vắng (dòng của lớp hiện tại khi hòa).
    const vang = setup(
      [
        row('a2', 'lop-a', 2, 'vang', 'theo_lop_hien_tai'),
        row('c2', 'lop-c', 2, 'vang', 'theo_lop_hien_tai'),
      ],
      [{ lich_nguon_id: 'a2', lich_chot_id: 'c2', loai: 'hoc_bu' }],
    );
    expect(await slot(vang, 2)).toMatchObject({ trang_thai: 'vang' });
  });

  it('trạng thái tốt nhất thắng: vắng ở lớp mình + có mặt học bù -> có mặt (học bù)', async () => {
    const kq = await slot(
      setup([
        row('a1', 'lop-a', 1, 'vang', 'theo_lop_hien_tai'),
        row('t1', 'lop-t', 1, 'co_mat', 'theo_lop_hien_tai'),
      ]),
    );
    expect(kq).toMatchObject({
      trang_thai: 'co_mat',
      tu_lop_cu: true,
      dong: { lich_hoc_id: 't1' },
    });
  });

  it('hòa trạng thái -> ưu tiên dòng của lớp hiện tại', async () => {
    const kq = await slot(
      setup([
        row('t1', 'lop-t', 1, 'co_mat', 'theo_lop_hien_tai'),
        row('a1', 'lop-a', 1, 'co_mat', 'theo_lop_hien_tai'),
      ]),
    );
    expect(kq).toMatchObject({ tu_lop_cu: false, dong: { lich_hoc_id: 'a1' } });
  });

  it('không có dòng -> không có kết quả; rỗng -> không truy vấn', async () => {
    const s = setup([]);
    expect(await slot(s)).toBeUndefined();
    expect((await s.nap([])).size).toBe(0);
    expect(s.doiBuoi.doiBuoiDaDuyetCuaDangKy).toHaveBeenCalledTimes(1);
  });

  it('truy vấn tập hợp: 1.001 đăng ký -> đúng 2 truy vấn SQL (mảng uuid) + đổi buổi 1 lần, không N+1', async () => {
    const ids = Array.from({ length: 1001 }, (_, i) => `dk${i}`);
    const s = setup([
      row('a1', 'lop-a', 1, 'co_mat', 'theo_lop_hien_tai', 'dk1000'),
    ]);
    const kq = await s.nap(ids);
    expect(s.prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(s.prisma.$queryRaw.mock.calls[0][0].values[0]).toHaveLength(1001);
    expect(s.doiBuoi.doiBuoiDaDuyetCuaDangKy).toHaveBeenCalledTimes(1);
    expect(kq.get('dk1000')?.get(khoaBuoi('g1', 1))?.trang_thai).toBe('co_mat');
  });
});
