import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoDonViTest,
  taoNguoiDungTest,
  xoaDonViTest,
  xoaNguoiDungTest,
} from './utils/test-data';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let donVi: Awaited<ReturnType<typeof taoDonViTest>>;
  let taiKhoan: Awaited<ReturnType<typeof taoNguoiDungTest>>;

  beforeAll(async () => {
    app = await createTestApp();
    donVi = await taoDonViTest('auth');
    taiKhoan = await taoNguoiDungTest({
      vai_tro: 'truong',
      don_vi_id: donVi.donVi.id,
      mat_khau: 'MatKhauGoc123',
    });
  });

  afterAll(async () => {
    await xoaNguoiDungTest(taiKhoan.nguoiDung.id);
    await xoaDonViTest(
      [donVi.donVi.id],
      [donVi.diaDanhXa.id, donVi.diaDanhTinh.id],
    );
    await prisma.$disconnect();
    await app.close();
  });

  describe('POST /auth/dang-nhap', () => {
    it('đăng nhập thành công trả token + nguoi_dung không lộ mat_khau_hash', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/dang-nhap')
        .send({
          ten_dang_nhap: taiKhoan.ten_dang_nhap,
          mat_khau: taiKhoan.mat_khau,
        })
        .expect(200);

      expect(res.body.token).toEqual(expect.any(String));
      expect(res.body.phai_doi_mat_khau).toBe(false);
      expect(res.body.nguoi_dung.ten_dang_nhap).toBe(taiKhoan.ten_dang_nhap);
      expect(res.body.nguoi_dung.mat_khau_hash).toBeUndefined();
    });

    it('sai mật khẩu -> 401 UNAUTHORIZED', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/dang-nhap')
        .send({
          ten_dang_nhap: taiKhoan.ten_dang_nhap,
          mat_khau: 'sai-mat-khau',
        })
        .expect(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('tài khoản không tồn tại -> 401 UNAUTHORIZED (không lộ khác biệt)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/dang-nhap')
        .send({ ten_dang_nhap: 'khong-ton-tai@test.local', mat_khau: 'bat-ky' })
        .expect(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('thiếu field bắt buộc -> 400 VALIDATION_ERROR', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/dang-nhap')
        .send({ ten_dang_nhap: '' })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /auth/toi', () => {
    it('không có token -> 401', async () => {
      await request(app.getHttpServer()).get('/auth/toi').expect(401);
    });

    it('token hợp lệ -> trả thông tin tài khoản + phạm vi', async () => {
      const login = await request(app.getHttpServer())
        .post('/auth/dang-nhap')
        .send({
          ten_dang_nhap: taiKhoan.ten_dang_nhap,
          mat_khau: taiKhoan.mat_khau,
        });

      const res = await request(app.getHttpServer())
        .get('/auth/toi')
        .set('Authorization', `Bearer ${login.body.token}`)
        .expect(200);

      expect(res.body.nguoi_dung.id).toBe(taiKhoan.nguoiDung.id);
      expect(res.body.pham_vi.loai).toBe('don_vi_va_con');
      expect(res.body.pham_vi.don_vi_ids).toContain(donVi.donVi.id);
    });

    it('token rác -> 401', async () => {
      await request(app.getHttpServer())
        .get('/auth/toi')
        .set('Authorization', 'Bearer token-khong-hop-le')
        .expect(401);
    });
  });

  describe('POST /auth/doi-mat-khau', () => {
    it('sai mật khẩu cũ -> 400 VALIDATION_ERROR, field mat_khau_cu', async () => {
      const login = await request(app.getHttpServer())
        .post('/auth/dang-nhap')
        .send({
          ten_dang_nhap: taiKhoan.ten_dang_nhap,
          mat_khau: taiKhoan.mat_khau,
        });

      const res = await request(app.getHttpServer())
        .post('/auth/doi-mat-khau')
        .set('Authorization', `Bearer ${login.body.token}`)
        .send({ mat_khau_cu: 'sai', mat_khau_moi: 'MatKhauMoi123' })
        .expect(400);

      expect(res.body.error.fields[0].field).toBe('mat_khau_cu');
    });

    it('đổi mật khẩu thành công -> phai_doi_mat_khau=false, đăng nhập lại bằng mật khẩu mới', async () => {
      const login = await request(app.getHttpServer())
        .post('/auth/dang-nhap')
        .send({
          ten_dang_nhap: taiKhoan.ten_dang_nhap,
          mat_khau: taiKhoan.mat_khau,
        });

      await request(app.getHttpServer())
        .post('/auth/doi-mat-khau')
        .set('Authorization', `Bearer ${login.body.token}`)
        .send({
          mat_khau_cu: taiKhoan.mat_khau,
          mat_khau_moi: 'MatKhauMoiHon123',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.nguoi_dung.phai_doi_mat_khau).toBe(false);
        });

      await request(app.getHttpServer())
        .post('/auth/dang-nhap')
        .send({
          ten_dang_nhap: taiKhoan.ten_dang_nhap,
          mat_khau: 'MatKhauMoiHon123',
        })
        .expect(200);

      // Cập nhật lại để các test khác trong file (chạy sau) vẫn dùng đúng mật khẩu gốc
      taiKhoan.mat_khau = 'MatKhauMoiHon123';
    });
  });
});
