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
const COT_GV = [
  'ho_ten',
  'so_dien_thoai',
  'email',
  'don_vi_cong_tac',
  'ghi_chu',
];
const COT_PC = [
  'ma_khoa',
  'ten_lop',
  'loai_lop',
  'giai_doan_thu_tu',
  'buoi_so',
  'email',
  'so_dien_thoai',
  'vai_tro',
  'so_gio',
];

async function xlsx(cot: string[], rows: (string | number | undefined)[][]) {
  const wb = new ExcelJS.Workbook();
  const sh = wb.addWorksheet('data');
  sh.addRow(cot);
  rows.forEach((r) => sh.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// SĐT duy nhất toàn hệ thống — sinh ngẫu nhiên theo lượt chạy.
const dauSo = `09${String(Date.now()).slice(-6)}`;
const sdt = (i: number) => `${dauSo}${String(i).padStart(2, '0')}`;

// T11 (issue #3) — giảng viên & phân công giảng dạy.
describe('Giảng viên & phân công — T11 (e2e)', () => {
  let app: INestApplication;
  let dvA: Awaited<ReturnType<typeof taoDonViTest>>;
  let dvB: Awaited<ReturnType<typeof taoDonViTest>>;
  let quanTri: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let truongA: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let truongB: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let tokenQT: string;
  let tokenA: string;
  let tokenB: string;

  const suf = uniqueSuffix();
  const emailGv = (i: number) => `gv${i}-${suf}@t11.test`.toLowerCase();
  let khoa: { id: string; ma_khoa: string };
  let lop: { id: string };
  let lopKhac: { id: string };
  const lich: Record<string, { id: string }> = {};
  const hocVienIds: string[] = [];
  const nguoiDungHocVienIds: string[] = [];

  async function dangNhap(ten: string, mk: string) {
    const res = await request(app.getHttpServer())
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap: ten, mat_khau: mk })
      .expect(200);
    return res.body.token as string;
  }

  async function nhap(loai: string, file: Buffer, xacNhan = true) {
    const res = await request(app.getHttpServer())
      .post(`/import/${loai}`)
      .set('Authorization', `Bearer ${tokenQT}`)
      .attach('file', file, `${loai}.xlsx`)
      .expect(201);
    const kq = await request(app.getHttpServer())
      .get(`/import/${res.body.import_id}`)
      .set('Authorization', `Bearer ${tokenQT}`)
      .expect(200);
    if (xacNhan && kq.body.so_dong_thanh_cong > 0) {
      await request(app.getHttpServer())
        .post(`/import/${res.body.import_id}/xac-nhan`)
        .set('Authorization', `Bearer ${tokenQT}`)
        .expect(201);
    }
    return kq.body as {
      so_dong_loi: number;
      so_dong_thanh_cong: number;
      danh_sach_loi: { dong: number; ly_do: string }[];
    };
  }

  const gvTheoEmail = (i: number) =>
    prisma.giang_vien.findUniqueOrThrow({ where: { email: emailGv(i) } });

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    dvA = await taoDonViTest('gva');
    dvB = await taoDonViTest('gvb');
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
    tokenQT = await dangNhap(quanTri.ten_dang_nhap, 'MatKhau123');
    tokenA = await dangNhap(truongA.ten_dang_nhap, 'MatKhau123');
    tokenB = await dangNhap(truongB.ten_dang_nhap, 'MatKhau123');

    // Khóa do đơn vị A đặt hàng; 1 giai đoạn trực tuyến, 2 lớp zoom.
    const k = await request(app.getHttpServer())
      .post('/khoa-boi-duong')
      .set('Authorization', `Bearer ${tokenQT}`)
      .send({
        ma_khoa: `K-GV-${suf}`.slice(0, 30),
        ten_khoa: `Khóa T11 ${suf}`,
        don_vi_dat_hang_id: dvA.donVi.id,
        thoi_gian_bat_dau: '2026-01-01',
        thoi_gian_ket_thuc: '2026-12-31',
      })
      .expect(201);
    khoa = k.body;
    const gd = await prisma.giai_doan_khoa.create({
      data: {
        khoa_id: khoa.id,
        thu_tu: 1,
        ten_giai_doan: 'Zoom',
        hinh_thuc: 'truc_tuyen',
        thoi_gian_bat_dau: new Date('2026-01-01'),
        thoi_gian_ket_thuc: new Date('2026-12-31'),
      },
    });
    lop = await prisma.lop_hoc.create({
      data: { khoa_id: khoa.id, loai_lop: 'zoom', ten_lop: 'Zoom 1' },
    });
    lopKhac = await prisma.lop_hoc.create({
      data: { khoa_id: khoa.id, loai_lop: 'zoom', ten_lop: 'Zoom 2' },
    });
    const buoi = (lopId: string, so: number, bd: string, kt: string) =>
      prisma.lich_hoc_lop.create({
        data: {
          lop_id: lopId,
          giai_doan_id: gd.id,
          buoi_so: so,
          thoi_gian_bat_dau: new Date(bd),
          thoi_gian_ket_thuc: new Date(kt),
        },
      });
    // Lớp 1 buổi 1 và Lớp 2 buổi 1 CHỒNG GIỜ; Lớp 1 buổi 2 ngày khác.
    lich.l1b1 = await buoi(
      lop.id,
      1,
      '2026-11-01T01:00:00Z',
      '2026-11-01T04:00:00Z',
    );
    lich.l1b2 = await buoi(
      lop.id,
      2,
      '2026-11-02T01:00:00Z',
      '2026-11-02T04:00:00Z',
    );
    lich.l2b1 = await buoi(
      lopKhac.id,
      1,
      '2026-11-01T02:00:00Z',
      '2026-11-01T05:00:00Z',
    );
    lich.l2b2 = await buoi(
      lopKhac.id,
      2,
      '2026-11-03T01:00:00Z',
      '2026-11-03T04:00:00Z',
    );
  });

  afterAll(async () => {
    await prisma.phan_lop_giai_doan.deleteMany({
      where: { dang_ky_hoc: { khoa_id: khoa.id } },
    });
    await prisma.dang_ky_hoc.deleteMany({ where: { khoa_id: khoa.id } });
    await prisma.lich_hoc_lop.deleteMany({
      where: { lop: { khoa_id: khoa.id } },
    });
    await prisma.lop_hoc.deleteMany({ where: { khoa_id: khoa.id } });
    await prisma.giai_doan_khoa.deleteMany({ where: { khoa_id: khoa.id } });
    await prisma.khoa_boi_duong.deleteMany({ where: { id: khoa.id } });
    await prisma.giang_vien.deleteMany({
      where: { email: { endsWith: `-${suf}@t11.test`.toLowerCase() } },
    });
    await prisma.giang_vien.deleteMany({
      where: { so_dien_thoai: { startsWith: dauSo } },
    });
    await prisma.nhat_ky_import.deleteMany({
      where: { nguoi_import_id: quanTri.nguoiDung.id },
    });
    if (hocVienIds.length) {
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
    for (const nd of [quanTri, truongA, truongB])
      await xoaNguoiDungTest(nd.nguoiDung.id);
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

  describe('Import giang_vien — khớp theo email rồi SĐT', () => {
    it('tạo mới 3 giảng viên', async () => {
      const kq = await nhap(
        'giang_vien',
        await xlsx(COT_GV, [
          ['Nguyễn Văn A', sdt(1), emailGv(1), 'HCMUE', undefined],
          ['Trần Thị B', sdt(2), emailGv(2), undefined, undefined],
          ['Lê Văn C', sdt(3), undefined, undefined, undefined],
        ]),
      );
      expect(kq.so_dong_loi).toBe(0);
      expect((await gvTheoEmail(1)).ho_ten).toBe('Nguyễn Văn A');
    });

    it('khớp email → cập nhật đúng giảng viên (đổi SĐT); không email → khớp SĐT', async () => {
      const gv1 = await gvTheoEmail(1);
      const kq = await nhap(
        'giang_vien',
        await xlsx(COT_GV, [
          ['Nguyễn Văn A (sửa)', sdt(11), emailGv(1), undefined, undefined],
          ['Lê Văn C (sửa)', sdt(3), undefined, undefined, undefined],
        ]),
      );
      expect(kq.so_dong_loi).toBe(0);
      const sau = await gvTheoEmail(1);
      expect(sau.id).toBe(gv1.id);
      expect(sau.so_dien_thoai).toBe(sdt(11));
      const c = await prisma.giang_vien.findUniqueOrThrow({
        where: { so_dien_thoai: sdt(3) },
      });
      expect(c.ho_ten).toBe('Lê Văn C (sửa)');
    });

    it('email của A nhưng SĐT của B → dòng lỗi, không ghi', async () => {
      const kq = await nhap(
        'giang_vien',
        await xlsx(COT_GV, [['X', sdt(2), emailGv(1), undefined, undefined]]),
        false,
      );
      expect(kq.so_dong_loi).toBe(1);
    });
  });

  describe('Import phan_cong_giang_day + luật trùng giờ', () => {
    it('gán đúng giảng viên vào đúng buổi/lớp/giai đoạn/khóa', async () => {
      const kq = await nhap(
        'phan_cong_giang_day',
        await xlsx(COT_PC, [
          [
            khoa.ma_khoa,
            'Zoom 1',
            'zoom',
            1,
            1,
            emailGv(1),
            undefined,
            'giang_vien',
            3,
          ],
          [
            khoa.ma_khoa,
            'Zoom 1',
            'zoom',
            1,
            2,
            undefined,
            sdt(2),
            'ho_tro',
            undefined,
          ],
        ]),
      );
      expect(kq.so_dong_loi).toBe(0);
      const gv1 = await gvTheoEmail(1);
      const pc = await prisma.phan_cong_giang_day.findUniqueOrThrow({
        where: {
          lich_hoc_id_giang_vien_id: {
            lich_hoc_id: lich.l1b1.id,
            giang_vien_id: gv1.id,
          },
        },
      });
      expect(pc.vai_tro).toBe('giang_vien');
      expect(Number(pc.so_gio)).toBe(3);
    });

    it('giảng viên A vào buổi chồng giờ (Lớp 2 buổi 1) → dòng lỗi, không tạo bản ghi', async () => {
      const kq = await nhap(
        'phan_cong_giang_day',
        await xlsx(COT_PC, [
          [
            khoa.ma_khoa,
            'Zoom 2',
            'zoom',
            1,
            1,
            emailGv(1),
            undefined,
            'giang_vien',
            3,
          ],
        ]),
        false,
      );
      expect(kq.so_dong_loi).toBe(1);
      expect(kq.danh_sach_loi[0].ly_do).toContain('trùng giờ');
      const gv1 = await gvTheoEmail(1);
      expect(
        await prisma.phan_cong_giang_day.count({
          where: { lich_hoc_id: lich.l2b1.id, giang_vien_id: gv1.id },
        }),
      ).toBe(0);
    });

    it('2 dòng cùng giảng viên chồng giờ trong cùng file → dòng sau lỗi', async () => {
      const kq = await nhap(
        'phan_cong_giang_day',
        await xlsx(COT_PC, [
          [
            khoa.ma_khoa,
            'Zoom 2',
            'zoom',
            1,
            2,
            undefined,
            sdt(3),
            'giang_vien',
            2,
          ],
          [
            khoa.ma_khoa,
            'Zoom 2',
            'zoom',
            1,
            2,
            undefined,
            sdt(3),
            'giang_vien',
            2,
          ],
        ]),
        false,
      );
      expect(kq.so_dong_loi).toBe(1);
    });
  });

  describe('Phân công tay + đổi giờ buổi', () => {
    it('PUT phân công buổi: trùng giờ → 400; hợp lệ → 200', async () => {
      const gv1 = await gvTheoEmail(1);
      const gv2 = await gvTheoEmail(2);
      await request(app.getHttpServer())
        .put(`/lop/${lopKhac.id}/lich-hoc/${lich.l2b1.id}/giang-vien`)
        .set('Authorization', `Bearer ${tokenQT}`)
        .send({ phan_cong: [{ giang_vien_id: gv1.id, vai_tro: 'giang_vien' }] })
        .expect(400);
      const ok = await request(app.getHttpServer())
        .put(`/lop/${lopKhac.id}/lich-hoc/${lich.l2b1.id}/giang-vien`)
        .set('Authorization', `Bearer ${tokenQT}`)
        .send({
          phan_cong: [
            { giang_vien_id: gv2.id, vai_tro: 'giang_vien', so_gio: 3 },
          ],
        })
        .expect(200);
      expect(ok.body).toHaveLength(1);
    });

    it('buổi không thuộc lớp trên URL → 404; Trường gọi → 403', async () => {
      await request(app.getHttpServer())
        .put(`/lop/${lop.id}/lich-hoc/${lich.l2b1.id}/giang-vien`)
        .set('Authorization', `Bearer ${tokenQT}`)
        .send({ phan_cong: [] })
        .expect(404);
      await request(app.getHttpServer())
        .put(`/lop/${lopKhac.id}/lich-hoc/${lich.l2b1.id}/giang-vien`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ phan_cong: [] })
        .expect(403);
    });

    it('đổi giờ Lớp 1 buổi 2 sang trùng Lớp 2 buổi 2 của giảng viên B → 400', async () => {
      const gv2 = await gvTheoEmail(2);
      await request(app.getHttpServer())
        .put(`/lop/${lopKhac.id}/lich-hoc/${lich.l2b2.id}/giang-vien`)
        .set('Authorization', `Bearer ${tokenQT}`)
        .send({ phan_cong: [{ giang_vien_id: gv2.id, vai_tro: 'ho_tro' }] })
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/lop/${lop.id}/lich-hoc/${lich.l1b2.id}`)
        .set('Authorization', `Bearer ${tokenQT}`)
        .send({
          thoi_gian_bat_dau: '2026-11-03T02:00:00.000Z',
          thoi_gian_ket_thuc: '2026-11-03T03:00:00.000Z',
        })
        .expect(400);
    });
  });

  describe('Xác nhận giờ + báo cáo giờ dạy', () => {
    it('xác nhận phân công chưa có số giờ → 400; có số giờ → chốt', async () => {
      const gv2 = await gvTheoEmail(2);
      const pcHoTro = await prisma.phan_cong_giang_day.findUniqueOrThrow({
        where: {
          lich_hoc_id_giang_vien_id: {
            lich_hoc_id: lich.l1b2.id,
            giang_vien_id: gv2.id,
          },
        },
      });
      await request(app.getHttpServer())
        .patch(`/giang-vien/phan-cong/${pcHoTro.id}/xac-nhan-gio`)
        .set('Authorization', `Bearer ${tokenQT}`)
        .send({ da_xac_nhan_gio: true })
        .expect(400);

      const gv1 = await gvTheoEmail(1);
      const pc = await prisma.phan_cong_giang_day.findUniqueOrThrow({
        where: {
          lich_hoc_id_giang_vien_id: {
            lich_hoc_id: lich.l1b1.id,
            giang_vien_id: gv1.id,
          },
        },
      });
      const res = await request(app.getHttpServer())
        .patch(`/giang-vien/phan-cong/${pc.id}/xac-nhan-gio`)
        .set('Authorization', `Bearer ${tokenQT}`)
        .send({ da_xac_nhan_gio: true })
        .expect(200);
      expect(res.body.da_xac_nhan_gio).toBe(true);
      expect(res.body.nguoi_xac_nhan_id).toBe(quanTri.nguoiDung.id);
    });

    it('gỡ phân công đã xác nhận giờ → 409', async () => {
      await request(app.getHttpServer())
        .put(`/lop/${lop.id}/lich-hoc/${lich.l1b1.id}/giang-vien`)
        .set('Authorization', `Bearer ${tokenQT}`)
        .send({ phan_cong: [] })
        .expect(409);
    });

    it('báo cáo chỉ cộng giờ đã xác nhận; Quản trị thấy SĐT/email', async () => {
      const res = await request(app.getHttpServer())
        .get('/bao-cao/gio-day')
        .query({ khoa_id: khoa.id })
        .set('Authorization', `Bearer ${tokenQT}`)
        .expect(200);
      const gv1 = await gvTheoEmail(1);
      const dongA = res.body.rows.find(
        (r: { giang_vien_id: string }) => r.giang_vien_id === gv1.id,
      );
      expect(dongA).toEqual(
        expect.objectContaining({
          so_buoi: 1,
          so_buoi_da_xac_nhan: 1,
          tong_gio_da_xac_nhan: 3,
          email: emailGv(1),
        }),
      );
      // Giảng viên B (3 giờ chưa xác nhận ở Lớp 2) → 0 giờ.
      const tongGioDaXacNhan = res.body.rows.reduce(
        (t: number, r: { tong_gio_da_xac_nhan: number }) =>
          t + r.tong_gio_da_xac_nhan,
        0,
      );
      expect(tongGioDaXacNhan).toBe(3);
    });

    it('Trường A (đặt hàng khóa) thấy báo cáo nhưng không có SĐT/email; Excel tải được', async () => {
      const res = await request(app.getHttpServer())
        .get('/bao-cao/gio-day')
        .query({ khoa_id: khoa.id })
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(res.body.rows.length).toBeGreaterThan(0);
      for (const r of res.body.rows) {
        expect(r).not.toHaveProperty('so_dien_thoai');
        expect(r).not.toHaveProperty('email');
      }
      await request(app.getHttpServer())
        .get('/bao-cao/gio-day/xuat-excel')
        .query({ khoa_id: khoa.id })
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200)
        .expect('Content-Type', /spreadsheetml/);
    });

    it('Trường B (ngoài phạm vi): chọn khóa → 403; không chọn → không có dòng của khóa này', async () => {
      await request(app.getHttpServer())
        .get('/bao-cao/gio-day')
        .query({ khoa_id: khoa.id })
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(403);
      const res = await request(app.getHttpServer())
        .get('/bao-cao/gio-day')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);
      expect(
        res.body.rows.filter(
          (r: { ma_khoa: string }) => r.ma_khoa === khoa.ma_khoa,
        ),
      ).toHaveLength(0);
    });
  });

  describe('Quyền + học viên', () => {
    it('GET /giang-vien, lịch dạy, xác nhận giờ → 403 với Trường', async () => {
      const gv1 = await gvTheoEmail(1);
      await request(app.getHttpServer())
        .get('/giang-vien')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(403);
      await request(app.getHttpServer())
        .get(`/giang-vien/${gv1.id}/lich-day`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(403);
      await request(app.getHttpServer())
        .patch(`/giang-vien/phan-cong/${gv1.id}/xac-nhan-gio`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ da_xac_nhan_gio: false })
        .expect(403);
    });

    it('Quản trị: lịch dạy của giảng viên có đủ buổi kèm lớp/khóa', async () => {
      const gv1 = await gvTheoEmail(1);
      const res = await request(app.getHttpServer())
        .get(`/giang-vien/${gv1.id}/lich-day`)
        .set('Authorization', `Bearer ${tokenQT}`)
        .expect(200);
      expect(res.body.phan_cong).toHaveLength(1);
      expect(res.body.phan_cong[0].lich_hoc.lop.ten_lop).toBe('Zoom 1');
    });

    it('học viên xem khóa học: buổi có họ tên + vai trò giảng viên, KHÔNG có SĐT/email', async () => {
      const ten = `MOET-GV-${uniqueSuffix()}`;
      const hv = await prisma.hoc_vien.create({
        data: {
          nguon_tao: 'import_moet',
          ma_dinh_danh_moet: ten,
          ho_ten: 'Học Viên T11',
          ngay_sinh: 1,
          thang_sinh: 1,
          nam_sinh: NAM_HOP_LE,
          don_vi_cong_tac_id: dvA.donVi.id,
          trang_thai: 'da_duyet',
          nguoi_duyet_id: quanTri.nguoiDung.id,
          cap_duyet_thuc_te: 'quan_tri',
          ngay_duyet: new Date(),
        },
      });
      hocVienIds.push(hv.id);
      const nd = await prisma.nguoi_dung.create({
        data: {
          ho_ten: hv.ho_ten,
          ten_dang_nhap: ten,
          vai_tro: 'hoc_vien',
          hoc_vien_id: hv.id,
          mat_khau_hash: await bcrypt.hash('x', 4),
          phai_doi_mat_khau: false,
        },
      });
      nguoiDungHocVienIds.push(nd.id);
      const dk = await prisma.dang_ky_hoc.create({
        data: { hoc_vien_id: hv.id, khoa_id: khoa.id, trang_thai: 'da_duyet' },
      });
      const gd = await prisma.giai_doan_khoa.findFirstOrThrow({
        where: { khoa_id: khoa.id },
      });
      await prisma.phan_lop_giai_doan.create({
        data: { dang_ky_hoc_id: dk.id, giai_doan_id: gd.id, lop_id: lop.id },
      });
      const token = await dangNhap(ten, 'x');
      const res = await request(app.getHttpServer())
        .get('/hoc-vien/toi/khoa-hoc')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const buoi1 = res.body[0].giai_doan[0].lop.lich_hoc.find(
        (b: { buoi_so: number }) => b.buoi_so === 1,
      );
      expect(buoi1.giang_vien).toEqual([
        { ho_ten: 'Nguyễn Văn A (sửa)', vai_tro: 'giang_vien' },
      ]);
      const json = JSON.stringify(res.body);
      expect(json).not.toContain(emailGv(1));
      expect(json).not.toContain(sdt(11));
    });
  });
});
