import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './utils/test-app';
import { prisma } from './utils/test-data';

// T1 (bảo mật đăng nhập, mo-rong-nls-an-giang.md): 10 request/phút/IP cho
// POST /auth/dang-nhap và GET /hoc-vien/kiem-tra-trung. File RIÊNG, dùng
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

  it('POST /auth/dang-nhap: 10 request đầu không bị 429, request thứ 11 trong 1 phút -> 429', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await request(app.getHttpServer())
        .post('/auth/dang-nhap')
        .send({ ten_dang_nhap: 'khong-ton-tai', mat_khau: 'x' });
      expect(res.status).not.toBe(429);
    }
    const res11 = await request(app.getHttpServer())
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap: 'khong-ton-tai', mat_khau: 'x' })
      .expect(429);
    expect(res11.body.error.code).toBe('RATE_LIMITED');
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
