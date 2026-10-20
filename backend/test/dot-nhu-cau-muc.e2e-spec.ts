import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
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

const H = 60 * 60 * 1000;
const D = 24 * H;
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

// ADR 0013: quản trị CRUD đợt nhu cầu mức học (không ghi đè dang_ky_hoc.muc_*).
describe('Đợt nhu cầu mức học - quản trị (e2e)', () => {
  let app: INestApplication;
  let donViFixture: Awaited<ReturnType<typeof taoDonViTest>>;
  let quanTri: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let tenHocVienTk: string;
  let nguoiDungHocVienId: string;
  let tokenQuanTri: string;
  let tokenHocVien: string;
  let khoaId: string;
  let khoaKhacId: string;

  const khoaIds: string[] = [];
  const dotIds: string[] = [];
  const hocVienIds: string[] = [];
  const dangKyIds: string[] = [];

  const http = () => request(app.getHttpServer());
  const auth = (r: request.Test) =>
    r.set('Authorization', `Bearer ${tokenQuanTri}`);

  async function dangNhap(ten_dang_nhap: string, mat_khau: string) {
    const res = await http()
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap, mat_khau })
      .expect(200);
    return res.body.token as string;
  }

  async function taoKhoa() {
    const suf = uniqueSuffix();
    const khoa = await prisma.khoa_boi_duong.create({
      data: {
        ma_khoa: `KHOA-DNC-${suf}`,
        ten_khoa: `Khóa đợt nhu cầu ${suf}`,
        don_vi_dat_hang_id: donViFixture.donVi.id,
        thoi_gian_bat_dau: new Date(),
        thoi_gian_ket_thuc: new Date(Date.now() + 30 * D),
        trang_thai: 'da_duyet',
        created_by: quanTri.nguoiDung.id,
        nguoi_duyet_id: quanTri.nguoiDung.id,
        cap_duyet_thuc_te: 'quan_tri',
        ngay_duyet: new Date(),
      },
    });
    khoaIds.push(khoa.id);
    return khoa.id;
  }

  async function taoDot(
    khoa: string,
    moOff: number,
    dongOff: number,
    ten = 'Đợt test',
  ) {
    const res = await auth(
      http().post(`/khoa-boi-duong/${khoa}/dot-nhu-cau-muc`),
    ).send({
      ten_dot: ten,
      mo_luc: iso(moOff),
      dong_luc: iso(dongOff),
    });
    if (res.body?.id) dotIds.push(res.body.id);
    return res;
  }

  beforeAll(async () => {
    app = await createTestApp();
    donViFixture = await taoDonViTest('dnc');
    quanTri = await taoNguoiDungTest({
      vai_tro: 'quan_tri',
      don_vi_id: donViFixture.donVi.id,
      mat_khau: 'MatKhau123',
    });
    const suf = uniqueSuffix();
    tenHocVienTk = `MOET-DNC-TK-${suf}`;
    const hv = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: tenHocVienTk,
        ho_ten: 'Học Viên Tài Khoản',
        ngay_sinh: 1,
        thang_sinh: 1,
        nam_sinh: 1990,
        don_vi_cong_tac_id: donViFixture.donVi.id,
      },
    });
    hocVienIds.push(hv.id);
    const nd = await prisma.nguoi_dung.create({
      data: {
        ho_ten: hv.ho_ten,
        ten_dang_nhap: tenHocVienTk,
        vai_tro: 'hoc_vien',
        hoc_vien_id: hv.id,
        mat_khau_hash: await bcrypt.hash('MatKhau123', 4),
        phai_doi_mat_khau: false,
      },
    });
    nguoiDungHocVienId = nd.id;
    tokenQuanTri = await dangNhap(quanTri.ten_dang_nhap, 'MatKhau123');
    tokenHocVien = await dangNhap(tenHocVienTk, 'MatKhau123');
    khoaId = await taoKhoa();
    khoaKhacId = await taoKhoa();
  });

  afterAll(async () => {
    // Chỉ xóa theo id đã tạo trong file này.
    await prisma.nhu_cau_muc_hoc_vien.deleteMany({
      where: { dang_ky_hoc_id: { in: dangKyIds } },
    });
    await prisma.dot_nhu_cau_muc.deleteMany({ where: { id: { in: dotIds } } });
    await prisma.dang_ky_hoc.deleteMany({ where: { id: { in: dangKyIds } } });
    await xoaNguoiDungTest(nguoiDungHocVienId);
    await prisma.hoc_vien.deleteMany({ where: { id: { in: hocVienIds } } });
    await prisma.khoa_boi_duong.deleteMany({ where: { id: { in: khoaIds } } });
    await xoaNguoiDungTest(quanTri.nguoiDung.id);
    await xoaDonViTest(
      [donViFixture.donVi.id],
      [donViFixture.diaDanhXa.id, donViFixture.diaDanhTinh.id],
    );
    await prisma.$disconnect();
    await app.close();
  });

  it('tạo đợt hợp lệ -> 201, trang_thai theo giờ, trim tên', async () => {
    const chuaMo = await taoDot(khoaId, 10 * D, 11 * D, '  Đợt chưa mở  ');
    expect(chuaMo.status).toBe(201);
    expect(chuaMo.body).toMatchObject({
      khoa_id: khoaId,
      ten_dot: 'Đợt chưa mở',
      trang_thai: 'chua_mo',
      so_ban_ghi: 0,
    });
    const dangMo = await taoDot(khoaId, -H, H);
    expect(dangMo.status).toBe(201);
    expect(dangMo.body.trang_thai).toBe('dang_mo');
    const daDong = await taoDot(khoaId, -3 * D, -2 * D);
    expect(daDong.status).toBe(201);
    expect(daDong.body.trang_thai).toBe('da_dong');

    const ds = await auth(
      http().get(`/khoa-boi-duong/${khoaId}/dot-nhu-cau-muc`),
    ).expect(200);
    const mo = ds.body.map((d: { mo_luc: string }) =>
      new Date(d.mo_luc).getTime(),
    );
    expect([...mo].sort((a, b) => b - a)).toEqual(mo);
    expect(ds.body.length).toBeGreaterThanOrEqual(3);
  });

  it('dong_luc <= mo_luc -> 400 VALIDATION_ERROR có field dong_luc', async () => {
    const res = await taoDot(khoaId, 20 * D, 20 * D);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields.map((f: { field: string }) => f.field)).toContain(
      'dong_luc',
    );
  });

  it('khóa không tồn tại -> 404', async () => {
    const res = await taoDot(
      '00000000-0000-4000-8000-000000000000',
      30 * D,
      31 * D,
    );
    expect(res.status).toBe(404);
  });

  it('đợt chồng giờ cùng khóa -> 409; khác khóa thì được', async () => {
    const goc = await taoDot(khoaId, 40 * D, 42 * D, 'Đợt gốc');
    expect(goc.status).toBe(201);
    const chong = await taoDot(khoaId, 41 * D, 43 * D);
    expect(chong.status).toBe(409);
    expect(chong.body.error.message).toContain('Đợt gốc');
    const khac = await taoDot(khoaKhacId, 41 * D, 43 * D);
    expect(khac.status).toBe(201);
  });

  it('PATCH dời đợt A chồng lên B -> 409; PATCH chính A không chồng ai -> 200', async () => {
    const a = await taoDot(khoaKhacId, 60 * D, 61 * D, 'A');
    const b = await taoDot(khoaKhacId, 62 * D, 63 * D, 'B');
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    const chong = await auth(
      http().patch(`/dot-nhu-cau-muc/${a.body.id}`),
    ).send({ dong_luc: iso(62.5 * D) });
    expect(chong.status).toBe(409);
    const ok = await auth(http().patch(`/dot-nhu-cau-muc/${a.body.id}`)).send({
      ten_dot: 'A đổi tên',
      dong_luc: iso(61.5 * D),
    });
    expect(ok.status).toBe(200);
    expect(ok.body.ten_dot).toBe('A đổi tên');
    const sai = await auth(http().patch(`/dot-nhu-cau-muc/${a.body.id}`)).send({
      dong_luc: iso(59 * D),
    });
    expect(sai.status).toBe(400);
    expect(sai.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /:id/dong: đợt đang mở -> da_dong; chưa mở hoặc đã đóng -> 400', async () => {
    const dot = await taoDot(khoaKhacId, -H, 5 * H, 'Sắp đóng');
    const res = await auth(http().post(`/dot-nhu-cau-muc/${dot.body.id}/dong`));
    expect(res.status).toBe(201);
    expect(res.body.trang_thai).toBe('da_dong');
    expect(new Date(res.body.dong_luc).getTime()).toBeLessThanOrEqual(
      Date.now(),
    );
    await auth(http().post(`/dot-nhu-cau-muc/${dot.body.id}/dong`)).expect(400);

    const chuaMo = await taoDot(khoaId, 80 * D, 81 * D);
    await auth(
      http().post(`/dot-nhu-cau-muc/${chuaMo.body.id}/dong`),
    ).expect(400);
  });

  it('DELETE đợt rỗng -> 204; đợt có dữ liệu -> 409', async () => {
    const rong = await taoDot(khoaId, 90 * D, 91 * D);
    await auth(http().delete(`/dot-nhu-cau-muc/${rong.body.id}`)).expect(204);
    expect(
      await prisma.dot_nhu_cau_muc.count({ where: { id: rong.body.id } }),
    ).toBe(0);

    const coDuLieu = await taoDot(khoaId, 95 * D, 96 * D);
    const suf = uniqueSuffix();
    const hocVien = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: `MOET-DNC-${suf}`,
        ho_ten: 'Học Viên Đợt Nhu Cầu',
        ngay_sinh: 1,
        thang_sinh: 1,
        nam_sinh: 1990,
        don_vi_cong_tac_id: donViFixture.donVi.id,
      },
    });
    hocVienIds.push(hocVien.id);
    const dangKy = await prisma.dang_ky_hoc.create({
      data: {
        hoc_vien_id: hocVien.id,
        khoa_id: khoaId,
        trang_thai: 'da_duyet',
      },
    });
    dangKyIds.push(dangKy.id);
    await prisma.nhu_cau_muc_hoc_vien.create({
      data: {
        dot_id: coDuLieu.body.id,
        dang_ky_hoc_id: dangKy.id,
        muc_chon: 'co_ban',
        muc_moc: 'thanh_thao',
        nguon_moc: 'muc_chot',
      },
    });
    const res = await auth(
      http().delete(`/dot-nhu-cau-muc/${coDuLieu.body.id}`),
    );
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe(
      'Đợt đã có dữ liệu nhu cầu, không thể xóa',
    );
    const ds = await auth(
      http().get(`/khoa-boi-duong/${khoaId}/dot-nhu-cau-muc`),
    ).expect(200);
    expect(
      ds.body.find((d: { id: string }) => d.id === coDuLieu.body.id).so_ban_ghi,
    ).toBe(1);
  });

  it('vai trò hoc_vien -> 403 ở mọi route', async () => {
    const h = (r: request.Test) =>
      r.set('Authorization', `Bearer ${tokenHocVien}`);
    const fakeId = '00000000-0000-4000-8000-000000000000';
    await h(http().get(`/khoa-boi-duong/${khoaId}/dot-nhu-cau-muc`)).expect(403);
    await h(http().post(`/khoa-boi-duong/${khoaId}/dot-nhu-cau-muc`))
      .send({ ten_dot: 'x', mo_luc: iso(D), dong_luc: iso(2 * D) })
      .expect(403);
    await h(http().patch(`/dot-nhu-cau-muc/${fakeId}`)).send({}).expect(403);
    await h(http().post(`/dot-nhu-cau-muc/${fakeId}/dong`)).expect(403);
    await h(http().delete(`/dot-nhu-cau-muc/${fakeId}`)).expect(403);
  });
});
