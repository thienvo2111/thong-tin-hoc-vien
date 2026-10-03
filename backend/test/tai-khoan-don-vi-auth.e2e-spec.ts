import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoDonViTest,
  uniqueSuffix,
  xoaDonViTest,
} from './utils/test-data';
import { AuthService } from '../src/auth/auth.service';
import { ThongBaoService } from '../src/thong-bao/thong-bao.service';
import { hashTokenXacThuc } from '../src/common/utils/token-xac-thuc.util';

// Tài khoản đơn vị (ADR 0002) — phần auth: đăng nhập không phân biệt hoa/
// thường, token gắn nguoi_dung_id, quên/đặt lại mật khẩu, email kích hoạt.
describe('Tài khoản đơn vị — auth (e2e)', () => {
  let app: INestApplication;
  let authService: AuthService;
  let thongBaoService: ThongBaoService;
  let donVi: Awaited<ReturnType<typeof taoDonViTest>>;
  const suf = uniqueSuffix();
  const MAT_KHAU = 'MatKhauDonVi123';
  let tkCoEmail: { id: string; ten_dang_nhap: string; email: string };
  let tkKhongEmail: { id: string; ten_dang_nhap: string };

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    authService = app.get(AuthService);
    thongBaoService = app.get(ThongBaoService);
    donVi = await taoDonViTest('tkdvauth');
    const hash = await bcrypt.hash(MAT_KHAU, 4);
    const a = await prisma.nguoi_dung.create({
      data: {
        ho_ten: 'Người phụ trách A',
        ten_dang_nhap: `tk-a-${suf}`,
        email: `tk-a-${suf}@test.local`,
        vai_tro: 'truong',
        don_vi_id: donVi.donVi.id,
        mat_khau_hash: hash,
        phai_doi_mat_khau: true,
      },
    });
    tkCoEmail = { id: a.id, ten_dang_nhap: a.ten_dang_nhap, email: a.email! };
    // Đơn vị thứ 2 (con của đơn vị test) cho tài khoản không email — 1 TK/đơn vị.
    const dv2 = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-tkdvauth2-${suf}`,
        ten_don_vi: `Trường thứ hai ${suf}`,
        loai_don_vi: 'truong',
        dia_ban_id: donVi.diaDanhXa.id,
      },
    });
    const b = await prisma.nguoi_dung.create({
      data: {
        ho_ten: 'Người phụ trách B',
        ten_dang_nhap: `tk-b-${suf}`,
        vai_tro: 'truong',
        don_vi_id: dv2.id,
        mat_khau_hash: hash,
        phai_doi_mat_khau: true,
      },
    });
    tkKhongEmail = { id: b.id, ten_dang_nhap: b.ten_dang_nhap };
  });

  afterAll(async () => {
    await prisma.token_xac_thuc.deleteMany({
      where: { nguoi_dung_id: { in: [tkCoEmail.id, tkKhongEmail.id] } },
    });
    await prisma.hang_doi_email.deleteMany({
      where: { email_nguoi_nhan: tkCoEmail.email },
    });
    await prisma.nhat_ky_thong_bao.deleteMany({
      where: { email_nguoi_nhan: tkCoEmail.email },
    });
    await prisma.token_thu_hoi.deleteMany({
      where: { nguoi_dung_id: { in: [tkCoEmail.id, tkKhongEmail.id] } },
    });
    await prisma.nguoi_dung.deleteMany({
      where: { id: { in: [tkCoEmail.id, tkKhongEmail.id] } },
    });
    await prisma.don_vi_cong_tac.deleteMany({
      where: { ma_don_vi: `DV-tkdvauth2-${suf}` },
    });
    await xoaDonViTest(
      [donVi.donVi.id],
      [donVi.diaDanhXa.id, donVi.diaDanhTinh.id],
    );
    await prisma.$disconnect();
    await app.close();
  });

  const dangNhap = (ten: string, mk: string) =>
    request(app.getHttpServer())
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap: ten, mat_khau: mk });

  describe('Đăng nhập không phân biệt hoa/thường cho tài khoản đơn vị', () => {
    it('gõ chữ hoa vẫn khớp tên đăng nhập lưu chữ thường', async () => {
      const res = await dangNhap(tkCoEmail.ten_dang_nhap.toUpperCase(), MAT_KHAU);
      expect(res.status).toBe(200);
      expect(res.body.nguoi_dung.id).toBe(tkCoEmail.id);
    });

    it('sai mật khẩu vẫn bị từ chối', async () => {
      const res = await dangNhap(tkCoEmail.ten_dang_nhap.toUpperCase(), 'SaiMatKhau999');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /auth/quen-mat-khau', () => {
    it('tài khoản đơn vị có email -> da_gui, tạo token dat_lai_mat_khau gắn nguoi_dung_id', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/quen-mat-khau')
        .send({ ten_dang_nhap: tkCoEmail.ten_dang_nhap });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ da_gui: true });
      const tokens = await prisma.token_xac_thuc.findMany({
        where: { nguoi_dung_id: tkCoEmail.id, loai: 'dat_lai_mat_khau' },
      });
      expect(tokens).toHaveLength(1);
      expect(tokens[0].hoc_vien_id).toBeNull();
    });

    it('tài khoản đơn vị không email -> vẫn da_gui, không tạo token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/quen-mat-khau')
        .send({ ten_dang_nhap: tkKhongEmail.ten_dang_nhap });
      expect(res.body).toEqual({ da_gui: true });
      expect(
        await prisma.token_xac_thuc.count({
          where: { nguoi_dung_id: tkKhongEmail.id },
        }),
      ).toBe(0);
    });
  });

  describe('Token kich_hoat_tai_khoan + POST /auth/dat-lai-mat-khau', () => {
    it('đặt được mật khẩu, phai_doi_mat_khau=false, đăng nhập bằng mật khẩu mới; dùng lại -> 400', async () => {
      const token = await authService.taoTokenChoNguoiDung(
        tkKhongEmail.id,
        'kich_hoat_tai_khoan',
      );
      const row = await prisma.token_xac_thuc.findUnique({
        where: { token_hash: hashTokenXacThuc(token) },
      });
      const conLaiMs = row!.het_han_luc.getTime() - Date.now();
      expect(conLaiMs).toBeGreaterThan(71 * 60 * 60 * 1000);
      expect(conLaiMs).toBeLessThanOrEqual(72 * 60 * 60 * 1000);

      const res = await request(app.getHttpServer())
        .post('/auth/dat-lai-mat-khau')
        .send({ token, mat_khau_moi: 'KichHoatMoi456' });
      expect(res.status).toBe(200);
      const nd = await prisma.nguoi_dung.findUnique({ where: { id: tkKhongEmail.id } });
      expect(nd!.phai_doi_mat_khau).toBe(false);
      expect((await dangNhap(tkKhongEmail.ten_dang_nhap, 'KichHoatMoi456')).status).toBe(200);

      const lai = await request(app.getHttpServer())
        .post('/auth/dat-lai-mat-khau')
        .send({ token, mat_khau_moi: 'KhacNua789' });
      expect(lai.status).toBe(400);
      expect(lai.body.error.message).toBe('Liên kết không hợp lệ hoặc đã hết hạn');
    });

    it('token hết hạn -> 400', async () => {
      const token = await authService.taoTokenChoNguoiDung(
        tkKhongEmail.id,
        'kich_hoat_tai_khoan',
      );
      await prisma.token_xac_thuc.update({
        where: { token_hash: hashTokenXacThuc(token) },
        data: { het_han_luc: new Date(Date.now() - 1000) },
      });
      const res = await request(app.getHttpServer())
        .post('/auth/dat-lai-mat-khau')
        .send({ token, mat_khau_moi: 'HetHan12345' });
      expect(res.status).toBe(400);
    });

    it('tạo token mới vô hiệu token cũ chưa dùng cùng loại', async () => {
      const cu = await authService.taoTokenChoNguoiDung(tkKhongEmail.id, 'kich_hoat_tai_khoan');
      await authService.taoTokenChoNguoiDung(tkKhongEmail.id, 'kich_hoat_tai_khoan');
      const res = await request(app.getHttpServer())
        .post('/auth/dat-lai-mat-khau')
        .send({ token: cu, mat_khau_moi: 'TokenCu12345' });
      expect(res.status).toBe(400);
    });

    it('voHieuTokenNguoiDung vô hiệu mọi token chưa dùng', async () => {
      const t = await authService.taoTokenChoNguoiDung(tkKhongEmail.id, 'dat_lai_mat_khau');
      await authService.voHieuTokenNguoiDung(tkKhongEmail.id);
      const res = await request(app.getHttpServer())
        .post('/auth/dat-lai-mat-khau')
        .send({ token: t, mat_khau_moi: 'VoHieu12345' });
      expect(res.status).toBe(400);
    });
  });

  describe('ThongBaoService.guiKichHoatTaiKhoan', () => {
    it('xếp 1 email vào hàng đợi với tiêu đề [HCMUE-BDNLS] Kích hoạt tài khoản', async () => {
      await thongBaoService.guiKichHoatTaiKhoan({
        email: tkCoEmail.email,
        hoTen: 'Người phụ trách A',
        tenDonVi: donVi.donVi.ten_don_vi,
        tenDangNhap: tkCoEmail.ten_dang_nhap,
        link: 'http://localhost:5173/dat-lai-mat-khau?token=abc',
      });
      const rows = await prisma.hang_doi_email.findMany({
        where: { email_nguoi_nhan: tkCoEmail.email, loai_su_kien: 'kich_hoat_tai_khoan' },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].tieu_de).toBe('[HCMUE-BDNLS] Kích hoạt tài khoản');
      expect(rows[0].hoc_vien_id).toBeNull();
      expect(rows[0].noi_dung_html).toContain(tkCoEmail.ten_dang_nhap);
      expect(rows[0].noi_dung_html).toContain('72 giờ');
    });
  });
});
