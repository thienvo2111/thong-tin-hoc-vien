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

// T1 (bảo mật đăng nhập) — mo-rong-nls-an-giang.md. Tách riêng khỏi
// auth.e2e-spec.ts để không cộng dồn số lần gọi /auth/dang-nhap vào file đó
// (không liên quan tới rate limit) — file này nới giới hạn throttler để
// khỏi lẫn với T1 rate-limit (xem test/rate-limit.e2e-spec.ts cho việc đó).
//
// Set trực tiếp so_lan_dang_nhap_sai/khoa_den qua Prisma thay vì gọi
// /auth/dang-nhap sai 5 lần thật — vừa nhanh hơn, vừa tránh phụ thuộc vào số
// lần gọi endpoint (giữ cho throttler không phải là biến số ở đây).
describe('Khóa tài khoản sau nhiều lần đăng nhập sai (T1, e2e)', () => {
  let app: INestApplication;
  let donVi: Awaited<ReturnType<typeof taoDonViTest>>;

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    donVi = await taoDonViTest('lockout');
  });

  afterAll(async () => {
    await xoaDonViTest(
      [donVi.donVi.id],
      [donVi.diaDanhXa.id, donVi.diaDanhTinh.id],
    );
    await prisma.$disconnect();
    await app.close();
  });

  it('sai mật khẩu lần thứ 5 -> khóa 15 phút; lần thứ 6 trả 423 dù mật khẩu ĐÚNG', async () => {
    const taiKhoan = await taoNguoiDungTest({
      vai_tro: 'truong',
      don_vi_id: donVi.donVi.id,
      mat_khau: 'MatKhauGoc123',
    });
    await prisma.nguoi_dung.update({
      where: { id: taiKhoan.nguoiDung.id },
      data: { so_lan_dang_nhap_sai: 4 },
    });

    // Lần sai thứ 5 (liên tiếp) -> vẫn 401 (thông báo chung), nhưng đã set khoa_den.
    await request(app.getHttpServer())
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap: taiKhoan.ten_dang_nhap, mat_khau: 'sai' })
      .expect(401);

    const sauLan5 = await prisma.nguoi_dung.findUniqueOrThrow({
      where: { id: taiKhoan.nguoiDung.id },
    });
    expect(sauLan5.so_lan_dang_nhap_sai).toBe(5);
    expect(sauLan5.khoa_den).not.toBeNull();
    expect(sauLan5.khoa_den!.getTime()).toBeGreaterThan(Date.now());

    // Lần thứ 6, mật khẩu ĐÚNG -> vẫn 423 vì đang khóa.
    const res = await request(app.getHttpServer())
      .post('/auth/dang-nhap')
      .send({
        ten_dang_nhap: taiKhoan.ten_dang_nhap,
        mat_khau: 'MatKhauGoc123',
      })
      .expect(423);
    expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
    expect(res.body.error.khoa_den).toBeDefined();

    await xoaNguoiDungTest(taiKhoan.nguoiDung.id);
  });

  it('đăng nhập đúng trong lúc chưa khóa -> reset bộ đếm về 0, ghi dang_nhap_lan_cuoi', async () => {
    const taiKhoan = await taoNguoiDungTest({
      vai_tro: 'truong',
      don_vi_id: donVi.donVi.id,
      mat_khau: 'MatKhauGoc123',
    });
    await prisma.nguoi_dung.update({
      where: { id: taiKhoan.nguoiDung.id },
      data: { so_lan_dang_nhap_sai: 3 },
    });

    await request(app.getHttpServer())
      .post('/auth/dang-nhap')
      .send({
        ten_dang_nhap: taiKhoan.ten_dang_nhap,
        mat_khau: 'MatKhauGoc123',
      })
      .expect(200);

    const sau = await prisma.nguoi_dung.findUniqueOrThrow({
      where: { id: taiKhoan.nguoiDung.id },
    });
    expect(sau.so_lan_dang_nhap_sai).toBe(0);
    expect(sau.khoa_den).toBeNull();
    expect(sau.dang_nhap_lan_cuoi).not.toBeNull();

    await xoaNguoiDungTest(taiKhoan.nguoiDung.id);
  });

  it('hết 15 phút khóa (khoa_den đã qua) -> đăng nhập lại được bằng mật khẩu đúng', async () => {
    const taiKhoan = await taoNguoiDungTest({
      vai_tro: 'truong',
      don_vi_id: donVi.donVi.id,
      mat_khau: 'MatKhauGoc123',
    });
    await prisma.nguoi_dung.update({
      where: { id: taiKhoan.nguoiDung.id },
      data: {
        so_lan_dang_nhap_sai: 5,
        khoa_den: new Date(Date.now() - 1000),
      },
    });

    const res = await request(app.getHttpServer())
      .post('/auth/dang-nhap')
      .send({
        ten_dang_nhap: taiKhoan.ten_dang_nhap,
        mat_khau: 'MatKhauGoc123',
      })
      .expect(200);
    expect(res.body.token).toBeDefined();

    const sau = await prisma.nguoi_dung.findUniqueOrThrow({
      where: { id: taiKhoan.nguoiDung.id },
    });
    expect(sau.so_lan_dang_nhap_sai).toBe(0);
    expect(sau.khoa_den).toBeNull();

    await xoaNguoiDungTest(taiKhoan.nguoiDung.id);
  });
});
