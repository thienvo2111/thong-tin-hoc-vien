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
  SQL_CHUYEN_PHAN_LOP,
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
    await prisma.dang_ky_hoc_lop.deleteMany({ where: dkWhere });
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
    await prisma.hoc_vien.deleteMany({ where: { id: { in: hocVienIds } } });
    await xoaNguoiDungTest(quanTri.nguoiDung.id);
    await xoaDonViTest(
      [donViFixture.donVi.id],
      [donViFixture.diaDanhXa.id, donViFixture.diaDanhTinh.id],
    );
    await prisma.$disconnect();
    await app.close();
  });

  describe('Chuyển dang_ky_hoc_lop -> phan_lop_giai_doan', () => {
    it('lớp có buổi ở 2 giai đoạn -> 2 dòng; lớp không có buổi -> 0 dòng và nằm trong danh sách chưa có giai đoạn', async () => {
      const khoa = await taoKhoa();
      const gd1 = await taoGiaiDoan(khoa.id, 1);
      const gd2 = await taoGiaiDoan(khoa.id, 2);
      const lopZoom = await taoLop(khoa.id, 'zoom', 'Zoom chuyển');
      const lopVle = await taoLop(khoa.id, 'vle', 'VLE chưa buổi');
      await taoBuoi(lopZoom.id, gd1.id, 1);
      await taoBuoi(lopZoom.id, gd2.id, 1);
      const { hocVien } = await taoHocVienMoet(uniqueSuffix());
      const dk = await ghiDanh(hocVien.id, khoa.id);
      await prisma.dang_ky_hoc_lop.createMany({
        data: [
          { dang_ky_hoc_id: dk.id, lop_id: lopZoom.id, loai_lop: 'zoom' },
          { dang_ky_hoc_id: dk.id, lop_id: lopVle.id, loai_lop: 'vle' },
        ],
      });

      const chuaCo = await timPhanLopChuaCoGiaiDoan(prisma);
      expect(chuaCo).toContainEqual(
        expect.objectContaining({ dang_ky_hoc_id: dk.id, lop_id: lopVle.id }),
      );
      await prisma.$executeRawUnsafe(SQL_CHUYEN_PHAN_LOP, [dk.id]);

      const rows = await prisma.phan_lop_giai_doan.findMany({
        where: { dang_ky_hoc_id: dk.id },
      });
      expect(rows.map((r) => [r.giai_doan_id, r.lop_id]).sort()).toEqual(
        [
          [gd1.id, lopZoom.id],
          [gd2.id, lopZoom.id],
        ].sort(),
      );
    });

    it('2 lớp của cùng đăng ký có buổi chung 1 giai đoạn -> được báo xung đột, INSERT thất bại', async () => {
      const khoa = await taoKhoa();
      const gd1 = await taoGiaiDoan(khoa.id, 1);
      const lopA = await taoLop(khoa.id, 'zoom', 'Zoom A');
      const lopB = await taoLop(khoa.id, 'vle', 'VLE B');
      await taoBuoi(lopA.id, gd1.id, 1);
      await taoBuoi(lopB.id, gd1.id, 1);
      const { hocVien } = await taoHocVienMoet(uniqueSuffix());
      const dk = await ghiDanh(hocVien.id, khoa.id);
      await prisma.dang_ky_hoc_lop.createMany({
        data: [
          { dang_ky_hoc_id: dk.id, lop_id: lopA.id, loai_lop: 'zoom' },
          { dang_ky_hoc_id: dk.id, lop_id: lopB.id, loai_lop: 'vle' },
        ],
      });

      expect(await timXungDotChuyenPhanLop(prisma)).toContainEqual({
        dang_ky_hoc_id: dk.id,
        giai_doan_id: gd1.id,
        so_lop: 2,
      });
      await expect(
        prisma.$executeRawUnsafe(SQL_CHUYEN_PHAN_LOP, [dk.id]),
      ).rejects.toThrow();
    });
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
      expect(res.body.canh_bao).toContain(
        'không có buổi nào trong giai đoạn',
      );
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
});
