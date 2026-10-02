import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as ExcelJS from 'exceljs';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoDonViTest,
  taoNguoiDungTest,
  uniqueSuffix,
  xoaNguoiDungTest,
  xoaDonViTest,
} from './utils/test-data';
import {
  timPhanLopChuaCoGiaiDoan,
  timXungDotChuyenPhanLop,
} from '../src/khoa-boi-duong/util/chuyen-phan-lop.util';

const NAM_HOP_LE = new Date().getUTCFullYear() - 20;

async function buildXlsx(rows: (string | undefined)[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('data');
  rows.forEach((r) => sheet.addRow(r));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// Phân lớp theo giai đoạn (spec 2026-10-02-phan-lop-theo-giai-doan).
describe('Phân lớp theo giai đoạn (e2e)', () => {
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

  async function taoKhoa() {
    const suf = uniqueSuffix();
    const res = await request(app.getHttpServer())
      .post('/khoa-boi-duong')
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .send({
        ma_khoa: `K-PL-${suf}`,
        ten_khoa: `Khóa test phân lớp ${suf}`,
        don_vi_to_chuc_id: donViFixture.donVi.id,
        thoi_gian_bat_dau: '2026-01-01',
        thoi_gian_ket_thuc: '2026-12-31',
      })
      .expect(201);
    khoaIds.push(res.body.id);
    return res.body as { id: string; ma_khoa: string };
  }

  function taoGiaiDoan(
    khoaId: string,
    thuTu: number,
    overrides: Partial<Prisma.giai_doan_khoaUncheckedCreateInput> = {},
  ) {
    return prisma.giai_doan_khoa.create({
      data: {
        khoa_id: khoaId,
        thu_tu: thuTu,
        ten_giai_doan: `Giai đoạn ${thuTu}`,
        hinh_thuc: 'truc_tuyen',
        thoi_gian_bat_dau: new Date('2026-01-01'),
        thoi_gian_ket_thuc: new Date('2026-12-31'),
        ...overrides,
      },
    });
  }

  function taoLop(
    khoaId: string,
    loai: 'truc_tiep' | 'zoom' | 'vle',
    ten: string,
  ) {
    return prisma.lop_hoc.create({
      data: { khoa_id: khoaId, loai_lop: loai, ten_lop: ten },
    });
  }

  function taoBuoi(lopId: string, giaiDoanId: string, buoiSo: number) {
    return prisma.lich_hoc_lop.create({
      data: {
        lop_id: lopId,
        giai_doan_id: giaiDoanId,
        buoi_so: buoiSo,
        thoi_gian_bat_dau: new Date('2026-10-10T01:00:00Z'),
        thoi_gian_ket_thuc: new Date('2026-10-10T04:00:00Z'),
      },
    });
  }

  async function taoHocVienMoet(suf: string) {
    const tenDangNhap = `MOET-PL-${suf}`;
    const hocVien = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: tenDangNhap,
        ho_ten: 'Học Viên Phân Lớp',
        ngay_sinh: 15,
        thang_sinh: 6,
        nam_sinh: NAM_HOP_LE,
        don_vi_cong_tac_id: donViFixture.donVi.id,
        so_dien_thoai_lien_he: '0900000003',
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
    hocVienIds.push(hocVien.id);
    nguoiDungHocVienIds.push(nguoiDung.id);
    return { hocVien, tenDangNhap };
  }

  function ghiDanh(hocVienId: string, khoaId: string) {
    return prisma.dang_ky_hoc.create({
      data: { hoc_vien_id: hocVienId, khoa_id: khoaId, trang_thai: 'da_duyet' },
    });
  }

  beforeAll(async () => {
    app = await createTestApp();
    donViFixture = await taoDonViTest('pl');
    quanTri = await taoNguoiDungTest({
      vai_tro: 'quan_tri',
      don_vi_id: donViFixture.donVi.id,
      mat_khau: 'MatKhau123',
    });
    tokenQuanTri = await dangNhap(quanTri.ten_dang_nhap, 'MatKhau123');
  });

  afterAll(async () => {
    const dkWhere = { dang_ky_hoc: { khoa_id: { in: khoaIds } } };
    await prisma.phan_lop_giai_doan.deleteMany({ where: dkWhere });
    await prisma.diem_danh.deleteMany({ where: dkWhere });
    await prisma.ket_qua_giai_doan.deleteMany({ where: dkWhere });
    await prisma.hang_doi_email.deleteMany({
      where: { hoc_vien_id: { in: hocVienIds } },
    });
    await prisma.dang_ky_hoc.deleteMany({
      where: { khoa_id: { in: khoaIds } },
    });
    await prisma.lich_hoc_lop.deleteMany({
      where: { lop: { khoa_id: { in: khoaIds } } },
    });
    await prisma.lop_hoc_nhan_su.deleteMany({
      where: { lop: { khoa_id: { in: khoaIds } } },
    });
    await prisma.lop_hoc.deleteMany({ where: { khoa_id: { in: khoaIds } } });
    await prisma.cum_hoc_vien.deleteMany({
      where: { khoa_id: { in: khoaIds } },
    });
    await prisma.giai_doan_khoa.deleteMany({
      where: { khoa_id: { in: khoaIds } },
    });
    // Lượt import lỗi cả file (400) cũng ghi nhat_ky_import với id ngẫu nhiên
    // -> dọn theo người import thay vì chỉ theo importIds.
    await prisma.nhat_ky_import.deleteMany({
      where: {
        OR: [
          { id: { in: importIds } },
          { nguoi_import_id: quanTri.nguoiDung.id },
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
    }
    await prisma.nguoi_dung.deleteMany({
      where: { id: { in: nguoiDungHocVienIds } },
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

  describe('Giai đoạn: link_hoac_dia_diem + huong_dan', () => {
    it('tạo kèm link/hướng dẫn, sửa thành null, link > 500 ký tự -> 400', async () => {
      const khoa = await taoKhoa();
      const tao = await request(app.getHttpServer())
        .post(`/khoa-boi-duong/${khoa.id}/giai-doan`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({
          thu_tu: 1,
          ten_giai_doan: 'Đánh giá đầu vào',
          hinh_thuc: 'danh_gia',
          thoi_gian_bat_dau: '2026-10-06',
          thoi_gian_ket_thuc: '2026-10-10',
          link_hoac_dia_diem: 'https://vle.hcmue.edu.vn/danh-gia',
          huong_dan: 'Làm bài trong 60 phút',
        })
        .expect(201);
      expect(tao.body.link_hoac_dia_diem).toBe(
        'https://vle.hcmue.edu.vn/danh-gia',
      );
      expect(tao.body.huong_dan).toBe('Làm bài trong 60 phút');

      const sua = await request(app.getHttpServer())
        .patch(`/khoa-boi-duong/${khoa.id}/giai-doan/${tao.body.id}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({ link_hoac_dia_diem: null, huong_dan: null })
        .expect(200);
      expect(sua.body.link_hoac_dia_diem).toBeNull();
      expect(sua.body.huong_dan).toBeNull();

      await request(app.getHttpServer())
        .patch(`/khoa-boi-duong/${khoa.id}/giai-doan/${tao.body.id}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({ link_hoac_dia_diem: 'x'.repeat(501) })
        .expect(400);
    });
  });

  describe('PUT /dang-ky-hoc/:id/giai-doan/:gdId/lop', () => {
    let gd2: { id: string };
    let lopZoom: { id: string };
    let lopTT: { id: string };
    let dkId: string;

    beforeAll(async () => {
      const khoa = await taoKhoa();
      await taoGiaiDoan(khoa.id, 1, { hinh_thuc: 'danh_gia' });
      gd2 = await taoGiaiDoan(khoa.id, 2);
      lopZoom = await taoLop(khoa.id, 'zoom', 'Zoom gán tay');
      lopTT = await taoLop(khoa.id, 'truc_tiep', 'TT gán tay');
      await taoBuoi(lopZoom.id, gd2.id, 1);
      const { hocVien } = await taoHocVienMoet(uniqueSuffix());
      dkId = (await ghiDanh(hocVien.id, khoa.id)).id;
    });

    const put = (gdId: string, lop_id: string | null, token?: string) =>
      request(app.getHttpServer())
        .put(`/dang-ky-hoc/${dkId}/giai-doan/${gdId}/lop`)
        .set('Authorization', `Bearer ${token ?? tokenQuanTri}`)
        .send({ lop_id });

    it('gán -> 200, đăng ký thành da_phan_lop, không cảnh báo', async () => {
      const res = await put(gd2.id, lopZoom.id).expect(200);
      expect(res.body.phan_lop.lop_id).toBe(lopZoom.id);
      expect(res.body.canh_bao).toBeUndefined();
      const dk = await prisma.dang_ky_hoc.findUniqueOrThrow({
        where: { id: dkId },
      });
      expect(dk.trang_thai).toBe('da_phan_lop');
    });

    it('thay bằng lớp không có buổi trong GĐ + sai hình thức -> 200 kèm canh_bao, vẫn 1 dòng', async () => {
      const res = await put(gd2.id, lopTT.id).expect(200);
      expect(res.body.canh_bao).toContain('không có buổi nào trong giai đoạn');
      expect(res.body.canh_bao).toContain(
        'lớp trực tiếp nhưng giai đoạn là trực tuyến',
      );
      expect(
        await prisma.phan_lop_giai_doan.count({
          where: { dang_ky_hoc_id: dkId },
        }),
      ).toBe(1);
    });

    it('lop_id null -> gỡ, trạng thái đăng ký giữ da_phan_lop', async () => {
      const res = await put(gd2.id, null).expect(200);
      expect(res.body.phan_lop).toBeNull();
      expect(
        await prisma.phan_lop_giai_doan.count({
          where: { dang_ky_hoc_id: dkId },
        }),
      ).toBe(0);
      const dk = await prisma.dang_ky_hoc.findUniqueOrThrow({
        where: { id: dkId },
      });
      expect(dk.trang_thai).toBe('da_phan_lop');
    });

    it('lớp hoặc giai đoạn của khóa khác -> 400', async () => {
      const khoaKhac = await taoKhoa();
      const gdKhac = await taoGiaiDoan(khoaKhac.id, 1);
      const lopKhac = await taoLop(khoaKhac.id, 'zoom', 'Zoom khóa khác');
      await put(gd2.id, lopKhac.id).expect(400);
      await put(gdKhac.id, lopZoom.id).expect(400);
    });

    it('Trường không phải chủ khóa -> 403', async () => {
      const donViKhac = await taoDonViTest('plk');
      const truongKhac = await taoNguoiDungTest({
        vai_tro: 'truong',
        don_vi_id: donViKhac.donVi.id,
        mat_khau: 'MatKhau123',
      });
      try {
        const token = await dangNhap(truongKhac.ten_dang_nhap, 'MatKhau123');
        await put(gd2.id, lopZoom.id, token).expect(403);
      } finally {
        await xoaNguoiDungTest(truongKhac.nguoiDung.id);
        await xoaDonViTest(
          [donViKhac.donVi.id],
          [donViKhac.diaDanhXa.id, donViKhac.diaDanhTinh.id],
        );
      }
    });
  });

  describe('Import phan_lop_hoc_vien theo giai đoạn', () => {
    let khoa: { id: string; ma_khoa: string };
    let hv: { hocVien: { id: string }; tenDangNhap: string };
    const H = ['so_dinh_danh_ca_nhan', 'ma_dinh_danh_moet'];

    async function taiLenPhanLop(maKhoa: string, rows: string[][]) {
      const res = await request(app.getHttpServer())
        .post(`/import/phan_lop_hoc_vien?ma_khoa=${encodeURIComponent(maKhoa)}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach('file', await buildXlsx(rows), 'phan-lop.xlsx');
      expect(res.status).toBe(201);
      importIds.push(res.body.import_id);
      const ketQua = await request(app.getHttpServer())
        .get(`/import/${res.body.import_id}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      return {
        importId: res.body.import_id as string,
        ketQua: ketQua.body as {
          so_dong_loi: number;
          so_dong_thanh_cong: number;
          danh_sach_loi: { dong: number; ly_do: string }[];
          danh_sach_canh_bao: { dong: number; ly_do: string }[];
        },
      };
    }

    async function xacNhan(importId: string) {
      await request(app.getHttpServer())
        .post(`/import/${importId}/xac-nhan`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(201);
    }

    // Tải mẫu và trả dòng tiêu đề.
    async function taiMauHeader(maKhoa: string) {
      const res = await request(app.getHttpServer())
        .get(
          `/import/mau-excel?loai=phan_lop_hoc_vien&ma_khoa=${encodeURIComponent(maKhoa)}`,
        )
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .buffer(true)
        .parse((r, cb) => {
          const c: Buffer[] = [];
          r.on('data', (x: Buffer) => c.push(x));
          r.on('end', () => cb(null, Buffer.concat(c)));
        })
        .expect(200);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(res.body as unknown as ExcelJS.Buffer);
      return (wb.worksheets[0].getRow(1).values as unknown[]).slice(1);
    }

    const phanLop = () =>
      prisma.phan_lop_giai_doan
        .findMany({
          where: {
            dang_ky_hoc: { hoc_vien_id: hv.hocVien.id, khoa_id: khoa.id },
          },
          include: { lop: true, giai_doan: true },
        })
        .then((r) =>
          Object.fromEntries(r.map((x) => [x.giai_doan.thu_tu, x.lop.ten_lop])),
        );

    beforeAll(async () => {
      khoa = await taoKhoa();
      await taoGiaiDoan(khoa.id, 1, { hinh_thuc: 'danh_gia' });
      const gd2 = await taoGiaiDoan(khoa.id, 2);
      const gd3 = await taoGiaiDoan(khoa.id, 3);
      await taoGiaiDoan(khoa.id, 4, { trang_thai: 'ngung' });
      const z3 = await taoLop(khoa.id, 'zoom', 'Lớp zoom 3');
      const v3 = await taoLop(khoa.id, 'vle', 'Lớp VLE 3');
      await taoLop(khoa.id, 'vle', 'Lớp VLE 5');
      await taoBuoi(z3.id, gd2.id, 1);
      await taoBuoi(v3.id, gd3.id, 1);
      await taoLop(khoa.id, 'zoom', 'Trùng tên');
      await taoLop(khoa.id, 'vle', 'Trùng tên');
      await prisma.cum_hoc_vien.create({
        data: { khoa_id: khoa.id, ten_cum: 'Cụm 1' },
      });
      hv = await taoHocVienMoet(uniqueSuffix());
    });

    it('mẫu: chỉ GĐ active, đúng thứ tự, có ten_cum; thiếu ma_khoa -> 400', async () => {
      expect(await taiMauHeader(khoa.ma_khoa)).toEqual([
        'so_dinh_danh_ca_nhan',
        'ma_dinh_danh_moet',
        'GĐ1 - Giai đoạn 1',
        'GĐ2 - Giai đoạn 2',
        'GĐ3 - Giai đoạn 3',
        'ten_cum',
      ]);
      await request(app.getHttpServer())
        .get('/import/mau-excel?loai=phan_lop_hoc_vien')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(400);
    });

    it('gán GĐ2 + GĐ3 + cụm (tên lớp dạng NFD vẫn khớp) -> da_phan_lop', async () => {
      const { importId, ketQua } = await taiLenPhanLop(khoa.ma_khoa, [
        [...H, 'GĐ2 - x', 'GĐ3 - y', 'ten_cum'],
        [
          '',
          hv.tenDangNhap,
          'Lớp zoom 3'.normalize('NFD'),
          'Lớp VLE 3',
          'Cụm 1',
        ],
      ]);
      expect(ketQua.danh_sach_loi).toEqual([]);
      expect(ketQua.danh_sach_canh_bao).toEqual([]);
      await xacNhan(importId);
      expect(await phanLop()).toEqual({ 2: 'Lớp zoom 3', 3: 'Lớp VLE 3' });
      const dk = await prisma.dang_ky_hoc.findUniqueOrThrow({
        where: {
          hoc_vien_id_khoa_id: { hoc_vien_id: hv.hocVien.id, khoa_id: khoa.id },
        },
        include: { cum: true },
      });
      expect(dk.trang_thai).toBe('da_phan_lop');
      expect(dk.cum?.ten_cum).toBe('Cụm 1');
    });

    it('file chỉ có cột GĐ3 đổi lớp -> GĐ2 giữ nguyên; lớp không có buổi trong GĐ -> cảnh báo', async () => {
      const { importId, ketQua } = await taiLenPhanLop(khoa.ma_khoa, [
        [...H, 'GĐ3'],
        ['', hv.tenDangNhap, 'Lớp VLE 5'],
      ]);
      expect(ketQua.danh_sach_canh_bao[0].ly_do).toContain(
        'không có buổi nào trong giai đoạn',
      );
      await xacNhan(importId);
      expect(await phanLop()).toEqual({ 2: 'Lớp zoom 3', 3: 'Lớp VLE 5' });
    });

    it('ô "-" gỡ, ô trống giữ, trạng thái đăng ký không đổi', async () => {
      const { importId } = await taiLenPhanLop(khoa.ma_khoa, [
        [...H, 'GĐ2', 'GĐ3'],
        ['', hv.tenDangNhap, '-', ''],
      ]);
      await xacNhan(importId);
      expect(await phanLop()).toEqual({ 3: 'Lớp VLE 5' });
    });

    it.each([
      ['lớp không tồn tại', 'Lớp ma', 'không tồn tại'],
      ['tên trùng nhiều loại lớp', 'Trùng tên', 'nhiều loại lớp'],
    ])('%s -> dòng lỗi', async (_t, tenLop, chua) => {
      const { ketQua } = await taiLenPhanLop(khoa.ma_khoa, [
        [...H, 'GĐ2'],
        ['', hv.tenDangNhap, tenLop],
      ]);
      expect(ketQua.so_dong_loi).toBe(1);
      expect(ketQua.danh_sach_loi[0].ly_do).toContain(chua);
    });

    it('học viên lặp 2 dòng -> dòng sau lỗi', async () => {
      const { ketQua } = await taiLenPhanLop(khoa.ma_khoa, [
        [...H, 'GĐ2'],
        ['', hv.tenDangNhap, ''],
        ['', hv.tenDangNhap, ''],
      ]);
      expect(ketQua.so_dong_loi).toBe(1);
      expect(ketQua.danh_sach_loi[0].ly_do).toContain('trùng');
    });

    it('cột GĐ4 (giai đoạn đã ngừng) hoặc mẫu cũ -> lỗi cả file (400)', async () => {
      for (const header of [
        [...H, 'GĐ4'],
        [...H, 'ma_khoa', 'ten_lop'],
      ]) {
        const res = await request(app.getHttpServer())
          .post(`/import/phan_lop_hoc_vien?ma_khoa=${khoa.ma_khoa}`)
          .set('Authorization', `Bearer ${tokenQuanTri}`)
          .attach(
            'file',
            await buildXlsx([header, ['', hv.tenDangNhap, 'x', 'y']]),
            'pl.xlsx',
          );
        expect(res.status).toBe(400);
      }
    });

    it('POST thiếu ma_khoa -> 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/import/phan_lop_hoc_vien')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach(
          'file',
          await buildXlsx([
            [...H, 'GĐ2'],
            ['', hv.tenDangNhap, ''],
          ]),
          'pl.xlsx',
        );
      expect(res.status).toBe(400);
    });
  });

  describe('diem_danh: học bù so với lớp được gán ở giai đoạn của buổi', () => {
    async function taiLenDiemDanh(rows: string[][]) {
      const res = await request(app.getHttpServer())
        .post('/import/diem_danh')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach(
          'file',
          await buildXlsx([
            [
              'so_dinh_danh_ca_nhan',
              'ma_dinh_danh_moet',
              'ma_khoa',
              'ten_lop',
              'loai_lop',
              'giai_doan_thu_tu',
              'buoi_so',
              'trang_thai',
              'nguon',
              'ghi_chu',
            ],
            ...rows,
          ]),
          'diem-danh.xlsx',
        )
        .expect(201);
      importIds.push(res.body.import_id);
      const ketQua = await request(app.getHttpServer())
        .get(`/import/${res.body.import_id}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      return ketQua.body as {
        danh_sach_loi: { dong: number; ly_do: string }[];
        danh_sach_canh_bao: { dong: number; ly_do: string }[];
      };
    }

    it('đúng lớp GĐ -> không cần ghi chú; lớp khác cùng GĐ hoặc chưa gán GĐ -> bắt buộc ghi chú', async () => {
      const khoa = await taoKhoa();
      const gd2 = await taoGiaiDoan(khoa.id, 2);
      const gd3 = await taoGiaiDoan(khoa.id, 3);
      const zA = await taoLop(khoa.id, 'zoom', 'Zoom A');
      const zB = await taoLop(khoa.id, 'zoom', 'Zoom B');
      await taoBuoi(zA.id, gd2.id, 1);
      await taoBuoi(zB.id, gd2.id, 1);
      await taoBuoi(zA.id, gd3.id, 1);
      const hv = await taoHocVienMoet(uniqueSuffix());
      const dk = await ghiDanh(hv.hocVien.id, khoa.id);
      await prisma.phan_lop_giai_doan.create({
        data: { dang_ky_hoc_id: dk.id, giai_doan_id: gd2.id, lop_id: zA.id },
      });

      const dong = (lop: string, gd: number, ghiChu = '') => [
        '',
        hv.tenDangNhap,
        khoa.ma_khoa,
        lop,
        'zoom',
        String(gd),
        '1',
        'co_mat',
        'zoom',
        ghiChu,
      ];
      const ketQua = await taiLenDiemDanh([
        dong('Zoom A', 2), // đúng lớp GĐ2 -> OK
        dong('Zoom B', 2), // lớp khác cùng GĐ, thiếu ghi chú -> lỗi
        dong('Zoom A', 3), // chưa gán GĐ3, thiếu ghi chú -> lỗi
        dong('Zoom B', 2, 'học bù'), // có ghi chú -> OK + cảnh báo
      ]);
      expect(ketQua.danh_sach_loi.map((l) => l.dong)).toEqual([3, 4]);
      expect(ketQua.danh_sach_canh_bao.map((c) => c.dong)).toEqual([5]);
    });
  });

  describe('Đường đọc theo giai đoạn', () => {
    it('khoa-hoc của học viên: mọi GĐ active theo thứ tự; GĐ có lớp chỉ kèm buổi của GĐ đó; GĐ không lớp có link/hướng dẫn; tiến độ ghép đúng GĐ', async () => {
      const khoa = await taoKhoa();
      await taoGiaiDoan(khoa.id, 1, {
        hinh_thuc: 'danh_gia',
        link_hoac_dia_diem: 'https://x/dg',
        huong_dan: 'Làm bài',
      });
      const gd2 = await taoGiaiDoan(khoa.id, 2);
      const gd3 = await taoGiaiDoan(khoa.id, 3);
      await taoGiaiDoan(khoa.id, 4, { trang_thai: 'ngung' });
      const z = await taoLop(khoa.id, 'zoom', 'Zoom đọc');
      await taoBuoi(z.id, gd2.id, 1);
      await taoBuoi(z.id, gd3.id, 1); // buổi GĐ3 KHÔNG được hiện dưới GĐ2
      const hv = await taoHocVienMoet(uniqueSuffix());
      const dk = await ghiDanh(hv.hocVien.id, khoa.id);
      await prisma.phan_lop_giai_doan.create({
        data: { dang_ky_hoc_id: dk.id, giai_doan_id: gd2.id, lop_id: z.id },
      });
      await prisma.ket_qua_giai_doan.create({
        data: {
          dang_ky_hoc_id: dk.id,
          giai_doan_id: gd2.id,
          ty_le_hoan_thanh: 80,
        },
      });
      const token = await dangNhap(hv.tenDangNhap, 'x');

      const res = await request(app.getHttpServer())
        .get('/hoc-vien/toi/khoa-hoc')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const entry = res.body.find(
        (r: { khoa_id: string }) => r.khoa_id === khoa.id,
      );
      expect(entry.lop_zoom).toBeUndefined();
      expect(entry.khoa.ma_khoa).toBe(khoa.ma_khoa);
      expect(entry.giai_doan.map((g: { thu_tu: number }) => g.thu_tu)).toEqual([
        1, 2, 3,
      ]);
      const [g1, g2, g3] = entry.giai_doan;
      expect(g1).toMatchObject({
        lop: null,
        link_hoac_dia_diem: 'https://x/dg',
        huong_dan: 'Làm bài',
        tien_do: null,
      });
      expect(g2.lop.ten_lop).toBe('Zoom đọc');
      expect(g2.lop.loai_lop).toBe('zoom');
      expect(g2.lop.lich_hoc).toHaveLength(1);
      expect(g2.lop.lich_hoc[0].giai_doan_id).toBe(gd2.id);
      expect(g2.lop.lich_hoc[0].trang_thai_diem_danh).toBeNull();
      expect(g2.tien_do).toEqual({ ty_le_hoan_thanh: 80, diem: null });
      expect(g3.lop).toBeNull();

      const kq = await request(app.getHttpServer())
        .get('/hoc-vien/toi/ket-qua')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const entryKq = kq.body.find(
        (r: { khoa: { id: string } }) => r.khoa.id === khoa.id,
      );
      expect(entryKq.lop_zoom).toBeUndefined();
      expect(entryKq.phan_lop).toEqual([
        {
          thu_tu: 2,
          ten_giai_doan: 'Giai đoạn 2',
          lop: { id: z.id, ten_lop: 'Zoom đọc' },
        },
      ]);
    });

    it('chi tiết khóa: si_so_hien_tai đếm đăng ký khác nhau (1 học viên ở 2 GĐ cùng lớp = 1)', async () => {
      const khoa = await taoKhoa();
      const gd2 = await taoGiaiDoan(khoa.id, 2);
      const gd3 = await taoGiaiDoan(khoa.id, 3);
      const v = await taoLop(khoa.id, 'vle', 'VLE sĩ số');
      const rong = await taoLop(khoa.id, 'zoom', 'Zoom rỗng');
      const hv = await taoHocVienMoet(uniqueSuffix());
      const dk = await ghiDanh(hv.hocVien.id, khoa.id);
      await prisma.phan_lop_giai_doan.createMany({
        data: [
          { dang_ky_hoc_id: dk.id, giai_doan_id: gd2.id, lop_id: v.id },
          { dang_ky_hoc_id: dk.id, giai_doan_id: gd3.id, lop_id: v.id },
        ],
      });
      const res = await request(app.getHttpServer())
        .get(`/khoa-boi-duong/${khoa.id}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      const lop = (id: string) =>
        res.body.lop_hoc.find((l: { id: string }) => l.id === id);
      expect(lop(v.id).si_so_hien_tai).toBe(1);
      expect(lop(rong.id).si_so_hien_tai).toBe(0);
    });

    it('đổi loai_lop của lớp đang có học viên -> 200 kèm canh_bao đếm theo đăng ký', async () => {
      const khoa = await taoKhoa();
      const gd2 = await taoGiaiDoan(khoa.id, 2);
      const gd3 = await taoGiaiDoan(khoa.id, 3);
      const v = await taoLop(khoa.id, 'vle', 'VLE đổi loại');
      const hv = await taoHocVienMoet(uniqueSuffix());
      const dk = await ghiDanh(hv.hocVien.id, khoa.id);
      await prisma.phan_lop_giai_doan.createMany({
        data: [
          { dang_ky_hoc_id: dk.id, giai_doan_id: gd2.id, lop_id: v.id },
          { dang_ky_hoc_id: dk.id, giai_doan_id: gd3.id, lop_id: v.id },
        ],
      });
      const res = await request(app.getHttpServer())
        .patch(`/khoa-boi-duong/${khoa.id}/lop/${v.id}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({ loai_lop: 'zoom' })
        .expect(200);
      expect(res.body.canh_bao).toContain('1 đăng ký học');
    });
  });

  // Script kiểm tra trước khi deploy migration 20261002090100 (bảng nguồn
  // dang_ky_hoc_lop còn trong DB tới khi migration DROP chạy) — model Prisma
  // đã gỡ nên dựng dữ liệu bằng SQL thô.
  describe('Kiểm tra trước khi chuyển dang_ky_hoc_lop (chỉ đọc)', () => {
    const ganLopCu = (dkId: string, lopId: string, loai: string) =>
      prisma.$executeRawUnsafe(
        `INSERT INTO "dang_ky_hoc_lop" ("dang_ky_hoc_id", "lop_id", "loai_lop") VALUES ($1::uuid, $2::uuid, $3::loai_lop_hoc)`,
        dkId,
        lopId,
        loai,
      );

    afterAll(async () => {
      await prisma.$executeRawUnsafe(
        `DELETE FROM "dang_ky_hoc_lop" WHERE "dang_ky_hoc_id" IN (SELECT "id" FROM "dang_ky_hoc" WHERE "khoa_id" = ANY($1::uuid[]))`,
        khoaIds,
      );
    });

    it('báo lớp chưa có buổi (sẽ không được chuyển) và xung đột 2 lớp cùng giai đoạn', async () => {
      const khoa = await taoKhoa();
      const gd1 = await taoGiaiDoan(khoa.id, 1);
      const lopA = await taoLop(khoa.id, 'zoom', 'Zoom A kiểm tra');
      const lopB = await taoLop(khoa.id, 'vle', 'VLE B kiểm tra');
      const lopRong = await taoLop(khoa.id, 'truc_tiep', 'TT chưa buổi');
      await taoBuoi(lopA.id, gd1.id, 1);
      await taoBuoi(lopB.id, gd1.id, 1);
      const { hocVien } = await taoHocVienMoet(uniqueSuffix());
      const dk = await ghiDanh(hocVien.id, khoa.id);
      await ganLopCu(dk.id, lopA.id, 'zoom');
      await ganLopCu(dk.id, lopB.id, 'vle');
      await ganLopCu(dk.id, lopRong.id, 'truc_tiep');

      expect(await timXungDotChuyenPhanLop(prisma)).toContainEqual({
        dang_ky_hoc_id: dk.id,
        giai_doan_id: gd1.id,
        so_lop: 2,
      });
      expect(await timPhanLopChuaCoGiaiDoan(prisma)).toContainEqual(
        expect.objectContaining({ dang_ky_hoc_id: dk.id, lop_id: lopRong.id }),
      );
    });
  });
});
