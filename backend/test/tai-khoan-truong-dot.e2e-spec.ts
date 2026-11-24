import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as ExcelJS from 'exceljs';
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

// ADR 0015 T4: Quản trị cấp tài khoản cho các trường trong danh sách của đợt.
// Mọi mã / tên trường đều BỊA, kèm hậu tố ngẫu nhiên — không có dữ liệu thật.
describe('Tài khoản trường của đợt - Cổng đơn vị (e2e)', () => {
  let app: INestApplication;
  let fixture: Awaited<ReturnType<typeof taoDonViTest>>;
  let quanTri: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let truongUser: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let soUser: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let tokenQuanTri: string;
  let tokenTruong: string;
  let tokenSo: string;
  let dotId: string;
  // Người dùng đã chiếm sẵn tên đăng nhập = mã trường D (chữ thường) — tạo trực tiếp, xóa ở cleanup.
  let chiemTenId: string | undefined;
  let matKhauA: string;

  const suf = uniqueSuffix();
  const MA_A = `TKTD-A-${suf}`;
  const MA_B = `TKTD-B-${suf}`;
  const MA_D = `TKTD-D-${suf}`;
  const MA_E = `TKTD-E-${suf}`;
  const TEN = {
    a: `Trường Thử An ${suf}`,
    b: `Trường Thử Bình ${suf}`,
    c: `Trường Thử Cường ${suf}`,
    d: `Trường Thử Dũng ${suf}`,
    e: `Trường Thử Ngoài Đợt ${suf}`,
  };
  const donViIds: string[] = [];
  const ids = {} as Record<'so' | 'a' | 'b' | 'c' | 'd' | 'e', string>;

  const http = () => request(app.getHttpServer());
  const url = (dot: string, duoi = '') =>
    `/cong-don-vi/dot-trien-khai/${dot}/tai-khoan-truong${duoi}`;
  const qt = (r: request.Test) =>
    r.set('Authorization', `Bearer ${tokenQuanTri}`);

  async function dangNhap(ten_dang_nhap: string, mat_khau = 'MatKhau123') {
    return http().post('/auth/dang-nhap').send({ ten_dang_nhap, mat_khau });
  }

  async function taoDonVi(
    ten: string,
    loai: 'so_gddt' | 'truong',
    cha: string | null,
    ma: string | null,
  ) {
    const dv = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: ma,
        ten_don_vi: ten,
        loai_don_vi: loai,
        dia_ban_id: fixture.diaDanhXa.id,
        don_vi_cha_id: cha,
      },
    });
    donViIds.push(dv.id);
    return dv.id;
  }

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    fixture = await taoDonViTest('tktd');
    ids.so = await taoDonVi(`Sở thử ${suf}`, 'so_gddt', null, `TKTD-S-${suf}`);
    ids.a = await taoDonVi(TEN.a, 'truong', ids.so, MA_A);
    ids.b = await taoDonVi(TEN.b, 'truong', ids.so, MA_B);
    ids.c = await taoDonVi(TEN.c, 'truong', ids.so, null);
    ids.d = await taoDonVi(TEN.d, 'truong', ids.so, MA_D);
    // Trường cùng Sở nhưng không có trong danh sách của đợt → không hiện, không được cấp.
    ids.e = await taoDonVi(TEN.e, 'truong', ids.so, MA_E);

    const dot = await prisma.dot_trien_khai.create({
      data: {
        chuong_trinh: 'hsg',
        ten: `Đợt e2e tài khoản trường ${suf}`,
        han_nop: new Date('2026-12-31T16:59:59Z'),
        so_gddt_id: ids.so,
      },
    });
    dotId = dot.id;
    await prisma.hop_dong_boi_duong.createMany({
      data: [ids.a, ids.b, ids.c, ids.d].map((don_vi_id) => ({
        dot_trien_khai_id: dotId,
        don_vi_id,
      })),
    });

    quanTri = await taoNguoiDungTest({
      vai_tro: 'quan_tri',
      don_vi_id: fixture.donVi.id,
      mat_khau: 'MatKhau123',
    });
    // Trường B đã có tài khoản (và đã đăng nhập — để lấy token kiểm 403).
    truongUser = await taoNguoiDungTest({
      vai_tro: 'truong',
      don_vi_id: ids.b,
      mat_khau: 'MatKhau123',
    });
    soUser = await taoNguoiDungTest({
      vai_tro: 'so_gddt',
      don_vi_id: ids.so,
      mat_khau: 'MatKhau123',
    });
    const chiem = await prisma.nguoi_dung.create({
      data: {
        ho_ten: `Người chiếm tên ${suf}`,
        ten_dang_nhap: MA_D.toLowerCase(),
        email: `chiem-${suf}@test.local`,
        vai_tro: 'quan_tri',
        don_vi_id: fixture.donVi.id,
        mat_khau_hash: 'khong-dang-nhap-duoc',
      },
    });
    chiemTenId = chiem.id;
    tokenQuanTri = (await dangNhap(quanTri.ten_dang_nhap)).body.token;
    tokenTruong = (await dangNhap(truongUser.ten_dang_nhap)).body.token;
    tokenSo = (await dangNhap(soUser.ten_dang_nhap)).body.token;
  });

  afterAll(async () => {
    // Chỉ xóa đúng id file này tạo. Tài khoản tạo qua API: tìm theo đơn vị của file (mảng id rỗng thì bỏ qua).
    // nhat_ky_hoat_dong chỉ cho thêm (trigger chặn xóa) — để nguyên.
    const taoQuaApi =
      donViIds.length > 0
        ? await prisma.nguoi_dung.findMany({
            where: { don_vi_id: { in: donViIds }, vai_tro: 'truong' },
            select: { id: true },
          })
        : [];
    const nguoiDungIds = [
      ...taoQuaApi.map((x) => x.id),
      ...[quanTri, soUser].map((u) => u?.nguoiDung.id),
      chiemTenId,
    ].filter((id): id is string => typeof id === 'string');
    const unique = [...new Set(nguoiDungIds)];
    if (unique.length > 0) {
      await prisma.nhat_ky_dat_lai_mat_khau.deleteMany({
        where: {
          OR: [
            { nguoi_dung_id: { in: unique } },
            { thuc_hien_boi: { in: unique } },
          ],
        },
      });
      await prisma.token_xac_thuc.deleteMany({
        where: { nguoi_dung_id: { in: unique } },
      });
      for (const id of unique) await xoaNguoiDungTest(id);
    }
    if (dotId) {
      await prisma.hop_dong_boi_duong.deleteMany({
        where: { dot_trien_khai_id: dotId },
      });
      await prisma.dot_trien_khai.deleteMany({ where: { id: dotId } });
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
      await http().get(url(dotId)).expect(401);
      await http().post(url(dotId, '/cap')).expect(401);
    });

    it.each([
      ['truong', () => tokenTruong],
      ['so_gddt', () => tokenSo],
    ])('403 cho vai trò %s', async (_ten, layToken) => {
      const auth = `Bearer ${layToken()}`;
      await http().get(url(dotId)).set('Authorization', auth).expect(403);
      await http()
        .post(url(dotId, '/cap'))
        .set('Authorization', auth)
        .expect(403);
    });

    it('404 khi đợt không tồn tại', async () => {
      const khongCo = randomUUID();
      await qt(http().get(url(khongCo))).expect(404);
      await qt(http().post(url(khongCo, '/cap'))).expect(404);
    });
  });

  it('GET: các trường của đợt theo tên, trạng thái tài khoản; trường ngoài đợt không có', async () => {
    const res = await qt(http().get(url(dotId))).expect(200);
    expect(res.body.tong).toEqual({
      so_truong: 4,
      so_co_tai_khoan: 1,
      so_chua_co: 3,
      so_chua_dang_nhap: 0,
    });
    expect(
      res.body.truong.map(
        (t: { don_vi: { ten: string }; tai_khoan: unknown }) => [
          t.don_vi.ten,
          t.tai_khoan === null,
        ],
      ),
    ).toEqual([
      [TEN.a, true],
      [TEN.b, false],
      [TEN.c, true],
      [TEN.d, true],
    ]);
    const b = res.body.truong[1];
    expect(b.don_vi).toEqual({ id: ids.b, ma: MA_B, ten: TEN.b });
    expect(b.tai_khoan).toEqual({
      id: truongUser.nguoiDung.id,
      ten_dang_nhap: truongUser.ten_dang_nhap,
      trang_thai: 'active',
      lan_dang_nhap_cuoi: expect.any(String),
    });
    expect(res.body.truong[2].don_vi.ma).toBeNull();
  });

  it('POST cap: chỉ tạo cho A; C (không mã) và D (trùng tên đăng nhập) vào bo_qua; trả file mật khẩu tạm', async () => {
    const res = await qt(http().post(url(dotId, '/cap'))).expect(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.so_tao).toBe(1);
    expect(res.body.bo_qua).toEqual([
      {
        don_vi: { id: ids.c, ma: null, ten: TEN.c },
        ly_do:
          'Trường chưa có mã đơn vị — tạo tài khoản tay ở Đơn vị & tài khoản',
      },
      {
        don_vi: { id: ids.d, ma: MA_D, ten: TEN.d },
        ly_do: `Tên đăng nhập "${MA_D.toLowerCase()}": Tên đăng nhập đã được dùng`,
      },
    ]);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(
      Buffer.from(
        res.body.file_mat_khau as string,
        'base64',
      ) as unknown as ExcelJS.Buffer,
    );
    const sh = wb.worksheets[0];
    expect(sh.rowCount).toBe(2);
    expect(sh.getRow(1).values).toEqual([
      undefined,
      'STT',
      'Mã trường',
      'Tên trường',
      'Tên đăng nhập',
      'Mật khẩu tạm',
      'Ghi chú',
    ]);
    const dong = sh.getRow(2).values as unknown[];
    expect(dong.slice(1, 5)).toEqual(['1', MA_A, TEN.a, MA_A.toLowerCase()]);
    expect(dong[5]).toMatch(/^[A-Za-z2-9]{10}$/);
    expect(dong[6]).toBe('Đổi mật khẩu ở lần đăng nhập đầu tiên');
    matKhauA = dong[5] as string;

    const tkA = await prisma.nguoi_dung.findMany({
      where: { don_vi_id: ids.a },
    });
    expect(tkA).toHaveLength(1);
    expect(tkA[0]).toMatchObject({
      vai_tro: 'truong',
      ten_dang_nhap: MA_A.toLowerCase(),
      phai_doi_mat_khau: true,
      email: null,
      ho_ten: TEN.a,
    });
    expect(tkA[0].mat_khau_hash).not.toContain(matKhauA);
    for (const id of [ids.c, ids.d, ids.e]) {
      expect(await prisma.nguoi_dung.count({ where: { don_vi_id: id } })).toBe(
        0,
      );
    }
    // Nhật ký từng tài khoản (như cấp lẻ) + 1 dòng tổng hợp không chứa tên đăng nhập / mật khẩu.
    expect(
      await prisma.nhat_ky_dat_lai_mat_khau.count({
        where: {
          nguoi_dung_id: tkA[0].id,
          thuc_hien_boi: quanTri.nguoiDung.id,
        },
      }),
    ).toBe(1);
    const nk = await prisma.nhat_ky_hoat_dong.findFirst({
      where: {
        hanh_dong: 'cap_tai_khoan_truong_theo_dot',
        nguoi_dung_id: quanTri.nguoiDung.id,
      },
      orderBy: { thoi_gian: 'desc' },
    });
    expect(nk?.chi_tiet).toEqual({
      dot_trien_khai_id: dotId,
      so_tao: 1,
      so_bo_qua: 2,
    });
  });

  it('GET sau khi cấp: A đã có tài khoản, chưa đăng nhập', async () => {
    const res = await qt(http().get(url(dotId))).expect(200);
    expect(res.body.tong).toEqual({
      so_truong: 4,
      so_co_tai_khoan: 2,
      so_chua_co: 2,
      so_chua_dang_nhap: 1,
    });
    expect(res.body.truong[0].tai_khoan).toMatchObject({
      ten_dang_nhap: MA_A.toLowerCase(),
      trang_thai: 'active',
      lan_dang_nhap_cuoi: null,
    });
  });

  it('mật khẩu tạm đăng nhập được và bị buộc đổi mật khẩu', async () => {
    const dn = await dangNhap(MA_A.toLowerCase(), matKhauA);
    expect(dn.status).toBe(200);
    expect(dn.body.nguoi_dung.phai_doi_mat_khau).toBe(true);
  });

  it('chạy lại: không tạo thêm (so_tao 0, không file), vẫn báo C và D', async () => {
    const res = await qt(http().post(url(dotId, '/cap'))).expect(200);
    expect(res.body.so_tao).toBe(0);
    expect(res.body.file_mat_khau).toBeNull();
    expect(
      res.body.bo_qua.map((b: { don_vi: { id: string } }) => b.don_vi.id),
    ).toEqual([ids.c, ids.d]);
    expect(await prisma.nguoi_dung.count({ where: { don_vi_id: ids.a } })).toBe(
      1,
    );
  });
});
