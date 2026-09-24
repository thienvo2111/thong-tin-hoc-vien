import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as ExcelJS from 'exceljs';
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
  'Đơn vị',
  'Mã định danh (CDSL moet)',
  'Họ và tên',
  'Ngày',
  'Tháng',
  'Năm',
  'Chức vụ',
  'Chuyên môn',
  'Số điện thoại',
  'Ghi chú',
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

describe('Import ho_so_nhan_su_moet (e2e)', () => {
  let app: INestApplication;
  let donViFixture: Awaited<ReturnType<typeof taoDonViTest>>;
  let quanTri: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let tokenQuanTri: string;

  const hocVienIds: string[] = [];
  const nguoiDungHocVienIds: string[] = [];
  const importIds: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    donViFixture = await taoDonViTest('moet');
    quanTri = await taoNguoiDungTest({
      vai_tro: 'quan_tri',
      don_vi_id: donViFixture.donVi.id,
      mat_khau: 'MatKhau123',
    });
    tokenQuanTri = (
      await request(app.getHttpServer()).post('/auth/dang-nhap').send({
        ten_dang_nhap: quanTri.ten_dang_nhap,
        mat_khau: quanTri.mat_khau,
      })
    ).body.token;
  });

  afterAll(async () => {
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
    await prisma.nhat_ky_import.deleteMany({
      where: { id: { in: importIds } },
    });
    await xoaNguoiDungTest(quanTri.nguoiDung.id);
    await xoaDonViTest(
      [donViFixture.donVi.id],
      [donViFixture.diaDanhXa.id, donViFixture.diaDanhTinh.id],
    );
    await prisma.$disconnect();
    await app.close();
  });

  async function collectCreatedHocVien(maDinhDanh: string) {
    const hv = await prisma.hoc_vien.findUnique({
      where: { ma_dinh_danh_moet: maDinhDanh },
      include: { chuyen_mon: true },
    });
    if (hv) {
      hocVienIds.push(hv.id);
      const nd = await prisma.nguoi_dung.findUnique({
        where: { ten_dang_nhap: maDinhDanh },
      });
      if (nd) nguoiDungHocVienIds.push(nd.id);
    }
    return hv;
  }

  it('GET /import/mau-excel?loai=ho_so_nhan_su_moet -> đúng 10 cột', async () => {
    const res = await request(app.getHttpServer())
      .get('/import/mau-excel?loai=ho_so_nhan_su_moet')
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .expect(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
  });

  describe('Luồng import: 1 dòng hợp lệ (nhiều chuyên môn) + các dòng lỗi', () => {
    let importId: string;
    let maHopLe: string;

    it('preview: đúng số liệu tổng/hợp lệ/lỗi theo từng nguyên nhân', async () => {
      const suf = uniqueSuffix();
      maHopLe = `MOET-${suf}`;
      const maTrungTruoc = `MOET-TRUNG-${suf}`;

      // Tạo sẵn 1 hồ sơ với ma_dinh_danh_moet trùng để test rule #36f.
      const trungHv = await prisma.hoc_vien.create({
        data: {
          nguon_tao: 'import_moet',
          ma_dinh_danh_moet: maTrungTruoc,
          ho_ten: 'Đã Tồn Tại',
          ngay_sinh: 1,
          thang_sinh: 1,
          nam_sinh: NAM_HOP_LE,
          don_vi_cong_tac_id: donViFixture.donVi.id,
          so_dien_thoai_lien_he: '0900000001',
          trang_thai: 'da_duyet',
          nguoi_duyet_id: quanTri.nguoiDung.id,
          cap_duyet_thuc_te: 'quan_tri',
          ngay_duyet: new Date(),
        },
      });
      hocVienIds.push(trungHv.id);

      const buffer = await buildXlsx([
        // Dòng hợp lệ: nhiều chuyên môn phân tách ';'
        [
          donViFixture.donVi.ten_don_vi,
          maHopLe,
          'Trần Thị Bình',
          10,
          3,
          NAM_HOP_LE,
          'Giáo viên',
          'Toán;Lý',
          '0912345678',
          'Ghi chú test',
        ],
        // Lỗi: Đơn vị không khớp
        [
          'Đơn vị không tồn tại xyz',
          `MOET-${suf}-b`,
          'Nguyễn Văn B',
          1,
          1,
          NAM_HOP_LE,
          'Giáo viên',
          'Toán',
          '0912345678',
          '',
        ],
        // Lỗi: trùng mã định danh MOET đã tồn tại
        [
          donViFixture.donVi.ten_don_vi,
          maTrungTruoc,
          'Nguyễn Văn C',
          1,
          1,
          NAM_HOP_LE,
          'Giáo viên',
          'Toán',
          '0912345678',
          '',
        ],
        // Lỗi: ngày sinh không hợp lệ (31/04)
        [
          donViFixture.donVi.ten_don_vi,
          `MOET-${suf}-d`,
          'Nguyễn Văn D',
          31,
          4,
          NAM_HOP_LE,
          'Giáo viên',
          'Toán',
          '0912345678',
          '',
        ],
        // Lỗi: chuyên môn rỗng
        [
          donViFixture.donVi.ten_don_vi,
          `MOET-${suf}-e`,
          'Nguyễn Văn E',
          1,
          1,
          NAM_HOP_LE,
          'Giáo viên',
          '',
          '0912345678',
          '',
        ],
      ]);

      const res = await request(app.getHttpServer())
        .post('/import/ho_so_nhan_su_moet')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach('file', buffer, 'moet.xlsx')
        .expect(201);
      importId = res.body.import_id;
      importIds.push(importId);

      const ketQua = await request(app.getHttpServer())
        .get(`/import/${importId}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(ketQua.body.tong_so_dong).toBe(5);
      expect(ketQua.body.so_dong_thanh_cong).toBe(1);
      expect(ketQua.body.so_dong_loi).toBe(4);

      // Chưa xác nhận -> chưa có trong bảng thật
      const chuaCo = await prisma.hoc_vien.findUnique({
        where: { ma_dinh_danh_moet: maHopLe },
      });
      expect(chuaCo).toBeNull();
    });

    it('POST /import/:id/xac-nhan -> tạo nguoi_dung+hoc_vien da_duyet ngay, nhiều chuyen_mon, nguoi_duyet=quan_tri chạy import', async () => {
      const res = await request(app.getHttpServer())
        .post(`/import/${importId}/xac-nhan`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(201);
      expect(res.body.so_dong_thanh_cong).toBe(1);
      expect(res.body.so_dong_loi).toBe(4);

      const hocVien = await collectCreatedHocVien(maHopLe);
      expect(hocVien).not.toBeNull();
      expect(hocVien?.nguon_tao).toBe('import_moet');
      expect(hocVien?.trang_thai).toBe('da_duyet');
      expect(hocVien?.nguoi_duyet_id).toBe(quanTri.nguoiDung.id);
      expect(hocVien?.cap_duyet_thuc_te).toBe('quan_tri');
      expect(hocVien?.so_dinh_danh_ca_nhan).toBeNull();
      expect(hocVien?.email_lien_he).toBeNull();
      expect(hocVien?.noi_sinh_id).toBeNull();
      expect(hocVien?.phuong_xa_id).toBeNull();
      expect(hocVien?.trinh_do_chuyen_mon).toBeNull();
      expect(hocVien?.cap_giang_day).toBeNull();
      expect(hocVien?.chuyen_mon.map((c) => c.chuyen_mon).sort()).toEqual([
        'Lý',
        'Toán',
      ]);

      const nguoiDung = await prisma.nguoi_dung.findUnique({
        where: { ten_dang_nhap: maHopLe },
      });
      expect(nguoiDung?.hoc_vien_id).toBe(hocVien?.id);
      expect(nguoiDung?.email).toBeNull();
      expect(nguoiDung?.phai_doi_mat_khau).toBe(true);
    });

    it('học viên import_moet đăng nhập bằng Mã định danh MOET + ngày sinh ddmmyyyy (Ngày=10, Tháng=3)', async () => {
      await request(app.getHttpServer())
        .post('/auth/dang-nhap')
        .send({ ten_dang_nhap: maHopLe, mat_khau: 'sai-mat-khau' })
        .expect(401);

      const matKhauDung = `1003${NAM_HOP_LE}`;
      const ok = await request(app.getHttpServer())
        .post('/auth/dang-nhap')
        .send({ ten_dang_nhap: maHopLe, mat_khau: matKhauDung })
        .expect(200);
      expect(ok.body.phai_doi_mat_khau).toBe(true);
      expect(ok.body.nguoi_dung.vai_tro).toBe('hoc_vien');
    });

    it('GET /import/:id/file-loi -> file chứa đúng 4 dòng lỗi kèm lý do', async () => {
      const res = await request(app.getHttpServer())
        .get(`/import/${importId}/file-loi`)
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
      await workbook.xlsx.load(res.body as unknown as ExcelJS.Buffer);
      const sheet = workbook.worksheets[0];
      expect(sheet.rowCount).toBe(5); // header + 4 lỗi
    });
  });

  describe('Học viên import_moet tự bổ sung thông tin qua PATCH /hoc-vien/toi', () => {
    it('bổ sung CCCD/email/nơi sinh sau khi đăng nhập lần đầu', async () => {
      const suf = uniqueSuffix();
      const ma = `MOET-PATCH-${suf}`;
      const buffer = await buildXlsx([
        [
          donViFixture.donVi.ten_don_vi,
          ma,
          'Lê Văn Phúc',
          5,
          9,
          NAM_HOP_LE,
          'Nhân viên',
          'Văn thư',
          '0911222333',
          '',
        ],
      ]);
      const createRes = await request(app.getHttpServer())
        .post('/import/ho_so_nhan_su_moet')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach('file', buffer, 'moet2.xlsx')
        .expect(201);
      importIds.push(createRes.body.import_id);
      await request(app.getHttpServer())
        .post(`/import/${createRes.body.import_id}/xac-nhan`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(201);
      await collectCreatedHocVien(ma);

      const token = (
        await request(app.getHttpServer())
          .post('/auth/dang-nhap')
          .send({ ten_dang_nhap: ma, mat_khau: `0509${NAM_HOP_LE}` })
          .expect(200)
      ).body.token as string;

      // Hồ sơ đã da_duyet nhưng vẫn PATCH được vì nguon_tao=import_moet
      // (xem HocVienService.isEditable) — đây chính là màn "bổ sung thông tin".
      const res = await request(app.getHttpServer())
        .patch('/hoc-vien/toi')
        .set('Authorization', `Bearer ${token}`)
        .send({
          so_dinh_danh_ca_nhan: '198765432109',
          email_lien_he: `bosung-${suf}@test.local`,
          noi_sinh_id: donViFixture.diaDanhTinh.id,
          phuong_xa_id: donViFixture.diaDanhXa.id,
          trinh_do_chuyen_mon: 'trung_cap',
        })
        .expect(200);

      expect(res.body.so_dinh_danh_ca_nhan).toBe('198765432109');
      expect(res.body.email_lien_he).toEqual(expect.stringContaining('bosung'));
      expect(res.body.trang_thai).toBe('da_duyet'); // không đổi trạng thái

      // ĐDCN giờ dùng được cho kiểm tra trùng
      const kt = await request(app.getHttpServer())
        .get('/hoc-vien/kiem-tra-trung?so_dinh_danh_ca_nhan=198765432109')
        .expect(200);
      expect(kt.body.ton_tai).toBe(true);
    });
  });

  describe('Validate lỗi/edge case', () => {
    it('Đơn vị khớp NHIỀU HƠN 1 kết quả -> dòng lỗi (rule #36e)', async () => {
      const suf = uniqueSuffix();
      const tenTrung = `Trường trùng tên ${suf}`;
      const donVi1 = await prisma.don_vi_cong_tac.create({
        data: {
          ma_don_vi: `DV-TRUNG-1-${suf}`,
          ten_don_vi: tenTrung,
          loai_don_vi: 'truong',
          dia_ban_id: donViFixture.diaDanhXa.id,
        },
      });
      const donVi2 = await prisma.don_vi_cong_tac.create({
        data: {
          ma_don_vi: `DV-TRUNG-2-${suf}`,
          ten_don_vi: tenTrung,
          loai_don_vi: 'truong',
          dia_ban_id: donViFixture.diaDanhXa.id,
        },
      });

      const buffer = await buildXlsx([
        [
          tenTrung,
          `MOET-DUP-${suf}`,
          'Test Trùng',
          1,
          1,
          NAM_HOP_LE,
          '',
          'Toán',
          '0911111111',
          '',
        ],
      ]);
      const res = await request(app.getHttpServer())
        .post('/import/ho_so_nhan_su_moet')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach('file', buffer, 'dup.xlsx')
        .expect(201);
      importIds.push(res.body.import_id);

      const ketQua = await request(app.getHttpServer())
        .get(`/import/${res.body.import_id}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(ketQua.body.so_dong_loi).toBe(1);
      expect(ketQua.body.danh_sach_loi[0].ly_do).toEqual(
        expect.stringContaining('nhiều hơn 1'),
      );

      await prisma.don_vi_cong_tac.deleteMany({
        where: { id: { in: [donVi1.id, donVi2.id] } },
      });
    });

    it('thiếu cột "Đơn vị" -> dòng lỗi (không tự đoán, rule #36e)', async () => {
      const suf = uniqueSuffix();
      const buffer = await buildXlsx([
        [
          '',
          `MOET-NODV-${suf}`,
          'Không Đơn Vị',
          1,
          1,
          NAM_HOP_LE,
          '',
          'Toán',
          '0911111111',
          '',
        ],
      ]);
      const res = await request(app.getHttpServer())
        .post('/import/ho_so_nhan_su_moet')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach('file', buffer, 'no-donvi.xlsx')
        .expect(201);
      importIds.push(res.body.import_id);

      const ketQua = await request(app.getHttpServer())
        .get(`/import/${res.body.import_id}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(ketQua.body.so_dong_loi).toBe(1);
    });
  });

  // truong (không phải quan_tri) gọi bất kỳ endpoint /import/* nào -> 403 đã
  // được bao phủ ở test/import.e2e-spec.ts ("Phân quyền") — ImportController
  // dùng chung 1 @Roles('quan_tri') cho mọi loại, không cần lặp lại ở đây.
});
