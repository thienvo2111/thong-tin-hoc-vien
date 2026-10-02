import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as ExcelJS from 'exceljs';
import * as bcrypt from 'bcryptjs';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoDonViTest,
  taoNguoiDungTest,
  uniqueSuffix,
  xoaNguoiDungTest,
  xoaDonViTest,
} from './utils/test-data';

const NAM_HOP_LE = new Date().getUTCFullYear() - 20;
const COLUMNS = [
  'ma_khoa',
  'ten_lop',
  'loai_lop',
  'nhom_hoc_vien',
  'muc_nang_luc',
  'si_so_toi_da',
  'giai_doan_thu_tu',
  'buoi_so',
  'bat_dau',
  'ket_thuc',
  'dia_diem_hoac_link',
  'ma_diem_hoc',
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

// T6 (mo-rong-nls-an-giang.md) — Import lop_va_lich_hoc: thuộc tính lớp +
// lịch nhiều buổi/giai đoạn, tạo hàng loạt.
describe('Import lop_va_lich_hoc — thuộc tính lớp, lịch nhiều buổi — T6 (e2e)', () => {
  let app: INestApplication;
  let donViFixture: Awaited<ReturnType<typeof taoDonViTest>>;
  let quanTri: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let tokenQuanTri: string;

  const khoaIds: string[] = [];
  const importIds: string[] = [];
  const hocVienIds: string[] = [];
  const nguoiDungHocVienIds: string[] = [];

  async function dangNhap(ten_dang_nhap: string, mat_khau: string) {
    const res = await request(app.getHttpServer())
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap, mat_khau })
      .expect(200);
    return res.body.token as string;
  }

  async function taoKhoa(overrides: Record<string, unknown> = {}) {
    const suf = uniqueSuffix();
    const res = await request(app.getHttpServer())
      .post('/khoa-boi-duong')
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .send({
        ma_khoa: `K-T6-${suf}`,
        ten_khoa: `Khóa test T6 ${suf}`,
        don_vi_to_chuc_id: donViFixture.donVi.id,
        thoi_gian_bat_dau: '2026-01-01',
        thoi_gian_ket_thuc: '2026-12-31',
        ...overrides,
      })
      .expect(201);
    khoaIds.push(res.body.id);
    return res.body as { id: string; ma_khoa: string };
  }

  async function taoGiaiDoan(khoaId: string, thuTu: number) {
    const res = await request(app.getHttpServer())
      .post(`/khoa-boi-duong/${khoaId}/giai-doan`)
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .send({
        thu_tu: thuTu,
        ten_giai_doan: `Giai đoạn ${thuTu}`,
        hinh_thuc: 'truc_tuyen',
        thoi_gian_bat_dau: '2026-01-01',
        thoi_gian_ket_thuc: '2026-12-31',
      })
      .expect(201);
    return res.body as { id: string; thu_tu: number };
  }

  async function taoHocVienMoet(suf: string) {
    const ngay = 15;
    const thang = 6;
    const tenDangNhap = `MOET-T6-${suf}`;
    const hocVien = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: tenDangNhap,
        ho_ten: 'Học Viên T6',
        ngay_sinh: ngay,
        thang_sinh: thang,
        nam_sinh: NAM_HOP_LE,
        don_vi_cong_tac_id: donViFixture.donVi.id,
        so_dien_thoai_lien_he: '0900000002',
        trang_thai: 'da_duyet',
        nguoi_duyet_id: quanTri.nguoiDung.id,
        cap_duyet_thuc_te: 'quan_tri',
        ngay_duyet: new Date(),
      },
    });
    const nguoiDung = await prisma.nguoi_dung.create({
      data: {
        ho_ten: hocVien.ho_ten,
        ten_dang_nhap: tenDangNhap,
        vai_tro: 'hoc_vien',
        hoc_vien_id: hocVien.id,
        mat_khau_hash: await bcrypt.hash('x', 4),
        phai_doi_mat_khau: false,
      },
    });
    await prisma.hoc_vien.update({
      where: { id: hocVien.id },
      data: { created_by: nguoiDung.id },
    });
    hocVienIds.push(hocVien.id);
    nguoiDungHocVienIds.push(nguoiDung.id);
    return { hocVien, tenDangNhap };
  }

  beforeAll(async () => {
    app = await createTestApp();
    donViFixture = await taoDonViTest('t6');
    quanTri = await taoNguoiDungTest({
      vai_tro: 'quan_tri',
      don_vi_id: donViFixture.donVi.id,
      mat_khau: 'MatKhau123',
    });
    tokenQuanTri = await dangNhap(quanTri.ten_dang_nhap, 'MatKhau123');
  });

  afterAll(async () => {
    await prisma.dang_ky_hoc.deleteMany({
      where: { khoa_id: { in: khoaIds } },
    });
    await prisma.lich_hoc_lop.deleteMany({
      where: { giai_doan: { khoa_id: { in: khoaIds } } },
    });
    await prisma.lop_hoc.deleteMany({ where: { khoa_id: { in: khoaIds } } });
    await prisma.giai_doan_khoa.deleteMany({
      where: { khoa_id: { in: khoaIds } },
    });
    await prisma.nhat_ky_import.deleteMany({
      where: { id: { in: importIds } },
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
    }
    await prisma.nguoi_dung.deleteMany({
      where: { id: { in: nguoiDungHocVienIds } },
    });
    // M9 (2026-10-01): phòng trường hợp import phan_lop_hoc_vien ở trên có
    // gán lớp trực tiếp thành công -> enqueue hang_doi_email (FK
    // hoc_vien_id onDelete: NoAction, docs/database-ddl.sql PHẦN 4) — xóa
    // trước khi xóa hoc_vien.
    await prisma.hang_doi_email.deleteMany({
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

  describe('Tạo hàng loạt lớp + nhiều buổi, sửa 1 buổi, dòng trùng trong file', () => {
    let khoa: { id: string; ma_khoa: string };
    let giaiDoan1: { id: string; thu_tu: number };

    beforeAll(async () => {
      khoa = await taoKhoa();
      giaiDoan1 = await taoGiaiDoan(khoa.id, 1);
    });

    it('1 file tạo nhiều lớp x nhiều buổi (3 lớp x 2 buổi) -> đúng số lớp/lịch tạo ra', async () => {
      const tenLop = (i: number) => `Lop-T6-${khoa.ma_khoa}-${i}`;
      const rows: (string | number | undefined)[][] = [];
      for (let i = 1; i <= 3; i++) {
        rows.push([
          khoa.ma_khoa,
          tenLop(i),
          'truc_tiep', // loai_lop
          i, // nhom_hoc_vien
          'co_ban',
          30,
          giaiDoan1.thu_tu,
          1,
          '10/10/2026 08:00',
          '10/10/2026 11:00',
          'Zoom A',
          undefined,
        ]);
        rows.push([
          khoa.ma_khoa,
          tenLop(i),
          'truc_tiep',
          i,
          'co_ban',
          30,
          giaiDoan1.thu_tu,
          2,
          '11/10/2026 08:00',
          '11/10/2026 11:00',
          'Zoom A',
          undefined,
        ]);
      }
      const buffer = await buildXlsx(rows);
      const res = await request(app.getHttpServer())
        .post('/import/lop_va_lich_hoc')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach('file', buffer, 'lop-lich-1.xlsx')
        .expect(201);
      importIds.push(res.body.import_id);

      const ketQua = await request(app.getHttpServer())
        .get(`/import/${res.body.import_id}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(ketQua.body.so_dong_loi).toBe(0);
      expect(ketQua.body.so_dong_thanh_cong).toBe(6);

      await request(app.getHttpServer())
        .post(`/import/${res.body.import_id}/xac-nhan`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(201);

      const lops = await prisma.lop_hoc.findMany({
        where: { khoa_id: khoa.id },
        include: { lich_hoc: true },
      });
      expect(lops).toHaveLength(3);
      for (const lop of lops) {
        expect(lop.lich_hoc).toHaveLength(2);
        expect(lop.muc_nang_luc).toBe('co_ban');
        expect(lop.si_so_toi_da).toBe(30);
      }
    });

    it('chạy lại file sửa giờ 1 buổi -> chỉ buổi đó đổi, buổi còn lại giữ nguyên', async () => {
      const tenLop1 = `Lop-T6-${khoa.ma_khoa}-1`;
      const lopTruoc = await prisma.lop_hoc.findFirstOrThrow({
        where: { khoa_id: khoa.id, ten_lop: tenLop1 },
        include: { lich_hoc: true },
      });
      const buoi2Truoc = lopTruoc.lich_hoc.find((l) => l.buoi_so === 2);
      expect(buoi2Truoc).toBeDefined();

      // Sửa giờ buổi 1 của Lop-T6-...-1 (09:00-12:00 thay vì 08:00-11:00).
      const buffer = await buildXlsx([
        [
          khoa.ma_khoa,
          tenLop1,
          'truc_tiep',
          1,
          'co_ban',
          30,
          giaiDoan1.thu_tu,
          1,
          '10/10/2026 09:00',
          '10/10/2026 12:00',
          'Zoom A (đổi giờ)',
          undefined,
        ],
      ]);
      const res = await request(app.getHttpServer())
        .post('/import/lop_va_lich_hoc')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach('file', buffer, 'lop-lich-sua-gio.xlsx')
        .expect(201);
      importIds.push(res.body.import_id);
      await request(app.getHttpServer())
        .post(`/import/${res.body.import_id}/xac-nhan`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(201);

      const lopSau = await prisma.lop_hoc.findFirstOrThrow({
        where: { khoa_id: khoa.id, ten_lop: tenLop1 },
        include: { lich_hoc: true },
      });
      expect(lopSau.lich_hoc).toHaveLength(2);
      const buoi1Sau = lopSau.lich_hoc.find((l) => l.buoi_so === 1);
      const buoi2Sau = lopSau.lich_hoc.find((l) => l.buoi_so === 2);
      expect(buoi1Sau?.thoi_gian_bat_dau.toISOString()).toBe(
        '2026-10-10T02:00:00.000Z',
      );
      expect(buoi1Sau?.dia_diem_hoac_link).toBe('Zoom A (đổi giờ)');
      // Buổi 2 KHÔNG bị đụng tới.
      expect(buoi2Sau?.thoi_gian_bat_dau.toISOString()).toBe(
        buoi2Truoc?.thoi_gian_bat_dau.toISOString(),
      );
      expect(buoi2Sau?.dia_diem_hoac_link).toBe(buoi2Truoc?.dia_diem_hoac_link);
    });

    it('2 dòng cùng (lớp, giai đoạn, buổi) trong 1 file -> dòng lỗi', async () => {
      const tenLopMoi = `Lop-T6-${khoa.ma_khoa}-trung`;
      const rowHopLe: (string | number | undefined)[] = [
        khoa.ma_khoa,
        tenLopMoi,
        'truc_tiep',
        1,
        'co_ban',
        30,
        giaiDoan1.thu_tu,
        1,
        '10/10/2026 08:00',
        '10/10/2026 11:00',
        'Zoom A',
        undefined,
      ];
      const buffer = await buildXlsx([rowHopLe, [...rowHopLe]]);
      const res = await request(app.getHttpServer())
        .post('/import/lop_va_lich_hoc')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach('file', buffer, 'lop-lich-trung.xlsx')
        .expect(201);
      importIds.push(res.body.import_id);

      const ketQua = await request(app.getHttpServer())
        .get(`/import/${res.body.import_id}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(ketQua.body.tong_so_dong).toBe(2);
      expect(ketQua.body.so_dong_thanh_cong).toBe(1);
      expect(ketQua.body.so_dong_loi).toBe(1);
      expect(ketQua.body.danh_sach_loi[0].ly_do).toEqual(
        expect.stringContaining('trùng'),
      );
    });

    it('ket_thuc <= bat_dau -> dòng lỗi (rule #49)', async () => {
      const buffer = await buildXlsx([
        [
          khoa.ma_khoa,
          `Lop-T6-${khoa.ma_khoa}-sai-gio`,
          'truc_tiep',
          1,
          'co_ban',
          30,
          giaiDoan1.thu_tu,
          1,
          '10/10/2026 11:00',
          '10/10/2026 08:00',
          'Zoom A',
          undefined,
        ],
      ]);
      const res = await request(app.getHttpServer())
        .post('/import/lop_va_lich_hoc')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach('file', buffer, 'lop-lich-sai-gio.xlsx')
        .expect(201);
      importIds.push(res.body.import_id);
      const ketQua = await request(app.getHttpServer())
        .get(`/import/${res.body.import_id}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(ketQua.body.so_dong_loi).toBe(1);
    });

    it('giai_doan_thu_tu không tồn tại trong khóa -> dòng lỗi', async () => {
      const buffer = await buildXlsx([
        [
          khoa.ma_khoa,
          `Lop-T6-${khoa.ma_khoa}-gd-sai`,
          'truc_tiep',
          1,
          'co_ban',
          30,
          99,
          1,
          '10/10/2026 08:00',
          '10/10/2026 11:00',
          'Zoom A',
          undefined,
        ],
      ]);
      const res = await request(app.getHttpServer())
        .post('/import/lop_va_lich_hoc')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach('file', buffer, 'lop-lich-gd-sai.xlsx')
        .expect(201);
      importIds.push(res.body.import_id);
      const ketQua = await request(app.getHttpServer())
        .get(`/import/${res.body.import_id}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(ketQua.body.so_dong_loi).toBe(1);
      expect(ketQua.body.danh_sach_loi[0].ly_do).toEqual(
        expect.stringContaining('Giai đoạn'),
      );
    });
  });

  describe('POST /lop/{id}/lich-hoc — buoi_so (QĐ3: nhiều buổi/giai đoạn)', () => {
    let khoa: { id: string };
    let giaiDoan1: { id: string };
    let lopId: string;

    beforeAll(async () => {
      khoa = await taoKhoa();
      giaiDoan1 = await taoGiaiDoan(khoa.id, 1);
      const lop = await request(app.getHttpServer())
        .post(`/khoa-boi-duong/${khoa.id}/lop`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({ loai_lop: 'truc_tiep', ten_lop: 'Lớp buổi' })
        .expect(201);
      lopId = lop.body.id;
    });

    it('buoi_so mặc định = 1 khi không truyền', async () => {
      const res = await request(app.getHttpServer())
        .post(`/lop/${lopId}/lich-hoc`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({
          giai_doan_id: giaiDoan1.id,
          thoi_gian_bat_dau: '2026-02-01T08:00:00.000Z',
          thoi_gian_ket_thuc: '2026-02-01T11:00:00.000Z',
        })
        .expect(201);
      expect(res.body.buoi_so).toBe(1);
    });

    it('buoi_so=2 cùng giai_doan (trước đây 409, nay hợp lệ — QĐ3) -> 201', async () => {
      const res = await request(app.getHttpServer())
        .post(`/lop/${lopId}/lich-hoc`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({
          giai_doan_id: giaiDoan1.id,
          buoi_so: 2,
          thoi_gian_bat_dau: '2026-02-02T08:00:00.000Z',
          thoi_gian_ket_thuc: '2026-02-02T11:00:00.000Z',
        })
        .expect(201);
      expect(res.body.buoi_so).toBe(2);
    });

    it('trùng (lop_id, giai_doan_id, buoi_so=1) -> 409', async () => {
      await request(app.getHttpServer())
        .post(`/lop/${lopId}/lich-hoc`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({
          giai_doan_id: giaiDoan1.id,
          buoi_so: 1,
          thoi_gian_bat_dau: '2026-02-03T08:00:00.000Z',
          thoi_gian_ket_thuc: '2026-02-03T11:00:00.000Z',
        })
        .expect(409);
    });
  });

  describe('GET /hoc-vien/toi/khoa-hoc — buổi sắp theo giai đoạn, buổi, thời gian', () => {
    it('trả buổi đúng thứ tự dù tạo ngược lại', async () => {
      const suf = uniqueSuffix();
      const khoa = await taoKhoa();
      const giaiDoan1 = await taoGiaiDoan(khoa.id, 1);
      const giaiDoan2 = await taoGiaiDoan(khoa.id, 2);

      const lop = await request(app.getHttpServer())
        .post(`/khoa-boi-duong/${khoa.id}/lop`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({ loai_lop: 'truc_tiep', ten_lop: 'Lớp thứ tự' })
        .expect(201);
      const lopId = lop.body.id;

      // Tạo NGƯỢC thứ tự mong đợi: giai đoạn 2 trước, buổi 2 trước buổi 1.
      await request(app.getHttpServer())
        .post(`/lop/${lopId}/lich-hoc`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({
          giai_doan_id: giaiDoan2.id,
          buoi_so: 1,
          thoi_gian_bat_dau: '2026-03-01T08:00:00.000Z',
          thoi_gian_ket_thuc: '2026-03-01T11:00:00.000Z',
        })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/lop/${lopId}/lich-hoc`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({
          giai_doan_id: giaiDoan1.id,
          buoi_so: 2,
          thoi_gian_bat_dau: '2026-01-02T08:00:00.000Z',
          thoi_gian_ket_thuc: '2026-01-02T11:00:00.000Z',
        })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/lop/${lopId}/lich-hoc`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({
          giai_doan_id: giaiDoan1.id,
          buoi_so: 1,
          thoi_gian_bat_dau: '2026-01-01T08:00:00.000Z',
          thoi_gian_ket_thuc: '2026-01-01T11:00:00.000Z',
        })
        .expect(201);

      const { hocVien, tenDangNhap } = await taoHocVienMoet(suf);
      const dangKy = await prisma.dang_ky_hoc.create({
        data: {
          hoc_vien_id: hocVien.id,
          khoa_id: khoa.id,
          trang_thai: 'da_phan_lop',
        },
      });
      await prisma.dang_ky_hoc_lop.create({
        data: {
          dang_ky_hoc_id: dangKy.id,
          lop_id: lopId,
          loai_lop: 'truc_tiep',
        },
      });
      const token = await dangNhap(tenDangNhap, 'x');

      const res = await request(app.getHttpServer())
        .get('/hoc-vien/toi/khoa-hoc')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const entry = res.body.find(
        (r: { khoa: { id: string } }) => r.khoa.id === khoa.id,
      );
      expect(entry).toBeDefined();
      const buoiList = entry.lop_truc_tiep.lich_hoc as {
        giai_doan: { thu_tu: number };
        buoi_so: number;
      }[];
      expect(buoiList).toHaveLength(3);
      expect(buoiList.map((b) => [b.giai_doan.thu_tu, b.buoi_so])).toEqual([
        [1, 1],
        [1, 2],
        [2, 1],
      ]);
    });
  });

  describe('Cảnh báo 🟡 khi phân lớp: muc_nang_luc của lớp khác muc_dau_vao của học viên', () => {
    it('lop_hoc.muc_nang_luc != dang_ky_hoc.muc_dau_vao -> cảnh báo, KHÔNG chặn', async () => {
      const suf = uniqueSuffix();
      const khoa = await taoKhoa();
      const { hocVien, tenDangNhap } = await taoHocVienMoet(suf);

      // Ghi danh trước (chưa phân lớp) + đã có kết quả đánh giá đầu vào
      // "co_ban" (mô phỏng luồng vận hành T5 -> T6).
      await prisma.dang_ky_hoc.create({
        data: {
          hoc_vien_id: hocVien.id,
          khoa_id: khoa.id,
          trang_thai: 'da_duyet',
          muc_dau_vao: 'co_ban',
        },
      });

      // Lớp có mức năng lực mục tiêu KHÁC ("nang_cao").
      const tenLop = `Lop-canhbao-${suf}`;
      await taoGiaiDoan(khoa.id, 1); // cột GĐ1 của mẫu phân lớp theo giai đoạn
      await prisma.lop_hoc.create({
        data: {
          khoa_id: khoa.id,
          loai_lop: 'truc_tiep',
          ten_lop: tenLop,
          muc_nang_luc: 'nang_cao',
        },
      });

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('data');
      // Mẫu phân lớp theo giai đoạn (spec 2026-10-02): mỗi giai đoạn 1 cột.
      sheet.addRow([
        'so_dinh_danh_ca_nhan',
        'ma_dinh_danh_moet',
        'GĐ1',
        'ten_cum',
      ]);
      sheet.addRow([undefined, tenDangNhap, tenLop, '']);
      const bufferPhanLop = Buffer.from(await workbook.xlsx.writeBuffer());

      const res = await request(app.getHttpServer())
        .post(`/import/phan_lop_hoc_vien?ma_khoa=${khoa.ma_khoa}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach('file', bufferPhanLop, 'phan-lop-canhbao.xlsx')
        .expect(201);
      importIds.push(res.body.import_id);

      const ketQua = await request(app.getHttpServer())
        .get(`/import/${res.body.import_id}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(ketQua.body.so_dong_loi).toBe(0);
      expect(ketQua.body.danh_sach_canh_bao).toHaveLength(1);
      expect(ketQua.body.danh_sach_canh_bao[0].ly_do).toEqual(
        expect.stringContaining('co_ban'),
      );
      expect(ketQua.body.danh_sach_canh_bao[0].ly_do).toEqual(
        expect.stringContaining('nang_cao'),
      );

      await request(app.getHttpServer())
        .post(`/import/${res.body.import_id}/xac-nhan`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(201);
      const dangKySau = await prisma.dang_ky_hoc.findUnique({
        where: {
          hoc_vien_id_khoa_id: { hoc_vien_id: hocVien.id, khoa_id: khoa.id },
        },
      });
      expect(dangKySau?.trang_thai).toBe('da_phan_lop');
      const lopGan = await prisma.phan_lop_giai_doan.findFirst({
        where: { dang_ky_hoc_id: dangKySau!.id },
      });
      expect(lopGan).not.toBeNull();
    });
  });

  describe('Cảnh báo 🟡 giai_doan_thu_tu nghi nhập nhầm (không chặn dòng)', () => {
    it('lớp trực tiếp gắn vào giai đoạn trực tuyến -> cảnh báo nhưng vẫn hợp lệ; lớp zoom cùng giai đoạn -> không cảnh báo', async () => {
      const khoa = await taoKhoa();
      const giaiDoan = await taoGiaiDoan(khoa.id, 1); // hinh_thuc truc_tuyen
      const dong = (
        ten: string,
        loai: string,
      ): (string | number | undefined)[] => [
        khoa.ma_khoa,
        ten,
        loai,
        undefined,
        undefined,
        50,
        giaiDoan.thu_tu,
        1,
        '10/10/2026 08:00',
        '10/10/2026 11:00',
        undefined,
        undefined,
      ];
      const res = await request(app.getHttpServer())
        .post('/import/lop_va_lich_hoc')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach(
          'file',
          await buildXlsx([
            dong('Lớp TT cảnh báo', 'truc_tiep'),
            dong('Lớp zoom ok', 'zoom'),
          ]),
          'canh-bao-gd.xlsx',
        )
        .expect(201);
      importIds.push(res.body.import_id);

      const ketQua = await request(app.getHttpServer())
        .get(`/import/${res.body.import_id}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(ketQua.body.so_dong_loi).toBe(0);
      expect(ketQua.body.so_dong_thanh_cong).toBe(2);
      expect(ketQua.body.danh_sach_canh_bao).toEqual([
        {
          dong: 2,
          ly_do: expect.stringContaining(
            'lớp trực tiếp nhưng giai đoạn là trực tuyến',
          ),
        },
      ]);

      await request(app.getHttpServer())
        .post(`/import/${res.body.import_id}/xac-nhan`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(201);
      expect(
        await prisma.lich_hoc_lop.count({
          where: { giai_doan_id: giaiDoan.id },
        }),
      ).toBe(2);
    });
  });
});
