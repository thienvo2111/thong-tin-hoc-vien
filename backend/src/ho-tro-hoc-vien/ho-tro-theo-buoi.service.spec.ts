import { Prisma } from '@prisma/client';
import { HoTroHocVienService } from './ho-tro-hoc-vien.service';
import { PrismaService } from '../prisma/prisma.service';
import { HoTroHocVienScopeService } from './ho-tro-hoc-vien-scope.service';
import { HocVienService } from '../hoc-vien/hoc-vien.service';
import { KhoaBoiDuongService } from '../khoa-boi-duong/khoa-boi-duong.service';
import { NhatKyService } from '../nhat-ky/nhat-ky.service';
import { AuthService } from '../auth/auth.service';
import { NhacLichService } from '../nhac-lich/nhac-lich.service';
import { DoiBuoiHocQueryService } from '../doi-buoi-hoc/doi-buoi-hoc-query.service';
import { NotFoundAppException } from '../common/exceptions/app.exceptions';

// ADR 0008 L7: danh sách 1 buổi = phân lớp (lớp, giai đoạn) − đổi ra + đổi
// vào; đổi vào có ghi chú lớp nguồn; đổi ra trả riêng ở doi_ra.
// Học viên giả: dang_ky_hoc id = `dk-<tên>`.
const hv = (ten: string) => ({
  id: `hv-${ten}`,
  ho_ten: ten,
  ma_dinh_danh_moet: `00MOET-${ten}`,
  ngay_sinh: 2,
  thang_sinh: 3,
  nam_sinh: 1988,
  doi_tuong: 'giao_vien',
  so_dien_thoai_lien_he: null,
  email_lien_he: null,
  don_vi_cong_tac: { ten_don_vi: 'Trường A' },
  nguoi_dung_account: null,
  ket_qua_khao_sat: [],
  dang_ky_hoc: [
    {
      id: `dk-${ten}`,
      khoa_id: 'k',
      cum: null,
      phan_lop_giai_doan: PHAN_LOP.includes(ten)
        ? [
            {
              giai_doan_id: 'G',
              lop_id: 'C',
              lop: { ten_lop: 'Zoom 01' },
              giai_doan: { thu_tu: 1, ten_giai_doan: 'Học Zoom' },
            },
          ]
        : [],
    },
  ],
});

// ADR 0008 L8 — điểm danh/báo vắng giả (where lọc như Prisma ở mức cần dùng).
interface WhereDd {
  lich_hoc_id?: string | { in: string[] };
  dang_ky_hoc_id: { in: string[] };
}
const khop = (w: WhereDd, r: { lich_hoc_id: string; dang_ky_hoc_id: string }) =>
  w.dang_ky_hoc_id.in.includes(r.dang_ky_hoc_id) &&
  (w.lich_hoc_id === undefined ||
    (typeof w.lich_hoc_id === 'string'
      ? w.lich_hoc_id === r.lich_hoc_id
      : w.lich_hoc_id.in.includes(r.lich_hoc_id)));
// Buổi (mọi lớp) để nạp quan hệ lich_hoc của dòng diem_danh và lichTomTat.
// T5 = lớp trực tiếp khác (học bù) cùng giai đoạn G, buổi 1.
const LICH_MOI_LOP: Record<
  string,
  {
    lop_id: string;
    ten_lop: string;
    loai_lop: string;
    buoi_so: number;
    ngay: string;
  }
