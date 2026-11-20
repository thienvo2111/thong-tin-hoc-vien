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

// Issue #63 / ADR 0015 M4, U2, T2, O3: Hồ sơ đơn vị — trường đọc/ghi hồ sơ CỦA MÌNH,
// Quản trị đọc mọi trường, Sở/Phòng/học viên không được. Mọi giá trị đều BỊA (MST, STK,
// họ tên, SĐT, email) — không có thông tin thật của trường/người nào.
describe('Hồ sơ đơn vị - Cổng đơn vị (e2e)', () => {
  let app: INestApplication;
  let fixture: Awaited<ReturnType<typeof taoDonViTest>>;
  type NguoiDungTest = Awaited<ReturnType<typeof taoNguoiDungTest>>;
  const nguoiDung: NguoiDungTest[] = [];
  const token = {} as Record<
    'quanTri' | 'truongA' | 'truongB' | 'so' | 'hocVien',
    string
  >;
  const nd = {} as Record<'truongA' | 'truongB', string>;

  const suf = uniqueSuffix();
  const MAT_KHAU = 'MatKhau123';
  const donViIds: string[] = [];
  const ids = {} as Record<'so' | 'tA' | 'tB', string>;
  const ten = {} as Record<'tA' | 'tB', string>;
  let hocVienId: string | undefined;
  let nguoiDungHocVienId: string | undefined;

  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const URL = '/cong-don-vi/ho-so-don-vi';

  const PHAN_1 = {
    ten_truong: 'Trường THCS Bịa Thử',
    dia_chi: 'Ấp Bịa, xã Thử, tỉnh Giả',
    ma_so_thue: '0000000001',
    nguoi_dai_dien: 'Người Đại Diện Bịa',
    sdt_dai_dien: '0900000001',
    email_hoa_don: `hoadon-${suf}@mau.test`,
  };
  const DU = {
    ...PHAN_1,
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
    kt_sdt: '0900000002',
    kt_so_tai_khoan: '5555444433332222',
    kt_ngan_hang: 'Ngân hàng Giả – CN Thử',
    dau_moi_csvc: 'Đầu Mối Bịa 0900000003',
  };

  async function dangNhap(ten_dang_nhap: string) {
    const res = await http()
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap, mat_khau: MAT_KHAU })
      .expect(200);
    return res.body.token as string;
  }

  async function taoTaiKhoan(
    vai_tro: 'quan_tri' | 'truong' | 'so_gddt',
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
    tenDv: string,
    loai: 'so_gddt' | 'truong',
    cha: string | null,
  ) {
    const dv = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `HSDV-${uniqueSuffix()}`,
        ten_don_vi: tenDv,
        loai_don_vi: loai,
        dia_ban_id: fixture.diaDanhXa.id,
        don_vi_cha_id: cha,
        trang_thai: 'active',
      },
    });
    donViIds.push(dv.id);
    return dv.id;
  }

  async function taoHocVienDangNhap() {
    const tenDn = `MOET-HSDV-${uniqueSuffix()}`;
    const hv = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: tenDn,
        so_dinh_danh_ca_nhan: `${Date.now()}`.padStart(12, '6').slice(-12),
        ho_ten: 'Học Viên Bịa Hồ Sơ',
        email_lien_he: `hsdv-${suf}@test.local`,
        ngay_sinh: 1,
        thang_sinh: 2,
        nam_sinh: 1990,
        trinh_do_chuyen_mon: 'dai_hoc',
        doi_tuong: 'giao_vien',
        don_vi_cong_tac_id: ids.tA,
        so_dien_thoai_lien_he: '0900000000',
        trang_thai: 'da_duyet',
        nguoi_duyet_id: nguoiDung[0].nguoiDung.id,
        cap_duyet_thuc_te: 'quan_tri',
        ngay_duyet: new Date(),
        chuyen_mon: { create: [{ chuyen_mon: 'CNTT' }] },
      },
    });
    hocVienId = hv.id;
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
    nguoiDungHocVienId = u.id;
    return dangNhap(tenDn);
  }

  const put = (t: string, body: unknown) =>
    http()
      .put(URL)
      .set(auth(t))
      .send(body as object);
  const hang = (donViId: string) =>
    prisma.ho_so_don_vi.findUnique({ where: { don_vi_id: donViId } });
  const nhatKyCua = (nguoiDungId: string) =>
    prisma.nhat_ky_hoat_dong.findMany({
      where: { hanh_dong: 'cap_nhat_ho_so_don_vi', nguoi_dung_id: nguoiDungId },
      orderBy: { thoi_gian: 'asc' },
    });

  beforeAll(async () => {
    app = await createTestApp();
    fixture = await taoDonViTest('hsdv');
    ids.so = await taoDonVi(`Sở thử hồ sơ ${suf}`, 'so_gddt', null);
    ten.tA = `Trường A Hồ Sơ Bịa ${suf}`;
    ten.tB = `Trường B Hồ Sơ Bịa ${suf}`;
    ids.tA = await taoDonVi(ten.tA, 'truong', ids.so);
    ids.tB = await taoDonVi(ten.tB, 'truong', ids.so);

    token.quanTri = (await taoTaiKhoan('quan_tri', fixture.donVi.id)).token;
    const a = await taoTaiKhoan('truong', ids.tA);
    const b = await taoTaiKhoan('truong', ids.tB);
    token.truongA = a.token;
    token.truongB = b.token;
    nd.truongA = a.id;
    nd.truongB = b.id;
    token.so = (await taoTaiKhoan('so_gddt', ids.so)).token;
    token.hocVien = await taoHocVienDangNhap();
  });

  afterAll(async () => {
    // Chỉ xóa đúng các dòng file này tạo; hồ sơ trước (FK đơn vị + người cập nhật).
    // nhat_ky_hoat_dong chỉ cho thêm (trigger chặn xóa) — để nguyên.
    for (const id of [ids.tA, ids.tB]) {
      if (id)
        await prisma.ho_so_don_vi.deleteMany({ where: { don_vi_id: id } });
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

  describe('Trường A khai hồ sơ của mình', () => {
    it('GET khi chưa khai → ho_so null, chưa đủ, gợi ý tên trường', async () => {
      const res = await http().get(URL).set(auth(token.truongA)).expect(200);
      expect(res.body.don_vi).toEqual({ id: ids.tA, ten: ten.tA });
      expect(res.body.ho_so).toBeNull();
      expect(res.body.tinh_trang.du).toBe(false);
      expect(res.body.tinh_trang.so_thieu).toBe(20);
      expect(res.body.chuyen_khoan).toBeNull();
      expect(res.body.goi_y).toEqual({ ten_truong: ten.tA });
    });

    it('PUT nháp chỉ Phần 1 → 200, chưa đủ, thiếu Phần 2 và 5', async () => {
      const res = await put(token.truongA, PHAN_1).expect(200);
      expect(res.body.ho_so.ten_truong).toBe(PHAN_1.ten_truong);
      expect(res.body.ho_so.ma_qhns).toBeNull();
      expect(res.body.tinh_trang.du).toBe(false);
      expect(res.body.tinh_trang.thieu).toEqual([
        'so_tai_khoan',
        'ngan_hang',
        'chi_nhanh',
        'kho_bac',
        'mst_kho_bac',
        'ma_qhns',
        'ma_nguon',
        'ht_ho_ten',
        'ht_so_tai_khoan',
        'ht_ngan_hang',
        'kt_ho_ten',
        'kt_sdt',
        'kt_so_tai_khoan',
        'kt_ngan_hang',
      ]);
      expect(res.body.tinh_trang.so_thieu).toBe(14);
      expect(res.body.chuyen_khoan).toBeNull();
      const db = await hang(ids.tA);
      expect(db?.cap_nhat_boi).toBe(nd.truongA);
    });

    it('PUT đủ hợp lệ → đủ, STK chuyển khoản = HCMUE + QHNS (suy ra)', async () => {
      const res = await put(token.truongA, {
        ...DU,
        sdt_dai_dien: ' 0900 000.001 ',
        ten_truong: `  ${DU.ten_truong}  `,
      }).expect(200);
      expect(res.body.tinh_trang).toEqual({ du: true, thieu: [], so_thieu: 0 });
      expect(res.body.chuyen_khoan).toEqual({
        stk: 'HCMUE7654321',
        don_vi_tiep_nhan: 'Trường Đại học Sư phạm Thành phố Hồ Chí Minh',
        ngan_hang: 'Ngân hàng TMCP Đại Chúng Việt Nam (PVcomBank)',
      });
    });

    it('GET lại → giá trị đã chuẩn hóa (SĐT bỏ dấu cách/chấm, tên trim)', async () => {
      const res = await http().get(URL).set(auth(token.truongA)).expect(200);
      expect(res.body.ho_so.sdt_dai_dien).toBe('0900000001');
      expect(res.body.ho_so.ten_truong).toBe(DU.ten_truong);
      expect(res.body.ho_so.ht_so_tai_khoan).toBe(DU.ht_so_tai_khoan);
      expect(res.body.ho_so.luu_tru).toBeNull();
      expect(typeof res.body.ho_so.updated_at).toBe('string');
      expect(res.body.tinh_trang.du).toBe(true);
    });

    it("PUT với '' xóa ô (và ô vắng thành null — PUT thay toàn bộ)", async () => {
      const res = await put(token.truongA, { ...DU, ma_nguon: '' }).expect(200);
      expect(res.body.ho_so.ma_nguon).toBeNull();
      expect(res.body.tinh_trang.thieu).toEqual(['ma_nguon']);
      const { dau_moi_csvc: _bo, ...khongDauMoi } = DU;
      void _bo;
      const res2 = await put(token.truongA, khongDauMoi).expect(200);
      expect(res2.body.ho_so.dau_moi_csvc).toBeNull();
      expect(res2.body.tinh_trang.du).toBe(true);
    });
  });

  describe('Kiểm tra định dạng → 400 VALIDATION_ERROR, đúng tên trường, không đổi dữ liệu', () => {
    let truocKhi: Awaited<ReturnType<typeof hang>>;
    beforeAll(async () => {
      truocKhi = await hang(ids.tA);
    });

    async function loi400(body: Record<string, unknown>, field: string) {
      const res = await put(token.truongA, { ...DU, ...body }).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field, message: expect.any(String) }),
        ]),
      );
      return res.body.error.fields as { field: string; message: string }[];
    }

    it.each(['012345678', '0123456789-01', '01234567890', 'MST-GIA'])(
      'MST sai %s → ma_so_thue / mst_kho_bac',
      async (v) => {
        const f = await loi400({ ma_so_thue: v, mst_kho_bac: v }, 'ma_so_thue');
        expect(f.map((x) => x.field).sort()).toEqual([
          'ma_so_thue',
          'mst_kho_bac',
        ]);
        expect(f[0].message).toBe(
          'Mã số thuế gồm 10 số, hoặc dạng 0123456789-001',
        );
      },
    );

    it('MST dạng 0123456789-001 được nhận', async () => {
      const res = await put(token.truongA, {
        ...DU,
        ma_so_thue: '0123456789-001',
      }).expect(200);
      expect(res.body.ho_so.ma_so_thue).toBe('0123456789-001');
      await put(token.truongA, DU).expect(200);
      truocKhi = await hang(ids.tA);
    });

    it.each(['123456', '12345678', '12345ab', 'abcdefg'])(
      'QHNS sai %s → ma_qhns',
      async (v) => {
        const f = await loi400({ ma_qhns: v }, 'ma_qhns');
        expect(f).toEqual([
          { field: 'ma_qhns', message: 'Mã QHNS gồm đúng 7 chữ số' },
        ]);
      },
    );

    it.each([
      ['sdt_dai_dien', '1900000001'],
      ['sdt_dai_dien', '090000000'],
      ['kt_sdt', '9000000002'],
      ['kt_sdt', '090000002'],
    ])('SĐT sai %s=%s', async (field, v) => {
      const f = await loi400({ [field]: v }, field);
      expect(f).toEqual([{ field, message: 'SĐT gồm 10 số, bắt đầu bằng 0' }]);
    });

    it('email sai → email_hoa_don', async () => {
      const f = await loi400(
        { email_hoa_don: 'khong-phai-email' },
        'email_hoa_don',
      );
      expect(f).toEqual([
        { field: 'email_hoa_don', message: 'Email không hợp lệ' },
      ]);
    });

    it('quá dài → đúng trường (text 255, textarea 2000)', async () => {
      const f = await loi400(
        { dia_chi: 'a'.repeat(256), luu_tru: 'b'.repeat(2001) },
        'dia_chi',
      );
      expect(f).toEqual(
        expect.arrayContaining([
          { field: 'dia_chi', message: 'Tối đa 255 ký tự' },
          { field: 'luu_tru', message: 'Tối đa 2000 ký tự' },
        ]),
      );
    });

    it('khóa lạ (vd stk_chuyen_khoan) → 400', async () => {
      await loi400({ stk_chuyen_khoan: 'HCMUE7654321' }, 'stk_chuyen_khoan');
    });

    it('giá trị không phải chuỗi → 400', async () => {
      await loi400({ ma_qhns: 7654321 }, 'ma_qhns');
    });

    it('sau mọi lần 400, hàng trong DB không đổi', async () => {
      const sau = await hang(ids.tA);
      expect(sau).toEqual(truocKhi);
    });
  });

  describe('Phạm vi: trường chỉ thấy/sửa hồ sơ của mình', () => {
    it('B lưu hồ sơ của B; A và B mỗi bên chỉ đọc được của mình', async () => {
      await put(token.truongB, {
        ...DU,
        ten_truong: 'Trường B Bịa',
        ma_qhns: '1111111',
      }).expect(200);
      const a = await http().get(URL).set(auth(token.truongA)).expect(200);
      const b = await http().get(URL).set(auth(token.truongB)).expect(200);
      expect(a.body.don_vi.id).toBe(ids.tA);
      expect(a.body.ho_so.ma_qhns).toBe('7654321');
      expect(b.body.don_vi.id).toBe(ids.tB);
      expect(b.body.ho_so.ma_qhns).toBe('1111111');
      expect(b.body.chuyen_khoan.stk).toBe('HCMUE1111111');
      // B lưu không đụng hàng của A.
      expect((await hang(ids.tA))?.ma_qhns).toBe('7654321');
    });

    it('Quản trị đọc hồ sơ A và B theo id', async () => {
      const a = await http()
        .get(`${URL}/${ids.tA}`)
        .set(auth(token.quanTri))
        .expect(200);
      expect(a.body.don_vi).toEqual({ id: ids.tA, ten: ten.tA });
      expect(a.body.ho_so.kt_so_tai_khoan).toBe(DU.kt_so_tai_khoan);
      expect(a.body.chuyen_khoan.stk).toBe('HCMUE7654321');
      const b = await http()
        .get(`${URL}/${ids.tB}`)
        .set(auth(token.quanTri))
        .expect(200);
      expect(b.body.ho_so.ma_qhns).toBe('1111111');
    });

    it('Quản trị đọc đơn vị chưa khai → ho_so null', async () => {
      const res = await http()
        .get(`${URL}/${ids.so}`)
        .set(auth(token.quanTri))
        .expect(200);
      expect(res.body.ho_so).toBeNull();
      expect(res.body.tinh_trang.du).toBe(false);
    });

    it('Quản trị: id không tồn tại → 404; id sai định dạng → 400', async () => {
      await http()
        .get(`${URL}/${randomUUID()}`)
        .set(auth(token.quanTri))
        .expect(404);
      await http()
        .get(`${URL}/khong-phai-uuid`)
        .set(auth(token.quanTri))
        .expect(400);
    });

    it('Trường gọi endpoint quản trị → 403 (kể cả id của chính mình)', async () => {
      await http().get(`${URL}/${ids.tB}`).set(auth(token.truongA)).expect(403);
      await http().get(`${URL}/${ids.tA}`).set(auth(token.truongA)).expect(403);
    });

    it('Quản trị không ghi được qua PUT của trường → 403', async () => {
      await put(token.quanTri, DU).expect(403);
    });

    it('Sở → 403 trên cả 3 endpoint (O3: không thấy Phần 2/5)', async () => {
      await http().get(URL).set(auth(token.so)).expect(403);
      await put(token.so, DU).expect(403);
      await http().get(`${URL}/${ids.tA}`).set(auth(token.so)).expect(403);
    });

    it('Học viên → 403', async () => {
      await http().get(URL).set(auth(token.hocVien)).expect(403);
      await put(token.hocVien, DU).expect(403);
      await http().get(`${URL}/${ids.tA}`).set(auth(token.hocVien)).expect(403);
    });

    it('Không token → 401', async () => {
      await http().get(URL).expect(401);
      await http().put(URL).send(DU).expect(401);
      await http().get(`${URL}/${ids.tA}`).expect(401);
    });
  });

  describe('Nhật ký', () => {
    it('ghi cap_nhat_ho_so_don_vi chỉ TÊN trường, không giá trị nhạy cảm', async () => {
      const rows = await nhatKyCua(nd.truongA);
      expect(rows.length).toBeGreaterThanOrEqual(1);
      const dau = rows[0].chi_tiet as {
        don_vi_id: string;
        truong_thay_doi: string[];
      };
      expect(dau.don_vi_id).toBe(ids.tA);
      expect(dau.truong_thay_doi).toEqual(Object.keys(PHAN_1));
      const json = JSON.stringify(rows.map((r) => r.chi_tiet));
      for (const v of [
        DU.so_tai_khoan,
        DU.ht_so_tai_khoan,
        DU.kt_so_tai_khoan,
        DU.ht_ho_ten,
        DU.kt_ho_ten,
        DU.ma_qhns,
        'HCMUE',
      ]) {
        expect(json).not.toContain(v);
      }
    });

    it('PUT không thay đổi gì → 200, không thêm dòng nhật ký', async () => {
      const truoc = await nhatKyCua(nd.truongB);
      const hangTruoc = await hang(ids.tB);
      const res = await put(token.truongB, {
        ...DU,
        ten_truong: '  Trường B Bịa ',
        ma_qhns: '1111111',
      }).expect(200);
      expect(res.body.ho_so.ten_truong).toBe('Trường B Bịa');
      expect(await nhatKyCua(nd.truongB)).toHaveLength(truoc.length);
      expect((await hang(ids.tB))?.updated_at).toEqual(hangTruoc?.updated_at);
    });
  });

  it('DB không có cột lưu STK chuyển khoản (U2: suy ra)', async () => {
    const cot = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'ho_so_don_vi'`;
    const tenCot = cot.map((c) => c.column_name);
    expect(tenCot).toContain('ma_qhns');
    expect(tenCot.filter((c) => /chuyen_khoan|hcmue/i.test(c))).toEqual([]);
    expect(tenCot).toHaveLength(24 + 4);
  });
});
