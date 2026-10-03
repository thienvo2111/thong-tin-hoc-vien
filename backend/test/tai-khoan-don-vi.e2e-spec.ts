import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoNguoiDungTest,
  uniqueSuffix,
  xoaNguoiDungTest,
} from './utils/test-data';

// Tài khoản đơn vị (ADR 0002) — API /nguoi-dung/don-vi (chỉ quan_tri).
describe('Tài khoản đơn vị — API (e2e)', () => {
  let app: INestApplication;
  const suf = uniqueSuffix();
  const SUF = suf.toUpperCase();
  const diaDanhIds: string[] = [];
  const donViIds: string[] = [];
  const nguoiDungTestIds: string[] = [];
  const hocVienIds: string[] = [];
  const khoaIds: string[] = [];
  let xa: string;
  let S: { id: string; ma: string; ten: string };
  let P: { id: string; ma: string };
  let T: { id: string; ma: string };
  let T2: { id: string; ma: string };
  let X: { id: string };
  let N: { id: string };
  let tokenQuanTri: string;
  const tokenKhac: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const dangNhap = async (ten: string, mk: string) =>
    http().post('/auth/dang-nhap').send({ ten_dang_nhap: ten, mat_khau: mk });
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function taoDonVi(
    nhan: string,
    loai: 'so_gddt' | 'phong_vhxh' | 'truong' | 'khac',
    cha?: string,
    trangThai: 'active' | 'ngung' = 'active',
  ) {
    const dv = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-tkdv${nhan}-${suf}`,
        ten_don_vi: `Đơn vị ${nhan} ${suf}`,
        loai_don_vi: loai,
        dia_ban_id: xa,
        don_vi_cha_id: cha ?? null,
        trang_thai: trangThai,
      },
    });
    donViIds.push(dv.id);
    return { id: dv.id, ma: dv.ma_don_vi, ten: dv.ten_don_vi };
  }

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    const tinh = await prisma.dia_danh.create({
      data: { ma: `T-tkdv-${suf}`, ten: `Tỉnh ${suf}`, cap: 'tinh_thanh' },
    });
    const xaRow = await prisma.dia_danh.create({
      data: { ma: `X-tkdv-${suf}`, ten: `Xã ${suf}`, cap: 'phuong_xa_dac_khu', parent_id: tinh.id },
    });
    diaDanhIds.push(xaRow.id, tinh.id);
    xa = xaRow.id;

    S = await taoDonVi('s', 'so_gddt');
    P = await taoDonVi('p', 'phong_vhxh', S.id);
    T = await taoDonVi('t', 'truong', P.id);
    T2 = await taoDonVi('t2', 'truong', P.id);
    X = await taoDonVi('x', 'khac');
    N = await taoDonVi('n', 'truong', P.id, 'ngung');

    // Tài khoản gọi API (đơn vị riêng — không chiếm đơn vị đang thử tạo).
    const dvQt = await taoDonVi('qt', 'khac');
    const qt = await taoNguoiDungTest({ vai_tro: 'quan_tri', don_vi_id: dvQt.id, mat_khau: 'QuanTri12345' });
    nguoiDungTestIds.push(qt.nguoiDung.id);
    tokenQuanTri = (await dangNhap(qt.ten_dang_nhap, 'QuanTri12345')).body.token;
    for (const [vaiTro, loai] of [
      ['so_gddt', 'so_gddt'],
      ['phong_vhxh', 'phong_vhxh'],
      ['truong', 'truong'],
    ] as const) {
      const dv = await taoDonVi(`goi${vaiTro}`, loai);
      const tk = await taoNguoiDungTest({ vai_tro: vaiTro, don_vi_id: dv.id, mat_khau: 'MatKhau12345' });
      nguoiDungTestIds.push(tk.nguoiDung.id);
      tokenKhac[vaiTro] = (await dangNhap(tk.ten_dang_nhap, 'MatKhau12345')).body.token;
    }

    // Học viên có tên đăng nhập viết hoa — dùng thử trùng không phân biệt hoa/thường.
    const hv = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: `HV-${SUF}`,
        ho_ten: 'Học viên trùng tên',
        ngay_sinh: 1,
        thang_sinh: 1,
        nam_sinh: 1985,
        don_vi_cong_tac_id: T.id,
      },
    });
    hocVienIds.push(hv.id);
    const ndHv = await prisma.nguoi_dung.create({
      data: {
        ho_ten: 'Học viên trùng tên',
        ten_dang_nhap: `HV-${SUF}`,
        vai_tro: 'hoc_vien',
        hoc_vien_id: hv.id,
        mat_khau_hash: await bcrypt.hash('01011985', 4),
      },
    });
    nguoiDungTestIds.push(ndHv.id);
  });

  afterAll(async () => {
    const taiKhoanDonVi = await prisma.nguoi_dung.findMany({
      where: { don_vi_id: { in: donViIds }, vai_tro: { in: ['so_gddt', 'phong_vhxh', 'truong'] } },
      select: { id: true },
    });
    const ids = [...new Set([...taiKhoanDonVi.map((x) => x.id), ...nguoiDungTestIds])];
    await prisma.nhat_ky_dat_lai_mat_khau.deleteMany({
      where: { OR: [{ nguoi_dung_id: { in: ids } }, { thuc_hien_boi: { in: ids } }] },
    });
    await prisma.token_xac_thuc.deleteMany({ where: { nguoi_dung_id: { in: ids } } });
    await prisma.hang_doi_email.deleteMany({ where: { email_nguoi_nhan: { endsWith: `${suf}@tkdv.vn` } } });
    await prisma.dang_ky_hoc.deleteMany({ where: { khoa_id: { in: khoaIds } } });
    await prisma.khoa_boi_duong.deleteMany({ where: { id: { in: khoaIds } } });
    for (const id of ids) await xoaNguoiDungTest(id);
    await prisma.hoc_vien.deleteMany({ where: { id: { in: hocVienIds } } });
    await prisma.don_vi_cong_tac.deleteMany({ where: { id: { in: donViIds }, don_vi_cha_id: { not: null } } });
    await prisma.don_vi_cong_tac.deleteMany({ where: { id: { in: donViIds } } });
    await prisma.dia_danh.deleteMany({ where: { id: { in: diaDanhIds } } });
    await prisma.$disconnect();
    await app.close();
  });

  describe('POST /nguoi-dung/don-vi', () => {
    let matKhauS: string;

    it('mặc định cấp mật khẩu tạm: tên đăng nhập = mã đơn vị chữ thường, vai trò theo loại, họ tên = tên đơn vị', async () => {
      const res = await http().post('/nguoi-dung/don-vi').set(auth(tokenQuanTri)).send({ don_vi_id: S.id });
      expect(res.status).toBe(201);
      expect(res.body.tai_khoan.ten_dang_nhap).toBe(S.ma.toLowerCase());
      expect(res.body.tai_khoan.vai_tro).toBe('so_gddt');
      expect(res.body.tai_khoan.ho_ten).toBe(S.ten);
      expect(res.body.tai_khoan.don_vi.ma_don_vi).toBe(S.ma);
      expect(res.body.mat_khau_tam).toMatch(/^[A-Za-z2-9]{10}$/);
      expect(res.body.tai_khoan).not.toHaveProperty('mat_khau_hash');
      matKhauS = res.body.mat_khau_tam;
    });

    it('mật khẩu tạm đăng nhập được, bị buộc đổi mật khẩu, đổi xong xem được khóa', async () => {
      const ten = S.ma.toLowerCase();
      const dn = await dangNhap(ten, matKhauS);
      expect(dn.status).toBe(200);
      expect(dn.body.nguoi_dung.phai_doi_mat_khau).toBe(true);
      const doi = await http()
        .post('/auth/doi-mat-khau')
        .set(auth(dn.body.token))
        .send({ mat_khau_cu: matKhauS, mat_khau_moi: 'SoMoi123456' });
      expect(doi.status).toBe(200);
      const dn2 = await dangNhap(ten, 'SoMoi123456');
      const ds = await http().get('/khoa-boi-duong').set(auth(dn2.body.token));
      expect(ds.status).toBe(200);
    });

    it('cach_cap=email: chuẩn hóa tên đăng nhập + email, không trả mật khẩu, xếp email kích hoạt vào hàng đợi', async () => {
      const email = `A.Phong-${suf}@TKDV.VN`;
      const res = await http()
        .post('/nguoi-dung/don-vi')
        .set(auth(tokenQuanTri))
        .send({ don_vi_id: P.id, ten_dang_nhap: ` Phong-${SUF} `, email, cach_cap: 'email' });
      expect(res.status).toBe(201);
      expect(res.body).not.toHaveProperty('mat_khau_tam');
      expect(res.body.tai_khoan.ten_dang_nhap).toBe(`phong-${suf}`);
      expect(res.body.tai_khoan.email).toBe(email.toLowerCase());
      const q = await prisma.hang_doi_email.findMany({ where: { email_nguoi_nhan: email.toLowerCase() } });
      expect(q).toHaveLength(1);
      expect(q[0].tieu_de).toBe('[HCMUE-BDNLS] Kích hoạt tài khoản');
      expect(q[0].noi_dung_html).toContain(`phong-${suf}`);
      const token = /token=([0-9a-f]+)/.exec(q[0].noi_dung_html)![1];
      const dat = await http().post('/auth/dat-lai-mat-khau').send({ token, mat_khau_moi: 'PhongMoi12345' });
      expect(dat.status).toBe(200);
      expect((await dangNhap(`PHONG-${SUF}`, 'PhongMoi12345')).status).toBe(200);
    });

    it.each([
      ['đơn vị đã có tài khoản', () => ({ don_vi_id: S.id }), 409, 'don_vi_id', 'Đơn vị đã có tài khoản'],
      ['đơn vị loại khác', () => ({ don_vi_id: X.id }), 400, 'don_vi_id', 'Loại đơn vị không được cấp tài khoản'],
      ['đơn vị ngừng hoạt động', () => ({ don_vi_id: N.id }), 400, 'don_vi_id', 'Không hợp lệ'],
      ['tên đăng nhập sai định dạng', () => ({ don_vi_id: T2.id, ten_dang_nhap: 'a b' }), 400, 'ten_dang_nhap', 'Chỉ gồm chữ thường không dấu, số, . _ - (3–50 ký tự)'],
      ['tên đăng nhập trùng học viên (khác hoa/thường)', () => ({ don_vi_id: T2.id, ten_dang_nhap: `hv-${suf}` }), 409, 'ten_dang_nhap', 'Tên đăng nhập đã được dùng'],
      ['email sai định dạng', () => ({ don_vi_id: T2.id, email: 'khong-phai-email' }), 400, 'email', 'Email không hợp lệ'],
      ['email trùng', () => ({ don_vi_id: T2.id, email: `a.phong-${suf}@tkdv.vn` }), 409, 'email', 'Email đã được dùng'],
      ['cach_cap=email mà không có email', () => ({ don_vi_id: T2.id, cach_cap: 'email' }), 400, 'email', 'Cần email để gửi link kích hoạt'],
    ])('%s -> %s', async (_ten, body, status, field, message) => {
      const res = await http().post('/nguoi-dung/don-vi').set(auth(tokenQuanTri)).send(body());
      expect(res.status).toBe(status);
      expect(res.body.error.fields).toEqual(expect.arrayContaining([{ field, message }]));
    });
  });

  describe('Phân quyền', () => {
    it.each(['so_gddt', 'phong_vhxh', 'truong'])('%s gọi mọi endpoint -> 403', async (vaiTro) => {
      const t = tokenKhac[vaiTro];
      const id = '00000000-0000-0000-0000-000000000000';
      const goi = [
        http().get('/nguoi-dung/don-vi').set(auth(t)),
        http().get('/nguoi-dung/don-vi/chua-cap').set(auth(t)),
        http().post('/nguoi-dung/don-vi').set(auth(t)).send({ don_vi_id: T2.id }),
        http().patch(`/nguoi-dung/don-vi/${id}`).set(auth(t)).send({ ho_ten: 'x' }),
        http().post(`/nguoi-dung/don-vi/${id}/cap-mat-khau-tam`).set(auth(t)),
        http().post(`/nguoi-dung/don-vi/${id}/gui-email-kich-hoat`).set(auth(t)),
      ];
      for (const res of await Promise.all(goi)) expect(res.status).toBe(403);
    });
  });

  describe('Thao tác trên tài khoản', () => {
    let tkT: { id: string; ten_dang_nhap: string };
    let matKhauT: string;

    beforeAll(async () => {
      const res = await http()
        .post('/nguoi-dung/don-vi')
        .set(auth(tokenQuanTri))
        .send({ don_vi_id: T.id, email: `t-${suf}@tkdv.vn` });
      tkT = res.body.tai_khoan;
      matKhauT = res.body.mat_khau_tam;
    });

    it('gửi email kích hoạt làm mật khẩu tạm cũ mất hiệu lực', async () => {
      const res = await http().post(`/nguoi-dung/don-vi/${tkT.id}/gui-email-kich-hoat`).set(auth(tokenQuanTri));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ da_gui: true });
      expect((await dangNhap(tkT.ten_dang_nhap, matKhauT)).status).toBe(401);
    });

    it('cấp mật khẩu tạm làm link kích hoạt còn hạn mất hiệu lực + ghi nhật ký', async () => {
      const q = await prisma.hang_doi_email.findFirst({
        where: { email_nguoi_nhan: `t-${suf}@tkdv.vn` },
        orderBy: { created_at: 'desc' },
      });
      const token = /token=([0-9a-f]+)/.exec(q!.noi_dung_html)![1];
      const cap = await http().post(`/nguoi-dung/don-vi/${tkT.id}/cap-mat-khau-tam`).set(auth(tokenQuanTri));
      expect(cap.status).toBe(200);
      expect(cap.body.ten_dang_nhap).toBe(tkT.ten_dang_nhap);
      matKhauT = cap.body.mat_khau_tam;
      const dat = await http().post('/auth/dat-lai-mat-khau').send({ token, mat_khau_moi: 'LinkCu123456' });
      expect(dat.status).toBe(400);
      expect((await dangNhap(tkT.ten_dang_nhap, matKhauT)).status).toBe(200);
      expect(await prisma.nhat_ky_dat_lai_mat_khau.count({ where: { nguoi_dung_id: tkT.id } })).toBeGreaterThanOrEqual(2);
    });

    it('khóa: không đăng nhập được, JWT cũ bị từ chối; mở lại đăng nhập được', async () => {
      const jwtCu = (await dangNhap(tkT.ten_dang_nhap, matKhauT)).body.token;
      const khoa = await http().patch(`/nguoi-dung/don-vi/${tkT.id}`).set(auth(tokenQuanTri)).send({ trang_thai: 'ngung' });
      expect(khoa.status).toBe(200);
      expect(khoa.body.trang_thai).toBe('ngung');
      expect((await dangNhap(tkT.ten_dang_nhap, matKhauT)).status).toBe(401);
      expect((await http().get('/auth/toi').set(auth(jwtCu))).status).toBe(401);
      await http().patch(`/nguoi-dung/don-vi/${tkT.id}`).set(auth(tokenQuanTri)).send({ trang_thai: 'active' });
      expect((await dangNhap(tkT.ten_dang_nhap, matKhauT)).status).toBe(200);
    });

    it('đổi tên đăng nhập: tên cũ không vào được, tên mới (gõ hoa) vào được', async () => {
      const cu = tkT.ten_dang_nhap;
      const res = await http().patch(`/nguoi-dung/don-vi/${tkT.id}`).set(auth(tokenQuanTri)).send({ ten_dang_nhap: `So-Moi-${SUF}` });
      expect(res.status).toBe(200);
      expect(res.body.ten_dang_nhap).toBe(`so-moi-${suf}`);
      expect((await dangNhap(cu, matKhauT)).status).toBe(401);
      expect((await dangNhap(`SO-MOI-${SUF}`, matKhauT)).status).toBe(200);
    });

    it('xóa email: email = null và link kích hoạt còn hạn bị vô hiệu', async () => {
      await http().post(`/nguoi-dung/don-vi/${tkT.id}/gui-email-kich-hoat`).set(auth(tokenQuanTri));
      const q = await prisma.hang_doi_email.findFirst({
        where: { email_nguoi_nhan: `t-${suf}@tkdv.vn` },
        orderBy: { created_at: 'desc' },
      });
      const token = /token=([0-9a-f]+)/.exec(q!.noi_dung_html)![1];
      const res = await http().patch(`/nguoi-dung/don-vi/${tkT.id}`).set(auth(tokenQuanTri)).send({ email: '' });
      expect(res.status).toBe(200);
      expect(res.body.email).toBeNull();
      const dat = await http().post('/auth/dat-lai-mat-khau').send({ token, mat_khau_moi: 'SauXoaEmail1' });
      expect(dat.status).toBe(400);
      const gui = await http().post(`/nguoi-dung/don-vi/${tkT.id}/gui-email-kich-hoat`).set(auth(tokenQuanTri));
      expect(gui.status).toBe(400);
      expect(gui.body.error.fields).toEqual([{ field: 'email', message: 'Cần email để gửi link kích hoạt' }]);
    });

    it('id không phải tài khoản đơn vị -> 404', async () => {
      const res = await http().post(`/nguoi-dung/don-vi/${nguoiDungTestIds[0]}/cap-mat-khau-tam`).set(auth(tokenQuanTri));
      expect(res.status).toBe(404);
    });
  });

  describe('GET /nguoi-dung/don-vi và /chua-cap', () => {
    it('lọc theo vai trò, chưa đăng nhập, tìm theo mã; đơn vị ngừng hoạt động vẫn hiện', async () => {
      const tkT2 = await http().post('/nguoi-dung/don-vi').set(auth(tokenQuanTri)).send({ don_vi_id: T2.id });
      await prisma.don_vi_cong_tac.update({ where: { id: T2.id }, data: { trang_thai: 'ngung' } });
      const res = await http()
        .get('/nguoi-dung/don-vi')
        .query({ vai_tro: 'truong', da_dang_nhap: 'false', q: T2.ma })
        .set(auth(tokenQuanTri));
      expect(res.status).toBe(200);
      expect(res.body.data.map((r: { id: string }) => r.id)).toEqual([tkT2.body.tai_khoan.id]);
      expect(res.body.data[0].don_vi.trang_thai).toBe('ngung');
      expect(res.body.data[0].dang_nhap_lan_cuoi).toBeNull();
      expect(res.body.total).toBe(1);
      await prisma.don_vi_cong_tac.update({ where: { id: T2.id }, data: { trang_thai: 'active' } });
    });

    it('chua-cap chỉ liệt kê đơn vị active, đúng loại, chưa có tài khoản', async () => {
      const t3 = await taoDonVi('t3', 'truong', P.id);
      const res = await http()
        .get('/nguoi-dung/don-vi/chua-cap')
        .query({ loai_don_vi: 'truong', q: `tkdv` })
        .set(auth(tokenQuanTri));
      expect(res.status).toBe(200);
      const ids = res.body.map((d: { id: string }) => d.id);
      expect(ids).toContain(t3.id);
      expect(ids).not.toContain(T.id);
      expect(ids).not.toContain(N.id);
      expect(ids).not.toContain(X.id);
    });
  });

  describe('Tài khoản Sở xem khóa mình đặt hàng (R1)', () => {
    it('pham_vi_hoc_vien = toan_bo', async () => {
      const khoa = await prisma.khoa_boi_duong.create({
        data: {
          ma_khoa: `K-TKDV-${SUF}`,
          ten_khoa: 'Khóa thử tài khoản đơn vị',
          don_vi_dat_hang_id: S.id,
          thoi_gian_bat_dau: new Date('2026-11-01'),
          thoi_gian_ket_thuc: new Date('2026-12-01'),
          trang_thai: 'da_duyet',
        },
      });
      khoaIds.push(khoa.id);
      await prisma.dang_ky_hoc.create({ data: { hoc_vien_id: hocVienIds[0], khoa_id: khoa.id } });
      const dn = await dangNhap(S.ma.toLowerCase(), 'SoMoi123456');
      const res = await http().get(`/khoa-boi-duong/${khoa.id}`).set(auth(dn.body.token));
      expect(res.status).toBe(200);
      expect(res.body.pham_vi_hoc_vien).toBe('toan_bo');
    });
  });
});
