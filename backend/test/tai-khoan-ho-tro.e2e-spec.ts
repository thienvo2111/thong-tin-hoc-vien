import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoNguoiDungTest,
  uniqueSuffix,
  xoaNguoiDungTest,
} from './utils/test-data';

// Người hỗ trợ học viên (ADR 0003, đặc tả 2026-10-06 mục 1 — Lát 1): tài
// khoản ho_tro_hoc_vien + phân công vào cụm. Kịch bản T17, T18, T19.
describe('Tài khoản người hỗ trợ học viên — API (e2e)', () => {
  let app: INestApplication;
  const suf = uniqueSuffix();
  const SUF = suf.toUpperCase();
  const MIEN = `${suf}@tkht.vn`;
  const diaDanhIds: string[] = [];
  const donViIds: string[] = [];
  const nguoiDungIds: string[] = [];
  const khoaIds: string[] = [];
  let tokenQuanTri: string;
  let tokenTruong: string;
  let donViTruongId: string;
  let khoaA: { id: string; cumIds: string[] };
  let khoaB: { id: string; cumIds: string[] };

  const http = () => request(app.getHttpServer());
  const dangNhap = async (ten: string, mk: string) =>
    http().post('/auth/dang-nhap').send({ ten_dang_nhap: ten, mat_khau: mk });
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function taoKhoa(nhan: string, soCum: number) {
    const khoa = await prisma.khoa_boi_duong.create({
      data: {
        ma_khoa: `K-TKHT${nhan}-${SUF}`,
        ten_khoa: `Khóa ${nhan} ${suf}`,
        don_vi_dat_hang_id: donViTruongId,
        thoi_gian_bat_dau: new Date('2026-11-01'),
        thoi_gian_ket_thuc: new Date('2026-12-01'),
        trang_thai: 'da_duyet',
      },
    });
    khoaIds.push(khoa.id);
    const cumIds: string[] = [];
    for (let i = 1; i <= soCum; i++) {
      const cum = await prisma.cum_hoc_vien.create({
        data: { khoa_id: khoa.id, ten_cum: `Cụm hỗ trợ ${i}` },
      });
      cumIds.push(cum.id);
    }
    return { id: khoa.id, cumIds };
  }

  async function taoHoTro(body: Record<string, unknown>) {
    const res = await http()
      .post('/nguoi-dung/ho-tro')
      .set(auth(tokenQuanTri))
      .send(body);
    if (res.body?.tai_khoan?.id) nguoiDungIds.push(res.body.tai_khoan.id);
    return res;
  }

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    const tinh = await prisma.dia_danh.create({
      data: { ma: `T-tkht-${suf}`, ten: `Tỉnh ${suf}`, cap: 'tinh_thanh' },
    });
    const xa = await prisma.dia_danh.create({
      data: {
        ma: `X-tkht-${suf}`,
        ten: `Xã ${suf}`,
        cap: 'phuong_xa_dac_khu',
        parent_id: tinh.id,
      },
    });
    diaDanhIds.push(xa.id, tinh.id);
    const dv = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-tkht-${suf}`,
        ten_don_vi: `Trường ${suf}`,
        loai_don_vi: 'truong',
        dia_ban_id: xa.id,
      },
    });
    donViIds.push(dv.id);
    donViTruongId = dv.id;

    const qt = await taoNguoiDungTest({
      vai_tro: 'quan_tri',
      don_vi_id: dv.id,
      mat_khau: 'QuanTri12345',
    });
    const tr = await taoNguoiDungTest({
      vai_tro: 'truong',
      don_vi_id: dv.id,
      mat_khau: 'Truong12345',
    });
    nguoiDungIds.push(qt.nguoiDung.id, tr.nguoiDung.id);
    tokenQuanTri = (await dangNhap(qt.ten_dang_nhap, 'QuanTri12345')).body
      .token;
    tokenTruong = (await dangNhap(tr.ten_dang_nhap, 'Truong12345')).body.token;

    khoaA = await taoKhoa('a', 2);
    khoaB = await taoKhoa('b', 1);
  });

  afterAll(async () => {
    const ids = [...new Set(nguoiDungIds)];
    await prisma.nhat_ky_dat_lai_mat_khau.deleteMany({
      where: {
        OR: [{ nguoi_dung_id: { in: ids } }, { thuc_hien_boi: { in: ids } }],
      },
    });
    await prisma.token_xac_thuc.deleteMany({
      where: { nguoi_dung_id: { in: ids } },
    });
    await prisma.hang_doi_email.deleteMany({
      where: { email_nguoi_nhan: { endsWith: MIEN } },
    });
    await prisma.nhat_ky_thong_bao.deleteMany({
      where: { email_nguoi_nhan: { endsWith: MIEN } },
    });
    await prisma.khoa_boi_duong.deleteMany({ where: { id: { in: khoaIds } } });
    for (const id of ids) await xoaNguoiDungTest(id);
    await prisma.don_vi_cong_tac.deleteMany({
      where: { id: { in: donViIds } },
    });
    await prisma.dia_danh.deleteMany({ where: { id: { in: diaDanhIds } } });
    await prisma.$disconnect();
    await app.close();
  });

  describe('POST /nguoi-dung/ho-tro', () => {
    it('thiếu email -> 400 (người hỗ trợ là cán bộ HCMUE, email bắt buộc)', async () => {
      const res = await taoHoTro({ ho_ten: 'Không email' });
      expect(res.status).toBe(400);
    });

    it('mặc định gửi link kích hoạt: tên đăng nhập = phần trước @ của email, không trả mật khẩu, email vào hàng đợi', async () => {
      const email = `Nguyen.A-${MIEN}`;
      const res = await taoHoTro({ ho_ten: '  Nguyễn Văn A ', email });
      expect(res.status).toBe(201);
      expect(res.body.tai_khoan.vai_tro).toBe('ho_tro_hoc_vien');
      expect(res.body.tai_khoan.ten_dang_nhap).toBe(`nguyen.a-${suf}`);
      expect(res.body.tai_khoan.email).toBe(email.toLowerCase());
      expect(res.body.tai_khoan.ho_ten).toBe('Nguyễn Văn A');
      expect(res.body.tai_khoan.cum).toEqual([]);
      expect(res.body).not.toHaveProperty('mat_khau_tam');
      const nd = await prisma.nguoi_dung.findUnique({
        where: { id: res.body.tai_khoan.id },
      });
      expect(nd?.don_vi_id).toBeNull();
      expect(nd?.hoc_vien_id).toBeNull();
      const hangDoi = await prisma.hang_doi_email.count({
        where: {
          email_nguoi_nhan: email.toLowerCase(),
          loai_su_kien: 'kich_hoat_tai_khoan',
        },
      });
      expect(hangDoi).toBe(1);
    });

    it('cach_cap=mat_khau_tam + tên gợi nhớ: đăng nhập không phân biệt hoa/thường, buộc đổi mật khẩu', async () => {
      const res = await taoHoTro({
        ho_ten: 'Trần Thị B',
        email: `b-${MIEN}`,
        ten_dang_nhap: `HT-B-${SUF}`,
        cach_cap: 'mat_khau_tam',
      });
      expect(res.status).toBe(201);
      expect(res.body.tai_khoan.ten_dang_nhap).toBe(`ht-b-${suf}`);
      expect(res.body.mat_khau_tam).toMatch(/^[A-Za-z2-9]{10}$/);
      const dn = await dangNhap(`HT-B-${SUF}`, res.body.mat_khau_tam);
      expect(dn.status).toBe(200);
      expect(dn.body.nguoi_dung.vai_tro).toBe('ho_tro_hoc_vien');
      expect(dn.body.nguoi_dung.phai_doi_mat_khau).toBe(true);
    });

    it('tên đăng nhập trùng (không phân biệt hoa/thường) -> 409; email trùng -> 409', async () => {
      const r1 = await taoHoTro({
        email: `khac-${MIEN}`,
        ho_ten: 'X',
        ten_dang_nhap: `ht-b-${suf}`,
      });
      expect(r1.status).toBe(409);
      const r2 = await taoHoTro({ email: `B-${MIEN}`, ho_ten: 'Y' });
      expect(r2.status).toBe(409);
    });

    it('T19: vai trò khác quan_tri -> 403', async () => {
      const res = await http()
        .post('/nguoi-dung/ho-tro')
        .set(auth(tokenTruong))
        .send({ ho_ten: 'Z', email: `z-${MIEN}` });
      expect(res.status).toBe(403);
    });
  });

  it('T17: CHECK chặn tài khoản ho_tro_hoc_vien gắn đơn vị hoặc thiếu email', async () => {
    await expect(
      prisma.nguoi_dung.create({
        data: {
          ho_ten: 'Sai',
          ten_dang_nhap: `sai1-${suf}`,
          email: `sai1-${MIEN}`,
          vai_tro: 'ho_tro_hoc_vien',
          don_vi_id: donViTruongId,
          mat_khau_hash: 'x',
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.nguoi_dung.create({
        data: {
          ho_ten: 'Sai',
          ten_dang_nhap: `sai2-${suf}`,
          vai_tro: 'ho_tro_hoc_vien',
          mat_khau_hash: 'x',
        },
      }),
    ).rejects.toThrow();
  });

  describe('Đăng nhập & phạm vi vai trò', () => {
    let tokenHoTro: string;

    beforeAll(async () => {
      const res = await taoHoTro({
        ho_ten: 'Lê Văn C',
        email: `c-${MIEN}`,
        ten_dang_nhap: `ht-c-${suf}`,
        cach_cap: 'mat_khau_tam',
      });
      const dn = await dangNhap(`ht-c-${suf}`, res.body.mat_khau_tam);
      await http()
        .post('/auth/doi-mat-khau')
        .set(auth(dn.body.token))
        .send({
          mat_khau_cu: res.body.mat_khau_tam,
          mat_khau_moi: 'HoTroMoi12345',
        });
      tokenHoTro = (await dangNhap(`ht-c-${suf}`, 'HoTroMoi12345')).body.token;
    });

    it('T19: người hỗ trợ không gọi được API quản trị/đơn vị', async () => {
      for (const duong of [
        '/nguoi-dung/ho-tro',
        '/nguoi-dung/don-vi',
        '/hoc-vien',
        '/khoa-boi-duong',
      ]) {
        const res = await http().get(duong).set(auth(tokenHoTro));
        expect([403]).toContain(res.status);
      }
    });

    it('quên mật khẩu: người hỗ trợ (luôn có email) nhận link đặt lại', async () => {
      const res = await http()
        .post('/auth/quen-mat-khau')
        .send({ ten_dang_nhap: `HT-C-${SUF}` });
      expect(res.status).toBe(200);
      const nd = await prisma.nguoi_dung.findFirst({
        where: { ten_dang_nhap: `ht-c-${suf}` },
      });
      const token = await prisma.token_xac_thuc.count({
        where: { nguoi_dung_id: nd!.id, loai: 'dat_lai_mat_khau' },
      });
      expect(token).toBe(1);
    });

    it('PATCH trang_thai=ngung -> không đăng nhập được nữa', async () => {
      const nd = await prisma.nguoi_dung.findFirst({
        where: { ten_dang_nhap: `ht-c-${suf}` },
      });
      const res = await http()
        .patch(`/nguoi-dung/ho-tro/${nd!.id}`)
        .set(auth(tokenQuanTri))
        .send({ trang_thai: 'ngung' });
      expect(res.status).toBe(200);
      expect(res.body.trang_thai).toBe('ngung');
      const dn = await dangNhap(`ht-c-${suf}`, 'HoTroMoi12345');
      expect(dn.status).not.toBe(200);
    });
  });

  describe('Cấp lại', () => {
    let id: string;
    beforeAll(async () => {
      const res = await taoHoTro({ ho_ten: 'Phạm D', email: `d-${MIEN}` });
      id = res.body.tai_khoan.id;
    });

    it('cấp mật khẩu tạm mới -> đăng nhập được, có nhật ký', async () => {
      const res = await http()
        .post(`/nguoi-dung/ho-tro/${id}/cap-mat-khau-tam`)
        .set(auth(tokenQuanTri));
      expect(res.status).toBe(200);
      const dn = await dangNhap(res.body.ten_dang_nhap, res.body.mat_khau_tam);
      expect(dn.status).toBe(200);
      expect(
        await prisma.nhat_ky_dat_lai_mat_khau.count({
          where: { nguoi_dung_id: id },
        }),
      ).toBeGreaterThanOrEqual(2);
    });

    it('gửi lại link kích hoạt -> email mới trong hàng đợi', async () => {
      const res = await http()
        .post(`/nguoi-dung/ho-tro/${id}/gui-email-kich-hoat`)
        .set(auth(tokenQuanTri));
      expect(res.status).toBe(200);
      expect(
        await prisma.hang_doi_email.count({
          where: {
            email_nguoi_nhan: `d-${MIEN}`,
            loai_su_kien: 'kich_hoat_tai_khoan',
          },
        }),
      ).toBe(2);
    });

    it('id không phải tài khoản hỗ trợ -> 404', async () => {
      const qt = nguoiDungIds[0];
      const res = await http()
        .post(`/nguoi-dung/ho-tro/${qt}/cap-mat-khau-tam`)
        .set(auth(tokenQuanTri));
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /khoa-boi-duong/{khoaId}/cum/{cumId}/nguoi-ho-tro', () => {
    let e: string;
    let f: string;
    beforeAll(async () => {
      e = (await taoHoTro({ ho_ten: 'Hỗ trợ E', email: `e-${MIEN}` })).body
        .tai_khoan.id;
      f = (await taoHoTro({ ho_ten: 'Hỗ trợ F', email: `f-${MIEN}` })).body
        .tai_khoan.id;
    });
    const put = (
      khoaId: string,
      cumId: string,
      ids: string[],
      token = tokenQuanTri,
    ) =>
      http()
        .put(`/khoa-boi-duong/${khoaId}/cum/${cumId}/nguoi-ho-tro`)
        .set(auth(token))
        .send({ nguoi_dung_ids: ids });

    it('gán 1 người vào 2 cụm ở 2 khóa; chi tiết khóa và danh sách tài khoản phản ánh phân công', async () => {
      expect((await put(khoaA.id, khoaA.cumIds[0], [e])).status).toBe(200);
      expect((await put(khoaB.id, khoaB.cumIds[0], [e, f])).status).toBe(200);

      const khoa = await http()
        .get(`/khoa-boi-duong/${khoaA.id}`)
        .set(auth(tokenQuanTri));
      const cum1 = khoa.body.cum_hoc_vien.find(
        (c: { id: string }) => c.id === khoaA.cumIds[0],
      );
      const cum2 = khoa.body.cum_hoc_vien.find(
        (c: { id: string }) => c.id === khoaA.cumIds[1],
      );
      expect(cum1.nguoi_ho_tro).toEqual([{ id: e, ho_ten: 'Hỗ trợ E' }]);
      expect(cum2.nguoi_ho_tro).toEqual([]);

      // H14: ngoài Quản trị không ai thấy họ tên người hỗ trợ qua chi tiết khóa.
      const khoaTr = await http()
        .get(`/khoa-boi-duong/${khoaA.id}`)
        .set(auth(tokenTruong));
      expect(khoaTr.status).toBe(200);
      expect(khoaTr.body.cum_hoc_vien[0]).not.toHaveProperty('nguoi_ho_tro');

      const ds = await http()
        .get('/nguoi-dung/ho-tro')
        .query({ q: `e-${suf}` })
        .set(auth(tokenQuanTri));
      const tk = ds.body.data.find((x: { id: string }) => x.id === e);
      expect(tk.cum.map((c: { cum_id: string }) => c.cum_id).sort()).toEqual(
        [khoaA.cumIds[0], khoaB.cumIds[0]].sort(),
      );
      expect(tk.cum[0]).toHaveProperty('ten_khoa');
    });

    it('PUT thay toàn bộ: danh sách rỗng gỡ hết phân công của cụm', async () => {
      expect((await put(khoaB.id, khoaB.cumIds[0], [f])).status).toBe(200);
      expect(
        await prisma.phan_cong_ho_tro.count({
          where: { cum_id: khoaB.cumIds[0] },
        }),
      ).toBe(1);
      expect((await put(khoaB.id, khoaB.cumIds[0], [])).status).toBe(200);
      expect(
        await prisma.phan_cong_ho_tro.count({
          where: { cum_id: khoaB.cumIds[0] },
        }),
      ).toBe(0);
    });

    it('T18: gán tài khoản không phải ho_tro_hoc_vien -> 400', async () => {
      const res = await put(khoaA.id, khoaA.cumIds[1], [nguoiDungIds[0]]);
      expect(res.status).toBe(400);
    });

    it('T18: cụm không thuộc khóa -> 404', async () => {
      const res = await put(khoaA.id, khoaB.cumIds[0], [e]);
      expect(res.status).toBe(404);
    });

    it('T19: vai trò khác quan_tri -> 403', async () => {
      const res = await put(khoaA.id, khoaA.cumIds[1], [e], tokenTruong);
      expect(res.status).toBe(403);
    });
  });
});