> = {
  L1: {
    lop_id: 'C',
    ten_lop: 'Zoom 01',
    loai_lop: 'zoom',
    buoi_so: 1,
    ngay: '2026-10-20',
  },
  L2: {
    lop_id: 'C',
    ten_lop: 'Zoom 01',
    loai_lop: 'zoom',
    buoi_so: 2,
    ngay: '2026-10-27',
  },
  L9: {
    lop_id: 'C2',
    ten_lop: 'Zoom 02',
    loai_lop: 'zoom',
    buoi_so: 1,
    ngay: '2026-10-19',
  },
  X9: {
    lop_id: 'C3',
    ten_lop: 'Zoom 03',
    loai_lop: 'zoom',
    buoi_so: 1,
    ngay: '2026-10-21',
  },
  T5: {
    lop_id: 'C5',
    ten_lop: 'Trực tiếp 05',
    loai_lop: 'truc_tiep',
    buoi_so: 1,
    ngay: '2026-10-18',
  },
};
const lichTom = (id: string) => {
  const l = LICH_MOI_LOP[id];
  return {
    id,
    lop_id: l.lop_id,
    giai_doan_id: 'G',
    buoi_so: l.buoi_so,
    thoi_gian_bat_dau: new Date(`${l.ngay}T01:00:00Z`),
    lop: { ten_lop: l.ten_lop },
  };
};
type DongDd = {
  dang_ky_hoc_id: string;
  lich_hoc_id: string;
  trang_thai: string;
  nguon: string;
  tu_diem_danh_luc: Date | null;
};
// Dòng SQL của napChuyenCan: điểm danh kèm buổi, lớp, chế độ khóa.
const dongSql = (d: DongDd) => {
  const l = LICH_MOI_LOP[d.lich_hoc_id];
  return {
    ...d,
    lop_id: l.lop_id,
    giai_doan_id: 'G',
    buoi_so: l.buoi_so,
    loai_lop: l.loai_lop,
    ten_lop: l.ten_lop,
    che_do_chuyen_can: 'theo_lop_hien_tai',
  };
};
const DIEM_DANH: DongDd[] = [
  {
    dang_ky_hoc_id: 'dk-An',
    lich_hoc_id: 'L1',
    trang_thai: 'co_mat',
    nguon: 'zoom',
    tu_diem_danh_luc: new Date('2026-10-20T01:05:00Z'),
  },
  {
    dang_ky_hoc_id: 'dk-Dũng',
    lich_hoc_id: 'L1',
    trang_thai: 'co_mat',
    nguon: 'thu_cong',
    tu_diem_danh_luc: null,
  },
  // Cường đổi ra khỏi L1, có mặt ở buổi chốt X9 (lớp Zoom 03).
  {
    dang_ky_hoc_id: 'dk-Cường',
    lich_hoc_id: 'X9',
    trang_thai: 'co_mat',
    nguon: 'zoom',
    tu_diem_danh_luc: null,
  },
];
const BAO_VANG = [
  { dang_ky_hoc_id: 'dk-Bình', lich_hoc_id: 'L1', ly_do: 'Ốm' },
];

// Lớp C, giai đoạn G: phân lớp An, Bình, Cường. Cường đổi ra (sang Zoom 03);
// Dũng (lớp Zoom 02) đổi vào buổi L1.
const PHAN_LOP = ['An', 'Cường', 'Bình'];
const NGOAI = ['Dũng'];

