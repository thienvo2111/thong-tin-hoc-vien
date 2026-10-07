import { XepHangService } from './xep-hang.service';
import { PrismaService } from '../prisma/prisma.service';
import { ThongKeScopeService } from './thong-ke-scope.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ForbiddenAppException } from '../common/exceptions/app.exceptions';

function caller(
  vai_tro: AuthenticatedUser['vai_tro'],
  don_vi_id: string | null = null,
): AuthenticatedUser {
  return {
    id: 'u-1',
    ten_dang_nhap: 'x',
    vai_tro,
    don_vi_id,
    hoc_vien_id: null,
    phai_doi_mat_khau: false,
    jti: 'jti-1',
    exp: 9999999999,
  };
}

type DonVi = {
  id: string;
  ten_don_vi: string;
  don_vi_cha_id: string | null;
  loai_don_vi: string;
};
const dv = (
  id: string,
  cha: string | null,
  loai: string,
  ten = `Ten ${id}`,
): DonVi => ({ id, ten_don_vi: ten, don_vi_cha_id: cha, loai_don_vi: loai });

// n học viên của đơn vị: `dangNhap` người đã đăng nhập, `daKs` người có đánh giá, `dat` lượt đạt.
function hocVien(
  donVi: string,
  n: number,
  { dangNhap = 0, daKs = 0, dat = 0 } = {},
) {
  return Array.from({ length: n }, (_, i) => ({
    hoc_vien_id: `${donVi}-hv${i}`,
    ket_qua: i < dat ? 'dat' : null,
    hoc_vien: {
      don_vi_cong_tac_id: donVi,
      nguoi_dung_account: {
        dang_nhap_lan_cuoi: i < dangNhap ? new Date() : null,
      },
      ket_qua_khao_sat: i < daKs ? [{ id: `ks-${donVi}-${i}` }] : [],
    },
  }));
}

