import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoDonViTest,
  taoNguoiDungTest,
  uniqueSuffix,
  xoaDonViTest,
  xoaNguoiDungTest,
} from './utils/test-data';

const URL = '/cong-don-vi/dot-trien-khai';

// Issue #56 / ADR 0015 M1, M2, S4, S6, T1, T3: Quản trị tạo/sửa đợt triển khai.
describe('Đợt triển khai - Cổng đơn vị (e2e)', () => {
  let app: INestApplication;
  let donViFixture: Awaited<ReturnType<typeof taoDonViTest>>;
  let soId: string;
  let soNgungId: string;
  let quanTri: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let truong: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let soGddt: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let hocVienId: string | undefined;
  let nguoiDungHocVienId: string | undefined;
  let tokenQuanTri: string;
  let tokenTruong: string;
  let tokenSo: string;
  let tokenHocVien: string;

  const dotIds: string[] = [];
  const donViThemIds: string[] = [];

  const http = () => request(app.getHttpServer());
  const qt = (r: request.Test) =>
    r.set('Authorization', `Bearer ${tokenQuanTri}`);

  async function dangNhap(ten_dang_nhap: string, mat_khau: string) {
    const res = await http()
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap, mat_khau })
      .expect(200);
    return res.body.token as string;
  }

  function body(over: Record<string, unknown> = {}) {
    return {
      chuong_trinh: 'hsg',
      ten: `Đợt HSG test ${uniqueSuffix()}`,
      don_gia: 1500000,
      ngay_qd_tu: '2026-03-01',
      ngay_qd_den: '2026-12-31',
      han_nop_ngay: '2026-12-31',
      so_gddt_id: soId,
      ...over,
    };
  }

  async function taoDot(over: Record<string, unknown> = {}) {
    const res = await qt(http().post(URL)).send(body(over));
    if (typeof res.body?.id === 'string') dotIds.push(res.body.id);
    return res;
  }

  async function taoDonViSo(trang_thai: 'active' | 'ngung') {
    const dv = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `SO-DTK-${uniqueSuffix()}`,
        ten_don_vi: `Sở test ${uniqueSuffix()}`,
        loai_don_vi: 'so_gddt',
        dia_ban_id: donViFixture.diaDanhTinh.id,
        trang_thai,
      },
    });
    donViThemIds.push(dv.id);
    return dv.id;
  }

  beforeAll(async () => {
    app = await createTestApp();
    donViFixture = await taoDonViTest('dtk');
    soId = await taoDonViSo('active');
    soNgungId = await taoDonViSo('ngung');
    quanTri = await taoNguoiDungTest({
      vai_tro: 'quan_tri',
      don_vi_id: donViFixture.donVi.id,
      mat_khau: 'MatKhau123',
    });
    truong = await taoNguoiDungTest({
      vai_tro: 'truong',
      don_vi_id: donViFixture.donVi.id,
      mat_khau: 'MatKhau123',
    });
    soGddt = await taoNguoiDungTest({
      vai_tro: 'so_gddt',
      don_vi_id: soId,
      mat_khau: 'MatKhau123',
    });
    const tenHv = `MOET-DTK-${uniqueSuffix()}`;
    const hv = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: tenHv,
        ho_ten: 'Học Viên Giả Lập',
        ngay_sinh: 1,
        thang_sinh: 1,
        nam_sinh: 1990,
        don_vi_cong_tac_id: donViFixture.donVi.id,
      },
    });
    hocVienId = hv.id;
    const nd = await prisma.nguoi_dung.create({
      data: {
        ho_ten: hv.ho_ten,
        ten_dang_nhap: tenHv,
        vai_tro: 'hoc_vien',
        hoc_vien_id: hv.id,
        mat_khau_hash: await bcrypt.hash('MatKhau123', 4),
        phai_doi_mat_khau: false,
      },
    });
    nguoiDungHocVienId = nd.id;
    tokenQuanTri = await dangNhap(quanTri.ten_dang_nhap, 'MatKhau123');
    tokenTruong = await dangNhap(truong.ten_dang_nhap, 'MatKhau123');
    tokenSo = await dangNhap(soGddt.ten_dang_nhap, 'MatKhau123');
    tokenHocVien = await dangNhap(tenHv, 'MatKhau123');
  });

  afterAll(async () => {
    // Chỉ xóa đúng các dòng file này tạo (id đã ghi lại, có kiểm tra trước).
    // nhat_ky_hoat_dong chỉ cho thêm (trigger chặn xóa) — để nguyên như các file e2e khác.
    await prisma.dot_trien_khai.deleteMany({ where: { id: { in: dotIds } } });
    for (const u of [quanTri, truong, soGddt]) {
      if (u?.nguoiDung.id) await xoaNguoiDungTest(u.nguoiDung.id);
    }
    if (nguoiDungHocVienId) await xoaNguoiDungTest(nguoiDungHocVienId);
    if (hocVienId)
      await prisma.hoc_vien.deleteMany({ where: { id: hocVienId } });
    await prisma.don_vi_cong_tac.deleteMany({
      where: { id: { in: donViThemIds } },
    });
    if (donViFixture) {
      await xoaDonViTest(
        [donViFixture.donVi.id],
        [donViFixture.diaDanhXa.id, donViFixture.diaDanhTinh.id],
      );
    }
    await prisma.$disconnect();
    await app.close();
  });

  describe('Phân quyền', () => {
    it('401 khi không có token', async () => {
      await http().get(URL).expect(401);
      await http().post(URL).send(body()).expect(401);
    });

    it.each([
      ['truong', () => tokenTruong],
      ['so_gddt', () => tokenSo],
      ['hoc_vien', () => tokenHocVien],
    ])('403 cho vai trò %s (GET, POST, PATCH)', async (_ten, layToken) => {
      const token = layToken();
      await http().get(URL).set('Authorization', `Bearer ${token}`).expect(403);
      await http()
        .post(URL)
        .set('Authorization', `Bearer ${token}`)
        .send(body())
        .expect(403);
      await http()
        .patch(`${URL}/${randomUUID()}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ ten: 'x' })
        .expect(403);
    });
  });

  describe('Tạo / xem', () => {
    it('quan_tri tạo đợt đủ trường → 201, hạn nộp lưu 23:59:59 +07, ghi nhật ký', async () => {
      const ten = `Đợt HSG đủ ${uniqueSuffix()}`;
      const res = await taoDot({ ten: `  ${ten}  ` });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        chuong_trinh: 'hsg',
        ten,
        don_gia: 1500000,
        ngay_qd_tu: '2026-03-01',
        ngay_qd_den: '2026-12-31',
        han_nop: '2026-12-31T16:59:59.000Z',
        han_nop_ngay: '2026-12-31',
        so_gddt: { id: soId },
      });
      expect(typeof res.body.so_gddt.ten_don_vi).toBe('string');
      expect(res.body.created_at).toBeTruthy();
      expect(res.body.updated_at).toBeTruthy();

      const dong = await prisma.dot_trien_khai.findUniqueOrThrow({
        where: { id: res.body.id },
      });
      expect(dong.han_nop.toISOString()).toBe('2026-12-31T16:59:59.000Z');
      expect(dong.created_by).toBe(quanTri.nguoiDung.id);

      const nk = await prisma.nhat_ky_hoat_dong.findFirst({
        where: {
          hanh_dong: 'tao_dot_trien_khai',
          nguoi_dung_id: quanTri.nguoiDung.id,
        },
        orderBy: { thoi_gian: 'desc' },
      });
      expect(nk?.chi_tiet).toMatchObject({ dot_trien_khai_id: res.body.id });
    });

    it('đơn giá null và không có QĐ → 201 với các trường null', async () => {
      const res = await taoDot({
        chuong_trinh: 'nls',
        don_gia: null,
        ngay_qd_tu: null,
        ngay_qd_den: null,
      });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        chuong_trinh: 'nls',
        don_gia: null,
        ngay_qd_tu: null,
        ngay_qd_den: null,
      });
    });

    it('bỏ hẳn don_gia/ngày QĐ (không gửi) → 201, null', async () => {
      const b = body();
      delete (b as Partial<typeof b>).don_gia;
      delete (b as Partial<typeof b>).ngay_qd_tu;
      delete (b as Partial<typeof b>).ngay_qd_den;
      const res = await qt(http().post(URL)).send(b);
      if (typeof res.body?.id === 'string') dotIds.push(res.body.id);
      expect(res.status).toBe(201);
      expect(res.body.don_gia).toBeNull();
      expect(res.body.ngay_qd_tu).toBeNull();
    });

    it('GET danh sách: mới nhất trước, kèm so_gddt {id, ten_don_vi}', async () => {
      const a = await taoDot({ ten: 'Đợt cũ hơn' });
      const b = await taoDot({ ten: 'Đợt mới hơn' });
      const res = await qt(http().get(URL)).expect(200);
      const ids = (res.body as { id: string }[]).map((d) => d.id);
      expect(ids.indexOf(b.body.id)).toBeGreaterThanOrEqual(0);
      expect(ids.indexOf(b.body.id)).toBeLessThan(ids.indexOf(a.body.id));
      const dongB = res.body.find((d: { id: string }) => d.id === b.body.id);
      expect(Object.keys(dongB.so_gddt).sort()).toEqual(['id', 'ten_don_vi']);
    });

    it('GET :id → 200; id không tồn tại → 404; id sai định dạng → 400', async () => {
      const tao = await taoDot();
      const res = await qt(http().get(`${URL}/${tao.body.id}`)).expect(200);
      expect(res.body.id).toBe(tao.body.id);
      await qt(http().get(`${URL}/${randomUUID()}`)).expect(404);
      await qt(http().get(`${URL}/khong-phai-uuid`)).expect(400);
    });
  });

  describe('Kiểm tra dữ liệu', () => {
    it('ngày QĐ đến == từ → 201', async () => {
      const res = await taoDot({
        ngay_qd_tu: '2026-05-05',
        ngay_qd_den: '2026-05-05',
      });
      expect(res.status).toBe(201);
    });

    it('ngày QĐ đến < từ → 400', async () => {
      const res = await taoDot({
        ngay_qd_tu: '2026-05-06',
        ngay_qd_den: '2026-05-05',
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it.each([
      [{ ngay_qd_tu: '2026-05-05', ngay_qd_den: null }],
      [{ ngay_qd_tu: null, ngay_qd_den: '2026-05-05' }],
    ])('chỉ có 1 trong 2 ngày QĐ → 400 (%o)', async (over) => {
      const res = await taoDot(over);
      expect(res.status).toBe(400);
    });

    it.each([[-1], [1.5], ['1000']])('đơn giá %p → 400', async (don_gia) => {
      const res = await taoDot({ don_gia });
      expect(res.status).toBe(400);
    });

    it('so_gddt_id trỏ tới trường → 400', async () => {
      const res = await taoDot({ so_gddt_id: donViFixture.donVi.id });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('so_gddt_id');
    });

    it('so_gddt_id là Sở đã ngưng hoặc không tồn tại → 400', async () => {
      expect((await taoDot({ so_gddt_id: soNgungId })).status).toBe(400);
      expect((await taoDot({ so_gddt_id: randomUUID() })).status).toBe(400);
    });

    it.each([
      ['tên rỗng', { ten: '   ' }],
      ['tên quá 255 ký tự', { ten: 'a'.repeat(256) }],
      ['chương trình lạ', { chuong_trinh: 'abc' }],
      ['thiếu hạn nộp', { han_nop_ngay: undefined }],
      ['hạn nộp kèm giờ', { han_nop_ngay: '2026-12-31T10:00:00Z' }],
      ['hạn nộp ngày không có thật', { han_nop_ngay: '2026-02-30' }],
      ['ngày QĐ sai định dạng', { ngay_qd_tu: '01/03/2026' }],
    ])('%s → 400', async (_ten, over) => {
      const res = await taoDot(over);
      expect(res.status).toBe(400);
    });
  });

  describe('Sửa (PATCH)', () => {
    it('đổi hạn nộp (gia hạn cả đợt) → cập nhật + nhật ký chỉ trường đã đổi', async () => {
      const tao = await taoDot({ han_nop_ngay: '2026-12-01' });
      const res = await qt(http().patch(`${URL}/${tao.body.id}`))
        .send({ han_nop_ngay: '2026-12-15' })
        .expect(200);
      expect(res.body.han_nop).toBe('2026-12-15T16:59:59.000Z');
      expect(res.body.han_nop_ngay).toBe('2026-12-15');
      expect(res.body.ten).toBe(tao.body.ten);
      expect(res.body.don_gia).toBe(1500000);

      const nk = await prisma.nhat_ky_hoat_dong.findFirst({
        where: {
          hanh_dong: 'sua_dot_trien_khai',
          nguoi_dung_id: quanTri.nguoiDung.id,
        },
        orderBy: { thoi_gian: 'desc' },
      });
      expect(nk?.chi_tiet).toEqual({
        dot_trien_khai_id: tao.body.id,
        truoc: { han_nop: '2026-12-01T16:59:59.000Z' },
        sau: { han_nop: '2026-12-15T16:59:59.000Z' },
      });
    });

    it('xóa đơn giá (null) và xóa khoảng QĐ (cả hai null) → 200', async () => {
      const tao = await taoDot();
      const res = await qt(http().patch(`${URL}/${tao.body.id}`))
        .send({ don_gia: null, ngay_qd_tu: null, ngay_qd_den: null })
        .expect(200);
      expect(res.body).toMatchObject({
        don_gia: null,
        ngay_qd_tu: null,
        ngay_qd_den: null,
      });
    });

    it('chỉ sửa ngày QĐ đến sớm hơn ngày từ đang lưu → 400 (kiểm theo trạng thái gộp)', async () => {
      const tao = await taoDot({
        ngay_qd_tu: '2026-03-01',
        ngay_qd_den: '2026-12-31',
      });
      const res = await qt(http().patch(`${URL}/${tao.body.id}`)).send({
        ngay_qd_den: '2026-02-28',
      });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/ngày/i);
    });

    it('chỉ xóa 1 trong 2 ngày QĐ → 400', async () => {
      const tao = await taoDot();
      const res = await qt(http().patch(`${URL}/${tao.body.id}`)).send({
        ngay_qd_tu: null,
      });
      expect(res.status).toBe(400);
    });

    it('PATCH tên null / đơn giá âm / Sở là trường → 400', async () => {
      const tao = await taoDot();
      const url = `${URL}/${tao.body.id}`;
      expect((await qt(http().patch(url)).send({ ten: null })).status).toBe(
        400,
      );
      expect((await qt(http().patch(url)).send({ don_gia: -5 })).status).toBe(
        400,
      );
      expect(
        (
          await qt(http().patch(url)).send({
            so_gddt_id: donViFixture.donVi.id,
          })
        ).status,
      ).toBe(400);
    });

    it('PATCH id không tồn tại → 404', async () => {
      await qt(http().patch(`${URL}/${randomUUID()}`))
        .send({ ten: 'Không có' })
        .expect(404);
    });
  });
});