function taoService(
  them: DongDd[] = [],
  dieuChinh = new Map([
    [
      'L1',
      {
        ra: [
          {
            dang_ky_hoc_id: 'dk-Cường',
            lop_chot: { id: 'C3', ten_lop: 'Zoom 03' },
          },
        ],
        vao: [
          {
            dang_ky_hoc_id: 'dk-Dũng',
            lich_nguon_id: 'L9',
            lop_nguon: { id: 'C2', ten_lop: 'Zoom 02' },
          },
        ],
      },
    ],
    ['L2', { ra: [], vao: [] }],
  ]),
) {
  const lich = [
    {
      id: 'L1',
      giai_doan_id: 'G',
      buoi_so: 1,
      thoi_gian_bat_dau: new Date('2026-10-20T01:00:00Z'),
      thoi_gian_ket_thuc: new Date('2026-10-20T04:00:00Z'),
      giai_doan: { id: 'G', thu_tu: 1, ten_giai_doan: 'Học Zoom' },
    },
    {
      id: 'L2',
      giai_doan_id: 'G',
      buoi_so: 2,
      thoi_gian_bat_dau: new Date('2026-10-27T01:00:00Z'),
      thoi_gian_ket_thuc: new Date('2026-10-27T04:00:00Z'),
      giai_doan: { id: 'G', thu_tu: 1, ten_giai_doan: 'Học Zoom' },
    },
  ];
  const prisma = {
    lop_hoc: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'C',
          ten_lop: 'Zoom 01',
          loai_lop: 'zoom',
          muc_nang_luc: null,
          nhom_hoc_vien: null,
          khoa: { id: 'k', ma_khoa: 'K1', ten_khoa: 'Khóa 1' },
        },
      ]),
      count: jest.fn().mockResolvedValue(1),
    },
    // napChuyenCan: điểm danh mọi lớp / lớp hiện tại theo đăng ký (Dũng ở
    // lớp Zoom 02).
    $queryRaw: jest.fn((sql: Prisma.Sql) => {
      const ids = sql.values[0] as string[];
      return Promise.resolve(
        sql.sql.includes('FROM diem_danh')
          ? [...DIEM_DANH, ...them]
              .filter((d) => ids.includes(d.dang_ky_hoc_id))
              .map(dongSql)
          : ids.map((id) => ({
              dang_ky_hoc_id: id,
              giai_doan_id: 'G',
              lop_id: id === 'dk-Dũng' ? 'C2' : 'C',
            })),
      );
    }),
    phan_lop_giai_doan: {
      groupBy: jest.fn(({ by }: { by: string[] }) =>
        Promise.resolve(
          by.includes('dang_ky_hoc_id')
            ? PHAN_LOP.map((t) => ({ lop_id: 'C', dang_ky_hoc_id: `dk-${t}` }))
            : [{ giai_doan_id: 'G', _count: { _all: PHAN_LOP.length } }],
        ),
      ),
    },
    lich_hoc_lop: {
      findMany: jest.fn(({ where }: { where: { id?: string } }) =>
        Promise.resolve(lich.filter((l) => !where.id || l.id === where.id)),
      ),
    },
    hoc_vien: {
      // Mô phỏng where.dang_ky_hoc.some: theo id IN, hoặc phân lớp trừ notIn.
      findMany: jest.fn(
        ({
          where,
        }: {
          where: {
            dang_ky_hoc: {
              some: { id?: { in?: string[]; notIn?: string[] } };
            };
          };
        }) => {
          const dk = where.dang_ky_hoc.some;
          const tatCa = [...PHAN_LOP, ...NGOAI];
          const chon = dk.id?.in
            ? tatCa.filter((t) => dk.id!.in!.includes(`dk-${t}`))
            : PHAN_LOP.filter((t) => !dk.id?.notIn?.includes(`dk-${t}`));
          return Promise.resolve(chon.map(hv));
        },
      ),
    },
  };
  Object.assign(prisma, {
    bao_vang: {
      findMany: jest.fn(({ where }: { where: WhereDd }) =>
        Promise.resolve(BAO_VANG.filter((v) => khop(where, v))),
      ),
    },
  });
  const scope = { damBaoLopCuaToi: jest.fn().mockResolvedValue(undefined) };
  const nhatKy = { ghi: jest.fn().mockResolvedValue(undefined) };
  const doiBuoiQuery = {
    dieuChinhTheoBuoi: jest.fn().mockResolvedValue(dieuChinh),
    // Cường đổi L1 -> X9; Dũng đổi L9 -> L1; An có đổi buổi ở lớp khác
    // (L9 -> X8) — bỏ qua.
    doiBuoiDaDuyetCuaDangKy: jest.fn().mockResolvedValue([
      { dang_ky_hoc_id: 'dk-Cường', lich_nguon_id: 'L1', lich_chot_id: 'X9' },
      { dang_ky_hoc_id: 'dk-Dũng', lich_nguon_id: 'L9', lich_chot_id: 'L1' },
      { dang_ky_hoc_id: 'dk-An', lich_nguon_id: 'L9', lich_chot_id: 'X8' },
    ]),
    lichTomTat: jest.fn((ids: string[]) =>
      Promise.resolve(
        new Map(
          ids.filter((id) => id in LICH_MOI_LOP).map((id) => [id, lichTom(id)]),
        ),
      ),
    ),
  };
  const service = new HoTroHocVienService(
    prisma as unknown as PrismaService,
    scope as unknown as HoTroHocVienScopeService,
    {
      danhGiaDayDu: jest.fn().mockResolvedValue({ day_du: true }),
    } as unknown as HocVienService,
    {} as KhoaBoiDuongService,
    nhatKy as unknown as NhatKyService,
    {} as AuthService,
    {} as NhacLichService,
    doiBuoiQuery as unknown as DoiBuoiHocQueryService,
  );
  return { service, prisma, scope, nhatKy, doiBuoiQuery };
}

