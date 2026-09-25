import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import type { Response } from 'superagent';
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

// supertest/superagent không tự nhận diện mimetype xlsx là nhị phân — tự
// đăng ký parser gom raw bytes để đọc lại bằng exceljs trong test (cùng
// pattern với test/import.e2e-spec.ts).
function binaryParser(
  res: Response,
  callback: (err: Error | null, body: Buffer) => void,
) {
  res.setEncoding('binary');
  let data = '';
  res.on('data', (chunk: string) => {
    data += chunk;
  });
  res.on('end', () => callback(null, Buffer.from(data, 'binary')));
}

describe('Dịch vụ Báo cáo (e2e)', () => {
  let app: INestApplication;

  // Cây: soGddt -> phongVhxh -> truong1 (địa bàn xaTruong1)
  //              -> truong2 (địa bàn xaTruong2, cùng phòng)
  //      soGddt -> phongKhac -> truongKhac (ngoài phạm vi phongVhxh)
  let tinh: { id: string };
  let xaTruong1: { id: string };
  let xaTruong2: { id: string };
  let xaKhac: { id: string };
  let soGddt: { id: string };
  let phongVhxh: { id: string };
  let phongKhac: { id: string };
  let truong1: { id: string; ten_don_vi: string };
  let truong2: { id: string };
  let truongKhac: { id: string };

  let quanTri: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let soAccount: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let phongAccount: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let truong1Account: Awaited<ReturnType<typeof taoNguoiDungTest>>;

  let tokenQuanTri: string;
  let tokenSo: string;
  let tokenPhong: string;
  let tokenTruong1: string;
  let tokenHocVien: string;

  const hocVienIds: string[] = [];
  const nguoiDungHocVienIds: string[] = [];
  const khoaIds: string[] = [];
  const dangKyIds: string[] = [];

  async function dangNhap(ten_dang_nhap: string, mat_khau: string) {
    const res = await request(app.getHttpServer())
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap, mat_khau })
      .expect(200);
    return res.body.token as string;
  }

  beforeAll(async () => {
    app = await createTestApp();
    const suf = uniqueSuffix();

    tinh = await prisma.dia_danh.create({
      data: { ma: `T-bc-${suf}`, ten: `Tỉnh BC ${suf}`, cap: 'tinh_thanh' },
    });
    xaTruong1 = await prisma.dia_danh.create({
      data: {
        ma: `X1-bc-${suf}`,
        ten: `Xã BC 1 ${suf}`,
        cap: 'phuong_xa_dac_khu',
        parent_id: tinh.id,
      },
    });
    xaTruong2 = await prisma.dia_danh.create({
      data: {
        ma: `X2-bc-${suf}`,
        ten: `Xã BC 2 ${suf}`,
        cap: 'phuong_xa_dac_khu',
        parent_id: tinh.id,
      },
    });
    xaKhac = await prisma.dia_danh.create({
      data: {
        ma: `X3-bc-${suf}`,
        ten: `Xã BC Khác ${suf}`,
        cap: 'phuong_xa_dac_khu',
        parent_id: tinh.id,
      },
    });
    soGddt = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-so-bc-${suf}`,
        ten_don_vi: `Sở GD&ĐT BC ${suf}`,
        loai_don_vi: 'so_gddt',
        dia_ban_id: xaTruong1.id,
      },
    });
    phongVhxh = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-phong-bc-${suf}`,
        ten_don_vi: `Phòng VHXH BC ${suf}`,
        loai_don_vi: 'phong_vhxh',
        dia_ban_id: xaTruong1.id,
        don_vi_cha_id: soGddt.id,
      },
    });
    phongKhac = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-phong-khac-bc-${suf}`,
        ten_don_vi: `Phòng VHXH Khác BC ${suf}`,
        loai_don_vi: 'phong_vhxh',
        dia_ban_id: xaKhac.id,
        don_vi_cha_id: soGddt.id,
      },
    });
    truong1 = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-truong1-bc-${suf}`,
        ten_don_vi: `Trường Một BC ${suf}`,
        loai_don_vi: 'truong',
        dia_ban_id: xaTruong1.id,
        don_vi_cha_id: phongVhxh.id,
      },
    });
    truong2 = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-truong2-bc-${suf}`,
        ten_don_vi: `Trường Hai BC ${suf}`,
        loai_don_vi: 'truong',
        dia_ban_id: xaTruong2.id,
        don_vi_cha_id: phongVhxh.id,
      },
    });
    truongKhac = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-truong-khac-bc-${suf}`,
        ten_don_vi: `Trường Khác BC ${suf}`,
        loai_don_vi: 'truong',
        dia_ban_id: xaKhac.id,
        don_vi_cha_id: phongKhac.id,
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
    truong1Account = await taoNguoiDungTest({
      vai_tro: 'truong',
      don_vi_id: truong1.id,
      mat_khau: 'MatKhau123',
    });

    tokenQuanTri = await dangNhap(quanTri.ten_dang_nhap, 'MatKhau123');
    tokenSo = await dangNhap(soAccount.ten_dang_nhap, 'MatKhau123');
    tokenPhong = await dangNhap(phongAccount.ten_dang_nhap, 'MatKhau123');
    tokenTruong1 = await dangNhap(truong1Account.ten_dang_nhap, 'MatKhau123');

    // Dữ liệu hoc_vien tạo trực tiếp qua Prisma (bỏ qua luồng đăng ký đầy đủ —
    // báo cáo chỉ cần trạng thái/đơn vị/cấp giảng dạy đã biết trước để assert
    // đúng số liệu, không cần test lại luồng tạo hồ sơ đã có ở hoc-vien.e2e-spec.ts).
    const suf2 = uniqueSuffix();
    const hv1 = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'tu_dang_ky',
        ho_ten: 'Nguyễn Văn Một',
        so_dinh_danh_ca_nhan: `1${Date.now().toString().slice(-11)}`,
        ngay_sinh: 1,
        thang_sinh: 1,
        nam_sinh: NAM_HOP_LE,
        don_vi_cong_tac_id: truong1.id,
        so_dien_thoai_lien_he: '0911111111',
        trang_thai: 'da_duyet',
        cap_giang_day: 'tieu_hoc',
        nguoi_duyet_id: soAccount.nguoiDung.id,
        cap_duyet_thuc_te: 'so_gddt',
        ngay_duyet: new Date(),
      },
    });
    const hv2 = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'tu_dang_ky',
        ho_ten: 'Trần Thị Hai',
        so_dinh_danh_ca_nhan: `2${Date.now().toString().slice(-11)}`,
        ngay_sinh: 2,
        thang_sinh: 2,
        nam_sinh: NAM_HOP_LE,
        don_vi_cong_tac_id: truong1.id,
        so_dien_thoai_lien_he: '0911111112',
        trang_thai: 'cho_duyet',
        cap_giang_day: 'thcs',
      },
    });
    const hv3 = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'tu_dang_ky',
        ho_ten: 'Lê Văn Ba',
        so_dinh_danh_ca_nhan: `3${Date.now().toString().slice(-11)}`,
        ngay_sinh: 3,
        thang_sinh: 3,
        nam_sinh: NAM_HOP_LE,
        don_vi_cong_tac_id: truong2.id,
        so_dien_thoai_lien_he: '0911111113',
        trang_thai: 'da_duyet',
        cap_giang_day: null,
        nguoi_duyet_id: soAccount.nguoiDung.id,
        cap_duyet_thuc_te: 'so_gddt',
        ngay_duyet: new Date(),
      },
    });
    // Ngoài phạm vi phongVhxh (thuộc truongKhac/phongKhac) — dùng để test
    // scoping không rò rỉ số liệu.
    const hvKhac = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'tu_dang_ky',
        ho_ten: 'Phạm Thị Khác',
        so_dinh_danh_ca_nhan: `4${Date.now().toString().slice(-11)}`,
        ngay_sinh: 4,
        thang_sinh: 4,
        nam_sinh: NAM_HOP_LE,
        don_vi_cong_tac_id: truongKhac.id,
        so_dien_thoai_lien_he: '0911111114',
        trang_thai: 'da_duyet',
        cap_giang_day: 'thpt',
        nguoi_duyet_id: soAccount.nguoiDung.id,
        cap_duyet_thuc_te: 'so_gddt',
        ngay_duyet: new Date(),
      },
    });
    hocVienIds.push(hv1.id, hv2.id, hv3.id, hvKhac.id);

    // 1 hồ sơ tạo với created_at trong quá khứ xa để test tu_ngay/den_ngay
    // loại đúng dòng ngoài khoảng.
    const hvCu = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'tu_dang_ky',
        ho_ten: 'Hồ Sơ Cũ',
        so_dinh_danh_ca_nhan: `5${Date.now().toString().slice(-11)}`,
        ngay_sinh: 5,
        thang_sinh: 5,
        nam_sinh: NAM_HOP_LE,
        don_vi_cong_tac_id: truong1.id,
        so_dien_thoai_lien_he: '0911111115',
        trang_thai: 'nhap',
        created_at: new Date('2000-01-01T00:00:00.000Z'),
      },
    });
    await prisma.hoc_vien.update({
      where: { id: hvCu.id },
      data: { created_at: new Date('2000-01-01T00:00:00.000Z') },
    });
    hocVienIds.push(hvCu.id);

    // Khóa bồi dưỡng trong phạm vi + đăng ký/kết quả.
    const khoa1 = await prisma.khoa_boi_duong.create({
      data: {
        ma_khoa: `K-bc-${suf2}`,
        ten_khoa: 'Khóa Bồi Dưỡng Báo Cáo',
        don_vi_to_chuc_id: truong1.id,
        thoi_gian_bat_dau: new Date('2026-03-01'),
        thoi_gian_ket_thuc: new Date('2026-03-10'),
        trang_thai: 'da_duyet',
      },
    });
    khoaIds.push(khoa1.id);
    const dk1 = await prisma.dang_ky_hoc.create({
      data: {
        hoc_vien_id: hv1.id,
        khoa_id: khoa1.id,
        trang_thai: 'da_phan_lop',
        ket_qua: 'dat',
      },
    });
    const dk2 = await prisma.dang_ky_hoc.create({
      data: {
        hoc_vien_id: hv2.id,
        khoa_id: khoa1.id,
        trang_thai: 'da_duyet',
      },
    });
    dangKyIds.push(dk1.id, dk2.id);

    // Khóa không ai đăng ký -- vẫn phải xuất hiện trong theo=khoa (rule
    // provisional: liệt kê toàn bộ khóa khớp phạm vi+ngày, kể cả 0 đăng ký).
    const khoaRong = await prisma.khoa_boi_duong.create({
      data: {
        ma_khoa: `K-rong-bc-${suf2}`,
        ten_khoa: 'Khóa Chưa Có Ai Đăng Ký',
        don_vi_to_chuc_id: truong1.id,
        thoi_gian_bat_dau: new Date('2026-04-01'),
        thoi_gian_ket_thuc: new Date('2026-04-05'),
        trang_thai: 'nhap',
      },
    });
    khoaIds.push(khoaRong.id);

    // Khóa ngoài phạm vi (truongKhac) — test scoping theo=khoa.
    const khoaKhac = await prisma.khoa_boi_duong.create({
      data: {
        ma_khoa: `K-khac-bc-${suf2}`,
        ten_khoa: 'Khóa Ngoài Phạm Vi',
        don_vi_to_chuc_id: truongKhac.id,
        thoi_gian_bat_dau: new Date('2026-03-01'),
        thoi_gian_ket_thuc: new Date('2026-03-10'),
        trang_thai: 'da_duyet',
      },
    });
    khoaIds.push(khoaKhac.id);

    // Tài khoản hoc_vien dùng để test 403 — dịch vụ báo cáo không có phạm vi
    // nghiệp vụ cho vai_tro này.
    const hvSuf = uniqueSuffix();
    const dk = await request(app.getHttpServer())
      .post('/hoc-vien')
      .send({
        ho_ten: 'Học Viên Kiểm Tra Phân Quyền',
        so_dinh_danh_ca_nhan: `9${Date.now().toString().slice(-11)}`,
        ngay_sinh: 9,
        thang_sinh: 9,
        nam_sinh: NAM_HOP_LE,
        noi_sinh_id: tinh.id,
        phuong_xa_id: xaKhac.id,
        don_vi_cong_tac_id: truongKhac.id,
        so_dien_thoai_lien_he: '0911119999',
        email_lien_he: `bc-403-${hvSuf}@test.local`,
        trinh_do_chuyen_mon: 'dai_hoc',
        chuyen_mon: ['Sư phạm Toán'],
      })
      .expect(201);
    hocVienIds.push(dk.body.hoc_vien_id);
    const ndHv = await prisma.nguoi_dung.findUnique({
      where: { ten_dang_nhap: dk.body.ten_dang_nhap },
    });
    if (ndHv) nguoiDungHocVienIds.push(ndHv.id);
    tokenHocVien = await dangNhap(dk.body.ten_dang_nhap, `0909${NAM_HOP_LE}`);
  });

  afterAll(async () => {
    await prisma.dang_ky_hoc.deleteMany({ where: { id: { in: dangKyIds } } });
    await prisma.khoa_boi_duong.deleteMany({ where: { id: { in: khoaIds } } });
    // hoc_vien.created_by/nguoi_duyet_id tham chiếu nguoi_dung — gỡ trước khi
    // xóa nguoi_dung để không vi phạm FK (cùng pattern
    // test/khoa-boi-duong.e2e-spec.ts).
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
    await xoaNguoiDungTest(quanTri.nguoiDung.id);
    await xoaNguoiDungTest(soAccount.nguoiDung.id);
    await xoaNguoiDungTest(phongAccount.nguoiDung.id);
    await xoaNguoiDungTest(truong1Account.nguoiDung.id);
    await xoaDonViTest(
      [
        truong1.id,
        truong2.id,
        truongKhac.id,
        phongVhxh.id,
        phongKhac.id,
        soGddt.id,
      ],
      [xaTruong1.id, xaTruong2.id, xaKhac.id, tinh.id],
    );
    await prisma.$disconnect();
    await app.close();
  });

  describe('GET /bao-cao/tong-hop?theo=don_vi', () => {
    it('truong1 chỉ thấy đơn vị của mình, đúng số liệu theo trang_thai/cap_giang_day', async () => {
      const res = await request(app.getHttpServer())
        .get('/bao-cao/tong-hop?theo=don_vi')
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .expect(200);
      expect(res.body.theo).toBe('don_vi');
      const rows = res.body.rows as Array<{
        don_vi_id: string;
        tong_so: number;
        theo_trang_thai: Record<string, number>;
        theo_cap_giang_day: Record<string, number>;
      }>;
      // truong1 có 3 hồ sơ trong phạm vi (hv1 da_duyet/tieu_hoc, hv2
      // cho_duyet/thcs, hvCu nhap — created_at 2000, vẫn tính vì không lọc ngày).
      const row = rows.find((r) => r.don_vi_id === truong1.id);
      expect(row).toBeDefined();
      expect(row!.tong_so).toBe(3);
      expect(row!.theo_trang_thai).toMatchObject({
        nhap: 1,
        cho_duyet: 1,
        da_duyet: 1,
        tu_choi: 0,
        loi: 0,
      });
      expect(row!.theo_cap_giang_day).toMatchObject({
        tieu_hoc: 1,
        thcs: 1,
        khong_xac_dinh: 1,
      });
      // Không thấy đơn vị nào khác ngoài phạm vi của mình.
      expect(rows.map((r) => r.don_vi_id)).toEqual([truong1.id]);
    });

    it('phong_vhxh thấy cả truong1 và truong2 (con cháu), không thấy truongKhac', async () => {
      const res = await request(app.getHttpServer())
        .get('/bao-cao/tong-hop?theo=don_vi')
        .set('Authorization', `Bearer ${tokenPhong}`)
        .expect(200);
      const ids = (res.body.rows as Array<{ don_vi_id: string }>).map(
        (r) => r.don_vi_id,
      );
      expect(ids).toContain(truong1.id);
      expect(ids).toContain(truong2.id);
      expect(ids).not.toContain(truongKhac.id);
    });

    it('so_gddt thấy toàn bộ cây (kể cả truongKhac thuộc phongKhac, phòng khác trong cùng sở)', async () => {
      const res = await request(app.getHttpServer())
        .get('/bao-cao/tong-hop?theo=don_vi')
        .set('Authorization', `Bearer ${tokenSo}`)
        .expect(200);
      const ids = (res.body.rows as Array<{ don_vi_id: string }>).map(
        (r) => r.don_vi_id,
      );
      expect(ids).toContain(truong1.id);
      expect(ids).toContain(truong2.id);
      expect(ids).toContain(truongKhac.id);
    });

    it('quan_tri (scope=ALL) thấy toàn hệ thống, không cần don_vi_id gán', async () => {
      const res = await request(app.getHttpServer())
        .get('/bao-cao/tong-hop?theo=don_vi')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      const ids = (res.body.rows as Array<{ don_vi_id: string }>).map(
        (r) => r.don_vi_id,
      );
      expect(ids).toContain(truong1.id);
      expect(ids).toContain(truong2.id);
      expect(ids).toContain(truongKhac.id);
    });

    it('tu_ngay/den_ngay loại bỏ hồ sơ tạo ngoài khoảng (hvCu created_at=2000-01-01)', async () => {
      const res = await request(app.getHttpServer())
        .get(
          '/bao-cao/tong-hop?theo=don_vi&tu_ngay=2020-01-01&den_ngay=2030-12-31',
        )
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .expect(200);
      const row = (
        res.body.rows as Array<{ don_vi_id: string; tong_so: number }>
      ).find((r) => r.don_vi_id === truong1.id);
      // Chỉ còn hv1 + hv2 (hvCu bị loại vì created_at=2000 ngoài khoảng lọc).
      expect(row!.tong_so).toBe(2);
    });

    it('khoảng ngày không khớp dữ liệu nào -> rows rỗng', async () => {
      const res = await request(app.getHttpServer())
        .get(
          '/bao-cao/tong-hop?theo=don_vi&tu_ngay=1990-01-01&den_ngay=1990-01-02',
        )
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .expect(200);
      expect(res.body.rows).toEqual([]);
    });

    it('hoc_vien gọi -> 403 (không có phạm vi nghiệp vụ để tổng hợp báo cáo)', async () => {
      await request(app.getHttpServer())
        .get('/bao-cao/tong-hop?theo=don_vi')
        .set('Authorization', `Bearer ${tokenHocVien}`)
        .expect(403);
    });

    it('không kèm token -> 401', async () => {
      await request(app.getHttpServer())
        .get('/bao-cao/tong-hop?theo=don_vi')
        .expect(401);
    });

    it('theo không hợp lệ -> 400', async () => {
      await request(app.getHttpServer())
        .get('/bao-cao/tong-hop?theo=khong_ton_tai')
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .expect(400);
    });
  });

  describe('GET /bao-cao/tong-hop?theo=dia_ban', () => {
    it('nhóm theo dia_ban_id của đơn vị công tác — truong1+truong2 cùng phòng nhưng khác xã -> 2 dòng', async () => {
      const res = await request(app.getHttpServer())
        .get('/bao-cao/tong-hop?theo=dia_ban')
        .set('Authorization', `Bearer ${tokenPhong}`)
        .expect(200);
      const rows = res.body.rows as Array<{
        dia_ban_id: string;
        tong_so: number;
      }>;
      const rowXa1 = rows.find((r) => r.dia_ban_id === xaTruong1.id);
      const rowXa2 = rows.find((r) => r.dia_ban_id === xaTruong2.id);
      expect(rowXa1).toBeDefined();
      expect(rowXa2).toBeDefined();
      expect(rowXa1!.tong_so).toBe(3); // hv1, hv2, hvCu (đều don_vi=truong1 -> dia_ban=xaTruong1)
      expect(rowXa2!.tong_so).toBe(1); // hv3 (truong2 -> xaTruong2)
    });
  });

  describe('GET /bao-cao/tong-hop?theo=khoa', () => {
    it('liệt kê khóa trong phạm vi kể cả khóa 0 đăng ký, đúng breakdown trang_thai_dang_ky/ket_qua', async () => {
      const res = await request(app.getHttpServer())
        .get('/bao-cao/tong-hop?theo=khoa')
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .expect(200);
      const rows = res.body.rows as Array<{
        khoa_id: string;
        tong_dang_ky: number;
        theo_trang_thai_dang_ky: Record<string, number>;
        theo_ket_qua: Record<string, number>;
      }>;
      const ids = rows.map((r) => r.khoa_id);
      expect(ids).toContain(khoaIds[0]); // khoa1
      expect(ids).toContain(khoaIds[1]); // khoaRong
      expect(ids).not.toContain(khoaIds[2]); // khoaKhac (ngoài phạm vi truong1)

      const khoa1Row = rows.find((r) => r.khoa_id === khoaIds[0])!;
      expect(khoa1Row.tong_dang_ky).toBe(2);
      expect(khoa1Row.theo_trang_thai_dang_ky).toMatchObject({
        da_phan_lop: 1,
        da_duyet: 1,
        cho_duyet: 0,
        tu_choi: 0,
      });
      expect(khoa1Row.theo_ket_qua).toMatchObject({
        dat: 1,
        chua_co_ket_qua: 1,
        dang_hoc: 0,
        khong_dat: 0,
        vang: 0,
      });

      const khoaRongRow = rows.find((r) => r.khoa_id === khoaIds[1])!;
      expect(khoaRongRow.tong_dang_ky).toBe(0);
    });

    it('tu_ngay/den_ngay lọc theo thoi_gian_bat_dau -> loại khoaRong (04/2026) khi lọc 03/2026', async () => {
      const res = await request(app.getHttpServer())
        .get(
          '/bao-cao/tong-hop?theo=khoa&tu_ngay=2026-03-01&den_ngay=2026-03-31',
        )
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .expect(200);
      const ids = (res.body.rows as Array<{ khoa_id: string }>).map(
        (r) => r.khoa_id,
      );
      expect(ids).toContain(khoaIds[0]);
      expect(ids).not.toContain(khoaIds[1]);
    });
  });

  describe('GET /bao-cao/xuat-excel', () => {
    it('trả file .xlsx đúng content-type, đọc lại đúng số liệu + giữ dấu tiếng Việt', async () => {
      const res = await request(app.getHttpServer())
        .get('/bao-cao/xuat-excel?theo=don_vi')
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .buffer(true)
        .parse(binaryParser)
        .expect(200);
      expect(res.headers['content-type']).toContain('spreadsheetml');
      expect(res.headers['content-disposition']).toContain('.xlsx');

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body as unknown as ExcelJS.Buffer);
      const sheet = workbook.worksheets[0];
      const header = (sheet.getRow(1).values as unknown[]).slice(1);
      expect(header[0]).toBe('Đơn vị');

      const dataRow = (sheet.getRow(2).values as unknown[]).slice(1);
      expect(dataRow[0]).toBe(truong1.ten_don_vi); // tên đơn vị giữ nguyên dấu tiếng Việt sau round-trip qua .xlsx thật
    });

    it('hoc_vien gọi xuất-excel -> 403', async () => {
      await request(app.getHttpServer())
        .get('/bao-cao/xuat-excel?theo=don_vi')
        .set('Authorization', `Bearer ${tokenHocVien}`)
        .expect(403);
    });
  });
});
