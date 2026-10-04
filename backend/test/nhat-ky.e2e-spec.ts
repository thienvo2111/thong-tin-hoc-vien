import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoDonViTest,
  taoNguoiDungTest,
  uniqueSuffix,
  xoaDonViTest,
  xoaNguoiDungTest,
} from './utils/test-data';

const MAT_KHAU_HV = 'MatKhauHv1';
const MAT_KHAU_QT = 'MatKhauQt1';

// Nhật ký hoạt động (2026-10-04): chạy thật qua HTTP để kiểm tra phần nối mà unit test không
// thấy được — middleware lấy IP/thiết bị, trigger DB chặn sửa/xóa, phân quyền API dòng thời gian.
describe('Nhật ký hoạt động (e2e)', () => {
  let app: INestApplication;
  let donViFixture: Awaited<ReturnType<typeof taoDonViTest>>;
  let quanTri: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let truong: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let hocVienId: string;
  let nguoiDungHvId: string;
  let tenDangNhapHv: string;

  const dangNhap = (ten_dang_nhap: string, mat_khau: string) =>
    request(app.getHttpServer())
      .post('/auth/dang-nhap')
      .set('User-Agent', 'E2E-Zalo-Browser')
      .send({ ten_dang_nhap, mat_khau });

  const xemNhatKy = (token: string) =>
    request(app.getHttpServer())
      .get(`/hoc-vien/${hocVienId}/nhat-ky`)
      .set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    donViFixture = await taoDonViTest('nhatky');
    quanTri = await taoNguoiDungTest({
      vai_tro: 'quan_tri',
      don_vi_id: donViFixture.donVi.id,
      mat_khau: MAT_KHAU_QT,
    });
    truong = await taoNguoiDungTest({
      vai_tro: 'truong',
      don_vi_id: donViFixture.donVi.id,
      mat_khau: MAT_KHAU_QT,
    });

    const suf = uniqueSuffix();
    tenDangNhapHv = `MOET-NK-${suf}`;
    const hocVien = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: tenDangNhapHv,
        ho_ten: 'Học Viên Nhật Ký',
        ngay_sinh: 1,
        thang_sinh: 1,
        nam_sinh: 1990,
        don_vi_cong_tac_id: donViFixture.donVi.id,
      },
    });
    hocVienId = hocVien.id;
    const nd = await prisma.nguoi_dung.create({
      data: {
        ho_ten: hocVien.ho_ten,
        ten_dang_nhap: tenDangNhapHv,
        vai_tro: 'hoc_vien',
        hoc_vien_id: hocVien.id,
        mat_khau_hash: await bcrypt.hash(MAT_KHAU_HV, 4),
        phai_doi_mat_khau: false,
      },
    });
    nguoiDungHvId = nd.id;
  });

  afterAll(async () => {
    // nhat_ky_hoat_dong không FK và không xóa được (trigger) — để lại dòng test là chấp nhận được.
    await prisma.nguoi_dung.deleteMany({ where: { id: nguoiDungHvId } });
    await prisma.hoc_vien.deleteMany({ where: { id: hocVienId } });
    await xoaNguoiDungTest(quanTri.nguoiDung.id);
    await xoaNguoiDungTest(truong.nguoiDung.id);
    await xoaDonViTest(
      [donViFixture.donVi.id],
      [donViFixture.diaDanhXa.id, donViFixture.diaDanhTinh.id],
    );
    await prisma.$disconnect();
    await app.close();
  });

  it('đăng nhập sai rồi đúng -> quản trị xem được cả 2 lần, kèm IP và thiết bị', async () => {
    await dangNhap(tenDangNhapHv, 'sai-mat-khau').expect(401);
    const resHv = await dangNhap(tenDangNhapHv, MAT_KHAU_HV).expect(200);
    expect(resHv.body.token).toBeDefined();
    const tokenQt = (
      await dangNhap(quanTri.ten_dang_nhap, MAT_KHAU_QT).expect(200)
    ).body.token;

    const res = await xemNhatKy(tokenQt).expect(200);
    expect(res.body.hoc_vien).toEqual({
      id: hocVienId,
      ho_ten: 'Học Viên Nhật Ký',
    });
    const tieuDe = res.body.muc.map((m: { tieu_de: string }) => m.tieu_de);
    expect(tieuDe).toEqual(['Đăng nhập thành công', 'Đăng nhập sai mật khẩu']);

    const thanhCong = res.body.muc[0];
    expect(thanhCong.thiet_bi).toBe('E2E-Zalo-Browser');
    expect(thanhCong.ip).toBeTruthy();
    expect(thanhCong.nguoi_thuc_hien).toBe('Học Viên Nhật Ký (học viên)');
    expect(res.body.muc[1].noi_dung).toBe('Lần sai thứ 1 liên tiếp');
  });

  it('tài khoản trường / học viên không xem được nhật ký (403)', async () => {
    const tokenTruong = (
      await dangNhap(truong.ten_dang_nhap, MAT_KHAU_QT).expect(200)
    ).body.token;
    await xemNhatKy(tokenTruong).expect(403);
    const tokenHv = (await dangNhap(tenDangNhapHv, MAT_KHAU_HV).expect(200))
      .body.token;
    await xemNhatKy(tokenHv).expect(403);
  });

  it('học viên không tồn tại -> 404', async () => {
    const tokenQt = (
      await dangNhap(quanTri.ten_dang_nhap, MAT_KHAU_QT).expect(200)
    ).body.token;
    await request(app.getHttpServer())
      .get('/hoc-vien/00000000-0000-4000-8000-000000000000/nhat-ky')
      .set('Authorization', `Bearer ${tokenQt}`)
      .expect(404);
  });

  it('DB chặn sửa và xóa nhật ký (chỉ cho phép thêm)', async () => {
    await expect(
      prisma.nhat_ky_hoat_dong.updateMany({
        where: { hoc_vien_id: hocVienId },
        data: { hanh_dong: 'gia_mao' },
      }),
    ).rejects.toThrow(/chỉ cho phép thêm/);
    await expect(
      prisma.nhat_ky_hoat_dong.deleteMany({
        where: { hoc_vien_id: hocVienId },
      }),
    ).rejects.toThrow(/chỉ cho phép thêm/);
    expect(
      await prisma.nhat_ky_hoat_dong.count({
        where: { hoc_vien_id: hocVienId },
      }),
    ).toBeGreaterThan(0);
  });

  // Đặt cuối file: đổi mật khẩu học viên. Kiểm tra interceptor gắn đúng người đang đăng nhập
  // (sự kiện không truyền nguoi_dung tường minh như lúc đăng nhập).
  it('đổi mật khẩu -> ghi người thực hiện là chính học viên đang đăng nhập', async () => {
    const tokenHv = (await dangNhap(tenDangNhapHv, MAT_KHAU_HV).expect(200))
      .body.token;
    await request(app.getHttpServer())
      .post('/auth/doi-mat-khau')
      .set('Authorization', `Bearer ${tokenHv}`)
      .send({ mat_khau_cu: MAT_KHAU_HV, mat_khau_moi: 'MatKhauMoi2026' })
      .expect(200);

    const tokenQt = (
      await dangNhap(quanTri.ten_dang_nhap, MAT_KHAU_QT).expect(200)
    ).body.token;
    const res = await xemNhatKy(tokenQt).expect(200);
    expect(res.body.muc[0]).toMatchObject({
      tieu_de: 'Đổi mật khẩu',
      nguoi_thuc_hien: 'Học Viên Nhật Ký (học viên)',
    });
    expect(res.body.muc[0].ip).toBeTruthy();
  });
});
