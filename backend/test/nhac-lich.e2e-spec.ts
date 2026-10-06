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

// Ngày YYYY-MM-DD theo giờ Việt Nam.
const ngayVn = (d: Date) =>
  new Date(d.getTime() + 7 * GIO).toISOString().slice(0, 10);

// ADR 0004 L8 (issue #21): tin nhắn nhắc lịch + "Đã gửi" + cờ cần nhắc lại.
describe('Nhắc lịch — L8 (e2e)', () => {
  let app: INestApplication;
  const suf = uniqueSuffix();
  let dv: Awaited<ReturnType<typeof taoDonViTest>>;
  const nguoiDungIds: string[] = [];
  const gvIds: string[] = [];
  const hvIds: string[] = [];
  let khoaId: string;
  let gdId: string;
  let lopA: string;
  let lopB: string;
  let dhId: string;
  let cum1: string;
  let cum2: string;
  const buoi: Record<string, string> = {};
  const gv: Record<string, string> = {};
  const tk: Record<string, string> = {};
  const sdtGoc = String(Date.now()).slice(-7);
  // Buổi chính rơi vào 8h sáng (giờ VN) của ngày +5.
  const ngayD = new Date(
    Math.floor((Date.now() + 7 * GIO) / NGAY) * NGAY + 5 * NGAY + 1 * GIO,
  );

  const http = () => request(app.getHttpServer());
  const auth = (ai: string) => ({ Authorization: `Bearer ${tk[ai]}` });

  async function taoNguoi(
    ma: string,
    vaiTro: 'ho_tro_hoc_vien' | 'ho_tro_giang_vien',
  ) {
    const nd = await prisma.nguoi_dung.create({
      data: {
        ho_ten: `ND ${ma}`,
        ten_dang_nhap: `nl-${ma}-${suf}`.toLowerCase(),
        email: `nl-${ma}-${suf}@x.vn`.toLowerCase(),
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

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    dv = await taoDonViTest('nl');
    khoaId = (
      await prisma.khoa_boi_duong.create({
        data: {
          ma_khoa: `NL-${suf}`.slice(0, 30),
          ten_khoa: 'Khóa NL',
          don_vi_dat_hang_id: dv.donVi.id,
          thoi_gian_bat_dau: new Date('2026-01-01'),
          thoi_gian_ket_thuc: new Date('2027-12-31'),
          trang_thai: 'da_duyet',
        },
      })
    ).id;
    gdId = (
      await prisma.giai_doan_khoa.create({
        data: {
          khoa_id: khoaId,
          thu_tu: 1,
          ten_giai_doan: 'Trực tiếp',
          hinh_thuc: 'truc_tiep',
          thoi_gian_bat_dau: new Date('2026-01-01'),
          thoi_gian_ket_thuc: new Date('2027-12-31'),
        },
      })
    ).id;
    const taoLop = async (ten: string) =>
      (
        await prisma.lop_hoc.create({
          data: { khoa_id: khoaId, loai_lop: 'truc_tiep', ten_lop: ten },
        })
      ).id;
    lopA = await taoLop('Lớp A NL');
    lopB = await taoLop('Lớp B NL');
    dhId = (
      await prisma.diem_hoc.create({
        data: {
          ma_diem_hoc: `NL-${suf}`.slice(0, 30),
          ten: 'Điểm học NL',
          dia_chi: '1 Đường NL',
          dia_ban_id: dv.diaDanhXa.id,
        },
      })
    ).id;
    const taoBuoi = async (lop: string, so: number, bd: Date) =>
      (
        await prisma.lich_hoc_lop.create({
          data: {
            lop_id: lop,
            giai_doan_id: gdId,
            buoi_so: so,
            thoi_gian_bat_dau: bd,
            thoi_gian_ket_thuc: new Date(bd.getTime() + 3 * GIO),
            diem_hoc_id: dhId,
          },
        })
      ).id;
    buoi.a1 = await taoBuoi(lopA, 1, ngayD);
    buoi.a2 = await taoBuoi(lopA, 2, new Date(ngayD.getTime() + 5 * GIO));
    buoi.a3 = await taoBuoi(lopA, 3, new Date(ngayD.getTime() + NGAY));
    buoi.b1 = await taoBuoi(lopB, 1, new Date(ngayD.getTime() + 9 * GIO));
    buoi.ganA = await taoBuoi(lopA, 4, new Date(Date.now() + 20 * GIO));

    const taoGv = async (ma: string, i: number) => {
      const g = await prisma.giang_vien.create({
        data: {
          ho_ten: `GV ${ma} NL`,
          so_dien_thoai: `07${i}${sdtGoc}`,
          email: `gv${ma}-${suf}@x.vn`,
        },
      });
      gvIds.push(g.id);
      gv[ma] = g.id;
    };
    await taoGv('mot', 1);
    await taoGv('hai', 2);
    for (const [b, g] of [
      [buoi.a1, gv.mot],
      [buoi.a2, gv.mot],
      [buoi.a1, gv.hai],
      [buoi.b1, gv.hai],
    ]) {
      await prisma.phan_cong_giang_day.create({
        data: { lich_hoc_id: b, giang_vien_id: g, vai_tro: 'giang_vien' },
      });
    }
    await prisma.hau_can_giang_vien.create({
      data: {
        lop_id: lopA,
        giai_doan_id: gdId,
        giang_vien_id: gv.mot,
        noi_o_ten: 'KS Một',
      },
    });
    await prisma.hau_can_giang_vien.create({
      data: {
        lop_id: lopA,
        giai_doan_id: gdId,
        giang_vien_id: gv.hai,
        noi_o_ten: 'KS Hai Riêng',
      },
    });
    await prisma.nhan_su_thuc_dia.create({
      data: {
        lop_id: lopA,
        giai_doan_id: gdId,
        ho_ten: 'Thực Địa NL',
        so_dien_thoai: `069${sdtGoc}`,
      },
    });

    cum1 = (
      await prisma.cum_hoc_vien.create({
        data: { khoa_id: khoaId, ten_cum: 'Cụm Một NL' },
      })
    ).id;
    cum2 = (
      await prisma.cum_hoc_vien.create({
        data: { khoa_id: khoaId, ten_cum: 'Cụm Hai NL' },
      })
    ).id;
    const taoHv = async (ma: string, cumId: string, lop: string) => {
      const h = await prisma.hoc_vien.create({
        data: {
          nguon_tao: 'import_moet',
          ma_dinh_danh_moet: `NL${ma}${suf}`.slice(0, 20),
          ho_ten: `HV ${ma}`,
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
          khoa_id: khoaId,
          trang_thai: 'da_duyet',
          cum_id: cumId,
        },
      });
      await prisma.phan_lop_giai_doan.create({
        data: { dang_ky_hoc_id: dk.id, giai_doan_id: gdId, lop_id: lop },
      });
    };
    await taoHv('a', cum1, lopA);
    await taoHv('b', cum2, lopB);

    const htgv = await taoNguoi('htgv', 'ho_tro_giang_vien');
    await prisma.phan_cong_ho_tro_gv.create({
      data: { nguoi_dung_id: htgv.id, khoa_id: khoaId },
    });
    const hthv = await taoNguoi('hthv', 'ho_tro_hoc_vien');
    await prisma.phan_cong_ho_tro.create({
      data: { nguoi_dung_id: hthv.id, cum_id: cum1 },
    });
  });

  afterAll(async () => {
    await prisma.nhat_ky_nhac_lich.deleteMany({
      where: {
        OR: [
          { giang_vien_id: { in: gvIds } },
          { cum_id: { in: [cum1, cum2] } },
        ],
      },
    });
    await prisma.dang_ky_hoc.deleteMany({ where: { khoa_id: khoaId } });
    await prisma.hoc_vien.deleteMany({ where: { id: { in: hvIds } } });
    await prisma.lich_hoc_lop.deleteMany({
      where: { lop: { khoa_id: khoaId } },
    });
    await prisma.khoa_boi_duong.deleteMany({ where: { id: khoaId } });
    await prisma.giang_vien.deleteMany({ where: { id: { in: gvIds } } });
    await prisma.diem_hoc.deleteMany({ where: { id: dhId } });
    for (const id of nguoiDungIds) await xoaNguoiDungTest(id);
    await xoaDonViTest([dv.donVi.id], [dv.diaDanhXa.id, dv.diaDanhTinh.id]);
    await prisma.$disconnect();
    await app.close();
  });

  const trangLop = async () =>
    (
      await http()
        .get(`/ho-tro-giang-vien/lop/${lopA}/giai-doan/${gdId}`)
        .set(auth('htgv'))
        .expect(200)
    ).body as {
      buoi: { id: string; giang_vien: { id: string; nhac: string }[] }[];
    };
  const nhacGv = (
    d: Awaited<ReturnType<typeof trangLop>>,
    buoiId: string,
    gvId: string,
  ) =>
    d.buoi.find((b) => b.id === buoiId)!.giang_vien.find((g) => g.id === gvId)!
      .nhac;

  describe('Nhắc giảng viên', () => {
    it('tin nhắn chỉ có buổi + hậu cần của chính giảng viên, không dữ liệu GV khác', async () => {
      const r = await http()
        .get(
          `/ho-tro-giang-vien/lop/${lopA}/giai-doan/${gdId}/tin-nhan-nhac/${gv.mot}`,
        )
        .set(auth('htgv'))
        .expect(200);
      expect(r.body.trang_thai_nhac).toBe('chua_nhac');
      expect(r.body.lich_hoc_ids.sort()).toEqual([buoi.a1, buoi.a2].sort());
      const s: string = r.body.noi_dung;
      expect(s).toContain('GV mot NL');
      expect(s).toContain('Buổi 1');
      expect(s).toContain('Buổi 2');
      expect(s).toContain('Điểm học NL – 1 Đường NL');
      expect(s).toContain('google.com/maps');
      expect(s).toContain('Chỗ ở: KS Một');
      expect(s).toContain('Thực Địa NL');
      expect(s).not.toContain('GV hai');
      expect(s).not.toContain('KS Hai Riêng');
    });

    it('"Đã gửi" → đã nhắc; buổi không do GV dạy → 404; bảng kiểm + Việc cần làm báo GV chưa nhắc', async () => {
      await http()
        .post('/ho-tro-giang-vien/nhac-lich')
        .set(auth('htgv'))
        .send({
          giang_vien_id: gv.mot,
          lich_hoc_ids: [buoi.a1, buoi.b1],
          noi_dung: 'x',
        })
        .expect(404);
      await http()
        .post('/ho-tro-giang-vien/nhac-lich')
        .set(auth('htgv'))
        .send({
          giang_vien_id: gv.mot,
          lich_hoc_ids: [buoi.a1, buoi.a2],
          noi_dung: 'Nội dung đã gửi',
        })
        .expect(201);
      const d = await trangLop();
      expect(nhacGv(d, buoi.a1, gv.mot)).toBe('da_nhac');
      expect(nhacGv(d, buoi.a1, gv.hai)).toBe('chua_nhac');
      const bk = await http()
        .get(`/ho-tro-giang-vien/lop/${lopA}/giai-doan/${gdId}/bang-kiem`)
        .set(auth('htgv'))
        .expect(200);
      const muc = bk.body.muc.find(
        (m: { ma_quy_tac: string }) => m.ma_quy_tac === 'da_nhac_giang_vien',
      );
      expect(muc.ly_do).toBe('Chưa nhắc: GV hai NL');
      const vcl = await http()
        .get('/ho-tro-giang-vien/viec-can-lam')
        .set(auth('htgv'))
        .expect(200);
      const dot = vcl.body.find(
        (x: { lop: { id: string } }) => x.lop.id === lopA,
      );
      expect(dot.nhac_gv).toEqual([
        { id: gv.hai, ho_ten: 'GV hai NL', trang_thai: 'chua_nhac' },
      ]);
    });
  });

  describe('Nhắc cụm', () => {
    it('K23: tin nhắn cụm chỉ buổi của lớp có học viên cụm mình, đúng ngày; cụm khác → 404', async () => {
      const r = await http()
        .get(`/ho-tro-hoc-vien/cum/${cum1}/tin-nhan-nhac`)
        .query({ ngay: ngayVn(ngayD) })
        .set(auth('hthv'))
        .expect(200);
      expect(r.body.lich_hoc_ids.sort()).toEqual([buoi.a1, buoi.a2].sort());
      expect(r.body.noi_dung).toContain('Cụm Một NL');
      expect(r.body.noi_dung).toContain('Lớp A NL – Buổi 1');
      expect(r.body.noi_dung).not.toContain('Lớp B NL');
      expect(r.body.noi_dung).not.toContain('Buổi 3');
      expect(r.body.trang_thai_nhac).toBe('chua_nhac');
      await http()
        .get(`/ho-tro-hoc-vien/cum/${cum2}/tin-nhan-nhac`)
        .query({ ngay: ngayVn(ngayD) })
        .set(auth('hthv'))
        .expect(404);
      await http()
        .post('/ho-tro-hoc-vien/nhac-lich')
        .set(auth('hthv'))
        .send({ cum_id: cum1, lich_hoc_ids: [buoi.b1], noi_dung: 'x' })
        .expect(400);
    });

    it('số đếm menu = buổi 2 ngày tới chưa nhắc; "Đã gửi" → giảm', async () => {
      const dem = async () =>
        (
          await http()
            .get('/ho-tro-hoc-vien/nhac-lich/dem')
            .set(auth('hthv'))
            .expect(200)
        ).body.can_nhac;
      expect(await dem()).toBe(1);
      await http()
        .post('/ho-tro-hoc-vien/nhac-lich')
        .set(auth('hthv'))
        .send({ cum_id: cum1, lich_hoc_ids: [buoi.ganA], noi_dung: 'Nhắc gần' })
        .expect(201);
      expect(await dem()).toBe(0);
    });

    it('"Đã gửi" cụm → Lịch học hiện đã nhắc cho cụm', async () => {
      await http()
        .post('/ho-tro-hoc-vien/nhac-lich')
        .set(auth('hthv'))
        .send({
          cum_id: cum1,
          lich_hoc_ids: [buoi.a1, buoi.a2],
          noi_dung: 'Nhắc ngày D',
        })
        .expect(201);
      const lh = await http()
        .get('/ho-tro-hoc-vien/lich-hoc')
        .query({ tu_ngay: ngayVn(ngayD), den_ngay: ngayVn(ngayD) })
        .set(auth('hthv'))
        .expect(200);
      const a1 = lh.body.find((b: { id: string }) => b.id === buoi.a1);
      expect(a1.nhac_cum).toEqual([{ cum_id: cum1, trang_thai: 'da_nhac' }]);
    });
  });

  it('K22: đã gửi rồi sửa giờ buổi → "Cần nhắc lại" ở cả hỗ trợ GV và hỗ trợ HV', async () => {
    const bd = new Date(ngayD.getTime() + 30 * 60 * 1000);
    await http()
      .patch(`/ho-tro-giang-vien/lich-hoc/${buoi.a1}`)
      .set(auth('htgv'))
      .send({
        thoi_gian_bat_dau: bd.toISOString(),
        thoi_gian_ket_thuc: new Date(bd.getTime() + 3 * GIO).toISOString(),
        ly_do: 'Đổi giờ theo điểm học',
      })
      .expect(200);
    const d = await trangLop();
    expect(nhacGv(d, buoi.a1, gv.mot)).toBe('can_nhac_lai');
    expect(nhacGv(d, buoi.a2, gv.mot)).toBe('da_nhac');
    const tn = await http()
      .get(
        `/ho-tro-giang-vien/lop/${lopA}/giai-doan/${gdId}/tin-nhan-nhac/${gv.mot}`,
      )
      .set(auth('htgv'))
      .expect(200);
    expect(tn.body.trang_thai_nhac).toBe('can_nhac_lai');
    const lh = await http()
      .get('/ho-tro-hoc-vien/lich-hoc')
      .query({ tu_ngay: ngayVn(ngayD), den_ngay: ngayVn(ngayD) })
      .set(auth('hthv'))
      .expect(200);
    const a1 = lh.body.find((b: { id: string }) => b.id === buoi.a1);
    expect(a1.nhac_cum).toEqual([{ cum_id: cum1, trang_thai: 'can_nhac_lai' }]);
  });
});
