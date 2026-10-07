import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './utils/test-app';
import { prisma } from './utils/test-data';

// T1 (bảo mật đăng nhập, mo-rong-nls-an-giang.md): GET /hoc-vien/kiem-tra-trung
// 10 request/phút/IP; POST /auth/dang-nhap + /auth/quen-mat-khau 20/phút cho
// mỗi cặp IP + ten_dang_nhap (TaiKhoanThrottlerGuard). File RIÊNG, dùng
// đúng cấu hình throttler thật (không raiseThrottlerLimit) — mọi file e2e
// khác nới giới hạn này để test hành vi CHỨC NĂNG không bị 429 giả gây
// nhiễu; file này là nơi DUY NHẤT xác nhận hành vi rate-limit thật.
describe('Giới hạn tần suất theo IP (T1, e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  // 2026-10-07: dang-nhap/quen-mat-khau đếm theo cặp IP + ten_dang_nhap, giới
  // hạn 20/phút (gấp đôi bucket theo IP) — mọi người dùng sau proxy HCMUE/NAT
  // trường chung 1 IP không được chặn nhau. Supertest luôn gọi từ cùng 1 IP
  // nên mô phỏng đúng tình huống NAT chung.
  const GIOI_HAN_TAI_KHOAN = 20;
  async function goiHetLuot(duongDan: string, ten: string) {
    for (let i = 0; i < GIOI_HAN_TAI_KHOAN; i++) {
      const res = await request(app.getHttpServer())
        .post(duongDan)
        .send({ ten_dang_nhap: ten, mat_khau: 'x' });
      expect(res.status).not.toBe(429);
    }
  }

  it('POST /auth/dang-nhap: 20 request đầu cùng tài khoản không bị 429, request thứ 21 trong 1 phút -> 429 RATE_LIMITED', async () => {
    await goiHetLuot('/auth/dang-nhap', 'khong-ton-tai');
    const res21 = await request(app.getHttpServer())
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap: 'khong-ton-tai', mat_khau: 'x' })
      .expect(429);
    expect(res21.body.error.code).toBe('RATE_LIMITED');
  });

  it('POST /auth/dang-nhap: cùng IP nhưng tài khoản KHÁC không bị chặn khi tài khoản trước đã hết lượt', async () => {
    await goiHetLuot('/auth/dang-nhap', 'nat-tai-khoan-1');
    const res = await request(app.getHttpServer())
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap: 'nat-tai-khoan-2', mat_khau: 'x' });
    expect(res.status).not.toBe(429);
  });

  it('POST /auth/dang-nhap: tên đăng nhập không phân biệt hoa/thường khi đếm (abc và ABC chung lượt)', async () => {
    await goiHetLuot('/auth/dang-nhap', 'hoa-thuong-abc');
    await request(app.getHttpServer())
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap: 'HOA-THUONG-ABC', mat_khau: 'x' })
      .expect(429);
  });

  it('POST /auth/quen-mat-khau: request thứ 21 cùng tài khoản -> 429; tài khoản khác cùng IP vẫn qua', async () => {
    await goiHetLuot('/auth/quen-mat-khau', 'quen-mk-1');
    await request(app.getHttpServer())
      .post('/auth/quen-mat-khau')
      .send({ ten_dang_nhap: 'quen-mk-1' })
      .expect(429);
    const res = await request(app.getHttpServer())
      .post('/auth/quen-mat-khau')
      .send({ ten_dang_nhap: 'quen-mk-2' });
    expect(res.status).not.toBe(429);
  });

  it('GET /hoc-vien/kiem-tra-trung: request thứ 11 trong 1 phút -> 429 (bucket riêng, không dùng chung với dang-nhap)', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await request(app.getHttpServer()).get(
        '/hoc-vien/kiem-tra-trung?so_dinh_danh_ca_nhan=123456789012',
      );
      expect(res.status).not.toBe(429);
    }
    await request(app.getHttpServer())
      .get('/hoc-vien/kiem-tra-trung?so_dinh_danh_ca_nhan=123456789012')
      .expect(429);
  });
});
