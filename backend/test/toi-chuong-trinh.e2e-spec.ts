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

// Issue #70 / ADR 0015 P1: GET /cong-don-vi/toi/chuong-trinh → { nls } — đơn vị có học viên NLS
// trong phạm vi (trường: chính nó; Phòng/Sở: cả cây con) thì nls=true. Dữ liệu đều BỊA.
describe('Chương trình của tôi - Cổng đơn vị (e2e)', () => {
  let app: INestApplication;
  let fixture: Awaited<ReturnType<typeof taoDonViTest>>;
  const nguoiDungIds: string[] = [];
  const donViIds: string[] = [];
  const hocVienIds: string[] = [];
  const token = {} as Record<
    | 'quanTri'
    | 'truongCoHv'
    | 'truongChiHsg'
    | 'soCoHv'
    | 'phongKhongHv'
    | 'hocVien',
    string
  >;

  const MAT_KHAU = 'MatKhau123';
  const URL = '/cong-don-vi/toi/chuong-trinh';
  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function dangNhap(ten_dang_nhap: string) {
    const res = await http()
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap, mat_khau: MAT_KHAU })
      .expect(200);
    return res.body.token as string;
  }

  async function taoTaiKhoan(
    vai_tro: 'quan_tri' | 'truong' | 'so_gddt' | 'phong_vhxh',
    don_vi_id: string,
  ) {
    const u = await taoNguoiDungTest({
      vai_tro,
      don_vi_id,
      mat_khau: MAT_KHAU,
    });
    nguoiDungIds.push(u.nguoiDung.id);
    return dangNhap(u.ten_dang_nhap);
  }

  async function taoDonVi(
    loai: 'so_gddt' | 'phong_vhxh' | 'truong',
    cha: string | null,
  ) {
    const dv = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `TCT-${uniqueSuffix()}`,
        ten_don_vi: `Đơn vị bịa ${loai} ${uniqueSuffix()}`,
        loai_don_vi: loai,
        dia_ban_id: fixture.diaDanhXa.id,
        don_vi_cha_id: cha,
        trang_thai: 'active',
      },
    });
    donViIds.push(dv.id);
    return dv.id;
  }

  async function taoHocVien(donViId: string) {
    const hv = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: `MOET-TCT-${uniqueSuffix()}`,
        ho_ten: 'Học Viên Bịa Chương Trình',
        ngay_sinh: 1,
        thang_sinh: 2,
        nam_sinh: 1990,
        trinh_do_chuyen_mon: 'dai_hoc',
        doi_tuong: 'giao_vien',
        don_vi_cong_tac_id: donViId,
      },
    });
    hocVienIds.push(hv.id);
    return hv;
  }

  beforeAll(async () => {
    app = await createTestApp();
    fixture = await taoDonViTest('tct');

    // Sở có 1 trường con có học viên NLS (cháu, không phải con trực tiếp của tài khoản trường).
    const so = await taoDonVi('so_gddt', null);
    const truongCoHv = await taoDonVi('truong', so);
    // Trường chỉ HSG: không có hoc_vien nào.
    const truongChiHsg = await taoDonVi('truong', null);
    // Phòng có trường con nhưng không trường nào có học viên.
    const phong = await taoDonVi('phong_vhxh', null);
    await taoDonVi('truong', phong);

    const hv = await taoHocVien(truongCoHv);

    token.quanTri = await taoTaiKhoan('quan_tri', fixture.donVi.id);
    token.truongCoHv = await taoTaiKhoan('truong', truongCoHv);
    token.truongChiHsg = await taoTaiKhoan('truong', truongChiHsg);
    token.soCoHv = await taoTaiKhoan('so_gddt', so);
    token.phongKhongHv = await taoTaiKhoan('phong_vhxh', phong);

    const tenDn = hv.ma_dinh_danh_moet as string;
    const u = await prisma.nguoi_dung.create({
      data: {
        ho_ten: hv.ho_ten,
        ten_dang_nhap: tenDn,
        vai_tro: 'hoc_vien',
        hoc_vien_id: hv.id,
        mat_khau_hash: await bcrypt.hash(MAT_KHAU, 4),
        phai_doi_mat_khau: false,
      },
    });
    nguoiDungIds.push(u.id);
    token.hocVien = await dangNhap(tenDn);
  });

  afterAll(async () => {
    // Chỉ xóa đúng id file này tạo; nhat_ky_hoat_dong (đăng nhập) chỉ cho thêm — để nguyên.
    for (const id of nguoiDungIds) await xoaNguoiDungTest(id);
    for (const id of hocVienIds) {
      await prisma.hoc_vien.deleteMany({ where: { id } });
    }
    for (const id of [...donViIds].reverse()) {
      await prisma.don_vi_cong_tac.deleteMany({ where: { id } });
    }
    if (fixture) {
      await xoaDonViTest(
        [fixture.donVi.id],
        [fixture.diaDanhXa.id, fixture.diaDanhTinh.id],
      );
    }
    await prisma.$disconnect();
    await app.close();
  });

  it('trường có học viên NLS → { nls: true }', async () => {
    const res = await http().get(URL).set(auth(token.truongCoHv)).expect(200);
    expect(res.body).toEqual({ nls: true });
  });

  it('trường chỉ HSG (không có học viên) → { nls: false }', async () => {
    const res = await http().get(URL).set(auth(token.truongChiHsg)).expect(200);
    expect(res.body).toEqual({ nls: false });
  });

  it('Sở có học viên ở trường trong cây → { nls: true }', async () => {
    const res = await http().get(URL).set(auth(token.soCoHv)).expect(200);
    expect(res.body).toEqual({ nls: true });
  });

  it('Phòng không có học viên trong cây → { nls: false }', async () => {
    const res = await http().get(URL).set(auth(token.phongKhongHv)).expect(200);
    expect(res.body).toEqual({ nls: false });
  });

  it('quan_tri → 403', async () => {
    await http().get(URL).set(auth(token.quanTri)).expect(403);
  });

  it('hoc_vien → 403', async () => {
    await http().get(URL).set(auth(token.hocVien)).expect(403);
  });

  it('không có token → 401', async () => {
    await http().get(URL).expect(401);
  });
});
