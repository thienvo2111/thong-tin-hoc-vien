import { PrismaService } from '../../prisma/prisma.service';
import { napHocVienTheoLo } from './hoc-vien-resolver-lo.util';
import {
  HocVienResolverInput,
  resolveHocVienImportRow,
} from './hoc-vien-resolver.util';

type HvGia = {
  id: string;
  so_dinh_danh_ca_nhan: string | null;
  ma_dinh_danh_moet: string | null;
};

const bo0 = (s: string | null) => (s ?? '').replace(/^0+/, '');

// DB giả trong bộ nhớ phục vụ CẢ 2 cách tra (từng dòng và theo lô) để so
// sánh kết quả: $queryRaw nhận diện truy vấn lô qua "ANY".
function taoPrismaGia(hocViens: HvGia[]) {
  const prisma = {
    hoc_vien: {
      findUnique: jest.fn(
        async ({ where }: { where: Partial<HvGia> }) =>
          hocViens.find((h) =>
            where.id !== undefined
              ? h.id === where.id
              : h.so_dinh_danh_ca_nhan === where.so_dinh_danh_ca_nhan,
          ) ?? null,
      ),
      findMany: jest.fn(
        async ({
          where,
        }: {
          where: {
            id?: { in: string[] };
            so_dinh_danh_ca_nhan?: { in: string[] };
          };
        }) =>
          hocViens.filter((h) =>
            where.id
              ? where.id.in.includes(h.id)
              : where.so_dinh_danh_ca_nhan!.in.includes(
                  h.so_dinh_danh_ca_nhan as string,
                ),
          ),
      ),
    },
    $queryRaw: jest.fn(
      async (sql: { strings: string[]; values: unknown[] }) => {
        if (sql.strings.join('').includes('ANY')) {
          const [ds, khoa] = sql.values as [string[], string[]];
          return hocViens
            .filter(
              (h) =>
                h.ma_dinh_danh_moet !== null &&
                (ds.includes(h.ma_dinh_danh_moet) ||
                  khoa.includes(bo0(h.ma_dinh_danh_moet))),
            )
            .map((h) => ({ id: h.id, ma_dinh_danh_moet: h.ma_dinh_danh_moet }));
        }
        const [sach, , khoa] = sql.values as string[];
        return hocViens
          .filter(
            (h) =>
              h.ma_dinh_danh_moet !== null &&
              (h.ma_dinh_danh_moet === sach ||
                (khoa !== '' && bo0(h.ma_dinh_danh_moet) === khoa)),
          )
          .map((h) => ({ id: h.id, chinh_xac: h.ma_dinh_danh_moet === sach }));
      },
    ),
  };
  return prisma as typeof prisma & PrismaService;
}

const HOC_VIENS: HvGia[] = [
  {
    id: 'hv-a',
    so_dinh_danh_ca_nhan: '079000000001',
    ma_dinh_danh_moet: '08901678964',
  },
  {
    id: 'hv-b',
    so_dinh_danh_ca_nhan: '079000000002',
    ma_dinh_danh_moet: '0091101643020',
  },
  // "123" khớp chính xác hv-c, nhưng hv-d "0123" cũng khớp sau khi bỏ số 0.
  { id: 'hv-c', so_dinh_danh_ca_nhan: null, ma_dinh_danh_moet: '123' },
  { id: 'hv-d', so_dinh_danh_ca_nhan: null, ma_dinh_danh_moet: '0123' },
  // 2 hồ sơ cùng khóa "777" sau khi bỏ số 0, không cái nào khớp chính xác "777".
  { id: 'hv-e', so_dinh_danh_ca_nhan: null, ma_dinh_danh_moet: '0777' },
  { id: 'hv-f', so_dinh_danh_ca_nhan: null, ma_dinh_danh_moet: '00777' },
];

