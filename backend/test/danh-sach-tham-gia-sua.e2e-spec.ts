import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as ExcelJS from 'exceljs';
import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoDonViTest,
  taoNguoiDungTest,
  uniqueSuffix,
  xoaDonViTest,
  xoaNguoiDungTest,
} from './utils/test-data';

// Issue #59 / ADR 0015 S2, S3, X1, X3, Y2: Quản trị sửa/thêm/xóa từng dòng danh sách tham gia
// (bắt buộc lý do, ghi nhật ký) và xuất Excel danh sách hiện tại.
// "Nạp lại chỉ thay trường có trong file" (X3) đã có e2e ở danh-sach-tham-gia.e2e-spec.ts:
// "nạp lại 1 trường chỉ thay danh sách trường đó (không nhân đôi), trường khác giữ nguyên".
// Mọi họ tên / mã / tên trường đều BỊA, kèm hậu tố ngẫu nhiên — không có PII thật.
describe('Sửa danh sách tham gia - Cổng đơn vị (e2e)', () => {
  let app: INestApplication;
  let fixture: Awaited<ReturnType<typeof taoDonViTest>>;
  let quanTri: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let truongUser: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let soUser: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let tokenQuanTri: string;
  let tokenTruong: string;
  let tokenSo: string;

  const suf = uniqueSuffix();
  const MA_T1 = `TR-SUA-001-${suf}`;
  const TEN_T1 = `Trường B Thử Sửa ${suf}`;
  const TEN_T2 = `Trường A Thử Sửa ${suf}`;
  // Thứ tự tạo = thứ tự xóa ngược (con trước cha).
  const donViIds: string[] = [];
  const dotIds: string[] = [];
  const ids = {} as Record<'soA' | 'soB' | 't1' | 't2' | 'tB1', string>;
  let dotHsg: string;
  let dotNls: string;

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const qt = () => auth(tokenQuanTri);
  const urlDong = (dongId: string) =>
    `/cong-don-vi/danh-sach-tham-gia/${dongId}`;
  const urlDot = (dot: string, duoi: string) =>
    `/cong-don-vi/dot-trien-khai/${dot}/${duoi}`;

  const sua = (dongId: string, body: object) =>
    http().patch(urlDong(dongId)).set(qt()).send(body);
  const xoa = (dongId: string, body?: object) => {
    const req = http().delete(urlDong(dongId)).set(qt());
    return body ? req.send(body) : req;
  };
  const them = (dot: string, body: object) =>
    http().post(urlDot(dot, 'danh-sach')).set(qt()).send(body);
  const taiExcel = (dot: string, query: Record<string, string> = {}) =>
    http()
      .get(urlDot(dot, 'danh-sach/xuat-excel'))
      .query(query)
      .set(qt())
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });

  async function dangNhap(ten_dang_nhap: string) {
    const res = await http()
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap, mat_khau: 'MatKhau123' })
      .expect(200);
    return res.body.token as string;
  }

  async function taoDonVi(
    ten: string,
    loai: 'so_gddt' | 'truong',
    cha: string | null,
    ma?: string,
  ) {
    const dv = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: ma ?? `DSTGS-${uniqueSuffix()}`,
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

  async function taoDot(chuong_trinh: 'hsg' | 'nls', so: string) {
    const dot = await prisma.dot_trien_khai.create({
      data: {
        chuong_trinh,
        ten: `Đợt sửa e2e ${chuong_trinh} ${suf}`,
        han_nop: new Date('2026-12-31T16:59:59Z'),
        so_gddt_id: so,
      },
    });
    dotIds.push(dot.id);
    return dot.id;
  }

  /** Dòng tạo thẳng bằng prisma (đã có ý kiến trường) — luôn thuộc 1 đợt trong dotIds nên được dọn. */
  async function taoDong(
    over: Partial<Prisma.danh_sach_tham_giaUncheckedCreateInput> = {},
  ) {
    return prisma.danh_sach_tham_gia.create({
      data: {
        dot_trien_khai_id: dotHsg,
        don_vi_id: ids.t1,
        ho_ten: `GV Bịa ${uniqueSuffix()}`,
        ngay_sinh: new Date('1990-02-01T00:00:00Z'),
        gioi_tinh: 'Nam',
        ma_goc: 'M-1',
        lop: 'Lớp A',
        giai_doan: 'ca_hai',
        ty_le_suat: 1,
        y_kien_truong: 'Trường đã xác nhận',
        updated_at: new Date('2026-01-01T00:00:00Z'),
        ...over,
      },
    });
  }

  const nhatKyCua = (hanh_dong: string, dongId: string) =>
    prisma.nhat_ky_hoat_dong.findMany({
      where: { hanh_dong, chi_tiet: { path: ['dong_id'], equals: dongId } },
      orderBy: { thoi_gian: 'desc' },
    });

  beforeAll(async () => {
    app = await createTestApp();
    fixture = await taoDonViTest('dstgs');
    ids.soA = await taoDonVi(`Sở thử sửa A ${suf}`, 'so_gddt', null);
    ids.soB = await taoDonVi(`Sở thử sửa B ${suf}`, 'so_gddt', null);
    ids.t1 = await taoDonVi(TEN_T1, 'truong', ids.soA, MA_T1);
    ids.t2 = await taoDonVi(TEN_T2, 'truong', ids.soA);
    ids.tB1 = await taoDonVi(`Trường Sở Khác ${suf}`, 'truong', ids.soB);
    dotHsg = await taoDot('hsg', ids.soA);
    dotNls = await taoDot('nls', ids.soA);

    quanTri = await taoNguoiDungTest({
      vai_tro: 'quan_tri',
      don_vi_id: fixture.donVi.id,
      mat_khau: 'MatKhau123',
    });
    truongUser = await taoNguoiDungTest({
      vai_tro: 'truong',
      don_vi_id: ids.t1,
      mat_khau: 'MatKhau123',
    });
    soUser = await taoNguoiDungTest({
      vai_tro: 'so_gddt',
      don_vi_id: ids.soA,
      mat_khau: 'MatKhau123',
    });
    tokenQuanTri = await dangNhap(quanTri.ten_dang_nhap);
    tokenTruong = await dangNhap(truongUser.ten_dang_nhap);
    tokenSo = await dangNhap(soUser.ten_dang_nhap);
  });

  afterAll(async () => {
    // Chỉ xóa đúng các dòng file này tạo (id ghi lại; mảng rỗng thì bỏ qua).
    // nhat_ky_hoat_dong chỉ cho thêm (trigger chặn xóa) — để nguyên.
    if (dotIds.length > 0) {
      await prisma.danh_sach_tham_gia.deleteMany({
        where: { dot_trien_khai_id: { in: dotIds } },
      });
      // Issue #60: nạp/thêm dòng tạo kèm dòng hợp đồng (FK tới đợt) — dọn trước khi xóa đợt.
      await prisma.hop_dong_boi_duong.deleteMany({
        where: { dot_trien_khai_id: { in: dotIds } },
      });
      await prisma.dot_trien_khai.deleteMany({ where: { id: { in: dotIds } } });
    }
    for (const u of [quanTri, truongUser, soUser]) {
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
      const dong = await taoDong();
      await http().patch(urlDong(dong.id)).send({ ly_do: 'x' }).expect(401);
      await http().delete(urlDong(dong.id)).send({ ly_do: 'x' }).expect(401);
      await http().post(urlDot(dotHsg, 'danh-sach')).send({}).expect(401);
      await http().get(urlDot(dotHsg, 'danh-sach/xuat-excel')).expect(401);
    });

    it.each([
      ['truong', () => tokenTruong],
      ['so_gddt', () => tokenSo],
    ])(
      '403 cho vai trò %s ở sửa/thêm/xóa/xuất Excel, dòng không đổi',
      async (_ten, layToken) => {
        const dong = await taoDong();
        const a = auth(layToken());
        const body = { ly_do: 'Thử quyền', ho_ten: 'GV Bịa Đổi' };
        await http().patch(urlDong(dong.id)).set(a).send(body).expect(403);
        await http().delete(urlDong(dong.id)).set(a).send(body).expect(403);
        await http()
          .post(urlDot(dotHsg, 'danh-sach'))
          .set(a)
          .send({ ...body, don_vi_id: ids.t1 })
          .expect(403);
        await http()
          .get(urlDot(dotHsg, 'danh-sach/xuat-excel'))
          .set(a)
          .expect(403);
        expect(
          await prisma.danh_sach_tham_gia.findUnique({
            where: { id: dong.id },
          }),
        ).toEqual(dong);
      },
    );
  });

  describe('Sửa dòng (PATCH)', () => {
    it.each([
      ['thiếu lý do', {}],
      ['lý do toàn khoảng trắng', { ly_do: '   ' }],
      ['lý do quá 500 ký tự', { ly_do: 'x'.repeat(501) }],
    ])('%s → 400 VALIDATION_ERROR, dòng không đổi', async (_ten, lyDo) => {
      const dong = await taoDong();
      const res = await sua(dong.id, { ...lyDo, ho_ten: 'GV Bịa Đổi' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.fields).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'ly_do' })]),
      );
      expect(
        await prisma.danh_sach_tham_gia.findUnique({ where: { id: dong.id } }),
      ).toEqual(dong);
    });

    it('có lý do → 200, đổi đúng các trường gửi lên, mất ý kiến trường, nhật ký trước/sau + lý do + người sửa', async () => {
      const dong = await taoDong();
      const res = await sua(dong.id, {
        ly_do: '  Trường báo sai họ tên  ',
        ho_ten: 'GV Bịa Đã Sửa',
        ngay_sinh: null,
        don_vi_id: ids.t2,
        lop: 'Lớp B',
      });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: dong.id,
        don_vi_id: ids.t2,
        ho_ten: 'GV Bịa Đã Sửa',
        ngay_sinh: null,
        gioi_tinh: 'Nam',
        ma_goc: 'M-1',
        lop: 'Lớp B',
        giai_doan: 'ca_hai',
        ty_le_suat: 1,
        ghi_chu: null,
        y_kien_truong: null,
        hoc_vien_id: null,
      });
      const db = await prisma.danh_sach_tham_gia.findUniqueOrThrow({
        where: { id: dong.id },
      });
      expect(db.y_kien_truong).toBeNull();
      expect(db.updated_at.getTime()).toBeGreaterThan(
        dong.updated_at.getTime(),
      );

      const nk = await nhatKyCua('sua_dong_danh_sach', dong.id);
      expect(nk).toHaveLength(1);
      expect(nk[0].nguoi_dung_id).toBe(quanTri.nguoiDung.id);
      expect(nk[0].vai_tro).toBe('quan_tri');
      expect(nk[0].thoi_gian).toBeInstanceOf(Date);
      expect(nk[0].chi_tiet).toEqual({
        dot_trien_khai_id: dotHsg,
        dong_id: dong.id,
        don_vi_id: ids.t2,
        ly_do: 'Trường báo sai họ tên',
        truoc: {
          don_vi_id: ids.t1,
          ho_ten: dong.ho_ten,
          ngay_sinh: '1990-02-01',
          lop: 'Lớp A',
          y_kien_truong: 'Trường đã xác nhận',
        },
        sau: {
          don_vi_id: ids.t2,
          ho_ten: 'GV Bịa Đã Sửa',
          ngay_sinh: null,
          lop: 'Lớp B',
          y_kien_truong: null,
        },
      });
    });

    it('chỉ gửi giai đoạn → suất suy theo giai đoạn', async () => {
      const dong = await taoDong();
      const res = await sua(dong.id, {
        ly_do: 'Chỉ học GĐ1',
        giai_doan: 'chi_gd1',
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ giai_doan: 'chi_gd1', ty_le_suat: 0.5 });
    });

    it('gửi suất 0,5 cùng giai đoạn Cả 2 (thay giữa chừng, S2) → chấp nhận', async () => {
      const dong = await taoDong();
      const res = await sua(dong.id, {
        ly_do: 'Thay giữa chừng',
        giai_doan: 'ca_hai',
        ty_le_suat: 0.5,
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ giai_doan: 'ca_hai', ty_le_suat: 0.5 });
      const db = await prisma.danh_sach_tham_gia.findUniqueOrThrow({
        where: { id: dong.id },
      });
      expect(Number(db.ty_le_suat)).toBe(0.5);
    });

    it.each([
      ['trường ở Sở khác', () => ids.tB1],
      ['chính Sở', () => ids.soA],
    ])('chuyển sang %s → 400, dòng không đổi', async (_ten, layId) => {
      const dong = await taoDong();
      const res = await sua(dong.id, {
        ly_do: 'Đổi trường',
        don_vi_id: layId(),
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(
        await prisma.danh_sach_tham_gia.findUnique({ where: { id: dong.id } }),
      ).toEqual(dong);
    });

    it('giá trị sai (họ tên null, suất 0,7) → 400', async () => {
      const dong = await taoDong();
      expect((await sua(dong.id, { ly_do: 'x', ho_ten: null })).status).toBe(
        400,
      );
      expect((await sua(dong.id, { ly_do: 'x', ty_le_suat: 0.7 })).status).toBe(
        400,
      );
    });

    it('không đổi gì → 200, không ghi nhật ký, giữ ý kiến trường', async () => {
      const dong = await taoDong();
      const res = await sua(dong.id, {
        ly_do: 'Không đổi',
        ho_ten: dong.ho_ten,
        giai_doan: 'ca_hai',
      });
      expect(res.status).toBe(200);
      expect(res.body.y_kien_truong).toBe('Trường đã xác nhận');
      expect(await nhatKyCua('sua_dong_danh_sach', dong.id)).toHaveLength(0);
      expect(
        await prisma.danh_sach_tham_gia.findUnique({ where: { id: dong.id } }),
      ).toEqual(dong);
    });

    it('dòng không tồn tại → 404', async () => {
      const res = await sua(randomUUID(), { ly_do: 'x', ho_ten: 'A' });
      expect(res.status).toBe(404);
    });
  });

  describe('Thêm dòng (POST)', () => {
    it('thiếu lý do → 400 VALIDATION_ERROR, không thêm', async () => {
      const ten = `GV Bịa Thêm ${uniqueSuffix()}`;
      const res = await them(dotHsg, { don_vi_id: ids.t1, ho_ten: ten });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(
        await prisma.danh_sach_tham_gia.count({ where: { ho_ten: ten } }),
      ).toBe(0);
    });

    it('có lý do → 201, giai đoạn mặc định Cả 2 / 1 suất, nhật ký có bản chụp sau', async () => {
      const ten = `GV Bịa Thêm ${uniqueSuffix()}`;
      const res = await them(dotHsg, {
        ly_do: 'Bổ sung người',
        don_vi_id: ids.t1,
        ho_ten: ten,
        ngay_sinh: '1991-03-04',
      });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        don_vi_id: ids.t1,
        ho_ten: ten,
        ngay_sinh: '1991-03-04',
        giai_doan: 'ca_hai',
        ty_le_suat: 1,
        y_kien_truong: null,
      });
      const db = await prisma.danh_sach_tham_gia.findUniqueOrThrow({
        where: { id: res.body.id },
      });
      expect(db.dot_trien_khai_id).toBe(dotHsg);
      expect(db.created_by).toBe(quanTri.nguoiDung.id);

      const nk = await nhatKyCua('them_dong_danh_sach', res.body.id);
      expect(nk).toHaveLength(1);
      expect(nk[0].nguoi_dung_id).toBe(quanTri.nguoiDung.id);
      expect(nk[0].chi_tiet).toMatchObject({
        dot_trien_khai_id: dotHsg,
        dong_id: res.body.id,
        don_vi_id: ids.t1,
        ly_do: 'Bổ sung người',
        truoc: null,
        sau: { ho_ten: ten, giai_doan: 'ca_hai', ty_le_suat: 1 },
      });
    });

    it('chỉ GĐ2 → 0,5; gửi suất 0,5 với Cả 2 → giữ 0,5', async () => {
      const a = await them(dotHsg, {
        ly_do: 'x',
        don_vi_id: ids.t2,
        ho_ten: `GV Bịa ${uniqueSuffix()}`,
        giai_doan: 'chi_gd2',
      });
      expect(a.status).toBe(201);
      expect(a.body).toMatchObject({ giai_doan: 'chi_gd2', ty_le_suat: 0.5 });
      const b = await them(dotHsg, {
        ly_do: 'Người thay giữa chừng',
        don_vi_id: ids.t2,
        ho_ten: `GV Bịa ${uniqueSuffix()}`,
        ty_le_suat: 0.5,
      });
      expect(b.status).toBe(201);
      expect(b.body).toMatchObject({ giai_doan: 'ca_hai', ty_le_suat: 0.5 });
    });

    it('trường ngoài phạm vi Sở → 400; đợt NLS → 400; đợt không tồn tại → 404', async () => {
      const body = { ly_do: 'x', ho_ten: `GV Bịa ${uniqueSuffix()}` };
      const ngoai = await them(dotHsg, { ...body, don_vi_id: ids.tB1 });
      expect(ngoai.status).toBe(400);
      const nls = await them(dotNls, { ...body, don_vi_id: ids.t1 });
      expect(nls.status).toBe(400);
      expect(nls.body.error.message).toBe('Đợt NLS lấy danh sách từ khóa');
      const khong = await them(randomUUID(), { ...body, don_vi_id: ids.t1 });
      expect(khong.status).toBe(404);
      expect(
        await prisma.danh_sach_tham_gia.count({
          where: { ho_ten: body.ho_ten },
        }),
      ).toBe(0);
    });
  });

  describe('Xóa dòng (DELETE + body { ly_do })', () => {
    it.each([
      ['không có body', undefined],
      ['lý do trống', { ly_do: '' }],
    ])('%s → 400 VALIDATION_ERROR, dòng còn nguyên', async (_ten, body) => {
      const dong = await taoDong();
      const res = await xoa(dong.id, body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(
        await prisma.danh_sach_tham_gia.findUnique({ where: { id: dong.id } }),
      ).toEqual(dong);
    });

    it('có lý do → 204, dòng mất, nhật ký giữ bản chụp đầy đủ', async () => {
      const dong = await taoDong({ ghi_chu: 'ghi chú bịa' });
      const res = await xoa(dong.id, { ly_do: 'Trùng người' });
      expect(res.status).toBe(204);
      expect(
        await prisma.danh_sach_tham_gia.findUnique({ where: { id: dong.id } }),
      ).toBeNull();

      const nk = await nhatKyCua('xoa_dong_danh_sach', dong.id);
      expect(nk).toHaveLength(1);
      expect(nk[0].nguoi_dung_id).toBe(quanTri.nguoiDung.id);
      expect(nk[0].chi_tiet).toEqual({
        dot_trien_khai_id: dotHsg,
        dong_id: dong.id,
        don_vi_id: ids.t1,
        ly_do: 'Trùng người',
        truoc: {
          don_vi_id: ids.t1,
          ho_ten: dong.ho_ten,
          ngay_sinh: '1990-02-01',
          gioi_tinh: 'Nam',
          ma_goc: 'M-1',
          lop: 'Lớp A',
          giai_doan: 'ca_hai',
          ty_le_suat: 1,
          ghi_chu: 'ghi chú bịa',
          y_kien_truong: 'Trường đã xác nhận',
          hoc_vien_id: null,
        },
        sau: null,
      });
    });

    it('dòng không tồn tại → 404', async () => {
      expect((await xoa(randomUUID(), { ly_do: 'x' })).status).toBe(404);
    });
  });

  describe('Xuất Excel danh sách hiện tại', () => {
    const TIEU_DE = [
      'Họ và tên',
      'Ngày sinh',
      'Giới tính',
      'Mã gốc',
      'Lớp',
      'Mã trường',
      'Tên trường',
      'Giai đoạn tham gia',
      'Ghi chú',
      'Tỷ lệ suất',
      'Ý kiến của trường',
    ];
    let dotXuat: string;

    async function docSheet(buf: Buffer) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
      const sh = wb.worksheets[0];
      const dong: unknown[][] = [];
      sh.eachRow((r) => dong.push((r.values as unknown[]).slice(1)));
      return { sh, dong };
    }

    beforeAll(async () => {
      dotXuat = await taoDot('hsg', ids.soA);
      const tao = (don_vi_id: string, ho_ten: string) =>
        prisma.danh_sach_tham_gia.create({
          data: {
            dot_trien_khai_id: dotXuat,
            don_vi_id,
            ho_ten,
            giai_doan: 'ca_hai',
            ty_le_suat: 1,
            y_kien_truong: 'Đúng',
          },
        });
      // t1 = "Trường B…", t2 = "Trường A…": thứ tự xuất theo tên trường rồi họ tên.
      await tao(ids.t1, 'GV Bịa Bình');
      const sua1 = await tao(ids.t1, 'GV Bịa An');
      await tao(ids.t2, 'GV Bịa Chi');
      const res = await sua(sua1.id, {
        ly_do: 'Sửa trước khi xuất',
        ngay_sinh: '1992-07-08',
        ma_goc: '00123',
        ty_le_suat: 0.5,
      });
      expect(res.status).toBe(200);
    });

    it('200, xlsx, no-store, tên file theo đợt; dòng tiêu đề đúng file mẫu + 2 cột; dữ liệu hiện tại (sau sửa), theo tên trường rồi họ tên', async () => {
      const res = await taiExcel(dotXuat);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml');
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['content-disposition']).toMatch(
        /^attachment; filename="danh-sach-dot-sua-e2e-hsg-[a-z0-9-]+-\d{8}\.xlsx"$/,
      );
      const { sh, dong } = await docSheet(res.body as Buffer);
      expect(dong[0]).toEqual(TIEU_DE);
      expect(dong.slice(1).map((d) => [d[0], d[6]])).toEqual([
        ['GV Bịa Chi', TEN_T2],
        ['GV Bịa An', TEN_T1],
        ['GV Bịa Bình', TEN_T1],
      ]);
      // Dòng đã sửa: ngày là ô ngày thật dd/mm/yyyy, mã giữ số 0 đầu, suất 0,5, mất ý kiến trường
      // (ô trống cuối dòng không có trong values).
      expect(dong[2]).toEqual([
        'GV Bịa An',
        new Date(Date.UTC(1992, 6, 8)),
        undefined,
        '00123',
        undefined,
        MA_T1,
        TEN_T1,
        'Cả 2',
        undefined,
        0.5,
      ]);
      expect(sh.getRow(3).getCell(2).numFmt).toBe('dd/mm/yyyy');
      expect(dong[3][10]).toBe('Đúng');
    });

    it('lọc 1 trường theo don_vi_id', async () => {
      const res = await taiExcel(dotXuat, { don_vi_id: ids.t2 });
      expect(res.status).toBe(200);
      const { dong } = await docSheet(res.body as Buffer);
      expect(dong.slice(1).map((d) => d[0])).toEqual(['GV Bịa Chi']);
    });

    it('mỗi lần xuất ghi nhật ký xuat_danh_sach_tham_gia (người xuất, đợt, trường, số dòng), không PII', async () => {
      const nhatKyXuat = () =>
        prisma.nhat_ky_hoat_dong.findMany({
          where: {
            hanh_dong: 'xuat_danh_sach_tham_gia',
            chi_tiet: { path: ['dot_trien_khai_id'], equals: dotXuat },
          },
          orderBy: { thoi_gian: 'desc' },
        });
      const truoc = (await nhatKyXuat()).length;
      expect((await taiExcel(dotXuat)).status).toBe(200);
      expect((await taiExcel(dotXuat, { don_vi_id: ids.t2 })).status).toBe(200);
      const nk = await nhatKyXuat();
      expect(nk).toHaveLength(truoc + 2);
      for (const n of nk.slice(0, 2)) {
        expect(n.nguoi_dung_id).toBe(quanTri.nguoiDung.id);
        expect(n.vai_tro).toBe('quan_tri');
      }
      expect(nk.map((n) => n.chi_tiet)).toEqual(
        expect.arrayContaining([
          { dot_trien_khai_id: dotXuat, don_vi_id: null, so_dong: 3 },
          { dot_trien_khai_id: dotXuat, don_vi_id: ids.t2, so_dong: 1 },
        ]),
      );
      expect(JSON.stringify(nk.map((n) => n.chi_tiet))).not.toMatch(
        /GV Bịa|1992|00123/,
      );
    });

    it('đợt NLS vẫn xuất được (chỉ tiêu đề nếu chưa có dòng); đợt không tồn tại → 404', async () => {
      const res = await taiExcel(dotNls);
      expect(res.status).toBe(200);
      const { dong } = await docSheet(res.body as Buffer);
      expect(dong).toEqual([TIEU_DE]);
      expect((await taiExcel(randomUUID())).status).toBe(404);
    });
  });
});
