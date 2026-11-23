import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoDonViTest,
  taoNguoiDungTest,
  uniqueSuffix,
  xoaDonViTest,
  xoaNguoiDungTest,
} from './utils/test-data';

// Issue #65 / ADR 0015 X7, T5, M5: bảng Tiến độ đợt (số liệu, lọc) + Excel trường chưa xong kèm người liên hệ.
// Dữ liệu dựng thẳng bằng prisma để cố định từng trạng thái. Mọi tên, SĐT, email đều BỊA.
describe('Tiến độ đợt - Cổng đơn vị (e2e)', () => {
  let app: INestApplication;
  let fixture: Awaited<ReturnType<typeof taoDonViTest>>;
  type NguoiDungTest = Awaited<ReturnType<typeof taoNguoiDungTest>>;
  const nguoiDung: NguoiDungTest[] = [];
  type VaiTro = 'quanTri' | 'truong' | 'so';
  const token = {} as Record<VaiTro, string>;
  const user = {} as Record<VaiTro, NguoiDungTest>;

  const suf = uniqueSuffix();
  const MAT_KHAU = 'MatKhau123';
  const DON_GIA = 1_234_567;
  const donViIds: string[] = [];
  const dotIds: string[] = [];
  const deNghiIds: string[] = [];
  type Truong = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  const tr = {} as Record<Truong, string>;
  const ten = {} as Record<Truong, string>;
  let soId = '';
  let dot1 = '';
  let dot2 = '';

  const LUC_C = new Date('2026-11-18T02:30:00Z');
  const LUC_D_THAO_TAC = new Date('2026-11-19T03:00:00Z');
  const LUC_D_NOP = new Date('2026-11-19T03:04:00Z');
  const HO_SO_C = {
    ten_truong: 'Trường C Bịa',
    dia_chi: 'Ấp Bịa, xã Thử, tỉnh Giả',
    ma_so_thue: '0000000001',
    nguoi_dai_dien: 'Người Liên Hệ C Bịa',
    sdt_dai_dien: '0900000011',
    email_hoa_don: `lienhe-c-${suf}@mau.test`,
    so_tai_khoan: '0000111122223333',
    ngan_hang: 'Ngân hàng Giả',
    chi_nhanh: 'Chi nhánh Giả',
    kho_bac: 'Kho bạc Giả',
    mst_kho_bac: '0000000001-001',
    ma_qhns: '7654321',
    ma_nguon: '13',
    ht_ho_ten: 'Hiệu Trưởng Bịa',
    ht_so_tai_khoan: '9999888877776666',
    ht_ngan_hang: 'Ngân hàng Giả – CN Thử',
    kt_ho_ten: 'Kế Toán Bịa',
    kt_sdt: '0900000012',
    kt_so_tai_khoan: '5555444433332222',
    kt_ngan_hang: 'Ngân hàng Giả – CN Thử',
    dau_moi_csvc: 'Đầu Mối Bịa',
  };
  // A khai dở: có người liên hệ nhưng thiếu các mục khác.
  const HO_SO_A = {
    nguoi_dai_dien: 'Người Liên Hệ A Bịa',
    sdt_dai_dien: '0900000021',
  };

  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const urlTienDo = (dotId: string) =>
    `/cong-don-vi/dot-trien-khai/${dotId}/tien-do`;
  const urlXuat = (dotId: string) => `${urlTienDo(dotId)}/xuat-excel`;
  const layTienDo = (dotId: string, loc?: string) => {
    const req = http().get(urlTienDo(dotId)).set(auth(token.quanTri));
    return loc === undefined ? req : req.query({ loc });
  };
  const taiExcel = (dotId: string, loc?: string, vaiTro: VaiTro = 'quanTri') =>
    http()
      .get(urlXuat(dotId))
      .query(loc === undefined ? {} : { loc })
      .set(auth(token[vaiTro]))
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });

  async function docSheet(buf: Buffer) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    const sh = wb.worksheets[0];
    const dong: unknown[][] = [];
    sh.eachRow((r) => dong.push((r.values as unknown[]).slice(1)));
    return { wb, sh, dong };
  }

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
    user[vaiTro] = u;
    token[vaiTro] = await dangNhap(u.ten_dang_nhap);
  }

  async function taoDonVi(
    tenDv: string,
    loai: 'so_gddt' | 'truong',
    cha: string | null,
  ) {
    const dv = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `TDD-${uniqueSuffix()}`,
        ten_don_vi: tenDv,
        loai_don_vi: loai,
        dia_ban_id: fixture.diaDanhXa.id,
        don_vi_cha_id: cha,
        trang_thai: 'active',
      },
    });
    donViIds.push(dv.id);
    return dv;
  }

  async function taoDot(tenDot: string) {
    const d = await prisma.dot_trien_khai.create({
      data: {
        chuong_trinh: 'hsg',
        ten: `${tenDot} ${suf}`,
        don_gia: DON_GIA,
        han_nop: new Date('2026-12-31T16:59:59Z'),
        so_gddt_id: soId,
      },
    });
    dotIds.push(d.id);
    return d.id;
  }

  /** suat: 1 = cả 2 giai đoạn, 0.5 = chỉ GĐ1. */
  async function taoDong(dotId: string, donViId: string, suat: (1 | 0.5)[]) {
    for (const [i, s] of suat.entries()) {
      await prisma.danh_sach_tham_gia.create({
        data: {
          dot_trien_khai_id: dotId,
          don_vi_id: donViId,
          ho_ten: `GV Bịa ${i + 1} ${suf}`,
          giai_doan: s === 1 ? 'ca_hai' : 'chi_gd1',
          ty_le_suat: s,
        },
      });
    }
  }

  const taoHopDong = (
    dotId: string,
    donViId: string,
    data: Partial<Prisma.hop_dong_boi_duongUncheckedCreateInput> = {},
  ) =>
    prisma.hop_dong_boi_duong.create({
      data: { dot_trien_khai_id: dotId, don_vi_id: donViId, ...data },
    });

  const nhatKyXuat = () =>
    prisma.nhat_ky_hoat_dong.findMany({
      where: {
        hanh_dong: 'xuat_tien_do_dot',
        chi_tiet: { path: ['dot_trien_khai_id'], equals: dot1 },
      },
      orderBy: { thoi_gian: 'desc' },
    });

  type DongApi = {
    don_vi: { id: string; ma: string; ten: string; dia_ban: string };
    so_nguoi: number;
    tong_suat: number;
    gia_tri: number | null;
    trang_thai_danh_sach: string;
    trang_thai_hop_dong: string;
    nop_luc: string | null;
    so_de_nghi_cho: number;
    ho_so_du: boolean;
    co_ho_so: boolean;
    thao_tac_cuoi_luc: string | null;
    thao_tac_cuoi_boi: { ho_ten: string; ten_dang_nhap: string } | null;
  };
  const tenTruong = (dong: DongApi[]) => dong.map((d) => d.don_vi.id);
  const theoTen = (...ds: Truong[]) => ds.map((t) => tr[t]);

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    fixture = await taoDonViTest('tddot');
    soId = (await taoDonVi(`Sở thử tiến độ ${suf}`, 'so_gddt', null)).id;
    for (const t of ['A', 'B', 'C', 'D', 'E', 'F'] as Truong[]) {
      ten[t] = `Trường ${t} Tiến Độ Bịa ${suf}`;
      tr[t] = (await taoDonVi(ten[t], 'truong', soId)).id;
    }
    await taoTaiKhoan('quanTri', 'quan_tri', fixture.donVi.id);
    await taoTaiKhoan('truong', 'truong', tr.A);
    await taoTaiKhoan('so', 'so_gddt', soId);

    dot1 = await taoDot('HSG tiến độ');
    dot2 = await taoDot('HSG đợt khác');

    // A: chờ xác nhận, 1 + 0,5 + 1 = 2,5 suất.
    await taoDong(dot1, tr.A, [1, 0.5, 1]);
    await taoHopDong(dot1, tr.A);
    // B: báo sai lệch, 1 + 0,5 = 1,5 suất, 1 đề nghị chờ (+ 1 đã từ chối, không đếm).
    await taoDong(dot1, tr.B, [1, 0.5]);
    await taoHopDong(dot1, tr.B, { trang_thai_danh_sach: 'bao_sai_lech' });
    for (const trang_thai of ['cho', 'tu_choi'] as const) {
      const dn = await prisma.de_nghi_sua_danh_sach.create({
        data: {
          dot_trien_khai_id: dot1,
          don_vi_id: tr.B,
          loai: 'them',
          gia_tri: { ho_ten: `GV Bịa Thêm ${suf}` },
          trang_thai,
          gui_boi: user.truong.nguoiDung.id,
          ...(trang_thai === 'tu_choi'
            ? {
                ly_do_tu_choi: 'Bịa',
                xu_ly_boi: user.quanTri.nguoiDung.id,
                xu_ly_luc: new Date(),
              }
            : {}),
        },
      });
      deNghiIds.push(dn.id);
    }
    // C: đã xác nhận, chưa nộp, hồ sơ đủ; thao tác cuối do Quản trị.
    await taoDong(dot1, tr.C, [1]);
    await taoHopDong(dot1, tr.C, {
      trang_thai_danh_sach: 'da_xac_nhan',
      thao_tac_cuoi_boi: user.quanTri.nguoiDung.id,
      thao_tac_cuoi_luc: LUC_C,
    });
    await prisma.ho_so_don_vi.create({ data: { don_vi_id: tr.C, ...HO_SO_C } });
    await prisma.ho_so_don_vi.create({ data: { don_vi_id: tr.A, ...HO_SO_A } });
    // D: đã nộp — bản chụp 7 người / 6,5 suất KHÁC danh sách hiện tại (2 người / 2 suất).
    await taoDong(dot1, tr.D, [1, 1]);
    await taoHopDong(dot1, tr.D, {
      trang_thai_danh_sach: 'da_xac_nhan',
      trang_thai_hop_dong: 'da_nop',
      thao_tac_cuoi_boi: user.quanTri.nguoiDung.id,
      thao_tac_cuoi_luc: LUC_D_THAO_TAC,
      nop_luc: LUC_D_NOP,
      nop_boi: user.truong.nguoiDung.id,
      ban_chup_ho_so: { ...HO_SO_C, ten_truong: 'Bản chụp D Bịa' },
      so_nguoi_luc_nop: 7,
      tong_suat_luc_nop: 6.5,
      don_gia_luc_nop: DON_GIA,
      gia_tri_luc_nop: BigInt(8_024_686),
    });
    // E: có dòng hợp đồng nhưng danh sách trống.
    await taoHopDong(dot1, tr.E);
    // Đợt khác: A (thêm 2 dòng) + F — không được lẫn vào đợt 1.
    await taoDong(dot2, tr.A, [1, 1]);
    await taoHopDong(dot2, tr.A);
    await taoDong(dot2, tr.F, [1]);
    await taoHopDong(dot2, tr.F);
  });

  afterAll(async () => {
    // Chỉ xóa đúng các dòng file này tạo (mảng rỗng thì bỏ qua). nhat_ky_hoat_dong chỉ cho thêm — để nguyên.
    if (deNghiIds.length > 0) {
      await prisma.de_nghi_sua_danh_sach.deleteMany({
        where: { id: { in: deNghiIds } },
      });
    }
    if (dotIds.length > 0) {
      await prisma.danh_sach_tham_gia.deleteMany({
        where: { dot_trien_khai_id: { in: dotIds } },
      });
      await prisma.hop_dong_boi_duong.deleteMany({
        where: { dot_trien_khai_id: { in: dotIds } },
      });
      await prisma.dot_trien_khai.deleteMany({ where: { id: { in: dotIds } } });
    }
    for (const id of [tr.A, tr.C]) {
      if (id)
        await prisma.ho_so_don_vi.deleteMany({ where: { don_vi_id: id } });
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
    it('401 khi không có token (cả 2 endpoint)', async () => {
      await http().get(urlTienDo(dot1)).expect(401);
      await http().get(urlXuat(dot1)).expect(401);
    });

    it.each<VaiTro>(['truong', 'so'])(
      '%s → 403 trên cả 2 endpoint, không ghi nhật ký xuất',
      async (vaiTro) => {
        const truoc = (await nhatKyXuat()).length;
        const r1 = await http().get(urlTienDo(dot1)).set(auth(token[vaiTro]));
        expect(r1.status).toBe(403);
        const r2 = await taiExcel(dot1, undefined, vaiTro);
        expect(r2.status).toBe(403);
        expect(await nhatKyXuat()).toHaveLength(truoc);
      },
    );
  });

  describe('GET tiến độ — số liệu', () => {
    let body: {
      dot: Record<string, unknown>;
      tong_hop: Record<string, unknown>;
      dong: DongApi[];
    };
    const dongCua = (t: Truong) =>
      body.dong.find((d) => d.don_vi.id === tr[t]) as DongApi;

    beforeAll(async () => {
      const res = await layTienDo(dot1);
      expect(res.status).toBe(200);
      body = res.body;
    });

    it('thông tin đợt', () => {
      expect(body.dot).toEqual({
        id: dot1,
        ten: `HSG tiến độ ${suf}`,
        chuong_trinh: 'hsg',
        don_gia: DON_GIA,
        han_nop: '2026-12-31T16:59:59.000Z',
        han_nop_ngay: '2026-12-31',
      });
    });

    it('mỗi dòng hop_dong của đợt 1 dòng (kể cả E danh sách trống), theo tên trường; không lẫn đợt khác', () => {
      expect(tenTruong(body.dong)).toEqual(theoTen('A', 'B', 'C', 'D', 'E'));
      expect(tenTruong(body.dong)).not.toContain(tr.F);
    });

    it('A: số người, tổng suất 0,5 chính xác, giá trị làm tròn; hồ sơ khai dở', () => {
      const a = dongCua('A');
      expect(a.don_vi).toEqual({
        id: tr.A,
        ma: expect.stringMatching(/^TDD-/),
        ten: ten.A,
        dia_ban: fixture.diaDanhXa.ten,
      });
      expect(a).toMatchObject({
        so_nguoi: 3,
        tong_suat: 2.5,
        gia_tri: 3_086_418, // 2,5 × 1.234.567 = 3.086.417,5 → 3.086.418
        trang_thai_danh_sach: 'cho_xac_nhan',
        trang_thai_hop_dong: 'chua_nop',
        nop_luc: null,
        so_de_nghi_cho: 0,
        ho_so_du: false,
        co_ho_so: true,
        thao_tac_cuoi_luc: null,
        thao_tac_cuoi_boi: null,
      });
    });

    it('B: chỉ đếm đề nghị đang chờ', () => {
      expect(dongCua('B')).toMatchObject({
        so_nguoi: 2,
        tong_suat: 1.5,
        gia_tri: 1_851_851,
        trang_thai_danh_sach: 'bao_sai_lech',
        so_de_nghi_cho: 1,
        ho_so_du: false,
        co_ho_so: false,
      });
    });

    it('C: hồ sơ đủ, thao tác gần nhất + người thao tác', () => {
      expect(dongCua('C')).toMatchObject({
        so_nguoi: 1,
        tong_suat: 1,
        gia_tri: DON_GIA,
        trang_thai_danh_sach: 'da_xac_nhan',
        trang_thai_hop_dong: 'chua_nop',
        ho_so_du: true,
        co_ho_so: true,
        thao_tac_cuoi_luc: LUC_C.toISOString(),
        thao_tac_cuoi_boi: {
          ho_ten: user.quanTri.nguoiDung.ho_ten,
          ten_dang_nhap: user.quanTri.ten_dang_nhap,
        },
      });
    });

    it('D đã nộp: số liệu lấy từ bản chụp lúc nộp (không phải danh sách hiện tại); thao tác gần nhất = lúc nộp', () => {
      expect(dongCua('D')).toMatchObject({
        so_nguoi: 7,
        tong_suat: 6.5,
        gia_tri: 8_024_686,
        trang_thai_hop_dong: 'da_nop',
        nop_luc: LUC_D_NOP.toISOString(),
        ho_so_du: true,
        co_ho_so: true,
        thao_tac_cuoi_luc: LUC_D_NOP.toISOString(),
        thao_tac_cuoi_boi: {
          ho_ten: user.truong.nguoiDung.ho_ten,
          ten_dang_nhap: user.truong.ten_dang_nhap,
        },
      });
    });

    it('E: danh sách trống → 0 người, 0 suất, giá trị 0', () => {
      expect(dongCua('E')).toMatchObject({
        so_nguoi: 0,
        tong_suat: 0,
        gia_tri: 0,
        trang_thai_danh_sach: 'cho_xac_nhan',
        so_de_nghi_cho: 0,
      });
    });

    it('tổng hợp trên mọi trường của đợt', () => {
      expect(body.tong_hop).toEqual({
        so_truong: 5,
        so_da_xac_nhan_ds: 2,
        so_bao_sai_lech: 1,
        so_da_nop: 1,
        so_qua_han: 0, // issue #66: hạn đợt 31/12/2026 chưa tới
        tong_nguoi: 3 + 2 + 1 + 7 + 0,
        tong_suat: 11.5,
        tong_gia_tri: 3_086_418 + 1_851_851 + DON_GIA + 8_024_686,
      });
    });
  });

  describe('GET tiến độ — bộ lọc', () => {
    it.each<[string, Truong[]]>([
      ['tat_ca', ['A', 'B', 'C', 'D', 'E']],
      ['chua_xac_nhan_ds', ['A', 'B', 'E']],
      ['bao_sai_lech', ['B']],
      ['chua_nop_hd', ['A', 'B', 'C', 'E']],
    ])('loc=%s → đúng các trường; tong_hop không đổi', async (loc, ds) => {
      const res = await layTienDo(dot1, loc);
      expect(res.status).toBe(200);
      expect(tenTruong(res.body.dong)).toEqual(theoTen(...ds));
      expect(res.body.tong_hop.so_truong).toBe(5);
    });

    it('loc không hợp lệ → 400 VALIDATION_ERROR (cả 2 endpoint)', async () => {
      // 'qua_han' hợp lệ từ issue #66 — dùng giá trị khác.
      const r1 = await layTienDo(dot1, 'qua-han');
      expect(r1.status).toBe(400);
      expect(r1.body.error.code).toBe('VALIDATION_ERROR');
      const r2 = await taiExcel(dot1, 'xyz');
      expect(r2.status).toBe(400);
    });

    it('đợt không tồn tại → 404; id sai dạng → 400', async () => {
      const id = '00000000-0000-4000-8000-000000000000';
      expect((await layTienDo(id)).status).toBe(404);
      expect((await taiExcel(id)).status).toBe(404);
      expect((await layTienDo('khong-phai-uuid')).status).toBe(400);
    });

    it('đợt khác chỉ có trường của đợt đó (A với số liệu riêng, F)', async () => {
      const res = await layTienDo(dot2);
      expect(res.status).toBe(200);
      expect(tenTruong(res.body.dong)).toEqual(theoTen('A', 'F'));
      expect(res.body.dong[0]).toMatchObject({ so_nguoi: 2, tong_suat: 2 });
    });
  });

  describe('Xuất Excel trường chưa xong', () => {
    const TIEU_DE = [
      'STT',
      'Mã trường',
      'Tên trường',
      'Số người',
      'Tổng suất',
      'Giá trị',
      'Trạng thái danh sách',
      'Đề nghị chờ',
      'Hồ sơ đơn vị',
      'Trạng thái hợp đồng',
      'Hạn hiệu lực', // issue #66
      'Hạn riêng',
      'Thao tác gần nhất',
      'Người liên hệ',
      'SĐT liên hệ',
      'Email',
    ];

    it('loc=tat_ca: xlsx, no-store, tên file theo đợt; A, B, C, E (không D đã nộp); số liệu + liên hệ', async () => {
      const res = await taiExcel(dot1, 'tat_ca');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml');
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['content-disposition']).toMatch(
        /^attachment; filename="tien-do-hsg-tien-do-[a-z0-9-]+-chua-xong-\d{8}\.xlsx"$/,
      );
      const { wb, sh, dong } = await docSheet(res.body as Buffer);
      expect(wb.worksheets.map((s) => s.name)).toEqual(['Trường chưa xong']);
      expect(dong[0]).toEqual(TIEU_DE);
      expect(sh.getRow(1).font?.bold).toBe(true);
      expect(sh.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
      expect(dong.slice(1).map((d) => d[2])).toEqual([
        ten.A,
        ten.B,
        ten.C,
        ten.E,
      ]);
      const [a, b, c, e] = dong.slice(1);
      const HAN_DOT = new Date('2026-12-31T00:00:00Z'); // issue #66: ô ngày hạn hiệu lực
      expect(a.slice(0, 14)).toEqual([
        1,
        expect.stringMatching(/^TDD-/),
        ten.A,
        3,
        2.5,
        3_086_418,
        'Chờ xác nhận',
        0,
        'Còn thiếu',
        'Chưa nộp',
        HAN_DOT,
        undefined,
        undefined,
        'Người Liên Hệ A Bịa',
      ]);
      expect(a[14]).toBe('0900000021');
      // B chưa khai hồ sơ: "Chưa khai hồ sơ", không SĐT/email.
      expect(b.slice(6, 14)).toEqual([
        'Báo sai lệch',
        1,
        'Chưa khai',
        'Chưa nộp',
        HAN_DOT,
        undefined,
        undefined,
        'Chưa khai hồ sơ',
      ]);
      expect(b.length).toBe(14);
      // C: liên hệ đủ từ hồ sơ; thao tác gần nhất theo giờ Việt Nam (02:30 UTC → 09:30).
      expect(c.slice(6)).toEqual([
        'Đã xác nhận',
        0,
        'Đủ',
        'Chưa nộp',
        HAN_DOT,
        undefined,
        new Date('2026-11-18T09:30:00Z'),
        'Người Liên Hệ C Bịa',
        '0900000011',
        `lienhe-c-${suf}@mau.test`,
      ]);
      expect(sh.getRow(4).getCell(6).numFmt).toBe('#,##0');
      expect(e.slice(3, 6)).toEqual([0, 0, 0]);
    });

    it('loc=chua_xac_nhan_ds → A, B, E (không C, không D); loc=chua_nop_hd = tat_ca', async () => {
      const r1 = await taiExcel(dot1, 'chua_xac_nhan_ds');
      expect(r1.status).toBe(200);
      const ds1 = (await docSheet(r1.body as Buffer)).dong.slice(1);
      expect(ds1.map((d) => d[2])).toEqual([ten.A, ten.B, ten.E]);
      expect(ds1.map((d) => d[0])).toEqual([1, 2, 3]);
      const r2 = await taiExcel(dot1, 'chua_nop_hd');
      const ds2 = (await docSheet(r2.body as Buffer)).dong.slice(1);
      expect(ds2.map((d) => d[2])).toEqual([ten.A, ten.B, ten.C, ten.E]);
    });

    it('không có trường nào khớp → file hợp lệ chỉ có tiêu đề (đợt khác, loc=bao_sai_lech)', async () => {
      const res = await taiExcel(dot2, 'bao_sai_lech');
      expect(res.status).toBe(200);
      const { dong } = await docSheet(res.body as Buffer);
      expect(dong).toEqual([TIEU_DE]);
    });

    it('mỗi lần xuất ghi nhật ký xuat_tien_do_dot {đợt, loc, số trường}, không tên/SĐT/email', async () => {
      const truoc = (await nhatKyXuat()).length;
      expect((await taiExcel(dot1)).status).toBe(200);
      expect((await taiExcel(dot1, 'bao_sai_lech')).status).toBe(200);
      const nk = await nhatKyXuat();
      expect(nk).toHaveLength(truoc + 2);
      for (const n of nk.slice(0, 2)) {
        expect(n.nguoi_dung_id).toBe(user.quanTri.nguoiDung.id);
        expect(n.vai_tro).toBe('quan_tri');
      }
      expect(nk.slice(0, 2).map((n) => n.chi_tiet)).toEqual(
        expect.arrayContaining([
          { dot_trien_khai_id: dot1, loc: 'tat_ca', so_truong: 4 },
          { dot_trien_khai_id: dot1, loc: 'bao_sai_lech', so_truong: 1 },
        ]),
      );
      expect(JSON.stringify(nk.map((n) => n.chi_tiet))).not.toMatch(
        /Bịa|0900|mau\.test/,
      );
    });
  });
});
