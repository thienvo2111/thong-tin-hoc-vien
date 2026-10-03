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
const COLUMNS = ['so_dinh_danh_ca_nhan', 'ma_dinh_danh_moet', 'ma_khoa', 'loai', 'muc'];

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

// T5 (mo-rong-nls-an-giang.md) — Import ket_qua_danh_gia: phân mức
// đầu vào/đầu ra cho dang_ky_hoc.
describe('Import ket_qua_danh_gia — phân mức đầu vào/đầu ra — T5 (e2e)', () => {
  let app: INestApplication;
  let donViFixture: Awaited<ReturnType<typeof taoDonViTest>>;
  let quanTri: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let tokenQuanTri: string;
  let khoaId: string;
  let maKhoa: string;

  const hocVienIds: string[] = [];
  const nguoiDungHocVienIds: string[] = [];
  const importIds: string[] = [];

  async function dangNhap(ten_dang_nhap: string, mat_khau: string) {
    const res = await request(app.getHttpServer())
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap, mat_khau })
      .expect(200);
    return res.body.token as string;
  }

  async function taoHocVienMoet() {
    const suf = uniqueSuffix();
    const ngay = 12;
    const thang = 7;
    const tenDangNhap = `MOET-T5-${suf}`;
    const hocVien = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: tenDangNhap,
        ho_ten: 'Học Viên T5',
        ngay_sinh: ngay,
        thang_sinh: thang,
        nam_sinh: NAM_HOP_LE,
        don_vi_cong_tac_id: donViFixture.donVi.id,
        so_dien_thoai_lien_he: '0900000001',
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
    const token = await dangNhap(tenDangNhap, ddmmyyyy(ngay, thang, NAM_HOP_LE));
    return { hocVien, tenDangNhap, token };
  }

  beforeAll(async () => {
    app = await createTestApp();
    donViFixture = await taoDonViTest('t5');
    quanTri = await taoNguoiDungTest({
      vai_tro: 'quan_tri',
      don_vi_id: donViFixture.donVi.id,
      mat_khau: 'MatKhau123',
    });
    tokenQuanTri = await dangNhap(quanTri.ten_dang_nhap, 'MatKhau123');

    const suf = uniqueSuffix();
    maKhoa = `KHOA-T5-${suf}`;
    const khoa = await prisma.khoa_boi_duong.create({
      data: {
        ma_khoa: maKhoa,
        ten_khoa: `Khóa test T5 ${suf}`,
        don_vi_dat_hang_id: donViFixture.donVi.id,
        thoi_gian_bat_dau: new Date(),
        thoi_gian_ket_thuc: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        trang_thai: 'da_duyet',
        created_by: quanTri.nguoiDung.id,
        nguoi_duyet_id: quanTri.nguoiDung.id,
        cap_duyet_thuc_te: 'quan_tri',
        ngay_duyet: new Date(),
      },
    });
    khoaId = khoa.id;
  });

  afterAll(async () => {
    await prisma.dang_ky_hoc.deleteMany({ where: { khoa_id: khoaId } });
    await prisma.khoa_boi_duong.delete({ where: { id: khoaId } });
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
    await prisma.hoc_vien.deleteMany({ where: { id: { in: hocVienIds } } });
    await xoaNguoiDungTest(quanTri.nguoiDung.id);
    await xoaDonViTest([donViFixture.donVi.id], [
      donViFixture.diaDanhXa.id,
      donViFixture.diaDanhTinh.id,
    ]);
    await prisma.$disconnect();
    await app.close();
  });

  it('học viên CHƯA ghi danh vào khóa -> dòng lỗi rõ ràng, không tạo dang_ky_hoc', async () => {
    const { hocVien, tenDangNhap } = await taoHocVienMoet();
    const buffer = await buildXlsx([
      [undefined, tenDangNhap, maKhoa, 'dau_vao', 'co_ban'],
    ]);
    const res = await request(app.getHttpServer())
      .post('/import/ket_qua_danh_gia')
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .attach('file', buffer, 'kqdg-chua-ghi-danh.xlsx')
      .expect(201);
    importIds.push(res.body.import_id);

    const ketQua = await request(app.getHttpServer())
      .get(`/import/${res.body.import_id}`)
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .expect(200);
    expect(ketQua.body.so_dong_loi).toBe(1);
    expect(ketQua.body.danh_sach_loi[0].ly_do).toEqual(
      expect.stringContaining('chưa được ghi danh'),
    );
    expect(ketQua.body.danh_sach_loi[0].ly_do).toEqual(
      expect.stringContaining('T3'),
    );

    const dangKy = await prisma.dang_ky_hoc.findUnique({
      where: {
        hoc_vien_id_khoa_id: { hoc_vien_id: hocVien.id, khoa_id: khoaId },
      },
    });
    expect(dangKy).toBeNull();
  });

  it('học viên đã ghi danh nhưng CHƯA đủ điều kiện đánh giá đầu vào -> vẫn nhập thành công, kèm cảnh báo lách cổng', async () => {
    const { hocVien, tenDangNhap } = await taoHocVienMoet();
    // taoHocVienMoet() tạo hồ sơ tối thiểu (thiếu noi_sinh/phuong_xa/trình
    // độ/chuyên môn/email) -> day_du chắc chắn false, không cần setup thêm
    // để mô phỏng "chưa đủ điều kiện".
    await prisma.dang_ky_hoc.create({
      data: {
        hoc_vien_id: hocVien.id,
        khoa_id: khoaId,
        trang_thai: 'da_duyet',
      },
    });
    const buffer = await buildXlsx([
      [undefined, tenDangNhap, maKhoa, 'dau_vao', 'co_ban'],
    ]);
    const res = await request(app.getHttpServer())
      .post('/import/ket_qua_danh_gia')
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .attach('file', buffer, 'kqdg-lach-cong.xlsx')
      .expect(201);
    importIds.push(res.body.import_id);

    const ketQua = await request(app.getHttpServer())
      .get(`/import/${res.body.import_id}`)
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .expect(200);
    expect(ketQua.body.so_dong_loi).toBe(0);
    expect(ketQua.body.danh_sach_canh_bao).toHaveLength(1);
    expect(ketQua.body.danh_sach_canh_bao[0].ly_do).toEqual(
      expect.stringContaining('lách cổng'),
    );

    await request(app.getHttpServer())
      .post(`/import/${res.body.import_id}/xac-nhan`)
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .expect(201);
    const dangKy = await prisma.dang_ky_hoc.findUnique({
      where: {
        hoc_vien_id_khoa_id: { hoc_vien_id: hocVien.id, khoa_id: khoaId },
      },
    });
    expect(dangKy?.muc_dau_vao).toBe('co_ban');
  });

  it('học viên ĐÃ ghi danh: import mức đầu vào, sau đó chạy lại đổi mức -> ghi đè đúng cột; không đụng cột còn lại', async () => {
    const { hocVien, tenDangNhap, token } = await taoHocVienMoet();
    await prisma.dang_ky_hoc.create({
      data: {
        hoc_vien_id: hocVien.id,
        khoa_id: khoaId,
        trang_thai: 'da_duyet',
      },
    });

    // Lượt 1: đầu vào = co_ban.
    const buffer1 = await buildXlsx([
      [undefined, tenDangNhap, maKhoa, 'dau_vao', 'co_ban'],
    ]);
    const res1 = await request(app.getHttpServer())
      .post('/import/ket_qua_danh_gia')
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .attach('file', buffer1, 'kqdg-1.xlsx')
      .expect(201);
    importIds.push(res1.body.import_id);
    const ketQua1 = await request(app.getHttpServer())
      .get(`/import/${res1.body.import_id}`)
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .expect(200);
    expect(ketQua1.body.so_dong_loi).toBe(0);
    await request(app.getHttpServer())
      .post(`/import/${res1.body.import_id}/xac-nhan`)
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .expect(201);

    let dangKy = await prisma.dang_ky_hoc.findUnique({
      where: {
        hoc_vien_id_khoa_id: { hoc_vien_id: hocVien.id, khoa_id: khoaId },
      },
    });
    expect(dangKy?.muc_dau_vao).toBe('co_ban');
    expect(dangKy?.muc_dau_ra).toBeNull();

    // Lượt 2: chạy lại cùng loai="dau_vao" nhưng đổi mức -> ghi đè.
    const buffer2 = await buildXlsx([
      [undefined, tenDangNhap, maKhoa, 'dau_vao', 'nang_cao'],
    ]);
    const res2 = await request(app.getHttpServer())
      .post('/import/ket_qua_danh_gia')
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .attach('file', buffer2, 'kqdg-2.xlsx')
      .expect(201);
    importIds.push(res2.body.import_id);
    await request(app.getHttpServer())
      .post(`/import/${res2.body.import_id}/xac-nhan`)
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .expect(201);

    dangKy = await prisma.dang_ky_hoc.findUnique({
      where: {
        hoc_vien_id_khoa_id: { hoc_vien_id: hocVien.id, khoa_id: khoaId },
      },
    });
    expect(dangKy?.muc_dau_vao).toBe('nang_cao');
    expect(dangKy?.muc_dau_ra).toBeNull();

    // Lượt 3: loai="dau_ra" -> chỉ set muc_dau_ra, không đụng muc_dau_vao.
    const buffer3 = await buildXlsx([
      [undefined, tenDangNhap, maKhoa, 'dau_ra', 'thanh_thao'],
    ]);
    const res3 = await request(app.getHttpServer())
      .post('/import/ket_qua_danh_gia')
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .attach('file', buffer3, 'kqdg-3.xlsx')
      .expect(201);
    importIds.push(res3.body.import_id);
    await request(app.getHttpServer())
      .post(`/import/${res3.body.import_id}/xac-nhan`)
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .expect(201);

    dangKy = await prisma.dang_ky_hoc.findUnique({
      where: {
        hoc_vien_id_khoa_id: { hoc_vien_id: hocVien.id, khoa_id: khoaId },
      },
    });
    expect(dangKy?.muc_dau_vao).toBe('nang_cao');
    expect(dangKy?.muc_dau_ra).toBe('thanh_thao');

    // GET /hoc-vien/toi/khoa-hoc trả thêm muc_dau_vao/muc_dau_ra.
    const khoaHoc = await request(app.getHttpServer())
      .get('/hoc-vien/toi/khoa-hoc')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const entry = khoaHoc.body.find(
      (r: { khoa: { id: string } }) => r.khoa.id === khoaId,
    );
    expect(entry).toBeDefined();
    expect(entry.muc_dau_vao).toBe('nang_cao');
    expect(entry.muc_dau_ra).toBe('thanh_thao');
  });
});
