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
    { id: `dk-${ten}`, khoa_id: 'k', cum: null, phan_lop_giai_doan: [] },
  ],
});

// Lớp C, giai đoạn G: phân lớp An, Bình, Cường. Cường đổi ra (sang Zoom 03);
// Dũng (lớp Zoom 02) đổi vào buổi L1.
const PHAN_LOP = ['An', 'Cường', 'Bình'];
const NGOAI = ['Dũng'];

function taoService(
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
    },
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
  const scope = { damBaoLopCuaToi: jest.fn().mockResolvedValue(undefined) };
  const nhatKy = { ghi: jest.fn().mockResolvedValue(undefined) };
  const doiBuoiQuery = {
    dieuChinhTheoBuoi: jest.fn().mockResolvedValue(dieuChinh),
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
});
