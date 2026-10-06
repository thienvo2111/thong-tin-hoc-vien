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
// Mẫu cũ (trước T10) — không có cột "phong" ở cuối: vẫn phải import được.
const COT_MAU_CU = [
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
const COT_MAU_MOI = [...COT_MAU_CU, 'phong'];

async function buildXlsx(
  cot: string[],
  rows: (string | number | undefined)[][],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('data');
  sheet.addRow(cot);
  rows.forEach((r) => sheet.addRow(r));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// T10 (issue #2) — danh mục điểm học + gắn điểm học vào buổi học trực tiếp.
describe('Điểm học trực tiếp — T10 (e2e)', () => {
  let app: INestApplication;
  let dvA: Awaited<ReturnType<typeof taoDonViTest>>;
  let dvB: Awaited<ReturnType<typeof taoDonViTest>>;
  let quanTri: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let truongA: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let truongB: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let tokenQuanTri: string;
  let tokenTruongA: string;
  let tokenTruongB: string;

  const suf = uniqueSuffix();
  const khoaIds: string[] = [];
  const diemHocIds: string[] = [];
  const hocVienIds: string[] = [];
  const nguoiDungHocVienIds: string[] = [];

  async function dangNhap(ten_dang_nhap: string, mat_khau: string) {
    const res = await request(app.getHttpServer())
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap, mat_khau })
      .expect(200);
    return res.body.token as string;
  }

  async function taoDiemHoc(
    ma: string,
    extra: Record<string, unknown> = {},
  ): Promise<{ id: string; ma_diem_hoc: string }> {
    const res = await request(app.getHttpServer())
      .post('/diem-hoc')
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .send({
        ma_diem_hoc: ma,
        ten: `Điểm học ${ma}`,
        dia_chi: '12 Đường Thử',
        dia_ban_id: dvA.diaDanhXa.id,
        ...extra,
      })
      .expect(201);
    diemHocIds.push(res.body.id);
    return res.body;
  }

  async function taoKhoaTrucTiep() {
    const s = uniqueSuffix();
    const res = await request(app.getHttpServer())
      .post('/khoa-boi-duong')
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .send({
        ma_khoa: `K-DH-${s}`,
        ten_khoa: `Khóa điểm học ${s}`,
        don_vi_dat_hang_id: dvA.donVi.id,
        thoi_gian_bat_dau: '2026-01-01',
        thoi_gian_ket_thuc: '2026-12-31',
      })
      .expect(201);
    khoaIds.push(res.body.id);
    const gd = await prisma.giai_doan_khoa.create({
      data: {
        khoa_id: res.body.id,
        thu_tu: 1,
        ten_giai_doan: 'Trực tiếp đợt 1',
        hinh_thuc: 'truc_tiep',
        thoi_gian_bat_dau: new Date('2026-01-01'),
        thoi_gian_ket_thuc: new Date('2026-12-31'),
      },
    });
    return { khoa: res.body as { id: string; ma_khoa: string }, gd };
  }

  async function importLich(
    cot: string[],
    rows: (string | number | undefined)[][],
  ) {
    const res = await request(app.getHttpServer())
      .post('/import/lop_va_lich_hoc')
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .attach('file', await buildXlsx(cot, rows), 'lich.xlsx')
      .expect(201);
    const ketQua = await request(app.getHttpServer())
      .get(`/import/${res.body.import_id}`)
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .expect(200);
    return { importId: res.body.import_id as string, ketQua: ketQua.body };
  }

  async function xacNhan(importId: string) {
    await request(app.getHttpServer())
      .post(`/import/${importId}/xac-nhan`)
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .expect(201);
  }

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    dvA = await taoDonViTest('dha');
    dvB = await taoDonViTest('dhb');
    quanTri = await taoNguoiDungTest({
      vai_tro: 'quan_tri',
      don_vi_id: dvA.donVi.id,
      mat_khau: 'MatKhau123',
    });
    truongA = await taoNguoiDungTest({
      vai_tro: 'truong',
      don_vi_id: dvA.donVi.id,
      mat_khau: 'MatKhau123',
    });
    truongB = await taoNguoiDungTest({
      vai_tro: 'truong',
      don_vi_id: dvB.donVi.id,
      mat_khau: 'MatKhau123',
    });
    tokenQuanTri = await dangNhap(quanTri.ten_dang_nhap, 'MatKhau123');
    tokenTruongA = await dangNhap(truongA.ten_dang_nhap, 'MatKhau123');
    tokenTruongB = await dangNhap(truongB.ten_dang_nhap, 'MatKhau123');
  });

  afterAll(async () => {
    const dkWhere = { dang_ky_hoc: { khoa_id: { in: khoaIds } } };
    await prisma.phan_lop_giai_doan.deleteMany({ where: dkWhere });
    await prisma.hang_doi_email.deleteMany({
      where: { hoc_vien_id: { in: hocVienIds } },
    });
    await prisma.dang_ky_hoc.deleteMany({
      where: { khoa_id: { in: khoaIds } },
    });
    await prisma.lich_hoc_lop.deleteMany({
      where: { lop: { khoa_id: { in: khoaIds } } },
    });
    await prisma.lop_hoc.deleteMany({ where: { khoa_id: { in: khoaIds } } });
    await prisma.giai_doan_khoa.deleteMany({
      where: { khoa_id: { in: khoaIds } },
    });
    await prisma.nhat_ky_import.deleteMany({
      where: { nguoi_import_id: quanTri.nguoiDung.id },
    });
    // nhat_ky_hoat_dong: chỉ cho thêm (trigger chặn xóa) — không dọn.
    await prisma.khoa_boi_duong.deleteMany({ where: { id: { in: khoaIds } } });
    await prisma.diem_hoc.deleteMany({ where: { id: { in: diemHocIds } } });
    if (hocVienIds.length > 0) {
      await prisma.hoc_vien.updateMany({
        where: { id: { in: hocVienIds } },
        data: {
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
    for (const nd of [quanTri, truongA, truongB]) {
      await xoaNguoiDungTest(nd.nguoiDung.id);
    }
    await xoaDonViTest(
      [dvA.donVi.id, dvB.donVi.id],
      [
        dvA.diaDanhXa.id,
        dvA.diaDanhTinh.id,
        dvB.diaDanhXa.id,
        dvB.diaDanhTinh.id,
      ],
    );
    await prisma.$disconnect();
    await app.close();
  });

  describe('CRUD /diem-hoc — ghi chỉ quan_tri, không xóa cứng', () => {
    it('quan_tri tạo → 201, ghi tao_boi; trùng mã → 409', async () => {
      const dh = await taoDiemHoc(`DH1-${suf}`.slice(0, 30), {
        so_phong: 3,
        nguoi_lien_he: 'Cô Lan',
        sdt_lien_he: '0901000000',
      });
      const db = await prisma.diem_hoc.findUniqueOrThrow({
        where: { id: dh.id },
      });
      expect(db.tao_boi).toBe(quanTri.nguoiDung.id);

      await request(app.getHttpServer())
        .post('/diem-hoc')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({
          ma_diem_hoc: dh.ma_diem_hoc,
          ten: 'Trùng',
          dia_chi: 'x',
          dia_ban_id: dvA.diaDanhXa.id,
        })
        .expect(409);
    });

    it('truong tạo / sửa → 403', async () => {
      await request(app.getHttpServer())
        .post('/diem-hoc')
        .set('Authorization', `Bearer ${tokenTruongA}`)
        .send({
          ma_diem_hoc: `DHX-${suf}`.slice(0, 30),
          ten: 'X',
          dia_chi: 'x',
          dia_ban_id: dvA.diaDanhXa.id,
        })
        .expect(403);
      await request(app.getHttpServer())
        .patch(`/diem-hoc/${diemHocIds[0]}`)
        .set('Authorization', `Bearer ${tokenTruongA}`)
        .send({ ten: 'Đổi' })
        .expect(403);
    });

    it('"xóa" = PATCH trang_thai ngung (bản ghi còn), không có DELETE', async () => {
      const dh = await taoDiemHoc(`DH2-${suf}`.slice(0, 30));
      await request(app.getHttpServer())
        .patch(`/diem-hoc/${dh.id}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({ trang_thai: 'ngung' })
        .expect(200);
      const db = await prisma.diem_hoc.findUniqueOrThrow({
        where: { id: dh.id },
      });
      expect(db.trang_thai).toBe('ngung');
      await request(app.getHttpServer())
        .delete(`/diem-hoc/${dh.id}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(404);
    });
  });

  describe('Đọc theo phạm vi', () => {
    let dhCuaDonViA: { id: string };
    let dhDungChoKhoaA: { id: string };
    let dhKhongLienQuan: { id: string };

    beforeAll(async () => {
      dhCuaDonViA = await taoDiemHoc(`PV1-${suf}`.slice(0, 30), {
        don_vi_id: dvA.donVi.id,
      });
      dhDungChoKhoaA = await taoDiemHoc(`PV2-${suf}`.slice(0, 30));
      dhKhongLienQuan = await taoDiemHoc(`PV3-${suf}`.slice(0, 30));
      const { khoa, gd } = await taoKhoaTrucTiep();
      const lop = await prisma.lop_hoc.create({
        data: { khoa_id: khoa.id, loai_lop: 'truc_tiep', ten_lop: 'Lớp PV' },
      });
      await prisma.lich_hoc_lop.create({
        data: {
          lop_id: lop.id,
          giai_doan_id: gd.id,
          thoi_gian_bat_dau: new Date('2026-11-01T01:00:00Z'),
          thoi_gian_ket_thuc: new Date('2026-11-01T04:00:00Z'),
          diem_hoc_id: dhDungChoKhoaA.id,
        },
      });
    });

    async function idsThayDuoc(token: string) {
      const res = await request(app.getHttpServer())
        .get('/diem-hoc')
        .query({ q: suf, page_size: 200 })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      return (res.body.data as { id: string }[]).map((d) => d.id);
    }

    it('trường A: thấy điểm học của đơn vị mình + điểm học dùng cho khóa A đặt hàng; không thấy điểm học khác', async () => {
      const ids = await idsThayDuoc(tokenTruongA);
      expect(ids).toEqual(
        expect.arrayContaining([dhCuaDonViA.id, dhDungChoKhoaA.id]),
      );
      expect(ids).not.toContain(dhKhongLienQuan.id);
    });

    it('trường B (ngoài phạm vi): không thấy cả 3; GET chi tiết → 404', async () => {
      const ids = await idsThayDuoc(tokenTruongB);
      expect(ids).not.toContain(dhCuaDonViA.id);
      expect(ids).not.toContain(dhDungChoKhoaA.id);
      await request(app.getHttpServer())
        .get(`/diem-hoc/${dhCuaDonViA.id}`)
        .set('Authorization', `Bearer ${tokenTruongB}`)
        .expect(404);
    });

    it('quan_tri thấy tất cả', async () => {
      const ids = await idsThayDuoc(tokenQuanTri);
      expect(ids).toEqual(
        expect.arrayContaining([
          dhCuaDonViA.id,
          dhDungChoKhoaA.id,
          dhKhongLienQuan.id,
        ]),
      );
    });
  });

  describe('Cảnh báo vượt số phòng (không chặn)', () => {
    it('2 lớp cùng giờ tại điểm học 1 phòng → lớp thứ 2 vẫn 201, có canh_bao', async () => {
      const dh = await taoDiemHoc(`SP-${suf}`.slice(0, 30), { so_phong: 1 });
      const { khoa, gd } = await taoKhoaTrucTiep();
      const lop1 = await prisma.lop_hoc.create({
        data: { khoa_id: khoa.id, loai_lop: 'truc_tiep', ten_lop: 'L1' },
      });
      const lop2 = await prisma.lop_hoc.create({
        data: { khoa_id: khoa.id, loai_lop: 'truc_tiep', ten_lop: 'L2' },
      });
      const body = {
        giai_doan_id: gd.id,
        thoi_gian_bat_dau: '2026-11-02T01:00:00.000Z',
        thoi_gian_ket_thuc: '2026-11-02T04:00:00.000Z',
        diem_hoc_id: dh.id,
      };
      const r1 = await request(app.getHttpServer())
        .post(`/lop/${lop1.id}/lich-hoc`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send(body)
        .expect(201);
      expect(r1.body.canh_bao).toEqual([]);
      const r2 = await request(app.getHttpServer())
        .post(`/lop/${lop2.id}/lich-hoc`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send(body)
        .expect(201);
      expect(r2.body.canh_bao).toHaveLength(1);
      expect(r2.body.canh_bao[0]).toContain('vượt số phòng');
    });

    it('gán điểm học đã ngưng → 400', async () => {
      const dh = await taoDiemHoc(`NG-${suf}`.slice(0, 30));
      await prisma.diem_hoc.update({
        where: { id: dh.id },
        data: { trang_thai: 'ngung' },
      });
      const { khoa, gd } = await taoKhoaTrucTiep();
      const lop = await prisma.lop_hoc.create({
        data: { khoa_id: khoa.id, loai_lop: 'truc_tiep', ten_lop: 'LN' },
      });
      await request(app.getHttpServer())
        .post(`/lop/${lop.id}/lich-hoc`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({
          giai_doan_id: gd.id,
          thoi_gian_bat_dau: '2026-11-03T01:00:00.000Z',
          thoi_gian_ket_thuc: '2026-11-03T04:00:00.000Z',
          diem_hoc_id: dh.id,
        })
        .expect(400);
    });
  });

  describe('Import lop_va_lich_hoc với điểm học + mốc cập nhật lịch', () => {
    let khoa: { id: string; ma_khoa: string };
    let dh: { id: string; ma_diem_hoc: string };
    const dong = (gio: string, maDiemHoc?: string) => [
      khoa.ma_khoa,
      'Lớp Import',
      'truc_tiep',
      undefined,
      undefined,
      undefined,
      1,
      1,
      `05/11/2026 ${gio}`,
      '05/11/2026 11:00',
      undefined,
      maDiemHoc,
    ];

    beforeAll(async () => {
      khoa = (await taoKhoaTrucTiep()).khoa;
      dh = await taoDiemHoc(`IM-${suf}`.slice(0, 30));
    });

    it('buổi mới giai đoạn trực tiếp thiếu ma_diem_hoc → dòng lỗi', async () => {
      const { ketQua } = await importLich(COT_MAU_CU, [dong('08:00')]);
      expect(ketQua.so_dong_loi).toBe(1);
      expect(JSON.stringify(ketQua)).toContain('ma_diem_hoc');
    });

    it('mẫu cũ (không cột phong) + ma_diem_hoc → tạo buổi gắn đúng điểm học', async () => {
      const { importId, ketQua } = await importLich(COT_MAU_CU, [
        dong('08:00', dh.ma_diem_hoc),
      ]);
      expect(ketQua.so_dong_loi).toBe(0);
      await xacNhan(importId);
      const lich = await prisma.lich_hoc_lop.findFirstOrThrow({
        where: { lop: { khoa_id: khoa.id } },
      });
      expect(lich.diem_hoc_id).toBe(dh.id);
    });

    it('chạy lại y nguyên → cap_nhat_luc giữ nguyên; đổi giờ → cap_nhat_luc đổi + nhật ký sua_lich_hoc', async () => {
      const truoc = await prisma.lich_hoc_lop.findFirstOrThrow({
        where: { lop: { khoa_id: khoa.id } },
      });

      const lan1 = await importLich(COT_MAU_CU, [dong('08:00')]);
      expect(lan1.ketQua.so_dong_loi).toBe(0); // ô trống = giữ điểm học
      await xacNhan(lan1.importId);
      const giuNguyen = await prisma.lich_hoc_lop.findUniqueOrThrow({
        where: { id: truoc.id },
      });
      expect(giuNguyen.cap_nhat_luc.getTime()).toBe(
        truoc.cap_nhat_luc.getTime(),
      );
      expect(giuNguyen.diem_hoc_id).toBe(dh.id);

      const lan2 = await importLich(COT_MAU_MOI, [[...dong('09:00'), 'P.204']]);
      await xacNhan(lan2.importId);
      const sau = await prisma.lich_hoc_lop.findUniqueOrThrow({
        where: { id: truoc.id },
      });
      expect(sau.cap_nhat_luc.getTime()).toBeGreaterThan(
        truoc.cap_nhat_luc.getTime(),
      );
      expect(sau.phong).toBe('P.204');
      const nhatKy = await prisma.nhat_ky_hoat_dong.findMany({
        where: {
          hanh_dong: 'sua_lich_hoc',
          nguoi_dung_id: quanTri.nguoiDung.id,
        },
      });
      expect(
        nhatKy.some(
          (n) =>
            (n.chi_tiet as { lich_hoc_id?: string }).lich_hoc_id === truoc.id,
        ),
      ).toBe(true);
    });
  });

  describe('GET /hoc-vien/toi/khoa-hoc trả thông tin điểm học của buổi trực tiếp', () => {
    it('có tên, địa chỉ, người liên hệ của điểm học + phòng', async () => {
      const dh = await taoDiemHoc(`HV-${suf}`.slice(0, 30), {
        nguoi_lien_he: 'Thầy Hùng',
        sdt_lien_he: '0912345678',
      });
      const { khoa, gd } = await taoKhoaTrucTiep();
      const lop = await prisma.lop_hoc.create({
        data: { khoa_id: khoa.id, loai_lop: 'truc_tiep', ten_lop: 'Lớp HV' },
      });
      await prisma.lich_hoc_lop.create({
        data: {
          lop_id: lop.id,
          giai_doan_id: gd.id,
          thoi_gian_bat_dau: new Date('2026-11-04T01:00:00Z'),
          thoi_gian_ket_thuc: new Date('2026-11-04T04:00:00Z'),
          diem_hoc_id: dh.id,
          phong: 'P.301',
        },
      });
      const tenDangNhap = `MOET-DH-${uniqueSuffix()}`;
      const hocVien = await prisma.hoc_vien.create({
        data: {
          nguon_tao: 'import_moet',
          ma_dinh_danh_moet: tenDangNhap,
          ho_ten: 'Học Viên Điểm Học',
          ngay_sinh: 15,
          thang_sinh: 6,
          nam_sinh: NAM_HOP_LE,
          don_vi_cong_tac_id: dvA.donVi.id,
          trang_thai: 'da_duyet',
          nguoi_duyet_id: quanTri.nguoiDung.id,
          cap_duyet_thuc_te: 'quan_tri',
          ngay_duyet: new Date(),
        },
      });
      hocVienIds.push(hocVien.id);
      const nd = await prisma.nguoi_dung.create({
        data: {
          ho_ten: hocVien.ho_ten,
          ten_dang_nhap: tenDangNhap,
          vai_tro: 'hoc_vien',
          hoc_vien_id: hocVien.id,
          mat_khau_hash: await bcrypt.hash('x', 4),
          phai_doi_mat_khau: false,
        },
      });
      nguoiDungHocVienIds.push(nd.id);
      const dk = await prisma.dang_ky_hoc.create({
        data: {
          hoc_vien_id: hocVien.id,
          khoa_id: khoa.id,
          trang_thai: 'da_duyet',
        },
      });
      await prisma.phan_lop_giai_doan.create({
        data: { dang_ky_hoc_id: dk.id, giai_doan_id: gd.id, lop_id: lop.id },
      });

      const token = await dangNhap(tenDangNhap, 'x');
      const res = await request(app.getHttpServer())
        .get('/hoc-vien/toi/khoa-hoc')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const buoi = res.body[0].giai_doan[0].lop.lich_hoc[0];
      expect(buoi.phong).toBe('P.301');
      expect(buoi.diem_hoc).toEqual(
        expect.objectContaining({
          ten: `Điểm học ${dh.ma_diem_hoc}`,
          dia_chi: '12 Đường Thử',
          nguoi_lien_he: 'Thầy Hùng',
          sdt_lien_he: '0912345678',
        }),
      );
    });
  });
});
