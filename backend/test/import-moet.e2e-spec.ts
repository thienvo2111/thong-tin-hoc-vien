import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as ExcelJS from 'exceljs';
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
  // T4: đơn vị tạo thêm để test "trùng tên" mà có hoc_vien thật trỏ tới (nên
  // KHÔNG thể xóa ngay trong từng it() như 2 test rule #36e cũ — phải xóa ở
  // afterAll, sau khi đã xóa hết hoc_vien/nguoi_dung tham chiếu tới).
  const extraDonViIds: string[] = [];

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
    // FK onDelete: NoAction — PATCH /hoc-vien/toi đổi email gửi ngay email
    // xác minh (ghi nhat_ky_thong_bao), phải xóa trước khi xóa hoc_vien.
    await prisma.hang_doi_email.deleteMany({
      where: { hoc_vien_id: { in: hocVienIds } },
    });
    await prisma.nhat_ky_thong_bao.deleteMany({
      where: { hoc_vien_id: { in: hocVienIds } },
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
      await prisma.nguoi_dung.deleteMany({
        where: { id: { in: nguoiDungHocVienIds } },
      });
      await prisma.hoc_vien.deleteMany({ where: { id: { in: hocVienIds } } });
    }
    await prisma.nhat_ky_import.deleteMany({
      where: { id: { in: importIds } },
    });
    if (extraDonViIds.length > 0) {
      await prisma.don_vi_cong_tac.deleteMany({
        where: { id: { in: extraDonViIds } },
      });
    }
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

  it('GET /import/mau-excel?loai=ho_so_nhan_su_moet -> đúng 11 cột (T4: thêm "Mã đơn vị")', async () => {
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
        // Lỗi: thiếu cả Mã định danh MOET lẫn Số định danh cá nhân (T4b).
        // Không dùng "chuyên môn rỗng" — từ T4c (rule #24) không còn là lỗi.
        [
          donViFixture.donVi.ten_don_vi,
          '',
          'Nguyễn Văn E',
          1,
          1,
          NAM_HOP_LE,
          'Giáo viên',
          'Toán',
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
    // T14: PATCH /hoc-vien/toi cho import_moet giờ CHỈ được phép khi có đợt
    // xác nhận đang mở (không còn "luôn sửa được" như trước) — mở 1 đợt
    // scope toàn cục (khoa_id=NULL) bao trùm suốt describe block này.
    let dotId: string;

    beforeAll(async () => {
      const dot = await taoDotXacNhanTest();
      dotId = dot.id;
    });

    afterAll(async () => {
      await xoaDotXacNhanTest([dotId]);
    });

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

      // Hồ sơ đã da_duyet nhưng vẫn PATCH được vì có đợt xác nhận đang mở
      // (T14, xem HocVienService.kiemTraEditableVaLayDot) — đây chính là màn
      // "bổ sung thông tin".
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
      expect(res.body.xac_nhan_bi_huy).toBe(false); // chưa từng xác nhận ở đợt này

      // ĐDCN giờ dùng được cho kiểm tra trùng
      const kt = await request(app.getHttpServer())
        .get('/hoc-vien/kiem-tra-trung?so_dinh_danh_ca_nhan=198765432109')
        .expect(200);
      expect(kt.body.ton_tai).toBe(true);
    });

    it('T14: NGOÀI thời gian đợt (không có đợt nào đang mở) -> 403 DOT_XAC_NHAN_DONG', async () => {
      const suf = uniqueSuffix();
      const ma = `MOET-NODOT-${suf}`;
      const buffer = await buildXlsx([
        [
          donViFixture.donVi.ten_don_vi,
          ma,
          'Đóng Cửa Sổ',
          1,
          1,
          NAM_HOP_LE,
          'Giáo viên',
          'Toán',
          '0900111222',
          '',
        ],
      ]);
      const createRes = await request(app.getHttpServer())
        .post('/import/ho_so_nhan_su_moet')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach('file', buffer, 'moet-nodot.xlsx')
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
          .send({ ten_dang_nhap: ma, mat_khau: `0101${NAM_HOP_LE}` })
          .expect(200)
      ).body.token as string;

      // Tạm đóng đợt đang mở (dong_luc lùi về quá khứ) để mô phỏng "ngoài
      // thời gian đợt" mà không phải chờ thời gian thật trôi qua.
      await prisma.dot_xac_nhan.update({
        where: { id: dotId },
        data: { dong_luc: new Date(Date.now() - 1000) },
      });
      try {
        const res = await request(app.getHttpServer())
          .patch('/hoc-vien/toi')
          .set('Authorization', `Bearer ${token}`)
          .send({ so_dien_thoai_lien_he: '0900111223' })
          .expect(403);
        expect(res.body.error.code).toBe('DOT_XAC_NHAN_DONG');
      } finally {
        // Mở lại cho các test khác trong cùng describe block (afterAll xóa
        // hẳn đợt này nên không cần khôi phục giá trị gốc chính xác).
        await prisma.dot_xac_nhan.update({
          where: { id: dotId },
          data: { dong_luc: new Date(Date.now() + 60 * 60 * 1000) },
        });
      }
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
      // T4: thông báo phải nêu rõ các đơn vị trùng (mã) để phân biệt.
      expect(ketQua.body.danh_sach_loi[0].ly_do).toEqual(
        expect.stringContaining(donVi1.ma_don_vi as string),
      );
      expect(ketQua.body.danh_sach_loi[0].ly_do).toEqual(
        expect.stringContaining(donVi2.ma_don_vi as string),
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

  describe('T4 — chịu định dạng file thực tế (mo-rong-nls-an-giang.md)', () => {
    it('dòng tiêu đề phía trên + tiêu đề gộp ô 2 tầng + mã MOET/SĐT lưu dạng number -> không lỗi định dạng, SĐT thiếu số 0 -> cảnh báo không chặn', async () => {
      const suf = uniqueSuffix();
      const maMoetNum = 9_000_000_000 + (Date.now() % 900_000_000);

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('data');
      sheet.addRow(['DANH SÁCH GIÁO VIÊN TIẾP NHẬN']);
      sheet.addRow([`Đơn vị: ${donViFixture.donVi.ten_don_vi}`]);
      sheet.addRow([]);
      sheet.addRow([
        'Đơn vị',
        'Mã định danh (CDSL moet)',
        'Họ và tên',
        'Ngày tháng năm sinh',
        '',
        '',
        'Chức vụ',
        'Chuyên môn',
        'Số điện thoại',
        'Ghi chú',
      ]);
      sheet.mergeCells(4, 4, 4, 6);
      sheet.addRow(['', '', '', 'Ngày', 'Tháng', 'Năm', '', '', '', '']);
      sheet.addRow([
        donViFixture.donVi.ten_don_vi,
        maMoetNum, // number, không phải string
        'Kiểm Tra Thực Tế',
        8,
        8,
        NAM_HOP_LE,
        'Giáo viên',
        'Toán',
        912345678, // number, thiếu số 0 đầu (9 chữ số, bắt đầu 9)
        '',
      ]);
      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

      const res = await request(app.getHttpServer())
        .post('/import/ho_so_nhan_su_moet')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach('file', buffer, 't4-thuc-te.xlsx')
        .expect(201);
      importIds.push(res.body.import_id);

      const ketQua = await request(app.getHttpServer())
        .get(`/import/${res.body.import_id}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(ketQua.body.tong_so_dong).toBe(1);
      expect(ketQua.body.so_dong_loi).toBe(0);
      expect(ketQua.body.so_dong_thanh_cong).toBe(1);
      expect(ketQua.body.danh_sach_canh_bao).toHaveLength(1);
      expect(ketQua.body.danh_sach_canh_bao[0].ly_do).toEqual(
        expect.stringContaining('thiếu số 0 đầu'),
      );

      const xacNhanRes = await request(app.getHttpServer())
        .post(`/import/${res.body.import_id}/xac-nhan`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(201);
      expect(xacNhanRes.body.so_dong_thanh_cong).toBe(1);

      const hv = await collectCreatedHocVien(String(maMoetNum));
      expect(hv).not.toBeNull();
      expect(hv?.so_dien_thoai_lien_he).toBe('0912345678');
      expect(hv?.ho_ten).toBe('Kiểm Tra Thực Tế');
    });

    it('2 trường trùng tên + có cột "Mã đơn vị" -> khớp đúng theo mã (không lỗi)', async () => {
      const suf = uniqueSuffix();
      const tenTrung = `Trường trùng tên T4 ${suf}`;
      const donVi1 = await prisma.don_vi_cong_tac.create({
        data: {
          ma_don_vi: `DV-T4-1-${suf}`,
          ten_don_vi: tenTrung,
          loai_don_vi: 'truong',
          dia_ban_id: donViFixture.diaDanhXa.id,
        },
      });
      const donVi2 = await prisma.don_vi_cong_tac.create({
        data: {
          ma_don_vi: `DV-T4-2-${suf}`,
          ten_don_vi: tenTrung,
          loai_don_vi: 'truong',
          dia_ban_id: donViFixture.diaDanhXa.id,
        },
      });
      extraDonViIds.push(donVi1.id, donVi2.id);
      const maMoet = `MOET-T4-${suf}`;

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('data');
      sheet.addRow(['Mã đơn vị', ...COLUMNS]);
      sheet.addRow([
        donVi2.ma_don_vi,
        tenTrung,
        maMoet,
        'Test Mã Đơn Vị',
        1,
        1,
        NAM_HOP_LE,
        '',
        'Toán',
        '0911111111',
        '',
      ]);
      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

      const res = await request(app.getHttpServer())
        .post('/import/ho_so_nhan_su_moet')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach('file', buffer, 't4-ma-don-vi.xlsx')
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

      const hv = await collectCreatedHocVien(maMoet);
      expect(hv).not.toBeNull();
      expect(hv?.don_vi_cong_tac_id).toBe(donVi2.id);
    });
  });

  // truong (không phải quan_tri) gọi bất kỳ endpoint /import/* nào -> 403 đã
  // được bao phủ ở test/import.e2e-spec.ts ("Phân quyền") — ImportController
  // dùng chung 1 @Roles('quan_tri') cho mọi loại, không cần lặp lại ở đây.
});
