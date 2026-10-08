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

function ddmmyyyy(ngay: number, thang: number, nam: number): string {
  return `${String(ngay).padStart(2, '0')}${String(thang).padStart(2, '0')}${nam}`;
}

// Điều chỉnh mức lớp học (2026-10-08): học viên tự chọn mức ≤ mức đánh giá
// đầu vào khi khóa mở công tắc mo_dieu_chinh_muc; Quản trị sửa hộ bỏ qua công tắc.
describe('Điều chỉnh mức lớp học (e2e)', () => {
  let app: INestApplication;
  let donViFixture: Awaited<ReturnType<typeof taoDonViTest>>;
  let quanTri: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let truong: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let tokenQuanTri: string;
  let tokenTruong: string;
  let khoaId: string;
  let maKhoa: string;
  let khoaKhacId: string;

  const hocVienIds: string[] = [];
  const nguoiDungHocVienIds: string[] = [];
  const importIds: string[] = [];

  const http = () => request(app.getHttpServer());

  async function dangNhap(ten_dang_nhap: string, mat_khau: string) {
    const res = await http()
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap, mat_khau })
      .expect(200);
    return res.body.token as string;
  }

  async function taoKhoa(moDieuChinh: boolean) {
    const suf = uniqueSuffix();
    return prisma.khoa_boi_duong.create({
      data: {
        ma_khoa: `KHOA-DCM-${suf}`,
        ten_khoa: `Khóa điều chỉnh mức ${suf}`,
        don_vi_dat_hang_id: donViFixture.donVi.id,
        thoi_gian_bat_dau: new Date(),
        thoi_gian_ket_thuc: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        trang_thai: 'da_duyet',
        created_by: quanTri.nguoiDung.id,
        nguoi_duyet_id: quanTri.nguoiDung.id,
        cap_duyet_thuc_te: 'quan_tri',
        ngay_duyet: new Date(),
        mo_dieu_chinh_muc: moDieuChinh,
      },
    });
  }

  // Học viên MOET + tài khoản + (tùy chọn) đăng ký học ở khóa chính.
  async function taoHocVien(
    mucDauVao: 'co_ban' | 'thanh_thao' | 'nang_cao' | null,
    ghiDanh = true,
  ) {
    const suf = uniqueSuffix();
    const tenDangNhap = `MOET-DCM-${suf}`;
    const hocVien = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: tenDangNhap,
        ho_ten: 'Học Viên Điều Chỉnh Mức',
        ngay_sinh: 12,
        thang_sinh: 7,
        nam_sinh: NAM_HOP_LE,
        don_vi_cong_tac_id: donViFixture.donVi.id,
        so_dien_thoai_lien_he: '0900000001',
      },
    });
    const nguoiDung = await prisma.nguoi_dung.create({
      data: {
        ho_ten: hocVien.ho_ten,
        ten_dang_nhap: tenDangNhap,
        vai_tro: 'hoc_vien',
        hoc_vien_id: hocVien.id,
        mat_khau_hash: await bcrypt.hash(ddmmyyyy(12, 7, NAM_HOP_LE), 4),
        phai_doi_mat_khau: false,
      },
    });
    hocVienIds.push(hocVien.id);
    nguoiDungHocVienIds.push(nguoiDung.id);
    const dangKy = ghiDanh
      ? await prisma.dang_ky_hoc.create({
          data: {
            hoc_vien_id: hocVien.id,
            khoa_id: khoaId,
            trang_thai: 'da_duyet',
            muc_dau_vao: mucDauVao,
          },
        })
      : null;
    const token = await dangNhap(tenDangNhap, ddmmyyyy(12, 7, NAM_HOP_LE));
    return { hocVien, tenDangNhap, token, dangKy };
  }

  const chon = (token: string, muc: string | null, khoa = khoaId) =>
    http()
      .put(`/hoc-vien/toi/khoa-hoc/${khoa}/muc-hoc`)
      .set('Authorization', `Bearer ${token}`)
      .send({ muc });

  const docDangKy = (id: string) =>
    prisma.dang_ky_hoc.findUniqueOrThrow({ where: { id } });

  beforeAll(async () => {
    app = await createTestApp();
    donViFixture = await taoDonViTest('dcm');
    quanTri = await taoNguoiDungTest({
      vai_tro: 'quan_tri',
      don_vi_id: donViFixture.donVi.id,
      mat_khau: 'MatKhau123',
    });
    truong = await taoNguoiDungTest({
      vai_tro: 'truong',
      don_vi_id: donViFixture.donVi.id,
      mat_khau: 'MatKhau123',
    });
    tokenQuanTri = await dangNhap(quanTri.ten_dang_nhap, 'MatKhau123');
    tokenTruong = await dangNhap(truong.ten_dang_nhap, 'MatKhau123');
    const khoa = await taoKhoa(true);
    khoaId = khoa.id;
    maKhoa = khoa.ma_khoa;
    khoaKhacId = (await taoKhoa(false)).id;
  });

  afterAll(async () => {
    await prisma.dang_ky_hoc.deleteMany({
      where: { khoa_id: { in: [khoaId, khoaKhacId] } },
    });
    await prisma.khoa_boi_duong.deleteMany({
      where: { id: { in: [khoaId, khoaKhacId] } },
    });
    await prisma.nhat_ky_import.deleteMany({
      where: { id: { in: importIds } },
    });
    await prisma.nguoi_dung.deleteMany({
      where: { id: { in: nguoiDungHocVienIds } },
    });
    await prisma.hoc_vien.deleteMany({ where: { id: { in: hocVienIds } } });
    await xoaNguoiDungTest(quanTri.nguoiDung.id);
    await xoaNguoiDungTest(truong.nguoiDung.id);
    await xoaDonViTest(
      [donViFixture.donVi.id],
      [donViFixture.diaDanhXa.id, donViFixture.diaDanhTinh.id],
    );
    await prisma.$disconnect();
    await app.close();
  });

  it('happy path: nâng cao -> thành thạo, có hiệu lực ngay, ghi nhật ký, GET khóa học trả field mới', async () => {
    const { hocVien, token, dangKy } = await taoHocVien('nang_cao');
    const truoc = Date.now();
    const res = await chon(token, 'thanh_thao').expect(200);
    expect(res.body).toEqual({
      muc_dau_vao: 'nang_cao',
      muc_hoc_chon: 'thanh_thao',
      muc_hoc: 'thanh_thao',
      muc_hoc_chon_luc: expect.any(String),
    });
    const daLuu = await docDangKy(dangKy!.id);
    expect(daLuu.muc_hoc_chon).toBe('thanh_thao');
    // Thời điểm điều chỉnh được ghi cùng lần cập nhật.
    expect(daLuu.muc_hoc_chon_luc).not.toBeNull();
    expect(daLuu.muc_hoc_chon_luc!.getTime()).toBeGreaterThanOrEqual(
      truoc - 1000,
    );
    expect(new Date(res.body.muc_hoc_chon_luc).getTime()).toBe(
      daLuu.muc_hoc_chon_luc!.getTime(),
    );

    const nhatKy = await prisma.nhat_ky_hoat_dong.findMany({
      where: { hoc_vien_id: hocVien.id, hanh_dong: 'dieu_chinh_muc_hoc' },
    });
    expect(nhatKy).toHaveLength(1);
    expect((nhatKy[0].chi_tiet as { mo_ta: string }).mo_ta).toContain(
      'Nâng cao → Thành thạo',
    );
    expect(nhatKy[0].chi_tiet).toMatchObject({
      khoa_id: khoaId,
      muc_cu: 'nang_cao',
      muc_moi: 'thanh_thao',
    });

    const khoaHoc = await http()
      .get('/hoc-vien/toi/khoa-hoc')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const entry = khoaHoc.body.find(
      (r: { khoa: { id: string } }) => r.khoa.id === khoaId,
    );
    expect(entry.muc_hoc_chon).toBe('thanh_thao');
    expect(entry.muc_hoc_chon_luc).toBe(res.body.muc_hoc_chon_luc);
    expect(entry.khoa.mo_dieu_chinh_muc).toBe(true);

    // Gọi lại cùng mức -> không ghi thêm nhật ký, giữ nguyên thời điểm.
    const lai = await chon(token, 'thanh_thao').expect(200);
    expect(lai.body.muc_hoc_chon_luc).toBe(res.body.muc_hoc_chon_luc);
    expect((await docDangKy(dangKy!.id)).muc_hoc_chon_luc!.getTime()).toBe(
      daLuu.muc_hoc_chon_luc!.getTime(),
    );
    expect(
      await prisma.nhat_ky_hoat_dong.count({
        where: { hoc_vien_id: hocVien.id, hanh_dong: 'dieu_chinh_muc_hoc' },
      }),
    ).toBe(1);
  });

  it('chọn bằng mức đánh giá -> lưu NULL', async () => {
    const { token, dangKy } = await taoHocVien('thanh_thao');
    const res = await chon(token, 'thanh_thao').expect(200);
    expect(res.body).toEqual({
      muc_dau_vao: 'thanh_thao',
      muc_hoc_chon: null,
      muc_hoc: 'thanh_thao',
      muc_hoc_chon_luc: null,
    });
    const sau = await docDangKy(dangKy!.id);
    expect(sau.muc_hoc_chon).toBeNull();
    // Không đổi gì -> không ghi thời điểm điều chỉnh.
    expect(sau.muc_hoc_chon_luc).toBeNull();
  });

  it('chọn null -> quay về học theo mức đánh giá', async () => {
    const { token, dangKy } = await taoHocVien('nang_cao');
    await chon(token, 'co_ban').expect(200);
    const res = await chon(token, null).expect(200);
    expect(res.body).toEqual({
      muc_dau_vao: 'nang_cao',
      muc_hoc_chon: null,
      muc_hoc: 'nang_cao',
      muc_hoc_chon_luc: expect.any(String),
    });
    expect((await docDangKy(dangKy!.id)).muc_hoc_chon).toBeNull();
  });

  it('chọn cao hơn mức đánh giá -> 400 VALIDATION_ERROR field muc', async () => {
    const { token, dangKy } = await taoHocVien('co_ban');
    const res = await chon(token, 'thanh_thao').expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields[0].field).toBe('muc');
    expect((await docDangKy(dangKy!.id)).muc_hoc_chon).toBeNull();
  });

  it('giá trị muc không hợp lệ -> 400', async () => {
    const { token } = await taoHocVien('nang_cao');
    await chon(token, 'sieu_cap').expect(400);
  });

  it('chưa có kết quả đánh giá đầu vào -> 400', async () => {
    const { token } = await taoHocVien(null);
    const res = await chon(token, 'co_ban').expect(400);
    expect(res.body.error.fields[0]).toEqual({
      field: 'muc',
      message: 'Chưa có kết quả đánh giá đầu vào',
    });
  });

  it('khóa chưa mở điều chỉnh -> 403 DIEU_CHINH_MUC_DONG', async () => {
    const { hocVien, token } = await taoHocVien(null, false);
    await prisma.dang_ky_hoc.create({
      data: {
        hoc_vien_id: hocVien.id,
        khoa_id: khoaKhacId,
        trang_thai: 'da_duyet',
        muc_dau_vao: 'nang_cao',
      },
    });
    const res = await chon(token, 'co_ban', khoaKhacId).expect(403);
    expect(res.body.error.code).toBe('DIEU_CHINH_MUC_DONG');
  });

  it('học viên không có đăng ký ở khóa -> 404', async () => {
    const { token } = await taoHocVien(null, false);
    await chon(token, 'co_ban').expect(404);
  });

  it('vai trò khác gọi endpoint học viên -> 403', async () => {
    await chon(tokenTruong, 'co_ban').expect(403);
    await chon(tokenQuanTri, 'co_ban').expect(403);
  });

  it('quản trị sửa hộ khi khóa đóng -> OK, vẫn chặn mức cao hơn; vai trò khác -> 403', async () => {
    const { hocVien } = await taoHocVien(null, false);
    const dangKy = await prisma.dang_ky_hoc.create({
      data: {
        hoc_vien_id: hocVien.id,
        khoa_id: khoaKhacId,
        trang_thai: 'da_duyet',
        muc_dau_vao: 'thanh_thao',
      },
    });
    const sua = (token: string, muc: string | null) =>
      http()
        .patch(`/dang-ky-hoc/${dangKy.id}/muc-hoc`)
        .set('Authorization', `Bearer ${token}`)
        .send({ muc });

    const ok = await sua(tokenQuanTri, 'co_ban').expect(200);
    expect(ok.body.muc_hoc).toBe('co_ban');
    expect((await docDangKy(dangKy.id)).muc_hoc_chon).toBe('co_ban');

    await sua(tokenQuanTri, 'nang_cao').expect(400);
    await sua(tokenTruong, 'co_ban').expect(403);
    expect((await docDangKy(dangKy.id)).muc_hoc_chon).toBe('co_ban');
  });

  it('import lại ket_qua_danh_gia hạ mức xuống ≤ lựa chọn -> muc_hoc_chon reset null; vẫn cao hơn thì giữ', async () => {
    const { tenDangNhap, token, dangKy } = await taoHocVien('nang_cao');
    await chon(token, 'thanh_thao').expect(200);

    const importMuc = async (muc: string) => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('data');
      sheet.addRow([
        'so_dinh_danh_ca_nhan',
        'ma_dinh_danh_moet',
        'ma_khoa',
        'loai',
        'muc',
      ]);
      sheet.addRow([undefined, tenDangNhap, maKhoa, 'dau_vao', muc]);
      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
      const res = await http()
        .post('/import/ket_qua_danh_gia')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach('file', buffer, 'kqdg-dcm.xlsx')
        .expect(201);
      importIds.push(res.body.import_id);
      await http()
        .post(`/import/${res.body.import_id}/xac-nhan`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(201);
    };

    // Mức mới vẫn cao hơn lựa chọn -> giữ lựa chọn.
    await importMuc('nang_cao');
    const giu = await docDangKy(dangKy!.id);
    expect(giu.muc_hoc_chon).toBe('thanh_thao');
    expect(giu.muc_hoc_chon_luc).not.toBeNull();

    // Hạ đánh giá xuống bằng lựa chọn -> reset.
    await importMuc('thanh_thao');
    const sau = await docDangKy(dangKy!.id);
    expect(sau.muc_dau_vao).toBe('thanh_thao');
    expect(sau.muc_hoc_chon).toBeNull();
    expect(sau.muc_hoc_chon_luc).toBeNull();
  });

  it('PATCH khóa bật/tắt mo_dieu_chinh_muc', async () => {
    const tat = await http()
      .patch(`/khoa-boi-duong/${khoaId}`)
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .send({ mo_dieu_chinh_muc: false })
      .expect(200);
    expect(tat.body.mo_dieu_chinh_muc).toBe(false);

    const chiTiet = await http()
      .get(`/khoa-boi-duong/${khoaId}`)
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .expect(200);
    expect(chiTiet.body.mo_dieu_chinh_muc).toBe(false);

    const { token } = await taoHocVien('nang_cao');
    const res = await chon(token, 'co_ban').expect(403);
    expect(res.body.error.code).toBe('DIEU_CHINH_MUC_DONG');

    const bat = await http()
      .patch(`/khoa-boi-duong/${khoaId}`)
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .send({ mo_dieu_chinh_muc: true })
      .expect(200);
    expect(bat.body.mo_dieu_chinh_muc).toBe(true);
    await chon(token, 'co_ban').expect(200);

    await http()
      .patch(`/khoa-boi-duong/${khoaId}`)
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .send({ mo_dieu_chinh_muc: 'co' })
      .expect(400);
  });
});
