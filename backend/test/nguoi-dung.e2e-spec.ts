import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoDonViTest,
  taoNguoiDungTest,
  uniqueSuffix,
  xoaDonViTest,
  xoaNguoiDungTest,
} from './utils/test-data';

const NAM_HOP_LE = new Date().getUTCFullYear() - 20;

function ddmmyyyy(ngay: number, thang: number, nam: number): string {
  return `${String(ngay).padStart(2, '0')}${String(thang).padStart(2, '0')}${nam}`;
}

// T1 (mo-rong-nls-an-giang.md): POST /nguoi-dung/{id}/dat-lai-mat-khau +
// GET /nguoi-dung?q= — quy trình hỗ trợ N4.
describe('Quản lý tài khoản — dat-lai-mat-khau / tim-kiem (T1, e2e)', () => {
  let app: INestApplication;
  let donVi: Awaited<ReturnType<typeof taoDonViTest>>;
  let quanTri: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let truongAccount: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let tokenQuanTri: string;
  let tokenTruong: string;

  const hocVienIds: string[] = [];
  const nguoiDungHocVienIds: string[] = [];

  async function dangNhap(ten_dang_nhap: string, mat_khau: string) {
    const res = await request(app.getHttpServer())
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap, mat_khau })
      .expect(200);
    return res.body.token as string;
  }

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    donVi = await taoDonViTest('nd');
    quanTri = await taoNguoiDungTest({
      vai_tro: 'quan_tri',
      don_vi_id: donVi.donVi.id,
      mat_khau: 'MatKhau123',
    });
    truongAccount = await taoNguoiDungTest({
      vai_tro: 'truong',
      don_vi_id: donVi.donVi.id,
      mat_khau: 'MatKhau123',
    });
    tokenQuanTri = await dangNhap(quanTri.ten_dang_nhap, quanTri.mat_khau);
    tokenTruong = await dangNhap(
      truongAccount.ten_dang_nhap,
      truongAccount.mat_khau,
    );
  });

  afterAll(async () => {
    await prisma.nhat_ky_dat_lai_mat_khau.deleteMany({
      where: { nguoi_dung_id: { in: nguoiDungHocVienIds } },
    });
    if (hocVienIds.length > 0) {
      // hoc_vien.created_by -> nguoi_dung(id) (onDelete: NoAction) — gỡ
      // trước khi xóa nguoi_dung, cùng gotcha đã ghi trong các file e2e khác.
      await prisma.hoc_vien.updateMany({
        where: { id: { in: hocVienIds } },
        data: { created_by: null },
      });
      await prisma.nguoi_dung.deleteMany({
        where: { id: { in: nguoiDungHocVienIds } },
      });
      await prisma.hoc_vien.deleteMany({ where: { id: { in: hocVienIds } } });
    }
    await xoaNguoiDungTest(quanTri.nguoiDung.id);
    await xoaNguoiDungTest(truongAccount.nguoiDung.id);
    await xoaDonViTest(
      [donVi.donVi.id],
      [donVi.diaDanhXa.id, donVi.diaDanhTinh.id],
    );
    await prisma.$disconnect();
    await app.close();
  });

  describe('POST /nguoi-dung/{id}/dat-lai-mat-khau', () => {
    it('không phải quan_tri -> 403', async () => {
      await request(app.getHttpServer())
        .post(`/nguoi-dung/${truongAccount.nguoiDung.id}/dat-lai-mat-khau`)
        .set('Authorization', `Bearer ${tokenTruong}`)
        .expect(403);
    });

    it('tài khoản không phải hoc_vien -> 400 VALIDATION_ERROR', async () => {
      await request(app.getHttpServer())
        .post(`/nguoi-dung/${truongAccount.nguoiDung.id}/dat-lai-mat-khau`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(400);
    });

    it('không tồn tại -> 404', async () => {
      await request(app.getHttpServer())
        .post(
          '/nguoi-dung/00000000-0000-0000-0000-000000000000/dat-lai-mat-khau',
        )
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(404);
    });

    it('tài khoản hoc_vien đang khóa + đổi mật khẩu khác -> đặt lại về ngày sinh, mở khóa ngay, đăng nhập lại được', async () => {
      const suf = uniqueSuffix();
      const NGAY = 20;
      const THANG = 11;
      const hocVien = await prisma.hoc_vien.create({
        data: {
          nguon_tao: 'tu_dang_ky',
          so_dinh_danh_ca_nhan: `9${Date.now().toString().slice(-11)}`,
          ho_ten: 'Ho So Dat Lai Mat Khau',
          ngay_sinh: NGAY,
          thang_sinh: THANG,
          nam_sinh: NAM_HOP_LE,
          don_vi_cong_tac_id: donVi.donVi.id,
          so_dien_thoai_lien_he: '0900000002',
        },
      });
      const nguoiDung = await prisma.nguoi_dung.create({
        data: {
          ho_ten: 'Ho So Dat Lai Mat Khau',
          ten_dang_nhap: `DLMK-${suf}`,
          vai_tro: 'hoc_vien',
          hoc_vien_id: hocVien.id,
          // Mật khẩu KHÁC ngày sinh + đang bị khóa — xác nhận endpoint reset
          // cả 2 thứ, không chỉ đổi hash.
          mat_khau_hash: await bcrypt.hash('MatKhauKhac999', 4),
          phai_doi_mat_khau: false,
          so_lan_dang_nhap_sai: 5,
          khoa_den: new Date(Date.now() + 10 * 60 * 1000),
        },
      });
      await prisma.hoc_vien.update({
        where: { id: hocVien.id },
        data: { created_by: nguoiDung.id },
      });
      hocVienIds.push(hocVien.id);
      nguoiDungHocVienIds.push(nguoiDung.id);

      const res = await request(app.getHttpServer())
        .post(`/nguoi-dung/${nguoiDung.id}/dat-lai-mat-khau`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(res.body.nguoi_dung).not.toHaveProperty('mat_khau_hash');

      const sau = await prisma.nguoi_dung.findUniqueOrThrow({
        where: { id: nguoiDung.id },
      });
      expect(sau.phai_doi_mat_khau).toBe(true);
      expect(sau.khoa_den).toBeNull();
      expect(sau.so_lan_dang_nhap_sai).toBe(0);

      const ghiNhatKy = await prisma.nhat_ky_dat_lai_mat_khau.findFirst({
        where: { nguoi_dung_id: nguoiDung.id },
      });
      expect(ghiNhatKy).not.toBeNull();
      expect(ghiNhatKy!.thuc_hien_boi).toBe(quanTri.nguoiDung.id);

      // Đăng nhập lại được ngay (không còn khóa) bằng mật khẩu mới = ngày sinh.
      await request(app.getHttpServer())
        .post('/auth/dang-nhap')
        .send({
          ten_dang_nhap: `DLMK-${suf}`,
          mat_khau: ddmmyyyy(NGAY, THANG, NAM_HOP_LE),
        })
        .expect(200);
    });
  });

  describe('GET /nguoi-dung?q=', () => {
    it('không phải quan_tri -> 403', async () => {
      await request(app.getHttpServer())
        .get(`/nguoi-dung?q=${truongAccount.ten_dang_nhap}`)
        .set('Authorization', `Bearer ${tokenTruong}`)
        .expect(403);
    });

    it('tìm theo ten_dang_nhap -> thấy đúng tài khoản, không lộ mat_khau_hash', async () => {
      const res = await request(app.getHttpServer())
        .get(`/nguoi-dung?q=${truongAccount.ten_dang_nhap}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(
        res.body.data.some(
          (nd: { id: string }) => nd.id === truongAccount.nguoiDung.id,
        ),
      ).toBe(true);
      expect(res.body.data[0]).not.toHaveProperty('mat_khau_hash');
    });

    it('tìm theo SĐT của hồ sơ học viên liên kết -> thấy đúng tài khoản', async () => {
      const res = await request(app.getHttpServer())
        .get('/nguoi-dung?q=0900000002')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(
        res.body.data.some(
          (nd: { id: string }) => nd.id === nguoiDungHocVienIds[0],
        ),
      ).toBe(true);
    });

    it('thiếu q -> 400', async () => {
      await request(app.getHttpServer())
        .get('/nguoi-dung')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(400);
    });
  });
});
