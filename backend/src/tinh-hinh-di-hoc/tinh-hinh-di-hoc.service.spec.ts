import { Prisma } from '@prisma/client';
import { TinhHinhDiHocService } from './tinh-hinh-di-hoc.service';
import { PrismaService } from '../prisma/prisma.service';
import { DoiBuoiHocQueryService } from '../doi-buoi-hoc/doi-buoi-hoc-query.service';
import { DiemDanhService } from '../diem-danh/diem-danh.service';
import { NhatKyService } from '../nhat-ky/nhat-ky.service';
import {
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { LocTinhHinhDiHocDto } from './tinh-hinh-di-hoc.dto';

// ADR 0010 T3/T4: tổng theo buổi hiệu dụng, lọc theo số đếm, điểm danh bổ sung.
// now = 10/11. Lớp A (GĐ1): a1 01/11, a2 03/11, a3 20/11 (tương lai).
// Lớp B (GĐ2): b1 05/11, b2 25/11 (tương lai). Lớp C: c2 04/11 = buổi chốt của An khi đổi ra a2.
// - An: GĐ1→A, GĐ2→B. Có mặt a1, có mặt c2 (đổi buổi), vắng b1; dòng "vắng" ở a2 (lớp gốc,
//   đã đổi ra) KHÔNG tính → 3 buổi đã diễn ra, có mặt 2, vắng 1.
// - Bình: GĐ1→A. Báo vắng a1, chưa điểm danh a2 → đã diễn ra 2.
const d = (s: string) => new Date(`2026-11-${s}T01:00:00Z`);
const NOW = d('10');
const lich = (
  id: string,
  lop_id: string,
  giai_doan_id: string,
  buoi_so: number,
  ngay: string,
) => ({
  id,
  lop_id,
  giai_doan_id,
  buoi_so,
  thoi_gian_bat_dau: d(ngay),
  thoi_gian_ket_thuc: d(ngay),
});
const LICH = [
  lich('a1', 'lop-a', 'g1', 1, '01'),
  lich('a2', 'lop-a', 'g1', 2, '03'),
  lich('a3', 'lop-a', 'g1', 3, '20'),
  lich('b1', 'lop-b', 'g2', 1, '05'),
  lich('b2', 'lop-b', 'g2', 2, '25'),
];
const pl = (gd: string, thu_tu: number, lop: string, ten: string) => ({
  giai_doan_id: gd,
  lop_id: lop,
  lop: { ten_lop: ten },
  giai_doan: { thu_tu, ten_giai_doan: `GĐ ${thu_tu}` },
});
const dangKy = (
  id: string,
  ho_ten: string,
  phanLop: ReturnType<typeof pl>[],
) => ({
  id,
  hoc_vien: {
    id: `hv-${id}`,
    ho_ten,
    ma_dinh_danh_moet: `0${id}`,
    don_vi_cong_tac: {
      ten_don_vi: 'THPT A',
      dia_ban: { ten: 'Xã A', parent: { ten: 'Tỉnh A' } },
    },
  },
  cum: { ten_cum: 'Cụm 1' },
  phan_lop_giai_doan: phanLop,
});
const AN = dangKy('dk-an', 'Nguyễn An', [
  pl('g2', 2, 'lop-b', 'Lớp B'),
  pl('g1', 1, 'lop-a', 'Lớp A'),
]);
const BINH = dangKy('dk-binh', 'Trần Bình', [pl('g1', 1, 'lop-a', 'Lớp A')]);

// ADR 0010 T7: buổi của lớp khác cùng (giai đoạn, buổi số) — học bù.
// lop-t trực tiếp, lop-z Zoom; c2 = buổi chốt đổi buổi của An.
const LICH_KHAC = [
  lich('c2', 'lop-c', 'g1', 2, '04'),
  lich('t2', 'lop-t', 'g1', 2, '02'),
  lich('z2', 'lop-z', 'g1', 2, '02'),
];
const TAT_CA_LICH = new Map([...LICH, ...LICH_KHAC].map((l) => [l.id, l]));
const LOP: Record<string, { loai_lop: string; ten_lop: string }> = {
  'lop-a': { loai_lop: 'zoom', ten_lop: 'Lớp A' },
  'lop-b': { loai_lop: 'zoom', ten_lop: 'Lớp B' },
  'lop-c': { loai_lop: 'zoom', ten_lop: 'Lớp C' },
  'lop-t': { loai_lop: 'truc_tiep', ten_lop: 'Lớp T' },
  'lop-z': { loai_lop: 'zoom', ten_lop: 'Lớp Z' },
};
const PHAN_LOP = [AN, BINH].flatMap((dk) =>
  dk.phan_lop_giai_doan.map((p) => ({
    dang_ky_hoc_id: dk.id,
    giai_doan_id: p.giai_doan_id,
    lop_id: p.lop_id,
  })),
);
const idsTrongWhere = (where: { dang_ky_hoc_id: string | { in: string[] } }) =>
  typeof where.dang_ky_hoc_id === 'string'
    ? [where.dang_ky_hoc_id]
    : where.dang_ky_hoc_id.in;

interface DongDiemDanhMock {
  dang_ky_hoc_id: string;
  lich_hoc_id: string;
  trang_thai: 'co_mat' | 'vang' | 'vang_co_phep';
  nguon: string;
  ghi_chu?: string;
  cap_nhat_luc?: Date;
  sua_boi?: { ho_ten: string };
}
const DONG_GOC: DongDiemDanhMock[] = [
  {
    dang_ky_hoc_id: 'dk-an',
    lich_hoc_id: 'a1',
    trang_thai: 'co_mat',
    nguon: 'zoom',
  },
  {
    dang_ky_hoc_id: 'dk-an',
    lich_hoc_id: 'a2',
    trang_thai: 'vang',
    nguon: 'zoom',
  },
  {
    dang_ky_hoc_id: 'dk-an',
    lich_hoc_id: 'c2',
    trang_thai: 'co_mat',
    nguon: 'thu_cong',
    ghi_chu: 'Học bù',
    cap_nhat_luc: d('06'),
    sua_boi: { ho_ten: 'Hỗ trợ 1' },
  },
  {
    dang_ky_hoc_id: 'dk-an',
    lich_hoc_id: 'b1',
    trang_thai: 'vang',
    nguon: 'zoom',
  },
];
// Dòng thêm theo từng test (học bù) + chế độ chuyên cần của khóa.
let them: DongDiemDanhMock[] = [];
let cheDo: 'theo_lop_hien_tai' | 'cong_nhan_cung_muc' | 'cong_nhan_lop_cu' =
  'theo_lop_hien_tai';
// ADR 0014: mức lớp — mọi lớp co_ban, riêng lop-z theo từng test.
let mucZ: string | null = 'co_ban';
const mucLop = (lopId: string) => (lopId === 'lop-z' ? mucZ : 'co_ban');

describe('TinhHinhDiHocService', () => {
  let prisma: {
    dang_ky_hoc: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
    };
    lich_hoc_lop: { findMany: jest.Mock };
    diem_danh: { findMany: jest.Mock; findUnique: jest.Mock };
    bao_vang: { findMany: jest.Mock };
    khoa_boi_duong: { findUnique: jest.Mock };
    $queryRaw: jest.Mock;
  };
  let doiBuoi: { doiBuoiDaDuyetCuaDangKy: jest.Mock; lichTomTat: jest.Mock };
  let diemDanh: { ghiThuCong: jest.Mock };
  let nhatKy: { ghi: jest.Mock };
  let service: TinhHinhDiHocService;
  const loc = (x: Partial<LocTinhHinhDiHocDto> = {}) =>
    ({ khoa_id: 'k1', page: 1, page_size: 20, ...x }) as LocTinhHinhDiHocDto;
  const hoTro = { id: 'ht-1', vai_tro: 'ho_tro_hoc_vien' as const };

  beforeEach(() => {
    them = [];
    cheDo = 'theo_lop_hien_tai';
    mucZ = 'co_ban';
    prisma = {
      dang_ky_hoc: {
        // Trả ngược thứ tự để kiểm tra service tự xếp theo họ tên.
        findMany: jest.fn().mockResolvedValue([BINH, AN]),
        findFirst: jest.fn().mockResolvedValue(AN),
        findUnique: jest.fn().mockResolvedValue({
          khoa: { id: 'k1', ma_khoa: 'K1', ten_khoa: 'Khóa 1' },
        }),
      },
      lich_hoc_lop: { findMany: jest.fn().mockResolvedValue(LICH) },
      // Dòng tại buổi hiệu dụng (chi tiết): theo 1 đăng ký.
      diem_danh: {
        findMany: jest
          .fn()
          .mockImplementation(
            ({
              where,
            }: {
              where: { dang_ky_hoc_id: string | { in: string[] } };
            }) => {
              const ids = idsTrongWhere(where);
              return Promise.resolve(
                [...DONG_GOC, ...them].filter((r) =>
                  ids.includes(r.dang_ky_hoc_id),
                ),
              );
            },
          ),
        findUnique: jest.fn().mockResolvedValue({ trang_thai: 'vang' }),
      },
      bao_vang: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { dang_ky_hoc_id: 'dk-binh', lich_hoc_id: 'a1', ly_do: 'Ốm' },
          ]),
      },
      khoa_boi_duong: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ ma_khoa: 'K1', ten_khoa: 'Khóa 1' }),
      },
      // napChuyenCan: điểm danh mọi lớp (kèm buổi, lớp, chế độ khóa) / phân
      // lớp theo mảng đăng ký; tìm kiếm họ tên: rỗng.
      $queryRaw: jest.fn((sql: Prisma.Sql) => {
        const ids = sql.values[0] as string[];
        if (sql.sql.includes('FROM diem_danh')) {
          return Promise.resolve(
            [...DONG_GOC, ...them]
              .filter((r) => ids.includes(r.dang_ky_hoc_id))
              .map((r) => {
                const l = TAT_CA_LICH.get(r.lich_hoc_id)!;
                return {
                  tu_diem_danh_luc: null,
                  ...r,
                  lop_id: l.lop_id,
                  giai_doan_id: l.giai_doan_id,
                  buoi_so: l.buoi_so,
                  ...LOP[l.lop_id],
                  muc_nang_luc: mucLop(l.lop_id),
                  che_do_chuyen_can: cheDo,
                };
              }),
          );
        }
        if (sql.sql.includes('FROM phan_lop_giai_doan')) {
          return Promise.resolve(
            PHAN_LOP.filter((p) => ids.includes(p.dang_ky_hoc_id)).map((p) => ({
              ...p,
              muc_nang_luc: mucLop(p.lop_id),
            })),
          );
        }
        return Promise.resolve([]);
      }),
    };
    doiBuoi = {
      doiBuoiDaDuyetCuaDangKy: jest
        .fn()
        .mockResolvedValue([
          { dang_ky_hoc_id: 'dk-an', lich_nguon_id: 'a2', lich_chot_id: 'c2' },
        ]),
      lichTomTat: jest.fn().mockImplementation((ids: string[]) =>
        Promise.resolve(
          new Map(
            ids
              .filter((id) => TAT_CA_LICH.has(id))
              .map((id) => {
                const l = TAT_CA_LICH.get(id)!;
                return [
                  id,
                  {
                    ...l,
                    lop: {
                      ten_lop: LOP[l.lop_id].ten_lop,
                      muc_nang_luc: mucLop(l.lop_id),
                    },
                  },
                ];
              }),
          ),
        ),
      ),
    };
    diemDanh = {
      ghiThuCong: jest
        .fn()
        .mockImplementation((_u, o: Record<string, unknown>) =>
          Promise.resolve({
            ...o,
            nguon: 'thu_cong',
            ghi_chu: o.ghi_chu,
            nguoi_sua: 'Hỗ trợ 1',
          }),
        ),
    };
    nhatKy = { ghi: jest.fn().mockResolvedValue(undefined) };
    service = new TinhHinhDiHocService(
      prisma as unknown as PrismaService,
      doiBuoi as unknown as DoiBuoiHocQueryService,
      diemDanh as unknown as DiemDanhService,
      nhatKy as unknown as NhatKyService,
    );
  });

  it('tổng theo buổi hiệu dụng qua 2 giai đoạn/2 lớp: đổi buổi tính ở buổi chốt, bỏ buổi tương lai, đếm báo vắng', async () => {
    const kq = await service.danhSach({}, loc(), NOW);
    expect(kq.total).toBe(2);
    expect(kq.data.map((x) => x.ho_ten)).toEqual(['Nguyễn An', 'Trần Bình']);
    expect(kq.data[0].tong).toEqual({
      da_dien_ra: 3,
      co_mat: 2,
      vang: 1,
      vang_co_phep: 0,
      da_bao_vang: 0,
      chua_diem_danh: 0,
    });
    expect(kq.data[1].tong).toEqual({
      da_dien_ra: 2,
      co_mat: 0,
      vang: 0,
      vang_co_phep: 0,
      da_bao_vang: 1,
      chua_diem_danh: 1,
    });
    // Lớp theo giai đoạn xếp theo thứ tự giai đoạn.
    expect(kq.data[0].lop_theo_giai_doan.map((l) => l.ten_lop)).toEqual([
      'Lớp A',
      'Lớp B',
    ]);
    // Truy vấn tập hợp: 1 truy vấn buổi; điểm danh + phân lớp mỗi thứ 1 truy
    // vấn SQL cho cả trang (napChuyenCan).
    expect(prisma.lich_hoc_lop.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(prisma.diem_danh.findMany).not.toHaveBeenCalled();
  });

  describe('tongTheoDangKy (Excel nhu cầu theo đợt)', () => {
    const KHONG_LOP = dangKy('dk-khong', 'Lê Không Lớp', []);
    const ZERO = {
      da_dien_ra: 0,
      co_mat: 0,
      vang: 0,
      vang_co_phep: 0,
      da_bao_vang: 0,
      chua_diem_danh: 0,
    };

    it('trả tổng y như danh sách Tình hình đi học theo id; chưa phân lớp → toàn 0', async () => {
      prisma.dang_ky_hoc.findMany.mockResolvedValue([BINH, KHONG_LOP, AN]);
      const kq = await service.tongTheoDangKy(
        ['dk-an', 'dk-binh', 'dk-khong'],
        NOW,
      );
      expect(prisma.dang_ky_hoc.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['dk-an', 'dk-binh', 'dk-khong'] } },
        }),
      );
      expect(kq.get('dk-an')).toEqual({
        da_dien_ra: 3,
        co_mat: 2,
        vang: 1,
        vang_co_phep: 0,
        da_bao_vang: 0,
        chua_diem_danh: 0,
      });
      expect(kq.get('dk-binh')).toEqual({
        ...ZERO,
        da_dien_ra: 2,
        da_bao_vang: 1,
        chua_diem_danh: 1,
      });
      expect(kq.get('dk-khong')).toEqual(ZERO);
      // Nạp theo lô: 1 truy vấn buổi cho mọi đăng ký.
      expect(prisma.lich_hoc_lop.findMany).toHaveBeenCalledTimes(1);
    });

    it('mảng rỗng → Map rỗng, không truy vấn', async () => {
      const kq = await service.tongTheoDangKy([], NOW);
      expect(kq.size).toBe(0);
      expect(prisma.dang_ky_hoc.findMany).not.toHaveBeenCalled();
    });
  });

  it('lọc co_vang / chua_diem_danh theo số đếm, total sau khi lọc', async () => {
    const vang = await service.danhSach({}, loc({ co_vang: true }), NOW);
    expect(vang.total).toBe(1);
    expect(vang.data.map((x) => x.ho_ten)).toEqual(['Nguyễn An']);
    const chua = await service.danhSach({}, loc({ chua_diem_danh: true }), NOW);
    expect(chua.data.map((x) => x.ho_ten)).toEqual(['Trần Bình']);
    const ca2 = await service.danhSach(
      {},
      loc({ co_vang: true, chua_diem_danh: true }),
      NOW,
    );
    expect(ca2.total).toBe(0);
  });

  it('phân trang: total = tổng số dòng, data chỉ trang đang xem', async () => {
    const kq = await service.danhSach({}, loc({ page: 2, page_size: 1 }), NOW);
    expect(kq).toMatchObject({ total: 2, page: 2, page_size: 1 });
    expect(kq.data.map((x) => x.ho_ten)).toEqual(['Trần Bình']);
  });

  it('phạm vi null (chưa được gắn cụm/lớp) -> rỗng, không truy vấn đăng ký', async () => {
    expect((await service.danhSach(null, loc(), NOW)).total).toBe(0);
    expect(prisma.dang_ky_hoc.findMany).not.toHaveBeenCalled();
  });

  it('tìm mã MOET thiếu số 0 đầu: điều kiện chứa mã đã bỏ số 0 đầu, kèm phạm vi + khóa + bộ lọc', async () => {
    await service.danhSach(
      { cum_id: { in: ['cum-1'] } },
      loc({
        q: '0012345',
        cum_id: 'cum-1',
        lop_id: 'lop-a',
        don_vi_cong_tac_id: 'dv-1',
      }),
      NOW,
    );
    const where = prisma.dang_ky_hoc.findMany.mock.calls[0][0].where;
    expect(where.AND).toEqual(
      expect.arrayContaining([
        { cum_id: { in: ['cum-1'] } },
        { khoa_id: 'k1' },
        { hoc_vien: { don_vi_cong_tac_id: 'dv-1' } },
        { cum_id: 'cum-1' },
        { phan_lop_giai_doan: { some: { lop_id: 'lop-a' } } },
        {
          OR: [
            { hoc_vien_id: { in: [] } },
            {
              hoc_vien: {
                ma_dinh_danh_moet: { contains: '12345', mode: 'insensitive' },
              },
            },
          ],
        },
      ]),
    );
  });

  it('chi tiết: buổi hiệu dụng xếp theo giai đoạn/buổi, nhãn đổi buổi, người sửa, cờ bổ sung', async () => {
    const ct = await service.chiTiet({}, 'dk-an', hoTro, NOW);
    expect(
      ct.buoi.map((b) => [
        b.lich_hoc_id,
        b.lich_nguon_id,
        b.diem_danh.ma,
        b.bo_sung_duoc,
      ]),
    ).toEqual([
      ['a1', 'a1', 'co_mat', true],
      ['c2', 'a2', 'co_mat', true],
      ['a3', 'a3', 'chua_den_gio', false],
      ['b1', 'b1', 'vang', true],
      ['b2', 'b2', 'chua_den_gio', false],
    ]);
    const doi = ct.buoi[1];
    expect(doi.doi_buoi).toEqual({
      tu_lop: { id: 'lop-a', ten_lop: 'Lớp A' },
      sang_lop: { id: 'lop-c', ten_lop: 'Lớp C' },
      hoc_bu: false,
    });
    expect(doi.diem_danh).toMatchObject({
      nguoi_sua: 'Hỗ trợ 1',
      ghi_chu: 'Học bù',
      nguon: 'thu_cong',
    });
    expect(ct.buoi[2].ly_do_khong).toBe('Buổi học chưa diễn ra');
    expect(ct.tong).toMatchObject({ da_dien_ra: 3, co_mat: 2, vang: 1 });
    expect(ct.trang_thai_duoc).toEqual(['co_mat', 'vang_co_phep']);
  });

  it('học bù đã duyệt (ADR 0012, loai hoc_bu): tính như đổi buổi — buổi chốt là buổi hiệu dụng', async () => {
    doiBuoi.doiBuoiDaDuyetCuaDangKy.mockResolvedValue([
      {
        dang_ky_hoc_id: 'dk-an',
        lich_nguon_id: 'a2',
        lich_chot_id: 'c2',
        loai: 'hoc_bu',
      },
    ]);
    const ds = await service.danhSach({}, loc(), NOW);
    expect(ds.data[0].tong).toMatchObject({
      da_dien_ra: 3,
      co_mat: 2,
      vang: 1,
    });
    const ct = await service.chiTiet({}, 'dk-an', hoTro, NOW);
    expect(ct.buoi[1]).toMatchObject({
      lich_hoc_id: 'c2',
      lich_nguon_id: 'a2',
      diem_danh: { ma: 'co_mat' },
      doi_buoi: {
        tu_lop: { ten_lop: 'Lớp A' },
        sang_lop: { ten_lop: 'Lớp C' },
        hoc_bu: true,
      },
    });
  });

  // ADR 0010 T7: Bình học bù buổi 2 (GĐ1) ở lớp khác cùng (giai đoạn, buổi số).
  describe('học bù / lớp khác (tinhChuyenCan)', () => {
    const hocBu = (
      lich_hoc_id: string,
      trang_thai: 'co_mat' | 'vang' = 'co_mat',
    ) =>
      them.push({
        dang_ky_hoc_id: 'dk-binh',
        lich_hoc_id,
        trang_thai,
        nguon: 'thu_cong',
      });

    it('học bù ở lớp trực tiếp -> tổng có mặt + hết "chưa điểm danh"; lọc chua_diem_danh bỏ Bình', async () => {
      hocBu('t2');
      const kq = await service.danhSach({}, loc(), NOW);
      expect(kq.data[1].tong).toEqual({
        da_dien_ra: 2,
        co_mat: 1,
        vang: 0,
        vang_co_phep: 0,
        da_bao_vang: 1,
        chua_diem_danh: 0,
      });
      expect(
        (await service.danhSach({}, loc({ chua_diem_danh: true }), NOW)).total,
      ).toBe(0);
    });

    it('chi tiết: nhãn + nguồn + lớp tính; hỗ trợ không bổ sung được, Quản trị vẫn được', async () => {
      hocBu('t2');
      prisma.dang_ky_hoc.findFirst.mockResolvedValue(BINH);
      const ct = await service.chiTiet({}, 'dk-binh', hoTro, NOW);
      const a2 = ct.buoi.find((b) => b.lich_hoc_id === 'a2')!;
      expect(a2.diem_danh).toMatchObject({
        ma: 'co_mat',
        nhan: 'Có mặt – ở lớp Lớp T',
        nguon_tinh: 'lop_khac',
        lop_tinh: { id: 'lop-t', ten_lop: 'Lớp T' },
        // Dòng tại buổi hiệu dụng (nơi bổ sung ghi vào) vẫn trống.
        trang_thai: null,
      });
      expect(a2.bo_sung_duoc).toBe(false);
      expect(a2.ly_do_khong).toBe('Đã có mặt ở lớp Lớp T (học bù/lớp cũ)');
      const a1 = ct.buoi.find((b) => b.lich_hoc_id === 'a1')!;
      expect(a1.diem_danh).toMatchObject({
        ma: 'da_bao_vang',
        nguon_tinh: null,
        lop_tinh: null,
      });
      expect(a1.bo_sung_duoc).toBe(true);

      const qt = await service.chiTiet(
        {},
        'dk-binh',
        { vai_tro: 'quan_tri' },
        NOW,
      );
      const qtA2 = qt.buoi.find((b) => b.lich_hoc_id === 'a2')!;
      expect(qtA2.bo_sung_duoc).toBe(true);
      expect(qtA2.diem_danh.nguon_tinh).toBe('lop_khac');
    });

    it('PUT bổ sung buổi đã có mặt nhờ lớp khác: hỗ trợ -> 400, Quản trị -> ghi được', async () => {
      hocBu('t2');
      prisma.dang_ky_hoc.findFirst.mockResolvedValue(BINH);
      const put = (user: {
        id: string;
        vai_tro: 'ho_tro_hoc_vien' | 'quan_tri';
      }) =>
        service.diemDanhBoSung(
          {},
          'dk-binh',
          user,
          { lich_hoc_id: 'a2', trang_thai: 'co_mat', ly_do: 'x' },
          NOW,
        );
      await expect(put(hoTro)).rejects.toMatchObject({
        response: {
          error: expect.objectContaining({
            message: 'Đã có mặt ở lớp Lớp T (học bù/lớp cũ)',
          }),
        },
      });
      expect(diemDanh.ghiThuCong).not.toHaveBeenCalled();
      await put({ id: 'qt', vai_tro: 'quan_tri' });
      expect(diemDanh.ghiThuCong).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ lich_hoc_id: 'a2' }),
        NOW,
      );
    });

    it('vắng ở lớp khác không chặn bổ sung, nhãn "Vắng"', async () => {
      hocBu('t2', 'vang');
      prisma.dang_ky_hoc.findFirst.mockResolvedValue(BINH);
      const ct = await service.chiTiet({}, 'dk-binh', hoTro, NOW);
      const a2 = ct.buoi.find((b) => b.lich_hoc_id === 'a2')!;
      expect(a2.diem_danh).toMatchObject({
        ma: 'vang',
        nhan: 'Vắng',
        nguon_tinh: 'lop_khac',
      });
      expect(a2.bo_sung_duoc).toBe(true);
    });

    it('học bù ở lớp Zoom: khóa theo lớp hiện tại -> không tính; công nhận lớp cũ -> tính', async () => {
      hocBu('z2');
      expect((await service.danhSach({}, loc(), NOW)).data[1].tong.co_mat).toBe(
        0,
      );
      cheDo = 'cong_nhan_lop_cu';
      expect((await service.danhSach({}, loc(), NOW)).data[1].tong.co_mat).toBe(
        1,
      );
    });

    it('học bù ở lớp Zoom, cong_nhan_cung_muc: cùng mức -> tính; khác mức -> không', async () => {
      hocBu('z2');
      cheDo = 'cong_nhan_cung_muc';
      expect((await service.danhSach({}, loc(), NOW)).data[1].tong.co_mat).toBe(
        1,
      );
      mucZ = 'nang_cao';
      expect((await service.danhSach({}, loc(), NOW)).data[1].tong.co_mat).toBe(
        0,
      );
      // Khác mức nhưng khóa công nhận bất kể mức -> tính.
      cheDo = 'cong_nhan_lop_cu';
      expect((await service.danhSach({}, loc(), NOW)).data[1].tong.co_mat).toBe(
        1,
      );
    });
  });

  it('chi tiết ngoài phạm vi -> 404', async () => {
    prisma.dang_ky_hoc.findFirst.mockResolvedValue(null);
    await expect(
      service.chiTiet({ cum_id: 'x' }, 'dk-khac', hoTro, NOW),
    ).rejects.toBeInstanceOf(NotFoundAppException);
    await expect(
      service.chiTiet(null, 'dk-an', hoTro, NOW),
    ).rejects.toBeInstanceOf(NotFoundAppException);
  });

  describe('điểm danh bổ sung', () => {
    const thongDiep = (message: string) => ({
      response: { error: expect.objectContaining({ message }) },
    });
    const boSung = (
      lich_hoc_id: string,
      trang_thai: 'co_mat' | 'vang' | 'vang_co_phep' = 'co_mat',
      user = hoTro,
    ) =>
      service.diemDanhBoSung(
        {},
        'dk-an',
        user,
        { lich_hoc_id, trang_thai, ly_do: 'Có minh chứng Zoom' },
        NOW,
      );

    it('buổi cũ đã diễn ra -> ghi thủ công kèm lý do + nhật ký trạng thái cũ/mới', async () => {
      await boSung('b1');
      expect(diemDanh.ghiThuCong).toHaveBeenCalledWith(
        hoTro,
        {
          dang_ky_hoc_id: 'dk-an',
          lich_hoc_id: 'b1',
          trang_thai: 'co_mat',
          ghi_chu: 'Có minh chứng Zoom',
        },
        NOW,
      );
      expect(nhatKy.ghi).toHaveBeenCalledWith(
        expect.objectContaining({
          hanh_dong: 'ho_tro_diem_danh_bo_sung',
          hoc_vien_id: 'hv-dk-an',
          chi_tiet: {
            dang_ky_hoc_id: 'dk-an',
            lich_hoc_id: 'b1',
            trang_thai_cu: 'vang',
            trang_thai_moi: 'co_mat',
          },
        }),
      );
    });

    it('buổi chốt đổi vào là buổi hiệu dụng -> ghi được; buổi nguồn đã đổi ra -> 400', async () => {
      await boSung('c2');
      expect(diemDanh.ghiThuCong).toHaveBeenCalledTimes(1);
      await expect(boSung('a2')).rejects.toMatchObject(
        thongDiep('Buổi học không thuộc lịch học của học viên'),
      );
    });

    it('buổi lớp khác không đổi vào -> 400', async () => {
      await expect(boSung('x9')).rejects.toBeInstanceOf(ValidationException);
      expect(diemDanh.ghiThuCong).not.toHaveBeenCalled();
    });

    it('buổi chưa diễn ra -> 400 "Buổi học chưa diễn ra"', async () => {
      await expect(boSung('a3')).rejects.toMatchObject(
        thongDiep('Buổi học chưa diễn ra'),
      );
    });

    it('hỗ trợ HV ghi "vắng" -> 400; Quản trị ghi "vắng" được, không ghi nhật ký bổ sung', async () => {
      await expect(boSung('b1', 'vang')).rejects.toBeInstanceOf(
        ValidationException,
      );
      await boSung('a3', 'vang', { id: 'qt', vai_tro: 'quan_tri' } as never);
      expect(diemDanh.ghiThuCong).toHaveBeenCalledTimes(1);
      expect(nhatKy.ghi).not.toHaveBeenCalled();
    });
  });
});
