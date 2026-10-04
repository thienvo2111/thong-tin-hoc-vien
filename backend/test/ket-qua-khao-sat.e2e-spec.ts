import { INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import * as ExcelJS from 'exceljs';
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
const API_KEY = 'khoa-e2e-ket-qua-khao-sat';

function ddmmyyyy(ngay: number, thang: number, nam: number): string {
  return `${String(ngay).padStart(2, '0')}${String(thang).padStart(2, '0')}${nam}`;
}

async function buildXlsx(rows: (string | undefined)[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('data');
  sheet.addRow([
    'so_dinh_danh_ca_nhan',
    'ma_dinh_danh_moet',
    'loai',
    'trang_thai',
    'thoi_diem',
    'muc',
    'diem',
  ]);
  rows.forEach((r) => sheet.addRow(r));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// Kết quả khảo sát (2026-10-04, api-contract.md mục 10): cổng tự ghi "đã mở"
// khi đổi mã SSO, hệ thống khảo sát báo về qua POST /sso/ket-qua, quản trị
// import Excel dự phòng; học viên xem trạng thái + mức, quản trị xem đủ.
describe('Kết quả khảo sát (e2e)', () => {
  let app: INestApplication;
  let donViFixture: Awaited<ReturnType<typeof taoDonViTest>>;
  let quanTri: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let tokenQuanTri: string;
  let banGocCauHinh: Awaited<
    ReturnType<typeof prisma.cau_hinh_he_thong.findUnique>
  >;
  const envGoc = { ...process.env };
  const hocVienIds: string[] = [];
  const nguoiDungIds: string[] = [];
  const importIds: string[] = [];

  async function dangNhap(ten_dang_nhap: string, mat_khau: string) {
    const res = await request(app.getHttpServer())
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap, mat_khau })
      .expect(200);
    return res.body.token as string;
  }

  async function taoHocVien(coDangNhap = false) {
    const suf = uniqueSuffix();
    const tenDangNhap = `MOET-KQ-${suf}`;
    const hocVien = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: tenDangNhap,
        so_dinh_danh_ca_nhan: `${Date.now()}${suf}`
          .replace(/\D/g, '')
          .padStart(12, '2')
          .slice(-12),
        ho_ten: 'Học Viên Kết Quả',
        email_lien_he: `kq-${suf}@test.local`,
        ngay_sinh: 15,
        thang_sinh: 6,
        nam_sinh: NAM_HOP_LE,
        trinh_do_chuyen_mon: 'dai_hoc',
        don_vi_cong_tac_id: donViFixture.donVi.id,
        so_dien_thoai_lien_he: '0900000000',
        doi_tuong: 'can_bo_quan_ly',
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
    nguoiDungIds.push(nguoiDung.id);
    const token = coDangNhap
      ? await dangNhap(tenDangNhap, ddmmyyyy(15, 6, NAM_HOP_LE))
      : '';
    return { hocVien, tenDangNhap, token };
  }

  function baoKetQua(
    body: Record<string, unknown>,
    key: string | null = API_KEY,
  ) {
    const req = request(app.getHttpServer()).post('/sso/ket-qua').send(body);
    return key === null ? req : req.set('X-API-Key', key);
  }

  function tinhTrang(token: string) {
    return request(app.getHttpServer())
      .get('/sso/tinh-trang')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .then((r) => r.body as { loai: string; [k: string]: unknown }[]);
  }

  beforeAll(async () => {
    process.env.SSO_KHAO_SAT_API_KEY = API_KEY;
    process.env.SSO_KHAO_SAT_URL = 'https://khaosat.test/sso/start';
    app = await createTestApp();
    banGocCauHinh = await prisma.cau_hinh_he_thong.findUnique({
      where: { khoa: KHOA_CAU_HINH },
    });
    donViFixture = await taoDonViTest('kqks');
    quanTri = await taoNguoiDungTest({
      vai_tro: 'quan_tri',
      don_vi_id: donViFixture.donVi.id,
      mat_khau: 'MatKhau123',
    });
    tokenQuanTri = await dangNhap(quanTri.ten_dang_nhap, 'MatKhau123');
    await request(app.getHttpServer())
      .put('/cau-hinh-khao-sat')
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .send({
        che_do_hoc_vien: 'dang_nhap',
        danh_gia_dau_vao_trong_cong: true,
        hien_khao_sat: false,
        kenh_danh_gia: 'sso',
        phieu: [],
      })
      .expect(200);
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
    await prisma.nhat_ky_import.deleteMany({
      where: { id: { in: importIds } },
    });
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
    await prisma.nguoi_dung.deleteMany({ where: { id: { in: nguoiDungIds } } });
    await prisma.lich_su_thay_doi_ho_so.deleteMany({
      where: { hoc_vien_id: { in: hocVienIds } },
    });
    await prisma.hang_doi_email.deleteMany({
      where: { hoc_vien_id: { in: hocVienIds } },
    });
    await prisma.nhat_ky_thong_bao.deleteMany({
      where: { hoc_vien_id: { in: hocVienIds } },
    });
    // ket_qua_khao_sat xóa theo (ON DELETE CASCADE).
    await prisma.hoc_vien.deleteMany({ where: { id: { in: hocVienIds } } });
    await xoaNguoiDungTest(quanTri.nguoiDung.id);
    await xoaDonViTest(
      [donViFixture.donVi.id],
      [donViFixture.diaDanhXa.id, donViFixture.diaDanhTinh.id],
    );
    await prisma.$disconnect();
    await app.close();
  });

  it('vòng đời: chưa làm -> đổi mã = đã mở -> báo đang làm -> hoàn thành (học viên thấy mức, không thấy điểm) -> đang làm muộn không đè', async () => {
    const { hocVien, tenDangNhap, token } = await taoHocVien(true);

    let tt = await tinhTrang(token);
    expect(tt.map((t) => t.trang_thai)).toEqual([
      'chua_lam',
      'chua_lam',
      'chua_lam',
    ]);

    for (let i = 0; i < 2; i++) {
      const cap = await request(app.getHttpServer())
        .post('/sso/cap-ma')
        .set('Authorization', `Bearer ${token}`)
        .send({ target: 'khao-sat' });
      expect(cap.body).toHaveProperty('url');
      const code = new URL(cap.body.url).searchParams.get('code');
      await request(app.getHttpServer())
        .post('/sso/doi-ma')
        .set('X-API-Key', API_KEY)
        .send({ code })
        .expect(200);
    }
    tt = await tinhTrang(token);
    expect(tt[0]).toMatchObject({
      loai: 'khao-sat',
      trang_thai: 'da_mo',
      can_kiem_tra: false,
    });
    const dong = await prisma.ket_qua_khao_sat.findUnique({
      where: {
        hoc_vien_id_loai: { hoc_vien_id: hocVien.id, loai: 'khao-sat' },
      },
    });
    expect(dong?.so_lan_mo).toBe(2);
    expect(dong?.nguon).toBe('sso');

    await baoKetQua({
      ma_dinh_danh_moet: tenDangNhap,
      loai: 'khao-sat',
      trang_thai: 'dang_lam',
    }).expect(200);
    expect((await tinhTrang(token))[0].trang_thai).toBe('dang_lam');

    const xong = await baoKetQua({
      hoc_vien_id: hocVien.id,
      loai: 'khao-sat',
      trang_thai: 'hoan_thanh',
      muc: 'thanh_thao',
      diem: 72.5,
      chi_tiet: { mien_1: 8 },
    }).expect(200);
    expect(xong.body).toEqual({
      hoc_vien_id: hocVien.id,
      loai: 'khao-sat',
      trang_thai: 'hoan_thanh',
      muc: 'thanh_thao',
    });

    await baoKetQua({
      hoc_vien_id: hocVien.id,
      loai: 'khao-sat',
      trang_thai: 'dang_lam',
    }).expect(200);

    tt = await tinhTrang(token);
    expect(tt[0]).toMatchObject({
      trang_thai: 'hoan_thanh',
      muc: 'thanh_thao',
      can_kiem_tra: false,
    });
    expect(tt[0]).not.toHaveProperty('diem');
    expect(tt[0]).not.toHaveProperty('chi_tiet');
    expect(tt[1].trang_thai).toBe('chua_lam');

    // Mức khảo sát KHÔNG tự đổi mức đầu vào của học viên (quản trị chốt riêng).
    const dk = await prisma.dang_ky_hoc.findMany({
      where: { hoc_vien_id: hocVien.id },
    });
    expect(dk.every((d) => d.muc_dau_vao === null)).toBe(true);
  });

  describe('POST /sso/ket-qua — xác thực & kiểm tra dữ liệu', () => {
    it.each([
      [null, 401],
      ['khoa-sai', 401],
    ])('API key %p -> %p', async (key, ma) => {
      const { hocVien } = await taoHocVien();
      await baoKetQua(
        { hoc_vien_id: hocVien.id, loai: 'khao-sat', trang_thai: 'dang_lam' },
        key,
      ).expect(ma);
      expect(
        await prisma.ket_qua_khao_sat.count({
          where: { hoc_vien_id: hocVien.id },
        }),
      ).toBe(0);
    });

    it('loại bài / trạng thái / mức sai -> 400', async () => {
      const { hocVien } = await taoHocVien();
      for (const body of [
        { loai: 'khac', trang_thai: 'dang_lam' },
        { loai: 'khao-sat', trang_thai: 'da_mo' },
        { loai: 'khao-sat', trang_thai: 'hoan_thanh', muc: 'gioi' },
        { loai: 'khao-sat', trang_thai: 'hoan_thanh', diem: -1 },
      ]) {
        await baoKetQua({ hoc_vien_id: hocVien.id, ...body }).expect(400);
      }
    });

    it('thiếu cả 2 định danh -> 400; mã MOET không tồn tại -> 404', async () => {
      await baoKetQua({ loai: 'khao-sat', trang_thai: 'dang_lam' }).expect(400);
      await baoKetQua({
        ma_dinh_danh_moet: 'KHONG-CO-AI',
        loai: 'khao-sat',
        trang_thai: 'dang_lam',
      }).expect(404);
    });
  });

  describe('quản trị', () => {
    it('học viên không gọi được API quản trị; báo đã mở lâu -> "cần kiểm tra", lọc được', async () => {
      const { hocVien, tenDangNhap, token } = await taoHocVien(true);
      await request(app.getHttpServer())
        .get('/sso/ket-qua')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      await prisma.ket_qua_khao_sat.create({
        data: {
          hoc_vien_id: hocVien.id,
          loai: 'danh-gia',
          trang_thai: 'da_mo',
          so_lan_mo: 1,
          nguon: 'sso',
          cap_nhat_luc: new Date(Date.now() - 25 * 60 * 60 * 1000),
        },
      });
      expect((await tinhTrang(token))[1]).toMatchObject({
        trang_thai: 'da_mo',
        can_kiem_tra: true,
      });

      const loc = await request(app.getHttpServer())
        .get('/sso/ket-qua')
        .query({ loai: 'danh-gia', trang_thai: 'can_kiem_tra', q: tenDangNhap })
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(loc.body.total).toBe(1);
      expect(loc.body.data[0].ket_qua[0]).toMatchObject({
        loai: 'danh-gia',
        can_kiem_tra: true,
      });

      const chuaLam = await request(app.getHttpServer())
        .get('/sso/ket-qua')
        .query({ loai: 'khao-sat', trang_thai: 'chua_lam', q: tenDangNhap })
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(chuaLam.body.total).toBe(1);

      const tk = await request(app.getHttpServer())
        .get('/sso/ket-qua/thong-ke')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      const danhGia = tk.body.theo_loai.find(
        (l: { loai: string }) => l.loai === 'danh-gia',
      );
      expect(danhGia.can_kiem_tra).toBeGreaterThanOrEqual(1);
      expect(tk.body.tong_hoc_vien).toBeGreaterThanOrEqual(1);
    });

    it('import ket_qua_khao_sat: ghi kết quả nguồn import, quản trị thấy điểm; dòng sai báo lỗi', async () => {
      const a = await taoHocVien();
      const b = await taoHocVien();
      const buffer = await buildXlsx([
        [
          undefined,
          a.tenDangNhap,
          'danh-gia',
          'hoan_thanh',
          '04/10/2026 08:30',
          'nang_cao',
          '88,5',
        ],
        [undefined, b.tenDangNhap, 'danh-gia', 'xong_roi', '', '', ''],
        [undefined, a.tenDangNhap, 'danh-gia', 'dang_lam', '', '', ''],
      ]);
      const res = await request(app.getHttpServer())
        .post('/import/ket_qua_khao_sat')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach('file', buffer, 'ket-qua-khao-sat.xlsx')
        .expect(201);
      importIds.push(res.body.import_id);
      const ketQua = await request(app.getHttpServer())
        .get(`/import/${res.body.import_id}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(ketQua.body.so_dong_loi).toBe(2);

      await request(app.getHttpServer())
        .post(`/import/${res.body.import_id}/xac-nhan`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(201);

      const dong = await prisma.ket_qua_khao_sat.findUnique({
        where: {
          hoc_vien_id_loai: { hoc_vien_id: a.hocVien.id, loai: 'danh-gia' },
        },
      });
      expect(dong).toMatchObject({
        trang_thai: 'hoan_thanh',
        muc: 'nang_cao',
        nguon: 'import',
      });
      expect(Number(dong?.diem)).toBe(88.5);
      expect(dong?.hoan_thanh_luc?.toISOString()).toBe(
        '2026-10-04T01:30:00.000Z',
      );
      expect(
        await prisma.ket_qua_khao_sat.count({
          where: { hoc_vien_id: b.hocVien.id },
        }),
      ).toBe(0);

      const ds = await request(app.getHttpServer())
        .get('/sso/ket-qua')
        .query({ q: a.tenDangNhap })
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(ds.body.data[0].ket_qua[0]).toMatchObject({
        diem: 88.5,
        nguon: 'import',
      });
    });
  });
});
