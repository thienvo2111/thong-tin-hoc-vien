import { INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
const KHOA_CAU_HINH = 'khao_sat_dau_vao';
const API_KEY = 'khoa-e2e-sso-khao-sat';

function ddmmyyyy(ngay: number, thang: number, nam: number): string {
  return `${String(ngay).padStart(2, '0')}${String(thang).padStart(2, '0')}${nam}`;
}

// SSO sang hệ thống khảo sát (2026-10-02, api-contract.md mục 10) — chạy thật
// qua HTTP: guard JWT/Roles, @Public + X-API-Key, mã dùng 1 lần trên DB thật.
describe('SSO sang hệ thống khảo sát (e2e)', () => {
  let app: INestApplication;
  let donViFixture: Awaited<ReturnType<typeof taoDonViTest>>;
  let quanTri: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let tokenQuanTri: string;
  let banGocCauHinh: Awaited<
    ReturnType<typeof prisma.cau_hinh_he_thong.findUnique>
  >;
  const envGoc = { ...process.env };

  const hocVienIds: string[] = [];
  const nguoiDungHocVienIds: string[] = [];

  async function dangNhap(ten_dang_nhap: string, mat_khau: string) {
    const res = await request(app.getHttpServer())
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap, mat_khau })
      .expect(200);
    return res.body.token as string;
  }

  async function datKenh(kenh: 'sso' | 'vle') {
    await request(app.getHttpServer())
      .put('/cau-hinh-khao-sat')
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .send({
        che_do_hoc_vien: 'dang_nhap',
        danh_gia_dau_vao_trong_cong: true,
        hien_khao_sat: false,
        kenh_danh_gia: kenh,
        phieu: [],
      })
      .expect(200);
  }

  // coDangNhap=false cho test không cần token học viên — POST /auth/dang-nhap
  // bị giới hạn 10 lần/phút/IP (T1), file này tạo nhiều học viên liên tiếp.
  async function taoHocVien(
    doiTuong: 'giao_vien' | 'can_bo_quan_ly' | null,
    coDangNhap = true,
  ) {
    const suf = uniqueSuffix();
    const tenDangNhap = `MOET-SSO-${suf}`;
    const hocVien = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: tenDangNhap,
        so_dinh_danh_ca_nhan: `${Date.now()}${suf}`
          .replace(/\D/g, '')
          .padStart(12, '1')
          .slice(-12),
        ho_ten: 'Học Viên Sso',
        email_lien_he: `sso-${suf}@test.local`,
        ngay_sinh: 15,
        thang_sinh: 6,
        nam_sinh: NAM_HOP_LE,
        trinh_do_chuyen_mon: 'dai_hoc',
        don_vi_cong_tac_id: donViFixture.donVi.id,
        so_dien_thoai_lien_he: '0900000000',
        doi_tuong: doiTuong,
        trang_thai: 'da_duyet',
        nguoi_duyet_id: quanTri.nguoiDung.id,
        cap_duyet_thuc_te: 'quan_tri',
        ngay_duyet: new Date(),
        chuyen_mon: { create: [{ chuyen_mon: 'CNTT' }] },
      },
    });
    const nguoiDung = await prisma.nguoi_dung.create({
      data: {
        ho_ten: hocVien.ho_ten,
        ten_dang_nhap: tenDangNhap,
        vai_tro: 'hoc_vien',
        hoc_vien_id: hocVien.id,
        mat_khau_hash: await bcrypt.hash(ddmmyyyy(15, 6, NAM_HOP_LE), 4),
        phai_doi_mat_khau: false,
      },
    });
    hocVienIds.push(hocVien.id);
    nguoiDungHocVienIds.push(nguoiDung.id);
    const token = coDangNhap
      ? await dangNhap(tenDangNhap, ddmmyyyy(15, 6, NAM_HOP_LE))
      : '';
    return { hocVien, token, tenDangNhap };
  }

  function capMa(token: string, target?: string) {
    return request(app.getHttpServer())
      .post('/sso/cap-ma')
      .set('Authorization', `Bearer ${token}`)
      .send(target ? { target } : {});
  }

  function doiMa(code: string, key: string | null = API_KEY) {
    const req = request(app.getHttpServer()).post('/sso/doi-ma').send({ code });
    return key === null ? req : req.set('X-API-Key', key);
  }

  beforeAll(async () => {
    process.env.SSO_KHAO_SAT_API_KEY = API_KEY;
    process.env.SSO_KHAO_SAT_URL = 'https://khaosat.test/sso/start';
    app = await createTestApp();
    banGocCauHinh = await prisma.cau_hinh_he_thong.findUnique({
      where: { khoa: KHOA_CAU_HINH },
    });
    donViFixture = await taoDonViTest('sso');
    quanTri = await taoNguoiDungTest({
      vai_tro: 'quan_tri',
      don_vi_id: donViFixture.donVi.id,
      mat_khau: 'MatKhau123',
    });
    tokenQuanTri = await dangNhap(quanTri.ten_dang_nhap, 'MatKhau123');
    await datKenh('sso');
  });

  afterAll(async () => {
    process.env = { ...envGoc };
    await prisma.cau_hinh_he_thong.deleteMany({
      where: { khoa: KHOA_CAU_HINH },
    });
    if (banGocCauHinh) {
      await prisma.cau_hinh_he_thong.create({
        data: {
          ...banGocCauHinh,
          gia_tri: banGocCauHinh.gia_tri as Prisma.InputJsonValue,
        },
      });
    }
    await prisma.ma_sso_mot_lan.deleteMany({
      where: { hoc_vien_id: { in: hocVienIds } },
    });
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
    await prisma.lich_su_thay_doi_ho_so.deleteMany({
      where: { hoc_vien_id: { in: hocVienIds } },
    });
    await prisma.hang_doi_email.deleteMany({
      where: { hoc_vien_id: { in: hocVienIds } },
    });
    await prisma.nhat_ky_thong_bao.deleteMany({
      where: { hoc_vien_id: { in: hocVienIds } },
    });
    await prisma.hoc_vien.deleteMany({ where: { id: { in: hocVienIds } } });
    await xoaNguoiDungTest(quanTri.nguoiDung.id);
    await xoaDonViTest(
      [donViFixture.donVi.id],
      [donViFixture.diaDanhXa.id, donViFixture.diaDanhTinh.id],
    );
    await prisma.$disconnect();
    await app.close();
  });

  it('khứ hồi: hồ sơ đầy đủ -> cấp mã -> đổi mã lấy đúng thông tin -> đổi lần 2 bị từ chối', async () => {
    const { hocVien, tenDangNhap, token } = await taoHocVien('can_bo_quan_ly');

    const dk = await request(app.getHttpServer())
      .get('/hoc-vien/toi/danh-gia-dau-vao')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(dk.body).toEqual({ kenh: 'sso', du_dieu_kien: true });

    const cap = await capMa(token, 'danh-gia').expect(201);
    const url = new URL(cap.body.url);
    expect(url.origin + url.pathname).toBe('https://khaosat.test/sso/start');
    expect(url.searchParams.get('target')).toBe('danh-gia');
    const code = url.searchParams.get('code')!;
    expect(cap.body.url).not.toContain(hocVien.so_dinh_danh_ca_nhan!);

    const row = await prisma.ma_sso_mot_lan.findFirst({
      where: { hoc_vien_id: hocVien.id },
    });
    expect(row?.ma_hash).not.toBe(code);

    const doi = await doiMa(code).expect(200);
    expect(doi.body).toMatchObject({
      hoc_vien_id: hocVien.id,
      ho_ten: 'Học Viên Sso',
      ma_dinh_danh_moet: tenDangNhap,
      vai_tro: 'can_bo_quan_ly',
      ma_don_vi: donViFixture.donVi.ma_don_vi,
      target: 'danh-gia',
      lop: [],
    });
    expect(JSON.stringify(doi.body)).not.toContain(
      hocVien.so_dinh_danh_ca_nhan!,
    );

    const lan2 = await doiMa(code).expect(400);
    expect(lan2.body.error.code).toBe('SSO_MA_KHONG_HOP_LE');
  });

  it('mã hết hạn -> 400', async () => {
    const { hocVien, token } = await taoHocVien('giao_vien');
    const cap = await capMa(token).expect(201);
    const code = new URL(cap.body.url).searchParams.get('code')!;
    await prisma.ma_sso_mot_lan.updateMany({
      where: { hoc_vien_id: hocVien.id },
      data: { het_han: new Date(Date.now() - 1000) },
    });
    await doiMa(code).expect(400);
  });

  it('doi-ma không có / sai X-API-Key -> 401 (route công khai nhưng bắt buộc khóa)', async () => {
    const { token } = await taoHocVien('giao_vien');
    const code = new URL(
      (await capMa(token).expect(201)).body.url,
    ).searchParams.get('code')!;
    await doiMa(code, null).expect(401);
    await doiMa(code, 'khoa-sai').expect(401);
    // Mã chưa bị "đốt" bởi các lần gọi sai khóa — vẫn đổi được bằng khóa đúng.
    await doiMa(code).expect(200);
  });

  it('chưa chọn đối tượng -> chưa đủ điều kiện, cap-ma 403', async () => {
    const { token } = await taoHocVien(null);
    const dk = await request(app.getHttpServer())
      .get('/hoc-vien/toi/danh-gia-dau-vao')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(dk.body.du_dieu_kien).toBe(false);
    expect(dk.body.ly_do).toContain(
      'Chưa chọn đối tượng (giáo viên, cán bộ quản lý hoặc nhân viên)',
    );
    await capMa(token).expect(403);
  });

  it('học viên tự chọn đối tượng qua PATCH bị chặn ngoài đợt (import_moet) — admin vẫn sửa được', async () => {
    const { hocVien, token } = await taoHocVien(null);
    await request(app.getHttpServer())
      .patch('/hoc-vien/toi')
      .set('Authorization', `Bearer ${token}`)
      .send({ doi_tuong: 'giao_vien' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/hoc-vien/${hocVien.id}`)
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .send({ doi_tuong: 'giao_vien' })
      .expect(200);
    const sau = await prisma.hoc_vien.findUnique({ where: { id: hocVien.id } });
    expect(sau?.doi_tuong).toBe('giao_vien');
  });

  it('doi_tuong không hợp lệ -> 400', async () => {
    const { hocVien } = await taoHocVien(null, false);
    await request(app.getHttpServer())
      .patch(`/hoc-vien/${hocVien.id}`)
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .send({ doi_tuong: 'hieu_truong' })
      .expect(400);
  });

  it('target không hợp lệ -> 400; cap-ma bởi quan_tri -> 403; không token -> 401', async () => {
    const { token } = await taoHocVien('giao_vien');
    await capMa(token, 'abc').expect(400);
    await capMa(tokenQuanTri).expect(403);
    await request(app.getHttpServer()).post('/sso/cap-ma').send({}).expect(401);
  });

  it('kênh vle -> giữ luồng cũ, cap-ma 403', async () => {
    await datKenh('vle');
    try {
      const { token } = await taoHocVien('giao_vien');
      const dk = await request(app.getHttpServer())
        .get('/hoc-vien/toi/danh-gia-dau-vao')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(dk.body.kenh).toBe('vle');
      await capMa(token).expect(403);
    } finally {
      await datKenh('sso');
    }
  });

  describe('POST /sso/ma-thu (quản trị thử tích hợp)', () => {
    it('quản trị tạo mã thử cho học viên (kể cả hồ sơ CHƯA đầy đủ) -> đổi được qua /sso/doi-ma', async () => {
      const { hocVien, tenDangNhap } = await taoHocVien(null, false);
      const res = await request(app.getHttpServer())
        .post('/sso/ma-thu')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({ ma_dinh_danh_moet: tenDangNhap, target: 'khao-sat' })
        .expect(201);
      expect(res.body.hoc_vien).toMatchObject({
        id: hocVien.id,
        ma_dinh_danh_moet: tenDangNhap,
      });
      expect(new URL(res.body.url).searchParams.get('code')).toBe(
        res.body.code,
      );

      const doi = await doiMa(res.body.code).expect(200);
      expect(doi.body).toMatchObject({
        hoc_vien_id: hocVien.id,
        ho_ten: 'Học Viên Sso',
        vai_tro: null,
        target: 'khao-sat',
      });
    });

    it('mã MOET không tồn tại -> 404; học viên gọi -> 403; không token -> 401', async () => {
      const { token } = await taoHocVien('giao_vien');
      await request(app.getHttpServer())
        .post('/sso/ma-thu')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({ ma_dinh_danh_moet: 'KHONG-TON-TAI' })
        .expect(404);
      await request(app.getHttpServer())
        .post('/sso/ma-thu')
        .set('Authorization', `Bearer ${token}`)
        .send({ ma_dinh_danh_moet: 'x' })
        .expect(403);
      await request(app.getHttpServer())
        .post('/sso/ma-thu')
        .send({ ma_dinh_danh_moet: 'x' })
        .expect(401);
    });
  });
});
