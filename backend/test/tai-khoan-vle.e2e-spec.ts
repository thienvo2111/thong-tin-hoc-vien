import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as ExcelJS from 'exceljs';
import * as bcrypt from 'bcryptjs';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoDonViTest,
  taoDotXacNhanTest,
  taoNguoiDungTest,
  uniqueSuffix,
  xoaDotXacNhanTest,
  xoaNguoiDungTest,
  xoaDonViTest,
} from './utils/test-data';

const NAM_HOP_LE = new Date().getUTCFullYear() - 20;
const COLUMNS = [
  'so_dinh_danh_ca_nhan',
  'ma_dinh_danh_moet',
  'ten_dang_nhap_vle',
  'mat_khau_tam',
  'duong_dan',
];

async function buildXlsx(
  rows: (string | number | undefined)[][],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('data');
  sheet.addRow(COLUMNS);
  rows.forEach((r) => sheet.addRow(r));
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function ddmmyyyy(ngay: number, thang: number, nam: number): string {
  return `${String(ngay).padStart(2, '0')}${String(thang).padStart(2, '0')}${nam}`;
}

// T15 (mo-rong-nls-an-giang.md) — Cổng điều kiện làm đánh giá đầu vào &
// import tai_khoan_vle.
describe('Tài khoản VLE & cổng điều kiện đánh giá đầu vào — T15 (e2e)', () => {
  let app: INestApplication;
  let donViFixture: Awaited<ReturnType<typeof taoDonViTest>>;
  let quanTri: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let tokenQuanTri: string;

  const hocVienIds: string[] = [];
  const nguoiDungHocVienIds: string[] = [];
  const importIds: string[] = [];
  const dotIds: string[] = [];

  async function dangNhap(ten_dang_nhap: string, mat_khau: string) {
    const res = await request(app.getHttpServer())
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap, mat_khau })
      .expect(200);
    return res.body.token as string;
  }

  // Tạo hồ sơ import_moet ĐẦY ĐỦ ngay từ đầu (CCCD/nơi sinh/phường xã/trình
  // độ/chuyên môn) — khác dot-xac-nhan.e2e-spec.ts (tạo thiếu rồi PATCH bổ
  // sung dần) vì ở đây trọng tâm là cổng danh-gia-dau-vao, không phải luồng
  // bổ sung hồ sơ.
  async function taoHocVienDayDu(hoTen?: string) {
    const suf = uniqueSuffix();
    const ngay = 15;
    const thang = 6;
    const tenDangNhap = `MOET-T15-${suf}`;
    const hocVien = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: tenDangNhap,
        so_dinh_danh_ca_nhan: `${Date.now()}${suf}`
          .replace(/\D/g, '')
          .padStart(12, '1')
          .slice(-12),
        ho_ten: hoTen ?? 'Học Viên Đầy Đủ',
        email_lien_he: `t15-${suf}@test.local`,
        ngay_sinh: ngay,
        thang_sinh: thang,
        nam_sinh: NAM_HOP_LE,
        noi_sinh_id: donViFixture.diaDanhTinh.id,
        phuong_xa_id: donViFixture.diaDanhXa.id,
        trinh_do_chuyen_mon: 'dai_hoc',
        don_vi_cong_tac_id: donViFixture.donVi.id,
        so_dien_thoai_lien_he: '0900000000',
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
        mat_khau_hash: await bcrypt.hash(ddmmyyyy(ngay, thang, NAM_HOP_LE), 4),
        phai_doi_mat_khau: false,
      },
    });
    await prisma.hoc_vien.update({
      where: { id: hocVien.id },
      data: { created_by: nguoiDung.id },
    });
    hocVienIds.push(hocVien.id);
    nguoiDungHocVienIds.push(nguoiDung.id);
    const token = await dangNhap(
      tenDangNhap,
      ddmmyyyy(ngay, thang, NAM_HOP_LE),
    );
    return { hocVien, nguoiDung, token, tenDangNhap };
  }

  beforeAll(async () => {
    app = await createTestApp();
    donViFixture = await taoDonViTest('t15');
    quanTri = await taoNguoiDungTest({
      vai_tro: 'quan_tri',
      don_vi_id: donViFixture.donVi.id,
      mat_khau: 'MatKhau123',
    });
    tokenQuanTri = await dangNhap(quanTri.ten_dang_nhap, 'MatKhau123');
  });

  afterAll(async () => {
    await xoaDotXacNhanTest(dotIds);
    await prisma.tai_khoan_vle.deleteMany({
      where: { hoc_vien_id: { in: hocVienIds } },
    });
    await prisma.nhat_ky_import.deleteMany({
      where: { id: { in: importIds } },
    });
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
    }
    await prisma.nguoi_dung.deleteMany({
      where: { id: { in: nguoiDungHocVienIds } },
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

  describe('Import tai_khoan_vle — HocVienResolver dùng chung', () => {
    it('chỉ ma_dinh_danh_moet -> khớp đúng học viên, mật khẩu KHÔNG lưu dạng rõ trong DB', async () => {
      const { hocVien, tenDangNhap } = await taoHocVienDayDu();
      const buffer = await buildXlsx([
        [
          undefined,
          tenDangNhap,
          'gv.moet.test',
          'MatKhauTam!123',
          'https://vle.example.local/khoa-hoc/1',
        ],
      ]);
      const res = await request(app.getHttpServer())
        .post('/import/tai_khoan_vle')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach('file', buffer, 'vle.xlsx')
        .expect(201);
      importIds.push(res.body.import_id);

      const ketQua = await request(app.getHttpServer())
        .get(`/import/${res.body.import_id}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(ketQua.body.so_dong_loi).toBe(0);

      await request(app.getHttpServer())
        .post(`/import/${res.body.import_id}/xac-nhan`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(201);

      const raw = await prisma.tai_khoan_vle.findUnique({
        where: { hoc_vien_id: hocVien.id },
      });
      expect(raw).not.toBeNull();
      expect(raw?.ten_dang_nhap_vle).toBe('gv.moet.test');
      // DB không chứa mật khẩu dạng rõ.
      expect(raw?.mat_khau_tam_ma_hoa).not.toBeNull();
      const bytes = raw!.mat_khau_tam_ma_hoa as Buffer;
      expect(bytes.toString('utf8')).not.toContain('MatKhauTam!123');
    });

    it('có cả 2 mã, trỏ 2 hồ sơ khác nhau -> dòng lỗi', async () => {
      const a = await taoHocVienDayDu();
      const b = await taoHocVienDayDu();
      const buffer = await buildXlsx([
        [
          a.hocVien.so_dinh_danh_ca_nhan as string,
          b.tenDangNhap,
          'gv.x',
          undefined,
          'https://vle.example.local/x',
        ],
      ]);
      const res = await request(app.getHttpServer())
        .post('/import/tai_khoan_vle')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach('file', buffer, 'vle-conflict.xlsx')
        .expect(201);
      importIds.push(res.body.import_id);

      const ketQua = await request(app.getHttpServer())
        .get(`/import/${res.body.import_id}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(ketQua.body.so_dong_loi).toBe(1);
      expect(ketQua.body.danh_sach_loi[0].ly_do).toEqual(
        expect.stringContaining('2 hồ sơ học viên khác nhau'),
      );
    });

    it('không có cả 2 mã -> dòng lỗi', async () => {
      const buffer = await buildXlsx([
        [
          undefined,
          undefined,
          'gv.y',
          undefined,
          'https://vle.example.local/y',
        ],
      ]);
      const res = await request(app.getHttpServer())
        .post('/import/tai_khoan_vle')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach('file', buffer, 'vle-missing.xlsx')
        .expect(201);
      importIds.push(res.body.import_id);

      const ketQua = await request(app.getHttpServer())
        .get(`/import/${res.body.import_id}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(ketQua.body.so_dong_loi).toBe(1);
    });

    it('dòng lỗi có mat_khau_tam -> file lỗi KHÔNG chứa mật khẩu dạng rõ', async () => {
      const buffer = await buildXlsx([
        [
          undefined,
          undefined, // thiếu cả 2 mã -> dòng lỗi
          'gv.z',
          'MatKhauBiRoRi!999',
          'https://vle.example.local/z',
        ],
      ]);
      const res = await request(app.getHttpServer())
        .post('/import/tai_khoan_vle')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach('file', buffer, 'vle-redact.xlsx')
        .expect(201);
      importIds.push(res.body.import_id);

      const fileLoi = await request(app.getHttpServer())
        .get(`/import/${res.body.import_id}/file-loi`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .buffer(true)
        .parse((r, cb) => {
          r.setEncoding('binary');
          let data = '';
          r.on('data', (c: string) => (data += c));
          r.on('end', () => cb(null, Buffer.from(data, 'binary')));
        })
        .expect(200);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(fileLoi.body as unknown as ExcelJS.Buffer);
      const sheet = workbook.worksheets[0];
      let foundPlainPassword = false;
      sheet.eachRow((row) => {
        row.eachCell((cell) => {
          if (String(cell.value ?? '').includes('MatKhauBiRoRi!999')) {
            foundPlainPassword = true;
          }
        });
      });
      expect(foundPlainPassword).toBe(false);
    });
  });

  describe('GET /hoc-vien/toi/danh-gia-dau-vao', () => {
    it('hồ sơ đầy đủ nhưng CHƯA xác nhận đợt 2 -> không có thông tin VLE', async () => {
      const { hocVien, token, tenDangNhap } = await taoHocVienDayDu();
      const buffer = await buildXlsx([
        [
          undefined,
          tenDangNhap,
          'gv.chua-xac-nhan',
          'MatKhauTam1',
          'https://vle.example.local/a',
        ],
      ]);
      const importRes = await request(app.getHttpServer())
        .post('/import/tai_khoan_vle')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach('file', buffer, 'vle-a.xlsx')
        .expect(201);
      importIds.push(importRes.body.import_id);
      await request(app.getHttpServer())
        .post(`/import/${importRes.body.import_id}/xac-nhan`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/hoc-vien/toi/danh-gia-dau-vao')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.du_dieu_kien).toBe(false);
      expect(res.body.duong_dan).toBeUndefined();
      expect(res.body.ten_dang_nhap_vle).toBeUndefined();
      expect(res.body.mat_khau_tam).toBeUndefined();

      // dọn ngay — không cần giữ tới afterAll
      void hocVien;
    });

    it('xác nhận đợt 2 xong -> có thông tin VLE; sửa hồ sơ sau đó -> mất quyền xem tới khi xác nhận lại', async () => {
      const { token, tenDangNhap } = await taoHocVienDayDu();
      const matKhau = 'MatKhauTam2!';
      const duongDan = 'https://vle.example.local/b';
      const buffer = await buildXlsx([
        [undefined, tenDangNhap, 'gv.day-du', matKhau, duongDan],
      ]);
      const importRes = await request(app.getHttpServer())
        .post('/import/tai_khoan_vle')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach('file', buffer, 'vle-b.xlsx')
        .expect(201);
      importIds.push(importRes.body.import_id);
      await request(app.getHttpServer())
        .post(`/import/${importRes.body.import_id}/xac-nhan`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(201);

      const dot = await taoDotXacNhanTest({ loai: 'xac_nhan_truoc_danh_gia' });
      dotIds.push(dot.id);

      // Trước khi xác nhận đợt 2: chưa đủ điều kiện.
      const truoc = await request(app.getHttpServer())
        .get('/hoc-vien/toi/danh-gia-dau-vao')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(truoc.body.du_dieu_kien).toBe(false);

      await request(app.getHttpServer())
        .post('/hoc-vien/toi/xac-nhan')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      const sau = await request(app.getHttpServer())
        .get('/hoc-vien/toi/danh-gia-dau-vao')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(sau.body.du_dieu_kien).toBe(true);
      expect(sau.body.duong_dan).toBe(duongDan);
      expect(sau.body.ten_dang_nhap_vle).toBe('gv.day-du');
      expect(sau.body.mat_khau_tam).toBe(matKhau);

      // Sửa hồ sơ tiếp (trong đợt đang mở) -> hủy xác nhận -> mất quyền xem.
      const suaRes = await request(app.getHttpServer())
        .patch('/hoc-vien/toi')
        .set('Authorization', `Bearer ${token}`)
        .send({ chuc_vu: 'Tổ trưởng chuyên môn' })
        .expect(200);
      expect(suaRes.body.xac_nhan_bi_huy).toBe(true);

      const matQuyen = await request(app.getHttpServer())
        .get('/hoc-vien/toi/danh-gia-dau-vao')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(matQuyen.body.du_dieu_kien).toBe(false);
      expect(matQuyen.body.mat_khau_tam).toBeUndefined();

      // Xác nhận lại -> có quyền xem lại.
      await request(app.getHttpServer())
        .post('/hoc-vien/toi/xac-nhan')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);
      const lai = await request(app.getHttpServer())
        .get('/hoc-vien/toi/danh-gia-dau-vao')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(lai.body.du_dieu_kien).toBe(true);

      // Dọn ngay — dot_xac_nhan scope NULL là TOÀN CỤC, để sót sẽ khiến test
      // "het_han" bên dưới thấy nhầm đợt này vẫn đang mở.
      await xoaDotXacNhanTest([dot.id]);
      dotIds.splice(dotIds.indexOf(dot.id), 1);
    });

    it('đợt 2 đã đóng mà chưa xác nhận -> het_han=true', async () => {
      const { token } = await taoHocVienDayDu();
      const dotDaDong = await taoDotXacNhanTest({
        loai: 'xac_nhan_truoc_danh_gia',
        mo_luc: new Date(Date.now() - 2 * 60 * 60 * 1000),
        dong_luc: new Date(Date.now() - 1 * 60 * 60 * 1000),
      });
      dotIds.push(dotDaDong.id);

      const res = await request(app.getHttpServer())
        .get('/hoc-vien/toi/danh-gia-dau-vao')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.du_dieu_kien).toBe(false);
      expect(res.body.het_han).toBe(true);

      await xoaDotXacNhanTest([dotDaDong.id]);
      dotIds.splice(dotIds.indexOf(dotDaDong.id), 1);
    });
  });

  describe('GET /bao-cao/dieu-kien-danh-gia (quan_tri)', () => {
    it('liệt kê đủ điều kiện / không đủ kèm lý do / đã xem VLE', async () => {
      const { hocVien, token, tenDangNhap } = await taoHocVienDayDu();
      const buffer = await buildXlsx([
        [
          undefined,
          tenDangNhap,
          'gv.baocao',
          'MatKhauTam3',
          'https://vle.example.local/c',
        ],
      ]);
      const importRes = await request(app.getHttpServer())
        .post('/import/tai_khoan_vle')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach('file', buffer, 'vle-c.xlsx')
        .expect(201);
      importIds.push(importRes.body.import_id);
      await request(app.getHttpServer())
        .post(`/import/${importRes.body.import_id}/xac-nhan`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(201);

      const dot = await taoDotXacNhanTest({ loai: 'xac_nhan_truoc_danh_gia' });
      dotIds.push(dot.id);

      const truoc = await request(app.getHttpServer())
        .get(`/bao-cao/dieu-kien-danh-gia`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      const rowTruoc = (
        truoc.body as {
          hoc_vien_id: string;
          du_dieu_kien: boolean;
          ly_do: string[];
        }[]
      ).find((r) => r.hoc_vien_id === hocVien.id);
      expect(rowTruoc?.du_dieu_kien).toBe(false);
      expect(rowTruoc?.ly_do.length).toBeGreaterThan(0);

      await request(app.getHttpServer())
        .post('/hoc-vien/toi/xac-nhan')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);
      await request(app.getHttpServer())
        .get('/hoc-vien/toi/danh-gia-dau-vao')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const sau = await request(app.getHttpServer())
        .get(`/bao-cao/dieu-kien-danh-gia`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      const rowSau = (
        sau.body as {
          hoc_vien_id: string;
          du_dieu_kien: boolean;
          da_xem_vle: boolean;
        }[]
      ).find((r) => r.hoc_vien_id === hocVien.id);
      expect(rowSau?.du_dieu_kien).toBe(true);
      expect(rowSau?.da_xem_vle).toBe(true);

      await xoaDotXacNhanTest([dot.id]);
      dotIds.splice(dotIds.indexOf(dot.id), 1);
    });

    it('truong (không phải quan_tri) gọi -> 403', async () => {
      const truong = await taoNguoiDungTest({
        vai_tro: 'truong',
        don_vi_id: donViFixture.donVi.id,
        mat_khau: 'MatKhau123',
      });
      const tokenTruong = await dangNhap(truong.ten_dang_nhap, 'MatKhau123');
      await request(app.getHttpServer())
        .get('/bao-cao/dieu-kien-danh-gia')
        .set('Authorization', `Bearer ${tokenTruong}`)
        .expect(403);
      await xoaNguoiDungTest(truong.nguoiDung.id);
    });
  });
});
