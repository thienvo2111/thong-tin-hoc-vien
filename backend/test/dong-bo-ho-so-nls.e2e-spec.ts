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

// Issue #69 / ADR 0015 Y2: đồng bộ ngược thông tin cá nhân của dòng NLS (hoc_vien_id) về hồ sơ học viên — chỉ khi
// Quản trị chọn (dong_bo_ho_so_hoc_vien), ghi qua đường sửa hồ sơ của Quản trị, cùng transaction với danh sách.
// Các test chạy TUẦN TỰ trên cùng dữ liệu. Mọi tên người/trường/số đều BỊA.
describe('Đồng bộ ngược hồ sơ học viên NLS - Cổng đơn vị (e2e)', () => {
  let app: INestApplication;
  let fixture: Awaited<ReturnType<typeof taoDonViTest>>;
  type NguoiDungTest = Awaited<ReturnType<typeof taoNguoiDungTest>>;
  const nguoiDung: NguoiDungTest[] = [];
  type VaiTro = 'quanTri' | 'truong' | 'so';
  const token = {} as Record<VaiTro, string>;
  const userId = {} as Record<VaiTro, string>;

  const suf = uniqueSuffix();
  const MAT_KHAU = 'MatKhau123';
  const LY_DO_AP_DUNG = 'Cổng đơn vị: áp dụng đề nghị sửa danh sách tham gia';
  const TIEN_TO = 'Không cập nhật được hồ sơ học viên: ';
  const donViIds: string[] = [];
  const dotIds: string[] = [];
  const hocVienIds: string[] = [];
  const ids = {} as Record<'so' | 'tA' | 'tB', string>;
  let dotId = '';
  // d1/d2: dòng NLS (học viên import_moet h1/h2); d3: dòng NLS của h3 (tu_dang_ky), họ tên dòng lệch hồ sơ;
  // hsg: dòng không hoc_vien_id; bot: dòng không hoc_vien_id dùng cho đề nghị bớt.
  const dong = {} as Record<'d1' | 'd2' | 'd3' | 'hsg' | 'bot', string>;
  const hv = {} as Record<'h1' | 'h2' | 'h3', string>;

  // Họ tên hồ sơ chỉ nhận chữ cái → hậu tố đổi chữ số thành chữ.
  const sufChu = suf.replace(/[0-9]/g, (c) => 'abcdefghij'[Number(c)]);
  const ten = (t: string) => `Gv Bịa ${t} ${sufChu}`;
  const TEN_MA = { h1: 'Một', h2: 'Hai', h3: 'Ba' } as const;
  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const urlDong = (id: string) => `/cong-don-vi/danh-sach-tham-gia/${id}`;
  const urlHoSo = (id: string) => `${urlDong(id)}/ho-so-hoc-vien`;
  const xemHoSo = (id: string, t = token.quanTri) =>
    http().get(urlHoSo(id)).set(auth(t));
  const patch = (id: string, body: object) =>
    http().patch(urlDong(id)).set(auth(token.quanTri)).send(body);
  const apDung = (id: string, body?: object) => {
    const r = http()
      .post(`/cong-don-vi/de-nghi-sua/${id}/ap-dung`)
      .set(auth(token.quanTri));
    return body ? r.send(body) : r;
  };
  const dongDb = (id: string) =>
    prisma.danh_sach_tham_gia.findUniqueOrThrow({ where: { id } });
  const hvDb = (id: string) =>
    prisma.hoc_vien.findUniqueOrThrow({ where: { id } });
  const lichSu = (hocVienId: string) =>
    prisma.lich_su_thay_doi_ho_so.findMany({
      where: { hoc_vien_id: hocVienId },
      orderBy: [{ sua_luc: 'asc' }, { truong: 'asc' }],
    });
  const deNghiDb = (id: string) =>
    prisma.de_nghi_sua_danh_sach.findUniqueOrThrow({ where: { id } });
  const nhatKy = (hanh_dong: string, khoa: string, giaTri: string) =>
    prisma.nhat_ky_hoat_dong.findMany({
      where: { hanh_dong, chi_tiet: { path: [khoa], equals: giaTri } },
      orderBy: { thoi_gian: 'asc' },
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
    tenDv: string,
    loai: 'so_gddt' | 'truong',
    cha: string | null,
  ) {
    const dv = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DBHS-${uniqueSuffix()}`,
        ten_don_vi: `${tenDv} ${suf}`,
        loai_don_vi: loai,
        dia_ban_id: fixture.diaDanhXa.id,
        don_vi_cha_id: cha,
        trang_thai: 'active',
      },
    });
    donViIds.push(dv.id);
    return dv.id;
  }

  /** 12 chữ số bịa, không trùng giữa các lần chạy. */
  const soDinhDanhBia = () =>
    `9${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 900 + 100)}`;

  async function taoHocVien(
    ma: 'h1' | 'h2' | 'h3',
    nguon: 'import_moet' | 'tu_dang_ky',
  ) {
    const h = await prisma.hoc_vien.create({
      data: {
        nguon_tao: nguon,
        ...(nguon === 'import_moet'
          ? { ma_dinh_danh_moet: `DBHS${ma}${suf}` }
          : { so_dinh_danh_ca_nhan: soDinhDanhBia() }),
        ho_ten: ten(`Hồ Sơ ${TEN_MA[ma]}`),
        ngay_sinh: 4,
        thang_sinh: 3,
        nam_sinh: 1991,
        gioi_tinh: 'nu',
        don_vi_cong_tac_id: ids.tA,
        so_dien_thoai_lien_he: '0912345678',
        trang_thai: 'da_duyet',
        nguoi_duyet_id: userId.quanTri,
        cap_duyet_thuc_te: 'quan_tri',
        ngay_duyet: new Date(),
      },
    });
    hocVienIds.push(h.id);
    hv[ma] = h.id;
    return h;
  }

  async function taoDong(hoTen: string, hocVienId: string | null) {
    const d = await prisma.danh_sach_tham_gia.create({
      data: {
        dot_trien_khai_id: dotId,
        don_vi_id: ids.tA,
        ho_ten: hoTen,
        ngay_sinh: new Date('1991-03-04T00:00:00Z'),
        gioi_tinh: 'nu',
        lop: 'Lớp NLS bịa',
        giai_doan: 'ca_hai',
        ty_le_suat: 1,
        hoc_vien_id: hocVienId,
        created_by: userId.quanTri,
      },
    });
    return d.id;
  }

  /** Trường gửi đề nghị → id đề nghị mới nhất. */
  async function guiDeNghi(body: object) {
    const res = await http()
      .post(`/cong-don-vi/truong/dot/${dotId}/de-nghi`)
      .set(auth(token.truong))
      .send(body);
    expect(res.status).toBe(201);
    return res.body.de_nghi[0].id as string;
  }

  function loiCo(res: request.Response) {
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields).toEqual([
      expect.objectContaining({ field: 'dong_bo_ho_so_hoc_vien' }),
    ]);
  }

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    fixture = await taoDonViTest('dbhs');
    ids.so = await taoDonVi('Sở đồng bộ hồ sơ', 'so_gddt', null);
    ids.tA = await taoDonVi('Trường A Đồng Bộ Bịa', 'truong', ids.so);
    ids.tB = await taoDonVi('Trường B Đồng Bộ Bịa', 'truong', ids.so);
    const d = await prisma.dot_trien_khai.create({
      data: {
        chuong_trinh: 'nls',
        ten: `NLS đồng bộ hồ sơ ${suf}`,
        don_gia: 1_000_000,
        han_nop: new Date('2026-12-31T16:59:59Z'),
        so_gddt_id: ids.so,
      },
    });
    dotIds.push(d.id);
    dotId = d.id;

    await taoTaiKhoan('quanTri', 'quan_tri', fixture.donVi.id);
    await taoTaiKhoan('truong', 'truong', ids.tA);
    await taoTaiKhoan('so', 'so_gddt', ids.so);

    const h1 = await taoHocVien('h1', 'import_moet');
    const h2 = await taoHocVien('h2', 'import_moet');
    await taoHocVien('h3', 'tu_dang_ky');
    dong.d1 = await taoDong(h1.ho_ten, hv.h1);
    dong.d2 = await taoDong(h2.ho_ten, hv.h2);
    // Dòng lệch hồ sơ (họ tên dòng khác hồ sơ h3) — để thử "đổi về đúng hồ sơ" không có gì đồng bộ.
    dong.d3 = await taoDong(ten('Dòng Lệch Ba'), hv.h3);
    dong.hsg = await taoDong(ten('Không Hồ Sơ'), null);
    dong.bot = await taoDong(ten('Sẽ Bớt'), null);
    await prisma.hop_dong_boi_duong.create({
      data: { dot_trien_khai_id: dotId, don_vi_id: ids.tA },
    });
  });

  afterAll(async () => {
    // Chỉ xóa đúng dữ liệu file này tạo (theo id đã ghi; mảng rỗng thì bỏ qua), con trước cha.
    // nhat_ky_hoat_dong chỉ cho thêm (trigger chặn xóa) — để nguyên. lich_su_thay_doi_ho_so không có trigger
    // nhưng FK NO ACTION tới hoc_vien / nguoi_dung → xóa lịch sử của đúng học viên bịa trước.
    if (hocVienIds.length > 0) {
      await prisma.lich_su_thay_doi_ho_so.deleteMany({
        where: { hoc_vien_id: { in: hocVienIds } },
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

  describe('Phân quyền xem trước hồ sơ', () => {
    it('401 khi không có token', async () => {
      await http().get(urlHoSo(dong.d1)).expect(401);
    });

    it('trường / Sở → 403', async () => {
      expect((await xemHoSo(dong.d1, token.truong)).status).toBe(403);
      expect((await xemHoSo(dong.d1, token.so)).status).toBe(403);
    });
  });

  describe('GET …/ho-so-hoc-vien (chỉ đọc)', () => {
    it('trả giá trị HIỆN TẠI của hồ sơ học viên (không phải của dòng)', async () => {
      const res = await xemHoSo(dong.d3).expect(200);
      expect(res.body).toEqual({
        hoc_vien_id: hv.h3,
        ho_ten: ten('Hồ Sơ Ba'),
        ngay_sinh: '1991-03-04',
        gioi_tinh: 'nu',
        don_vi: { id: ids.tA, ten: `Trường A Đồng Bộ Bịa ${suf}` },
      });
    });

    it('dòng HSG (không hoc_vien_id) → 404; dòng không tồn tại → 404', async () => {
      expect((await xemHoSo(dong.hsg)).status).toBe(404);
      expect((await xemHoSo(randomUUID())).status).toBe(404);
    });
  });

  describe('Áp dụng đề nghị sửa', () => {
    it('KHÔNG chọn đồng bộ → dòng đổi, hồ sơ giữ nguyên, không có lịch sử; dong_bo null', async () => {
      const id = await guiDeNghi({
        loai: 'sua',
        dong_id: dong.d1,
        gia_tri: { ho_ten: ten('Chỉ Dòng') },
      });
      const res = await apDung(id).expect(200);
      expect(res.body.trang_thai).toBe('da_ap_dung');
      expect(res.body.dong_bo).toBeNull();
      expect((await dongDb(dong.d1)).ho_ten).toBe(ten('Chỉ Dòng'));
      expect((await hvDb(hv.h1)).ho_ten).toBe(ten('Hồ Sơ Một'));
      expect(await lichSu(hv.h1)).toEqual([]);
      const [nk] = await nhatKy(
        'ap_dung_de_nghi_sua_danh_sach',
        'de_nghi_id',
        id,
      );
      expect(nk.chi_tiet).not.toHaveProperty('dong_bo_ho_so_hoc_vien');
      expect(nk.chi_tiet).not.toHaveProperty('truong_dong_bo');
    });

    it('CÓ chọn → dòng + hồ sơ đổi đúng họ tên / ngày sinh / giới tính, lịch sử vai trò quan_tri, nhật ký', async () => {
      const id = await guiDeNghi({
        loai: 'sua',
        dong_id: dong.d1,
        gia_tri: {
          ho_ten: ten('Đã Đồng Bộ'),
          ngay_sinh: '1990-12-31',
          gioi_tinh: 'Nam',
          lop: 'Lớp đổi theo đề nghị',
        },
      });
      const res = await apDung(id, { dong_bo_ho_so_hoc_vien: true }).expect(
        200,
      );
      expect(res.body.trang_thai).toBe('da_ap_dung');
      expect(res.body.dong_bo).toEqual({
        hoc_vien_id: hv.h1,
        truong: ['ho_ten', 'ngay_sinh', 'gioi_tinh'],
        so_truong: 3,
      });

      const d = await dongDb(dong.d1);
      expect(d.ho_ten).toBe(ten('Đã Đồng Bộ'));
      expect(d.lop).toBe('Lớp đổi theo đề nghị');
      expect(d.gioi_tinh).toBe('Nam');
      const h = await hvDb(hv.h1);
      expect({
        ho_ten: h.ho_ten,
        ngay_sinh: h.ngay_sinh,
        thang_sinh: h.thang_sinh,
        nam_sinh: h.nam_sinh,
        gioi_tinh: h.gioi_tinh,
        don_vi_cong_tac_id: h.don_vi_cong_tac_id,
      }).toEqual({
        ho_ten: ten('Đã Đồng Bộ'),
        ngay_sinh: 31,
        thang_sinh: 12,
        nam_sinh: 1990,
        gioi_tinh: 'nam',
        don_vi_cong_tac_id: ids.tA,
      });

      const ls = await lichSu(hv.h1);
      expect(ls.map((l) => l.truong).sort()).toEqual(
        ['gioi_tinh', 'ho_ten', 'nam_sinh', 'ngay_sinh', 'thang_sinh'].sort(),
      );
      for (const l of ls) {
        expect(l.vai_tro_nguoi_sua).toBe('quan_tri');
        expect(l.nguoi_sua_id).toBe(userId.quanTri);
        expect(l.ly_do).toBe(LY_DO_AP_DUNG);
      }
      expect(ls.find((l) => l.truong === 'ho_ten')).toMatchObject({
        gia_tri_cu: ten('Hồ Sơ Một'),
        gia_tri_moi: ten('Đã Đồng Bộ'),
      });
      expect(ls.find((l) => l.truong === 'gioi_tinh')).toMatchObject({
        gia_tri_cu: 'nu',
        gia_tri_moi: 'nam',
      });

      const [nk] = await nhatKy(
        'ap_dung_de_nghi_sua_danh_sach',
        'de_nghi_id',
        id,
      );
      expect(nk.chi_tiet).toMatchObject({
        dong_bo_ho_so_hoc_vien: true,
        truong_dong_bo: ['ho_ten', 'ngay_sinh', 'gioi_tinh'],
      });
    });

    it('hồ sơ từ chối (họ tên có chữ số — danh sách nhận) → cả request lỗi, dòng/hồ sơ/đề nghị giữ nguyên', async () => {
      const truoc = await dongDb(dong.d2);
      const id = await guiDeNghi({
        loai: 'sua',
        dong_id: dong.d2,
        gia_tri: { ho_ten: ten('Có Số 9') },
      });
      const res = await apDung(id, { dong_bo_ho_so_hoc_vien: true });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toMatch(new RegExp(`^${TIEN_TO}`));
      expect(res.body.error.fields).toEqual([
        expect.objectContaining({ field: 'ho_ten' }),
      ]);
      const sau = await dongDb(dong.d2);
      expect(sau.ho_ten).toBe(truoc.ho_ten);
      expect(sau.y_kien_truong).toBe('khong_dong_y');
      expect((await deNghiDb(id)).trang_thai).toBe('cho');
      expect((await hvDb(hv.h2)).ho_ten).toBe(ten('Hồ Sơ Hai'));
      expect(await lichSu(hv.h2)).toEqual([]);

      // Chỉ sửa danh sách thì vẫn Áp dụng được (danh sách không có quy tắc họ tên của hồ sơ).
      const ok = await apDung(id, { dong_bo_ho_so_hoc_vien: false }).expect(
        200,
      );
      expect(ok.body.dong_bo).toBeNull();
      expect((await dongDb(dong.d2)).ho_ten).toBe(ten('Có Số 9'));
      expect((await hvDb(hv.h2)).ho_ten).toBe(ten('Hồ Sơ Hai'));
    });

    it('đề nghị thêm / bớt người kèm cờ → 400 dong_bo_ho_so_hoc_vien, đề nghị vẫn chờ', async () => {
      const them = await guiDeNghi({
        loai: 'them',
        gia_tri: { ho_ten: ten('Người Thêm') },
      });
      const bot = await guiDeNghi({
        loai: 'bot',
        dong_id: dong.bot,
        ly_do: 'Bịa: không tham gia',
      });
      loiCo(await apDung(them, { dong_bo_ho_so_hoc_vien: true }));
      loiCo(await apDung(bot, { dong_bo_ho_so_hoc_vien: true }));
      expect((await deNghiDb(them)).trang_thai).toBe('cho');
      expect((await deNghiDb(bot)).trang_thai).toBe('cho');
      expect(
        await prisma.danh_sach_tham_gia.count({ where: { id: dong.bot } }),
      ).toBe(1);
    });

    it('đề nghị sửa trên dòng HSG kèm cờ → 400, dòng không đổi, đề nghị vẫn chờ', async () => {
      const id = await guiDeNghi({
        loai: 'sua',
        dong_id: dong.hsg,
        gia_tri: { ho_ten: ten('Hsg Đổi') },
      });
      loiCo(await apDung(id, { dong_bo_ho_so_hoc_vien: true }));
      expect((await dongDb(dong.hsg)).ho_ten).toBe(ten('Không Hồ Sơ'));
      expect((await deNghiDb(id)).trang_thai).toBe('cho');
    });

    it('đề nghị chỉ sửa lớp / giai đoạn kèm cờ → 400 (không có thông tin cá nhân để đồng bộ)', async () => {
      const id = await guiDeNghi({
        loai: 'sua',
        dong_id: dong.d3,
        gia_tri: { lop: 'Lớp khác bịa', giai_doan: 'chi_gd2' },
      });
      loiCo(await apDung(id, { dong_bo_ho_so_hoc_vien: true }));
      const d = await dongDb(dong.d3);
      expect(d.lop).toBe('Lớp NLS bịa');
      expect(d.giai_doan).toBe('ca_hai');
      expect((await deNghiDb(id)).trang_thai).toBe('cho');
    });
  });

  describe('PATCH dòng (Quản trị)', () => {
    it('đổi trường công tác + giai đoạn kèm cờ → hồ sơ chỉ đổi trường công tác, có lịch sử', async () => {
      const lichSuTruoc = (await lichSu(hv.h1)).length;
      const hTruoc = await hvDb(hv.h1);
      const res = await patch(dong.d1, {
        ly_do: 'Bịa: chuyển trường',
        don_vi_id: ids.tB,
        giai_doan: 'chi_gd1',
        dong_bo_ho_so_hoc_vien: true,
      }).expect(200);
      expect(res.body).toMatchObject({
        id: dong.d1,
        don_vi_id: ids.tB,
        giai_doan: 'chi_gd1',
        ty_le_suat: 0.5,
        dong_bo: { hoc_vien_id: hv.h1, truong: ['don_vi_id'], so_truong: 1 },
      });
      const h = await hvDb(hv.h1);
      expect(h.don_vi_cong_tac_id).toBe(ids.tB);
      expect({
        ...h,
        don_vi_cong_tac_id: undefined,
        updated_at: undefined,
      }).toEqual({
        ...hTruoc,
        don_vi_cong_tac_id: undefined,
        updated_at: undefined,
      });
      const ls = (await lichSu(hv.h1)).slice(lichSuTruoc);
      expect(ls).toEqual([
        expect.objectContaining({
          truong: 'don_vi_cong_tac_id',
          gia_tri_cu: ids.tA,
          gia_tri_moi: ids.tB,
          vai_tro_nguoi_sua: 'quan_tri',
          nguoi_sua_id: userId.quanTri,
          ly_do: 'Cổng đơn vị: Bịa: chuyển trường',
        }),
      ]);
      const ds = await nhatKy('sua_dong_danh_sach', 'dong_id', dong.d1);
      expect(ds[ds.length - 1].chi_tiet).toMatchObject({
        dong_bo_ho_so_hoc_vien: true,
        truong_dong_bo: ['don_vi_id'],
      });
    });

    it('chỉ đổi giai đoạn kèm cờ → 400, dòng không đổi', async () => {
      loiCo(
        await patch(dong.d2, {
          ly_do: 'Bịa',
          giai_doan: 'chi_gd2',
          dong_bo_ho_so_hoc_vien: true,
        }),
      );
      expect((await dongDb(dong.d2)).giai_doan).toBe('ca_hai');
    });

    it('dòng HSG kèm cờ → 400, dòng không đổi', async () => {
      loiCo(
        await patch(dong.hsg, {
          ly_do: 'Bịa',
          ho_ten: ten('Hsg Sửa'),
          dong_bo_ho_so_hoc_vien: true,
        }),
      );
      expect((await dongDb(dong.hsg)).ho_ten).toBe(ten('Không Hồ Sơ'));
    });

    it('hồ sơ từ chối (dưới 15 tuổi — danh sách nhận) → lỗi có tiền tố, dòng + hồ sơ giữ nguyên', async () => {
      const res = await patch(dong.d2, {
        ly_do: 'Bịa',
        ngay_sinh: '2020-01-01',
        dong_bo_ho_so_hoc_vien: true,
      });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(new RegExp(`^${TIEN_TO}`));
      expect((await dongDb(dong.d2)).ngay_sinh?.toISOString()).toBe(
        '1991-03-04T00:00:00.000Z',
      );
      expect((await hvDb(hv.h2)).nam_sinh).toBe(1991);
      expect(await lichSu(hv.h2)).toEqual([]);
    });

    it('cờ false → như trước: dòng đổi, hồ sơ không đổi, dong_bo null', async () => {
      const res = await patch(dong.d2, {
        ly_do: 'Bịa',
        gioi_tinh: 'Nam',
        dong_bo_ho_so_hoc_vien: false,
      }).expect(200);
      expect(res.body.dong_bo).toBeNull();
      expect((await dongDb(dong.d2)).gioi_tinh).toBe('Nam');
      expect((await hvDb(hv.h2)).gioi_tinh).toBe('nu');
    });

    it('hồ sơ tu_dang_ky: giá trị mới đã khớp hồ sơ → không ghi gì (so_truong 0); khác → có lịch sử kèm lý do', async () => {
      const khop = await patch(dong.d3, {
        ly_do: 'Bịa: sửa đúng tên',
        ho_ten: ten('Hồ Sơ Ba'),
        dong_bo_ho_so_hoc_vien: true,
      }).expect(200);
      expect(khop.body.dong_bo).toEqual({
        hoc_vien_id: hv.h3,
        truong: [],
        so_truong: 0,
      });
      expect(await lichSu(hv.h3)).toEqual([]);
      const [nk] = (
        await nhatKy('sua_dong_danh_sach', 'dong_id', dong.d3)
      ).slice(-1);
      expect(nk.chi_tiet).toMatchObject({
        dong_bo_ho_so_hoc_vien: true,
        truong_dong_bo: [],
      });

      const res = await patch(dong.d3, {
        ly_do: 'Bịa: đổi tên',
        ho_ten: ten('Tên Mới Ba'),
        dong_bo_ho_so_hoc_vien: true,
      }).expect(200);
      expect(res.body.dong_bo.truong).toEqual(['ho_ten']);
      expect((await hvDb(hv.h3)).ho_ten).toBe(ten('Tên Mới Ba'));
      expect(await lichSu(hv.h3)).toEqual([
        expect.objectContaining({
          truong: 'ho_ten',
          gia_tri_cu: ten('Hồ Sơ Ba'),
          gia_tri_moi: ten('Tên Mới Ba'),
          vai_tro_nguoi_sua: 'quan_tri',
          ly_do: 'Cổng đơn vị: Bịa: đổi tên',
        }),
      ]);
    });

    it('cờ không phải boolean → 400', async () => {
      const res = await patch(dong.d2, {
        ly_do: 'Bịa',
        lop: 'Lớp x',
        dong_bo_ho_so_hoc_vien: 'co',
      });
      expect(res.status).toBe(400);
      expect((await dongDb(dong.d2)).lop).toBe('Lớp NLS bịa');
    });
  });
});
