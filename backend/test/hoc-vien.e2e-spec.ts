import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
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

function soDinhDanhNgauNhien(): string {
  // 12 chữ số duy nhất: 6 số cuối timestamp + 6 số ngẫu nhiên.
  const t = Date.now().toString().slice(-6);
  const r = Math.floor(100000 + Math.random() * 899999).toString();
  return `${t}${r}`;
}

function ddmmyyyy(ngay: number, thang: number, nam: number): string {
  return `${String(ngay).padStart(2, '0')}${String(thang).padStart(2, '0')}${nam}`;
}

describe('Hồ sơ Học viên (e2e)', () => {
  let app: INestApplication;

  // Cây địa lý + đơn vị dùng chung: tỉnh -> {xã Trường (= xã Phòng), xã Sở}.
  // truong.don_vi_cha_id = phongVhxh.id, phongVhxh.don_vi_cha_id = soGddt.id
  // (cây hành chính cho ScopeService) — routing duyệt (resolveDonViDuyet) lại
  // đi theo dia_ban_id địa lý, độc lập với cây này (xem hoc-vien.service.ts).
  let tinh: { id: string };
  let xaTruong: { id: string };
  let xaSo: { id: string };
  let soGddt: { id: string };
  let phongVhxh: { id: string };
  let truong: { id: string };
  let truongKhacFixture: Awaited<ReturnType<typeof taoDonViTest>>;

  let quanTri: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let soAccount: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let phongAccount: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let truongAccount: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let tokenSo: string;
  let tokenPhong: string;
  let tokenTruong: string;

  const hocVienIds: string[] = [];
  const nguoiDungHocVienIds: string[] = [];

  async function dangNhap(ten_dang_nhap: string, mat_khau: string) {
    const res = await request(app.getHttpServer())
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap, mat_khau })
      .expect(200);
    return res.body.token as string;
  }

  function baseDangKyBody(overrides: Record<string, unknown> = {}) {
    const suf = uniqueSuffix();
    return {
      ho_ten: 'Nguyễn Văn An',
      so_dinh_danh_ca_nhan: soDinhDanhNgauNhien(),
      ngay_sinh: 15,
      thang_sinh: 6,
      nam_sinh: NAM_HOP_LE,
      noi_sinh_id: tinh.id,
      phuong_xa_id: xaTruong.id,
      don_vi_cong_tac_id: truong.id,
      so_dien_thoai_lien_he: '0912345678',
      email_lien_he: `hv-${suf}@test.local`,
      trinh_do_chuyen_mon: 'dai_hoc',
      chuyen_mon: ['Sư phạm Toán'],
      ...overrides,
    };
  }

  beforeAll(async () => {
    app = await createTestApp();
    const suf = uniqueSuffix();

    tinh = await prisma.dia_danh.create({
      data: { ma: `T-hv-${suf}`, ten: `Tỉnh HV ${suf}`, cap: 'tinh_thanh' },
    });
    xaTruong = await prisma.dia_danh.create({
      data: {
        ma: `X-hv-truong-${suf}`,
        ten: `Xã Trường HV ${suf}`,
        cap: 'phuong_xa_dac_khu',
        parent_id: tinh.id,
      },
    });
    xaSo = await prisma.dia_danh.create({
      data: {
        ma: `X-hv-so-${suf}`,
        ten: `Xã Sở HV ${suf}`,
        cap: 'phuong_xa_dac_khu',
        parent_id: tinh.id,
      },
    });
    soGddt = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-so-${suf}`,
        ten_don_vi: `Sở GD&ĐT HV ${suf}`,
        loai_don_vi: 'so_gddt',
        dia_ban_id: xaSo.id,
      },
    });
    phongVhxh = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-phong-${suf}`,
        ten_don_vi: `Phòng VHXH HV ${suf}`,
        loai_don_vi: 'phong_vhxh',
        dia_ban_id: xaTruong.id,
        don_vi_cha_id: soGddt.id,
      },
    });
    truong = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-truong-${suf}`,
        ten_don_vi: `Trường HV ${suf}`,
        loai_don_vi: 'truong',
        dia_ban_id: xaTruong.id,
        don_vi_cha_id: phongVhxh.id,
      },
    });
    truongKhacFixture = await taoDonViTest('hv-khac');

    quanTri = await taoNguoiDungTest({
      vai_tro: 'quan_tri',
      don_vi_id: truong.id,
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
    truongAccount = await taoNguoiDungTest({
      vai_tro: 'truong',
      don_vi_id: truong.id,
      mat_khau: 'MatKhau123',
    });

    tokenSo = await dangNhap(soAccount.ten_dang_nhap, 'MatKhau123');
    tokenPhong = await dangNhap(phongAccount.ten_dang_nhap, 'MatKhau123');
    tokenTruong = await dangNhap(truongAccount.ten_dang_nhap, 'MatKhau123');
  });

  afterAll(async () => {
    // Xóa trước khi xóa hoc_vien — nhat_ky_thong_bao.hoc_vien_id FK
    // onDelete: NoAction (docs/database-ddl.sql PHẦN 4). xac-nhan/duyet giờ
    // gửi email thật (Ethereal) nên luôn ghi ít nhất 1 dòng cho mỗi hoc_vien
    // đã gọi 2 endpoint đó trong suite này.
    await prisma.nhat_ky_thong_bao.deleteMany({
      where: { hoc_vien_id: { in: hocVienIds } },
    });
    if (hocVienIds.length > 0) {
      // chk_nguoi_dung_scope bắt buộc nguoi_dung.hoc_vien_id NOT NULL cho
      // vai_tro='hoc_vien' (không null được để tách rời) — phải gỡ FK phía
      // hoc_vien (created_by/nguoi_duyet_id -> nguoi_dung) trước, xóa
      // nguoi_dung (phía tham chiếu hoc_vien_id, xóa không vi phạm FK), rồi
      // mới xóa hoc_vien.
      // trang_thai phải về 'nhap' cùng lúc — chk_hoc_vien_duyet_dong_bo bắt
      // buộc nguoi_duyet_id NOT NULL khi trang_thai IN ('da_duyet','tu_choi').
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
    await xoaNguoiDungTest(quanTri.nguoiDung.id);
    await xoaNguoiDungTest(soAccount.nguoiDung.id);
    await xoaNguoiDungTest(phongAccount.nguoiDung.id);
    await xoaNguoiDungTest(truongAccount.nguoiDung.id);
    await xoaDonViTest(
      [truong.id, phongVhxh.id, soGddt.id],
      [xaTruong.id, xaSo.id, tinh.id],
    );
    await xoaDonViTest(
      [truongKhacFixture.donVi.id],
      [truongKhacFixture.diaDanhXa.id, truongKhacFixture.diaDanhTinh.id],
    );
    await prisma.$disconnect();
    await app.close();
  });

  describe('GET /hoc-vien/kiem-tra-trung', () => {
    it('ĐDCN chưa tồn tại -> ton_tai=false', async () => {
      const res = await request(app.getHttpServer())
        .get(
          `/hoc-vien/kiem-tra-trung?so_dinh_danh_ca_nhan=${soDinhDanhNgauNhien()}`,
        )
        .expect(200);
      expect(res.body.ton_tai).toBe(false);
    });

    it('sai định dạng (không đủ 12 số) -> 400', async () => {
      await request(app.getHttpServer())
        .get('/hoc-vien/kiem-tra-trung?so_dinh_danh_ca_nhan=123')
        .expect(400);
    });
  });

  describe('POST /hoc-vien — Luồng đăng ký', () => {
    it('thiếu field bắt buộc (email_lien_he) -> 400 VALIDATION_ERROR', async () => {
      const body = baseDangKyBody();
      delete (body as Record<string, unknown>).email_lien_he;
      const res = await request(app.getHttpServer())
        .post('/hoc-vien')
        .send(body)
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('đăng ký hợp lệ -> 201, trả hoc_vien_id/ten_dang_nhap=ĐDCN/luu_y; tạo đúng nguoi_dung liên kết', async () => {
      const body = baseDangKyBody();
      const res = await request(app.getHttpServer())
        .post('/hoc-vien')
        .send(body)
        .expect(201);

      expect(res.body.ten_dang_nhap).toBe(body.so_dinh_danh_ca_nhan);
      expect(res.body.hoc_vien_id).toBeDefined();
      expect(res.body.luu_y).toEqual(expect.stringContaining('ngày sinh'));

      hocVienIds.push(res.body.hoc_vien_id);

      const nguoiDung = await prisma.nguoi_dung.findUnique({
        where: { ten_dang_nhap: body.so_dinh_danh_ca_nhan },
      });
      expect(nguoiDung?.hoc_vien_id).toBe(res.body.hoc_vien_id);
      expect(nguoiDung?.vai_tro).toBe('hoc_vien');
      expect(nguoiDung?.don_vi_id).toBeNull();
      expect(nguoiDung?.phai_doi_mat_khau).toBe(true);
      if (nguoiDung) nguoiDungHocVienIds.push(nguoiDung.id);

      const hocVien = await prisma.hoc_vien.findUnique({
        where: { id: res.body.hoc_vien_id },
      });
      expect(hocVien?.nguon_tao).toBe('tu_dang_ky');
      expect(hocVien?.trang_thai).toBe('nhap');
      expect(hocVien?.created_by).toBe(nguoiDung?.id);

      // Rule #6/#7: giờ đã tồn tại -> kiem-tra-trung phải trả true
      const kt = await request(app.getHttpServer())
        .get(
          `/hoc-vien/kiem-tra-trung?so_dinh_danh_ca_nhan=${body.so_dinh_danh_ca_nhan}`,
        )
        .expect(200);
      expect(kt.body.ton_tai).toBe(true);
    });

    it('trùng ĐDCN đã đăng ký -> 409 CONFLICT', async () => {
      const body = baseDangKyBody();
      const first = await request(app.getHttpServer())
        .post('/hoc-vien')
        .send(body)
        .expect(201);
      hocVienIds.push(first.body.hoc_vien_id);
      const nguoiDung = await prisma.nguoi_dung.findUnique({
        where: { ten_dang_nhap: body.so_dinh_danh_ca_nhan },
      });
      if (nguoiDung) nguoiDungHocVienIds.push(nguoiDung.id);

      const res = await request(app.getHttpServer())
        .post('/hoc-vien')
        .send({ ...body, email_lien_he: `khac-${uniqueSuffix()}@test.local` })
        .expect(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('trinh_do_chuyen_mon=khac thiếu trinh_do_chuyen_mon_khac -> 400', async () => {
      const body = baseDangKyBody({ trinh_do_chuyen_mon: 'khac' });
      await request(app.getHttpServer())
        .post('/hoc-vien')
        .send(body)
        .expect(400);
    });
  });

  describe('Luồng hoàn chỉnh: đăng ký -> đăng nhập -> toi -> chuyên môn -> xác nhận -> duyệt', () => {
    let body: ReturnType<typeof baseDangKyBody>;
    let hocVienId: string;
    let token: string;

    beforeAll(async () => {
      body = baseDangKyBody({ cap_giang_day: 'mam_non' });
      const res = await request(app.getHttpServer())
        .post('/hoc-vien')
        .send(body)
        .expect(201);
      hocVienId = res.body.hoc_vien_id;
      hocVienIds.push(hocVienId);
      const nguoiDung = await prisma.nguoi_dung.findUnique({
        where: { ten_dang_nhap: body.so_dinh_danh_ca_nhan },
      });
      if (nguoiDung) nguoiDungHocVienIds.push(nguoiDung.id);

      token = await dangNhap(
        body.so_dinh_danh_ca_nhan as string,
        ddmmyyyy(15, 6, NAM_HOP_LE),
      );
    });

    it('đăng nhập bằng mật khẩu mặc định = ngày sinh ddmmyyyy thành công, phai_doi_mat_khau=true', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/dang-nhap')
        .send({
          ten_dang_nhap: body.so_dinh_danh_ca_nhan,
          mat_khau: ddmmyyyy(15, 6, NAM_HOP_LE),
        })
        .expect(200);
      expect(res.body.phai_doi_mat_khau).toBe(true);
    });

    it('GET /hoc-vien/toi trả đúng dữ liệu đã khai + chuyen_mon dạng string[]', async () => {
      const res = await request(app.getHttpServer())
        .get('/hoc-vien/toi')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.ho_ten).toBe('Nguyễn Văn An');
      expect(res.body.chuyen_mon).toEqual(['Sư phạm Toán']);
      expect(res.body.trang_thai).toBe('nhap');
    });

    it('PATCH /hoc-vien/toi sửa số điện thoại -> cập nhật thành công', async () => {
      const res = await request(app.getHttpServer())
        .patch('/hoc-vien/toi')
        .set('Authorization', `Bearer ${token}`)
        .send({ so_dien_thoai_lien_he: '0987654321' })
        .expect(200);
      expect(res.body.so_dien_thoai_lien_he).toBe('0987654321');
    });

    it('PATCH /hoc-vien/toi số điện thoại sai định dạng -> 400', async () => {
      await request(app.getHttpServer())
        .patch('/hoc-vien/toi')
        .set('Authorization', `Bearer ${token}`)
        .send({ so_dien_thoai_lien_he: '123' })
        .expect(400);
    });

    it('POST /hoc-vien/toi/chuyen-mon thêm 1 giá trị -> có trong danh sách', async () => {
      const res = await request(app.getHttpServer())
        .post('/hoc-vien/toi/chuyen-mon')
        .set('Authorization', `Bearer ${token}`)
        .send({ chuyen_mon: 'Sư phạm Lý' })
        .expect(201);
      expect(res.body.chuyen_mon).toEqual(
        expect.arrayContaining(['Sư phạm Toán', 'Sư phạm Lý']),
      );
    });

    it('POST /hoc-vien/toi/chuyen-mon trùng giá trị đã có -> 409', async () => {
      await request(app.getHttpServer())
        .post('/hoc-vien/toi/chuyen-mon')
        .set('Authorization', `Bearer ${token}`)
        .send({ chuyen_mon: 'Sư phạm Lý' })
        .expect(409);
    });

    it('DELETE /hoc-vien/toi/chuyen-mon xóa 1 giá trị -> không còn trong danh sách', async () => {
      const res = await request(app.getHttpServer())
        .delete('/hoc-vien/toi/chuyen-mon')
        .set('Authorization', `Bearer ${token}`)
        .send({ chuyen_mon: 'Sư phạm Lý' })
        .expect(200);
      expect(res.body.chuyen_mon).toEqual(['Sư phạm Toán']);
    });

    it('POST /hoc-vien/toi/kiem-tra-truoc-xac-nhan: hồ sơ đủ -> loi rỗng', async () => {
      const res = await request(app.getHttpServer())
        .post('/hoc-vien/toi/kiem-tra-truoc-xac-nhan')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);
      expect(res.body.loi).toEqual([]);
    });

    it('ho_ten viết thường -> kiem-tra-truoc-xac-nhan trả canh_bao (không chặn), không có trong loi', async () => {
      await request(app.getHttpServer())
        .patch('/hoc-vien/toi')
        .set('Authorization', `Bearer ${token}`)
        .send({ ho_ten: 'nguyễn văn an' })
        .expect(200);

      const res = await request(app.getHttpServer())
        .post('/hoc-vien/toi/kiem-tra-truoc-xac-nhan')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);
      expect(res.body.loi).toEqual([]);
      expect(res.body.canh_bao.length).toBeGreaterThan(0);

      // trả lại tên chuẩn cho các bước sau
      await request(app.getHttpServer())
        .patch('/hoc-vien/toi')
        .set('Authorization', `Bearer ${token}`)
        .send({ ho_ten: 'Nguyễn Văn An' })
        .expect(200);
    });

    it('POST /hoc-vien/toi/xac-nhan: nhap -> cho_duyet, set email_ban_sao_da_gui_at', async () => {
      const res = await request(app.getHttpServer())
        .post('/hoc-vien/toi/xac-nhan')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);
      expect(res.body.trang_thai).toBe('cho_duyet');
      expect(res.body.email_ban_sao_da_gui_at).not.toBeNull();
    });

    it('PATCH /hoc-vien/toi khi đã cho_duyet -> 409 (khóa sửa, rule #27)', async () => {
      await request(app.getHttpServer())
        .patch('/hoc-vien/toi')
        .set('Authorization', `Bearer ${token}`)
        .send({ so_dien_thoai_lien_he: '0911111111' })
        .expect(409);
    });

    it('POST /hoc-vien/{id}/duyet bởi Phòng VHXH ngoài phạm vi (Sở khác xã) -> vẫn đúng: Sở KHÔNG phải phạm vi của Phòng khác nên phép thử dùng truong -> 403', async () => {
      await request(app.getHttpServer())
        .post(`/hoc-vien/${hocVienId}/duyet`)
        .set('Authorization', `Bearer ${tokenTruong}`)
        .send({ ket_qua: 'da_duyet' })
        .expect(403);
    });

    it('POST /hoc-vien/{id}/duyet bởi đúng Phòng VHXH quản lý xã (routing mam_non) -> 201, trang_thai=da_duyet, ghi nguoi_duyet_id/cap_duyet_thuc_te/ngay_duyet', async () => {
      const res = await request(app.getHttpServer())
        .post(`/hoc-vien/${hocVienId}/duyet`)
        .set('Authorization', `Bearer ${tokenPhong}`)
        .send({ ket_qua: 'da_duyet' })
        .expect(201);
      expect(res.body.trang_thai).toBe('da_duyet');
      expect(res.body.nguoi_duyet_id).toBe(phongAccount.nguoiDung.id);
      expect(res.body.cap_duyet_thuc_te).toBe('phong_vhxh');
      expect(res.body.ngay_duyet).not.toBeNull();
    });

    it('duyệt lại lần 2 (đã da_duyet) -> 409', async () => {
      await request(app.getHttpServer())
        .post(`/hoc-vien/${hocVienId}/duyet`)
        .set('Authorization', `Bearer ${tokenPhong}`)
        .send({ ket_qua: 'da_duyet' })
        .expect(409);
    });

    it('GET /hoc-vien/{id} bởi Sở (escalation qua don_vi_cha_id) -> 200', async () => {
      await request(app.getHttpServer())
        .get(`/hoc-vien/${hocVienId}`)
        .set('Authorization', `Bearer ${tokenSo}`)
        .expect(200);
    });
  });

  describe('Routing NULL cap_giang_day -> Sở GD&ĐT (rule #25b fallback)', () => {
    let hocVienId: string;

    beforeAll(async () => {
      const body = baseDangKyBody(); // không khai cap_giang_day
      const res = await request(app.getHttpServer())
        .post('/hoc-vien')
        .send(body)
        .expect(201);
      hocVienId = res.body.hoc_vien_id;
      hocVienIds.push(hocVienId);
      const nguoiDung = await prisma.nguoi_dung.findUnique({
        where: { ten_dang_nhap: body.so_dinh_danh_ca_nhan },
      });
      if (nguoiDung) nguoiDungHocVienIds.push(nguoiDung.id);

      const token = await dangNhap(
        body.so_dinh_danh_ca_nhan as string,
        ddmmyyyy(15, 6, NAM_HOP_LE),
      );
      await request(app.getHttpServer())
        .post('/hoc-vien/toi/xac-nhan')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);
    });

    it('Phòng VHXH (không phải Sở) thử duyệt hồ sơ NULL cap_giang_day -> 403 (không có chiều ngược escalation)', async () => {
      await request(app.getHttpServer())
        .post(`/hoc-vien/${hocVienId}/duyet`)
        .set('Authorization', `Bearer ${tokenPhong}`)
        .send({ ket_qua: 'da_duyet' })
        .expect(403);
    });

    it('Sở GD&ĐT duyệt thành công (routing mặc định NULL -> Sở)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/hoc-vien/${hocVienId}/duyet`)
        .set('Authorization', `Bearer ${tokenSo}`)
        .send({ ket_qua: 'tu_choi', ly_do: 'Thiếu minh chứng công tác' })
        .expect(201);
      expect(res.body.trang_thai).toBe('tu_choi');
      expect(res.body.ghi_chu).toEqual(
        expect.stringContaining('Thiếu minh chứng công tác'),
      );
    });
  });

  describe('GET /hoc-vien — phạm vi quyền theo don_vi', () => {
    let hocVienTruongId: string;
    let hocVienKhacId: string;

    beforeAll(async () => {
      const body1 = baseDangKyBody();
      const res1 = await request(app.getHttpServer())
        .post('/hoc-vien')
        .send(body1)
        .expect(201);
      hocVienTruongId = res1.body.hoc_vien_id;
      hocVienIds.push(hocVienTruongId);
      const nd1 = await prisma.nguoi_dung.findUnique({
        where: { ten_dang_nhap: body1.so_dinh_danh_ca_nhan },
      });
      if (nd1) nguoiDungHocVienIds.push(nd1.id);

      const body2 = baseDangKyBody({
        don_vi_cong_tac_id: truongKhacFixture.donVi.id,
        phuong_xa_id: truongKhacFixture.diaDanhXa.id,
        noi_sinh_id: truongKhacFixture.diaDanhTinh.id,
      });
      const res2 = await request(app.getHttpServer())
        .post('/hoc-vien')
        .send(body2)
        .expect(201);
      hocVienKhacId = res2.body.hoc_vien_id;
      hocVienIds.push(hocVienKhacId);
      const nd2 = await prisma.nguoi_dung.findUnique({
        where: { ten_dang_nhap: body2.so_dinh_danh_ca_nhan },
      });
      if (nd2) nguoiDungHocVienIds.push(nd2.id);
    });

    it('Trường chỉ thấy hồ sơ thuộc đơn vị mình, không thấy đơn vị khác', async () => {
      const res = await request(app.getHttpServer())
        .get('/hoc-vien?page_size=200')
        .set('Authorization', `Bearer ${tokenTruong}`)
        .expect(200);
      const ids = res.body.data.map((h: { id: string }) => h.id);
      expect(ids).toContain(hocVienTruongId);
      expect(ids).not.toContain(hocVienKhacId);
    });

    it('Trường lọc theo don_vi_cong_tac_id ngoài phạm vi -> 403', async () => {
      await request(app.getHttpServer())
        .get(`/hoc-vien?don_vi_cong_tac_id=${truongKhacFixture.donVi.id}`)
        .set('Authorization', `Bearer ${tokenTruong}`)
        .expect(403);
    });

    it('QuảnTrị (scope ALL) thấy cả 2', async () => {
      const tokenQuanTri = await dangNhap(quanTri.ten_dang_nhap, 'MatKhau123');
      const res = await request(app.getHttpServer())
        .get('/hoc-vien?page_size=200')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      const ids = res.body.data.map((h: { id: string }) => h.id);
      expect(ids).toContain(hocVienTruongId);
      expect(ids).toContain(hocVienKhacId);
    });

    it('Học viên (vai_tro=hoc_vien) gọi GET /hoc-vien -> 403 (không có trong danh sách vai trò được phép)', async () => {
      const body = baseDangKyBody();
      const res = await request(app.getHttpServer())
        .post('/hoc-vien')
        .send(body)
        .expect(201);
      hocVienIds.push(res.body.hoc_vien_id);
      const nd = await prisma.nguoi_dung.findUnique({
        where: { ten_dang_nhap: body.so_dinh_danh_ca_nhan },
      });
      if (nd) nguoiDungHocVienIds.push(nd.id);
      const tokenHv = await dangNhap(
        body.so_dinh_danh_ca_nhan as string,
        ddmmyyyy(15, 6, NAM_HOP_LE),
      );
      await request(app.getHttpServer())
        .get('/hoc-vien')
        .set('Authorization', `Bearer ${tokenHv}`)
        .expect(403);
    });
  });

  describe('duyet — hồ sơ import_moet bỏ qua bước duyệt', () => {
    it('gọi duyet trên hồ sơ nguon_tao=import_moet -> 409', async () => {
      const suf = uniqueSuffix();
      // Thứ tự tạo giống HocVienService.createFromMoetImport: hoc_vien trước
      // (created_by để trống), rồi nguoi_dung với hoc_vien_id trỏ sẵn — vì
      // chk_nguoi_dung_scope bắt buộc hoc_vien_id NOT NULL ngay khi tạo cho
      // vai_tro='hoc_vien'.
      const hocVienMoet = await prisma.hoc_vien.create({
        data: {
          nguon_tao: 'import_moet',
          ma_dinh_danh_moet: `MOET-E2E-${suf}`,
          ho_ten: 'Import Moet Test',
          ngay_sinh: 1,
          thang_sinh: 1,
          nam_sinh: NAM_HOP_LE,
          don_vi_cong_tac_id: truong.id,
          so_dien_thoai_lien_he: '0900000000',
          trang_thai: 'da_duyet',
          nguoi_duyet_id: quanTri.nguoiDung.id,
          cap_duyet_thuc_te: 'quan_tri',
          ngay_duyet: new Date(),
        },
      });
      const nguoiDungMoet = await prisma.nguoi_dung.create({
        data: {
          ho_ten: 'Import Moet Test',
          ten_dang_nhap: `MOET-E2E-${suf}`,
          vai_tro: 'hoc_vien',
          hoc_vien_id: hocVienMoet.id,
          mat_khau_hash: '$2a$04$abcdefghijklmnopqrstuv', // không dùng để đăng nhập trong test này
          phai_doi_mat_khau: true,
        },
      });
      await prisma.hoc_vien.update({
        where: { id: hocVienMoet.id },
        data: { created_by: nguoiDungMoet.id },
      });
      hocVienIds.push(hocVienMoet.id);
      nguoiDungHocVienIds.push(nguoiDungMoet.id);

      await request(app.getHttpServer())
        .post(`/hoc-vien/${hocVienMoet.id}/duyet`)
        .set('Authorization', `Bearer ${tokenSo}`)
        .send({ ket_qua: 'da_duyet' })
        .expect(409);
    });
  });
});
