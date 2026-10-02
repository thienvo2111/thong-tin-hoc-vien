import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoNguoiDungTest,
  uniqueSuffix,
  xoaNguoiDungTest,
  xoaDonViTest,
} from './utils/test-data';

const NAM_HOP_LE = new Date().getUTCFullYear() - 20;

function ddmmyyyy(ngay: number, thang: number, nam: number): string {
  return `${String(ngay).padStart(2, '0')}${String(thang).padStart(2, '0')}${nam}`;
}

// T14 (mo-rong-nls-an-giang.md) — Đợt xác nhận & lịch sử thay đổi hồ sơ.
describe('Đợt xác nhận & lịch sử thay đổi hồ sơ — T14 (e2e)', () => {
  let app: INestApplication;

  let tinh: { id: string };
  let xaTruong1: { id: string };
  let xaTruong2: { id: string };
  let soGddt: { id: string };
  let phongVhxh: { id: string };
  let truong1: { id: string; ten_don_vi: string };
  let truong2: { id: string; ten_don_vi: string };

  let quanTri: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let truong1Account: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let tokenQuanTri: string;
  let tokenTruong1: string;

  const hocVienIds: string[] = [];
  const nguoiDungHocVienIds: string[] = [];
  const dotIds: string[] = [];

  async function dangNhap(ten_dang_nhap: string, mat_khau: string) {
    const res = await request(app.getHttpServer())
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap, mat_khau })
      .expect(200);
    return res.body.token as string;
  }

  async function taoHocVienMoet(params: {
    donVi: { id: string };
    hoTen?: string;
    email?: string;
    ngay?: number;
    thang?: number;
  }) {
    const suf = uniqueSuffix();
    const ngay = params.ngay ?? 12;
    const thang = params.thang ?? 7;
    const tenDangNhap = `MOET-T14-${suf}`;
    const hocVien = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: tenDangNhap,
        ho_ten: params.hoTen ?? 'Hoc Vien Test',
        email_lien_he: params.email,
        ngay_sinh: ngay,
        thang_sinh: thang,
        nam_sinh: NAM_HOP_LE,
        don_vi_cong_tac_id: params.donVi.id,
        so_dien_thoai_lien_he: '0900000000',
        trang_thai: 'da_duyet',
        nguoi_duyet_id: quanTri.nguoiDung.id,
        cap_duyet_thuc_te: 'quan_tri',
        ngay_duyet: new Date(),
        chuyen_mon: { create: [{ chuyen_mon: 'CNTT' }] },
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
    const token = await dangNhap(
      tenDangNhap,
      ddmmyyyy(ngay, thang, NAM_HOP_LE),
    );
    return { hocVien, nguoiDung, token, tenDangNhap };
  }

  beforeAll(async () => {
    app = await createTestApp();
    const suf = uniqueSuffix();

    tinh = await prisma.dia_danh.create({
      data: { ma: `T-t14-${suf}`, ten: `Tỉnh T14 ${suf}`, cap: 'tinh_thanh' },
    });
    xaTruong1 = await prisma.dia_danh.create({
      data: {
        ma: `X1-t14-${suf}`,
        ten: `Xã T14 1 ${suf}`,
        cap: 'phuong_xa_dac_khu',
        parent_id: tinh.id,
      },
    });
    xaTruong2 = await prisma.dia_danh.create({
      data: {
        ma: `X2-t14-${suf}`,
        ten: `Xã T14 2 ${suf}`,
        cap: 'phuong_xa_dac_khu',
        parent_id: tinh.id,
      },
    });
    soGddt = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-so-t14-${suf}`,
        ten_don_vi: `Sở GD&ĐT T14 ${suf}`,
        loai_don_vi: 'so_gddt',
        dia_ban_id: xaTruong1.id,
      },
    });
    phongVhxh = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-phong-t14-${suf}`,
        ten_don_vi: `Phòng VHXH T14 ${suf}`,
        loai_don_vi: 'phong_vhxh',
        dia_ban_id: xaTruong1.id,
        don_vi_cha_id: soGddt.id,
      },
    });
    truong1 = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-truong1-t14-${suf}`,
        ten_don_vi: `Trường Một T14 ${suf}`,
        loai_don_vi: 'truong',
        dia_ban_id: xaTruong1.id,
        don_vi_cha_id: phongVhxh.id,
      },
    });
    truong2 = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-truong2-t14-${suf}`,
        ten_don_vi: `Trường Hai T14 ${suf}`,
        loai_don_vi: 'truong',
        dia_ban_id: xaTruong2.id,
        don_vi_cha_id: soGddt.id,
      },
    });

    quanTri = await taoNguoiDungTest({
      vai_tro: 'quan_tri',
      don_vi_id: truong1.id,
      mat_khau: 'MatKhau123',
    });
    truong1Account = await taoNguoiDungTest({
      vai_tro: 'truong',
      don_vi_id: truong1.id,
      mat_khau: 'MatKhau123',
    });
    tokenQuanTri = await dangNhap(quanTri.ten_dang_nhap, 'MatKhau123');
    tokenTruong1 = await dangNhap(truong1Account.ten_dang_nhap, 'MatKhau123');
  });

  afterAll(async () => {
    await prisma.lich_su_thay_doi_ho_so.deleteMany({
      where: { hoc_vien_id: { in: hocVienIds } },
    });
    await prisma.xac_nhan_ho_so.deleteMany({
      where: { hoc_vien_id: { in: hocVienIds } },
    });
    if (dotIds.length > 0) {
      await prisma.dot_xac_nhan.deleteMany({ where: { id: { in: dotIds } } });
    }
    if (hocVienIds.length > 0) {
      // hoc_vien.created_by/nguoi_duyet_id -> nguoi_dung(id) không có ON
      // DELETE CASCADE — gỡ trước khi xóa nguoi_dung (cùng cách làm với
      // import-moet.e2e-spec.ts).
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
    // M9 (2026-10-01): hang_doi_email.hoc_vien_id cũng FK onDelete: NoAction
    // (docs/database-ddl.sql PHẦN 4) — xóa trước hoc_vien cùng lý do với
    // nhat_ky_thong_bao ở dưới.
    await prisma.hang_doi_email.deleteMany({
      where: { hoc_vien_id: { in: hocVienIds } },
    });
    await prisma.nhat_ky_thong_bao.deleteMany({
      where: { hoc_vien_id: { in: hocVienIds } },
    });
    await prisma.hoc_vien.deleteMany({ where: { id: { in: hocVienIds } } });
    await xoaNguoiDungTest(quanTri.nguoiDung.id);
    await xoaNguoiDungTest(truong1Account.nguoiDung.id);
    await xoaDonViTest(
      [truong1.id, truong2.id, phongVhxh.id, soGddt.id],
      [xaTruong1.id, xaTruong2.id, tinh.id],
    );
    await prisma.$disconnect();
    await app.close();
  });

  describe('CRUD /dot-xac-nhan (quan_tri)', () => {
    it('POST /dot-xac-nhan -> tạo thành công, dong_luc > mo_luc', async () => {
      const now = new Date();
      const res = await request(app.getHttpServer())
        .post('/dot-xac-nhan')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({
          ten: 'Đợt 1 kiểm tra bổ sung',
          loai: 'kiem_tra_bo_sung',
          mo_luc: new Date(now.getTime() - 1000).toISOString(),
          dong_luc: new Date(now.getTime() + 3600_000).toISOString(),
        })
        .expect(201);
      dotIds.push(res.body.id);
      expect(res.body.loai).toBe('kiem_tra_bo_sung');
      expect(res.body.khoa_id).toBeNull();
    });

    it('dong_luc <= mo_luc -> 400', async () => {
      const now = new Date();
      await request(app.getHttpServer())
        .post('/dot-xac-nhan')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({
          ten: 'Đợt sai giờ',
          loai: 'kiem_tra_bo_sung',
          mo_luc: now.toISOString(),
          dong_luc: now.toISOString(),
        })
        .expect(400);
    });

    it('chồng thời gian với đợt đã có (cùng khoa_id=NULL) -> 409', async () => {
      const now = new Date();
      await request(app.getHttpServer())
        .post('/dot-xac-nhan')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({
          ten: 'Đợt chồng giờ',
          loai: 'xac_nhan_truoc_danh_gia',
          mo_luc: new Date(now.getTime() - 500).toISOString(),
          dong_luc: new Date(now.getTime() + 1800_000).toISOString(),
        })
        .expect(409);
    });

    it('truong (không phải quan_tri) gọi -> 403', async () => {
      const now = new Date();
      await request(app.getHttpServer())
        .post('/dot-xac-nhan')
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .send({
          ten: 'Đợt X',
          loai: 'kiem_tra_bo_sung',
          mo_luc: now.toISOString(),
          dong_luc: new Date(now.getTime() + 1000).toISOString(),
        })
        .expect(403);
    });

    it('PATCH /dot-xac-nhan/{id} -> gia hạn dong_luc', async () => {
      const moiHan = new Date(Date.now() + 7200_000).toISOString();
      const res = await request(app.getHttpServer())
        .patch(`/dot-xac-nhan/${dotIds[0]}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({ dong_luc: moiHan })
        .expect(200);
      expect(new Date(res.body.dong_luc).toISOString()).toBe(moiHan);
    });

    it('GET /dot-xac-nhan -> có đợt vừa tạo', async () => {
      const res = await request(app.getHttpServer())
        .get('/dot-xac-nhan')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(
        (res.body as { id: string }[]).some((d) => d.id === dotIds[0]),
      ).toBe(true);
    });
  });

  describe('Luồng học viên trong đợt đang mở', () => {
    it('GET /hoc-vien/toi/dot-xac-nhan -> dang_mo=true, da_xac_nhan=false, day_du=false lúc mới import', async () => {
      const { token } = await taoHocVienMoet({ donVi: truong1 });
      const res = await request(app.getHttpServer())
        .get('/hoc-vien/toi/dot-xac-nhan')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.dang_mo).toBe(true);
      expect(res.body.da_xac_nhan).toBe(false);
      expect(res.body.day_du).toBe(false);
      expect(res.body.dot.id).toBe(dotIds[0]);
    });

    it('POST /hoc-vien/toi/xac-nhan khi hồ sơ chưa đầy đủ -> 400 liệt kê trường thiếu (kể cả email_lien_he)', async () => {
      const { token } = await taoHocVienMoet({ donVi: truong1 });
      const res = await request(app.getHttpServer())
        .post('/hoc-vien/toi/xac-nhan')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
      const fields = (res.body.error.fields as { field: string }[]).map(
        (f) => f.field,
      );
      expect(fields).toEqual(expect.arrayContaining(['email_lien_he']));
    });

    it('PATCH sửa ho_ten (trường gốc MOET) -> 1 dòng lich_su_thay_doi_ho_so la_truong_goc_moet=true, thấy trong GET /bao-cao/sua-truong-moet', async () => {
      const { hocVien, token } = await taoHocVienMoet({
        donVi: truong1,
        hoTen: 'Ten Cu',
      });
      await request(app.getHttpServer())
        .patch('/hoc-vien/toi')
        .set('Authorization', `Bearer ${token}`)
        .send({ ho_ten: 'Ten Moi' })
        .expect(200);

      const lichSu = await prisma.lich_su_thay_doi_ho_so.findMany({
        where: { hoc_vien_id: hocVien.id, truong: 'ho_ten' },
      });
      expect(lichSu).toHaveLength(1);
      expect(lichSu[0].la_truong_goc_moet).toBe(true);
      expect(lichSu[0].gia_tri_cu).toBe('Ten Cu');
      expect(lichSu[0].gia_tri_moi).toBe('Ten Moi');

      const baoCao = await request(app.getHttpServer())
        .get('/bao-cao/sua-truong-moet')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(
        (baoCao.body as { hoc_vien_id: string }[]).some(
          (r) => r.hoc_vien_id === hocVien.id,
        ),
      ).toBe(true);
    });

    it('xác nhận đủ hồ sơ -> tạo xac_nhan_ho_so, da_xac_nhan=true; sửa tiếp -> hủy xác nhận (xac_nhan_bi_huy=true), da_xac_nhan=false lại', async () => {
      const suf = uniqueSuffix();
      const { hocVien, token } = await taoHocVienMoet({
        donVi: truong1,
        email: `t14-${suf}@test.local`,
      });
      // hồ sơ chỉ thiếu CCCD/noi_sinh/phuong_xa/trinh_do — bổ sung nốt cho đủ.
      await request(app.getHttpServer())
        .patch('/hoc-vien/toi')
        .set('Authorization', `Bearer ${token}`)
        .send({
          so_dinh_danh_ca_nhan: `${Date.now()}`.padStart(12, '1').slice(-12),
          noi_sinh_id: tinh.id,
          phuong_xa_id: xaTruong1.id,
          trinh_do_chuyen_mon: 'dai_hoc',
          doi_tuong: 'giao_vien',
        })
        .expect(200);

      const dayDu = await request(app.getHttpServer())
        .get('/hoc-vien/toi/muc-do-day-du')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(dayDu.body.day_du).toBe(true);

      await request(app.getHttpServer())
        .post('/hoc-vien/toi/xac-nhan')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      const xacNhanRows = await prisma.xac_nhan_ho_so.findMany({
        where: { hoc_vien_id: hocVien.id, con_hieu_luc: true },
      });
      expect(xacNhanRows).toHaveLength(1);

      const trangThai1 = await request(app.getHttpServer())
        .get('/hoc-vien/toi/dot-xac-nhan')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(trangThai1.body.da_xac_nhan).toBe(true);

      const suaTiep = await request(app.getHttpServer())
        .patch('/hoc-vien/toi')
        .set('Authorization', `Bearer ${token}`)
        .send({ chuc_vu: 'Tổ trưởng chuyên môn' })
        .expect(200);
      expect(suaTiep.body.xac_nhan_bi_huy).toBe(true);

      const trangThai2 = await request(app.getHttpServer())
        .get('/hoc-vien/toi/dot-xac-nhan')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(trangThai2.body.da_xac_nhan).toBe(false);
    });
  });

  describe('PATCH /hoc-vien/{id} (quan_tri, T14)', () => {
    it('quan_tri sửa được hồ sơ import_moet dù KHÔNG có đợt nào đang mở', async () => {
      // Đóng đợt hiện tại để mô phỏng "ngoài thời gian đợt".
      await prisma.dot_xac_nhan.update({
        where: { id: dotIds[0] },
        data: { dong_luc: new Date(Date.now() - 1000) },
      });
      try {
        const { hocVien, token } = await taoHocVienMoet({ donVi: truong1 });
        // Học viên tự sửa lúc này phải bị chặn (ngoài giờ đợt).
        await request(app.getHttpServer())
          .patch('/hoc-vien/toi')
          .set('Authorization', `Bearer ${token}`)
          .send({ chuc_vu: 'Nhân viên' })
          .expect(403);

        // quan_tri vẫn sửa được qua PATCH /hoc-vien/{id}.
        const res = await request(app.getHttpServer())
          .patch(`/hoc-vien/${hocVien.id}`)
          .set('Authorization', `Bearer ${tokenQuanTri}`)
          .send({ chuc_vu: 'Nhân viên (quan_tri sửa)' })
          .expect(200);
        expect(res.body.chuc_vu).toBe('Nhân viên (quan_tri sửa)');

        const lichSu = await prisma.lich_su_thay_doi_ho_so.findFirst({
          where: { hoc_vien_id: hocVien.id, truong: 'chuc_vu' },
        });
        expect(lichSu?.vai_tro_nguoi_sua).toBe('quan_tri');
      } finally {
        await prisma.dot_xac_nhan.update({
          where: { id: dotIds[0] },
          data: { dong_luc: new Date(Date.now() + 3600_000) },
        });
      }
    });
  });

  describe('GET /bao-cao/xac-nhan — phạm vi theo đơn vị', () => {
    it('Trường chỉ thấy báo cáo xác nhận của giáo viên trường mình', async () => {
      const { hocVien: hv1 } = await taoHocVienMoet({ donVi: truong1 });
      const { hocVien: hv2 } = await taoHocVienMoet({ donVi: truong2 });

      const res = await request(app.getHttpServer())
        .get(`/bao-cao/xac-nhan?dot_id=${dotIds[0]}`)
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .expect(200);
      const ids = (res.body.rows as { hoc_vien_id: string }[]).map(
        (r) => r.hoc_vien_id,
      );
      expect(ids).toContain(hv1.id);
      expect(ids).not.toContain(hv2.id);
    });

    it('quan_tri thấy cả 2 trường', async () => {
      const res = await request(app.getHttpServer())
        .get(`/bao-cao/xac-nhan?dot_id=${dotIds[0]}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      const donVis = (res.body.rows as { don_vi_cong_tac_ten: string }[]).map(
        (r) => r.don_vi_cong_tac_ten,
      );
      expect(donVis).toEqual(
        expect.arrayContaining([truong1.ten_don_vi, truong2.ten_don_vi]),
      );
    });

    it('truong (không phải quan_tri) gọi GET /bao-cao/sua-truong-moet -> 403', async () => {
      await request(app.getHttpServer())
        .get('/bao-cao/sua-truong-moet')
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .expect(403);
    });
  });
});
