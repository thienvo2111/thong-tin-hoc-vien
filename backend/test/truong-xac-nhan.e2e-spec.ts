import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoDonViTest,
  taoNguoiDungTest,
  uniqueSuffix,
  xoaDonViTest,
  xoaNguoiDungTest,
} from './utils/test-data';

// Issue #61 / ADR 0015 X1, X2: trường Đồng ý / Không đồng ý từng dòng, Đồng ý tất cả, Xác nhận danh sách;
// Quản trị sửa/thêm/xóa/nạp lại → danh sách của trường về Chờ xác nhận. Các test chạy TUẦN TỰ trên cùng
// dữ liệu (mỗi bước là 1 chuyển trạng thái). Mọi họ tên / mã / tên trường đều BỊA — không có PII thật.
describe('Trường cho ý kiến + xác nhận danh sách - Cổng đơn vị (e2e)', () => {
  let app: INestApplication;
  let fixture: Awaited<ReturnType<typeof taoDonViTest>>;
  type NguoiDungTest = Awaited<ReturnType<typeof taoNguoiDungTest>>;
  const nguoiDung: NguoiDungTest[] = [];
  type VaiTroTest =
    'quanTri' | 'truongA' | 'truongB' | 'truongC' | 'so' | 'phong' | 'hocVien';
  const token = {} as Record<VaiTroTest, string>;
  const userId = {} as Record<'quanTri' | 'truongA', string>;

  const suf = uniqueSuffix();
  const MAT_KHAU = 'MatKhau123';
  // Thứ tự tạo = thứ tự xóa ngược (con trước cha).
  const donViIds: string[] = [];
  const dotIds: string[] = [];
  const ids = {} as Record<'so' | 'phong' | 'tA' | 'tB' | 'tC', string>;
  // dot1: A (3 người) + B (2 người) + C (dòng hợp đồng, 0 người); dot2: chỉ A (1 người).
  const dot = {} as Record<'d1' | 'd2', string>;
  // Id dòng theo tên (không hậu tố): An, Bình, Chi của A; Em, Giang của B; Hà của A ở dot2.
  const dongId: Record<string, string> = {};
  let hocVienId: string | undefined;
  let nguoiDungHocVienId: string | undefined;

  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const urlDs = (dotId: string) => `/cong-don-vi/truong/dot/${dotId}/danh-sach`;
  const urlYKien = (dotId: string, id: string) =>
    `${urlDs(dotId)}/${id}/y-kien`;
  const urlDongYTatCa = (dotId: string) => `${urlDs(dotId)}/dong-y-tat-ca`;
  const urlXacNhan = (dotId: string) => `${urlDs(dotId)}/xac-nhan`;
  const urlQt = (dotId: string, duoi: string) =>
    `/cong-don-vi/dot-trien-khai/${dotId}/${duoi}`;
  const urlDongQt = (id: string) => `/cong-don-vi/danh-sach-tham-gia/${id}`;

  const yKien = (vaiTro: VaiTroTest, id: string, y: unknown, dotId = dot.d1) =>
    http()
      .put(urlYKien(dotId, id))
      .set(auth(token[vaiTro]))
      .send({ y_kien: y });
  const dongYTatCa = (vaiTro: VaiTroTest, dotId = dot.d1) =>
    http().post(urlDongYTatCa(dotId)).set(auth(token[vaiTro]));
  const xacNhan = (vaiTro: VaiTroTest, dotId = dot.d1) =>
    http().post(urlXacNhan(dotId)).set(auth(token[vaiTro]));

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
    nguoiDung.push(u);
    return { token: await dangNhap(u.ten_dang_nhap), id: u.nguoiDung.id };
  }

  async function taoDonVi(
    ten: string,
    loai: 'so_gddt' | 'phong_vhxh' | 'truong',
    cha: string | null,
  ) {
    const dv = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `TXN-${uniqueSuffix()}`,
        ten_don_vi: ten,
        loai_don_vi: loai,
        dia_ban_id: fixture.diaDanhXa.id,
        don_vi_cha_id: cha,
        trang_thai: 'active',
      },
    });
    donViIds.push(dv.id);
    return dv.id;
  }

  async function taoDot(ten: string) {
    const d = await prisma.dot_trien_khai.create({
      data: {
        chuong_trinh: 'hsg',
        ten: `${ten} ${suf}`,
        don_gia: 1_000_000,
        han_nop: new Date('2026-12-31T16:59:59Z'),
        so_gddt_id: ids.so,
      },
    });
    dotIds.push(d.id);
    return d.id;
  }

  const dong = (don_vi_id: string, ten: string, nua = false) => ({
    don_vi_id,
    ho_ten: `GV Bịa ${ten} ${suf}`,
    ngay_sinh: '1991-03-04',
    lop: 'Toán 9',
    giai_doan: nua ? 'chi_gd1' : 'ca_hai',
  });

  const nap = (dotId: string, ds: unknown[]) =>
    http()
      .post(urlQt(dotId, 'danh-sach/nap'))
      .set(auth(token.quanTri))
      .send({ dong: ds });

  const hopDong = (dotId: string, don_vi_id: string) =>
    prisma.hop_dong_boi_duong.findUniqueOrThrow({
      where: {
        dot_trien_khai_id_don_vi_id: { dot_trien_khai_id: dotId, don_vi_id },
      },
    });

  const yKienCua = async (dotId: string, don_vi_id: string) =>
    Object.fromEntries(
      (
        await prisma.danh_sach_tham_gia.findMany({
          where: { dot_trien_khai_id: dotId, don_vi_id },
          select: { ho_ten: true, y_kien_truong: true },
        })
      ).map((d) => [d.ho_ten.split(' ')[2], d.y_kien_truong]),
    );

  const nhatKy = (hanh_dong: string) =>
    prisma.nhat_ky_hoat_dong.findMany({
      where: {
        hanh_dong,
        chi_tiet: { path: ['dot_trien_khai_id'], equals: dot.d1 },
      },
      orderBy: { thoi_gian: 'asc' },
    });

  /** Lấy id các dòng của 1 trường qua API của chính trường đó. */
  async function ghiIdDong(vaiTro: VaiTroTest, dotId: string) {
    const res = await http()
      .get(urlDs(dotId))
      .set(auth(token[vaiTro]))
      .expect(200);
    for (const d of res.body.dong as { id: string; ho_ten: string }[]) {
      dongId[d.ho_ten.split(' ')[2]] = d.id;
    }
  }

  /** Học viên bịa + tài khoản hoc_vien để thử 403. */
  async function taoHocVienDangNhap() {
    const ten = `MOET-TXN-${uniqueSuffix()}`;
    const hv = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: ten,
        so_dinh_danh_ca_nhan: `${Date.now()}`.padStart(12, '6').slice(-12),
        ho_ten: 'Học Viên Bịa Xác Nhận',
        email_lien_he: `txn-${suf}@test.local`,
        ngay_sinh: 1,
        thang_sinh: 2,
        nam_sinh: 1990,
        trinh_do_chuyen_mon: 'dai_hoc',
        doi_tuong: 'giao_vien',
        don_vi_cong_tac_id: ids.tA,
        so_dien_thoai_lien_he: '0900000000',
        trang_thai: 'da_duyet',
        nguoi_duyet_id: userId.quanTri,
        cap_duyet_thuc_te: 'quan_tri',
        ngay_duyet: new Date(),
        chuyen_mon: { create: [{ chuyen_mon: 'CNTT' }] },
      },
    });
    hocVienId = hv.id;
    const nd = await prisma.nguoi_dung.create({
      data: {
        ho_ten: hv.ho_ten,
        ten_dang_nhap: ten,
        vai_tro: 'hoc_vien',
        hoc_vien_id: hv.id,
        mat_khau_hash: await bcrypt.hash(MAT_KHAU, 4),
        phai_doi_mat_khau: false,
      },
    });
    nguoiDungHocVienId = nd.id;
    return dangNhap(ten);
  }

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    fixture = await taoDonViTest('txn');
    ids.so = await taoDonVi(`Sở thử xác nhận ${suf}`, 'so_gddt', null);
    ids.phong = await taoDonVi(
      `Phòng thử xác nhận ${suf}`,
      'phong_vhxh',
      ids.so,
    );
    ids.tA = await taoDonVi(`Trường A Thử Xác Nhận ${suf}`, 'truong', ids.so);
    ids.tB = await taoDonVi(`Trường B Thử Xác Nhận ${suf}`, 'truong', ids.so);
    ids.tC = await taoDonVi(`Trường C Thử Xác Nhận ${suf}`, 'truong', ids.so);
    dot.d1 = await taoDot('HSG xác nhận 1');
    dot.d2 = await taoDot('HSG xác nhận 2');

    const qt = await taoTaiKhoan('quan_tri', fixture.donVi.id);
    token.quanTri = qt.token;
    userId.quanTri = qt.id;
    const a = await taoTaiKhoan('truong', ids.tA);
    token.truongA = a.token;
    userId.truongA = a.id;
    token.truongB = (await taoTaiKhoan('truong', ids.tB)).token;
    token.truongC = (await taoTaiKhoan('truong', ids.tC)).token;
    token.so = (await taoTaiKhoan('so_gddt', ids.so)).token;
    token.phong = (await taoTaiKhoan('phong_vhxh', ids.phong)).token;
    token.hocVien = await taoHocVienDangNhap();

    const res1 = await nap(dot.d1, [
      dong(ids.tA, 'An'),
      dong(ids.tA, 'Bình', true),
      dong(ids.tA, 'Chi'),
      dong(ids.tB, 'Em'),
      dong(ids.tB, 'Giang'),
    ]);
    expect(res1.status).toBe(200);
    expect((await nap(dot.d2, [dong(ids.tA, 'Hà')])).status).toBe(200);
    // Trường C: có dòng hợp đồng nhưng danh sách 0 người.
    await prisma.hop_dong_boi_duong.create({
      data: { dot_trien_khai_id: dot.d1, don_vi_id: ids.tC },
    });
    await ghiIdDong('truongA', dot.d1);
    await ghiIdDong('truongB', dot.d1);
    await ghiIdDong('truongA', dot.d2);
  });

  afterAll(async () => {
    // Chỉ xóa đúng các dòng file này tạo (theo id đợt / id đã ghi; mảng rỗng thì bỏ qua).
    // nhat_ky_hoat_dong chỉ cho thêm (trigger chặn xóa) — để nguyên.
    if (dotIds.length > 0) {
      await prisma.danh_sach_tham_gia.deleteMany({
        where: { dot_trien_khai_id: { in: dotIds } },
      });
      await prisma.hop_dong_boi_duong.deleteMany({
        where: { dot_trien_khai_id: { in: dotIds } },
      });
      await prisma.dot_trien_khai.deleteMany({ where: { id: { in: dotIds } } });
    }
    if (nguoiDungHocVienId) await xoaNguoiDungTest(nguoiDungHocVienId);
    if (hocVienId) {
      await prisma.hoc_vien_chuyen_mon.deleteMany({
        where: { hoc_vien_id: hocVienId },
      });
      await prisma.hoc_vien.deleteMany({ where: { id: hocVienId } });
    }
    for (const u of nguoiDung) {
      if (u?.nguoiDung.id) await xoaNguoiDungTest(u.nguoiDung.id);
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

  describe('Phân quyền', () => {
    it('401 khi không có token trên cả 3 endpoint', async () => {
      await http()
        .put(urlYKien(dot.d1, dongId.An))
        .send({ y_kien: 'dong_y' })
        .expect(401);
      await http().post(urlDongYTatCa(dot.d1)).expect(401);
      await http().post(urlXacNhan(dot.d1)).expect(401);
    });

    it.each(['quanTri', 'so', 'phong', 'hocVien'] as const)(
      '403 với vai trò %s trên cả 3 endpoint, không đổi dữ liệu',
      async (vaiTro) => {
        expect((await yKien(vaiTro, dongId.An, 'dong_y')).status).toBe(403);
        expect((await dongYTatCa(vaiTro)).status).toBe(403);
        expect((await xacNhan(vaiTro)).status).toBe(403);
        expect(await yKienCua(dot.d1, ids.tA)).toEqual({
          An: null,
          Bình: null,
          Chi: null,
        });
      },
    );
  });

  describe('Chuyển trạng thái do trường', () => {
    it('ban đầu: Chờ xác nhận, mọi dòng chưa có ý kiến, chưa xác nhận được', async () => {
      const res = await http()
        .get(urlDs(dot.d1))
        .set(auth(token.truongA))
        .expect(200);
      expect(res.body).toMatchObject({
        trang_thai_danh_sach: 'cho_xac_nhan',
        co_the_xac_nhan: false,
        ly_do_khong_xac_nhan: 'Còn 3 dòng chưa Đồng ý',
      });
      expect(
        res.body.dong.map((d: { y_kien_truong: unknown }) => d.y_kien_truong),
      ).toEqual([null, null, null]);
    });

    it('A Không đồng ý 1 dòng → Báo sai lệch; người + lúc thao tác cuối = A; nhật ký trước/sau', async () => {
      const truocLuc = new Date();
      const res = await yKien('truongA', dongId.An, 'khong_dong_y');
      expect(res.status).toBe(200);
      expect(res.body.trang_thai_danh_sach).toBe('bao_sai_lech');
      expect(
        res.body.dong.find((d: { id: string }) => d.id === dongId.An)
          .y_kien_truong,
      ).toBe('khong_dong_y');
      const hd = await hopDong(dot.d1, ids.tA);
      expect(hd.trang_thai_danh_sach).toBe('bao_sai_lech');
      expect(hd.thao_tac_cuoi_boi).toBe(userId.truongA);
      expect(hd.thao_tac_cuoi_luc!.getTime()).toBeGreaterThanOrEqual(
        truocLuc.getTime() - 1000,
      );

      const nk = await nhatKy('y_kien_dong_danh_sach');
      expect(nk).toHaveLength(1);
      expect(nk[0].nguoi_dung_id).toBe(userId.truongA);
      expect(nk[0].vai_tro).toBe('truong');
      expect(nk[0].chi_tiet).toEqual({
        dot_trien_khai_id: dot.d1,
        don_vi_id: ids.tA,
        dong_id: dongId.An,
        truoc: null,
        sau: 'khong_dong_y',
      });
    });

    it('gửi lại đúng ý kiến đang có → 200, không ghi nhật ký', async () => {
      const res = await yKien('truongA', dongId.An, 'khong_dong_y');
      expect(res.status).toBe(200);
      expect(res.body.trang_thai_danh_sach).toBe('bao_sai_lech');
      expect(await nhatKy('y_kien_dong_danh_sach')).toHaveLength(1);
    });

    it('A đổi dòng đó sang Đồng ý (các dòng khác chưa có ý kiến) → Chờ xác nhận', async () => {
      const res = await yKien('truongA', dongId.An, 'dong_y');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        trang_thai_danh_sach: 'cho_xac_nhan',
        co_the_xac_nhan: false,
        ly_do_khong_xac_nhan: 'Còn 2 dòng chưa Đồng ý',
      });
      const nk = await nhatKy('y_kien_dong_danh_sach');
      expect(nk[1].chi_tiet).toMatchObject({
        truoc: 'khong_dong_y',
        sau: 'dong_y',
      });
    });

    it('xác nhận khi còn dòng chưa Đồng ý → 400 "Còn N dòng chưa Đồng ý", trạng thái không đổi', async () => {
      const res = await xacNhan('truongA');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'Còn 2 dòng chưa Đồng ý',
      });
      expect((await hopDong(dot.d1, ids.tA)).trang_thai_danh_sach).toBe(
        'cho_xac_nhan',
      );
      expect(await nhatKy('xac_nhan_danh_sach')).toHaveLength(0);
    });

    it('Đồng ý tất cả chỉ đổi dòng chưa có ý kiến — dòng Không đồng ý giữ nguyên, vẫn Báo sai lệch', async () => {
      expect(
        (await yKien('truongA', dongId['Bình'], 'khong_dong_y')).status,
      ).toBe(200);
      const res = await dongYTatCa('truongA');
      expect(res.status).toBe(200);
      expect(res.body.trang_thai_danh_sach).toBe('bao_sai_lech');
      expect(await yKienCua(dot.d1, ids.tA)).toEqual({
        An: 'dong_y',
        Bình: 'khong_dong_y',
        Chi: 'dong_y',
      });
      const nk = await nhatKy('dong_y_tat_ca_danh_sach');
      expect(nk).toHaveLength(1);
      expect(nk[0].chi_tiet).toEqual({
        dot_trien_khai_id: dot.d1,
        don_vi_id: ids.tA,
        so_dong: 1,
      });
    });

    it('Đồng ý tất cả khi không còn dòng chưa có ý kiến → 200, không ghi nhật ký', async () => {
      expect((await dongYTatCa('truongA')).status).toBe(200);
      expect(await nhatKy('dong_y_tat_ca_danh_sach')).toHaveLength(1);
    });

    it('bỏ ý kiến (null) 1 dòng → về chưa có ý kiến', async () => {
      const res = await yKien('truongA', dongId.An, null);
      expect(res.status).toBe(200);
      expect((await yKienCua(dot.d1, ids.tA)).An).toBeNull();
      expect(res.body.trang_thai_danh_sach).toBe('bao_sai_lech');
      expect((await yKien('truongA', dongId.An, 'dong_y')).status).toBe(200);
    });

    it('sửa dòng cuối → mọi dòng Đồng ý: Chờ xác nhận, bật được nút Xác nhận', async () => {
      const res = await yKien('truongA', dongId['Bình'], 'dong_y');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        trang_thai_danh_sach: 'cho_xac_nhan',
        co_the_xac_nhan: true,
        ly_do_khong_xac_nhan: null,
      });
    });

    it('xác nhận → Đã xác nhận, thao tác cuối = A, nhật ký số dòng + tổng suất', async () => {
      const res = await xacNhan('truongA');
      expect(res.status).toBe(200);
      expect(res.body.trang_thai_danh_sach).toBe('da_xac_nhan');
      const hd = await hopDong(dot.d1, ids.tA);
      expect(hd.trang_thai_danh_sach).toBe('da_xac_nhan');
      expect(hd.thao_tac_cuoi_boi).toBe(userId.truongA);
      const nk = await nhatKy('xac_nhan_danh_sach');
      expect(nk).toHaveLength(1);
      expect(nk[0].nguoi_dung_id).toBe(userId.truongA);
      expect(nk[0].chi_tiet).toEqual({
        dot_trien_khai_id: dot.d1,
        don_vi_id: ids.tA,
        so_dong: 3,
        tong_suat: 2.5,
      });
    });

    it('xác nhận lần nữa → 200 idempotent, không ghi thêm nhật ký', async () => {
      const res = await xacNhan('truongA');
      expect(res.status).toBe(200);
      expect(res.body.trang_thai_danh_sach).toBe('da_xac_nhan');
      expect(await nhatKy('xac_nhan_danh_sach')).toHaveLength(1);
    });

    it('sau Đã xác nhận, A Không đồng ý 1 dòng → Báo sai lệch; sửa lại Đồng ý → Chờ xác nhận', async () => {
      let res = await yKien('truongA', dongId.Chi, 'khong_dong_y');
      expect(res.body.trang_thai_danh_sach).toBe('bao_sai_lech');
      res = await yKien('truongA', dongId.Chi, 'dong_y');
      expect(res.body.trang_thai_danh_sach).toBe('cho_xac_nhan');
      expect((await xacNhan('truongA')).body.trang_thai_danh_sach).toBe(
        'da_xac_nhan',
      );
    });

    it('sau Đã xác nhận, A bỏ ý kiến 1 dòng → Chờ xác nhận', async () => {
      const res = await yKien('truongA', dongId.Chi, null);
      expect(res.body.trang_thai_danh_sach).toBe('cho_xac_nhan');
      await yKien('truongA', dongId.Chi, 'dong_y');
      expect((await xacNhan('truongA')).body.trang_thai_danh_sach).toBe(
        'da_xac_nhan',
      );
    });

    it('trường B không bị ảnh hưởng bởi thao tác của A', async () => {
      const hdB = await hopDong(dot.d1, ids.tB);
      expect(hdB.trang_thai_danh_sach).toBe('cho_xac_nhan');
      expect(hdB.thao_tac_cuoi_boi).toBe(userId.quanTri);
      expect(await yKienCua(dot.d1, ids.tB)).toEqual({
        Em: null,
        Giang: null,
      });
    });
  });

  describe('Phạm vi + dữ liệu sai', () => {
    it('A cho ý kiến dòng của B → 404, dòng B không đổi', async () => {
      const res = await yKien('truongA', dongId.Em, 'dong_y');
      expect(res.status).toBe(404);
      expect((await yKienCua(dot.d1, ids.tB)).Em).toBeNull();
    });

    it('A dùng dòng của đợt khác với đường dẫn đợt này → 404', async () => {
      expect((await yKien('truongA', dongId['Hà'], 'dong_y')).status).toBe(404);
      expect((await yKienCua(dot.d2, ids.tA))['Hà']).toBeNull();
    });

    it('trường không có dòng hợp đồng ở đợt → 404 trên cả 3 endpoint', async () => {
      expect(
        (await yKien('truongB', dongId['Hà'], 'dong_y', dot.d2)).status,
      ).toBe(404);
      expect((await dongYTatCa('truongB', dot.d2)).status).toBe(404);
      expect((await xacNhan('truongB', dot.d2)).status).toBe(404);
      expect((await xacNhan('truongA', randomUUID())).status).toBe(404);
    });

    it.each([['dong y'], ['DONG_Y'], [''], [1], [undefined]])(
      'y_kien không hợp lệ (%p) → 400',
      async (y) => {
        const res = await yKien('truongB', dongId.Em, y);
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      },
    );

    it('id không phải UUID → 400', async () => {
      expect((await yKien('truongB', 'khong-phai-uuid', 'dong_y')).status).toBe(
        400,
      );
      expect((await xacNhan('truongB', 'khong-phai-uuid')).status).toBe(400);
    });

    it('danh sách trống → xác nhận 400 "Danh sách trống"; Đồng ý tất cả 200 không đổi gì', async () => {
      const res = await xacNhan('truongC');
      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Danh sách trống');
      const ds = await dongYTatCa('truongC');
      expect(ds.status).toBe(200);
      expect(ds.body).toMatchObject({
        dong: [],
        trang_thai_danh_sach: 'cho_xac_nhan',
        co_the_xac_nhan: false,
        ly_do_khong_xac_nhan: 'Danh sách trống',
      });
      const hd = await hopDong(dot.d1, ids.tC);
      expect(hd.trang_thai_danh_sach).toBe('cho_xac_nhan');
      expect(hd.thao_tac_cuoi_boi).toBeNull();
    });
  });

  describe('Quản trị sửa → về Chờ xác nhận (X1)', () => {
    it('Quản trị PATCH 1 dòng của danh sách Đã xác nhận → dòng mất ý kiến, Chờ xác nhận, thao tác cuối = Quản trị', async () => {
      expect((await hopDong(dot.d1, ids.tA)).trang_thai_danh_sach).toBe(
        'da_xac_nhan',
      );
      const res = await http()
        .patch(urlDongQt(dongId.An))
        .set(auth(token.quanTri))
        .send({ ly_do: 'Sửa lớp (bịa)', lop: 'Toán 8' });
      expect(res.status).toBe(200);
      expect(res.body.y_kien_truong).toBeNull();
      const hd = await hopDong(dot.d1, ids.tA);
      expect(hd.trang_thai_danh_sach).toBe('cho_xac_nhan');
      expect(hd.thao_tac_cuoi_boi).toBe(userId.quanTri);
      expect(await yKienCua(dot.d1, ids.tA)).toEqual({
        An: null,
        Bình: 'dong_y',
        Chi: 'dong_y',
      });
    });

    it('Quản trị thêm dòng vào danh sách Báo sai lệch → Chờ xác nhận, dòng mới chưa có ý kiến', async () => {
      await yKien('truongA', dongId.An, 'khong_dong_y');
      expect((await hopDong(dot.d1, ids.tA)).trang_thai_danh_sach).toBe(
        'bao_sai_lech',
      );
      const res = await http()
        .post(urlQt(dot.d1, 'danh-sach'))
        .set(auth(token.quanTri))
        .send({ ...dong(ids.tA, 'Khoa'), ly_do: 'Bổ sung (bịa)' });
      expect(res.status).toBe(201);
      expect(res.body.y_kien_truong).toBeNull();
      dongId.Khoa = res.body.id;
      const hd = await hopDong(dot.d1, ids.tA);
      expect(hd.trang_thai_danh_sach).toBe('cho_xac_nhan');
      expect(hd.thao_tac_cuoi_boi).toBe(userId.quanTri);
    });

    it('Quản trị xóa dòng của danh sách Đã xác nhận → Chờ xác nhận', async () => {
      await yKien('truongA', dongId.An, 'dong_y');
      await dongYTatCa('truongA');
      expect((await xacNhan('truongA')).body.trang_thai_danh_sach).toBe(
        'da_xac_nhan',
      );
      const res = await http()
        .delete(urlDongQt(dongId.Khoa))
        .set(auth(token.quanTri))
        .send({ ly_do: 'Trùng (bịa)' });
      expect(res.status).toBe(204);
      const hd = await hopDong(dot.d1, ids.tA);
      expect(hd.trang_thai_danh_sach).toBe('cho_xac_nhan');
      expect(hd.thao_tac_cuoi_boi).toBe(userId.quanTri);
    });

    it('Quản trị nạp lại trường A → Chờ xác nhận, mọi dòng chưa có ý kiến; trường B không đổi', async () => {
      expect((await xacNhan('truongA')).body.trang_thai_danh_sach).toBe(
        'da_xac_nhan',
      );
      // B có 1 ý kiến trước khi nạp lại A — phải giữ nguyên.
      expect((await yKien('truongB', dongId.Em, 'dong_y')).status).toBe(200);
      const res = await nap(dot.d1, [
        dong(ids.tA, 'An'),
        dong(ids.tA, 'Bình', true),
      ]);
      expect(res.status).toBe(200);
      const hd = await hopDong(dot.d1, ids.tA);
      expect(hd.trang_thai_danh_sach).toBe('cho_xac_nhan');
      expect(hd.thao_tac_cuoi_boi).toBe(userId.quanTri);
      expect(await yKienCua(dot.d1, ids.tA)).toEqual({ An: null, Bình: null });
      expect(await yKienCua(dot.d1, ids.tB)).toEqual({
        Em: 'dong_y',
        Giang: null,
      });
      expect((await hopDong(dot.d1, ids.tB)).trang_thai_danh_sach).toBe(
        'cho_xac_nhan',
      );
    });

    it('Quản trị xem danh sách đợt: trạng thái từng trường + ý kiến từng dòng', async () => {
      const res = await http()
        .get(urlQt(dot.d1, 'danh-sach'))
        .set(auth(token.quanTri))
        .expect(200);
      const trangThai = Object.fromEntries(
        res.body.tong_hop.map(
          (t: { don_vi_id: string; trang_thai_danh_sach: string }) => [
            t.don_vi_id,
            t.trang_thai_danh_sach,
          ],
        ),
      );
      expect(trangThai).toEqual({
        [ids.tA]: 'cho_xac_nhan',
        [ids.tB]: 'cho_xac_nhan',
      });
      const em = res.body.dong.find((d: { id: string }) => d.id === dongId.Em);
      expect(em.y_kien_truong).toBe('dong_y');
    });
  });

  it('nhật ký 3 hành động mới không chứa họ tên / ngày sinh (PII)', async () => {
    const nk = await prisma.nhat_ky_hoat_dong.findMany({
      where: {
        hanh_dong: {
          in: [
            'y_kien_dong_danh_sach',
            'dong_y_tat_ca_danh_sach',
            'xac_nhan_danh_sach',
          ],
        },
        chi_tiet: { path: ['dot_trien_khai_id'], equals: dot.d1 },
      },
    });
    expect(nk.length).toBeGreaterThan(5);
    const json = JSON.stringify(nk.map((n) => n.chi_tiet));
    expect(json).not.toMatch(/GV Bịa|1991|Toán/);
    for (const n of nk) {
      const khoa = Object.keys(n.chi_tiet as object).sort();
      expect([
        ['don_vi_id', 'dong_id', 'dot_trien_khai_id', 'sau', 'truoc'],
        ['don_vi_id', 'dot_trien_khai_id', 'so_dong'],
        ['don_vi_id', 'dot_trien_khai_id', 'so_dong', 'tong_suat'],
      ]).toContainEqual(khoa);
    }
  });
});
