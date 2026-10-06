import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoDonViTest,
  uniqueSuffix,
  xoaNguoiDungTest,
  xoaDonViTest,
} from './utils/test-data';

const GIO = 3600 * 1000;
const NGAY = 24 * GIO;

// ADR 0004 L9 (issue #22): màn giám sát Vận hành — mỗi khối đúng dữ liệu, không lẫn.
describe('Vận hành (giám sát Quản trị) — L9 (e2e)', () => {
  let app: INestApplication;
  const suf = uniqueSuffix();
  let dv: Awaited<ReturnType<typeof taoDonViTest>>;
  const nguoiDungIds: string[] = [];
  const khoa: Record<string, string> = {};
  const cum: Record<string, string> = {};
  const dn: Record<string, string> = {};
  const hvIds: string[] = [];
  const dhIds: string[] = [];
  const gvIds: string[] = [];
  let gdK2: string;
  let lopA: string;
  let buoiA: string;
  const tk: Record<string, string> = {};
  let body: Record<string, any>;

  const http = () => request(app.getHttpServer());
  const auth = (ai: string) => ({ Authorization: `Bearer ${tk[ai]}` });

  async function taoNguoi(
    ma: string,
    vaiTro: 'quan_tri' | 'ho_tro_giang_vien' | 'ho_tro_hoc_vien',
  ) {
    const nd = await prisma.nguoi_dung.create({
      data: {
        ho_ten: `ND ${ma} VH`,
        ten_dang_nhap: `vh-${ma}-${suf}`.toLowerCase(),
        email: `vh-${ma}-${suf}@x.vn`.toLowerCase(),
        vai_tro: vaiTro,
        mat_khau_hash: await bcrypt.hash('MatKhau123', 4),
        phai_doi_mat_khau: false,
      },
    });
    nguoiDungIds.push(nd.id);
    tk[ma] = (
      await http()
        .post('/auth/dang-nhap')
        .send({ ten_dang_nhap: nd.ten_dang_nhap, mat_khau: 'MatKhau123' })
        .expect(200)
    ).body.token;
    return nd;
  }

  async function taoKhoa(ma: string, ketThuc: Date) {
    const k = await prisma.khoa_boi_duong.create({
      data: {
        ma_khoa: `VH${ma}-${suf}`.slice(0, 30),
        ten_khoa: `Khóa ${ma}`,
        don_vi_dat_hang_id: dv.donVi.id,
        thoi_gian_bat_dau: new Date('2026-01-01'),
        thoi_gian_ket_thuc: ketThuc,
        trang_thai: 'da_duyet',
      },
    });
    khoa[ma] = k.id;
    const gd = await prisma.giai_doan_khoa.create({
      data: {
        khoa_id: k.id,
        thu_tu: 1,
        ten_giai_doan: 'Trực tiếp',
        hinh_thuc: 'truc_tiep',
        thoi_gian_bat_dau: new Date('2026-01-01'),
        thoi_gian_ket_thuc: ketThuc,
      },
    });
    return gd.id;
  }

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    dv = await taoDonViTest('vh');
    const admin = await taoNguoi('admin', 'quan_tri');
    const htgv = await taoNguoi('htgv', 'ho_tro_giang_vien');
    const hthv = await taoNguoi('hthv', 'ho_tro_hoc_vien');

    await taoKhoa('K1', new Date('2027-12-31'));
    gdK2 = await taoKhoa('K2', new Date('2027-12-31'));
    await taoKhoa('K3', new Date(Date.now() - 30 * NGAY));
    await prisma.phan_cong_ho_tro_gv.create({
      data: { nguoi_dung_id: htgv.id, khoa_id: khoa.K2 },
    });

    const taoCum = async (ma: string, khoaId: string) =>
      (cum[ma] = (
        await prisma.cum_hoc_vien.create({
          data: { khoa_id: khoaId, ten_cum: `Cụm ${ma} VH` },
        })
      ).id);
    await taoCum('C1', khoa.K1);
    await taoCum('C2', khoa.K1);
    await taoCum('C3', khoa.K3);
    await prisma.phan_cong_ho_tro.create({
      data: { nguoi_dung_id: hthv.id, cum_id: cum.C2 },
    });

    // Điểm học / giảng viên: do hỗ trợ GV tạo (hiện) và do Quản trị tạo (không hiện).
    const taoDh = async (ma: string, taoBoi: string) => {
      const d = await prisma.diem_hoc.create({
        data: {
          ma_diem_hoc: `VH${ma}-${suf}`.slice(0, 30),
          ten: `ĐH ${ma} VH`,
          dia_chi: 'x',
          dia_ban_id: dv.diaDanhXa.id,
          tao_boi: taoBoi,
        },
      });
      dhIds.push(d.id);
      return d.id;
    };
    await taoDh('HT', htgv.id);
    const dhAdmin = await taoDh('QT', admin.id);
    const sdt = String(Date.now()).slice(-7);
    for (const [ma, taoBoi, i] of [
      ['HT', htgv.id, 1],
      ['QT', admin.id, 2],
    ] as const) {
      const g = await prisma.giang_vien.create({
        data: {
          ho_ten: `GV ${ma} VH`,
          so_dien_thoai: `05${i}${sdt}`,
          tao_boi: taoBoi,
        },
      });
      gvIds.push(g.id);
    }

    // Đợt K2: lớp A có buổi +2 ngày, chưa GV → đỏ; lớp B buổi +40 ngày → ngoài 21 ngày.
    const taoLop = async (ten: string) =>
      (
        await prisma.lop_hoc.create({
          data: { khoa_id: khoa.K2, loai_lop: 'truc_tiep', ten_lop: ten },
        })
      ).id;
    lopA = await taoLop('Lớp A VH');
    const lopB = await taoLop('Lớp B VH');
    const taoBuoi = async (lop: string, bd: Date) =>
      (
        await prisma.lich_hoc_lop.create({
          data: {
            lop_id: lop,
            giai_doan_id: gdK2,
            buoi_so: 1,
            thoi_gian_bat_dau: bd,
            thoi_gian_ket_thuc: new Date(bd.getTime() + 3 * GIO),
            diem_hoc_id: dhAdmin,
          },
        })
      ).id;
    buoiA = await taoBuoi(lopA, new Date(Date.now() + 2 * NGAY));
    await taoBuoi(lopB, new Date(Date.now() + 40 * NGAY));

    // Đề nghị đổi lớp: chờ 3 ngày (hiện), chờ 1 ngày (không), đã duyệt 3 ngày (không).
    const taoDeNghi = async (
      ma: string,
      trangThai: 'cho_duyet' | 'da_duyet',
      ngayTruoc: number,
    ) => {
      const h = await prisma.hoc_vien.create({
        data: {
          nguon_tao: 'import_moet',
          ma_dinh_danh_moet: `VH${ma}${suf}`.slice(0, 20),
          ho_ten: `HV ${ma} VH`,
          ngay_sinh: 1,
          thang_sinh: 1,
          nam_sinh: 1990,
          don_vi_cong_tac_id: dv.donVi.id,
          trang_thai: 'nhap',
        },
      });
      hvIds.push(h.id);
      const dk = await prisma.dang_ky_hoc.create({
        data: {
          hoc_vien_id: h.id,
          khoa_id: khoa.K2,
          trang_thai: 'da_duyet',
          cum_id: null,
        },
      });
      dn[ma] = (
        await prisma.de_nghi_doi_lop.create({
          data: {
            dang_ky_hoc_id: dk.id,
            giai_doan_id: gdK2,
            lop_de_nghi_id: lopB,
            ly_do: 'Gần nhà',
            trang_thai: trangThai,
            tao_luc: new Date(Date.now() - ngayTruoc * NGAY),
          },
        })
      ).id;
    };
    await taoDeNghi('lau', 'cho_duyet', 3);
    await taoDeNghi('moi', 'cho_duyet', 1);
    await taoDeNghi('xong', 'da_duyet', 3);

    // Thay đổi lịch thật qua người hỗ trợ GV (ghi nhật ký sua_lich_hoc).
    const bd = new Date(Date.now() + 2 * NGAY + GIO);
    await http()
      .patch(`/ho-tro-giang-vien/lich-hoc/${buoiA}`)
      .set(auth('htgv'))
      .send({
        thoi_gian_bat_dau: bd.toISOString(),
        thoi_gian_ket_thuc: new Date(bd.getTime() + 3 * GIO).toISOString(),
        ly_do: 'Điểm học mất điện VH',
      })
      .expect(200);

    body = (await http().get('/van-hanh').set(auth('admin')).expect(200)).body;
  });

  afterAll(async () => {
    const khoaIds = Object.values(khoa);
    await prisma.dang_ky_hoc.deleteMany({
      where: { khoa_id: { in: khoaIds } },
    });
    await prisma.hoc_vien.deleteMany({ where: { id: { in: hvIds } } });
    await prisma.lich_hoc_lop.deleteMany({
      where: { lop: { khoa_id: { in: khoaIds } } },
    });
    await prisma.khoa_boi_duong.deleteMany({ where: { id: { in: khoaIds } } });
    await prisma.giang_vien.deleteMany({ where: { id: { in: gvIds } } });
    await prisma.diem_hoc.deleteMany({ where: { id: { in: dhIds } } });
    for (const id of nguoiDungIds) await xoaNguoiDungTest(id);
    await xoaDonViTest([dv.donVi.id], [dv.diaDanhXa.id, dv.diaDanhTinh.id]);
    await prisma.$disconnect();
    await app.close();
  });

  it('vai trò khác Quản trị → 403', async () => {
    await http().get('/van-hanh').set(auth('htgv')).expect(403);
    await http().get('/van-hanh').set(auth('hthv')).expect(403);
  });

  it('đợt đỏ: đợt 21 ngày tới có mục quá hạn + nhóm hỗ trợ GV; đợt ngoài 21 ngày không có', () => {
    const cuaK2 = body.dot_do.filter((d: any) => d.lop.khoa.id === khoa.K2);
    expect(cuaK2.map((d: any) => d.lop.id)).toEqual([lopA]);
    expect(cuaK2[0].nhom_ho_tro_gv).toEqual(['ND htgv VH']);
    expect(cuaK2[0].muc_qua_han.length).toBeGreaterThan(0);
  });

  it('đề nghị chờ > 48 giờ: chỉ đề nghị chờ quá 2 ngày', () => {
    const ids = body.de_nghi_cho_lau.map((d: any) => d.id);
    expect(ids).toContain(dn.lau);
    expect(ids).not.toContain(dn.moi);
    expect(ids).not.toContain(dn.xong);
    const d = body.de_nghi_cho_lau.find((x: any) => x.id === dn.lau);
    expect(d).toMatchObject({ den_lop: 'Lớp B VH', khoa: { id: khoa.K2 } });
  });

  it('thay đổi lịch 7 ngày: ai, vai trò, lý do, trước → sau, lớp', () => {
    const d = body.thay_doi_lich.find((x: any) => x.lop?.id === lopA);
    expect(d).toMatchObject({
      nguoi: 'ND htgv VH',
      vai_tro: 'ho_tro_giang_vien',
      ly_do: 'Điểm học mất điện VH',
      lop: { ten_lop: 'Lớp A VH', khoa: { id: khoa.K2 } },
    });
    expect(d.truoc.thoi_gian_bat_dau).toBeDefined();
    expect(d.sau.thoi_gian_bat_dau).toBeDefined();
  });

  it('khóa chưa có nhóm hỗ trợ GV: chỉ khóa chưa kết thúc, có giai đoạn trực tiếp, chưa có nhóm', () => {
    const ids = body.khoa_chua_nhom_gv.map((k: any) => k.id);
    expect(ids).toContain(khoa.K1);
    expect(ids).not.toContain(khoa.K2);
    expect(ids).not.toContain(khoa.K3);
  });

  it('cụm chưa có người hỗ trợ HV: chỉ cụm của khóa chưa kết thúc, chưa phân công', () => {
    const ids = body.cum_chua_ho_tro.map((c: any) => c.id);
    expect(ids).toContain(cum.C1);
    expect(ids).not.toContain(cum.C2);
    expect(ids).not.toContain(cum.C3);
    expect(
      body.cum_chua_ho_tro.find((c: any) => c.id === cum.C1),
    ).toMatchObject({
      so_hoc_vien: 0,
      khoa: { id: khoa.K1 },
    });
  });

  it('danh mục mới 7 ngày: chỉ điểm học / giảng viên do người hỗ trợ tạo', () => {
    const dh = body.danh_muc_moi.diem_hoc.map((d: any) => d.ten);
    expect(dh).toContain('ĐH HT VH');
    expect(dh).not.toContain('ĐH QT VH');
    const gv = body.danh_muc_moi.giang_vien.map((g: any) => g.ho_ten);
    expect(gv).toContain('GV HT VH');
    expect(gv).not.toContain('GV QT VH');
    expect(
      body.danh_muc_moi.giang_vien.find((g: any) => g.ho_ten === 'GV HT VH')
        .nguoi_tao,
    ).toBe('ND htgv VH');
  });
});