describe('XepHangService', () => {
  let service: XepHangService;
  let prisma: {
    don_vi_cong_tac: { findMany: jest.Mock };
    dang_ky_hoc: { findMany: jest.Mock };
  };
  let scope: { resolve: jest.Mock };

  const setup = (donVi: DonVi[], dangKy: unknown[], rong = false) => {
    prisma.don_vi_cong_tac.findMany.mockResolvedValue(donVi);
    prisma.dang_ky_hoc.findMany.mockResolvedValue(dangKy);
    scope.resolve.mockResolvedValue({
      where: { SCOPE: 1 },
      rong,
      khoaIds: 'ALL',
    });
  };

  beforeEach(() => {
    prisma = {
      don_vi_cong_tac: { findMany: jest.fn() },
      dang_ky_hoc: { findMany: jest.fn() },
    };
    scope = { resolve: jest.fn() };
    service = new XepHangService(
      prisma as unknown as PrismaService,
      scope as unknown as ThongKeScopeService,
    );
  });

  it('ho_tro_hoc_vien -> Forbidden', async () => {
    await expect(
      service.xepHang(caller('ho_tro_hoc_vien'), { chi_so: 'dat' }),
    ).rejects.toBeInstanceOf(ForbiddenAppException);
  });

  it('rong -> bảng rỗng, không truy vấn dữ liệu', async () => {
    setup([], [], true);
    const r = await service.xepHang(caller('so_gddt', 'so'), { chi_so: 'dat' });
    expect(r).toEqual({ kieu: 'bang', top: [], bottom: [], tong_so: 0 });
    expect(prisma.dang_ky_hoc.findMany).not.toHaveBeenCalled();
  });

  it('đơn vị 4 HV bị loại, 5 HV được giữ', async () => {
    setup(
      [
        dv('so', null, 'so_gddt'),
        dv('a', 'so', 'truong'),
        dv('b', 'so', 'truong'),
      ],
      [
        ...hocVien('a', 4, { dangNhap: 4 }),
        ...hocVien('b', 5, { dangNhap: 5 }),
      ],
    );
    const r = await service.xepHang(caller('so_gddt', 'so'), {
      chi_so: 'truy_cap',
    });
    if (r.kieu !== 'bang') throw new Error('kieu');
    expect(r.tong_so).toBe(1);
    expect(r.top).toEqual([
      { don_vi_id: 'b', ten_don_vi: 'Ten b', so_hv: 5, gia_tri: 1 },
    ]);
  });

  it('top giảm dần tối đa 10; bottom tăng dần (thấp nhất đứng đầu)', async () => {
    const donVi = [dv('so', null, 'so_gddt')];
    const dk: unknown[] = [];
    for (let i = 0; i < 25; i++) {
      donVi.push(dv(`t${i}`, 'so', 'truong'));
      dk.push(...hocVien(`t${i}`, 5, { dangNhap: i % 6 }));
    }
    setup(donVi, dk);
    const r = await service.xepHang(caller('so_gddt', 'so'), {
      chi_so: 'truy_cap',
    });
    if (r.kieu !== 'bang') throw new Error('kieu');
    expect(r.tong_so).toBe(25);
    expect(r.top).toHaveLength(10);
    expect(r.bottom).toHaveLength(10);
    const g = r.top.map((d) => d.gia_tri);
    expect(g).toEqual([...g].sort((a, b) => b - a));
    const gb = r.bottom.map((d) => d.gia_tri);
    expect(gb).toEqual([...gb].sort((a, b) => a - b));
    expect(r.top[9].gia_tri).toBeGreaterThanOrEqual(r.bottom[9].gia_tri);
  });

  it('tong_so ≤ 10 -> bottom rỗng', async () => {
    const donVi = [dv('so', null, 'so_gddt')];
    const dk: unknown[] = [];
    for (let i = 0; i < 10; i++) {
      donVi.push(dv(`t${i}`, 'so', 'truong'));
      dk.push(...hocVien(`t${i}`, 5));
    }
    setup(donVi, dk);
    const r = await service.xepHang(caller('so_gddt', 'so'), { chi_so: 'dat' });
    if (r.kieu !== 'bang') throw new Error('kieu');
    expect(r.top).toHaveLength(10);
    expect(r.bottom).toEqual([]);
  });

  it('11..19 đơn vị: bottom không trùng top', async () => {
    const donVi = [dv('so', null, 'so_gddt')];
    const dk: unknown[] = [];
    for (let i = 0; i < 14; i++) {
      donVi.push(dv(`t${i}`, 'so', 'truong'));
      dk.push(...hocVien(`t${i}`, 5, { dangNhap: i % 6 }));
    }
    setup(donVi, dk);
    const r = await service.xepHang(caller('so_gddt', 'so'), {
      chi_so: 'truy_cap',
    });
    if (r.kieu !== 'bang') throw new Error('kieu');
    expect(r.bottom).toHaveLength(4);
    const ids = new Set(r.top.map((d) => d.don_vi_id));
    expect(r.bottom.some((d) => ids.has(d.don_vi_id))).toBe(false);
  });

  it('chỉ số khao_sat và dat tính đúng', async () => {
    setup(
      [dv('so', null, 'so_gddt'), dv('a', 'so', 'truong')],
      hocVien('a', 5, { daKs: 2, dat: 3 }),
    );
    const u = caller('so_gddt', 'so');
    const ks = await service.xepHang(u, { chi_so: 'khao_sat' });
    const dat = await service.xepHang(u, { chi_so: 'dat' });
    if (ks.kieu !== 'bang' || dat.kieu !== 'bang') throw new Error('kieu');
    expect(ks.top[0].gia_tri).toBeCloseTo(0.4);
    expect(dat.top[0].gia_tri).toBeCloseTo(0.6);
  });

  it('một HV đăng ký 2 khóa chỉ đếm 1 HV; dat tính theo lượt', async () => {
    const dk = hocVien('a', 5, { dangNhap: 5 });
    dk[0].ket_qua = 'dat';
    dk.push({ ...dk[0] }); // lượt thứ 2 của hv0, cũng đạt
    setup([dv('so', null, 'so_gddt'), dv('a', 'so', 'truong')], dk);
    const r = await service.xepHang(caller('so_gddt', 'so'), { chi_so: 'dat' });
    if (r.kieu !== 'bang') throw new Error('kieu');
    expect(r.top[0].so_hv).toBe(5);
    expect(r.top[0].gia_tri).toBeCloseTo(2 / 6);
  });

  it('quan_tri không don_vi_id -> gộp HV của phòng/trường con vào Sở gốc', async () => {
    setup(
      [
        dv('so', null, 'so_gddt', 'Sở A'),
        dv('phong', 'so', 'phong_vhxh'),
        dv('truong', 'phong', 'truong'),
        dv('so2', null, 'so_gddt', 'Sở B'),
      ],
      [
        ...hocVien('so', 2, { dangNhap: 2 }),
        ...hocVien('phong', 2, { dangNhap: 2 }),
        ...hocVien('truong', 2, { dangNhap: 0 }),
        ...hocVien('so2', 5, { dangNhap: 5 }),
      ],
    );
    const r = await service.xepHang(caller('quan_tri'), { chi_so: 'truy_cap' });
    if (r.kieu !== 'bang') throw new Error('kieu');
    expect(r.top.find((d) => d.don_vi_id === 'so')).toEqual({
      don_vi_id: 'so',
      ten_don_vi: 'Sở A',
      so_hv: 6,
      gia_tri: 4 / 6,
    });
    expect(r.tong_so).toBe(2);
    expect(scope.resolve).toHaveBeenCalled();
  });

  it('quan_tri không don_vi_id -> chỉ nhóm Sở/Phòng gốc, bỏ trường mồ côi và loại khac', async () => {
    setup(
      [
        dv('so', null, 'so_gddt', 'Sở A'),
        dv('mocoi', null, 'truong', 'Trường mồ côi'),
        dv('khac', null, 'khac', 'Khác'),
      ],
      [
        ...hocVien('so', 5),
        ...hocVien('mocoi', 5),
        ...hocVien('khac', 5),
      ],
    );
    const r = await service.xepHang(caller('quan_tri'), { chi_so: 'truy_cap' });
    if (r.kieu !== 'bang') throw new Error('kieu');
    expect(r.top.map((d) => d.don_vi_id)).toEqual(['so']);
    expect(r.tong_so).toBe(1);
  });

  it('so_gddt -> xếp hạng các trường trong cây con, bỏ phòng và cây khác', async () => {
    setup(
      [
        dv('so', null, 'so_gddt'),
        dv('phong', 'so', 'phong_vhxh'),
        dv('t1', 'phong', 'truong'),
        dv('other', null, 'so_gddt'),
        dv('t2', 'other', 'truong'),
      ],
      [...hocVien('phong', 5), ...hocVien('t1', 5), ...hocVien('t2', 5)],
    );
    const r = await service.xepHang(caller('so_gddt', 'so'), { chi_so: 'dat' });
    if (r.kieu !== 'bang') throw new Error('kieu');
    expect(r.top.map((d) => d.don_vi_id)).toEqual(['t1']);
  });

  describe('truong', () => {
    const cay = [
      dv('phong', null, 'phong_vhxh', 'Phòng X'),
      dv('me', 'phong', 'truong', 'Trường Mình'),
      dv('khac1', 'phong', 'truong', 'Trường Khác Một'),
      dv('khac2', 'phong', 'truong', 'Trường Khác Hai'),
      dv('xa', null, 'phong_vhxh', 'Phòng Xa'),
      dv('truongxa', 'xa', 'truong', 'Trường Xa'),
    ];

    it('kieu vi_tri, không lộ id/tên trường khác', async () => {
      setup(cay, [
        ...hocVien('me', 5, { dangNhap: 3 }),
        ...hocVien('khac1', 5, { dangNhap: 5 }),
        ...hocVien('khac2', 5, { dangNhap: 1 }),
        ...hocVien('truongxa', 5, { dangNhap: 5 }),
      ]);
      const r = await service.xepHang(caller('truong', 'me'), {
        chi_so: 'truy_cap',
      });
      expect(r).toEqual({
        kieu: 'vi_tri',
        thu_hang: 2,
        tong_so: 3,
        gia_tri: 0.6,
        trung_binh: (0.6 + 1 + 0.2) / 3,
      });
      const json = JSON.stringify(r);
      const cam = cay.filter((d) => d.id !== 'me');
      for (const d of cam) {
        expect(json).not.toContain(d.id);
        expect(json).not.toContain(d.ten_don_vi);
      }
    });

    it('truy vấn giới hạn theo các trường so sánh, không dùng where scope', async () => {
      setup(cay, hocVien('me', 5));
      await service.xepHang(caller('truong', 'me'), {
        chi_so: 'dat',
        khoa_id: 'k1',
      });
      const arg = prisma.dang_ky_hoc.findMany.mock.calls[0][0];
      expect(arg.where).toEqual({
        AND: [
          { khoa_id: 'k1' },
          {
            hoc_vien: { don_vi_cong_tac_id: { in: ['khac1', 'khac2', 'me'] } },
          },
        ],
      });
    });

    it('trường mình < 5 HV -> thu_hang null; tong_so 2 -> trung_binh null (không suy ra giá trị trường kia)', async () => {
      setup(cay, [
        ...hocVien('me', 4, { dangNhap: 4 }),
        ...hocVien('khac1', 5, { dangNhap: 5 }),
        ...hocVien('khac2', 5, { dangNhap: 1 }),
      ]);
      const r = await service.xepHang(caller('truong', 'me'), {
        chi_so: 'truy_cap',
      });
      expect(r).toEqual({
        kieu: 'vi_tri',
        thu_hang: null,
        tong_so: 2,
        gia_tri: null,
        trung_binh: null,
      });
    });

    it('tong_so = 3 -> trung_binh là số; tong_so = 2 -> null', async () => {
      setup(cay, [
        ...hocVien('me', 5, { dangNhap: 5 }),
        ...hocVien('khac1', 5, { dangNhap: 5 }),
        ...hocVien('khac2', 5, { dangNhap: 0 }),
      ]);
      const ba = await service.xepHang(caller('truong', 'me'), {
        chi_so: 'truy_cap',
      });
      if (ba.kieu !== 'vi_tri') throw new Error('kieu');
      expect(ba.tong_so).toBe(3);
      expect(ba.trung_binh).toBeCloseTo(2 / 3);

      setup(cay, [
        ...hocVien('me', 5, { dangNhap: 5 }),
        ...hocVien('khac1', 5, { dangNhap: 0 }),
      ]);
      const hai = await service.xepHang(caller('truong', 'me'), {
        chi_so: 'truy_cap',
      });
      if (hai.kieu !== 'vi_tri') throw new Error('kieu');
      expect(hai.tong_so).toBe(2);
      expect(hai.trung_binh).toBeNull();
    });

    it('trường không có don_vi_cha_id -> vi_tri rỗng, không truy vấn dữ liệu', async () => {
      setup([dv('me', null, 'truong')], []);
      const r = await service.xepHang(caller('truong', 'me'), {
        chi_so: 'dat',
      });
      expect(r).toEqual({
        kieu: 'vi_tri',
        thu_hang: null,
        tong_so: 0,
        gia_tri: null,
        trung_binh: null,
      });
      expect(prisma.dang_ky_hoc.findMany).not.toHaveBeenCalled();
    });

    it('rong (don_vi_id null) -> vi_tri rỗng', async () => {
      setup(cay, [], true);
      const r = await service.xepHang(caller('truong'), { chi_so: 'dat' });
      expect(r).toEqual({
        kieu: 'vi_tri',
        thu_hang: null,
        tong_so: 0,
        gia_tri: null,
        trung_binh: null,
      });
      expect(prisma.dang_ky_hoc.findMany).not.toHaveBeenCalled();
    });
  });
});
