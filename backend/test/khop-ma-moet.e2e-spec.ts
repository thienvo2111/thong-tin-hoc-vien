import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import * as ExcelJS from 'exceljs';
import { randomInt } from 'crypto';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoDonViTest,
  taoNguoiDungTest,
  xoaDonViTest,
  xoaNguoiDungTest,
} from './utils/test-data';

const NAM = new Date().getUTCFullYear() - 30;
const MAT_KHAU = `1506${NAM}`;
const API_KEY = 'khoa-e2e-khop-ma-moet';

// Chuỗi chữ số ngẫu nhiên — mã/SĐT test dùng độ dài/đầu số không có trong dữ
// liệu thật (mã MOET thật <= 13 số; đầu số 0199 không còn cấp) để không đụng
// hồ sơ có sẵn trong DB dev, kể cả khi so khớp bỏ số 0 đầu.
function chuSo(n: number): string {
  return Array.from({ length: n }, () => randomInt(10)).join('');
}
function maTest(): string {
  return `8${chuSo(14)}`; // 15 số, không số 0 đầu
}
function sdtTest(): string {
  return `0199${chuSo(6)}`;
}

// Spec 2026-10-09 (docs/superpowers/specs/2026-10-09-khop-ma-moet-dang-nhap-sdt-design.md):
// khớp mã MOET bỏ số 0 đầu, đăng nhập bằng SĐT, quản trị sửa mã MOET.
describe('Khớp mã MOET bỏ số 0 đầu + đăng nhập SĐT + sửa mã MOET (e2e)', () => {
  let app: INestApplication;
  let donVi: Awaited<ReturnType<typeof taoDonViTest>>;
  let quanTri: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let truong: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let tokenQuanTri: string;
  const envGoc = { ...process.env };

  const hocVienIds: string[] = [];
  const nguoiDungIds: string[] = [];

  async function taoHocVien(o: {
    ma?: string | null;
    sdt?: string | null;
    tenDangNhap?: string;
    cccd?: string;
    email?: string;
    coTaiKhoan?: boolean;
  }) {
    const hv = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: o.ma ?? null,
        so_dinh_danh_ca_nhan: o.cccd ?? `9${chuSo(11)}`,
        ho_ten: 'Học Viên Khớp Mã',
        ngay_sinh: 15,
        thang_sinh: 6,
        nam_sinh: NAM,
        don_vi_cong_tac_id: donVi.donVi.id,
        so_dien_thoai_lien_he: o.sdt ?? null,
        email_lien_he: o.email ?? null,
        email_da_xac_minh: !!o.email,
      },
    });
    hocVienIds.push(hv.id);
    let nguoiDung: { id: string; ten_dang_nhap: string } | null = null;
    if (o.coTaiKhoan !== false) {
      nguoiDung = await prisma.nguoi_dung.create({
        data: {
          ho_ten: hv.ho_ten,
          ten_dang_nhap: o.tenDangNhap ?? o.ma ?? hv.so_dinh_danh_ca_nhan!,
          vai_tro: 'hoc_vien',
          hoc_vien_id: hv.id,
          mat_khau_hash: await bcrypt.hash(MAT_KHAU, 4),
          phai_doi_mat_khau: false,
        },
      });
      nguoiDungIds.push(nguoiDung.id);
    }
    return { hv, nguoiDung };
  }

  function dangNhap(body: Record<string, unknown>) {
    return request(app.getHttpServer()).post('/auth/dang-nhap').send(body);
  }

  function suaMa(
    id: string,
    body: Record<string, unknown>,
    token = tokenQuanTri,
  ) {
    return request(app.getHttpServer())
      .patch(`/hoc-vien/${id}/ma-dinh-danh-moet`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  }

  beforeAll(async () => {
    process.env.SSO_KHAO_SAT_API_KEY = API_KEY;
    app = await createTestApp({ raiseThrottlerLimit: true });
    donVi = await taoDonViTest('khopma');
    quanTri = await taoNguoiDungTest({
      vai_tro: 'quan_tri',
      don_vi_id: donVi.donVi.id,
      mat_khau: 'MatKhau123',
    });
    truong = await taoNguoiDungTest({
      vai_tro: 'truong',
      don_vi_id: donVi.donVi.id,
      mat_khau: 'MatKhau123',
    });
    tokenQuanTri = (
      await dangNhap({
        ten_dang_nhap: quanTri.ten_dang_nhap,
        mat_khau: 'MatKhau123',
      }).expect(200)
    ).body.token;
  });

  afterAll(async () => {
    process.env = { ...envGoc };
    const where = { hoc_vien_id: { in: hocVienIds } };
    await prisma.ma_sso_mot_lan.deleteMany({ where });
    await prisma.token_xac_thuc.deleteMany({ where });
    await prisma.hang_doi_email.deleteMany({ where });
    await prisma.nhat_ky_thong_bao.deleteMany({ where });
    await prisma.lich_su_thay_doi_ho_so.deleteMany({ where });
    // nhat_ky_hoat_dong chỉ cho thêm (trigger chặn xóa), không FK — để lại.
    await prisma.token_thu_hoi.deleteMany({
      where: { nguoi_dung_id: { in: nguoiDungIds } },
    });
    await prisma.nguoi_dung.deleteMany({ where: { id: { in: nguoiDungIds } } });
    await prisma.hoc_vien.deleteMany({ where: { id: { in: hocVienIds } } });
    await prisma.nhat_ky_import.deleteMany({
      where: { nguoi_import_id: quanTri.nguoiDung.id },
    });
    await xoaNguoiDungTest(quanTri.nguoiDung.id);
    await xoaNguoiDungTest(truong.nguoiDung.id);
    await xoaDonViTest(
      [donVi.donVi.id],
      [donVi.diaDanhXa.id, donVi.diaDanhTinh.id],
    );
    await prisma.$disconnect();
    await app.close();
  });

  describe('Đăng nhập chế độ mã (mặc định)', () => {
    it('có/không số 0 đầu, có khoảng trắng -> đều đăng nhập được (client cũ không gửi kieu_dang_nhap)', async () => {
      const goc = maTest();
      const { nguoiDung } = await taoHocVien({ ma: `0${goc}` });
      for (const nhap of [
        `0${goc}`,
        goc,
        ` ${goc.slice(0, 5)} ${goc.slice(5)} `,
      ]) {
        const res = await dangNhap({
          ten_dang_nhap: nhap,
          mat_khau: MAT_KHAU,
        }).expect(200);
        expect(res.body.nguoi_dung.id).toBe(nguoiDung!.id);
      }
      await dangNhap({
        ten_dang_nhap: goc,
        mat_khau: MAT_KHAU,
        kieu_dang_nhap: 'ma',
      }).expect(200);
    });

    it('mã 12 số mất số 0 đầu -> đăng nhập được', async () => {
      const goc = `9${chuSo(10)}`;
      await taoHocVien({ ma: `0${goc}` });
      await dangNhap({ ten_dang_nhap: goc, mat_khau: MAT_KHAU }).expect(200);
    });

    it('mã toàn số 0 -> vẫn khớp chính xác; chuỗi toàn số 0 khác độ dài -> 401 (không khớp gì)', async () => {
      const toanKhong = '0'.repeat(17);
      await taoHocVien({ ma: toanKhong });
      await dangNhap({ ten_dang_nhap: toanKhong, mat_khau: MAT_KHAU }).expect(
        200,
      );
      await dangNhap({
        ten_dang_nhap: '0'.repeat(16),
        mat_khau: MAT_KHAU,
      }).expect(401);
      await dangNhap({ ten_dang_nhap: '0', mat_khau: MAT_KHAU }).expect(401);
    });

    it('tài khoản có tên đăng nhập = CCCD vẫn đăng nhập bằng mã MOET (có/không số 0)', async () => {
      const goc = maTest();
      const cccd = `9${chuSo(11)}`;
      const { nguoiDung } = await taoHocVien({
        ma: `0${goc}`,
        cccd,
        tenDangNhap: cccd,
      });
      for (const nhap of [`0${goc}`, goc, cccd]) {
        const res = await dangNhap({
          ten_dang_nhap: nhap,
          mat_khau: MAT_KHAU,
        }).expect(200);
        expect(res.body.nguoi_dung.id).toBe(nguoiDung!.id);
      }
    });

    it('sai mật khẩu khi khớp bỏ số 0 -> 401 chung, đếm sai trên tài khoản tìm được', async () => {
      const goc = maTest();
      const { nguoiDung } = await taoHocVien({ ma: `0${goc}` });
      const res = await dangNhap({
        ten_dang_nhap: goc,
        mat_khau: 'sai',
      }).expect(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      const nd = await prisma.nguoi_dung.findUniqueOrThrow({
        where: { id: nguoiDung!.id },
      });
      expect(nd.so_lan_dang_nhap_sai).toBe(1);
    });

    it('tài khoản đơn vị / quản trị không đổi hành vi', async () => {
      await dangNhap({
        ten_dang_nhap: truong.ten_dang_nhap.toUpperCase(),
        mat_khau: 'MatKhau123',
      }).expect(200);
      await dangNhap({
        ten_dang_nhap: quanTri.ten_dang_nhap,
        mat_khau: 'MatKhau123',
        kieu_dang_nhap: 'ma',
      }).expect(200);
      // Quản trị vẫn khớp chính xác (không phân biệt hoa thường chỉ áp tài khoản đơn vị).
      await dangNhap({
        ten_dang_nhap: quanTri.ten_dang_nhap.toUpperCase(),
        mat_khau: 'MatKhau123',
      }).expect(401);
      // Chế độ SĐT không tìm theo tên đăng nhập.
      await dangNhap({
        ten_dang_nhap: truong.ten_dang_nhap,
        mat_khau: 'MatKhau123',
        kieu_dang_nhap: 'sdt',
      }).expect(401);
    });

    it('kieu_dang_nhap không hợp lệ -> 400', async () => {
      await dangNhap({
        ten_dang_nhap: 'x',
        mat_khau: 'y',
        kieu_dang_nhap: 'cccd',
      }).expect(400);
    });
  });

  describe('Đăng nhập chế độ SĐT', () => {
    it('SĐT dạng 0…, +84…, 84…, có dấu cách/chấm, thiếu số 0 -> đều đăng nhập được', async () => {
      const sdt = sdtTest();
      const { nguoiDung } = await taoHocVien({
        ma: maTest(),
        sdt: `${sdt.slice(0, 4)}.${sdt.slice(4, 7)}.${sdt.slice(7)}`,
      });
      const duoi = sdt.slice(1);
      for (const nhap of [
        sdt,
        `+84${duoi}`,
        `84${duoi}`,
        `${sdt.slice(0, 4)} ${sdt.slice(4, 7)}.${sdt.slice(7)}`,
        duoi,
      ]) {
        const res = await dangNhap({
          ten_dang_nhap: nhap,
          mat_khau: MAT_KHAU,
          kieu_dang_nhap: 'sdt',
        }).expect(200);
        expect(res.body.nguoi_dung.id).toBe(nguoiDung!.id);
      }
    });

    it('SĐT lưu dạng 84… vẫn khớp khi nhập 0…', async () => {
      const sdt = sdtTest();
      await taoHocVien({ ma: maTest(), sdt: `+84 ${sdt.slice(1)}` });
      await dangNhap({
        ten_dang_nhap: sdt,
        mat_khau: MAT_KHAU,
        kieu_dang_nhap: 'sdt',
      }).expect(200);
    });

    it('SĐT dùng chung 2 học viên -> 401 chung (không đăng nhập được bằng SĐT)', async () => {
      const sdt = sdtTest();
      await taoHocVien({ ma: maTest(), sdt });
      await taoHocVien({ ma: maTest(), sdt });
      const res = await dangNhap({
        ten_dang_nhap: sdt,
        mat_khau: MAT_KHAU,
        kieu_dang_nhap: 'sdt',
      }).expect(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('SĐT không tồn tại -> 401', async () => {
      await dangNhap({
        ten_dang_nhap: sdtTest(),
        mat_khau: MAT_KHAU,
        kieu_dang_nhap: 'sdt',
      }).expect(401);
    });

    it('SĐT trùng tên đăng nhập của tài khoản không phải học viên -> 401', async () => {
      const sdt = sdtTest();
      const nd = await prisma.nguoi_dung.create({
        data: {
          ho_ten: 'Hỗ trợ SĐT',
          ten_dang_nhap: sdt,
          email: `khopma-ht-${sdt}@test.local`,
          vai_tro: 'ho_tro_hoc_vien',
          mat_khau_hash: await bcrypt.hash(MAT_KHAU, 4),
          phai_doi_mat_khau: false,
        },
      });
      nguoiDungIds.push(nd.id);
      await dangNhap({
        ten_dang_nhap: sdt,
        mat_khau: MAT_KHAU,
        kieu_dang_nhap: 'sdt',
      }).expect(401);
    });

    it('khóa sau 5 lần sai ở chế độ SĐT -> 423 dù mật khẩu đúng', async () => {
      const sdt = sdtTest();
      const { nguoiDung } = await taoHocVien({ ma: maTest(), sdt });
      await prisma.nguoi_dung.update({
        where: { id: nguoiDung!.id },
        data: { so_lan_dang_nhap_sai: 4 },
      });
      await dangNhap({
        ten_dang_nhap: sdt,
        mat_khau: 'sai',
        kieu_dang_nhap: 'sdt',
      }).expect(401);
      const res = await dangNhap({
        ten_dang_nhap: sdt,
        mat_khau: MAT_KHAU,
        kieu_dang_nhap: 'sdt',
      }).expect(423);
      expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
    });
  });

  describe('Quên mật khẩu 2 chế độ', () => {
    async function soTokenDatLai(hocVienId: string) {
      return prisma.token_xac_thuc.count({
        where: { hoc_vien_id: hocVienId, loai: 'dat_lai_mat_khau' },
      });
    }

    it('chế độ mã: mã thiếu số 0 -> tạo token đặt lại cho đúng học viên', async () => {
      const goc = maTest();
      const { hv } = await taoHocVien({
        ma: `0${goc}`,
        email: `khopma-${goc}@test.local`,
      });
      const res = await request(app.getHttpServer())
        .post('/auth/quen-mat-khau')
        .send({ ten_dang_nhap: goc })
        .expect(200);
      expect(res.body).toEqual({ da_gui: true });
      expect(await soTokenDatLai(hv.id)).toBe(1);
    });

    it('chế độ sdt: SĐT đúng 1 học viên -> tạo token; SĐT dùng chung -> vẫn da_gui nhưng không tạo', async () => {
      const sdt = sdtTest();
      const { hv } = await taoHocVien({
        ma: maTest(),
        sdt,
        email: `khopma-${sdt}@test.local`,
      });
      await request(app.getHttpServer())
        .post('/auth/quen-mat-khau')
        .send({ ten_dang_nhap: `+84${sdt.slice(1)}`, kieu_dang_nhap: 'sdt' })
        .expect(200);
      expect(await soTokenDatLai(hv.id)).toBe(1);

      const sdtChung = sdtTest();
      const a = await taoHocVien({
        ma: maTest(),
        sdt: sdtChung,
        email: `khopma-a-${sdtChung}@test.local`,
      });
      await taoHocVien({ ma: maTest(), sdt: sdtChung });
      const res = await request(app.getHttpServer())
        .post('/auth/quen-mat-khau')
        .send({ ten_dang_nhap: sdtChung, kieu_dang_nhap: 'sdt' })
        .expect(200);
      expect(res.body).toEqual({ da_gui: true });
      expect(await soTokenDatLai(a.hv.id)).toBe(0);
    });
  });

  describe('Import + SSO + tìm kiếm khớp lệch số 0', () => {
    async function nhapFile(loai: string, header: string[], rows: unknown[][]) {
      const wb = new ExcelJS.Workbook();
      const sheet = wb.addWorksheet('data');
      sheet.addRow(header);
      rows.forEach((r) => sheet.addRow(r));
      const buffer = Buffer.from(await wb.xlsx.writeBuffer());
      const res = await request(app.getHttpServer())
        .post(`/import/${loai}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach('file', buffer, `${loai}.xlsx`);
      expect(res.body).toHaveProperty('import_id');
      const ketQua = await request(app.getHttpServer())
        .get(`/import/${res.body.import_id}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      return { importId: res.body.import_id as string, ketQua: ketQua.body };
    }

    it('import ho_so_nhan_su_moet mã trùng-bỏ-số-0 với hồ sơ có sẵn -> lỗi dòng, không tạo học viên', async () => {
      const goc = maTest();
      await taoHocVien({ ma: `0${goc}` });
      const { importId, ketQua } = await nhapFile(
        'ho_so_nhan_su_moet',
        [
          'Đơn vị',
          'Mã định danh (CDSL moet)',
          'Họ và tên',
          'Ngày',
          'Tháng',
          'Năm',
          'Chức vụ',
          'Chuyên môn',
          'Số điện thoại',
          'Ghi chú',
        ],
        [
          [
            donVi.donVi.ten_don_vi,
            goc,
            'Trùng Số Không',
            1,
            1,
            NAM,
            '',
            'Toán',
            '',
            '',
          ],
        ],
      );
      expect(ketQua.so_dong_loi).toBe(1);
      expect(ketQua.danh_sach_loi[0].ly_do).toEqual(
        expect.stringContaining('khác số 0 đầu'),
      );
      await request(app.getHttpServer())
        .post(`/import/${importId}/xac-nhan`)
        .set('Authorization', `Bearer ${tokenQuanTri}`);
      expect(
        await prisma.hoc_vien.count({ where: { ma_dinh_danh_moet: goc } }),
      ).toBe(0);
    });

    it('import khác (ket_qua_khao_sat) tìm được học viên khi mã lệch số 0', async () => {
      const goc = maTest();
      const { hv } = await taoHocVien({ ma: `0${goc}` });
      const { importId, ketQua } = await nhapFile(
        'ket_qua_khao_sat',
        [
          'so_dinh_danh_ca_nhan',
          'ma_dinh_danh_moet',
          'loai',
          'trang_thai',
          'thoi_diem',
          'muc',
          'diem',
          'diem_toi_da',
          'muc_goc',
          'url_ket_qua',
        ],
        [[undefined, goc, 'danh-gia', 'dang_lam']],
      );
      expect(ketQua.so_dong_loi).toBe(0);
      await request(app.getHttpServer())
        .post(`/import/${importId}/xac-nhan`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(201);
      expect(
        await prisma.ket_qua_khao_sat.count({ where: { hoc_vien_id: hv.id } }),
      ).toBe(1);
    });

    it('POST /sso/ket-qua khớp mã lệch số 0 đầu', async () => {
      const goc = maTest();
      const { hv } = await taoHocVien({ ma: `0${goc}` });
      const res = await request(app.getHttpServer())
        .post('/sso/ket-qua')
        .set('X-API-Key', API_KEY)
        .send({
          ma_dinh_danh_moet: goc,
          loai: 'khao-sat',
          trang_thai: 'dang_lam',
        })
        .expect(200);
      expect(res.body.hoc_vien_id).toBe(hv.id);
    });

    it('/sso/ma-thu tìm theo mã thiếu số 0; /sso/doi-ma vẫn trả mã nguyên văn đã lưu', async () => {
      const goc = maTest();
      const { hv } = await taoHocVien({ ma: `0${goc}` });
      const thu = await request(app.getHttpServer())
        .post('/sso/ma-thu')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({ ma_dinh_danh_moet: goc })
        .expect(201);
      expect(thu.body.hoc_vien.id).toBe(hv.id);
      const doi = await request(app.getHttpServer())
        .post('/sso/doi-ma')
        .set('X-API-Key', API_KEY)
        .send({ code: thu.body.code })
        .expect(200);
      expect(doi.body.ma_dinh_danh_moet).toBe(`0${goc}`);
    });

    it('GET /hoc-vien?q=<mã thiếu số 0> (quản trị) tìm thấy hồ sơ', async () => {
      const goc = maTest();
      const { hv } = await taoHocVien({ ma: `0${goc}` });
      const res = await request(app.getHttpServer())
        .get('/hoc-vien')
        .query({ q: goc })
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(res.body.data.map((r: { id: string }) => r.id)).toContain(hv.id);
    });
    it('tìm kiếm mã có ký tự "-" vẫn khớp chuỗi con (quản trị + /sso/ket-qua)', async () => {
      const ma = `MOET-${chuSo(10)}`;
      const { hv } = await taoHocVien({ ma });
      const ds = await request(app.getHttpServer())
        .get('/hoc-vien')
        .query({ q: ma })
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(ds.body.data.map((r: { id: string }) => r.id)).toContain(hv.id);
      const kq = await request(app.getHttpServer())
        .get('/sso/ket-qua')
        .query({ q: ma })
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(kq.body.data.map((r: { id: string }) => r.id)).toContain(hv.id);
    });
  });

  describe('PATCH /hoc-vien/:id/ma-dinh-danh-moet', () => {
    it('thành công: đổi mã + đồng bộ tên đăng nhập, ghi lịch sử + nhật ký, mật khẩu giữ nguyên', async () => {
      const cu = maTest();
      const moi = `0${maTest()}`;
      const { hv, nguoiDung } = await taoHocVien({ ma: cu });
      const res = await suaMa(hv.id, {
        ma_dinh_danh_moet: moi,
        ly_do: 'Sở gửi mã đúng',
      }).expect(200);
      expect(res.body).toEqual({
        id: hv.id,
        ma_dinh_danh_moet: moi,
        ten_dang_nhap: moi,
        da_doi_ten_dang_nhap: true,
      });
      const nd = await prisma.nguoi_dung.findUniqueOrThrow({
        where: { id: nguoiDung!.id },
      });
      expect(nd.ten_dang_nhap).toBe(moi);
      const ls = await prisma.lich_su_thay_doi_ho_so.findMany({
        where: { hoc_vien_id: hv.id },
      });
      expect(ls).toEqual([
        expect.objectContaining({
          truong: 'ma_dinh_danh_moet',
          gia_tri_cu: cu,
          gia_tri_moi: moi,
          la_truong_goc_moet: true,
          ly_do: 'Sở gửi mã đúng',
          nguoi_sua_id: quanTri.nguoiDung.id,
          vai_tro_nguoi_sua: 'quan_tri',
        }),
      ]);
      expect(
        await prisma.nhat_ky_hoat_dong.count({
          where: { hoc_vien_id: hv.id, hanh_dong: 'sua_ma_dinh_danh_moet' },
        }),
      ).toBe(1);
      await dangNhap({ ten_dang_nhap: moi, mat_khau: MAT_KHAU }).expect(200);
    });

    it('tài khoản tên đăng nhập = CCCD -> đổi mã, giữ nguyên tên đăng nhập', async () => {
      const cccd = `9${chuSo(11)}`;
      const { hv } = await taoHocVien({
        ma: maTest(),
        cccd,
        tenDangNhap: cccd,
      });
      const moi = maTest();
      const res = await suaMa(hv.id, {
        ma_dinh_danh_moet: moi,
        ly_do: 'Sửa mã',
      }).expect(200);
      expect(res.body).toMatchObject({
        ten_dang_nhap: cccd,
        da_doi_ten_dang_nhap: false,
      });
    });

    it('thiếu lý do / lý do rỗng -> 400; mã không phải chữ số -> 400; trùng mã hiện tại -> 400', async () => {
      const ma = maTest();
      const { hv } = await taoHocVien({ ma });
      await suaMa(hv.id, { ma_dinh_danh_moet: maTest() }).expect(400);
      await suaMa(hv.id, { ma_dinh_danh_moet: maTest(), ly_do: '   ' }).expect(
        400,
      );
      await suaMa(hv.id, { ma_dinh_danh_moet: '12a45', ly_do: 'x' }).expect(
        400,
      );
      await suaMa(hv.id, { ma_dinh_danh_moet: ma, ly_do: 'x' }).expect(400);
      const sau = await prisma.hoc_vien.findUniqueOrThrow({
        where: { id: hv.id },
      });
      expect(sau.ma_dinh_danh_moet).toBe(ma);
    });

    it('trùng học viên khác (chính xác hoặc khác số 0 đầu) -> 409', async () => {
      const khac = maTest();
      await taoHocVien({ ma: `0${khac}` });
      const { hv } = await taoHocVien({ ma: maTest() });
      await suaMa(hv.id, { ma_dinh_danh_moet: `0${khac}`, ly_do: 'x' }).expect(
        409,
      );
      await suaMa(hv.id, { ma_dinh_danh_moet: khac, ly_do: 'x' }).expect(409);
      await suaMa(hv.id, { ma_dinh_danh_moet: `00${khac}`, ly_do: 'x' }).expect(
        409,
      );
    });

    it('mã mới đã là tên đăng nhập của tài khoản khác -> 409', async () => {
      const moi = maTest();
      const { hv } = await taoHocVien({ ma: maTest() });
      // Học viên khác không có mã MOET nhưng tên đăng nhập trùng mã mới.
      await taoHocVien({ ma: null, tenDangNhap: moi });
      await suaMa(hv.id, { ma_dinh_danh_moet: moi, ly_do: 'x' }).expect(409);
    });

    it('học viên đã có ket_qua_khao_sat (da_mo) -> 409', async () => {
      const ma = maTest();
      const { hv } = await taoHocVien({ ma });
      await prisma.ket_qua_khao_sat.create({
        data: {
          hoc_vien_id: hv.id,
          loai: 'khao-sat',
          trang_thai: 'da_mo',
          nguon: 'sso',
        },
      });
      const res = await suaMa(hv.id, {
        ma_dinh_danh_moet: maTest(),
        ly_do: 'x',
      }).expect(409);
      expect(res.body.error.message).toBe(
        'Học viên đã vào hệ thống khảo sát, không thể đổi mã định danh MOET.',
      );
      const sau = await prisma.hoc_vien.findUniqueOrThrow({
        where: { id: hv.id },
      });
      expect(sau.ma_dinh_danh_moet).toBe(ma);
    });

    it('không phải quan_tri -> 403; không có hồ sơ -> 404', async () => {
      const { hv } = await taoHocVien({ ma: maTest() });
      const tokenTruong = (
        await dangNhap({
          ten_dang_nhap: truong.ten_dang_nhap,
          mat_khau: 'MatKhau123',
        }).expect(200)
      ).body.token;
      await suaMa(
        hv.id,
        { ma_dinh_danh_moet: maTest(), ly_do: 'x' },
        tokenTruong,
      ).expect(403);
      await suaMa('00000000-0000-4000-8000-000000000000', {
        ma_dinh_danh_moet: maTest(),
        ly_do: 'x',
      }).expect(404);
    });
  });
});
