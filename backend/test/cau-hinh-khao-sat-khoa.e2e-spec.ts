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

const NAM = new Date().getUTCFullYear() - 20;
const KHOA_CHUNG = 'khao_sat_dau_vao';

// Cấu hình khảo sát theo khóa (2026-10-02): cấu hình chung làm mặc định, khóa
// có thể ghi đè; học viên đăng nhập -> khóa đã ghi danh; trang chủ -> tỉnh.
describe('Cấu hình khảo sát theo khóa (e2e)', () => {
  let app: INestApplication;
  let dv: Awaited<ReturnType<typeof taoDonViTest>>;
  let quanTri: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let tokenQt: string;
  let banGocChung: Awaited<
    ReturnType<typeof prisma.cau_hinh_he_thong.findUnique>
  >;
  const khoaIds: string[] = [];
  const hocVienIds: string[] = [];
  const nguoiDungIds: string[] = [];

  const cauHinh = (kenh: 'sso' | 'vle', ten = 'Phiếu') => ({
    che_do_hoc_vien: 'dang_nhap',
    danh_gia_dau_vao_trong_cong: true,
    hien_khao_sat: true,
    kenh_danh_gia: kenh,
    phieu: [{ ten, mo_ta: '', lien_ket: [{ nhan: 'Mở', url: '' }] }],
  });

  async function dangNhap(ten: string, mk: string) {
    const r = await request(app.getHttpServer())
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap: ten, mat_khau: mk })
      .expect(200);
    return r.body.token as string;
  }

  async function taoKhoa() {
    const k = await prisma.khoa_boi_duong.create({
      data: {
        ma_khoa: `K-chk-${uniqueSuffix()}`,
        ten_khoa: 'Khóa thử cấu hình',
        don_vi_to_chuc_id: dv.donVi.id,
        thoi_gian_bat_dau: new Date('2026-10-01'),
        thoi_gian_ket_thuc: new Date('2027-01-31'),
        trang_thai: 'da_duyet',
        ngay_duyet: new Date(),
      },
    });
    khoaIds.push(k.id);
    return k;
  }

  async function taoHocVien(khoaId?: string) {
    const suf = uniqueSuffix();
    const ten = `MOET-CHK-${suf}`;
    const hv = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: ten,
        so_dinh_danh_ca_nhan: `${Date.now()}${suf}`
          .replace(/\D/g, '')
          .padStart(12, '1')
          .slice(-12),
        ho_ten: 'Học Viên Cấu Hình',
        email_lien_he: `chk-${suf}@test.local`,
        ngay_sinh: 15,
        thang_sinh: 6,
        nam_sinh: NAM,
        trinh_do_chuyen_mon: 'dai_hoc',
        doi_tuong: 'giao_vien',
        don_vi_cong_tac_id: dv.donVi.id,
        so_dien_thoai_lien_he: '0900000000',
        trang_thai: 'da_duyet',
        nguoi_duyet_id: quanTri.nguoiDung.id,
        cap_duyet_thuc_te: 'quan_tri',
        ngay_duyet: new Date(),
        chuyen_mon: { create: [{ chuyen_mon: 'CNTT' }] },
      },
    });
    const nd = await prisma.nguoi_dung.create({
      data: {
        ho_ten: hv.ho_ten,
        ten_dang_nhap: ten,
        vai_tro: 'hoc_vien',
        hoc_vien_id: hv.id,
        mat_khau_hash: await bcrypt.hash('15061' + '0' + NAM, 4),
        phai_doi_mat_khau: false,
      },
    });
    hocVienIds.push(hv.id);
    nguoiDungIds.push(nd.id);
    if (khoaId) {
      await prisma.dang_ky_hoc.create({
        data: { hoc_vien_id: hv.id, khoa_id: khoaId, trang_thai: 'da_duyet' },
      });
    }
    return { hv, token: await dangNhap(ten, '15061' + '0' + NAM) };
  }

  beforeAll(async () => {
    app = await createTestApp();
    banGocChung = await prisma.cau_hinh_he_thong.findUnique({
      where: { khoa: KHOA_CHUNG },
    });
    dv = await taoDonViTest('chk');
    quanTri = await taoNguoiDungTest({
      vai_tro: 'quan_tri',
      don_vi_id: dv.donVi.id,
      mat_khau: 'MatKhau123',
    });
    tokenQt = await dangNhap(quanTri.ten_dang_nhap, 'MatKhau123');
    await request(app.getHttpServer())
      .put('/cau-hinh-khao-sat')
      .set('Authorization', `Bearer ${tokenQt}`)
      .send(cauHinh('vle', 'Phiếu chung'))
      .expect(200);
  });

  afterAll(async () => {
    await prisma.cau_hinh_khao_sat_khoa.deleteMany({
      where: { khoa_id: { in: khoaIds } },
    });
    await prisma.cau_hinh_he_thong.deleteMany({ where: { khoa: KHOA_CHUNG } });
    if (banGocChung) {
      await prisma.cau_hinh_he_thong.create({
        data: {
          ...banGocChung,
          gia_tri: banGocChung.gia_tri as Prisma.InputJsonValue,
        },
      });
    }
    await prisma.dang_ky_hoc.deleteMany({
      where: { hoc_vien_id: { in: hocVienIds } },
    });
    await prisma.nguoi_dung.deleteMany({ where: { id: { in: nguoiDungIds } } });
    await prisma.hoc_vien.deleteMany({ where: { id: { in: hocVienIds } } });
    await prisma.khoa_boi_duong.deleteMany({ where: { id: { in: khoaIds } } });
    await xoaNguoiDungTest(quanTri.nguoiDung.id);
    await xoaDonViTest([dv.donVi.id], [dv.diaDanhXa.id, dv.diaDanhTinh.id]);
    await prisma.$disconnect();
    await app.close();
  });

  it('khóa có cấu hình riêng + tỉnh: trang chủ liệt kê tỉnh, ?tinh= trả cấu hình khóa; học viên ghi danh nhận cấu hình khóa, học viên khác nhận cấu hình chung', async () => {
    const khoa = await taoKhoa();
    await request(app.getHttpServer())
      .put(`/cau-hinh-khao-sat/khoa/${khoa.id}`)
      .set('Authorization', `Bearer ${tokenQt}`)
      .send({ ...cauHinh('sso', 'Phiếu riêng'), tinh_id: dv.diaDanhTinh.id })
      .expect(200);

    const ds = await request(app.getHttpServer())
      .get('/cau-hinh-khao-sat/tinh')
      .expect(200);
    expect(ds.body).toContainEqual({
      tinh_id: dv.diaDanhTinh.id,
      ten_tinh: dv.diaDanhTinh.ten,
    });

    const theoTinh = await request(app.getHttpServer())
      .get(`/cau-hinh-khao-sat?tinh=${dv.diaDanhTinh.id}`)
      .expect(200);
    expect(theoTinh.body.pham_vi).toMatchObject({
      loai: 'khoa',
      ma_khoa: khoa.ma_khoa,
    });
    expect(theoTinh.body.cau_hinh.phieu[0].ten).toBe('Phiếu riêng');

    const chung = await request(app.getHttpServer())
      .get('/cau-hinh-khao-sat')
      .expect(200);
    expect(chung.body.pham_vi).toEqual({ loai: 'chung' });
    expect(chung.body.cau_hinh.phieu[0].ten).toBe('Phiếu chung');

    const { token: tokenGhiDanh } = await taoHocVien(khoa.id);
    const cuaToi = await request(app.getHttpServer())
      .get('/cau-hinh-khao-sat/cua-toi')
      .set('Authorization', `Bearer ${tokenGhiDanh}`)
      .expect(200);
    expect(cuaToi.body.pham_vi).toMatchObject({
      loai: 'khoa',
      khoa_id: khoa.id,
    });
    // M6 đi theo kênh của khóa (sso), không theo cấu hình chung (vle).
    const m6 = await request(app.getHttpServer())
      .get('/hoc-vien/toi/danh-gia-dau-vao')
      .set('Authorization', `Bearer ${tokenGhiDanh}`)
      .expect(200);
    expect(m6.body.kenh).toBe('sso');

    const { token: tokenKhac } = await taoHocVien();
    const cuaToiKhac = await request(app.getHttpServer())
      .get('/cau-hinh-khao-sat/cua-toi')
      .set('Authorization', `Bearer ${tokenKhac}`)
      .expect(200);
    expect(cuaToiKhac.body.pham_vi).toEqual({ loai: 'chung' });
    const m6Khac = await request(app.getHttpServer())
      .get('/hoc-vien/toi/danh-gia-dau-vao')
      .set('Authorization', `Bearer ${tokenKhac}`)
      .expect(200);
    expect(m6Khac.body.kenh).toBe('vle');
  });

  it('tỉnh đã gắn khóa khác -> 409; tỉnh không phải cấp tỉnh -> 400; khóa không tồn tại -> 404', async () => {
    const khoaA = await taoKhoa();
    const khoaB = await taoKhoa();
    // Tỉnh riêng cho test này để không đụng test trước.
    const tinh = await prisma.dia_danh.create({
      data: {
        ma: `T-chk2-${uniqueSuffix()}`,
        ten: 'Tỉnh Thử 2',
        cap: 'tinh_thanh',
      },
    });
    try {
      await request(app.getHttpServer())
        .put(`/cau-hinh-khao-sat/khoa/${khoaA.id}`)
        .set('Authorization', `Bearer ${tokenQt}`)
        .send({ ...cauHinh('vle'), tinh_id: tinh.id })
        .expect(200);
      const trung = await request(app.getHttpServer())
        .put(`/cau-hinh-khao-sat/khoa/${khoaB.id}`)
        .set('Authorization', `Bearer ${tokenQt}`)
        .send({ ...cauHinh('vle'), tinh_id: tinh.id })
        .expect(409);
      expect(trung.body.error.message).toContain(khoaA.ma_khoa);

      await request(app.getHttpServer())
        .put(`/cau-hinh-khao-sat/khoa/${khoaB.id}`)
        .set('Authorization', `Bearer ${tokenQt}`)
        .send({ ...cauHinh('vle'), tinh_id: dv.diaDanhXa.id })
        .expect(400);
      await request(app.getHttpServer())
        .put('/cau-hinh-khao-sat/khoa/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${tokenQt}`)
        .send(cauHinh('vle'))
        .expect(404);
    } finally {
      await prisma.cau_hinh_khao_sat_khoa.deleteMany({
        where: { tinh_id: tinh.id },
      });
      await prisma.dia_danh.delete({ where: { id: tinh.id } });
    }
  });

  it('xóa cấu hình riêng -> khóa quay về cấu hình chung; GET khoa trả cau_hinh null', async () => {
    const khoa = await taoKhoa();
    await request(app.getHttpServer())
      .put(`/cau-hinh-khao-sat/khoa/${khoa.id}`)
      .set('Authorization', `Bearer ${tokenQt}`)
      .send(cauHinh('sso'))
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/cau-hinh-khao-sat/khoa/${khoa.id}`)
      .set('Authorization', `Bearer ${tokenQt}`)
      .expect(204);
    const r = await request(app.getHttpServer())
      .get(`/cau-hinh-khao-sat/khoa/${khoa.id}`)
      .set('Authorization', `Bearer ${tokenQt}`)
      .expect(200);
    expect(r.body.cau_hinh).toBeNull();
    expect(r.body.pham_vi).toMatchObject({
      loai: 'khoa',
      ma_khoa: khoa.ma_khoa,
    });
  });

  it('phân quyền: không token -> 401 cho route quản trị; cua-toi bởi quản trị -> 403; ?tinh= sai định dạng -> 400', async () => {
    const khoa = await taoKhoa();
    await request(app.getHttpServer())
      .put(`/cau-hinh-khao-sat/khoa/${khoa.id}`)
      .send(cauHinh('vle'))
      .expect(401);
    await request(app.getHttpServer())
      .get('/cau-hinh-khao-sat/cua-toi')
      .set('Authorization', `Bearer ${tokenQt}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/cau-hinh-khao-sat?tinh=abc')
      .expect(400);
  });
});
