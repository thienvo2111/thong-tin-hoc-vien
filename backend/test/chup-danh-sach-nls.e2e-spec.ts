import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoDonViTest,
  taoNguoiDungTest,
  uniqueSuffix,
  xoaDonViTest,
  xoaNguoiDungTest,
} from './utils/test-data';

// Issue #68 / ADR 0015 M1, M3, M6, S1, S3, X1, X5: gắn khóa NLS vào đợt + "Lấy danh sách từ khóa" (chụp từ ghi
// danh, không đọc sống). Các test chạy TUẦN TỰ trên cùng dữ liệu. Mọi tên người/trường/khóa đều BỊA.
describe('Chụp danh sách NLS từ khóa - Cổng đơn vị (e2e)', () => {
  let app: INestApplication;
  let fixture: Awaited<ReturnType<typeof taoDonViTest>>;
  type NguoiDungTest = Awaited<ReturnType<typeof taoNguoiDungTest>>;
  const nguoiDung: NguoiDungTest[] = [];
  type VaiTro = 'quanTri' | 'truong' | 'so';
  const token = {} as Record<VaiTro, string>;
  const userId = {} as Record<VaiTro, string>;

  const suf = uniqueSuffix();
  const MAT_KHAU = 'MatKhau123';
  const donViIds: string[] = [];
  const dotIds: string[] = [];
  const khoaIds: string[] = [];
  const dangKyIds: string[] = [];
  const hocVienIds: string[] = [];
  const ids = {} as Record<'so' | 'so2' | 'tA' | 'tB' | 'phong', string>;
  const dot = {} as Record<'nls' | 'nls2' | 'hsg', string>;
  const tenDotNls = `NLS chụp ${suf}`;
  // K1: GĐ đánh giá (không lớp) + GĐ học 1 (L1) + GĐ học 2 (L2). K2: 1 GĐ học (L3). K3: Sở khác. K4: 3 GĐ học.
  type MaKhoaTest = 'k1' | 'k2' | 'k3' | 'k4' | 'k5';
  const khoa = {} as Record<MaKhoaTest, string>;
  const maKhoa = {} as Record<MaKhoaTest, string>;
  const gd = {} as Record<'k1DanhGia' | 'k1G1' | 'k1G2' | 'k2G1', string>;
  const lop = {} as Record<'l1' | 'l2' | 'l3', string>;
  const hv = {} as Record<string, string>;
  const dk = {} as Record<string, string>;

  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const url = (dotId: string, duoi: string) =>
    `/cong-don-vi/dot-trien-khai/${dotId}/${duoi}`;
  const ganKhoa = (dotId: string, khoa_ids: string[]) =>
    http().put(url(dotId, 'khoa')).set(auth(token.quanTri)).send({ khoa_ids });
  const xemTruoc = (dotId: string, t = token.quanTri) =>
    http().post(url(dotId, 'danh-sach/lay-tu-khoa/xem-truoc')).set(auth(t));
  const chup = (dotId: string, t = token.quanTri) =>
    http().post(url(dotId, 'danh-sach/lay-tu-khoa')).set(auth(t));
  const dongCua = (dotId: string, don_vi_id: string) =>
    prisma.danh_sach_tham_gia.findMany({
      where: { dot_trien_khai_id: dotId, don_vi_id },
      orderBy: { ho_ten: 'asc' },
    });
  const nhatKy = (hanh_dong: string, dotId: string) =>
    prisma.nhat_ky_hoat_dong.findMany({
      where: {
        hanh_dong,
        chi_tiet: { path: ['dot_trien_khai_id'], equals: dotId },
      },
      orderBy: { thoi_gian: 'asc' },
    });
  const hopDong = (don_vi_id: string) =>
    prisma.hop_dong_boi_duong.findUnique({
      where: {
        dot_trien_khai_id_don_vi_id: { dot_trien_khai_id: dot.nls, don_vi_id },
      },
    });

  async function dangNhap(ten_dang_nhap: string) {
    const res = await http()
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap, mat_khau: MAT_KHAU })
      .expect(200);
    return res.body.token as string;
  }

  async function taoTaiKhoan(
    vaiTro: VaiTro,
    vai_tro: 'quan_tri' | 'truong' | 'so_gddt',
    don_vi_id: string,
  ) {
    const u = await taoNguoiDungTest({
      vai_tro,
      don_vi_id,
      mat_khau: MAT_KHAU,
    });
    nguoiDung.push(u);
    token[vaiTro] = await dangNhap(u.ten_dang_nhap);
    userId[vaiTro] = u.nguoiDung.id;
  }

  async function taoDonVi(
    ten: string,
    loai: 'so_gddt' | 'truong' | 'phong_vhxh',
    cha: string | null,
  ) {
    const dv = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `CDSN-${uniqueSuffix()}`,
        ten_don_vi: `${ten} ${suf}`,
        loai_don_vi: loai,
        dia_ban_id: fixture.diaDanhXa.id,
        don_vi_cha_id: cha,
        trang_thai: 'active',
      },
    });
    donViIds.push(dv.id);
    return dv.id;
  }

  async function taoDot(ten: string, chuong_trinh: 'nls' | 'hsg') {
    const d = await prisma.dot_trien_khai.create({
      data: {
        chuong_trinh,
        ten,
        don_gia: 1_000_000,
        han_nop: new Date('2026-12-31T16:59:59Z'),
        so_gddt_id: ids.so,
      },
    });
    dotIds.push(d.id);
    return d.id;
  }

  async function taoKhoa(k: MaKhoaTest, donViDatHang: string, batDau: string) {
    maKhoa[k] = `CDSN-${k.toUpperCase()}-${suf}`;
    const kh = await prisma.khoa_boi_duong.create({
      data: {
        ma_khoa: maKhoa[k],
        ten_khoa: `Khóa NLS bịa ${k.toUpperCase()}`,
        don_vi_dat_hang_id: donViDatHang,
        thoi_gian_bat_dau: new Date(`${batDau}T00:00:00Z`),
        thoi_gian_ket_thuc: new Date('2026-12-31T00:00:00Z'),
        trang_thai: 'da_duyet',
      },
    });
    khoaIds.push(kh.id);
    khoa[k] = kh.id;
    return kh.id;
  }

  async function taoGiaiDoan(
    khoaId: string,
    thu_tu: number,
    hinh_thuc: 'danh_gia' | 'truc_tuyen' = 'truc_tuyen',
  ) {
    const g = await prisma.giai_doan_khoa.create({
      data: {
        khoa_id: khoaId,
        thu_tu,
        ten_giai_doan: `Giai đoạn ${thu_tu}`,
        hinh_thuc,
        thoi_gian_bat_dau: new Date('2026-03-01T00:00:00Z'),
        thoi_gian_ket_thuc: new Date('2026-12-31T00:00:00Z'),
      },
    });
    return g.id;
  }

  /** Lớp + 1 buổi trong giai đoạn → giai đoạn đó là "giai đoạn học". */
  async function taoLop(khoaId: string, giaiDoanId: string, ten: string) {
    const l = await prisma.lop_hoc.create({
      data: { khoa_id: khoaId, loai_lop: 'zoom', ten_lop: ten },
    });
    await prisma.lich_hoc_lop.create({
      data: {
        lop_id: l.id,
        giai_doan_id: giaiDoanId,
        thoi_gian_bat_dau: new Date('2026-04-01T01:00:00Z'),
        thoi_gian_ket_thuc: new Date('2026-04-01T04:00:00Z'),
      },
    });
    return l.id;
  }

  async function taoHocVien(ma: string, donViId: string) {
    const h = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: `CDSN${ma}${suf}`,
        ho_ten: `GV Bịa ${ma} ${suf}`,
        ngay_sinh: 4,
        thang_sinh: 3,
        nam_sinh: 1991,
        gioi_tinh: 'Nữ',
        don_vi_cong_tac_id: donViId,
        trang_thai: 'da_duyet',
        nguoi_duyet_id: userId.quanTri,
        cap_duyet_thuc_te: 'quan_tri',
        ngay_duyet: new Date(),
      },
    });
    hocVienIds.push(h.id);
    hv[ma] = h.id;
    return h.id;
  }

  async function ghiDanh(
    ma: string,
    khoaId: string,
    phanLop: [string, string][],
    trang_thai: 'da_duyet' | 'tu_choi' | 'da_phan_lop' = 'da_phan_lop',
  ) {
    const d = await prisma.dang_ky_hoc.create({
      data: { hoc_vien_id: hv[ma], khoa_id: khoaId, trang_thai },
    });
    dangKyIds.push(d.id);
    dk[`${ma}-${khoaId}`] = d.id;
    for (const [giai_doan_id, lop_id] of phanLop) {
      await prisma.phan_lop_giai_doan.create({
        data: { dang_ky_hoc_id: d.id, giai_doan_id, lop_id },
      });
    }
    return d.id;
  }

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    fixture = await taoDonViTest('cdsn');
    ids.so = await taoDonVi('Sở chụp NLS', 'so_gddt', null);
    ids.so2 = await taoDonVi('Sở khác chụp NLS', 'so_gddt', null);
    ids.tA = await taoDonVi('Trường A Chụp Bịa', 'truong', ids.so);
    ids.tB = await taoDonVi('Trường B Chụp Bịa', 'truong', ids.so);
    ids.phong = await taoDonVi('Phòng Chụp Bịa', 'phong_vhxh', ids.so);
    dot.nls = await taoDot(tenDotNls, 'nls');
    dot.nls2 = await taoDot(`NLS thứ hai ${suf}`, 'nls');
    dot.hsg = await taoDot(`HSG chụp ${suf}`, 'hsg');

    await taoTaiKhoan('quanTri', 'quan_tri', fixture.donVi.id);
    await taoTaiKhoan('truong', 'truong', ids.tA);
    await taoTaiKhoan('so', 'so_gddt', ids.so);

    await taoKhoa('k1', ids.so, '2026-03-01');
    gd.k1DanhGia = await taoGiaiDoan(khoa.k1, 1, 'danh_gia');
    gd.k1G1 = await taoGiaiDoan(khoa.k1, 2);
    gd.k1G2 = await taoGiaiDoan(khoa.k1, 3);
    lop.l1 = await taoLop(khoa.k1, gd.k1G1, 'Lớp L1');
    lop.l2 = await taoLop(khoa.k1, gd.k1G2, 'Lớp L2');
    // K2 do trường A (trực thuộc Sở) đặt hàng — vẫn trong phạm vi.
    await taoKhoa('k2', ids.tA, '2026-05-01');
    gd.k2G1 = await taoGiaiDoan(khoa.k2, 1);
    lop.l3 = await taoLop(khoa.k2, gd.k2G1, 'Lớp L3');
    await taoKhoa('k3', ids.so2, '2026-03-01');
    await taoKhoa('k4', ids.so, '2026-03-01');
    for (const t of [1, 2, 3]) {
      const g = await taoGiaiDoan(khoa.k4, t);
      await taoLop(khoa.k4, g, `Lớp K4-${t}`);
    }

    for (const [ma, dv] of [
      ['hv1', ids.tA],
      ['hv2', ids.tA],
      ['hv3', ids.tB],
      ['hv4', ids.tA],
      ['hv5', ids.tB],
      ['hv6', ids.phong],
      ['hv7', ids.tA],
      ['hv8', ids.tB],
    ]) {
      await taoHocVien(ma, dv);
    }
    await ghiDanh('hv1', khoa.k1, [
      [gd.k1G1, lop.l1],
      [gd.k1G2, lop.l2],
    ]);
    await ghiDanh('hv2', khoa.k1, [[gd.k1G1, lop.l1]]);
    await ghiDanh('hv3', khoa.k1, [[gd.k1G2, lop.l2]]);
    await ghiDanh('hv4', khoa.k1, [], 'da_duyet');
    await ghiDanh('hv5', khoa.k1, [[gd.k1G1, lop.l1]], 'tu_choi');
    await ghiDanh('hv6', khoa.k1, [
      [gd.k1G1, lop.l1],
      [gd.k1G2, lop.l2],
    ]);
    await ghiDanh('hv7', khoa.k1, [[gd.k1G1, lop.l1]]);
    await ghiDanh('hv7', khoa.k2, [[gd.k2G1, lop.l3]]);
  });

  afterAll(async () => {
    // Chỉ xóa đúng các dòng file này tạo (theo id đã ghi; mảng rỗng thì bỏ qua).
    // nhat_ky_hoat_dong chỉ cho thêm (trigger chặn xóa) — để nguyên.
    if (dangKyIds.length > 0) {
      await prisma.phan_lop_giai_doan.deleteMany({
        where: { dang_ky_hoc_id: { in: dangKyIds } },
      });
      await prisma.dang_ky_hoc.deleteMany({ where: { id: { in: dangKyIds } } });
    }
    if (khoaIds.length > 0) {
      await prisma.khoa_boi_duong.updateMany({
        where: { id: { in: khoaIds } },
        data: { dot_trien_khai_id: null },
      });
      // Xóa khóa kéo theo giai đoạn, lớp, lịch học (ON DELETE CASCADE).
      await prisma.khoa_boi_duong.deleteMany({
        where: { id: { in: khoaIds } },
      });
    }
    if (dotIds.length > 0) {
      await prisma.de_nghi_sua_danh_sach.deleteMany({
        where: { dot_trien_khai_id: { in: dotIds } },
      });
      await prisma.danh_sach_tham_gia.deleteMany({
        where: { dot_trien_khai_id: { in: dotIds } },
      });
      await prisma.hop_dong_boi_duong.deleteMany({
        where: { dot_trien_khai_id: { in: dotIds } },
      });
      await prisma.dot_trien_khai.deleteMany({ where: { id: { in: dotIds } } });
    }
    if (hocVienIds.length > 0) {
      await prisma.hoc_vien.deleteMany({ where: { id: { in: hocVienIds } } });
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
    it('401 khi không có token', async () => {
      await http().get(url(dot.nls, 'khoa-co-the-gan')).expect(401);
      await http().put(url(dot.nls, 'khoa')).send({ khoa_ids: [] }).expect(401);
      await http()
        .post(url(dot.nls, 'danh-sach/lay-tu-khoa/xem-truoc'))
        .expect(401);
      await http().post(url(dot.nls, 'danh-sach/lay-tu-khoa')).expect(401);
    });

    it('403 cho trường và Sở', async () => {
      for (const t of [token.truong, token.so]) {
        await http()
          .get(url(dot.nls, 'khoa-co-the-gan'))
          .set(auth(t))
          .expect(403);
        await http()
          .put(url(dot.nls, 'khoa'))
          .set(auth(t))
          .send({ khoa_ids: [khoa.k1] })
          .expect(403);
        await xemTruoc(dot.nls, t).expect(403);
        await chup(dot.nls, t).expect(403);
      }
      const k1 = await prisma.khoa_boi_duong.findUniqueOrThrow({
        where: { id: khoa.k1 },
      });
      expect(k1.dot_trien_khai_id).toBeNull();
    });
  });

  describe('Gắn khóa NLS vào đợt', () => {
    it('khoa-co-the-gan: khóa trong cây Sở (kể cả trường đặt hàng), không có khóa Sở khác', async () => {
      const res = await http()
        .get(url(dot.nls, 'khoa-co-the-gan'))
        .set(auth(token.quanTri))
        .expect(200);
      const cuaTest = (res.body as { id: string }[]).filter((k) =>
        khoaIds.includes(k.id),
      );
      expect(cuaTest.map((k) => k.id).sort()).toEqual(
        [khoa.k1, khoa.k2, khoa.k4].sort(),
      );
      expect(cuaTest.find((k) => k.id === khoa.k1)).toEqual({
        id: khoa.k1,
        ma_khoa: maKhoa.k1,
        ten_khoa: 'Khóa NLS bịa K1',
        thoi_gian_bat_dau: '2026-03-01',
        thoi_gian_ket_thuc: '2026-12-31',
        trang_thai: 'da_duyet',
        dot_trien_khai_id: null,
        dot_trien_khai_ten: null,
      });
    });

    it('gắn K1, K2 → 200, trả đợt kèm khóa theo ngày bắt đầu; GET đợt / danh sách đợt có khóa', async () => {
      const res = await ganKhoa(dot.nls, [khoa.k2, khoa.k1]).expect(200);
      expect(res.body.id).toBe(dot.nls);
      expect(res.body.khoa).toEqual([
        {
          id: khoa.k1,
          ma_khoa: maKhoa.k1,
          ten_khoa: 'Khóa NLS bịa K1',
          thoi_gian_bat_dau: '2026-03-01',
          thoi_gian_ket_thuc: '2026-12-31',
        },
        expect.objectContaining({ id: khoa.k2, ma_khoa: maKhoa.k2 }),
      ]);
      const mot = await http()
        .get(`/cong-don-vi/dot-trien-khai/${dot.nls}`)
        .set(auth(token.quanTri))
        .expect(200);
      expect(mot.body.khoa.map((k: { id: string }) => k.id)).toEqual([
        khoa.k1,
        khoa.k2,
      ]);
      const ds = await http()
        .get('/cong-don-vi/dot-trien-khai')
        .set(auth(token.quanTri))
        .expect(200);
      const hsg = ds.body.find((d: { id: string }) => d.id === dot.hsg);
      expect(hsg.khoa).toEqual([]);
      const nk = await nhatKy('gan_khoa_dot_trien_khai', dot.nls);
      expect(nk).toHaveLength(1);
      expect(nk[0].chi_tiet).toEqual({
        dot_trien_khai_id: dot.nls,
        truoc: [],
        sau: [khoa.k1, khoa.k2].sort(),
      });
    });

    it('gắn lại đúng tập cũ → 200, không ghi nhật ký', async () => {
      await ganKhoa(dot.nls, [khoa.k1, khoa.k2]).expect(200);
      expect(await nhatKy('gan_khoa_dot_trien_khai', dot.nls)).toHaveLength(1);
    });

    it('khóa của Sở khác → 400 field khoa_ids, không đổi gì', async () => {
      const res = await ganKhoa(dot.nls, [khoa.k1, khoa.k2, khoa.k3]).expect(
        400,
      );
      expect(res.body.error.message).toContain(maKhoa.k3);
      expect(res.body.error.fields[0].field).toBe('khoa_ids');
      const k3 = await prisma.khoa_boi_duong.findUniqueOrThrow({
        where: { id: khoa.k3 },
      });
      expect(k3.dot_trien_khai_id).toBeNull();
    });

    it('khóa không tồn tại / id sai định dạng → 400', async () => {
      await ganKhoa(dot.nls, ['00000000-0000-4000-8000-000000000000']).expect(
        400,
      );
      await ganKhoa(dot.nls, ['khong-phai-uuid']).expect(400);
      await http()
        .put(url(dot.nls, 'khoa'))
        .set(auth(token.quanTri))
        .send({})
        .expect(400);
    });

    it('K1 đã gắn đợt khác → 409 nêu khóa + đợt; không đổi gì', async () => {
      const res = await ganKhoa(dot.nls2, [khoa.k1]).expect(409);
      expect(res.body.error.message).toContain(maKhoa.k1);
      expect(res.body.error.message).toContain(tenDotNls);
      const k1 = await prisma.khoa_boi_duong.findUniqueOrThrow({
        where: { id: khoa.k1 },
      });
      expect(k1.dot_trien_khai_id).toBe(dot.nls);
      const ds = await http()
        .get(url(dot.nls2, 'khoa-co-the-gan'))
        .set(auth(token.quanTri))
        .expect(200);
      expect(ds.body.find((k: { id: string }) => k.id === khoa.k1)).toEqual(
        expect.objectContaining({
          dot_trien_khai_id: dot.nls,
          dot_trien_khai_ten: tenDotNls,
        }),
      );
    });

    it('đợt HSG → 400 (gắn và danh sách chọn)', async () => {
      await ganKhoa(dot.hsg, [khoa.k1]).expect(400);
      await http()
        .get(url(dot.hsg, 'khoa-co-the-gan'))
        .set(auth(token.quanTri))
        .expect(400);
    });

    it('bỏ khóa khỏi tập → dot_trien_khai_id NULL; gắn lại được', async () => {
      await ganKhoa(dot.nls, [khoa.k1]).expect(200);
      const k2 = await prisma.khoa_boi_duong.findUniqueOrThrow({
        where: { id: khoa.k2 },
      });
      expect(k2.dot_trien_khai_id).toBeNull();
      await ganKhoa(dot.nls, [khoa.k1, khoa.k2]).expect(200);
      const nk = await nhatKy('gan_khoa_dot_trien_khai', dot.nls);
      expect(nk.map((n) => n.chi_tiet)).toEqual([
        expect.anything(),
        {
          dot_trien_khai_id: dot.nls,
          truoc: [khoa.k1, khoa.k2].sort(),
          sau: [khoa.k1],
        },
        {
          dot_trien_khai_id: dot.nls,
          truoc: [khoa.k1],
          sau: [khoa.k1, khoa.k2].sort(),
        },
      ]);
    });
  });

  describe('Lấy danh sách từ khóa - lỗi', () => {
    it('đợt chưa gắn khóa → 400', async () => {
      for (const res of [await xemTruoc(dot.nls2), await chup(dot.nls2)]) {
        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('chưa gắn khóa');
      }
    });

    it('đợt HSG → 400 "nạp bằng Excel"', async () => {
      for (const res of [await xemTruoc(dot.hsg), await chup(dot.hsg)]) {
        expect(res.status).toBe(400);
        expect(res.body.error.message).toBe('Đợt HSG nạp danh sách bằng Excel');
      }
    });

    it('khóa > 2 giai đoạn học → 400 nêu mã khóa, không ghi gì', async () => {
      await ganKhoa(dot.nls2, [khoa.k4]).expect(200);
      for (const res of [await xemTruoc(dot.nls2), await chup(dot.nls2)]) {
        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain(maKhoa.k4);
      }
      expect(
        await prisma.danh_sach_tham_gia.count({
          where: { dot_trien_khai_id: dot.nls2 },
        }),
      ).toBe(0);
      await ganKhoa(dot.nls2, []).expect(200);
    });

    it('nạp Excel vẫn chỉ cho HSG', async () => {
      const res = await http()
        .post(url(dot.nls, 'danh-sach/nap'))
        .set(auth(token.quanTri))
        .send({ dong: [] });
      expect(res.status).toBe(400);
    });
  });

  describe('Xem trước + chụp lần đầu', () => {
    it('xem trước: số dòng/trường/suất, bỏ qua (chưa phân lớp, ngoài phạm vi, trùng khóa); không ghi gì', async () => {
      const res = await xemTruoc(dot.nls).expect(200);
      expect(res.body).toEqual({
        so_khoa: 2,
        so_dong: 4,
        so_truong: 2,
        tong_suat: 3,
        truong: [
          {
            don_vi_id: ids.tA,
            ten: `Trường A Chụp Bịa ${suf}`,
            ma: expect.any(String),
            so_dong_moi: 3,
            so_dong_cu: 0,
            tong_suat_moi: 2.5,
            da_nop: false,
            co_de_nghi_cho: false,
          },
          expect.objectContaining({
            don_vi_id: ids.tB,
            so_dong_moi: 1,
            so_dong_cu: 0,
            tong_suat_moi: 0.5,
          }),
        ],
        bo_qua: {
          chua_phan_lop: 1,
          ngoai_pham_vi: [
            {
              hoc_vien_id: hv.hv6,
              ho_ten: `GV Bịa hv6 ${suf}`,
              don_vi_ten: `Phòng Chụp Bịa ${suf}`,
              ly_do: 'Đơn vị công tác không phải trường',
            },
          ],
          trung_khoa: 1,
        },
        truong_bi_xoa: [],
      });
      expect(
        await prisma.danh_sach_tham_gia.count({
          where: { dot_trien_khai_id: dot.nls },
        }),
      ).toBe(0);
      expect(
        await prisma.hop_dong_boi_duong.count({
          where: { dot_trien_khai_id: dot.nls },
        }),
      ).toBe(0);
    });

    it('chụp: dòng đúng giai đoạn/suất/lớp/mã gốc/hoc_vien_id, có hợp đồng A, B; tổng suất chính xác; nhật ký', async () => {
      const res = await chup(dot.nls).expect(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          so_khoa: 2,
          so_dong: 4,
          so_truong: 2,
          so_dong_da_ghi: 4,
          so_truong_da_thay: 2,
          so_de_nghi_tu_choi: 0,
          giu_nguyen_da_nop: [],
        }),
      );
      const dongA = await dongCua(dot.nls, ids.tA);
      expect(
        dongA.map((d) => ({
          hoc_vien_id: d.hoc_vien_id,
          ho_ten: d.ho_ten,
          ngay_sinh: d.ngay_sinh?.toISOString().slice(0, 10),
          gioi_tinh: d.gioi_tinh,
          ma_goc: d.ma_goc,
          lop: d.lop,
          giai_doan: d.giai_doan,
          ty_le_suat: Number(d.ty_le_suat),
          ghi_chu: d.ghi_chu,
          y_kien_truong: d.y_kien_truong,
        })),
      ).toEqual([
        {
          hoc_vien_id: hv.hv1,
          ho_ten: `GV Bịa hv1 ${suf}`,
          ngay_sinh: '1991-03-04',
          gioi_tinh: 'Nữ',
          ma_goc: `CDSNhv1${suf}`,
          lop: 'Lớp L1, Lớp L2',
          giai_doan: 'ca_hai',
          ty_le_suat: 1,
          ghi_chu: null,
          y_kien_truong: null,
        },
        expect.objectContaining({
          hoc_vien_id: hv.hv2,
          lop: 'Lớp L1',
          giai_doan: 'chi_gd1',
          ty_le_suat: 0.5,
        }),
        expect.objectContaining({
          hoc_vien_id: hv.hv7,
          lop: 'Lớp L3',
          giai_doan: 'ca_hai',
          ty_le_suat: 1,
          ghi_chu: `Cũng ghi danh khóa ${maKhoa.k1}`,
        }),
      ]);
      const dongB = await dongCua(dot.nls, ids.tB);
      expect(dongB).toHaveLength(1);
      expect(dongB[0]).toEqual(
        expect.objectContaining({
          hoc_vien_id: hv.hv3,
          lop: 'Lớp L2',
          giai_doan: 'chi_gd2',
          ma_goc: `CDSNhv3${suf}`,
        }),
      );
      expect(Number(dongB[0].ty_le_suat)).toBe(0.5);
      expect(
        await prisma.danh_sach_tham_gia.count({
          where: { dot_trien_khai_id: dot.nls, hoc_vien_id: hv.hv6 },
        }),
      ).toBe(0);

      for (const id of [ids.tA, ids.tB]) {
        const h = await hopDong(id);
        expect(h?.trang_thai_danh_sach).toBe('cho_xac_nhan');
        expect(h?.thao_tac_cuoi_boi).toBe(userId.quanTri);
      }
      const ds = await http()
        .get(url(dot.nls, 'danh-sach'))
        .set(auth(token.quanTri))
        .expect(200);
      const tongHop = new Map(
        (ds.body.tong_hop as { don_vi_id: string; tong_suat: number }[]).map(
          (t) => [t.don_vi_id, t.tong_suat],
        ),
      );
      expect(tongHop.get(ids.tA)).toBe(2.5);
      expect(tongHop.get(ids.tB)).toBe(0.5);

      const nk = await nhatKy('lay_danh_sach_tu_khoa', dot.nls);
      expect(nk).toHaveLength(1);
      const ct = nk[0].chi_tiet as Record<string, unknown>;
      expect(ct).toEqual({
        dot_trien_khai_id: dot.nls,
        khoa_ids: [khoa.k1, khoa.k2],
        so_truong: 2,
        so_dong: 4,
        so_bo_qua: 2,
        giu_nguyen_da_nop: [],
      });
      expect(JSON.stringify(ct)).not.toContain('GV Bịa');
    });

    it('bản chụp không đọc sống: sửa phân lớp / họ tên học viên / gỡ khóa sau khi chụp không đổi dòng', async () => {
      const truoc = await prisma.danh_sach_tham_gia.findMany({
        where: { dot_trien_khai_id: dot.nls },
        orderBy: { id: 'asc' },
      });
      await prisma.phan_lop_giai_doan.deleteMany({
        where: { dang_ky_hoc_id: dk[`hv1-${khoa.k1}`], giai_doan_id: gd.k1G2 },
      });
      await prisma.hoc_vien.update({
        where: { id: hv.hv2 },
        data: { ho_ten: `GV Bịa Đổi Tên ${suf}` },
      });
      await ganKhoa(dot.nls, [khoa.k1]).expect(200);
      const sau = await prisma.danh_sach_tham_gia.findMany({
        where: { dot_trien_khai_id: dot.nls },
        orderBy: { id: 'asc' },
      });
      expect(sau).toEqual(truoc);
      await ganKhoa(dot.nls, [khoa.k1, khoa.k2]).expect(200);
    });

    it('Quản trị sửa dòng NLS như trước (bắt buộc lý do)', async () => {
      const [d] = await dongCua(dot.nls, ids.tB);
      const res = await http()
        .patch(`/cong-don-vi/danh-sach-tham-gia/${d.id}`)
        .set(auth(token.quanTri))
        .send({ ghi_chu: 'Ghi chú bịa', ly_do: 'Bổ sung ghi chú' })
        .expect(200);
      expect(res.body.ghi_chu).toBe('Ghi chú bịa');
      expect(res.body.hoc_vien_id).toBe(hv.hv3);
    });
  });

  describe('Chụp lại: trường đã nộp giữ nguyên, trường khác thay', () => {
    let dongACu: Awaited<ReturnType<typeof dongCua>>;
    let deNghiId: string;

    beforeAll(async () => {
      // A đã nộp hợp đồng (cột bản chụp theo CHECK chk_hop_dong_da_nop_co_ban_chup).
      await prisma.hop_dong_boi_duong.update({
        where: {
          dot_trien_khai_id_don_vi_id: {
            dot_trien_khai_id: dot.nls,
            don_vi_id: ids.tA,
          },
        },
        data: {
          trang_thai_hop_dong: 'da_nop',
          nop_luc: new Date(),
          nop_boi: userId.truong,
          ban_chup_ho_so: {},
          so_nguoi_luc_nop: 3,
          tong_suat_luc_nop: 2.5,
          don_gia_luc_nop: 1_000_000,
          gia_tri_luc_nop: 2_500_000,
        },
      });
      dongACu = await dongCua(dot.nls, ids.tA);
      // B: đã xác nhận, dòng có ý kiến + 1 đề nghị sửa đang chờ.
      const [dongB] = await dongCua(dot.nls, ids.tB);
      await prisma.danh_sach_tham_gia.update({
        where: { id: dongB.id },
        data: { y_kien_truong: 'dong_y' },
      });
      await prisma.hop_dong_boi_duong.update({
        where: {
          dot_trien_khai_id_don_vi_id: {
            dot_trien_khai_id: dot.nls,
            don_vi_id: ids.tB,
          },
        },
        data: { trang_thai_danh_sach: 'da_xac_nhan' },
      });
      const dn = await prisma.de_nghi_sua_danh_sach.create({
        data: {
          dot_trien_khai_id: dot.nls,
          don_vi_id: ids.tB,
          dong_id: dongB.id,
          loai: 'sua',
          gia_tri: { ho_ten: 'Tên Đề Nghị Bịa' },
          ly_do: 'Sai chính tả',
          gui_boi: userId.truong,
        },
      });
      deNghiId = dn.id;
      // Dữ liệu ghi danh đổi: hv8 (B) học đủ K1; hv1 (A) đã bị gỡ GĐ2 ở test trước.
      await ghiDanh('hv8', khoa.k1, [
        [gd.k1G1, lop.l1],
        [gd.k1G2, lop.l2],
      ]);
    });

    it('xem trước: A đã nộp (giữ nguyên), B có đề nghị chờ, số mới/cũ', async () => {
      const res = await xemTruoc(dot.nls).expect(200);
      const truong = new Map(
        (res.body.truong as { don_vi_id: string }[]).map((t) => [
          t.don_vi_id,
          t,
        ]),
      );
      expect(truong.get(ids.tA)).toEqual(
        expect.objectContaining({
          so_dong_moi: 3,
          so_dong_cu: 3,
          tong_suat_moi: 2,
          da_nop: true,
          co_de_nghi_cho: false,
        }),
      );
      expect(truong.get(ids.tB)).toEqual(
        expect.objectContaining({
          so_dong_moi: 2,
          so_dong_cu: 1,
          tong_suat_moi: 1.5,
          da_nop: false,
          co_de_nghi_cho: true,
        }),
      );
      expect(res.body.truong_bi_xoa).toEqual([]);
    });

    it('chụp lại: A giữ nguyên (id + giá trị), B thay, đề nghị chờ tự Từ chối, B về Chờ xác nhận', async () => {
      const hdATruoc = await hopDong(ids.tA);
      const res = await chup(dot.nls).expect(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          so_dong_da_ghi: 2,
          so_truong_da_thay: 1,
          so_de_nghi_tu_choi: 1,
          giu_nguyen_da_nop: [
            { don_vi_id: ids.tA, ten_don_vi: `Trường A Chụp Bịa ${suf}` },
          ],
        }),
      );
      expect(await dongCua(dot.nls, ids.tA)).toEqual(dongACu);
      expect(await hopDong(ids.tA)).toEqual(hdATruoc);

      const dongB = await dongCua(dot.nls, ids.tB);
      expect(dongB.map((d) => [d.hoc_vien_id, d.giai_doan])).toEqual([
        [hv.hv3, 'chi_gd2'],
        [hv.hv8, 'ca_hai'],
      ]);
      expect(dongB.every((d) => d.y_kien_truong === null)).toBe(true);
      const dn = await prisma.de_nghi_sua_danh_sach.findUniqueOrThrow({
        where: { id: deNghiId },
      });
      expect(dn.trang_thai).toBe('tu_choi');
      expect(dn.ly_do_tu_choi).toBe('Quản trị đã chụp lại danh sách từ khóa');
      expect(dn.xu_ly_boi).toBe(userId.quanTri);
      const hdB = await hopDong(ids.tB);
      expect(hdB?.trang_thai_danh_sach).toBe('cho_xac_nhan');

      const tuChoi = await nhatKy('tu_choi_de_nghi_sua_danh_sach', dot.nls);
      expect(tuChoi.map((n) => n.chi_tiet)).toEqual([
        expect.objectContaining({
          de_nghi_id: deNghiId,
          don_vi_id: ids.tB,
          ly_do: 'Quản trị đã chụp lại danh sách từ khóa',
        }),
      ]);
      const nk = await nhatKy('lay_danh_sach_tu_khoa', dot.nls);
      expect(nk).toHaveLength(2);
      expect(nk[1].chi_tiet).toEqual(
        expect.objectContaining({
          so_truong: 1,
          so_dong: 2,
          giu_nguyen_da_nop: [ids.tA],
        }),
      );
    });

    it('trường chưa nộp mất hết người trong bản chụp mới → cảnh báo truong_bi_xoa; chụp thì danh sách rỗng, hợp đồng còn', async () => {
      await prisma.dang_ky_hoc.updateMany({
        where: {
          id: { in: [dk[`hv3-${khoa.k1}`], dk[`hv8-${khoa.k1}`]] },
        },
        data: { trang_thai: 'tu_choi' },
      });
      const xt = await xemTruoc(dot.nls).expect(200);
      expect(xt.body.truong_bi_xoa).toEqual([
        expect.objectContaining({
          don_vi_id: ids.tB,
          so_dong_moi: 0,
          so_dong_cu: 2,
        }),
      ]);
      await chup(dot.nls).expect(200);
      expect(await dongCua(dot.nls, ids.tB)).toEqual([]);
      expect(await hopDong(ids.tB)).not.toBeNull();
      expect(await dongCua(dot.nls, ids.tA)).toEqual(dongACu);
    });
  });

  describe('Hiệu năng', () => {
    const SO_GHI_DANH = 9000;

    it('9.000 ghi danh: xem trước + chụp trong 1 transaction, đúng số dòng/suất', async () => {
      const dotLon = await taoDot(`NLS lớn ${suf}`, 'nls');
      const kId = await taoKhoa('k5', ids.so, '2026-06-01');
      const g1 = await taoGiaiDoan(kId, 1);
      const g2 = await taoGiaiDoan(kId, 2);
      const l1 = await taoLop(kId, g1, 'Lớp Lớn 1');
      const l2 = await taoLop(kId, g2, 'Lớp Lớn 2');
      const hvLon = Array.from({ length: SO_GHI_DANH }, (_, i) => ({
        id: randomUUID(),
        nguon_tao: 'import_moet' as const,
        ma_dinh_danh_moet: `CL${i}${suf}`,
        ho_ten: `GV Bịa Lớn ${i}`,
        ngay_sinh: 1,
        thang_sinh: 1,
        nam_sinh: 1990,
        don_vi_cong_tac_id: i % 2 === 0 ? ids.tA : ids.tB,
        trang_thai: 'da_duyet' as const,
        nguoi_duyet_id: userId.quanTri,
        cap_duyet_thuc_te: 'quan_tri' as const,
        ngay_duyet: new Date(),
      }));
      hocVienIds.push(...hvLon.map((h) => h.id));
      await prisma.hoc_vien.createMany({ data: hvLon });
      const dkLon = hvLon.map((h) => ({
        id: randomUUID(),
        hoc_vien_id: h.id,
        khoa_id: kId,
        trang_thai: 'da_phan_lop' as const,
      }));
      dangKyIds.push(...dkLon.map((d) => d.id));
      await prisma.dang_ky_hoc.createMany({ data: dkLon });
      // Mọi người học GĐ1; 2/3 học thêm GĐ2 → 6.000 × 1 + 3.000 × 0,5 = 7.500 suất.
      await prisma.phan_lop_giai_doan.createMany({
        data: [
          ...dkLon.map((d) => ({
            dang_ky_hoc_id: d.id,
            giai_doan_id: g1,
            lop_id: l1,
          })),
          ...dkLon
            .filter((_, i) => i % 3 !== 0)
            .map((d) => ({
              dang_ky_hoc_id: d.id,
              giai_doan_id: g2,
              lop_id: l2,
            })),
        ],
      });
      await ganKhoa(dotLon, [kId]).expect(200);

      const xt = await xemTruoc(dotLon).expect(200);
      expect(xt.body).toEqual(
        expect.objectContaining({ so_dong: SO_GHI_DANH, tong_suat: 7500 }),
      );
      const batDau = Date.now();
      const res = await chup(dotLon).expect(200);
      expect(Date.now() - batDau).toBeLessThan(60000);
      expect(res.body.so_dong_da_ghi).toBe(SO_GHI_DANH);
      expect(
        await prisma.danh_sach_tham_gia.count({
          where: { dot_trien_khai_id: dotLon },
        }),
      ).toBe(SO_GHI_DANH);
      // Chụp lại lần 2 (xóa + chèn lại) vẫn trong giới hạn.
      await chup(dotLon).expect(200);
    }, 180000);
  });
});