describe('HoTroHocVienService — danh sách theo buổi (ADR 0008 L7)', () => {
  it('buoiCuaLop: sĩ số buổi = phân lớp − ra + vào, kèm số đổi vào/ra', async () => {
    const { service, scope, doiBuoiQuery } = taoService();
    const ds = await service.buoiCuaLop('nd', 'C');
    expect(scope.damBaoLopCuaToi).toHaveBeenCalledWith('nd', 'C');
    expect(doiBuoiQuery.dieuChinhTheoBuoi).toHaveBeenCalledWith(['L1', 'L2']);
    expect(ds).toEqual([
      expect.objectContaining({
        lich_id: 'L1',
        buoi_so: 1,
        giai_doan: { id: 'G', thu_tu: 1, ten_giai_doan: 'Học Zoom' },
        si_so: 3,
        so_doi_vao: 1,
        so_doi_ra: 1,
      }),
      expect.objectContaining({
        lich_id: 'L2',
        si_so: 3,
        so_doi_vao: 0,
        so_doi_ra: 0,
      }),
    ]);
  });

  it('hocVienCuaBuoi: phân lớp − đổi ra + đổi vào, xếp theo họ tên', async () => {
    const { service } = taoService();
    const kq = await service.hocVienCuaBuoi('nd', 'C', 'L1');
    expect(kq.lop).toEqual(
      expect.objectContaining({ lop_id: 'C', so_hoc_vien: 3 }),
    );
    expect(kq.buoi).toEqual(
      expect.objectContaining({ lich_id: 'L1', si_so: 3 }),
    );
    expect(kq.hoc_vien.map((h) => h.ho_ten)).toEqual(['An', 'Bình', 'Dũng']);
    expect(kq.hoc_vien.map((h) => h.ho_ten)).not.toContain('Cường');
  });

  it('dòng đổi vào có ghi chú lớp nguồn + cờ vao; dòng thường ghi chú null', async () => {
    const { service } = taoService();
    const kq = await service.hocVienCuaBuoi('nd', 'C', 'L1');
    const dung = kq.hoc_vien.find((h) => h.ho_ten === 'Dũng');
    expect(dung).toEqual(
      expect.objectContaining({
        hoc_vien_id: 'hv-Dũng',
        ngay_sinh: '02/03/1988',
        doi_buoi: 'vao',
        ghi_chu: 'Đổi buổi – từ lớp Zoom 02',
      }),
    );
    const an = kq.hoc_vien.find((h) => h.ho_ten === 'An');
    expect(an).toEqual(
      expect.objectContaining({ doi_buoi: null, ghi_chu: null }),
    );
  });

  it('người đổi ra nằm riêng ở doi_ra với ghi chú lớp chốt', async () => {
    const { service } = taoService();
    const kq = await service.hocVienCuaBuoi('nd', 'C', 'L1');
    expect(kq.doi_ra).toEqual([
      expect.objectContaining({
        ho_ten: 'Cường',
        doi_buoi: 'ra',
        ghi_chu: 'Đã chuyển sang lớp Zoom 03 – không học buổi này',
      }),
    ]);
  });

  it('học bù (ADR 0012): người học bù ở buổi gốc vẫn trong DS (không doi_ra, không trừ sĩ số); người học bù vào ghi chú "Học bù"', async () => {
    const { service } = taoService(
      [],
      new Map([
        [
          'L1',
          {
            ra: [
              {
                dang_ky_hoc_id: 'dk-Cường',
                lop_chot: { id: 'C3', ten_lop: 'Zoom 03' },
                loai: 'hoc_bu',
              },
            ],
            vao: [
              {
                dang_ky_hoc_id: 'dk-Dũng',
                lich_nguon_id: 'L9',
                lop_nguon: { id: 'C2', ten_lop: 'Zoom 02' },
                loai: 'hoc_bu',
              },
            ],
          },
        ],
        ['L2', { ra: [], vao: [] }],
      ]) as never,
    );
    const ds = await service.buoiCuaLop('nd', 'C');
    expect(ds[0]).toEqual(
      expect.objectContaining({
        lich_id: 'L1',
        si_so: 4,
        so_doi_ra: 0,
        so_doi_vao: 1,
      }),
    );
    const kq = await service.hocVienCuaBuoi('nd', 'C', 'L1');
    expect(kq.hoc_vien.map((h) => h.ho_ten)).toEqual([
      'An',
      'Bình',
      'Cường',
      'Dũng',
    ]);
    expect(kq.doi_ra).toEqual([]);
    expect(kq.hoc_vien.find((h) => h.ho_ten === 'Dũng')).toEqual(
      expect.objectContaining({
        doi_buoi: 'vao',
        ghi_chu: 'Học bù – từ lớp Zoom 02',
      }),
    );
  });

  it('buổi không có đổi buổi hiệu lực -> đúng danh sách phân lớp, doi_ra rỗng', async () => {
    const { service } = taoService();
    const kq = await service.hocVienCuaBuoi('nd', 'C', 'L2');
    expect(kq.hoc_vien.map((h) => h.ho_ten)).toEqual(['An', 'Bình', 'Cường']);
    expect(kq.doi_ra).toEqual([]);
  });

  it('buổi không thuộc lớp -> 404 Không tìm thấy buổi học', async () => {
    const { service } = taoService();
    const loi: unknown = await service
      .hocVienCuaBuoi('nd', 'C', 'L-khac')
      .catch((e: unknown) => e);
    expect(loi).toBeInstanceOf(NotFoundAppException);
    expect((loi as NotFoundAppException).getResponse()).toEqual({
      error: { code: 'NOT_FOUND', message: 'Không tìm thấy buổi học' },
    });
  });

  it('lớp không được gắn -> lỗi phạm vi, không đọc buổi', async () => {
    const { service, scope, prisma } = taoService();
    scope.damBaoLopCuaToi.mockRejectedValue(
      new NotFoundAppException('Không tìm thấy lớp'),
    );
    await expect(service.buoiCuaLop('nd', 'C')).rejects.toBeInstanceOf(
      NotFoundAppException,
    );
    expect(prisma.lich_hoc_lop.findMany).not.toHaveBeenCalled();
  });

  it('xuatDanhSachBuoi: không lich_id -> mọi buổi, ghi nhật ký ho_tro_xuat_danh_sach_buoi', async () => {
    const { service, nhatKy } = taoService();
    const buf = await service.xuatDanhSachBuoi('nd', 'ho_tro_hoc_vien', 'C');
    expect(buf.length).toBeGreaterThan(0);
    expect(nhatKy.ghi).toHaveBeenCalledWith({
      hanh_dong: 'ho_tro_xuat_danh_sach_buoi',
      nguoi_dung: { id: 'nd', vai_tro: 'ho_tro_hoc_vien' },
      // L1: 3 trong DS + 1 đổi ra; L2: 3.
      chi_tiet: { lop_id: 'C', lich_ids: ['L1', 'L2'], so_dong: 7 },
    });
  });

  // Quản trị: cùng logic, phạm vi toàn hệ thống — không qua phân công hỗ trợ lớp.
  it('quan_tri: không kiểm tra phân công, cùng sĩ số/DS như hỗ trợ', async () => {
    const { service, scope } = taoService();
    const ht = await service.buoiCuaLop('nd', 'C');
    scope.damBaoLopCuaToi.mockClear();
    expect(await service.buoiCuaLop('qt', 'C', 'quan_tri')).toEqual(ht);
    const ds = await service.hocVienCuaBuoi('qt', 'C', 'L1', 'quan_tri');
    expect(ds.buoi.lich_id).toBe('L1');
    expect(scope.damBaoLopCuaToi).not.toHaveBeenCalled();
  });

  it('quan_tri: lớp không tồn tại -> 404, không đọc buổi', async () => {
    const { service, prisma } = taoService();
    prisma.lop_hoc.count.mockResolvedValue(0);
    for (const goi of [
      () => service.buoiCuaLop('qt', 'X', 'quan_tri'),
      () => service.hocVienCuaBuoi('qt', 'X', 'L1', 'quan_tri'),
      () => service.xuatDanhSachBuoi('qt', 'quan_tri', 'X'),
    ]) {
      await expect(goi()).rejects.toBeInstanceOf(NotFoundAppException);
    }
    expect(prisma.lich_hoc_lop.findMany).not.toHaveBeenCalled();
  });

  it('quan_tri xuất: ghi nhật ký xuat_danh_sach_buoi', async () => {
    const { service, nhatKy } = taoService();
    await service.xuatDanhSachBuoi('qt', 'quan_tri', 'C', 'L2');
    expect(nhatKy.ghi).toHaveBeenCalledWith({
      hanh_dong: 'xuat_danh_sach_buoi',
      nguoi_dung: { id: 'qt', vai_tro: 'quan_tri' },
      chi_tiet: { lop_id: 'C', lich_ids: ['L2'], so_dong: 3 },
    });
  });
});

