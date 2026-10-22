import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as ExcelJS from 'exceljs';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { createTestApp } from './utils/test-app';
import { DoiBuoiHocQueryService } from '../src/doi-buoi-hoc/doi-buoi-hoc-query.service';
import { lyDoHuy } from '../src/doi-buoi-hoc/doi-buoi-hoc.service';
import { soLuotDaDung } from '../src/doi-buoi-hoc/doi-buoi-hoc.rules';
import {
  prisma,
  taoDonViTest,
  taoNguoiDungTest,
  uniqueSuffix,
  xoaNguoiDungTest,
  xoaDonViTest,
} from './utils/test-data';

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
        don_vi_dat_hang_id: donViFixture.donVi.id,
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

    // ADR 0014 C5a/C5b (issue #36).
    describe('cảnh báo điểm danh lớp cũ khi chuyển / gỡ lớp', () => {
      let khoaDD: { id: string; ma_khoa: string };
      const hv: Record<string, Awaited<ReturnType<typeof taoHocVienMoet>>> = {};
      const dkIds: string[] = [];

      beforeAll(async () => {
        khoaDD = await taoKhoa();
        // Khóa mới mặc định cong_nhan_cung_muc (ADR 0014 C3).
        const gd2 = await taoGiaiDoan(khoaDD.id, 2);
        const taoLopMuc = (ten: string, muc: 'co_ban' | 'nang_cao') =>
          prisma.lop_hoc.create({
            data: {
              khoa_id: khoaDD.id,
              loai_lop: 'zoom',
              ten_lop: ten,
              muc_nang_luc: muc,
            },
          });
        const lopA = await taoLopMuc('DD Lớp A', 'co_ban');
        await taoLopMuc('DD Lớp B', 'nang_cao');
        await taoLopMuc('DD Lớp C', 'co_ban');
        const a1 = await taoBuoi(lopA.id, gd2.id, 1);
        const a2 = await taoBuoi(lopA.id, gd2.id, 2);
        // [học viên, số buổi đã điểm danh ở lớp A]
        for (const [ten, soBuoi] of [
          ['khacMuc', 2],
          ['cungMuc', 1],
          ['go', 1],
          ['giu', 1],
          ['chuaDiemDanh', 0],
        ] as const) {
          hv[ten] = await taoHocVienMoet(uniqueSuffix());
          const dk = await ghiDanh(hv[ten].hocVien.id, khoaDD.id);
          dkIds.push(dk.id);
          await prisma.phan_lop_giai_doan.create({
            data: {
              dang_ky_hoc_id: dk.id,
              giai_doan_id: gd2.id,
              lop_id: lopA.id,
            },
          });
          const trangThai = ['co_mat', 'vang'] as const;
          for (let i = 0; i < soBuoi; i++) {
            await prisma.diem_danh.create({
              data: {
                dang_ky_hoc_id: dk.id,
                lich_hoc_id: [a1, a2][i].id,
                trang_thai: trangThai[i],
                nguon: 'thu_cong',
              },
            });
          }
        }
      });

      it('kiểm tra: cảnh báo đúng số buổi + kết luận theo mức; gỡ lớp giữ điểm danh; giữ nguyên/chưa điểm danh không cảnh báo; xác nhận không đụng điểm danh', async () => {
        const { importId, ketQua } = await taiLenPhanLop(khoaDD.ma_khoa, [
          [...H, 'GĐ2'],
          ['', hv.khacMuc.tenDangNhap, 'DD Lớp B'],
          ['', hv.cungMuc.tenDangNhap, 'DD Lớp C'],
          ['', hv.go.tenDangNhap, '-'],
          ['', hv.giu.tenDangNhap, 'DD Lớp A'],
          ['', hv.chuaDiemDanh.tenDangNhap, 'DD Lớp B'],
        ]);
        expect(ketQua.danh_sach_loi).toEqual([]);
        const canhBao = (dong: number) =>
          ketQua.danh_sach_canh_bao
            .filter((c) => c.dong === dong)
            .map((c) => c.ly_do)
            .join('; ');
        expect(canhBao(2)).toContain(
          `Học viên "${hv.khacMuc.tenDangNhap}" chuyển từ lớp "DD Lớp A" sang lớp "DD Lớp B" (GĐ2): đã điểm danh 2 buổi ở lớp "DD Lớp A" — theo chế độ của khóa: không được công nhận (khác mức)`,
        );
        expect(canhBao(3)).toContain(
          'sang lớp "DD Lớp C" (GĐ2): đã điểm danh 1 buổi ở lớp "DD Lớp A" — theo chế độ của khóa: được công nhận',
        );
        expect(canhBao(4)).toContain(
          `Học viên "${hv.go.tenDangNhap}" gỡ khỏi lớp "DD Lớp A" (GĐ2): đã điểm danh 1 buổi ở lớp "DD Lớp A" — điểm danh vẫn được giữ`,
        );
        expect(canhBao(5)).not.toContain('đã điểm danh');
        expect(canhBao(6)).not.toContain('đã điểm danh');

        await xacNhan(importId);
        expect(await phanLopCua36(hv.khacMuc.hocVien.id)).toEqual({
          2: 'DD Lớp B',
        });
        expect(await phanLopCua36(hv.go.hocVien.id)).toEqual({});
        expect(
          await prisma.diem_danh.count({
            where: { dang_ky_hoc_id: { in: dkIds } },
          }),
        ).toBe(5);

        const moTaPhanLop = async (hocVienId: string) => {
          const n = await prisma.nhat_ky_hoat_dong.findFirstOrThrow({
            where: { hoc_vien_id: hocVienId, hanh_dong: 'phan_lop' },
            orderBy: { thoi_gian: 'desc' },
          });
          return (n.chi_tiet as { mo_ta: string }).mo_ta;
        };
        expect(await moTaPhanLop(hv.khacMuc.hocVien.id)).toMatch(
          /DD Lớp A → DD Lớp B \(nhập file\) — đã điểm danh 2 buổi ở lớp DD Lớp A, không được công nhận \(nấc: cùng mức\)$/,
        );
        expect(await moTaPhanLop(hv.cungMuc.hocVien.id)).toMatch(
          /— đã điểm danh 1 buổi ở lớp DD Lớp A, được công nhận \(nấc: cùng mức\)$/,
        );
        expect(await moTaPhanLop(hv.go.hocVien.id)).toMatch(
          /DD Lớp A → \(gỡ lớp\) \(nhập file\) — đã điểm danh 1 buổi, điểm danh vẫn được giữ$/,
        );
        expect(await moTaPhanLop(hv.chuaDiemDanh.hocVien.id)).toMatch(
          /DD Lớp A → DD Lớp B \(nhập file\)$/,
        );
      });

      const phanLopCua36 = (hocVienId: string) =>
        prisma.phan_lop_giai_doan
          .findMany({
            where: {
              dang_ky_hoc: { hoc_vien_id: hocVienId, khoa_id: khoaDD.id },
            },
            include: { lop: true, giai_doan: true },
          })
          .then((r) =>
            Object.fromEntries(
              r.map((x) => [x.giai_doan.thu_tu, x.lop.ten_lop]),
            ),
          );
    });

    // ADR 0014 C5c/C6/C7 (issue #35).
    describe('chuyển lớp tự hủy đề nghị đổi buổi/học bù của lớp cũ', () => {
      let khoaCL: { id: string; ma_khoa: string };
      let hvChuyen: Awaited<ReturnType<typeof taoHocVienMoet>>;
      let hvGo: Awaited<ReturnType<typeof taoHocVienMoet>>;
      let hvGiu: Awaited<ReturnType<typeof taoHocVienMoet>>;
      const dn: Record<string, string> = {};
      const lich: Record<string, string> = {};

      async function taoDeNghi(
        ten: string,
        dangKyId: string,
        nguon: string,
        trang_thai: 'cho_duyet' | 'da_duyet' | 'tu_choi',
        loai: 'doi_buoi' | 'hoc_bu' = 'doi_buoi',
      ) {
        const chot =
          trang_thai === 'da_duyet' ? lich[`B${nguon.slice(1)}`] : null;
        const r = await prisma.doi_buoi_hoc.create({
          data: {
            dang_ky_hoc_id: dangKyId,
            lich_nguon_id: lich[nguon],
            lich_de_nghi_id: lich[`B${nguon.slice(1)}`] ?? lich[nguon],
            lich_chot_id: chot,
            ly_do: 'Bận công tác đột xuất',
            trang_thai,
            loai,
          },
        });
        dn[ten] = r.id;
      }

      beforeAll(async () => {
        khoaCL = await taoKhoa();
        const gd2 = await taoGiaiDoan(khoaCL.id, 2);
        const gd3 = await taoGiaiDoan(khoaCL.id, 3);
        const lopA = await taoLop(khoaCL.id, 'zoom', 'CL Lớp A');
        const lopB = await taoLop(khoaCL.id, 'zoom', 'CL Lớp B');
        const lopX = await taoLop(khoaCL.id, 'zoom', 'CL Lớp X');
        const lopV = await taoLop(khoaCL.id, 'vle', 'CL Lớp V');
        for (const [ten, lop, gd, so] of [
          ['A1', lopA, gd2, 1],
          ['A2', lopA, gd2, 2],
          ['B1', lopB, gd2, 1],
          ['B2', lopB, gd2, 2],
          ['X1', lopX, gd2, 1],
          ['V1', lopV, gd3, 1],
        ] as const) {
          lich[ten] = (await taoBuoi(lop.id, gd.id, so)).id;
        }
        hvChuyen = await taoHocVienMoet(uniqueSuffix());
        hvGo = await taoHocVienMoet(uniqueSuffix());
        hvGiu = await taoHocVienMoet(uniqueSuffix());
        const dk: Record<string, string> = {};
        for (const [k, hv] of [
          ['chuyen', hvChuyen],
          ['go', hvGo],
          ['giu', hvGiu],
        ] as const) {
          dk[k] = (await ghiDanh(hv.hocVien.id, khoaCL.id)).id;
          await prisma.phan_lop_giai_doan.createMany({
            data: [
              { dang_ky_hoc_id: dk[k], giai_doan_id: gd2.id, lop_id: lopA.id },
              { dang_ky_hoc_id: dk[k], giai_doan_id: gd3.id, lop_id: lopV.id },
            ],
          });
        }
        await taoDeNghi('cho', dk.chuyen, 'A1', 'cho_duyet');
        await taoDeNghi('duyetChuaHoc', dk.chuyen, 'A2', 'da_duyet');
        await taoDeNghi('hocBuDaHoc', dk.chuyen, 'A1', 'da_duyet', 'hoc_bu');
        await taoDeNghi('tuChoi', dk.chuyen, 'A2', 'tu_choi');
        await taoDeNghi('gd3', dk.chuyen, 'V1', 'cho_duyet');
        await taoDeNghi('lopKhac', dk.chuyen, 'X1', 'cho_duyet');
        await taoDeNghi('go', dk.go, 'A1', 'cho_duyet');
        await taoDeNghi('giu', dk.giu, 'A1', 'cho_duyet');
        // Học viên đã học buổi chốt của bản học bù đã duyệt.
        await prisma.diem_danh.create({
          data: {
            dang_ky_hoc_id: dk.chuyen,
            lich_hoc_id: lich.B1,
            trang_thai: 'co_mat',
            nguon: 'thu_cong',
          },
        });
      });

      const phanLopCua = (hocVienId: string, khoaId: string) =>
        prisma.phan_lop_giai_doan
          .findMany({
            where: { dang_ky_hoc: { hoc_vien_id: hocVienId, khoa_id: khoaId } },
            include: { lop: true, giai_doan: true },
          })
          .then((r) =>
            Object.fromEntries(
              r.map((x) => [x.giai_doan.thu_tu, x.lop.ten_lop]),
            ),
          );

      const trangThai = async () =>
        Object.fromEntries(
          await Promise.all(
            Object.entries(dn).map(async ([ten, id]) => [
              ten,
              await prisma.doi_buoi_hoc.findUniqueOrThrow({ where: { id } }),
            ]),
          ),
        );

      it('kiểm tra: chỉ cảnh báo dòng chuyển lớp; xác nhận: hủy đúng phạm vi, người import, ghi chú, nhật ký, lượt trả lại', async () => {
        const { importId, ketQua } = await taiLenPhanLop(khoaCL.ma_khoa, [
          [...H, 'GĐ2'],
          ['', hvChuyen.tenDangNhap, 'CL Lớp B'],
          ['', hvGo.tenDangNhap, '-'],
          ['', hvGiu.tenDangNhap, 'CL Lớp A'],
        ]);
        expect(ketQua.danh_sach_loi).toEqual([]);
        const canhBaoHuy = ketQua.danh_sach_canh_bao.filter((c) =>
          c.ly_do.includes('sẽ hủy'),
        );
        expect(canhBaoHuy).toHaveLength(1);
        expect(canhBaoHuy[0].dong).toBe(2);
        expect(canhBaoHuy[0].ly_do).toContain(
          'chuyển khỏi lớp "CL Lớp A" (GĐ2): sẽ hủy 2 đề nghị đổi buổi, 1 đăng ký học bù — trong đó 1 bản đã duyệt học viên đã điểm danh buổi chốt',
        );
        // Bước kiểm tra không ghi gì.
        expect((await trangThai()).cho.trang_thai).toBe('cho_duyet');

        const truoc = new Date();
        await xacNhan(importId);
        expect(await phanLopCua(hvChuyen.hocVien.id, khoaCL.id)).toEqual({
          2: 'CL Lớp B',
          3: 'CL Lớp V',
        });

        const tt = await trangThai();
        for (const ten of ['cho', 'duyetChuaHoc', 'hocBuDaHoc']) {
          expect(tt[ten]).toMatchObject({
            trang_thai: 'da_huy',
            nguoi_xu_ly: quanTri.nguoiDung.id,
            ghi_chu_xu_ly: 'Hủy tự động do chuyển lớp (nhập file)',
          });
          expect(tt[ten].xu_ly_luc!.getTime()).toBeGreaterThanOrEqual(
            truoc.getTime() - 1000,
          );
          expect(lyDoHuy(tt[ten])).toBe('huy_duyet');
        }
        expect(tt.tuChoi.trang_thai).toBe('tu_choi');
        expect(tt.gd3.trang_thai).toBe('cho_duyet');
        expect(tt.lopKhac.trang_thai).toBe('cho_duyet');
        expect(tt.go.trang_thai).toBe('cho_duyet');
        expect(tt.giu.trang_thai).toBe('cho_duyet');

        // Điểm danh buổi chốt vẫn giữ; buổi chốt không còn học viên đổi vào.
        expect(
          await prisma.diem_danh.count({ where: { lich_hoc_id: lich.B1 } }),
        ).toBe(1);
        const dieuChinh = await app
          .get(DoiBuoiHocQueryService)
          .dieuChinhTheoBuoi([lich.B1, lich.B2]);
        expect(dieuChinh.get(lich.B1)?.vao).toEqual([]);
        expect(dieuChinh.get(lich.B2)?.vao).toEqual([]);

        // Lượt đổi buổi / học bù GĐ2 trả lại; còn lại đề nghị GĐ3 + lớp khác.
        const conLai = await prisma.doi_buoi_hoc.findMany({
          where: { dang_ky_hoc: { hoc_vien_id: hvChuyen.hocVien.id } },
        });
        expect(soLuotDaDung(conLai, 'hoc_bu')).toBe(0);
        expect(soLuotDaDung(conLai, 'doi_buoi')).toBe(2);

        const nhatKy = await prisma.nhat_ky_hoat_dong.findMany({
          where: {
            hoc_vien_id: hvChuyen.hocVien.id,
            hanh_dong: 'huy_doi_buoi_chuyen_lop',
          },
        });
        // Dòng "Phân lớp" nêu số đề nghị bị hủy + điểm danh lớp cũ (buổi chốt
        // B1 ở lớp B, không phải lớp A -> không có phần điểm danh).
        const phanLopNk = await prisma.nhat_ky_hoat_dong.findFirstOrThrow({
          where: { hoc_vien_id: hvChuyen.hocVien.id, hanh_dong: 'phan_lop' },
          orderBy: { thoi_gian: 'desc' },
        });
        expect((phanLopNk.chi_tiet as { mo_ta: string }).mo_ta).toMatch(
          /CL Lớp A → CL Lớp B \(nhập file\) — hủy 2 đổi buổi, 1 học bù$/,
        );
        expect(
          nhatKy
            .map((n) => (n.chi_tiet as { de_nghi_id: string }).de_nghi_id)
            .sort(),
        ).toEqual([dn.cho, dn.duyetChuaHoc, dn.hocBuDaHoc].sort());
        expect(
          nhatKy.every((n) => n.nguoi_dung_id === quanTri.nguoiDung.id),
        ).toBe(true);
        // Không gửi email nào (lớp zoom, hủy tự động không báo).
        expect(
          await prisma.hang_doi_email.count({
            where: { hoc_vien_id: hvChuyen.hocVien.id },
          }),
        ).toBe(0);
      });
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
});
