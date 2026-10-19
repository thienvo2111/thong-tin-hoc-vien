import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoNguoiDungTest,
  uniqueSuffix,
  xoaNguoiDungTest,
} from './utils/test-data';

// ADR 0011 P1–P3: yêu cầu hỗ trợ tới người hỗ trợ theo cụm ∪ lớp.
// - Người hỗ trợ "lop" giữ lớp Zoom X; "cum" giữ cụm A.
// - p: phân lớp X, chưa có cụm.  d: phân lớp Y, đổi buổi y1 → x1 đã duyệt.
// - u: phân lớp Y, cụm B (ngoài phạm vi của cả hai).  c: cụm A + phân lớp X.
describe('Yêu cầu hỗ trợ theo lớp (e2e, ADR 0011)', () => {
  let app: INestApplication;
  const suf = uniqueSuffix();
  const SUF = suf.toUpperCase();
  const MIEN = `${suf}@ychtl.vn`;
  const diaDanhIds: string[] = [];
  const nguoiDungIds: string[] = [];
  const hocVienIds: string[] = [];
  let donViId: string;
  let khoaId: string;
  let tokenQuanTri: string;
  const lop = { x: '', y: '' };
  const ht: Record<'lop' | 'cum', { id: string; token: string }> = {
    lop: { id: '', token: '' },
    cum: { id: '', token: '' },
  };
  type Hv = 'p' | 'd' | 'u' | 'c';
  const hv: Record<Hv, { id: string; token: string }> = {
    p: { id: '', token: '' },
    d: { id: '', token: '' },
    u: { id: '', token: '' },
    c: { id: '', token: '' },
  };

  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const dangNhap = async (ten: string, mk: string) =>
    (
      await http()
        .post('/auth/dang-nhap')
        .send({ ten_dang_nhap: ten, mat_khau: mk })
    ).body.token as string;
  const GOC = '/ho-tro-hoc-vien/yeu-cau-ho-tro';
  const dsHoTro = async (token: string, qs = '') => {
    const res = await http().get(`${GOC}${qs}`).set(auth(token));
    expect(res.status).toBe(200);
    return res.body.data as {
      id: string;
      ten_cum: string[];
      lop_ho_tro: { id: string; ten_lop: string }[];
    }[];
  };
  const ids = (ds: { id: string }[]) => ds.map((x) => x.id);
  const traLoiHoTro = (id: string, token: string, noiDung: string) =>
    http()
      .patch(`${GOC}/${id}/tra-loi`)
      .set(auth(token))
      .send({ noi_dung_tra_loi: noiDung });
  const kyTen = async (nhan: Hv, ticketId: string) => {
    const res = await http()
      .get('/yeu-cau-ho-tro/toi')
      .set(auth(hv[nhan].token));
    return (
      res.body as { id: string; nguoi_tra_loi_hien_thi: string | null }[]
    ).find((x) => x.id === ticketId)?.nguoi_tra_loi_hien_thi;
  };
  async function taoTicket(nhan: Hv, noiDung: string): Promise<string> {
    const res = await http()
      .post('/yeu-cau-ho-tro/toi')
      .set(auth(hv[nhan].token))
      .send({ tinh_huong: 'Khác', noi_dung_hoi: noiDung });
    expect(res.status).toBe(201);
    return res.body.id;
  }

  async function taoHoTro(nhan: 'lop' | 'cum') {
    const nd = await prisma.nguoi_dung.create({
      data: {
        ho_ten: `Cán bộ ${nhan}`,
        ten_dang_nhap: `ychtl-${nhan}-${suf}`,
        email: `${nhan}-${MIEN}`,
        vai_tro: 'ho_tro_hoc_vien',
        mat_khau_hash: await bcrypt.hash('HoTro12345', 4),
        phai_doi_mat_khau: false,
      },
    });
    nguoiDungIds.push(nd.id);
    ht[nhan] = {
      id: nd.id,
      token: await dangNhap(nd.ten_dang_nhap, 'HoTro12345'),
    };
  }

  async function taoHocVien(nhan: Hv) {
    const h = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: `YCL-${nhan}-${SUF}`,
        ho_ten: `Học viên ${nhan.toUpperCase()}`,
        ngay_sinh: 1,
        thang_sinh: 1,
        nam_sinh: 1990,
        don_vi_cong_tac_id: donViId,
        email_lien_he: `hv-${nhan}-${MIEN}`,
      },
    });
    hocVienIds.push(h.id);
    const nd = await prisma.nguoi_dung.create({
      data: {
        ho_ten: h.ho_ten,
        ten_dang_nhap: `YCL-${nhan}-${SUF}`,
        vai_tro: 'hoc_vien',
        hoc_vien_id: h.id,
        mat_khau_hash: await bcrypt.hash('HocVien12345', 4),
        phai_doi_mat_khau: false,
      },
    });
    nguoiDungIds.push(nd.id);
    hv[nhan] = {
      id: h.id,
      token: await dangNhap(nd.ten_dang_nhap, 'HocVien12345'),
    };
  }

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    const tinh = await prisma.dia_danh.create({
      data: { ma: `T-ychtl-${suf}`, ten: `Tỉnh ${suf}`, cap: 'tinh_thanh' },
    });
    const xa = await prisma.dia_danh.create({
      data: {
        ma: `X-ychtl-${suf}`,
        ten: `Xã ${suf}`,
        cap: 'phuong_xa_dac_khu',
        parent_id: tinh.id,
      },
    });
    diaDanhIds.push(xa.id, tinh.id);
    donViId = (
      await prisma.don_vi_cong_tac.create({
        data: {
          ma_don_vi: `DV-ychtl-${suf}`,
          ten_don_vi: `Trường ${suf}`,
          loai_don_vi: 'truong',
          dia_ban_id: xa.id,
        },
      })
    ).id;
    const qt = await taoNguoiDungTest({
      vai_tro: 'quan_tri',
      don_vi_id: donViId,
      mat_khau: 'QuanTri12345',
    });
    nguoiDungIds.push(qt.nguoiDung.id);
    tokenQuanTri = await dangNhap(qt.ten_dang_nhap, 'QuanTri12345');
    await taoHoTro('lop');
    await taoHoTro('cum');
    for (const n of ['p', 'd', 'u', 'c'] as const) await taoHocVien(n);

    khoaId = (
      await prisma.khoa_boi_duong.create({
        data: {
          ma_khoa: `K-YCHTL-${SUF}`,
          ten_khoa: `Khóa ${suf}`,
          don_vi_dat_hang_id: donViId,
          thoi_gian_bat_dau: new Date('2026-10-01'),
          thoi_gian_ket_thuc: new Date('2027-02-01'),
          trang_thai: 'da_duyet',
        },
      })
    ).id;
    const g1 = await prisma.giai_doan_khoa.create({
      data: {
        khoa_id: khoaId,
        thu_tu: 1,
        ten_giai_doan: 'Giai đoạn 1',
        hinh_thuc: 'truc_tuyen',
        thoi_gian_bat_dau: new Date('2026-10-01'),
        thoi_gian_ket_thuc: new Date('2027-02-01'),
      },
    });
    const taoLop = async (ten: string) =>
      (
        await prisma.lop_hoc.create({
          data: { khoa_id: khoaId, loai_lop: 'zoom', ten_lop: ten },
        })
      ).id;
    lop.x = await taoLop('Zoom X');
    lop.y = await taoLop('Zoom Y');
    const taoBuoi = async (lopId: string) =>
      (
        await prisma.lich_hoc_lop.create({
          data: {
            lop_id: lopId,
            giai_doan_id: g1.id,
            buoi_so: 1,
            thoi_gian_bat_dau: new Date('2026-11-10T12:00:00Z'),
            thoi_gian_ket_thuc: new Date('2026-11-10T14:00:00Z'),
          },
        })
      ).id;
    const x1 = await taoBuoi(lop.x);
    const y1 = await taoBuoi(lop.y);
    const cumA = await prisma.cum_hoc_vien.create({
      data: { khoa_id: khoaId, ten_cum: 'Cụm hỗ trợ A' },
    });
    const cumB = await prisma.cum_hoc_vien.create({
      data: { khoa_id: khoaId, ten_cum: 'Cụm hỗ trợ B' },
    });
    const cap: [Hv, string | null, string][] = [
      ['p', null, lop.x],
      ['d', null, lop.y],
      ['u', cumB.id, lop.y],
      ['c', cumA.id, lop.x],
    ];
    const dk: Partial<Record<Hv, string>> = {};
    for (const [n, cumId, lopId] of cap) {
      const d = await prisma.dang_ky_hoc.create({
        data: { hoc_vien_id: hv[n].id, khoa_id: khoaId, cum_id: cumId },
      });
      dk[n] = d.id;
      await prisma.phan_lop_giai_doan.create({
        data: { dang_ky_hoc_id: d.id, giai_doan_id: g1.id, lop_id: lopId },
      });
    }
    await prisma.doi_buoi_hoc.create({
      data: {
        dang_ky_hoc_id: dk.d!,
        lich_nguon_id: y1,
        lich_de_nghi_id: x1,
        lich_chot_id: x1,
        ly_do: 'Trùng lịch',
        trang_thai: 'da_duyet',
      },
    });
    await prisma.phan_cong_ho_tro_lop.create({
      data: { nguoi_dung_id: ht.lop.id, lop_id: lop.x },
    });
    await prisma.phan_cong_ho_tro.create({
      data: { nguoi_dung_id: ht.cum.id, cum_id: cumA.id },
    });
  });

  afterAll(async () => {
    await prisma.yeu_cau_ho_tro.deleteMany({
      where: { hoc_vien_id: { in: hocVienIds } },
    });
    await prisma.hang_doi_email.deleteMany({
      where: { email_nguoi_nhan: { endsWith: MIEN } },
    });
    await prisma.nhat_ky_thong_bao.deleteMany({
      where: { hoc_vien_id: { in: hocVienIds } },
    });
    const dkIds = (
      await prisma.dang_ky_hoc.findMany({
        where: { khoa_id: khoaId },
        select: { id: true },
      })
    ).map((d) => d.id);
    await prisma.doi_buoi_hoc.deleteMany({
      where: { dang_ky_hoc_id: { in: dkIds } },
    });
    await prisma.phan_lop_giai_doan.deleteMany({
      where: { dang_ky_hoc_id: { in: dkIds } },
    });
    await prisma.dang_ky_hoc.deleteMany({ where: { id: { in: dkIds } } });
    await prisma.khoa_boi_duong.deleteMany({ where: { id: khoaId } });
    for (const id of nguoiDungIds) await xoaNguoiDungTest(id);
    await prisma.hoc_vien.deleteMany({ where: { id: { in: hocVienIds } } });
    await prisma.don_vi_cong_tac.deleteMany({ where: { id: donViId } });
    await prisma.dia_danh.deleteMany({ where: { id: { in: diaDanhIds } } });
    await prisma.$disconnect();
    await app.close();
  });

  const t: Record<Hv, string> = { p: '', d: '', u: '', c: '' };

  describe('hàng chờ, lọc, số đếm', () => {
    beforeAll(async () => {
      for (const n of ['p', 'd', 'u', 'c'] as const)
        t[n] = await taoTicket(n, `Câu hỏi của ${n}`);
    });

    it('người hỗ trợ lớp thấy ticket học viên của lớp (kể cả chưa có cụm, đổi buổi vào); không thấy ticket ngoài phạm vi', async () => {
      const ds = await dsHoTro(ht.lop.token, '?trang_thai=cho_xu_ly');
      expect(ids(ds).sort()).toEqual([t.p, t.d, t.c].sort());
      const lopX = [{ id: lop.x, ten_lop: 'Zoom X' }];
      expect(ds.find((x) => x.id === t.p)).toMatchObject({
        ten_cum: [],
        lop_ho_tro: lopX,
      });
      expect(ds.find((x) => x.id === t.d)!.lop_ho_tro).toEqual(lopX);
      expect(ds.find((x) => x.id === t.c)).toMatchObject({
        ten_cum: ['Cụm hỗ trợ A'],
        lop_ho_tro: lopX,
      });
    });

    it('người hỗ trợ cụm chỉ thấy ticket trong cụm (lop_ho_tro rỗng)', async () => {
      const ds = await dsHoTro(ht.cum.token);
      expect(ids(ds)).toEqual([t.c]);
      expect(ds[0].lop_ho_tro).toEqual([]);
    });

    it('ticket ngoài phạm vi: chi tiết 404, trả lời 404', async () => {
      const ct = await http().get(`${GOC}/${t.u}`).set(auth(ht.lop.token));
      expect(ct.status).toBe(404);
      expect((await traLoiHoTro(t.u, ht.lop.token, 'x')).status).toBe(404);
    });

    it('chi tiết ticket của học viên đổi buổi vào -> 200 kèm lop_ho_tro', async () => {
      const ct = await http().get(`${GOC}/${t.d}`).set(auth(ht.lop.token));
      expect(ct.status).toBe(200);
      expect(ct.body.lop_ho_tro).toEqual([{ id: lop.x, ten_lop: 'Zoom X' }]);
      expect(ct.body.ticket_truoc).toEqual([]);
    });

    it('lọc lop_id: lớp của tôi -> học viên phân lớp + đổi buổi vào; lớp khác -> 404', async () => {
      expect(
        ids(await dsHoTro(ht.lop.token, `?lop_id=${lop.x}`)).sort(),
      ).toEqual([t.p, t.d, t.c].sort());
      const la = await http()
        .get(`${GOC}?lop_id=${lop.y}`)
        .set(auth(ht.lop.token));
      expect(la.status).toBe(404);
      expect(la.body.error.message).toBe('Không tìm thấy lớp');
      // Người hỗ trợ cụm không được gắn lớp X.
      expect(
        (await http().get(`${GOC}?lop_id=${lop.x}`).set(auth(ht.cum.token)))
          .status,
      ).toBe(404);
    });

    it('lọc cum_id ngoài cụm của tôi -> 404', async () => {
      const cumA = await prisma.cum_hoc_vien.findFirstOrThrow({
        where: { khoa_id: khoaId, ten_cum: 'Cụm hỗ trợ A' },
      });
      expect(
        (await http().get(`${GOC}?cum_id=${cumA.id}`).set(auth(ht.lop.token)))
          .status,
      ).toBe(404);
    });

    it('số đếm menu gồm ticket theo lớp', async () => {
      const res = await http().get(`${GOC}/dem`).set(auth(ht.lop.token));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ cho_xu_ly: 3 });
    });
  });

  describe('trả lời + ký tên phía học viên', () => {
    it('người hỗ trợ lớp trả lời học viên phân lớp -> học viên thấy "Hỗ trợ lớp Zoom X"', async () => {
      const res = await traLoiHoTro(t.p, ht.lop.token, 'Link ở mục Lớp học');
      expect(res.status).toBe(200);
      expect(res.body.trang_thai).toBe('da_phan_hoi');
      expect(await kyTen('p', t.p)).toBe('Hỗ trợ lớp Zoom X');
    });

    it('trả lời học viên đổi buổi vào -> "Hỗ trợ lớp Zoom X"', async () => {
      expect((await traLoiHoTro(t.d, ht.lop.token, 'Đã ghi nhận')).status).toBe(
        200,
      );
      expect(await kyTen('d', t.d)).toBe('Hỗ trợ lớp Zoom X');
    });

    it('cụm và lớp cùng thấy 1 ticket: người hỗ trợ cụm trả lời trước thắng, người hỗ trợ lớp -> 409; ký tên cụm', async () => {
      expect(
        (await traLoiHoTro(t.c, ht.cum.token, 'Trả lời của cụm')).status,
      ).toBe(200);
      const sau = await traLoiHoTro(t.c, ht.lop.token, 'Trả lời của lớp');
      expect(sau.status).toBe(409);
      const db = await prisma.yeu_cau_ho_tro.findUnique({ where: { id: t.c } });
      expect(db).toMatchObject({
        noi_dung_tra_loi: 'Trả lời của cụm',
        tra_loi_boi: ht.cum.id,
      });
      expect(await kyTen('c', t.c)).toBe('Cụm hỗ trợ A');
    });

    it('người hỗ trợ lớp trả lời học viên có cụm (không phải cụm của mình) -> ký "Hỗ trợ lớp Zoom X"', async () => {
      const id = await taoTicket('c', 'Hỏi lại về lớp');
      expect((await traLoiHoTro(id, ht.lop.token, 'Trả lời lớp')).status).toBe(
        200,
      );
      expect(await kyTen('c', id)).toBe('Hỗ trợ lớp Zoom X');
    });

    it('trả lời song song (cụm + lớp) -> đúng 1 thành công, 1 nhận 409', async () => {
      const id = await taoTicket('c', 'Câu hỏi tranh chấp');
      const [r1, r2] = await Promise.all([
        traLoiHoTro(id, ht.cum.token, 'Cụm'),
        traLoiHoTro(id, ht.lop.token, 'Lớp'),
      ]);
      expect([r1.status, r2.status].sort()).toEqual([200, 409]);
      const thang = r1.status === 200 ? 'Cụm' : 'Lớp';
      const db = await prisma.yeu_cau_ho_tro.findUnique({ where: { id } });
      expect(db?.noi_dung_tra_loi).toBe(thang);
      expect(await kyTen('c', id)).toBe(
        thang === 'Cụm' ? 'Cụm hỗ trợ A' : 'Hỗ trợ lớp Zoom X',
      );
    });

    it('Quản trị vẫn thấy mọi ticket', async () => {
      const res = await http()
        .get('/yeu-cau-ho-tro?page_size=100')
        .set(auth(tokenQuanTri));
      expect(res.status).toBe(200);
      const tatCa = ids(res.body.data);
      for (const n of ['p', 'd', 'u', 'c'] as const)
        expect(tatCa).toContain(t[n]);
    });
  });
});
