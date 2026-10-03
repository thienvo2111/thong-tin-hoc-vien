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
import { HangDoiEmailProcessor } from '../src/thong-bao/hang-doi-email.processor';

const NAM_HOP_LE = new Date().getUTCFullYear() - 20;
const FAKE_ID = '00000000-0000-0000-0000-000000000000';

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
  // T2 (QĐ2): HCMUE — đơn vị loại 'khac', KHÔNG thuộc cây soGddt/phongVhxh ở
  // trên (không có don_vi_cha_id). Test "đơn vị không theo dõi/không sở hữu
  // thì không thấy khóa HCMUE" tái dùng phongKhacAccount/tokenPhongKhac sẵn
  // có (cũng là 1 cây độc lập, không có don_vi_cha_id) thay vì tạo thêm tài
  // khoản mới — tránh vượt giới hạn 10 lần đăng nhập/phút/IP (rule T1) vốn đã
  // ở ngưỡng tối đa trong file test này (7 tài khoản khởi tạo + 3 lần đăng
  // nhập học viên ở khối "Import phan_lop_hoc_vien" bên dưới = 10).
  let hcmue: { id: string };

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

  // M9 (2026-10-01): hoc_vien_xac_nhan/hoc_vien_duyet/khoa_boi_duong_duyet/
  // dang_ky_hoc_phan_lop/dang_ky_hoc_ket_qua chỉ enqueue hang_doi_email
  // ('cho_gui') thay vì gửi SMTP ngay — giả lập 1 lượt cron
  // HangDoiEmailProcessor khi test cần xác nhận "đã gửi thành công" thật qua
  // nhat_ky_thong_bao (xem test/thong-bao.e2e-spec.ts cho helper tương tự).
  // Chỉ gửi các dòng 'cho_gui' của hocVienId: xuLyHangDoi() lấy 20 dòng CŨ
  // NHẤT của cả hàng đợi (FIFO) — gồm 40 dòng bulk test phân lớp 100 học viên
  // cố ý để lại — gửi tuần tự qua Ethereal làm test vượt 30s, rồi vẫn chạy
  // nền sau timeout và đụng afterAll đã xóa dòng (P2025).
  async function drainHangDoi(hocVienId: string): Promise<void> {
    const processor = app.get(HangDoiEmailProcessor);
    const dongChoGui = await prisma.hang_doi_email.findMany({
      where: { hoc_vien_id: hocVienId, trang_thai: 'cho_gui' },
      orderBy: { created_at: 'asc' },
    });
    for (const dong of dongChoGui) {
      await processor['guiMotDong'](dong);
    }
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
    // raiseThrottlerLimit: true — khối R1/R2 (describe "Phạm vi xem khóa")
    // thêm 5 tài khoản/đăng nhập mới, vượt ngưỡng 10 request/phút/IP thật
    // của ThrottlerGuard (xem test/utils/test-app.ts) dù không liên quan gì
    // tới rate limit — hành vi giới hạn THẬT đã có file riêng kiểm chứng
    // (test/rate-limit.e2e-spec.ts).
    app = await createTestApp({ raiseThrottlerLimit: true });
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
    hcmue = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-hcmue-kbd-${suf}`,
        ten_don_vi: `HCMUE KBD ${suf}`,
        loai_don_vi: 'khac',
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
  });

  afterAll(async () => {
    await prisma.dang_ky_hoc.deleteMany({
      where: {
        OR: [{ khoa_id: { in: khoaIds } }, { hoc_vien_id: { in: hocVienIds } }],
      },
    });
    // Xóa trước khi xóa hoc_vien — nhat_ky_thong_bao.hoc_vien_id VÀ
    // hang_doi_email.hoc_vien_id đều FK onDelete: NoAction (docs/database-
    // ddl.sql PHẦN 4) — M9: nhiều dòng hang_doi_email còn 'cho_gui' vì suite
    // này không drain hết (chỉ drain đúng những test cần xác nhận gửi thật).
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
      [
        truong1.id,
        truong2.id,
        truongMoCoi.id,
        phongVhxh.id,
        phongKhac.id,
        soGddt.id,
        hcmue.id,
      ],
      [xa.id, tinh.id],
    );
    await prisma.$disconnect();
    await app.close();
  });

  describe('Đơn vị đặt hàng — ghi (chỉ quan_tri, D1/D2/D6)', () => {
    it('quan_tri thiếu don_vi_dat_hang_id -> 400, field don_vi_dat_hang_id = Bắt buộc', async () => {
      const res = await request(app.getHttpServer())
        .post('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send(baseKhoaBody())
        .expect(400);
      expect(res.body.error.fields[0]).toEqual({
        field: 'don_vi_dat_hang_id',
        message: 'Bắt buộc',
      });
    });

    it('quan_tri chỉ định đơn vị không tồn tại -> 400, Không hợp lệ', async () => {
      const res = await request(app.getHttpServer())
        .post('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send(
          baseKhoaBody({
            don_vi_dat_hang_id: '00000000-0000-0000-0000-000000000000',
          }),
        )
        .expect(400);
      expect(res.body.error.fields[0]).toEqual({
        field: 'don_vi_dat_hang_id',
        message: 'Không hợp lệ',
      });
    });

    it('quan_tri chỉ định đơn vị ngung hoạt động -> 400, Không hợp lệ', async () => {
      const res = await request(app.getHttpServer())
        .post('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send(baseKhoaBody({ don_vi_dat_hang_id: truongMoCoi.id }))
        .expect(201);
      khoaIds.push(res.body.id);

      await prisma.don_vi_cong_tac.update({
        where: { id: truongMoCoi.id },
        data: { trang_thai: 'ngung' },
      });
      try {
        const res2 = await request(app.getHttpServer())
          .post('/khoa-boi-duong')
          .set('Authorization', `Bearer ${tokenQuanTri}`)
          .send(baseKhoaBody({ don_vi_dat_hang_id: truongMoCoi.id }))
          .expect(400);
        expect(res2.body.error.fields[0]).toEqual({
          field: 'don_vi_dat_hang_id',
          message: 'Không hợp lệ',
        });
      } finally {
        await prisma.don_vi_cong_tac.update({
          where: { id: truongMoCoi.id },
          data: { trang_thai: 'active' },
        });
      }
    });

    it('quan_tri chỉ định đơn vị loại phong_vhxh -> 400, Sai loại đơn vị (D2)', async () => {
      const res = await request(app.getHttpServer())
        .post('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send(baseKhoaBody({ don_vi_dat_hang_id: phongVhxh.id }))
        .expect(400);
      expect(res.body.error.fields[0]).toEqual({
        field: 'don_vi_dat_hang_id',
        message: 'Sai loại đơn vị',
      });
    });

    it('quan_tri tạo khóa cho Sở GD&ĐT -> 201, da_duyet ngay', async () => {
      const res = await request(app.getHttpServer())
        .post('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send(baseKhoaBody({ don_vi_dat_hang_id: soGddt.id }))
        .expect(201);
      expect(res.body.don_vi_dat_hang_id).toBe(soGddt.id);
      expect(res.body.trang_thai).toBe('da_duyet');
      khoaIds.push(res.body.id);
    });

    it('quan_tri tạo khóa cho đơn vị loại "khac" (HCMUE) -> 201, da_duyet ngay, ghi nguoi_duyet_id/cap_duyet_thuc_te/ngay_duyet', async () => {
      const res = await request(app.getHttpServer())
        .post('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send(baseKhoaBody({ don_vi_dat_hang_id: hcmue.id }))
        .expect(201);
      expect(res.body.don_vi_dat_hang_id).toBe(hcmue.id);
      expect(res.body.trang_thai).toBe('da_duyet');
      expect(res.body.nguoi_duyet_id).toBe(quanTri.nguoiDung.id);
      expect(res.body.cap_duyet_thuc_te).toBe('quan_tri');
      expect(res.body.ngay_duyet).toBeDefined();
      khoaIds.push(res.body.id);
    });

    it('quan_tri tạo khóa cho đơn vị loại "truong" -> 201, da_duyet ngay', async () => {
      const res = await request(app.getHttpServer())
        .post('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send(baseKhoaBody({ don_vi_dat_hang_id: truong1.id }))
        .expect(201);
      expect(res.body.trang_thai).toBe('da_duyet');
      khoaIds.push(res.body.id);
    });

    it.each([
      ['truong', () => tokenTruong1],
      ['so_gddt', () => tokenSo],
      ['phong_vhxh', () => tokenPhong],
    ])('%s gọi POST /khoa-boi-duong -> 403', async (_vaiTro, layToken) => {
      await request(app.getHttpServer())
        .post('/khoa-boi-duong')
        .set('Authorization', `Bearer ${layToken()}`)
        .send(baseKhoaBody({ don_vi_dat_hang_id: truong1.id }))
        .expect(403);
    });

    it('thoi_gian_ket_thuc < thoi_gian_bat_dau -> 400 (rule #49)', async () => {
      await request(app.getHttpServer())
        .post('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send(
          baseKhoaBody({
            don_vi_dat_hang_id: truong1.id,
            thoi_gian_bat_dau: '2026-02-01',
            thoi_gian_ket_thuc: '2026-01-01',
          }),
        )
        .expect(400);
    });

    it('trùng ma_khoa -> 409', async () => {
      const body = baseKhoaBody({ don_vi_dat_hang_id: truong1.id });
      const first = await request(app.getHttpServer())
        .post('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send(body)
        .expect(201);
      khoaIds.push(first.body.id);

      await request(app.getHttpServer())
        .post('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send(body)
        .expect(409);
    });

    it.each([
      ['nop-duyet', () => request(app.getHttpServer()).post(`/khoa-boi-duong/${FAKE_ID}/nop-duyet`)],
      [
        'duyet',
        () =>
          request(app.getHttpServer())
            .post(`/khoa-boi-duong/${FAKE_ID}/duyet`)
            .send({ ket_qua: 'da_duyet' }),
      ],
      [
        'don-vi-theo-doi POST',
        () =>
          request(app.getHttpServer())
            .post(`/khoa-boi-duong/${FAKE_ID}/don-vi-theo-doi`)
            .send({ don_vi_id: soGddt.id }),
      ],
      [
        'don-vi-theo-doi DELETE',
        () =>
          request(app.getHttpServer()).delete(
            `/khoa-boi-duong/${FAKE_ID}/don-vi-theo-doi/${soGddt.id}`,
          ),
      ],
    ])('endpoint đã xóa (%s) -> 404', async (_ten, lamRequest) => {
      await lamRequest()
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(404);
    });
  });

  describe('Rule #18 — đơn vị loại "khac" không được chọn làm đơn vị công tác của học viên', () => {
    it('POST /hoc-vien với don_vi_cong_tac_id thuộc loại "khac" (HCMUE) -> 400', async () => {
      const suf = uniqueSuffix();
      await request(app.getHttpServer())
        .post('/hoc-vien')
        .send({
          ho_ten: 'Học Viên Chọn Sai Đơn Vị',
          so_dinh_danh_ca_nhan: soDinhDanhNgauNhien(),
          ngay_sinh: 1,
          thang_sinh: 1,
          nam_sinh: NAM_HOP_LE,
          noi_sinh_id: tinh.id,
          phuong_xa_id: xa.id,
          don_vi_cong_tac_id: hcmue.id,
          so_dien_thoai_lien_he: '0912349000',
          email_lien_he: `sai-dv-${suf}@test.local`,
          trinh_do_chuyen_mon: 'dai_hoc',
          chuyen_mon: ['Sư phạm Lý'],
        })
        .expect(400);
    });
  });

  describe('PATCH /khoa-boi-duong/{id} (chỉ quan_tri, mọi trạng thái — D6)', () => {
    let khoaId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send(baseKhoaBody({ don_vi_dat_hang_id: truong1.id }))
        .expect(201);
      khoaId = res.body.id;
      khoaIds.push(khoaId);
    });

    it('quan_tri sửa khóa đã da_duyet -> 200 (bỏ ràng buộc chỉ nhap/tu_choi)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/khoa-boi-duong/${khoaId}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({ ten_khoa: 'Tên đã sửa' })
        .expect(200);
      expect(res.body.ten_khoa).toBe('Tên đã sửa');
    });

    it('quan_tri đổi don_vi_dat_hang_id sang Sở khác -> 200', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/khoa-boi-duong/${khoaId}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({ don_vi_dat_hang_id: soGddt.id })
        .expect(200);
      expect(res.body.don_vi_dat_hang_id).toBe(soGddt.id);
    });

    it('quan_tri đổi don_vi_dat_hang_id sang phong_vhxh -> 400, Sai loại đơn vị', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/khoa-boi-duong/${khoaId}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({ don_vi_dat_hang_id: phongVhxh.id })
        .expect(400);
      expect(res.body.error.fields[0]).toEqual({
        field: 'don_vi_dat_hang_id',
        message: 'Sai loại đơn vị',
      });
    });

    it.each([
      ['truong', () => tokenTruong1],
      ['so_gddt', () => tokenSo],
      ['phong_vhxh', () => tokenPhong],
    ])('%s gọi PATCH /khoa-boi-duong/:id -> 403', async (_vaiTro, layToken) => {
      await request(app.getHttpServer())
        .patch(`/khoa-boi-duong/${khoaId}`)
        .set('Authorization', `Bearer ${layToken()}`)
        .send({ ten_khoa: 'X' })
        .expect(403);
    });
  });

  describe('GET /khoa-boi-duong, GET /khoa-boi-duong/{id} — scoping', () => {
    let khoaTruong1Id: string;
    let khoaTruong2Id: string;

    beforeAll(async () => {
      const k1 = await request(app.getHttpServer())
        .post('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send(baseKhoaBody({ don_vi_dat_hang_id: truong1.id }))
        .expect(201);
      khoaTruong1Id = k1.body.id;
      khoaIds.push(khoaTruong1Id);

      const k2 = await request(app.getHttpServer())
        .post('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send(baseKhoaBody({ don_vi_dat_hang_id: truong2.id }))
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

  describe('Phạm vi xem khóa (R1/R2) — pham_vi_hoc_vien (spec mục 5, task 4)', () => {
    // Cây riêng cho khối này (độc lập với soGddt/phongVhxh/truong1/truong2 ở
    // trên — không phụ thuộc chéo với describe khác trong file):
    //   Sở A -> Phòng P1 -> Trường T1, Trường T2
    //   Sở B -> Trường T3
    //   Đơn vị X (loai 'khac', ngoài 2 cây trên)
    // K1 đặt hàng Sở A, học viên T1 + T3 (R1 cho Sở A; R2 cho Sở B/P1/T1 qua
    // học viên của họ). K2 đặt hàng X, học viên T1 (chỉ R2 cho Sở A/P1/T1).
    // K3 đặt hàng T2, chưa có học viên (chỉ R1 cho Sở A/P1/T2).
    let soA: { id: string };
    let soB: { id: string };
    let p1: { id: string };
    let t1: { id: string };
    let t2: { id: string };
    let t3: { id: string };
    let x: { id: string };
    let soAAccount: Awaited<ReturnType<typeof taoNguoiDungTest>>;
    let soBAccount: Awaited<ReturnType<typeof taoNguoiDungTest>>;
    let p1Account: Awaited<ReturnType<typeof taoNguoiDungTest>>;
    let t1Account: Awaited<ReturnType<typeof taoNguoiDungTest>>;
    let t2Account: Awaited<ReturnType<typeof taoNguoiDungTest>>;
    let tokenSoA: string;
    let tokenSoB: string;
    let tokenP1: string;
    let tokenT1: string;
    let tokenT2: string;
    let k1Id: string;
    let k2Id: string;
    let k3Id: string;
    let maKhoaK3: string;

    function ids(res: { body: { data: { id: string }[] } }): string[] {
      return res.body.data.map((k) => k.id);
    }

    beforeAll(async () => {
      const suf = uniqueSuffix();
      soA = await prisma.don_vi_cong_tac.create({
        data: {
          ma_don_vi: `DV-soA-${suf}`,
          ten_don_vi: `Sở A ${suf}`,
          loai_don_vi: 'so_gddt',
          dia_ban_id: xa.id,
        },
      });
      soB = await prisma.don_vi_cong_tac.create({
        data: {
          ma_don_vi: `DV-soB-${suf}`,
          ten_don_vi: `Sở B ${suf}`,
          loai_don_vi: 'so_gddt',
          dia_ban_id: xa.id,
        },
      });
      p1 = await prisma.don_vi_cong_tac.create({
        data: {
          ma_don_vi: `DV-p1-${suf}`,
          ten_don_vi: `Phòng P1 ${suf}`,
          loai_don_vi: 'phong_vhxh',
          dia_ban_id: xa.id,
          don_vi_cha_id: soA.id,
        },
      });
      t1 = await prisma.don_vi_cong_tac.create({
        data: {
          ma_don_vi: `DV-t1-${suf}`,
          ten_don_vi: `Trường T1 ${suf}`,
          loai_don_vi: 'truong',
          dia_ban_id: xa.id,
          don_vi_cha_id: p1.id,
        },
      });
      t2 = await prisma.don_vi_cong_tac.create({
        data: {
          ma_don_vi: `DV-t2-${suf}`,
          ten_don_vi: `Trường T2 ${suf}`,
          loai_don_vi: 'truong',
          dia_ban_id: xa.id,
          don_vi_cha_id: p1.id,
        },
      });
      t3 = await prisma.don_vi_cong_tac.create({
        data: {
          ma_don_vi: `DV-t3-${suf}`,
          ten_don_vi: `Trường T3 ${suf}`,
          loai_don_vi: 'truong',
          dia_ban_id: xa.id,
          don_vi_cha_id: soB.id,
        },
      });
      x = await prisma.don_vi_cong_tac.create({
        data: {
          ma_don_vi: `DV-x-${suf}`,
          ten_don_vi: `Đơn vị X ${suf}`,
          loai_don_vi: 'khac',
          dia_ban_id: xa.id,
        },
      });

      soAAccount = await taoNguoiDungTest({
        vai_tro: 'so_gddt',
        don_vi_id: soA.id,
        mat_khau: 'MatKhau123',
      });
      soBAccount = await taoNguoiDungTest({
        vai_tro: 'so_gddt',
        don_vi_id: soB.id,
        mat_khau: 'MatKhau123',
      });
      p1Account = await taoNguoiDungTest({
        vai_tro: 'phong_vhxh',
        don_vi_id: p1.id,
        mat_khau: 'MatKhau123',
      });
      t1Account = await taoNguoiDungTest({
        vai_tro: 'truong',
        don_vi_id: t1.id,
        mat_khau: 'MatKhau123',
      });
      t2Account = await taoNguoiDungTest({
        vai_tro: 'truong',
        don_vi_id: t2.id,
        mat_khau: 'MatKhau123',
      });

      tokenSoA = await dangNhap(soAAccount.ten_dang_nhap, 'MatKhau123');
      tokenSoB = await dangNhap(soBAccount.ten_dang_nhap, 'MatKhau123');
      tokenP1 = await dangNhap(p1Account.ten_dang_nhap, 'MatKhau123');
      tokenT1 = await dangNhap(t1Account.ten_dang_nhap, 'MatKhau123');
      tokenT2 = await dangNhap(t2Account.ten_dang_nhap, 'MatKhau123');

      const k1 = await request(app.getHttpServer())
        .post('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send(baseKhoaBody({ don_vi_dat_hang_id: soA.id }))
        .expect(201);
      k1Id = k1.body.id;
      khoaIds.push(k1Id);

      const k2 = await request(app.getHttpServer())
        .post('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send(baseKhoaBody({ don_vi_dat_hang_id: x.id }))
        .expect(201);
      k2Id = k2.body.id;
      khoaIds.push(k2Id);

      const k3 = await request(app.getHttpServer())
        .post('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send(baseKhoaBody({ don_vi_dat_hang_id: t2.id }))
        .expect(201);
      k3Id = k3.body.id;
      maKhoaK3 = k3.body.ma_khoa;
      khoaIds.push(k3Id);

      // Học viên tạo trực tiếp qua Prisma — chỉ cần tồn tại với
      // don_vi_cong_tac_id đúng để phục vụ test scope, không cần qua luồng
      // đăng ký/duyệt hồ sơ đầy đủ. nguon_tao='import_moet' + ma_dinh_danh_moet
      // để thỏa chk_hoc_vien_nguon_tao (tu_dang_ky đòi so_dinh_danh_ca_nhan
      // 12 số, phức tạp hơn không cần thiết ở đây).
      const hvT1 = await prisma.hoc_vien.create({
        data: {
          nguon_tao: 'import_moet',
          ma_dinh_danh_moet: `M-T1-${suf}`,
          ho_ten: 'Học viên R1R2 T1',
          ngay_sinh: 1,
          thang_sinh: 1,
          nam_sinh: NAM_HOP_LE,
          don_vi_cong_tac_id: t1.id,
        },
      });
      hocVienIds.push(hvT1.id);
      const hvT3 = await prisma.hoc_vien.create({
        data: {
          nguon_tao: 'import_moet',
          ma_dinh_danh_moet: `M-T3-${suf}`,
          ho_ten: 'Học viên R1R2 T3',
          ngay_sinh: 2,
          thang_sinh: 2,
          nam_sinh: NAM_HOP_LE,
          don_vi_cong_tac_id: t3.id,
        },
      });
      hocVienIds.push(hvT3.id);

      const dkT1K1 = await prisma.dang_ky_hoc.create({
        data: { hoc_vien_id: hvT1.id, khoa_id: k1Id },
      });
      const dkT3K1 = await prisma.dang_ky_hoc.create({
        data: { hoc_vien_id: hvT3.id, khoa_id: k1Id },
      });
      const dkT1K2 = await prisma.dang_ky_hoc.create({
        data: { hoc_vien_id: hvT1.id, khoa_id: k2Id },
      });

      // Sĩ số (si_so_hien_tai) chỉ đếm dang_ky_hoc ĐÃ GÁN LỚP qua
      // phan_lop_giai_doan — gán cả 2 đăng ký của K1 vào cùng 1 lớp để phân
      // biệt pham_vi_hoc_vien 'toan_bo' (đếm cả 2) với 'don_vi' (đếm 1).
      const giaiDoanK1 = await prisma.giai_doan_khoa.create({
        data: {
          khoa_id: k1Id,
          thu_tu: 1,
          ten_giai_doan: 'GĐ1',
          hinh_thuc: 'truc_tiep',
          thoi_gian_bat_dau: new Date('2026-01-01'),
          thoi_gian_ket_thuc: new Date('2026-12-31'),
        },
      });
      const lopK1 = await prisma.lop_hoc.create({
        data: {
          khoa_id: k1Id,
          loai_lop: 'truc_tiep',
          ten_lop: `Lớp K1 ${suf}`,
        },
      });
      await prisma.phan_lop_giai_doan.create({
        data: {
          dang_ky_hoc_id: dkT1K1.id,
          giai_doan_id: giaiDoanK1.id,
          lop_id: lopK1.id,
        },
      });
      await prisma.phan_lop_giai_doan.create({
        data: {
          dang_ky_hoc_id: dkT3K1.id,
          giai_doan_id: giaiDoanK1.id,
          lop_id: lopK1.id,
        },
      });

      const giaiDoanK2 = await prisma.giai_doan_khoa.create({
        data: {
          khoa_id: k2Id,
          thu_tu: 1,
          ten_giai_doan: 'GĐ1',
          hinh_thuc: 'truc_tiep',
          thoi_gian_bat_dau: new Date('2026-01-01'),
          thoi_gian_ket_thuc: new Date('2026-12-31'),
        },
      });
      const lopK2 = await prisma.lop_hoc.create({
        data: {
          khoa_id: k2Id,
          loai_lop: 'truc_tiep',
          ten_lop: `Lớp K2 ${suf}`,
        },
      });
      await prisma.phan_lop_giai_doan.create({
        data: {
          dang_ky_hoc_id: dkT1K2.id,
          giai_doan_id: giaiDoanK2.id,
          lop_id: lopK2.id,
        },
      });
    });

    afterAll(async () => {
      // Dọn SỚM (không chờ afterAll ngoài — vốn chỉ chạy sau CÙNG khi hết
      // file) vì describe này còn xóa luôn 7 đơn vị riêng của mình: phải hết
      // mọi FK NoAction trỏ vào chúng (dang_ky_hoc.khoa_id, hoc_vien.
      // don_vi_cong_tac_id, nguoi_dung.don_vi_id) trước khi xóa don_vi_cong_tac.
      // khoa_boi_duong xóa trước — cascade tự xóa giai_doan_khoa/lop_hoc;
      // dang_ky_hoc xóa trước đó nữa vì khoa_boi_duong.dang_ky_hoc KHÔNG
      // cascade (onDelete: NoAction, xem schema.prisma).
      await prisma.dang_ky_hoc.deleteMany({
        where: { khoa_id: { in: [k1Id, k2Id, k3Id] } },
      });
      await prisma.hoc_vien.deleteMany({
        where: { don_vi_cong_tac_id: { in: [t1.id, t3.id] } },
      });
      await prisma.khoa_boi_duong.deleteMany({
        where: { id: { in: [k1Id, k2Id, k3Id] } },
      });
      await xoaNguoiDungTest(soAAccount.nguoiDung.id);
      await xoaNguoiDungTest(soBAccount.nguoiDung.id);
      await xoaNguoiDungTest(p1Account.nguoiDung.id);
      await xoaNguoiDungTest(t1Account.nguoiDung.id);
      await xoaNguoiDungTest(t2Account.nguoiDung.id);
      await xoaDonViTest(
        [t1.id, t2.id, t3.id, p1.id, soA.id, soB.id, x.id],
        [],
      );
    });

    it('Sở A: list chứa K1, K2, K3 (R1 trên K1/K3, R2 trên K2)', async () => {
      const res = await request(app.getHttpServer())
        .get('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenSoA}`)
        .expect(200);
      expect(ids(res)).toEqual(expect.arrayContaining([k1Id, k2Id, k3Id]));
    });

    it('Sở A: GET K1 -> pham_vi_hoc_vien=toan_bo, sĩ số tính cả T1 + T3', async () => {
      const res = await request(app.getHttpServer())
        .get(`/khoa-boi-duong/${k1Id}`)
        .set('Authorization', `Bearer ${tokenSoA}`)
        .expect(200);
      expect(res.body.pham_vi_hoc_vien).toBe('toan_bo');
      expect(res.body.lop_hoc[0].si_so_hien_tai).toBe(2);
    });

    it('Sở A: GET K2 -> pham_vi_hoc_vien=don_vi, sĩ số chỉ T1', async () => {
      const res = await request(app.getHttpServer())
        .get(`/khoa-boi-duong/${k2Id}`)
        .set('Authorization', `Bearer ${tokenSoA}`)
        .expect(200);
      expect(res.body.pham_vi_hoc_vien).toBe('don_vi');
      expect(res.body.lop_hoc[0].si_so_hien_tai).toBe(1);
    });

    it('Sở B: list chỉ chứa K1 (R2 qua T3), không K2/K3', async () => {
      const res = await request(app.getHttpServer())
        .get('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenSoB}`)
        .expect(200);
      const data = ids(res);
      expect(data).toContain(k1Id);
      expect(data).not.toContain(k2Id);
      expect(data).not.toContain(k3Id);
    });

    it('Sở B: GET K1 -> pham_vi_hoc_vien=don_vi, sĩ số chỉ T3', async () => {
      const res = await request(app.getHttpServer())
        .get(`/khoa-boi-duong/${k1Id}`)
        .set('Authorization', `Bearer ${tokenSoB}`)
        .expect(200);
      expect(res.body.pham_vi_hoc_vien).toBe('don_vi');
      expect(res.body.lop_hoc[0].si_so_hien_tai).toBe(1);
    });

    it('T1: list chứa K1, K2 (R2 — có giáo viên tham gia), không K3', async () => {
      const res = await request(app.getHttpServer())
        .get('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenT1}`)
        .expect(200);
      const data = ids(res);
      expect(data).toContain(k1Id);
      expect(data).toContain(k2Id);
      expect(data).not.toContain(k3Id);
    });

    it('T1: GET K3 -> 403 (ngoài phạm vi — không đặt hàng, không có giáo viên)', async () => {
      await request(app.getHttpServer())
        .get(`/khoa-boi-duong/${k3Id}`)
        .set('Authorization', `Bearer ${tokenT1}`)
        .expect(403);
    });

    it('T1: tìm theo mã khóa của K3 (ngoài phạm vi) -> không trả về K3 (q không được đè scope)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/khoa-boi-duong?q=${maKhoaK3}`)
        .set('Authorization', `Bearer ${tokenT1}`)
        .expect(200);
      expect(ids(res)).not.toContain(k3Id);
    });

    it('T2: list chỉ chứa K3 (R1 — tự đặt hàng)', async () => {
      const res = await request(app.getHttpServer())
        .get('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenT2}`)
        .expect(200);
      const data = ids(res);
      expect(data).toContain(k3Id);
      expect(data).not.toContain(k1Id);
      expect(data).not.toContain(k2Id);
    });

    it('T2: GET K3 -> pham_vi_hoc_vien=toan_bo', async () => {
      const res = await request(app.getHttpServer())
        .get(`/khoa-boi-duong/${k3Id}`)
        .set('Authorization', `Bearer ${tokenT2}`)
        .expect(200);
      expect(res.body.pham_vi_hoc_vien).toBe('toan_bo');
    });

    it('P1 (Phòng, cha của T1 + T2): list chứa cả K1, K2, K3', async () => {
      const res = await request(app.getHttpServer())
        .get('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenP1}`)
        .expect(200);
      expect(ids(res)).toEqual(expect.arrayContaining([k1Id, k2Id, k3Id]));
    });

    it('Sở B ?don_vi_dat_hang_id=<Sở A> -> 200, chỉ K1 (lọc thuần giao với tập xem được)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/khoa-boi-duong?don_vi_dat_hang_id=${soA.id}`)
        .set('Authorization', `Bearer ${tokenSoB}`)
        .expect(200);
      expect(ids(res)).toEqual([k1Id]);
    });

    it('Sở B ?don_vi_dat_hang_id=<X> -> 200, rỗng (K2 đặt bởi X nhưng ngoài phạm vi Sở B)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/khoa-boi-duong?don_vi_dat_hang_id=${x.id}`)
        .set('Authorization', `Bearer ${tokenSoB}`)
        .expect(200);
      expect(ids(res)).toEqual([]);
    });

    it('Học viên: list vẫn chỉ khóa da_duyet (không đổi)', async () => {
      const suf = uniqueSuffix();
      const sdd = soDinhDanhNgauNhien();
      const reg = await request(app.getHttpServer())
        .post('/hoc-vien')
        .send({
          ho_ten: 'Học viên Phạm Vi List',
          so_dinh_danh_ca_nhan: sdd,
          ngay_sinh: 5,
          thang_sinh: 6,
          nam_sinh: NAM_HOP_LE,
          noi_sinh_id: tinh.id,
          phuong_xa_id: xa.id,
          // Dùng truong1 (cây fixture NGOÀI của file, sống tới hết file) —
          // không dùng t1 (sẽ bị xóa ngay ở afterAll của describe này) vì
          // hồ sơ học viên này được dọn ở afterAll NGOÀI (chạy sau cùng).
          don_vi_cong_tac_id: truong1.id,
          so_dien_thoai_lien_he: '0912348000',
          email_lien_he: `r1r2-${suf}@test.local`,
          trinh_do_chuyen_mon: 'dai_hoc',
          chuyen_mon: ['Sư phạm Toán'],
        })
        .expect(201);
      hocVienIds.push(reg.body.hoc_vien_id);
      const nd = await prisma.nguoi_dung.findUnique({
        where: { ten_dang_nhap: sdd },
      });
      if (nd) nguoiDungHocVienIds.push(nd.id);
      const token = await dangNhap(sdd, `0506${NAM_HOP_LE}`);

      const res = await request(app.getHttpServer())
        .get('/khoa-boi-duong')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(ids(res)).toEqual(expect.arrayContaining([k1Id, k2Id, k3Id]));
    });

    it('Quản trị đổi K2 sang Sở B -> Sở B list có K2, GET K2 -> toan_bo', async () => {
      await request(app.getHttpServer())
        .patch(`/khoa-boi-duong/${k2Id}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({ don_vi_dat_hang_id: soB.id })
        .expect(200);

      const list = await request(app.getHttpServer())
        .get('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenSoB}`)
        .expect(200);
      expect(ids(list)).toContain(k2Id);

      const detail = await request(app.getHttpServer())
        .get(`/khoa-boi-duong/${k2Id}`)
        .set('Authorization', `Bearer ${tokenSoB}`)
        .expect(200);
      expect(detail.body.pham_vi_hoc_vien).toBe('toan_bo');
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
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send(baseKhoaBody({ don_vi_dat_hang_id: truong1.id }))
        .expect(201);
      khoaId = k.body.id;
      khoaIds.push(khoaId);

      const kKhac = await request(app.getHttpServer())
        .post('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send(baseKhoaBody({ don_vi_dat_hang_id: truong2.id }))
        .expect(201);
      khoaKhacId = kKhac.body.id;
      khoaIds.push(khoaKhacId);

      const gdKhac = await request(app.getHttpServer())
        .post(`/khoa-boi-duong/${khoaKhacId}/giai-doan`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
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

    it.each([
      ['truong', () => tokenTruong1],
      ['so_gddt', () => tokenSo],
      ['phong_vhxh', () => tokenPhong],
    ])(
      '%s gọi POST .../giai-doan, .../lop, .../cum -> 403',
      async (_vaiTro, layToken) => {
        await request(app.getHttpServer())
          .post(`/khoa-boi-duong/${khoaId}/giai-doan`)
          .set('Authorization', `Bearer ${layToken()}`)
          .send({
            thu_tu: 1,
            ten_giai_doan: 'X',
            hinh_thuc: 'truc_tiep',
            thoi_gian_bat_dau: '2026-01-01',
            thoi_gian_ket_thuc: '2026-01-10',
          })
          .expect(403);
        await request(app.getHttpServer())
          .post(`/khoa-boi-duong/${khoaId}/lop`)
          .set('Authorization', `Bearer ${layToken()}`)
          .send({ loai_lop: 'truc_tiep', ten_lop: 'Lớp lạ' })
          .expect(403);
        await request(app.getHttpServer())
          .post(`/khoa-boi-duong/${khoaId}/cum`)
          .set('Authorization', `Bearer ${layToken()}`)
          .send({ ten_cum: 'Cụm lạ' })
          .expect(403);
      },
    );

    it('POST giai-doan hợp lệ -> 201', async () => {
      const res = await request(app.getHttpServer())
        .post(`/khoa-boi-duong/${khoaId}/giai-doan`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
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
        .set('Authorization', `Bearer ${tokenQuanTri}`)
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
        .set('Authorization', `Bearer ${tokenQuanTri}`)
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
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({ loai_lop: 'truc_tiep', ten_lop: 'Lớp A', si_so_toi_da: 30 })
        .expect(201);
      lopId = res.body.id;
      expect(res.body.khoa_id).toBe(khoaId);
    });

    it('POST /lop/{id}/lich-hoc với giai_doan_id thuộc khóa KHÁC -> 400 (rule #50)', async () => {
      await request(app.getHttpServer())
        .post(`/lop/${lopId}/lich-hoc`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
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
        .set('Authorization', `Bearer ${tokenQuanTri}`)
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
        .set('Authorization', `Bearer ${tokenQuanTri}`)
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
        .set('Authorization', `Bearer ${tokenQuanTri}`)
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
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({ ho_ten: 'Giảng viên A', vai_tro: 'giang_vien' })
        .expect(201);
      const nhanSuId = res.body.id;

      await request(app.getHttpServer())
        .delete(`/lop/${lopId}/nhan-su/${nhanSuId}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/lop/${lopId}/nhan-su/${nhanSuId}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
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
      const kBody = baseKhoaBody({ don_vi_dat_hang_id: truong1.id });
      maKhoa = kBody.ma_khoa;
      const k = await request(app.getHttpServer())
        .post('/khoa-boi-duong')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send(kBody)
        .expect(201);
      khoaId = k.body.id;
      khoaIds.push(khoaId);

      tenLop = `Lớp phân ${suf}`;
      const lop = await request(app.getHttpServer())
        .post(`/khoa-boi-duong/${khoaId}/lop`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({ loai_lop: 'truc_tiep', ten_lop: tenLop })
        .expect(201);
      lopId = lop.body.id;
      // Phân lớp theo giai đoạn: khóa cần ít nhất 1 giai đoạn (cột GĐ1).
      await prisma.giai_doan_khoa.create({
        data: {
          khoa_id: khoaId,
          thu_tu: 1,
          ten_giai_doan: 'Học trực tiếp',
          hinh_thuc: 'truc_tiep',
          thoi_gian_bat_dau: new Date('2026-01-01'),
          thoi_gian_ket_thuc: new Date('2026-12-31'),
        },
      });

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

    it('GET /import/mau-excel?loai=phan_lop_hoc_vien -> đúng 4 cột', async () => {
      const res = await request(app.getHttpServer())
        .get(`/import/mau-excel?loai=phan_lop_hoc_vien&ma_khoa=${maKhoa}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(res.headers['content-type']).toContain('spreadsheetml');
    });

    it('ten_lop để trống -> chỉ ghi danh (lop_id=null, trang_thai=da_duyet); các dòng lỗi khác (rule #45)', async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('data');
      // Mẫu phân lớp theo giai đoạn (spec 2026-10-02): mỗi giai đoạn 1 cột.
      sheet.addRow([
        'so_dinh_danh_ca_nhan',
        'ma_dinh_danh_moet',
        'GĐ1',
        'ten_cum',
      ]);
      sheet.addRow([sddDaDuyet, '', '', '']); // hợp lệ — chỉ ghi danh
      sheet.addRow(['000000000000', '', '', '']); // ĐDCN không tồn tại
      sheet.addRow([sddChuaDuyet, '', '', '']); // hồ sơ chưa được duyệt
      sheet.addRow([sddDaDuyet, '', 'Lớp không tồn tại', '']); // trùng học viên dòng 2 (spec 4.4)
      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

      const res = await request(app.getHttpServer())
        .post(`/import/phan_lop_hoc_vien?ma_khoa=${maKhoa}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach('file', buffer, 'phan-lop-1.xlsx')
        .expect(201);
      const importId = res.body.import_id;
      importIds.push(importId);

      const ketQua = await request(app.getHttpServer())
        .get(`/import/${importId}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(ketQua.body.tong_so_dong).toBe(4);
      expect(ketQua.body.so_dong_thanh_cong).toBe(1);
      expect(ketQua.body.so_dong_loi).toBe(3);

      const xacNhan = await request(app.getHttpServer())
        .post(`/import/${importId}/xac-nhan`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(201);
      expect(xacNhan.body.so_dong_thanh_cong).toBe(1);
      expect(xacNhan.body.so_dong_loi).toBe(3);

      const dangKy = await prisma.dang_ky_hoc.findUnique({
        where: {
          hoc_vien_id_khoa_id: {
            hoc_vien_id: hocVienDaDuyetId,
            khoa_id: khoaId,
          },
        },
      });
      expect(dangKy).not.toBeNull();
      const lopGan = await prisma.phan_lop_giai_doan.findMany({
        where: { dang_ky_hoc_id: dangKy!.id },
      });
      expect(lopGan).toHaveLength(0);
      expect(dangKy?.trang_thai).toBe('da_duyet');

      // Nhánh chỉ ghi danh (không có dòng phan_lop_giai_doan nào) KHÔNG kích hoạt sự kiện
      // dang_ky_hoc_phan_lop (docs/api-contract.md mục 8). M9: xác nhận
      // KHÔNG enqueue (hang_doi_email) thay vì kiểm tra nhat_ky_thong_bao —
      // event này không bao giờ ghi trực tiếp vào đó nữa.
      const hangDoiPhanLop = await prisma.hang_doi_email.findMany({
        where: {
          hoc_vien_id: hocVienDaDuyetId,
          loai_su_kien: 'dang_ky_hoc_phan_lop',
        },
      });
      expect(hangDoiPhanLop).toHaveLength(0);
    });

    it('GET /hoc-vien/toi/khoa-hoc, /ket-qua phản ánh đúng ghi danh (chưa phân lớp giai đoạn nào) vừa import', async () => {
      const khoaHoc = await request(app.getHttpServer())
        .get('/hoc-vien/toi/khoa-hoc')
        .set('Authorization', `Bearer ${tokenHocVienDaDuyet}`)
        .expect(200);
      const entry = khoaHoc.body.find(
        (r: { khoa: { id: string } }) => r.khoa.id === khoaId,
      );
      expect(entry).toBeDefined();
      // Phân lớp theo giai đoạn: chỉ ghi danh -> mọi giai đoạn chưa có lớp.
      expect(
        entry.giai_doan.every((g: { lop: unknown }) => g.lop === null),
      ).toBe(true);

      const ketQua = await request(app.getHttpServer())
        .get('/hoc-vien/toi/ket-qua')
        .set('Authorization', `Bearer ${tokenHocVienDaDuyet}`)
        .expect(200);
      const entryKq = ketQua.body.find(
        (r: { khoa: { id: string } }) => r.khoa.id === khoaId,
      );
      expect(entryKq).toBeDefined();
      expect(entryKq.trang_thai).toBe('da_duyet');
      expect(entryKq.phan_lop).toEqual([]);
    });

    it('chạy lại import lần 2 với ten_lop có giá trị -> phân lớp cho học viên đã ghi danh (lop_id, trang_thai=da_phan_lop)', async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('data');
      // Mẫu phân lớp theo giai đoạn (spec 2026-10-02): mỗi giai đoạn 1 cột.
      sheet.addRow([
        'so_dinh_danh_ca_nhan',
        'ma_dinh_danh_moet',
        'GĐ1',
        'ten_cum',
      ]);
      sheet.addRow([sddDaDuyet, '', tenLop, '']);
      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

      const res = await request(app.getHttpServer())
        .post(`/import/phan_lop_hoc_vien?ma_khoa=${maKhoa}`)
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
      expect(dangKy?.trang_thai).toBe('da_phan_lop');
      const lopGan = await prisma.phan_lop_giai_doan.findFirst({
        where: { dang_ky_hoc_id: dangKy!.id },
      });
      expect(lopGan?.lop_id).toBe(lopId);

      // Nhánh gán lớp trực tiếp thực sự -> kích hoạt sự kiện dang_ky_hoc_phan_lop
      // (M9: enqueue hang_doi_email, gửi thật do cron đảm nhiệm) -> drain 1
      // lượt rồi xác nhận gửi thật qua Ethereal (không SMTP giả) -> ghi
      // trang_thai=thanh_cong.
      await drainHangDoi(hocVienDaDuyetId);
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
      // Mẫu phân lớp theo giai đoạn (spec 2026-10-02): mỗi giai đoạn 1 cột.
      sheet.addRow([
        'so_dinh_danh_ca_nhan',
        'ma_dinh_danh_moet',
        'GĐ1',
        'ten_cum',
      ]);
      sheet.addRow([sddMoi, '', tenLop, '']);
      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

      const res = await request(app.getHttpServer())
        .post(`/import/phan_lop_hoc_vien?ma_khoa=${maKhoa}`)
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
      expect(dangKy?.trang_thai).toBe('da_phan_lop');
      const lopGan = await prisma.phan_lop_giai_doan.findFirst({
        where: { dang_ky_hoc_id: dangKy!.id },
      });
      expect(lopGan?.lop_id).toBe(lopId);

      // Chỉ cần xác nhận sự kiện kích hoạt đúng 1 lần (đã enqueue) — không
      // cần xác minh gửi thật ở đây (đã có 2 test khác trong describe này
      // làm việc đó).
      const hangDoiPhanLop = await prisma.hang_doi_email.findMany({
        where: {
          hoc_vien_id: hocVienMoiId,
          loai_su_kien: 'dang_ky_hoc_phan_lop',
        },
      });
      expect(hangDoiPhanLop).toHaveLength(1);
    });
  });

  // T3 (mo-rong-nls-an-giang.md, QĐ1+QĐ6): dùng HocVienResolver (cả 2 mã
  // định danh tùy chọn, ít nhất 1) thay vì chỉ so_dinh_danh_ca_nhan như
  // trước — khóa/lớp tạo trực tiếp qua prisma (giống khối "PATCH
  // /dang-ky-hoc/{id}/ket-qua" dưới đây) để không tốn thêm request đăng nhập
  // (giới hạn 10 request/phút/IP, xem comment đầu file).
  describe('T3 — ghi danh/phân lớp qua ma_dinh_danh_moet (QĐ1, QĐ6)', () => {
    let khoaId: string;
    let maKhoa: string;
    let tenLop: string;

    beforeAll(async () => {
      const suf = uniqueSuffix();
      const khoa = await prisma.khoa_boi_duong.create({
        data: {
          ma_khoa: `K-T3-${suf}`,
          ten_khoa: 'Khóa T3 MOET',
          don_vi_dat_hang_id: truong1.id,
          thoi_gian_bat_dau: new Date('2026-01-01'),
          thoi_gian_ket_thuc: new Date('2026-01-31'),
        },
      });
      khoaId = khoa.id;
      maKhoa = khoa.ma_khoa;
      khoaIds.push(khoaId);

      tenLop = `Lớp T3 ${suf}`;
      await prisma.lop_hoc.create({
        data: { khoa_id: khoaId, loai_lop: 'truc_tiep', ten_lop: tenLop },
      });
      await prisma.giai_doan_khoa.create({
        data: {
          khoa_id: khoaId,
          thu_tu: 1,
          ten_giai_doan: 'Học trực tiếp',
          hinh_thuc: 'truc_tiep',
          thoi_gian_bat_dau: new Date('2026-01-01'),
          thoi_gian_ket_thuc: new Date('2026-01-31'),
        },
      });
    });

    function hocVienMoetTrucTiep(overrides: Record<string, unknown> = {}) {
      return {
        nguon_tao: 'import_moet' as const,
        // chk_hoc_vien_nguon_tao: nguon_tao='import_moet' đòi
        // ma_dinh_danh_moet NOT NULL — mặc định 1 giá trị duy nhất (đủ dùng
        // cho test bulk không cần override), các test khác override rõ.
        ma_dinh_danh_moet: `MOET-${uniqueSuffix()}`,
        ho_ten: 'Học Viên MOET',
        ngay_sinh: 5,
        thang_sinh: 5,
        nam_sinh: NAM_HOP_LE,
        don_vi_cong_tac_id: truong1.id,
        so_dien_thoai_lien_he: '0912349000',
        trang_thai: 'da_duyet' as const,
        nguoi_duyet_id: quanTri.nguoiDung.id,
        cap_duyet_thuc_te: 'quan_tri' as const,
        ngay_duyet: new Date(),
        ...overrides,
      };
    }

    it('file chỉ có ma_dinh_danh_moet -> ghi danh thành công cho hồ sơ import_moet có CCCD NULL', async () => {
      const suf = uniqueSuffix();
      const maMoet = `MOET-${suf}`;
      const hv = await prisma.hoc_vien.create({
        data: hocVienMoetTrucTiep({ ma_dinh_danh_moet: maMoet }),
      });
      hocVienIds.push(hv.id);
      expect(hv.so_dinh_danh_ca_nhan).toBeNull();

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('data');
      // Mẫu phân lớp theo giai đoạn (spec 2026-10-02): mỗi giai đoạn 1 cột.
      sheet.addRow([
        'so_dinh_danh_ca_nhan',
        'ma_dinh_danh_moet',
        'GĐ1',
        'ten_cum',
      ]);
      sheet.addRow(['', maMoet, '', '']);
      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

      const res = await request(app.getHttpServer())
        .post(`/import/phan_lop_hoc_vien?ma_khoa=${maKhoa}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach('file', buffer, 'phan-lop-moet-1.xlsx')
        .expect(201);
      const importId = res.body.import_id;
      importIds.push(importId);

      const preview = await request(app.getHttpServer())
        .get(`/import/${importId}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(preview.body.so_dong_thanh_cong).toBe(1);
      expect(preview.body.so_dong_loi).toBe(0);

      await request(app.getHttpServer())
        .post(`/import/${importId}/xac-nhan`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(201);

      const dangKy = await prisma.dang_ky_hoc.findUnique({
        where: { hoc_vien_id_khoa_id: { hoc_vien_id: hv.id, khoa_id: khoaId } },
      });
      expect(dangKy).not.toBeNull();
      const lopGan = await prisma.phan_lop_giai_doan.findMany({
        where: { dang_ky_hoc_id: dangKy!.id },
      });
      expect(lopGan).toHaveLength(0);
      expect(dangKy?.trang_thai).toBe('da_duyet');
    });

    it('dòng có cả 2 mã trỏ 2 hồ sơ khác nhau -> dòng lỗi có lý do rõ ràng', async () => {
      const suf = uniqueSuffix();
      const sddA = soDinhDanhNgauNhien();
      const moetB = `MOET-B-${suf}`;
      const hvA = await prisma.hoc_vien.create({
        data: hocVienMoetTrucTiep({
          so_dinh_danh_ca_nhan: sddA,
          ma_dinh_danh_moet: `MOET-A-${suf}`,
        }),
      });
      const hvB = await prisma.hoc_vien.create({
        data: hocVienMoetTrucTiep({ ma_dinh_danh_moet: moetB }),
      });
      hocVienIds.push(hvA.id, hvB.id);

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('data');
      // Mẫu phân lớp theo giai đoạn (spec 2026-10-02): mỗi giai đoạn 1 cột.
      sheet.addRow([
        'so_dinh_danh_ca_nhan',
        'ma_dinh_danh_moet',
        'GĐ1',
        'ten_cum',
      ]);
      sheet.addRow([sddA, moetB, '', '']); // trỏ 2 hồ sơ khác nhau
      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

      const res = await request(app.getHttpServer())
        .post(`/import/phan_lop_hoc_vien?ma_khoa=${maKhoa}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach('file', buffer, 'phan-lop-moet-2.xlsx')
        .expect(201);
      const importId = res.body.import_id;
      importIds.push(importId);

      const ketQua = await request(app.getHttpServer())
        .get(`/import/${importId}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(ketQua.body.so_dong_thanh_cong).toBe(0);
      expect(ketQua.body.so_dong_loi).toBe(1);
      expect(ketQua.body.danh_sach_loi[0].ly_do).toContain(
        'trỏ tới 2 hồ sơ học viên khác nhau',
      );

      const dangKyA = await prisma.dang_ky_hoc.findUnique({
        where: {
          hoc_vien_id_khoa_id: { hoc_vien_id: hvA.id, khoa_id: khoaId },
        },
      });
      expect(dangKyA).toBeNull();
    });

    it('phân lớp 100 học viên, 60 không có email -> 40 dòng hang_doi_email cho_gui, so_hoc_vien_chua_co_email=60', async () => {
      const suf = uniqueSuffix();
      const specs = Array.from({ length: 100 }, (_, i) => ({
        sdd: soDinhDanhNgauNhien(),
        coEmail: i < 40,
      }));

      const created = await Promise.all(
        specs.map((s, i) =>
          prisma.hoc_vien.create({
            data: hocVienMoetTrucTiep({
              so_dinh_danh_ca_nhan: s.sdd,
              ho_ten: `HV Bulk ${i}`,
              email_lien_he: s.coEmail ? `bulk-${i}-${suf}@test.local` : null,
            }),
          }),
        ),
      );
      hocVienIds.push(...created.map((h) => h.id));

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('data');
      // Mẫu phân lớp theo giai đoạn (spec 2026-10-02): mỗi giai đoạn 1 cột.
      sheet.addRow([
        'so_dinh_danh_ca_nhan',
        'ma_dinh_danh_moet',
        'GĐ1',
        'ten_cum',
      ]);
      specs.forEach((s) => sheet.addRow([s.sdd, '', tenLop, '']));
      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

      const res = await request(app.getHttpServer())
        .post(`/import/phan_lop_hoc_vien?ma_khoa=${maKhoa}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach('file', buffer, 'phan-lop-moet-bulk.xlsx')
        .expect(201);
      const importId = res.body.import_id;
      importIds.push(importId);

      const preview = await request(app.getHttpServer())
        .get(`/import/${importId}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(preview.body.so_dong_thanh_cong).toBe(100);
      expect(preview.body.so_dong_loi).toBe(0);

      const xacNhan = await request(app.getHttpServer())
        .post(`/import/${importId}/xac-nhan`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(201);
      expect(xacNhan.body.so_dong_thanh_cong).toBe(100);
      expect(xacNhan.body.so_dong_loi).toBe(0);

      const ketQua = await request(app.getHttpServer())
        .get(`/import/${importId}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(ketQua.body.so_hoc_vien_chua_co_email).toBe(60);

      // M9: commitPhanLop() giờ chỉ enqueue (themVaoHangDoiEmail), KHÔNG gửi
      // SMTP thật trong luồng import — việc gửi thật đã được xác minh end-to-
      // end riêng ở 2 test khác trong describe này (có drainHangDoi()), nên ở
      // đây chỉ cần xác nhận enqueue đúng số lượng (học viên có email_lien_he)
      // qua hang_doi_email, không cần drain 40 email thật (chậm, không cần
      // thiết cho mục đích test này) — bỏ luôn timeout 240s vì không còn gọi
      // SMTP thật.
      const hocVienIdsBulk = created.map((h) => h.id);
      const hangDoiBulk = await prisma.hang_doi_email.findMany({
        where: {
          loai_su_kien: 'dang_ky_hoc_phan_lop',
          hoc_vien_id: { in: hocVienIdsBulk },
        },
      });
      expect(hangDoiBulk).toHaveLength(40);
      expect(hangDoiBulk.every((d) => d.trang_thai === 'cho_gui')).toBe(true);
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
          don_vi_dat_hang_id: truong1.id,
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

    it('quan_tri cập nhật kết quả -> 200, ghi ket_qua/ngay_hoan_thanh, bắn sự kiện dang_ky_hoc_ket_qua', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/dang-ky-hoc/${dangKyId}/ket-qua`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({ ket_qua: 'dat', ngay_hoan_thanh: '2026-01-31' })
        .expect(200);
      expect(res.body.ket_qua).toBe('dat');
      expect(res.body.ngay_hoan_thanh).toBeDefined();

      // M9: chỉ enqueue hang_doi_email — drain 1 lượt để xác nhận gửi thật
      // thành công (trang_thai=thanh_cong trên nhat_ky_thong_bao).
      await drainHangDoi(hocVienKetQuaId);
      const thongBao = await prisma.nhat_ky_thong_bao.findMany({
        where: {
          hoc_vien_id: hocVienKetQuaId,
          loai_su_kien: 'dang_ky_hoc_ket_qua',
        },
      });
      expect(thongBao).toHaveLength(1);
      expect(thongBao[0].trang_thai).toBe('thanh_cong');
    });

    it.each([
      ['truong', () => tokenTruong1],
      ['so_gddt', () => tokenSo],
      ['phong_vhxh', () => tokenPhong],
    ])('%s gọi PATCH .../ket-qua -> 403 (D6: chỉ quan_tri)', async (_vaiTro, layToken) => {
      await request(app.getHttpServer())
        .patch(`/dang-ky-hoc/${dangKyId}/ket-qua`)
        .set('Authorization', `Bearer ${layToken()}`)
        .send({ ket_qua: 'dat' })
        .expect(403);
    });

    it('ket_qua ngoài enum ket_qua_hoc -> 400', async () => {
      await request(app.getHttpServer())
        .patch(`/dang-ky-hoc/${dangKyId}/ket-qua`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({ ket_qua: 'gioi' })
        .expect(400);
    });

    it('id không tồn tại -> 404', async () => {
      await request(app.getHttpServer())
        .patch('/dang-ky-hoc/00000000-0000-0000-0000-000000000000/ket-qua')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
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
