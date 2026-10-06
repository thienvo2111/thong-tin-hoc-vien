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

// ADR 0004 L5 (issue #18): báo vắng + đề nghị đổi lớp giữa người hỗ trợ học
// viên (cụm) và nhóm hỗ trợ giảng viên (khóa). K18–K21.
describe('Báo vắng + đề nghị đổi lớp — L5 (e2e)', () => {
  let app: INestApplication;
  const suf = uniqueSuffix();
  let dv: Awaited<ReturnType<typeof taoDonViTest>>;
  const nguoiDungIds: string[] = [];
  let khoaId: string;
  let gdId: string;
  let lopA: string;
  let lopB: string;
  let lopKhongBuoi: string;
  const buoi: Record<string, string> = {};
  const hv: Record<string, { id: string; dk: string }> = {};
  const tk: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const auth = (ai: string) => ({ Authorization: `Bearer ${tk[ai]}` });
  const tg = (offsetMs: number) => new Date(Date.now() + offsetMs);

  async function taoNguoi(
    ma: string,
    vaiTro: 'ho_tro_hoc_vien' | 'ho_tro_giang_vien',
  ) {
    const nd = await prisma.nguoi_dung.create({
      data: {
        ho_ten: `ND ${ma}`,
        ten_dang_nhap: `bvdl-${ma}-${suf}`.toLowerCase(),
        email: `bvdl-${ma}-${suf}@x.vn`.toLowerCase(),
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
    dv = await taoDonViTest('bvdl');
    khoaId = (
      await prisma.khoa_boi_duong.create({
        data: {
          ma_khoa: `BVDL-${suf}`.slice(0, 30),
          ten_khoa: 'Khóa BVDL',
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
    const taoLop = async (ten: string, siSo?: number) =>
      (
        await prisma.lop_hoc.create({
          data: {
            khoa_id: khoaId,
            loai_lop: 'truc_tiep',
            ten_lop: ten,
            si_so_toi_da: siSo,
          },
        })
      ).id;
    lopA = await taoLop('Lớp A');
    lopB = await taoLop('Lớp B', 1);
    lopKhongBuoi = await taoLop('Lớp không buổi');
    const taoBuoi = async (lop: string, so: number, bd: Date) =>
      (
        await prisma.lich_hoc_lop.create({
          data: {
            lop_id: lop,
            giai_doan_id: gdId,
            buoi_so: so,
            thoi_gian_bat_dau: bd,
            thoi_gian_ket_thuc: new Date(bd.getTime() + 3 * GIO),
          },
        })
      ).id;
    buoi.tuongLai = await taoBuoi(lopA, 1, tg(5 * NGAY));
    buoi.daXong = await taoBuoi(lopA, 2, tg(-2 * NGAY));
    buoi.lopB = await taoBuoi(lopB, 1, tg(5 * NGAY));

    const cum1 = await prisma.cum_hoc_vien.create({
      data: { khoa_id: khoaId, ten_cum: 'Cụm 1' },
    });
    const cum2 = await prisma.cum_hoc_vien.create({
      data: { khoa_id: khoaId, ten_cum: 'Cụm 2' },
    });
    const taoHv = async (ma: string, cumId: string, lop: string) => {
      const h = await prisma.hoc_vien.create({
        data: {
          nguon_tao: 'import_moet',
          ma_dinh_danh_moet: `BV${ma}${suf}`.slice(0, 20),
          ho_ten: `HV ${ma}`,
          ngay_sinh: 1,
          thang_sinh: 1,
          nam_sinh: 1990,
          don_vi_cong_tac_id: dv.donVi.id,
          trang_thai: 'nhap',
        },
      });
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
      hv[ma] = { id: h.id, dk: dk.id };
    };
    await taoHv('a1', cum1.id, lopA);
    await taoHv('a2', cum1.id, lopA);
    await taoHv('a3', cum1.id, lopA);
    await taoHv('b1', cum1.id, lopB);
    await taoHv('x1', cum2.id, lopA);

    const htHv = await taoNguoi('hthv', 'ho_tro_hoc_vien');
    const htHv2 = await taoNguoi('hthv2', 'ho_tro_hoc_vien');
    await prisma.phan_cong_ho_tro.create({
      data: { nguoi_dung_id: htHv.id, cum_id: cum1.id },
    });
    await prisma.phan_cong_ho_tro.create({
      data: { nguoi_dung_id: htHv2.id, cum_id: cum1.id },
    });
    for (const ma of ['htgv1', 'htgv2']) {
      const nd = await taoNguoi(ma, 'ho_tro_giang_vien');
      await prisma.phan_cong_ho_tro_gv.create({
        data: { nguoi_dung_id: nd.id, khoa_id: khoaId },
      });
    }
    await taoNguoi('htgvKhac', 'ho_tro_giang_vien');
  });

  afterAll(async () => {
    await prisma.dang_ky_hoc.deleteMany({ where: { khoa_id: khoaId } });
    await prisma.hoc_vien.deleteMany({
      where: { id: { in: Object.values(hv).map((h) => h.id) } },
    });
    await prisma.lich_hoc_lop.deleteMany({
      where: { lop: { khoa_id: khoaId } },
    });
    await prisma.khoa_boi_duong.deleteMany({ where: { id: khoaId } });
    for (const id of nguoiDungIds) await xoaNguoiDungTest(id);
    await xoaDonViTest([dv.donVi.id], [dv.diaDanhXa.id, dv.diaDanhTinh.id]);
    await prisma.$disconnect();
    await app.close();
  });

  describe('Báo vắng (G13)', () => {
    it('ghi báo vắng buổi chưa diễn ra → hiện ở trang lớp của hỗ trợ GV; ghi lại = cập nhật lý do', async () => {
      await http()
        .post(`/ho-tro-hoc-vien/hoc-vien/${hv.a1.id}/bao-vang`)
        .set(auth('hthv'))
        .send({ lich_hoc_id: buoi.tuongLai, ly_do: 'Ốm' })
        .expect(201);
      await http()
        .post(`/ho-tro-hoc-vien/hoc-vien/${hv.a1.id}/bao-vang`)
        .set(auth('hthv'))
        .send({ lich_hoc_id: buoi.tuongLai, ly_do: 'Đi công tác' })
        .expect(201);
      const trang = await http()
        .get(`/ho-tro-giang-vien/lop/${lopA}/giai-doan/${gdId}`)
        .set(auth('htgv1'))
        .expect(200);
      const a1 = trang.body.hoc_vien.find(
        (h: { hoc_vien_id: string }) => h.hoc_vien_id === hv.a1.id,
      );
      expect(a1.bao_vang).toEqual({ [buoi.tuongLai]: 'Đi công tác' });
      const ct = await http()
        .get(`/ho-tro-hoc-vien/hoc-vien/${hv.a1.id}`)
        .set(auth('hthv'))
        .expect(200);
      expect(ct.body.bao_vang).toHaveLength(1);
    });

    it('buổi đã kết thúc → 400; thiếu lý do → 400; buổi không thuộc lớp của học viên → 404', async () => {
      await http()
        .post(`/ho-tro-hoc-vien/hoc-vien/${hv.a1.id}/bao-vang`)
        .set(auth('hthv'))
        .send({ lich_hoc_id: buoi.daXong, ly_do: 'Ốm' })
        .expect(400);
      await http()
        .post(`/ho-tro-hoc-vien/hoc-vien/${hv.a1.id}/bao-vang`)
        .set(auth('hthv'))
        .send({ lich_hoc_id: buoi.tuongLai })
        .expect(400);
      await http()
        .post(`/ho-tro-hoc-vien/hoc-vien/${hv.a1.id}/bao-vang`)
        .set(auth('hthv'))
        .send({ lich_hoc_id: buoi.lopB, ly_do: 'Ốm' })
        .expect(404);
    });

    it('hủy báo vắng → 204, hủy lần 2 → 404', async () => {
      await http()
        .delete(
          `/ho-tro-hoc-vien/hoc-vien/${hv.a1.id}/bao-vang/${buoi.tuongLai}`,
        )
        .set(auth('hthv'))
        .expect(204);
      await http()
        .delete(
          `/ho-tro-hoc-vien/hoc-vien/${hv.a1.id}/bao-vang/${buoi.tuongLai}`,
        )
        .set(auth('hthv'))
        .expect(404);
    });
  });

  it('K18: hỗ trợ HV báo vắng / đề nghị đổi lớp cho học viên cụm khác → 404', async () => {
    await http()
      .post(`/ho-tro-hoc-vien/hoc-vien/${hv.x1.id}/bao-vang`)
      .set(auth('hthv'))
      .send({ lich_hoc_id: buoi.tuongLai, ly_do: 'Ốm' })
      .expect(404);
    await http()
      .post(`/ho-tro-hoc-vien/hoc-vien/${hv.x1.id}/de-nghi-doi-lop`)
      .set(auth('hthv'))
      .send({ giai_doan_id: gdId, lop_de_nghi_id: lopB, ly_do: 'Gần nhà hơn' })
      .expect(404);
    await http()
      .get(
        `/ho-tro-hoc-vien/hoc-vien/${hv.x1.id}/lop-co-the-doi?giai_doan_id=${gdId}`,
      )
      .set(auth('hthv'))
      .expect(404);
  });

  describe('Đề nghị đổi lớp (G14)', () => {
    it('lớp có thể đổi: chỉ lớp có buổi ở giai đoạn, kèm sĩ số; lớp không có buổi / đang ở → 400', async () => {
      const res = await http()
        .get(
          `/ho-tro-hoc-vien/hoc-vien/${hv.a2.id}/lop-co-the-doi?giai_doan_id=${gdId}`,
        )
        .set(auth('hthv'))
        .expect(200);
      expect(res.body.lop_hien_tai_id).toBe(lopA);
      expect(res.body.lop.map((l: { id: string }) => l.id).sort()).toEqual(
        [lopA, lopB].sort(),
      );
      expect(
        res.body.lop.find((l: { id: string }) => l.id === lopB).si_so,
      ).toBe(1);
      await http()
        .post(`/ho-tro-hoc-vien/hoc-vien/${hv.a2.id}/de-nghi-doi-lop`)
        .set(auth('hthv'))
        .send({
          giai_doan_id: gdId,
          lop_de_nghi_id: lopKhongBuoi,
          ly_do: 'Gần nhà hơn',
        })
        .expect(400);
      await http()
        .post(`/ho-tro-hoc-vien/hoc-vien/${hv.a2.id}/de-nghi-doi-lop`)
        .set(auth('hthv'))
        .send({
          giai_doan_id: gdId,
          lop_de_nghi_id: lopA,
          ly_do: 'Gần nhà hơn',
        })
        .expect(400);
    });

    it('K21: đề nghị thứ 2 cùng (học viên, giai đoạn) khi đề nghị 1 đang chờ → 409', async () => {
      await http()
        .post(`/ho-tro-hoc-vien/hoc-vien/${hv.a2.id}/de-nghi-doi-lop`)
        .set(auth('hthv'))
        .send({
          giai_doan_id: gdId,
          lop_de_nghi_id: lopB,
          ly_do: 'Gần nhà hơn',
        })
        .expect(201);
      await http()
        .post(`/ho-tro-hoc-vien/hoc-vien/${hv.a2.id}/de-nghi-doi-lop`)
        .set(auth('hthv2'))
        .send({ giai_doan_id: gdId, lop_de_nghi_id: lopB, ly_do: 'Lý do khác' })
        .expect(409);
    });

    it('hỗ trợ GV thấy đề nghị chờ + số đếm; nhóm khóa khác không thấy; bảng kiểm khong_de_nghi_cho chưa đạt', async () => {
      const ds = await http()
        .get('/ho-tro-giang-vien/de-nghi-doi-lop?trang_thai=cho_duyet')
        .set(auth('htgv1'))
        .expect(200);
      expect(ds.body).toHaveLength(1);
      expect(ds.body[0]).toMatchObject({
        hoc_vien: { ho_ten: 'HV a2', cum: 'Cụm 1' },
        lop_hien_tai: { id: lopA },
        lop_de_nghi: { id: lopB },
        si_so_lop_de_nghi: 1,
      });
      const dem = await http()
        .get('/ho-tro-giang-vien/viec-can-lam/dem')
        .set(auth('htgv1'))
        .expect(200);
      expect(dem.body.de_nghi).toBe(1);
      const khac = await http()
        .get('/ho-tro-giang-vien/de-nghi-doi-lop')
        .set(auth('htgvKhac'))
        .expect(200);
      expect(khac.body).toHaveLength(0);
      await http()
        .post(`/ho-tro-giang-vien/de-nghi-doi-lop/${ds.body[0].id}/duyet`)
        .set(auth('htgvKhac'))
        .send({})
        .expect(404);
      const bk = await http()
        .get(`/ho-tro-giang-vien/lop/${lopB}/giai-doan/${gdId}/bang-kiem`)
        .set(auth('htgv1'))
        .expect(200);
      const muc = bk.body.muc.find(
        (m: { ma_quy_tac: string }) => m.ma_quy_tac === 'khong_de_nghi_cho',
      );
      expect(muc.trang_thai).not.toBe('dat');
    });

    it('K19: 2 người cùng duyệt 1 đề nghị (song song thật) → đúng 1 thành công, 1 nhận 409; vượt sĩ số → cảnh báo', async () => {
      const dn = await prisma.de_nghi_doi_lop.findFirstOrThrow({
        where: { dang_ky_hoc_id: hv.a2.dk, trang_thai: 'cho_duyet' },
      });
      const [r1, r2] = await Promise.all([
        http()
          .post(`/ho-tro-giang-vien/de-nghi-doi-lop/${dn.id}/duyet`)
          .set(auth('htgv1'))
          .send({}),
        http()
          .post(`/ho-tro-giang-vien/de-nghi-doi-lop/${dn.id}/duyet`)
          .set(auth('htgv2'))
          .send({}),
      ]);
      expect([r1.status, r2.status].sort()).toEqual([200, 409]);
      const ok = r1.status === 200 ? r1 : r2;
      expect(ok.body.canh_bao[0]).toMatch(/vượt sĩ số tối đa 1/);
      const pl = await prisma.phan_lop_giai_doan.findUniqueOrThrow({
        where: {
          dang_ky_hoc_id_giai_doan_id: {
            dang_ky_hoc_id: hv.a2.dk,
            giai_doan_id: gdId,
          },
        },
      });
      expect(pl.lop_id).toBe(lopB);
      const nk = await prisma.nhat_ky_hoat_dong.count({
        where: { hanh_dong: 'duyet_doi_lop', hoc_vien_id: hv.a2.id },
      });
      expect(nk).toBe(1);
    });

    it('K20: duyệt khi phân lớp hiện tại đã đổi → 409, đề nghị vẫn chờ; từ chối được', async () => {
      await http()
        .post(`/ho-tro-hoc-vien/hoc-vien/${hv.a3.id}/de-nghi-doi-lop`)
        .set(auth('hthv'))
        .send({
          giai_doan_id: gdId,
          lop_de_nghi_id: lopB,
          ly_do: 'Gần nhà hơn',
        })
        .expect(201);
      // Quản trị phân lớp lại bằng import trong lúc đề nghị đang chờ.
      await prisma.phan_lop_giai_doan.update({
        where: {
          dang_ky_hoc_id_giai_doan_id: {
            dang_ky_hoc_id: hv.a3.dk,
            giai_doan_id: gdId,
          },
        },
        data: { lop_id: lopKhongBuoi },
      });
      const dn = await prisma.de_nghi_doi_lop.findFirstOrThrow({
        where: { dang_ky_hoc_id: hv.a3.dk, trang_thai: 'cho_duyet' },
      });
      await http()
        .post(`/ho-tro-giang-vien/de-nghi-doi-lop/${dn.id}/duyet`)
        .set(auth('htgv1'))
        .send({})
        .expect(409);
      expect(
        (
          await prisma.de_nghi_doi_lop.findUniqueOrThrow({
            where: { id: dn.id },
          })
        ).trang_thai,
      ).toBe('cho_duyet');
      await http()
        .post(`/ho-tro-giang-vien/de-nghi-doi-lop/${dn.id}/tu-choi`)
        .set(auth('htgv1'))
        .send({})
        .expect(400);
      await http()
        .post(`/ho-tro-giang-vien/de-nghi-doi-lop/${dn.id}/tu-choi`)
        .set(auth('htgv1'))
        .send({ ghi_chu: 'Đã phân lớp lại' })
        .expect(200);
      await http()
        .post(`/ho-tro-giang-vien/de-nghi-doi-lop/${dn.id}/duyet`)
        .set(auth('htgv1'))
        .send({})
        .expect(409);
    });

    it('hủy đề nghị: chỉ người tạo (403), đề nghị đã xử lý → 409', async () => {
      const tao = await http()
        .post(`/ho-tro-hoc-vien/hoc-vien/${hv.b1.id}/de-nghi-doi-lop`)
        .set(auth('hthv'))
        .send({
          giai_doan_id: gdId,
          lop_de_nghi_id: lopA,
          ly_do: 'Gần nhà hơn',
        })
        .expect(201);
      await http()
        .post(`/ho-tro-hoc-vien/de-nghi-doi-lop/${tao.body.id}/huy`)
        .set(auth('hthv2'))
        .expect(403);
      await http()
        .post(`/ho-tro-hoc-vien/de-nghi-doi-lop/${tao.body.id}/huy`)
        .set(auth('hthv'))
        .expect(204);
      await http()
        .post(`/ho-tro-hoc-vien/de-nghi-doi-lop/${tao.body.id}/huy`)
        .set(auth('hthv'))
        .expect(409);
      const ct = await http()
        .get(`/ho-tro-hoc-vien/hoc-vien/${hv.b1.id}`)
        .set(auth('hthv'))
        .expect(200);
      expect(ct.body.de_nghi_doi_lop[0]).toMatchObject({
        trang_thai: 'da_huy',
        lop_de_nghi: { id: lopA },
      });
    });
  });
});
