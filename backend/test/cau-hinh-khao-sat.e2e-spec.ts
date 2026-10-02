import { INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as request from 'supertest';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoDonViTest,
  taoNguoiDungTest,
  xoaDonViTest,
  xoaNguoiDungTest,
} from './utils/test-data';

const KHOA = 'khao_sat_dau_vao';

// Cấu hình khảo sát đầu vào (2026-10-02). Bản ghi là singleton dùng chung của
// DB — lưu lại bản gốc trước khi chạy và khôi phục sau cùng.
describe('Cấu hình khảo sát đầu vào (e2e)', () => {
  let app: INestApplication;
  let donVi: Awaited<ReturnType<typeof taoDonViTest>>;
  let quanTri: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let truong: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let tokenQuanTri: string;
  let tokenTruong: string;
  let banGoc: Awaited<ReturnType<typeof prisma.cau_hinh_he_thong.findUnique>>;

  const hopLe = {
    che_do_hoc_vien: 'khao_sat',
    danh_gia_dau_vao_trong_cong: false,
    hien_khao_sat: true,
    kenh_danh_gia: 'vle',
    phieu: [
      {
        ten: 'Phiếu khảo sát kĩ năng số',
        mo_ta: 'Bổ sung thông tin',
        lien_ket: [{ nhan: 'Mở phiếu', url: 'https://forms.gle/e2e' }],
      },
      {
        ten: 'Phiếu đánh giá năng lực số',
        mo_ta: '',
        lien_ket: [
          { nhan: 'Dành cho giáo viên', url: 'https://forms.gle/gv' },
          { nhan: 'Dành cho cán bộ quản lý', url: '' },
        ],
      },
    ],
  };

  async function dangNhap(ten_dang_nhap: string) {
    const res = await request(app.getHttpServer())
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap, mat_khau: 'MatKhau123' })
      .expect(200);
    return res.body.token as string;
  }

  beforeAll(async () => {
    app = await createTestApp();
    banGoc = await prisma.cau_hinh_he_thong.findUnique({
      where: { khoa: KHOA },
    });
    await prisma.cau_hinh_he_thong.deleteMany({ where: { khoa: KHOA } });

    donVi = await taoDonViTest('chks');
    quanTri = await taoNguoiDungTest({
      vai_tro: 'quan_tri',
      don_vi_id: donVi.donVi.id,
      mat_khau: 'MatKhau123',
    });
    truong = await taoNguoiDungTest({
      vai_tro: 'truong',
      don_vi_id: donVi.donVi.id,
      mat_khau: 'MatKhau123',
    });
    tokenQuanTri = await dangNhap(quanTri.ten_dang_nhap);
    tokenTruong = await dangNhap(truong.ten_dang_nhap);
  });

  afterAll(async () => {
    await prisma.cau_hinh_he_thong.deleteMany({ where: { khoa: KHOA } });
    if (banGoc) {
      await prisma.cau_hinh_he_thong.create({
        data: { ...banGoc, gia_tri: banGoc.gia_tri as Prisma.InputJsonValue },
      });
    }
    await xoaNguoiDungTest(quanTri.nguoiDung.id);
    await xoaNguoiDungTest(truong.nguoiDung.id);
    await xoaDonViTest(
      [donVi.donVi.id],
      [donVi.diaDanhXa.id, donVi.diaDanhTinh.id],
    );
    await prisma.$disconnect();
    await app.close();
  });

  it('GET công khai (không token) khi chưa lưu -> cau_hinh null', async () => {
    const res = await request(app.getHttpServer())
      .get('/cau-hinh-khao-sat')
      .expect(200);
    expect(res.body).toEqual({ cau_hinh: null, cap_nhat_luc: null });
  });

  it('PUT không token -> 401', async () => {
    await request(app.getHttpServer())
      .put('/cau-hinh-khao-sat')
      .send(hopLe)
      .expect(401);
  });

  it('PUT bởi truong (không phải quan_tri) -> 403', async () => {
    await request(app.getHttpServer())
      .put('/cau-hinh-khao-sat')
      .set('Authorization', `Bearer ${tokenTruong}`)
      .send(hopLe)
      .expect(403);
  });

  it('PUT url không phải http(s) -> 400', async () => {
    const sai = structuredClone(hopLe);
    sai.phieu[0].lien_ket[0].url = 'javascript:alert(1)';
    await request(app.getHttpServer())
      .put('/cau-hinh-khao-sat')
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .send(sai)
      .expect(400);
  });

  it('PUT phiếu không có đường dẫn nào -> 400', async () => {
    const sai = structuredClone(hopLe);
    sai.phieu[0].lien_ket = [];
    await request(app.getHttpServer())
      .put('/cau-hinh-khao-sat')
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .send(sai)
      .expect(400);
  });

  it('PUT chế độ không hợp lệ -> 400', async () => {
    await request(app.getHttpServer())
      .put('/cau-hinh-khao-sat')
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .send({ ...hopLe, che_do_hoc_vien: 'abc' })
      .expect(400);
  });

  it('PUT khao_sat + tắt khối khảo sát -> 400 VALIDATION_ERROR', async () => {
    const res = await request(app.getHttpServer())
      .put('/cau-hinh-khao-sat')
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .send({ ...hopLe, hien_khao_sat: false })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('PUT hợp lệ bởi quan_tri -> lưu; GET công khai trả đúng (giữ thứ tự, url rỗng cho phép)', async () => {
    await request(app.getHttpServer())
      .put('/cau-hinh-khao-sat')
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .send(hopLe)
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/cau-hinh-khao-sat')
      .expect(200);
    expect(res.body.cau_hinh).toEqual(hopLe);
    expect(res.body.cap_nhat_luc).toEqual(expect.any(String));

    const row = await prisma.cau_hinh_he_thong.findUnique({
      where: { khoa: KHOA },
    });
    expect(row?.cap_nhat_boi).toBe(quanTri.nguoiDung.id);
  });

  it('PUT lần 2 ghi đè toàn bộ (chuyển sang dang_nhap, bỏ phiếu)', async () => {
    const moi = {
      che_do_hoc_vien: 'dang_nhap',
      danh_gia_dau_vao_trong_cong: true,
      hien_khao_sat: false,
      kenh_danh_gia: 'sso',
      phieu: [],
    };
    await request(app.getHttpServer())
      .put('/cau-hinh-khao-sat')
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .send(moi)
      .expect(200);
    const res = await request(app.getHttpServer())
      .get('/cau-hinh-khao-sat')
      .expect(200);
    expect(res.body.cau_hinh).toEqual(moi);
  });
});
