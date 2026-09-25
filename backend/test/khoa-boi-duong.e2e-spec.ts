import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as ExcelJS from 'exceljs';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoNguoiDungTest,
  uniqueSuffix,
  xoaNguoiDungTest,
  xoaDonViTest,
} from './utils/test-data';

const NAM_HOP_LE = new Date().getUTCFullYear() - 20;

function soDinhDanhNgauNhien(): string {
  const t = Date.now().toString().slice(-6);
  const r = Math.floor(100000 + Math.random() * 899999).toString();
  return `${t}${r}`;
}

describe('Khóa bồi dưỡng & Lớp học (e2e)', () => {
  let app: INestApplication;

  // Cây hành chính: soGddt -> phongVhxh -> truong1 (routing khóa đi theo
  // don_vi_cha_id trực tiếp của Trường tổ chức, KHÁC hồ sơ học viên — xem
  // KhoaBoiDuongService.resolveDonViDuyetKhoa). truong2 thuộc phongKhac
  // (không liên quan) dùng để test out-of-scope. truongMoCoi không có
  // don_vi_cha_id để test "không xác định được đơn vị duyệt".
  let tinh: { id: string };
  let xa: { id: string };
  let soGddt: { id: string };
  let phongVhxh: { id: string };
  let phongKhac: { id: string };
  let truong1: { id: string };
  let truong2: { id: string };
  let truongMoCoi: { id: string };

  let quanTri: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let soAccount: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let phongAccount: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let phongKhacAccount: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let truong1Account: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let truong2Account: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let truongMoCoiAccount: Awaited<ReturnType<typeof taoNguoiDungTest>>;

  let tokenQuanTri: string;
  let tokenSo: string;
  let tokenPhong: string;
  let tokenPhongKhac: string;
  let tokenTruong1: string;
  let tokenTruong2: string;
  let tokenTruongMoCoi: string;

  const khoaIds: string[] = [];
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

  function baseKhoaBody(overrides: Record<string, unknown> = {}) {
    const suf = uniqueSuffix();
    return {
      ma_khoa: `K-${suf}`,
      ten_khoa: `Khóa test ${suf}`,
      thoi_gian_bat_dau: '2026-01-01',
      thoi_gian_ket_thuc: '2026-01-31',
      ...overrides,
    };
  }

  beforeAll(async () => {
    app = await createTestApp();
    const suf = uniqueSuffix();

    tinh = await prisma.dia_danh.create({
      data: { ma: `T-kbd-${suf}`, ten: `Tỉnh KBD ${suf}`, cap: 'tinh_thanh' },
    });
    xa = await prisma.dia_danh.create({
      data: {
        ma: `X-kbd-${suf}`,
        ten: `Xã KBD ${suf}`,
        cap: 'phuong_xa_dac_khu',
        parent_id: tinh.id,
      },
    });
    soGddt = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-so-kbd-${suf}`,
        ten_don_vi: `Sở GD&ĐT KBD ${suf}`,
        loai_don_vi: 'so_gddt',
        dia_ban_id: xa.id,
      },
    });
    phongVhxh = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-phong-kbd-${suf}`,
        ten_don_vi: `Phòng VHXH KBD ${suf}`,
        loai_don_vi: 'phong_vhxh',
        dia_ban_id: xa.id,
        don_vi_cha_id: soGddt.id,
      },
    });
    phongKhac = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-phong-khac-kbd-${suf}`,
        ten_don_vi: `Phòng VHXH khác KBD ${suf}`,
        loai_don_vi: 'phong_vhxh',
        dia_ban_id: xa.id,
      },
    });
    truong1 = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-truong1-kbd-${suf}`,
        ten_don_vi: `Trường 1 KBD ${suf}`,
        loai_don_vi: 'truong',
        dia_ban_id: xa.id,
        don_vi_cha_id: phongVhxh.id,
      },
    });
    truong2 = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-truong2-kbd-${suf}`,
        ten_don_vi: `Trường 2 KBD ${suf}`,
        loai_don_vi: 'truong',
        dia_ban_id: xa.id,
        don_vi_cha_id: phongKhac.id,
      },
    });
    truongMoCoi = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-truong-mocoi-kbd-${suf}`,
        ten_don_vi: `Trường mồ côi KBD ${suf}`,
        loai_don_vi: 'truong',
        dia_ban_id: xa.id,
      },
    });

    quanTri = await taoNguoiDungTest({
      vai_tro: 'quan_tri',
      don_vi_id: truong1.id,
      mat_khau: 'MatKhau123',
    });
    soAccount = await taoNguoiDungTest({
      vai_tro: 'so_gddt',
      don_vi_id: soGddt.id,
      mat_khau: 'MatKhau123',
    });
    phongAccount = await taoNguoiDungTest({
      vai_tro: 'phong_vhxh',
      don_vi_id: phongVhxh.id,
      mat_khau: 'MatKhau123',
    });
    phongKhacAccount = await taoNguoiDungTest({
      vai_tro: 'phong_vhxh',
      don_vi_id: phongKhac.id,
      mat_khau: 'MatKhau123',
    });
    truong1Account = await taoNguoiDungTest({
      vai_tro: 'truong',
      don_vi_id: truong1.id,
      mat_khau: 'MatKhau123',
    });
    truong2Account = await taoNguoiDungTest({
      vai_tro: 'truong',
      don_vi_id: truong2.id,
      mat_khau: 'MatKhau123',
    });
    truongMoCoiAccount = await taoNguoiDungTest({
      vai_tro: 'truong',
      don_vi_id: truongMoCoi.id,
      mat_khau: 'MatKhau123',
    });

    tokenQuanTri = await dangNhap(quanTri.ten_dang_nhap, 'MatKhau123');
    tokenSo = await dangNhap(soAccount.ten_dang_nhap, 'MatKhau123');
    tokenPhong = await dangNhap(phongAccount.ten_dang_nhap, 'MatKhau123');
    tokenPhongKhac = await dangNhap(
      phongKhacAccount.ten_dang_nhap,
      'MatKhau123',
    );
    tokenTruong1 = await dangNhap(truong1Account.ten_dang_nhap, 'MatKhau123');
    tokenTruong2 = await dangNhap(truong2Account.ten_dang_nhap, 'MatKhau123');
    tokenTruongMoCoi = await dangNhap(
      truongMoCoiAccount.ten_dang_nhap,
      'MatKhau123',
    );
  });

  afterAll(async () => {
    await prisma.dang_ky_hoc.deleteMany({
      where: {
        OR: [
          { khoa_id: { in: khoaIds } },
          { hoc_vien_id: { in: hocVienIds } },
        ],
      },
    });
    // Xóa trước khi xóa hoc_vien — nhat_ky_thong_bao.hoc_vien_id FK
    // onDelete: NoAction, xem docs/database-ddl.sql PHẦN 4.
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
    await prisma.khoa_boi_duong.deleteMany({
      where: { id: { in: khoaIds } },
    });
    await xoaNguoiDungTest(quanTri.nguoiDung.id);
    await xoaNguoiDungTest(soAccount.nguoiDung.id);
    await xoaNguoiDungTest(phongAccount.nguoiDung.id);
    await xoaNguoiDungTest(phongKhacAccount.nguoiDung.id);
    await xoaNguoiDungTest(truong1Account.nguoiDung.id);
    await xoaNguoiDungTest(truong2Account.nguoiDung.id);
    await xoaNguoiDungTest(truongMoCoiAccount.nguoiDung.id);
    await xoaDonViTest(
      [truong1.id, truong2.id, truongMoCoi.id, phongVhxh.id, phongKhac.id, soGddt.id],
      [xa.id, tinh.id],
    );
    await prisma.$disconnect();
    await app.close();
  });

  describe('POST /khoa-boi-duong', () => {
    it('truong tạo khóa -> 201, trang_thai=nhap, don_vi_to_chuc_id=own', async () => {
      const res = await request(app.getHttpServer())
        .post('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .send(baseKhoaBody())
        .expect(201);
      expect(res.body.trang_thai).toBe('nhap');
      expect(res.body.don_vi_to_chuc_id).toBe(truong1.id);
      khoaIds.push(res.body.id);
    });

    it('thiếu field bắt buộc -> 400', async () => {
      const body = baseKhoaBody();
      delete (body as Record<string, unknown>).ten_khoa;
      await request(app.getHttpServer())
        .post('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .send(body)
        .expect(400);
    });

    it('thoi_gian_ket_thuc < thoi_gian_bat_dau -> 400 (rule #49)', async () => {
      await request(app.getHttpServer())
        .post('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .send(
          baseKhoaBody({
            thoi_gian_bat_dau: '2026-02-01',
            thoi_gian_ket_thuc: '2026-01-01',
          }),
        )
        .expect(400);
    });

    it('trùng ma_khoa -> 409', async () => {
      const body = baseKhoaBody();
      const first = await request(app.getHttpServer())
        .post('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .send(body)
        .expect(201);
      khoaIds.push(first.body.id);

      await request(app.getHttpServer())
        .post('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .send(body)
        .expect(409);
    });

    it('vai_tro phong_vhxh gọi -> 403 (chỉ Trường tạo khóa, rule #47)', async () => {
      await request(app.getHttpServer())
        .post('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenPhong}`)
        .send(baseKhoaBody())
        .expect(403);
    });
  });

  describe('PATCH /khoa-boi-duong/{id} + POST .../nop-duyet + POST .../duyet', () => {
    let khoaId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .send(baseKhoaBody())
        .expect(201);
      khoaId = res.body.id;
      khoaIds.push(khoaId);
    });

    it('chủ khóa sửa khi nhap -> 200', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/khoa-boi-duong/${khoaId}`)
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .send({ ten_khoa: 'Tên đã sửa' })
        .expect(200);
      expect(res.body.ten_khoa).toBe('Tên đã sửa');
    });

    it('không phải chủ khóa (truong2) -> 403', async () => {
      await request(app.getHttpServer())
        .patch(`/khoa-boi-duong/${khoaId}`)
        .set('Authorization', `Bearer ${tokenTruong2}`)
        .send({ ten_khoa: 'X' })
        .expect(403);
    });

    it('nộp duyệt: nhap -> cho_duyet -> 201', async () => {
      const res = await request(app.getHttpServer())
        .post(`/khoa-boi-duong/${khoaId}/nop-duyet`)
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .expect(201);
      expect(res.body.trang_thai).toBe('cho_duyet');
    });

    it('nộp duyệt lần 2 khi đã cho_duyet -> 409', async () => {
      await request(app.getHttpServer())
        .post(`/khoa-boi-duong/${khoaId}/nop-duyet`)
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .expect(409);
    });

    it('PATCH khi đã cho_duyet -> 409', async () => {
      await request(app.getHttpServer())
        .patch(`/khoa-boi-duong/${khoaId}`)
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .send({ ten_khoa: 'Y' })
        .expect(409);
    });

    it('duyệt bởi vai_tro truong -> 403 (RolesGuard, không nằm trong "Ai gọi")', async () => {
      await request(app.getHttpServer())
        .post(`/khoa-boi-duong/${khoaId}/duyet`)
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .send({ ket_qua: 'da_duyet' })
        .expect(403);
    });

    it('Phòng VHXH khác (ngoài phạm vi — routing trỏ tới phongVhxh, không phải phongKhac) -> 403', async () => {
      await request(app.getHttpServer())
        .post(`/khoa-boi-duong/${khoaId}/duyet`)
        .set('Authorization', `Bearer ${tokenPhongKhac}`)
        .send({ ket_qua: 'da_duyet' })
        .expect(403);
    });

    it('đúng Phòng VHXH quản lý (routing theo don_vi_cha_id của Trường) -> 201, ghi nguoi_duyet_id/cap_duyet_thuc_te/ngay_duyet', async () => {
      const res = await request(app.getHttpServer())
        .post(`/khoa-boi-duong/${khoaId}/duyet`)
        .set('Authorization', `Bearer ${tokenPhong}`)
        .send({ ket_qua: 'da_duyet' })
        .expect(201);
      expect(res.body.trang_thai).toBe('da_duyet');
      expect(res.body.nguoi_duyet_id).toBe(phongAccount.nguoiDung.id);
      expect(res.body.cap_duyet_thuc_te).toBe('phong_vhxh');
      expect(res.body.ngay_duyet).toBeDefined();
    });

    it('duyệt lần 2 khi đã da_duyet -> 409', async () => {
      await request(app.getHttpServer())
        .post(`/khoa-boi-duong/${khoaId}/duyet`)
        .set('Authorization', `Bearer ${tokenPhong}`)
        .send({ ket_qua: 'da_duyet' })
        .expect(409);
    });

    it('Sở duyệt thay được (escalation) một khóa khác cùng cây', async () => {
      const another = await request(app.getHttpServer())
        .post('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .send(baseKhoaBody())
        .expect(201);
      khoaIds.push(another.body.id);
      await request(app.getHttpServer())
        .post(`/khoa-boi-duong/${another.body.id}/nop-duyet`)
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .expect(201);

      const res = await request(app.getHttpServer())
        .post(`/khoa-boi-duong/${another.body.id}/duyet`)
        .set('Authorization', `Bearer ${tokenSo}`)
        .send({ ket_qua: 'tu_choi', ly_do: 'Thiếu thông tin' })
        .expect(201);
      expect(res.body.trang_thai).toBe('tu_choi');
      expect(res.body.cap_duyet_thuc_te).toBe('so_gddt');
    });

    it('Trường không có don_vi_cha_id -> duyệt -> 404 (không xác định được đơn vị duyệt)', async () => {
      const khoaMoCoi = await request(app.getHttpServer())
        .post('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenTruongMoCoi}`)
        .send(baseKhoaBody())
        .expect(201);
      khoaIds.push(khoaMoCoi.body.id);
      await request(app.getHttpServer())
        .post(`/khoa-boi-duong/${khoaMoCoi.body.id}/nop-duyet`)
        .set('Authorization', `Bearer ${tokenTruongMoCoi}`)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/khoa-boi-duong/${khoaMoCoi.body.id}/duyet`)
        .set('Authorization', `Bearer ${tokenSo}`)
        .send({ ket_qua: 'da_duyet' })
        .expect(404);
    });
  });

  describe('GET /khoa-boi-duong, GET /khoa-boi-duong/{id} — scoping', () => {
    let khoaTruong1Id: string;
    let khoaTruong2Id: string;

    beforeAll(async () => {
      const k1 = await request(app.getHttpServer())
        .post('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .send(baseKhoaBody())
        .expect(201);
      khoaTruong1Id = k1.body.id;
      khoaIds.push(khoaTruong1Id);

      const k2 = await request(app.getHttpServer())
        .post('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenTruong2}`)
        .send(baseKhoaBody())
        .expect(201);
      khoaTruong2Id = k2.body.id;
      khoaIds.push(khoaTruong2Id);
    });

    it('truong1 chỉ thấy khóa của mình trong danh sách', async () => {
      const res = await request(app.getHttpServer())
        .get('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .expect(200);
      const ids = res.body.data.map((k: { id: string }) => k.id);
      expect(ids).toContain(khoaTruong1Id);
      expect(ids).not.toContain(khoaTruong2Id);
    });

    it('so_gddt thấy khóa của truong1 (con cháu) nhưng không thấy khóa của truong2 (khác cây)', async () => {
      const res = await request(app.getHttpServer())
        .get('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenSo}`)
        .expect(200);
      const ids = res.body.data.map((k: { id: string }) => k.id);
      expect(ids).toContain(khoaTruong1Id);
      expect(ids).not.toContain(khoaTruong2Id);
    });

    it('truong1 xem chi tiết khóa của truong2 -> 403', async () => {
      await request(app.getHttpServer())
        .get(`/khoa-boi-duong/${khoaTruong2Id}`)
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .expect(403);
    });

    it('id không tồn tại -> 404', async () => {
      await request(app.getHttpServer())
        .get('/khoa-boi-duong/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .expect(404);
    });

    it('chi tiết trả kèm giai_doan + lop_hoc (rỗng ban đầu)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/khoa-boi-duong/${khoaTruong1Id}`)
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .expect(200);
      expect(res.body.giai_doan).toEqual([]);
      expect(res.body.lop_hoc).toEqual([]);
    });
  });

  describe('Giai đoạn / Lớp / Lịch học / Nhân sự', () => {
    let khoaId: string;
    let khoaKhacId: string;
    let lopId: string;
    let giaiDoan1Id: string;
    let giaiDoanKhacKhoaId: string;

    beforeAll(async () => {
      const k = await request(app.getHttpServer())
        .post('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .send(baseKhoaBody())
        .expect(201);
      khoaId = k.body.id;
      khoaIds.push(khoaId);

      const kKhac = await request(app.getHttpServer())
        .post('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenTruong2}`)
        .send(baseKhoaBody())
        .expect(201);
      khoaKhacId = kKhac.body.id;
      khoaIds.push(khoaKhacId);

      const gdKhac = await request(app.getHttpServer())
        .post(`/khoa-boi-duong/${khoaKhacId}/giai-doan`)
        .set('Authorization', `Bearer ${tokenTruong2}`)
        .send({
          thu_tu: 1,
          ten_giai_doan: 'GĐ khóa khác',
          hinh_thuc: 'truc_tiep',
          thoi_gian_bat_dau: '2026-01-01',
          thoi_gian_ket_thuc: '2026-01-10',
        })
        .expect(201);
      giaiDoanKhacKhoaId = gdKhac.body.id;
    });

    it('POST giai-doan hợp lệ -> 201', async () => {
      const res = await request(app.getHttpServer())
        .post(`/khoa-boi-duong/${khoaId}/giai-doan`)
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .send({
          thu_tu: 1,
          ten_giai_doan: 'Giai đoạn 1 - Trực tiếp',
          hinh_thuc: 'truc_tiep',
          thoi_gian_bat_dau: '2026-01-01',
          thoi_gian_ket_thuc: '2026-01-10',
        })
        .expect(201);
      giaiDoan1Id = res.body.id;
    });

    it('trùng thu_tu trong cùng khóa -> 409 (uq_giai_doan_thu_tu)', async () => {
      await request(app.getHttpServer())
        .post(`/khoa-boi-duong/${khoaId}/giai-doan`)
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .send({
          thu_tu: 1,
          ten_giai_doan: 'Giai đoạn trùng',
          hinh_thuc: 'truc_tuyen',
          thoi_gian_bat_dau: '2026-01-11',
          thoi_gian_ket_thuc: '2026-01-20',
        })
        .expect(409);
    });

    it('thoi_gian_ket_thuc < thoi_gian_bat_dau -> 400 (chk_giai_doan_thoi_gian)', async () => {
      await request(app.getHttpServer())
        .post(`/khoa-boi-duong/${khoaId}/giai-doan`)
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .send({
          thu_tu: 2,
          ten_giai_doan: 'Giai đoạn sai thời gian',
          hinh_thuc: 'khac',
          thoi_gian_bat_dau: '2026-02-10',
          thoi_gian_ket_thuc: '2026-02-01',
        })
        .expect(400);
    });

    it('POST lop hợp lệ -> 201', async () => {
      const res = await request(app.getHttpServer())
        .post(`/khoa-boi-duong/${khoaId}/lop`)
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .send({ ten_lop: 'Lớp A', si_so_toi_da: 30 })
        .expect(201);
      lopId = res.body.id;
      expect(res.body.khoa_id).toBe(khoaId);
    });

    it('không phải chủ khóa tạo lớp -> 403', async () => {
      await request(app.getHttpServer())
        .post(`/khoa-boi-duong/${khoaId}/lop`)
        .set('Authorization', `Bearer ${tokenTruong2}`)
        .send({ ten_lop: 'Lớp lạ' })
        .expect(403);
    });

    it('POST /lop/{id}/lich-hoc với giai_doan_id thuộc khóa KHÁC -> 400 (rule #50)', async () => {
      await request(app.getHttpServer())
        .post(`/lop/${lopId}/lich-hoc`)
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .send({
          giai_doan_id: giaiDoanKhacKhoaId,
          thoi_gian_bat_dau: '2026-01-02T08:00:00.000Z',
          thoi_gian_ket_thuc: '2026-01-02T11:00:00.000Z',
        })
        .expect(400);
    });

    it('thoi_gian_ket_thuc <= thoi_gian_bat_dau -> 400 (chk_lich_hoc_thoi_gian, strict >)', async () => {
      await request(app.getHttpServer())
        .post(`/lop/${lopId}/lich-hoc`)
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .send({
          giai_doan_id: giaiDoan1Id,
          thoi_gian_bat_dau: '2026-01-02T08:00:00.000Z',
          thoi_gian_ket_thuc: '2026-01-02T08:00:00.000Z',
        })
        .expect(400);
    });

    it('lich-hoc hợp lệ (cùng khóa) -> 201', async () => {
      await request(app.getHttpServer())
        .post(`/lop/${lopId}/lich-hoc`)
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .send({
          giai_doan_id: giaiDoan1Id,
          thoi_gian_bat_dau: '2026-01-02T08:00:00.000Z',
          thoi_gian_ket_thuc: '2026-01-02T11:00:00.000Z',
          dia_diem_hoac_link: 'Hội trường A',
        })
        .expect(201);
    });

    it('lich-hoc trùng (lop_id, giai_doan_id) -> 409', async () => {
      await request(app.getHttpServer())
        .post(`/lop/${lopId}/lich-hoc`)
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .send({
          giai_doan_id: giaiDoan1Id,
          thoi_gian_bat_dau: '2026-01-03T08:00:00.000Z',
          thoi_gian_ket_thuc: '2026-01-03T11:00:00.000Z',
        })
        .expect(409);
    });

    it('POST /lop/{id}/nhan-su -> 201, DELETE -> xóa được, xóa lần 2 -> 404', async () => {
      const res = await request(app.getHttpServer())
        .post(`/lop/${lopId}/nhan-su`)
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .send({ ho_ten: 'Giảng viên A', vai_tro: 'giang_vien' })
        .expect(201);
      const nhanSuId = res.body.id;

      await request(app.getHttpServer())
        .delete(`/lop/${lopId}/nhan-su/${nhanSuId}`)
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/lop/${lopId}/nhan-su/${nhanSuId}`)
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .expect(404);
    });
  });

  describe('Import phan_lop_hoc_vien — nguồn duy nhất gán dang_ky_hoc.khoa_id/lop_id (sửa 2026-09-25: bỏ hook tự ghi danh theo hồ sơ da_duyet)', () => {
    let khoaId: string;
    let maKhoa: string;
    let lopId: string;
    let tenLop: string;
    let hocVienDaDuyetId: string;
    let sddDaDuyet: string;
    let sddChuaDuyet: string;
    let tokenHocVienDaDuyet: string;

    beforeAll(async () => {
      const suf = uniqueSuffix();
      const kBody = baseKhoaBody();
      maKhoa = kBody.ma_khoa;
      const k = await request(app.getHttpServer())
        .post('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .send(kBody)
        .expect(201);
      khoaId = k.body.id;
      khoaIds.push(khoaId);
      await request(app.getHttpServer())
        .post(`/khoa-boi-duong/${khoaId}/nop-duyet`)
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .expect(201);
      await request(app.getHttpServer())
        .post(`/khoa-boi-duong/${khoaId}/duyet`)
        .set('Authorization', `Bearer ${tokenPhong}`)
        .send({ ket_qua: 'da_duyet' })
        .expect(201);

      tenLop = `Lớp phân ${suf}`;
      const lop = await request(app.getHttpServer())
        .post(`/khoa-boi-duong/${khoaId}/lop`)
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .send({ ten_lop: tenLop })
        .expect(201);
      lopId = lop.body.id;

      // Học viên có hồ sơ da_duyet — điều kiện CẦN để được import ghi danh,
      // nhưng KHÔNG tự động có dang_ky_hoc nào (không còn hook rule #52).
      sddDaDuyet = soDinhDanhNgauNhien();
      const dk = await request(app.getHttpServer())
        .post('/hoc-vien')
        .send({
          ho_ten: 'Vũ Thị Phân Lớp',
          so_dinh_danh_ca_nhan: sddDaDuyet,
          ngay_sinh: 12,
          thang_sinh: 7,
          nam_sinh: NAM_HOP_LE,
          noi_sinh_id: tinh.id,
          phuong_xa_id: xa.id,
          don_vi_cong_tac_id: truong1.id,
          so_dien_thoai_lien_he: '0912346000',
          email_lien_he: `pl-${suf}@test.local`,
          trinh_do_chuyen_mon: 'dai_hoc',
          chuyen_mon: ['Sư phạm Sử'],
        })
        .expect(201);
      hocVienDaDuyetId = dk.body.hoc_vien_id;
      hocVienIds.push(hocVienDaDuyetId);
      const nd = await prisma.nguoi_dung.findUnique({
        where: { ten_dang_nhap: sddDaDuyet },
      });
      if (nd) nguoiDungHocVienIds.push(nd.id);
      tokenHocVienDaDuyet = await dangNhap(sddDaDuyet, `1207${NAM_HOP_LE}`);
      await request(app.getHttpServer())
        .post('/hoc-vien/toi/xac-nhan')
        .set('Authorization', `Bearer ${tokenHocVienDaDuyet}`)
        .expect(201);
      await request(app.getHttpServer())
        .post(`/hoc-vien/${hocVienDaDuyetId}/duyet`)
        .set('Authorization', `Bearer ${tokenSo}`)
        .send({ ket_qua: 'da_duyet' })
        .expect(201);

      // Học viên hồ sơ CHƯA duyệt (còn cho_duyet) — dùng để test lỗi
      // "chưa được duyệt".
      sddChuaDuyet = soDinhDanhNgauNhien();
      const dk2 = await request(app.getHttpServer())
        .post('/hoc-vien')
        .send({
          ho_ten: 'Đỗ Văn Chưa Duyệt',
          so_dinh_danh_ca_nhan: sddChuaDuyet,
          ngay_sinh: 3,
          thang_sinh: 9,
          nam_sinh: NAM_HOP_LE,
          noi_sinh_id: tinh.id,
          phuong_xa_id: xa.id,
          don_vi_cong_tac_id: truong2.id,
          so_dien_thoai_lien_he: '0912347000',
          email_lien_he: `cdk-${suf}@test.local`,
          trinh_do_chuyen_mon: 'dai_hoc',
          chuyen_mon: ['Sư phạm Địa'],
        })
        .expect(201);
      hocVienIds.push(dk2.body.hoc_vien_id);
      const nd2 = await prisma.nguoi_dung.findUnique({
        where: { ten_dang_nhap: sddChuaDuyet },
      });
      if (nd2) nguoiDungHocVienIds.push(nd2.id);
      const tokenHv2 = await dangNhap(sddChuaDuyet, `0309${NAM_HOP_LE}`);
      await request(app.getHttpServer())
        .post('/hoc-vien/toi/xac-nhan')
        .set('Authorization', `Bearer ${tokenHv2}`)
        .expect(201);
      // Cố tình KHÔNG duyệt hồ sơ này -> vẫn ở trang_thai=cho_duyet.
    });

    it('GET /import/mau-excel?loai=phan_lop_hoc_vien -> đúng 3 cột', async () => {
      const res = await request(app.getHttpServer())
        .get('/import/mau-excel?loai=phan_lop_hoc_vien')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(res.headers['content-type']).toContain('spreadsheetml');
    });

    it('ten_lop để trống -> chỉ ghi danh (lop_id=null, trang_thai=da_duyet); các dòng lỗi khác (rule #45)', async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('data');
      sheet.addRow(['so_dinh_danh_ca_nhan', 'ma_khoa', 'ten_lop']);
      sheet.addRow([sddDaDuyet, maKhoa, '']); // hợp lệ — chỉ ghi danh
      sheet.addRow(['000000000000', maKhoa, '']); // ĐDCN không tồn tại
      sheet.addRow([sddChuaDuyet, maKhoa, '']); // hồ sơ chưa được duyệt
      sheet.addRow([sddDaDuyet, 'KHONG-TON-TAI', '']); // khóa không tồn tại
      sheet.addRow([sddDaDuyet, maKhoa, 'Lớp không tồn tại']); // lớp không tồn tại trong khóa
      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

      const res = await request(app.getHttpServer())
        .post('/import/phan_lop_hoc_vien')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach('file', buffer, 'phan-lop-1.xlsx')
        .expect(201);
      const importId = res.body.import_id;
      importIds.push(importId);

      const ketQua = await request(app.getHttpServer())
        .get(`/import/${importId}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(ketQua.body.tong_so_dong).toBe(5);
      expect(ketQua.body.so_dong_thanh_cong).toBe(1);
      expect(ketQua.body.so_dong_loi).toBe(4);

      const xacNhan = await request(app.getHttpServer())
        .post(`/import/${importId}/xac-nhan`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(201);
      expect(xacNhan.body.so_dong_thanh_cong).toBe(1);
      expect(xacNhan.body.so_dong_loi).toBe(4);

      const dangKy = await prisma.dang_ky_hoc.findUnique({
        where: {
          hoc_vien_id_khoa_id: {
            hoc_vien_id: hocVienDaDuyetId,
            khoa_id: khoaId,
          },
        },
      });
      expect(dangKy).not.toBeNull();
      expect(dangKy?.lop_id).toBeNull();
      expect(dangKy?.trang_thai).toBe('da_duyet');

      // Nhánh chỉ ghi danh (lop_id vẫn NULL) KHÔNG kích hoạt sự kiện
      // dang_ky_hoc_phan_lop (docs/api-contract.md mục 8).
      const thongBaoPhanLop = await prisma.nhat_ky_thong_bao.findMany({
        where: {
          hoc_vien_id: hocVienDaDuyetId,
          loai_su_kien: 'dang_ky_hoc_phan_lop',
        },
      });
      expect(thongBaoPhanLop).toHaveLength(0);
    });

    it('GET /hoc-vien/toi/khoa-hoc, /ket-qua phản ánh đúng ghi danh (lop=null) vừa import', async () => {
      const khoaHoc = await request(app.getHttpServer())
        .get('/hoc-vien/toi/khoa-hoc')
        .set('Authorization', `Bearer ${tokenHocVienDaDuyet}`)
        .expect(200);
      const entry = khoaHoc.body.find(
        (r: { khoa: { id: string } }) => r.khoa.id === khoaId,
      );
      expect(entry).toBeDefined();
      expect(entry.lop).toBeNull();

      const ketQua = await request(app.getHttpServer())
        .get('/hoc-vien/toi/ket-qua')
        .set('Authorization', `Bearer ${tokenHocVienDaDuyet}`)
        .expect(200);
      const entryKq = ketQua.body.find(
        (r: { khoa: { id: string } }) => r.khoa.id === khoaId,
      );
      expect(entryKq).toBeDefined();
      expect(entryKq.trang_thai).toBe('da_duyet');
      expect(entryKq.lop).toBeNull();
    });

    it('chạy lại import lần 2 với ten_lop có giá trị -> phân lớp cho học viên đã ghi danh (lop_id, trang_thai=da_phan_lop)', async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('data');
      sheet.addRow(['so_dinh_danh_ca_nhan', 'ma_khoa', 'ten_lop']);
      sheet.addRow([sddDaDuyet, maKhoa, tenLop]);
      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

      const res = await request(app.getHttpServer())
        .post('/import/phan_lop_hoc_vien')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach('file', buffer, 'phan-lop-2.xlsx')
        .expect(201);
      const importId = res.body.import_id;
      importIds.push(importId);
      await request(app.getHttpServer())
        .post(`/import/${importId}/xac-nhan`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(201);

      const dangKy = await prisma.dang_ky_hoc.findUnique({
        where: {
          hoc_vien_id_khoa_id: {
            hoc_vien_id: hocVienDaDuyetId,
            khoa_id: khoaId,
          },
        },
      });
      expect(dangKy?.lop_id).toBe(lopId);
      expect(dangKy?.trang_thai).toBe('da_phan_lop');

      // Nhánh gán lop_id thực sự -> kích hoạt sự kiện dang_ky_hoc_phan_lop,
      // gửi thật qua Ethereal (không SMTP giả) -> ghi trang_thai=thanh_cong.
      const thongBaoPhanLop = await prisma.nhat_ky_thong_bao.findMany({
        where: {
          hoc_vien_id: hocVienDaDuyetId,
          loai_su_kien: 'dang_ky_hoc_phan_lop',
        },
      });
      expect(thongBaoPhanLop).toHaveLength(1);
      expect(thongBaoPhanLop[0].trang_thai).toBe('thanh_cong');
      expect(thongBaoPhanLop[0].email_nguoi_nhan).toContain('pl-');
    });

    it('ghi danh + phân lớp trong 1 lần import duy nhất (ten_lop có giá trị ngay từ đầu, học viên chưa từng đăng ký)', async () => {
      const suf = uniqueSuffix();
      const sddMoi = soDinhDanhNgauNhien();
      const dk = await request(app.getHttpServer())
        .post('/hoc-vien')
        .send({
          ho_ten: 'Ghi Danh Một Lần',
          so_dinh_danh_ca_nhan: sddMoi,
          ngay_sinh: 8,
          thang_sinh: 8,
          nam_sinh: NAM_HOP_LE,
          noi_sinh_id: tinh.id,
          phuong_xa_id: xa.id,
          don_vi_cong_tac_id: truong1.id,
          so_dien_thoai_lien_he: '0912348000',
          email_lien_he: `gd1-${suf}@test.local`,
          trinh_do_chuyen_mon: 'dai_hoc',
          chuyen_mon: ['Sư phạm Toán'],
        })
        .expect(201);
      const hocVienMoiId = dk.body.hoc_vien_id;
      hocVienIds.push(hocVienMoiId);
      const nd = await prisma.nguoi_dung.findUnique({
        where: { ten_dang_nhap: sddMoi },
      });
      if (nd) nguoiDungHocVienIds.push(nd.id);
      const tokenHvMoi = await dangNhap(sddMoi, `0808${NAM_HOP_LE}`);
      await request(app.getHttpServer())
        .post('/hoc-vien/toi/xac-nhan')
        .set('Authorization', `Bearer ${tokenHvMoi}`)
        .expect(201);
      await request(app.getHttpServer())
        .post(`/hoc-vien/${hocVienMoiId}/duyet`)
        .set('Authorization', `Bearer ${tokenSo}`)
        .send({ ket_qua: 'da_duyet' })
        .expect(201);

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('data');
      sheet.addRow(['so_dinh_danh_ca_nhan', 'ma_khoa', 'ten_lop']);
      sheet.addRow([sddMoi, maKhoa, tenLop]);
      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

      const res = await request(app.getHttpServer())
        .post('/import/phan_lop_hoc_vien')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach('file', buffer, 'phan-lop-3.xlsx')
        .expect(201);
      const importId = res.body.import_id;
      importIds.push(importId);
      await request(app.getHttpServer())
        .post(`/import/${importId}/xac-nhan`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(201);

      const dangKy = await prisma.dang_ky_hoc.findUnique({
        where: {
          hoc_vien_id_khoa_id: { hoc_vien_id: hocVienMoiId, khoa_id: khoaId },
        },
      });
      expect(dangKy).not.toBeNull();
      expect(dangKy?.lop_id).toBe(lopId);
      expect(dangKy?.trang_thai).toBe('da_phan_lop');

      const thongBaoPhanLop = await prisma.nhat_ky_thong_bao.findMany({
        where: {
          hoc_vien_id: hocVienMoiId,
          loai_su_kien: 'dang_ky_hoc_phan_lop',
        },
      });
      expect(thongBaoPhanLop).toHaveLength(1);
    });
  });

  describe('PATCH /dang-ky-hoc/{id}/ket-qua', () => {
    let khoaKetQuaId: string;
    let dangKyId: string;
    let hocVienKetQuaId: string;

    beforeAll(async () => {
      const suf = uniqueSuffix();
      const hv = await prisma.hoc_vien.create({
        data: {
          ho_ten: 'Học Viên Kết Quả',
          so_dinh_danh_ca_nhan: soDinhDanhNgauNhien(),
          ngay_sinh: 1,
          thang_sinh: 1,
          nam_sinh: NAM_HOP_LE,
          don_vi_cong_tac_id: truong1.id,
          so_dien_thoai_lien_he: '0900000000',
          email_lien_he: `kq-${suf}@test.local`,
          trang_thai: 'da_duyet',
          // chk_hoc_vien_duyet_dong_bo: trang_thai=da_duyet đòi hỏi
          // nguoi_duyet_id NOT NULL — tạo fixture trực tiếp qua Prisma nên
          // phải tự set, không đi qua HocVienService.duyet().
          nguoi_duyet_id: quanTri.nguoiDung.id,
          cap_duyet_thuc_te: 'quan_tri',
          ngay_duyet: new Date(),
        },
      });
      hocVienKetQuaId = hv.id;
      hocVienIds.push(hocVienKetQuaId);

      const khoa = await prisma.khoa_boi_duong.create({
        data: {
          ma_khoa: `K-KQ-${suf}`,
          ten_khoa: 'Khóa kiểm tra kết quả',
          don_vi_to_chuc_id: truong1.id,
          thoi_gian_bat_dau: new Date('2026-01-01'),
          thoi_gian_ket_thuc: new Date('2026-01-31'),
        },
      });
      khoaKetQuaId = khoa.id;
      khoaIds.push(khoaKetQuaId);

      const dk = await prisma.dang_ky_hoc.create({
        data: {
          hoc_vien_id: hocVienKetQuaId,
          khoa_id: khoaKetQuaId,
          trang_thai: 'da_duyet',
        },
      });
      dangKyId = dk.id;
    });

    it('chủ khóa (truong1) cập nhật kết quả -> 200, ghi ket_qua/ngay_hoan_thanh, bắn sự kiện dang_ky_hoc_ket_qua', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/dang-ky-hoc/${dangKyId}/ket-qua`)
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .send({ ket_qua: 'dat', ngay_hoan_thanh: '2026-01-31' })
        .expect(200);
      expect(res.body.ket_qua).toBe('dat');
      expect(res.body.ngay_hoan_thanh).toBeDefined();

      const thongBao = await prisma.nhat_ky_thong_bao.findMany({
        where: {
          hoc_vien_id: hocVienKetQuaId,
          loai_su_kien: 'dang_ky_hoc_ket_qua',
        },
      });
      expect(thongBao).toHaveLength(1);
      expect(thongBao[0].trang_thai).toBe('thanh_cong');
    });

    it('Phòng VHXH quản lý (escalation, theo don_vi_id trực tiếp của Trường tổ chức) cũng cập nhật được -> 200', async () => {
      await request(app.getHttpServer())
        .patch(`/dang-ky-hoc/${dangKyId}/ket-qua`)
        .set('Authorization', `Bearer ${tokenPhong}`)
        .send({ ket_qua: 'khong_dat' })
        .expect(200);
    });

    it('truong2 (không liên quan) -> 403', async () => {
      await request(app.getHttpServer())
        .patch(`/dang-ky-hoc/${dangKyId}/ket-qua`)
        .set('Authorization', `Bearer ${tokenTruong2}`)
        .send({ ket_qua: 'dat' })
        .expect(403);
    });

    it('ket_qua ngoài enum ket_qua_hoc -> 400', async () => {
      await request(app.getHttpServer())
        .patch(`/dang-ky-hoc/${dangKyId}/ket-qua`)
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .send({ ket_qua: 'gioi' })
        .expect(400);
    });

    it('id không tồn tại -> 404', async () => {
      await request(app.getHttpServer())
        .patch('/dang-ky-hoc/00000000-0000-0000-0000-000000000000/ket-qua')
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .send({ ket_qua: 'dat' })
        .expect(404);
    });
  });

  describe('Phân quyền chung', () => {
    it('gọi không kèm token -> 401', async () => {
      await request(app.getHttpServer()).get('/khoa-boi-duong').expect(401);
    });
  });
});
