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
    // Nới giới hạn throttler CHỈ cho file này — file này tự gọi
    // /auth/dang-nhap hơn 10 lần cho các test KHÔNG liên quan tới T1 rate
    // limit (đã có test riêng ở test/rate-limit.e2e-spec.ts). Xem comment ở
    // createTestApp().
    app = await createTestApp({ raiseThrottlerLimit: true });
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

    // T1 (mo-rong-nls-an-giang.md): mật khẩu mới >=8 ký tự, có cả chữ và số,
    // khác mật khẩu cũ.
    it.each([
      ['Ab1', 'quá ngắn'],
      ['abcdefgh', 'không có số'],
      ['12345678', 'không có chữ'],
    ])(
      'mật khẩu mới "%s" (%s) -> 400 VALIDATION_ERROR, field mat_khau_moi',
      async (matKhauMoi) => {
        const login = await request(app.getHttpServer())
          .post('/auth/dang-nhap')
          .send({
            ten_dang_nhap: taiKhoan.ten_dang_nhap,
            mat_khau: taiKhoan.mat_khau,
          });

        const res = await request(app.getHttpServer())
          .post('/auth/doi-mat-khau')
          .set('Authorization', `Bearer ${login.body.token}`)
          .send({ mat_khau_cu: taiKhoan.mat_khau, mat_khau_moi: matKhauMoi })
          .expect(400);

        expect(
          res.body.error.fields.some(
            (f: { field: string }) => f.field === 'mat_khau_moi',
          ),
        ).toBe(true);
      },
    );

    it('mật khẩu mới trùng mật khẩu cũ -> 400 VALIDATION_ERROR', async () => {
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
          mat_khau_moi: taiKhoan.mat_khau,
        })
        .expect(400);
    });
  });

  describe('Bảo mật đăng nhập (T1) — thông báo lỗi, mã lỗi', () => {
    it('sai tên đăng nhập trả cùng thông báo/UNAUTHORIZED như sai mật khẩu (không lộ tài khoản tồn tại)', async () => {
      const resSaiUser = await request(app.getHttpServer())
        .post('/auth/dang-nhap')
        .send({ ten_dang_nhap: 'khong-ton-tai-xyz', mat_khau: 'x' })
        .expect(401);
      const resSaiPass = await request(app.getHttpServer())
        .post('/auth/dang-nhap')
        .send({
          ten_dang_nhap: taiKhoan.ten_dang_nhap,
          mat_khau: 'sai-chac-chan',
        })
        .expect(401);
      expect(resSaiUser.body.error.code).toBe('UNAUTHORIZED');
      expect(resSaiPass.body.error.code).toBe('UNAUTHORIZED');
      expect(resSaiUser.body.error.message).toBe(resSaiPass.body.error.message);
    });
  });

  describe('POST /auth/dang-xuat', () => {
    it('không có token -> 401', async () => {
      await request(app.getHttpServer()).post('/auth/dang-xuat').expect(401);
    });

    it('đăng xuất xong: token vừa dùng bị 401, token khác của cùng tài khoản KHÔNG bị ảnh hưởng', async () => {
      const loginA = await request(app.getHttpServer())
        .post('/auth/dang-nhap')
        .send({
          ten_dang_nhap: taiKhoan.ten_dang_nhap,
          mat_khau: taiKhoan.mat_khau,
        });
      const tokenA = loginA.body.token as string;
      const loginB = await request(app.getHttpServer())
        .post('/auth/dang-nhap')
        .send({
          ten_dang_nhap: taiKhoan.ten_dang_nhap,
          mat_khau: taiKhoan.mat_khau,
        });
      const tokenB = loginB.body.token as string;

      // Trước khi đăng xuất: cả 2 token còn hợp lệ.
      await request(app.getHttpServer())
        .get('/auth/toi')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/dang-xuat')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.da_dang_xuat).toBe(true);
        });

      // Token vừa đăng xuất -> 401 dù chữ ký vẫn hợp lệ (đã bị thu hồi).
      await request(app.getHttpServer())
        .get('/auth/toi')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(401);

      // Token B (chưa đăng xuất) của CÙNG tài khoản không bị ảnh hưởng — không
      // được reject nhầm token còn hợp lệ (regression rất dễ gặp ở cơ chế thu hồi).
      await request(app.getHttpServer())
        .get('/auth/toi')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);
    });

    it('gọi đăng xuất lần 2 với token đã bị thu hồi -> vẫn 401 (không lỗi 500), idempotent', async () => {
      const login = await request(app.getHttpServer())
        .post('/auth/dang-nhap')
        .send({
          ten_dang_nhap: taiKhoan.ten_dang_nhap,
          mat_khau: taiKhoan.mat_khau,
        });
      const token = login.body.token as string;

      await request(app.getHttpServer())
        .post('/auth/dang-xuat')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // JwtAuthGuard đã chặn từ bước xác thực (token bị thu hồi) nên request
      // dang-xuat lần 2 không tới được AuthService.dangXuat — vẫn phải trả về
      // lỗi có kiểm soát (401), không phải 500.
      await request(app.getHttpServer())
        .post('/auth/dang-xuat')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });
  });
});
