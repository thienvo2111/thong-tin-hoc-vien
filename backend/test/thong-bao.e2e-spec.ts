import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoNguoiDungTest,
  uniqueSuffix,
  xoaNguoiDungTest,
  xoaDonViTest,
} from './utils/test-data';
import { resetMailTransporterForTest } from '../src/thong-bao/util/mailer.util';

const NAM_HOP_LE = new Date().getUTCFullYear() - 20;

function soDinhDanhNgauNhien(): string {
  const t = Date.now().toString().slice(-6);
  const r = Math.floor(100000 + Math.random() * 899999).toString();
  return `${t}${r}`;
}

function ddmmyyyy(ngay: number, thang: number, nam: number): string {
  return `${String(ngay).padStart(2, '0')}${String(thang).padStart(2, '0')}${nam}`;
}

// Dịch vụ Thông báo — docs/api-contract.md mục 8. Test này CỐ Ý gửi email
// thật qua Ethereal (không mock nodemailer) cho ít nhất 1 luồng, để xác minh
// đường gửi/nhận thật hoạt động — không chỉ kiểm tra có dòng nhat_ky_thong_bao
// (yêu cầu rõ trong lượt triển khai này). Các luồng còn lại chỉ kiểm tra
// nhat_ky_thong_bao vì đã có 1 luồng xác minh gửi/nhận thật rồi, tránh gọi
// mạng thật lặp lại không cần thiết.
describe('Dịch vụ Thông báo (e2e)', () => {
  let app: INestApplication;

  let tinh: { id: string };
  let xaTruong: { id: string };
  let xaSo: { id: string };
  let soGddt: { id: string };
  let truong: { id: string };

  let quanTri: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let soAccount: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let truongAccount: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let tokenQuanTri: string;
  let tokenSo: string;

  const hocVienIds: string[] = [];
  const nguoiDungHocVienIds: string[] = [];
  const khoaIds: string[] = [];

  async function dangNhap(ten_dang_nhap: string, mat_khau: string) {
    const res = await request(app.getHttpServer())
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap, mat_khau })
      .expect(200);
    return res.body.token as string;
  }

  function baseDangKyBody(overrides: Record<string, unknown> = {}) {
    const suf = uniqueSuffix();
    return {
      ho_ten: 'Trần Thị Thông Báo',
      so_dinh_danh_ca_nhan: soDinhDanhNgauNhien(),
      ngay_sinh: 10,
      thang_sinh: 3,
      nam_sinh: NAM_HOP_LE,
      noi_sinh_id: tinh.id,
      phuong_xa_id: xaTruong.id,
      don_vi_cong_tac_id: truong.id,
      so_dien_thoai_lien_he: '0911111111',
      email_lien_he: `tb-${suf}@test.local`,
      trinh_do_chuyen_mon: 'dai_hoc',
      chuyen_mon: ['Sư phạm Văn'],
      ...overrides,
    };
  }

  async function dangKyVaXacNhan(overrides: Record<string, unknown> = {}) {
    const body = baseDangKyBody(overrides);
    const res = await request(app.getHttpServer())
      .post('/hoc-vien')
      .send(body)
      .expect(201);
    const hocVienId = res.body.hoc_vien_id as string;
    hocVienIds.push(hocVienId);
    const nd = await prisma.nguoi_dung.findUnique({
      where: { ten_dang_nhap: body.so_dinh_danh_ca_nhan },
    });
    if (nd) nguoiDungHocVienIds.push(nd.id);
    const token = await dangNhap(
      body.so_dinh_danh_ca_nhan,
      ddmmyyyy(body.ngay_sinh, body.thang_sinh, body.nam_sinh),
    );
    return { hocVienId, token, body };
  }

  beforeAll(async () => {
    app = await createTestApp();
    const suf = uniqueSuffix();

    tinh = await prisma.dia_danh.create({
      data: { ma: `T-tb-${suf}`, ten: `Tỉnh TB ${suf}`, cap: 'tinh_thanh' },
    });
    xaTruong = await prisma.dia_danh.create({
      data: {
        ma: `X-tb-truong-${suf}`,
        ten: `Xã Trường TB ${suf}`,
        cap: 'phuong_xa_dac_khu',
        parent_id: tinh.id,
      },
    });
    xaSo = await prisma.dia_danh.create({
      data: {
        ma: `X-tb-so-${suf}`,
        ten: `Xã Sở TB ${suf}`,
        cap: 'phuong_xa_dac_khu',
        parent_id: tinh.id,
      },
    });
    soGddt = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-so-tb-${suf}`,
        ten_don_vi: `Sở GD&ĐT TB ${suf}`,
        loai_don_vi: 'so_gddt',
        dia_ban_id: xaSo.id,
      },
    });
    truong = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-truong-tb-${suf}`,
        ten_don_vi: `Trường TB ${suf}`,
        loai_don_vi: 'truong',
        dia_ban_id: xaTruong.id,
        don_vi_cha_id: soGddt.id,
      },
    });

    quanTri = await taoNguoiDungTest({
      vai_tro: 'quan_tri',
      don_vi_id: truong.id,
      mat_khau: 'MatKhau123',
    });
    soAccount = await taoNguoiDungTest({
      vai_tro: 'so_gddt',
      don_vi_id: soGddt.id,
      mat_khau: 'MatKhau123',
    });
    truongAccount = await taoNguoiDungTest({
      vai_tro: 'truong',
      don_vi_id: truong.id,
      mat_khau: 'MatKhau123',
    });

    tokenQuanTri = await dangNhap(quanTri.ten_dang_nhap, 'MatKhau123');
    tokenSo = await dangNhap(soAccount.ten_dang_nhap, 'MatKhau123');
  });

  afterAll(async () => {
    await prisma.nhat_ky_thong_bao.deleteMany({
      where: {
        OR: [
          { hoc_vien_id: { in: hocVienIds } },
          { email_nguoi_nhan: truongAccount.ten_dang_nhap },
        ],
      },
    });
    await prisma.khoa_boi_duong.deleteMany({ where: { id: { in: khoaIds } } });
    if (hocVienIds.length > 0) {
      await prisma.hoc_vien.updateMany({
        where: { id: { in: hocVienIds } },
        data: {
          created_by: null,
          nguoi_duyet_id: null,
          cap_duyet_thuc_te: null,
          trang_thai: 'nhap',
        },
      });
      await prisma.nguoi_dung.deleteMany({
        where: { id: { in: nguoiDungHocVienIds } },
      });
      await prisma.hoc_vien.deleteMany({ where: { id: { in: hocVienIds } } });
    }
    await xoaNguoiDungTest(quanTri.nguoiDung.id);
    await xoaNguoiDungTest(soAccount.nguoiDung.id);
    await xoaNguoiDungTest(truongAccount.nguoiDung.id);
    await xoaDonViTest([truong.id, soGddt.id], [xaTruong.id, xaSo.id, tinh.id]);
    await prisma.$disconnect();
    await app.close();
  });

  describe('hoc_vien_xac_nhan — gửi thật qua Ethereal, xác minh nhận được', () => {
    it('POST /hoc-vien/toi/xac-nhan gửi email thật, preview URL Ethereal tải được và chứa đúng nội dung, ghi nhat_ky_thong_bao thanh_cong', async () => {
      const { hocVienId, token, body } = await dangKyVaXacNhan();

      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      try {
        const res = await request(app.getHttpServer())
          .post('/hoc-vien/toi/xac-nhan')
          .set('Authorization', `Bearer ${token}`)
          .expect(201);
        expect(res.body.trang_thai).toBe('cho_duyet');

        const previewUrl = logSpy.mock.calls
          .map((args) => String(args[0]))
          .map((line) => /https:\/\/ethereal\.email\/message\/\S+/.exec(line))
          .find((m): m is RegExpExecArray => m !== null)?.[0];
        expect(previewUrl).toBeDefined();

        // Đây chính là bước "fetch what was sent" — gọi thật tới Ethereal,
        // không phải giả lập, để xác minh nội dung email thực sự đã được
        // gửi/nhận (không chỉ transporter.sendMail() không throw).
        const previewRes = await fetch(previewUrl!);
        expect(previewRes.status).toBe(200);
        const previewHtml = await previewRes.text();
        expect(previewHtml).toContain(body.ho_ten);
      } finally {
        logSpy.mockRestore();
      }

      const thongBao = await prisma.nhat_ky_thong_bao.findMany({
        where: { hoc_vien_id: hocVienId, loai_su_kien: 'hoc_vien_xac_nhan' },
      });
      expect(thongBao).toHaveLength(1);
      expect(thongBao[0].trang_thai).toBe('thanh_cong');
      expect(thongBao[0].email_nguoi_nhan).toBe(body.email_lien_he);
    });
  });

  describe('hoc_vien_duyet — gửi thất bại KHÔNG được làm hỏng luồng duyệt hồ sơ', () => {
    it('SMTP lỗi (giả lập bằng SMTP_HOST không có ai lắng nghe) -> duyệt hồ sơ vẫn 201, ghi nhat_ky_thong_bao that_bai kèm lý do', async () => {
      const { hocVienId, token } = await dangKyVaXacNhan();
      await request(app.getHttpServer())
        .post('/hoc-vien/toi/xac-nhan')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      const oldHost = process.env.SMTP_HOST;
      const oldPort = process.env.SMTP_PORT;
      process.env.SMTP_HOST = '127.0.0.1';
      process.env.SMTP_PORT = '1'; // không có gì lắng nghe -> ECONNREFUSED nhanh
      resetMailTransporterForTest();

      try {
        const res = await request(app.getHttpServer())
          .post(`/hoc-vien/${hocVienId}/duyet`)
          .set('Authorization', `Bearer ${tokenSo}`)
          .send({ ket_qua: 'da_duyet' })
          .expect(201);
        // Khẳng định chính: nghiệp vụ duyệt hồ sơ THÀNH CÔNG dù email lỗi.
        expect(res.body.trang_thai).toBe('da_duyet');
      } finally {
        if (oldHost === undefined) delete process.env.SMTP_HOST;
        else process.env.SMTP_HOST = oldHost;
        if (oldPort === undefined) delete process.env.SMTP_PORT;
        else process.env.SMTP_PORT = oldPort;
        resetMailTransporterForTest();
      }

      const thongBao = await prisma.nhat_ky_thong_bao.findMany({
        where: { hoc_vien_id: hocVienId, loai_su_kien: 'hoc_vien_duyet' },
      });
      expect(thongBao).toHaveLength(1);
      expect(thongBao[0].trang_thai).toBe('that_bai');
      expect(thongBao[0].loi).toBeTruthy();
    });
  });

  describe('khoa_boi_duong_duyet — người nhận là tài khoản Trường, KHÔNG phải hoc_vien', () => {
    it('duyệt khóa -> ghi nhat_ky_thong_bao với hoc_vien_id=NULL, email_nguoi_nhan = tài khoản truong', async () => {
      const tokenTruong = await dangNhap(
        truongAccount.ten_dang_nhap,
        'MatKhau123',
      );
      const suf = uniqueSuffix();
      const khoa = await request(app.getHttpServer())
        .post('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenTruong}`)
        .send({
          ma_khoa: `K-TB-${suf}`,
          ten_khoa: `Khóa Thông Báo ${suf}`,
          thoi_gian_bat_dau: '2026-01-01',
          thoi_gian_ket_thuc: '2026-01-31',
        })
        .expect(201);
      khoaIds.push(khoa.body.id);

      await request(app.getHttpServer())
        .post(`/khoa-boi-duong/${khoa.body.id}/nop-duyet`)
        .set('Authorization', `Bearer ${tokenTruong}`)
        .expect(201);
      await request(app.getHttpServer())
        .post(`/khoa-boi-duong/${khoa.body.id}/duyet`)
        .set('Authorization', `Bearer ${tokenSo}`)
        .send({ ket_qua: 'da_duyet' })
        .expect(201);

      const thongBao = await prisma.nhat_ky_thong_bao.findMany({
        where: {
          loai_su_kien: 'khoa_boi_duong_duyet',
          email_nguoi_nhan: truongAccount.ten_dang_nhap,
        },
      });
      expect(thongBao).toHaveLength(1);
      expect(thongBao[0].hoc_vien_id).toBeNull();
      expect(thongBao[0].trang_thai).toBe('thanh_cong');
    });
  });

  describe('GET /thong-bao/lich-su', () => {
    it('không phải quan_tri -> 403', async () => {
      await request(app.getHttpServer())
        .get('/thong-bao/lich-su')
        .set('Authorization', `Bearer ${tokenSo}`)
        .expect(403);
    });

    it('quan_tri xem được, lọc theo hoc_vien_id', async () => {
      const { hocVienId, token } = await dangKyVaXacNhan();
      await request(app.getHttpServer())
        .post('/hoc-vien/toi/xac-nhan')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/thong-bao/lich-su?hoc_vien_id=${hocVienId}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(
        res.body.data.every(
          (r: { hoc_vien_id: string }) => r.hoc_vien_id === hocVienId,
        ),
      ).toBe(true);
    });

    it('lọc theo loai_su_kien', async () => {
      const res = await request(app.getHttpServer())
        .get('/thong-bao/lich-su?loai_su_kien=khoa_boi_duong_duyet')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(
        res.body.data.every(
          (r: { loai_su_kien: string }) =>
            r.loai_su_kien === 'khoa_boi_duong_duyet',
        ),
      ).toBe(true);
    });

    it('loai_su_kien không thuộc enum -> 400', async () => {
      await request(app.getHttpServer())
        .get('/thong-bao/lich-su?loai_su_kien=khong_hop_le')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(400);
    });
  });
});