describe('napHocVienTheoLo — cùng kết quả với resolveHocVienImportRow', () => {
  const truongHop: [string, HocVienResolverInput][] = [
    ['thiếu cả 2 mã', {}],
    [
      'chỉ khoảng trắng',
      { so_dinh_danh_ca_nhan: '  ', ma_dinh_danh_moet: ' ' },
    ],
    ['sdd tồn tại', { so_dinh_danh_ca_nhan: '079000000001' }],
    ['sdd có khoảng trắng 2 đầu', { so_dinh_danh_ca_nhan: ' 079000000002 ' }],
    ['sdd không tồn tại', { so_dinh_danh_ca_nhan: '079999999999' }],
    ['MOET khớp chính xác', { ma_dinh_danh_moet: '08901678964' }],
    ['MOET mất số 0 đầu', { ma_dinh_danh_moet: '8901678964' }],
    ['MOET mất 2 số 0 đầu', { ma_dinh_danh_moet: '91101643020' }],
    ['MOET chính xác thắng khớp bỏ số 0', { ma_dinh_danh_moet: '123' }],
    ['MOET khớp nhiều hồ sơ', { ma_dinh_danh_moet: '777' }],
    ['MOET không tồn tại', { ma_dinh_danh_moet: '55555' }],
    ['MOET toàn số 0', { ma_dinh_danh_moet: '000' }],
    [
      'sdd + MOET cùng hồ sơ',
      { so_dinh_danh_ca_nhan: '079000000001', ma_dinh_danh_moet: '8901678964' },
    ],
    [
      'sdd + MOET khác hồ sơ',
      {
        so_dinh_danh_ca_nhan: '079000000001',
        ma_dinh_danh_moet: '91101643020',
      },
    ],
    [
      'sdd không tồn tại báo trước MOET',
      { so_dinh_danh_ca_nhan: '079999999999', ma_dinh_danh_moet: '55555' },
    ],
  ];

  it.each(truongHop)('%s', async (_ten, raw) => {
    const prisma = taoPrismaGia(HOC_VIENS);
    const tungDong = await resolveHocVienImportRow(prisma, raw);
    const tra = await napHocVienTheoLo(
      prisma,
      truongHop.map(([, r]) => r),
    );
    expect(await tra(raw)).toEqual(tungDong);
  });

  it('báo lỗi đúng câu chữ cho từng nhánh', async () => {
    const prisma = taoPrismaGia(HOC_VIENS);
    const tra = await napHocVienTheoLo(
      prisma,
      truongHop.map(([, r]) => r),
    );
    expect((await tra({})).error).toBe(
      'Phải có ít nhất 1 trong 2 cột "so_dinh_danh_ca_nhan"/"ma_dinh_danh_moet"',
    );
    expect((await tra({ ma_dinh_danh_moet: '777' })).error).toBe(
      'Mã định danh MOET "777" khớp nhiều hồ sơ học viên (khác số 0 đầu) — không xác định được',
    );
    expect((await tra({ ma_dinh_danh_moet: '123' })).hocVien?.id).toBe('hv-c');
  });

  it('số truy vấn không tăng theo số dòng (trong 1 lô)', async () => {
    const prisma = taoPrismaGia(HOC_VIENS);
    const raws = Array.from({ length: 900 }, (_, i) => ({
      ma_dinh_danh_moet: i % 2 ? '8901678964' : '91101643020',
      so_dinh_danh_ca_nhan: i % 3 ? undefined : '079999999999',
    }));
    const tra = await napHocVienTheoLo(prisma, raws);
    for (const r of raws) await tra(r);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    // 1 lần theo sdd + 1 lần nạp hồ sơ theo id.
    expect(prisma.hoc_vien.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.hoc_vien.findUnique).not.toHaveBeenCalled();
  });

  it('> 1000 mã khác nhau -> chia nhiều truy vấn mà vẫn giải đúng', async () => {
    const nhieu: HvGia[] = Array.from({ length: 2500 }, (_, i) => ({
      id: `hv-${i}`,
      so_dinh_danh_ca_nhan: null,
      ma_dinh_danh_moet: `0${100000 + i}`,
    }));
    const prisma = taoPrismaGia(nhieu);
    const raws = nhieu.map((h) => ({
      ma_dinh_danh_moet: bo0(h.ma_dinh_danh_moet),
    }));
    const tra = await napHocVienTheoLo(prisma, raws);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(3);
    expect((await tra(raws[0])).hocVien?.id).toBe('hv-0');
    expect((await tra(raws[2499])).hocVien?.id).toBe('hv-2499');
  });

  it('mã không có trong danh sách nạp -> coi như không tồn tại', async () => {
    const prisma = taoPrismaGia(HOC_VIENS);
    const tra = await napHocVienTheoLo(prisma, []);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect((await tra({ ma_dinh_danh_moet: '08901678964' })).error).toBe(
      'Mã định danh MOET "08901678964" không tồn tại (chưa có hồ sơ học viên)',
    );
  });
});