// ADR 0008 L8 — điểm danh trên DS buổi + chuyên cần trên DS lớp. "Bây giờ" =
// 2026-10-25: L1 (20/10) đã diễn ra, L2 (27/10) chưa.
describe('HoTroHocVienService — điểm danh theo buổi & chuyên cần (ADR 0008 L8)', () => {
  beforeEach(() => {
    jest.useFakeTimers({
      now: new Date('2026-10-25T00:00:00Z'),
      doNotFake: [
        'nextTick',
        'setImmediate',
        'clearImmediate',
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'queueMicrotask',
      ],
    });
  });
  afterEach(() => jest.useRealTimers());

  it('hocVienCuaBuoi: diem_danh cho dòng thường + đổi vào (theo đăng ký của họ), báo vắng, MOET; đổi ra null', async () => {
    const { service } = taoService();
    const kq = await service.hocVienCuaBuoi('nd', 'C', 'L1');
    const theoTen = Object.fromEntries(
      kq.hoc_vien.map((h) => [h.ho_ten, h.diem_danh]),
    );
    expect(theoTen['An']).toEqual({
      ma: 'co_mat',
      nhan: 'Có mặt – tự điểm danh 08:05',
      tu_diem_danh_luc: '2026-10-20T01:05:00.000Z',
      nguon_tinh: 'lop_hien_tai',
      lop_tinh: { id: 'C', ten_lop: 'Zoom 01' },
    });
    expect(theoTen['Bình']).toEqual({
      ma: 'da_bao_vang',
      nhan: 'Đã báo vắng: Ốm',
      tu_diem_danh_luc: null,
      nguon_tinh: null,
      lop_tinh: null,
    });
    expect(theoTen['Dũng']).toEqual({
      ma: 'co_mat',
      nhan: 'Có mặt (Thủ công)',
      tu_diem_danh_luc: null,
      nguon_tinh: 'lop_hien_tai',
      lop_tinh: { id: 'C', ten_lop: 'Zoom 01' },
    });
    expect(kq.hoc_vien[0].ma_dinh_danh_moet).toBe('00MOET-An');
    expect(kq.doi_ra[0]).toEqual(
      expect.objectContaining({ ho_ten: 'Cường', diem_danh: null }),
    );
    expect(kq.buoi.tong_diem_danh).toEqual({
      co_mat: 2,
      vang: 0,
      vang_co_phep: 0,
      da_bao_vang: 1,
      chua_diem_danh: 0,
      chua_den_gio: 0,
    });
  });

  it('buổi chưa bắt đầu, không có điểm danh -> Chưa đến giờ', async () => {
    const { service } = taoService();
    const kq = await service.hocVienCuaBuoi('nd', 'C', 'L2');
    expect(kq.hoc_vien.map((h) => h.diem_danh?.ma)).toEqual([
      'chua_den_gio',
      'chua_den_gio',
      'chua_den_gio',
    ]);
    expect(kq.buoi.tong_diem_danh.chua_den_gio).toBe(3);
  });

  it('hocVienCuaLop: chuyen_can x/y — buổi tương lai không tính, đổi ra tính theo buổi chốt; có MOET', async () => {
    const { service, doiBuoiQuery } = taoService();
    const kq = await service.hocVienCuaLop('nd', 'C');
    // Theo lô, không theo từng đăng ký: 1 lần cho buổi chốt + 1 lần trong napChuyenCan.
    expect(doiBuoiQuery.doiBuoiDaDuyetCuaDangKy).toHaveBeenCalledTimes(2);
    expect(
      kq.hoc_vien.map((h) => [h.ho_ten, h.ma_dinh_danh_moet, h.chuyen_can]),
    ).toEqual([
      ['An', '00MOET-An', { co_mat: 1, da_dien_ra: 1 }],
      ['Bình', '00MOET-Bình', { co_mat: 0, da_dien_ra: 1 }],
      ['Cường', '00MOET-Cường', { co_mat: 1, da_dien_ra: 1 }],
    ]);
  });

  // ADR 0010 T7: Bình học bù buổi 1 (giai đoạn G) ở lớp trực tiếp khác.
  const HOC_BU_BINH: DongDd = {
    dang_ky_hoc_id: 'dk-Bình',
    lich_hoc_id: 'T5',
    trang_thai: 'co_mat',
    nguon: 'ky_ten',
    tu_diem_danh_luc: null,
  };

  it('học bù ở lớp khác cùng (giai đoạn, buổi số) -> DS buổi ghi "Có mặt – ở lớp …", tổng có mặt tính cả', async () => {
    const { service } = taoService([HOC_BU_BINH]);
    const kq = await service.hocVienCuaBuoi('nd', 'C', 'L1');
    expect(kq.hoc_vien.find((h) => h.ho_ten === 'Bình')?.diem_danh).toEqual({
      ma: 'co_mat',
      nhan: 'Có mặt – ở lớp Trực tiếp 05',
      tu_diem_danh_luc: null,
      nguon_tinh: 'lop_khac',
      lop_tinh: { id: 'C5', ten_lop: 'Trực tiếp 05' },
    });
    expect(kq.buoi.tong_diem_danh).toMatchObject({ co_mat: 3, da_bao_vang: 0 });
  });

  it('học bù ở lớp khác -> chuyen_can trên DS lớp tính có mặt (khớp dashboard)', async () => {
    const { service } = taoService([HOC_BU_BINH]);
    const kq = await service.hocVienCuaLop('nd', 'C');
    expect(kq.hoc_vien.find((h) => h.ho_ten === 'Bình')?.chuyen_can).toEqual({
      co_mat: 1,
      da_dien_ra: 1,
    });
  });

  it('học bù ở lớp Zoom khác, khóa theo lớp hiện tại -> không tính', async () => {
    const { service } = taoService([{ ...HOC_BU_BINH, lich_hoc_id: 'X9' }]);
    const kq = await service.hocVienCuaLop('nd', 'C');
    expect(kq.hoc_vien.find((h) => h.ho_ten === 'Bình')?.chuyen_can).toEqual({
      co_mat: 0,
      da_dien_ra: 1,
    });
  });
});
