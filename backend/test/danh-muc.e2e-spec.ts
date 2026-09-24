import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoDonViTest,
  taoNguoiDungTest,
  uniqueSuffix,
  xoaDonViTest,
  xoaNguoiDungTest,
} from './utils/test-data';

describe('Danh mục (e2e)', () => {
  let app: INestApplication;
  let donViFixture: Awaited<ReturnType<typeof taoDonViTest>>;
  let quanTri: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let truong: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let tokenQuanTri: string;
  let tokenTruong: string;

  const createdDiaDanhIds: string[] = [];
  const createdDonViIds: string[] = [];
  const createdMonHocIds: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    donViFixture = await taoDonViTest('danh-muc');
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

    const loginQuanTri = await request(app.getHttpServer())
      .post('/auth/dang-nhap')
      .send({
        ten_dang_nhap: quanTri.ten_dang_nhap,
        mat_khau: quanTri.mat_khau,
      });
    tokenQuanTri = loginQuanTri.body.token;

    const loginTruong = await request(app.getHttpServer())
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap: truong.ten_dang_nhap, mat_khau: truong.mat_khau });
    tokenTruong = loginTruong.body.token;
  });

  afterAll(async () => {
    await prisma.mon_hoc.deleteMany({
      where: { id: { in: createdMonHocIds } },
    });
    await prisma.don_vi_cong_tac.deleteMany({
      where: { id: { in: createdDonViIds } },
    });
    await prisma.dia_danh.deleteMany({
      where: { id: { in: createdDiaDanhIds } },
    });
    await xoaNguoiDungTest(quanTri.nguoiDung.id);
    await xoaNguoiDungTest(truong.nguoiDung.id);
    await xoaDonViTest(
      [donViFixture.donVi.id],
      [donViFixture.diaDanhXa.id, donViFixture.diaDanhTinh.id],
    );
    await prisma.$disconnect();
    await app.close();
  });

  describe('GET /danh-muc/dia-danh', () => {
    it('không có token -> 401', async () => {
      await request(app.getHttpServer()).get('/danh-muc/dia-danh').expect(401);
    });

    it('bất kỳ vai trò đã đăng nhập nào cũng xem được (kể cả truong)', async () => {
      const res = await request(app.getHttpServer())
        .get('/danh-muc/dia-danh')
        .set('Authorization', `Bearer ${tokenTruong}`)
        .expect(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
    });
  });

  describe('POST /danh-muc/dia-danh', () => {
    it('truong (không phải quan_tri) bị chặn -> 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/danh-muc/dia-danh')
        .set('Authorization', `Bearer ${tokenTruong}`)
        .send({ ma: `x-${uniqueSuffix()}`, ten: 'Test', cap: 'tinh_thanh' })
        .expect(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('cap=tinh_thanh kèm parent_id -> 400 (checklist #38)', async () => {
      const suf = uniqueSuffix();
      const res = await request(app.getHttpServer())
        .post('/danh-muc/dia-danh')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({
          ma: `dd-${suf}`,
          ten: 'Tỉnh lỗi',
          cap: 'tinh_thanh',
          parent_id: donViFixture.diaDanhTinh.id,
        })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('cap=phuong_xa_dac_khu thiếu parent_id -> 400', async () => {
      const suf = uniqueSuffix();
      await request(app.getHttpServer())
        .post('/danh-muc/dia-danh')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({ ma: `dd-${suf}`, ten: 'Xã lỗi', cap: 'phuong_xa_dac_khu' })
        .expect(400);
    });

    it('tạo thành công + chuẩn hóa NFC + trùng ma -> 409', async () => {
      const suf = uniqueSuffix();
      const ma = `dd-${suf}`;
      const res = await request(app.getHttpServer())
        .post('/danh-muc/dia-danh')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({ ma, ten: '  Tỉnh   Test  ', cap: 'tinh_thanh' })
        .expect(201);
      createdDiaDanhIds.push(res.body.id);
      expect(res.body.ten).toBe('Tỉnh Test');

      const dup = await request(app.getHttpServer())
        .post('/danh-muc/dia-danh')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({ ma, ten: 'Trùng mã', cap: 'tinh_thanh' })
        .expect(409);
      expect(dup.body.error.code).toBe('CONFLICT');
    });
  });

  describe('POST /danh-muc/don-vi-cong-tac', () => {
    it('dia_ban_id trỏ tới cấp tinh_thanh -> 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/danh-muc/don-vi-cong-tac')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({
          ma_don_vi: `dv-${uniqueSuffix()}`,
          ten_don_vi: 'Trường lỗi',
          loai_don_vi: 'truong',
          dia_ban_id: donViFixture.diaDanhTinh.id,
        })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('tạo thành công rồi PATCH tự làm cha của chính nó -> 400', async () => {
      const created = await request(app.getHttpServer())
        .post('/danh-muc/don-vi-cong-tac')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({
          ma_don_vi: `dv-${uniqueSuffix()}`,
          ten_don_vi: 'Trường hợp lệ',
          loai_don_vi: 'truong',
          dia_ban_id: donViFixture.diaDanhXa.id,
        })
        .expect(201);
      createdDonViIds.push(created.body.id);

      const res = await request(app.getHttpServer())
        .patch(`/danh-muc/don-vi-cong-tac/${created.body.id}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({ don_vi_cha_id: created.body.id })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /danh-muc/mon-hoc', () => {
    it('trùng (ten_mon, cap_hoc) -> 409', async () => {
      const ten_mon = `Môn test ${uniqueSuffix()}`;
      const first = await request(app.getHttpServer())
        .post('/danh-muc/mon-hoc')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({ ten_mon, cap_hoc: 'thpt' })
        .expect(201);
      createdMonHocIds.push(first.body.id);

      const res = await request(app.getHttpServer())
        .post('/danh-muc/mon-hoc')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({ ten_mon, cap_hoc: 'thpt' })
        .expect(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });
});
