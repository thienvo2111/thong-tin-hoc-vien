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
import { hanNopTuNgay, ngayVietNam } from '../src/cong-don-vi/han-nop';

// Issue #66 / ADR 0015 T1, T2, T3, X5: hạn nộp — sau hạn hiệu lực (han_rieng ?? han_nop) trường không thao tác
// được (403 HET_HAN_DOT) nhưng vẫn xem; hồ sơ đơn vị và Quản trị không bị chặn; gia hạn cả đợt / riêng 1 trường;
// bảng Tiến độ lọc Quá hạn. Hạn được dời bằng prisma (không chờ đồng hồ). Mốc 23:59:59 kiểm ở unit test.
// Các test chạy TUẦN TỰ trên cùng dữ liệu. Mọi tên, SĐT, MST, STK đều BỊA.
describe('Hạn nộp - khóa sau hạn, gia hạn, Quá hạn - Cổng đơn vị (e2e)', () => {
  let app: INestApplication;
  let fixture: Awaited<ReturnType<typeof taoDonViTest>>;
  type NguoiDungTest = Awaited<ReturnType<typeof taoNguoiDungTest>>;
  const nguoiDung: NguoiDungTest[] = [];
  type VaiTro = 'quanTri' | 'truongA' | 'truongB' | 'truongC' | 'so';
  const token = {} as Record<VaiTro, string>;
  const userId = {} as Record<VaiTro, string>;

  const suf = uniqueSuffix();
  const MAT_KHAU = 'MatKhau123';
  const donViIds: string[] = [];
  const dotIds: string[] = [];
  const ids = {} as Record<'so' | 'tA' | 'tB' | 'tC', string>;
  let dotId = '';
  const dongId: Record<string, string> = {};
  let deNghiA = '';

  const MOT_NGAY = 24 * 60 * 60 * 1000;
  const ngayLech = (soNgay: number) =>
    ngayVietNam(new Date(Date.now() + soNgay * MOT_NGAY));
  const HOM_QUA = ngayLech(-1);
  const HOM_NAY = ngayLech(0);
  const TUAN_SAU = ngayLech(7);
  const hienThi = (ngay: string) => ngay.split('-').reverse().join('/');
  const MSG_HET_HAN = `Đã hết hạn ngày ${hienThi(HOM_QUA)} — liên hệ HCMUE để được gia hạn`;

  const HO_SO = {
    ten_truong: 'Trường THCS Bịa Hạn Nộp',
    dia_chi: 'Ấp Bịa, xã Thử, tỉnh Giả',
    nguoi_dai_dien: 'Người Đại Diện Bịa',
    sdt_dai_dien: '0900000001',
  };

  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const urlTruong = (duoi: string) =>
    `/cong-don-vi/truong/dot/${dotId}/${duoi}`;
  const urlQt = (duoi: string) =>
    `/cong-don-vi/dot-trien-khai/${dotId}/${duoi}`;
  const urlHanRieng = (donViId: string) =>
    urlQt(`hop-dong/${donViId}/han-rieng`);

  /** Mọi thao tác ghi của trường trên đợt (T2). */
  const thaoTac = {
    yKien: (v: VaiTro, id: string) =>
      http()
        .put(urlTruong(`danh-sach/${id}/y-kien`))
        .set(auth(token[v]))
        .send({ y_kien: 'dong_y' }),
    dongYTatCa: (v: VaiTro) =>
      http().post(urlTruong('danh-sach/dong-y-tat-ca')).set(auth(token[v])),
    xacNhan: (v: VaiTro) =>
      http().post(urlTruong('danh-sach/xac-nhan')).set(auth(token[v])),
    guiDeNghi: (v: VaiTro) =>
      http()
        .post(urlTruong('de-nghi'))
        .set(auth(token[v]))
        .send({ loai: 'them', gia_tri: { ho_ten: `GV Bịa Thêm ${suf}` } }),
    luuHopDong: (v: VaiTro) =>
      http()
        .put(urlTruong('hop-dong'))
        .set(auth(token[v]))
        .send({ nguoi_nhan: 'Người Nhận Bịa' }),
    nop: (v: VaiTro) =>
      http().post(urlTruong('hop-dong/nop')).set(auth(token[v])),
  };
  const getDs = (v: VaiTro) =>
    http().get(urlTruong('danh-sach')).set(auth(token[v]));
  const getHd = (v: VaiTro) =>
    http().get(urlTruong('hop-dong')).set(auth(token[v]));
  const getThe = async (v: VaiTro) => {
    const res = await http()
      .get('/cong-don-vi/truong/dot')
      .set(auth(token[v]))
      .expect(200);
    return (res.body as { dot: { id: string } }[]).find(
      (t) => t.dot.id === dotId,
    ) as Record<string, unknown>;
  };
  const putHanRieng = (donViId: string, body: object, v: VaiTro = 'quanTri') =>
    http().put(urlHanRieng(donViId)).set(auth(token[v])).send(body);

  const datHanDot = (ngay: string) =>
    prisma.dot_trien_khai.update({
      where: { id: dotId },
      data: { han_nop: hanNopTuNgay(ngay) },
    });
  const hopDong = (don_vi_id: string) =>
    prisma.hop_dong_boi_duong.findUniqueOrThrow({
      where: {
        dot_trien_khai_id_don_vi_id: { dot_trien_khai_id: dotId, don_vi_id },
      },
    });
  const expectHetHan = (res: request.Response) => {
    expect(res.status).toBe(403);
    expect(res.body.error).toEqual({
      code: 'HET_HAN_DOT',
      message: MSG_HET_HAN,
    });
  };
  const fieldsCua = (res: request.Response) =>
    (res.body.error.fields as { field: string }[]).map((f) => f.field);

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
        ma_don_vi: `HANP-${uniqueSuffix()}`,
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

  const dong = (don_vi_id: string, tenNguoi: string) => ({
    don_vi_id,
    ho_ten: `GV Bịa ${tenNguoi} ${suf}`,
    ngay_sinh: '1991-03-04',
    lop: 'Toán 9',
    giai_doan: 'ca_hai',
  });

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    fixture = await taoDonViTest('hannop');
    ids.so = await taoDonVi(`Sở thử hạn nộp ${suf}`, 'so_gddt', null);
    ids.tA = await taoDonVi(`Trường A Hạn Bịa ${suf}`, 'truong', ids.so);
    ids.tB = await taoDonVi(`Trường B Hạn Bịa ${suf}`, 'truong', ids.so);
    ids.tC = await taoDonVi(`Trường C Hạn Bịa ${suf}`, 'truong', ids.so);
    const d = await prisma.dot_trien_khai.create({
      data: {
        chuong_trinh: 'hsg',
        ten: `HSG hạn nộp ${suf}`,
        don_gia: 1_000_000,
        han_nop: hanNopTuNgay(TUAN_SAU),
        so_gddt_id: ids.so,
      },
    });
    dotIds.push(d.id);
    dotId = d.id;

    await taoTaiKhoan('quanTri', 'quan_tri', fixture.donVi.id);
    await taoTaiKhoan('truongA', 'truong', ids.tA);
    await taoTaiKhoan('truongB', 'truong', ids.tB);
    await taoTaiKhoan('truongC', 'truong', ids.tC);
    await taoTaiKhoan('so', 'so_gddt', ids.so);

    const nap = await http()
      .post(urlQt('danh-sach/nap'))
      .set(auth(token.quanTri))
      .send({
        dong: [
          dong(ids.tA, 'An'),
          dong(ids.tA, 'Bình'),
          dong(ids.tB, 'Em'),
          dong(ids.tC, 'Hà'),
        ],
      });
    expect(nap.status).toBe(200);
    for (const v of ['truongA', 'truongB'] as const) {
      const res = await getDs(v).expect(200);
      for (const r of res.body.dong as { id: string; ho_ten: string }[]) {
        dongId[r.ho_ten.split(' ')[2]] = r.id;
      }
    }
    // C đã nộp hợp đồng (dựng thẳng bằng prisma — đủ CHECK chk_hop_dong_da_nop_co_ban_chup).
    await prisma.hop_dong_boi_duong.update({
      where: {
        dot_trien_khai_id_don_vi_id: {
          dot_trien_khai_id: dotId,
          don_vi_id: ids.tC,
        },
      },
      data: {
        trang_thai_danh_sach: 'da_xac_nhan',
        trang_thai_hop_dong: 'da_nop',
        nop_luc: new Date(),
        nop_boi: userId.truongC,
        ban_chup_ho_so: {
          ten_truong: 'Bản chụp Bịa',
        } as Prisma.InputJsonObject,
        so_nguoi_luc_nop: 1,
        tong_suat_luc_nop: 1,
        don_gia_luc_nop: 1_000_000,
        gia_tri_luc_nop: BigInt(1_000_000),
      },
    });
  });

  afterAll(async () => {
    // Chỉ xóa đúng các dòng file này tạo (theo id đợt / đơn vị đã ghi; mảng rỗng thì bỏ qua).
    // nhat_ky_hoat_dong chỉ cho thêm (trigger chặn xóa) — để nguyên.
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
    for (const id of [ids.tA, ids.tB, ids.tC]) {
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

  describe('Trước hạn — thao tác của trường chạy bình thường', () => {
    it('thẻ / danh sách / hợp đồng: còn hạn, hạn hiệu lực = hạn đợt, chưa có hạn riêng', async () => {
      const mong = {
        han_rieng: null,
        han_hieu_luc: hanNopTuNgay(TUAN_SAU).toISOString(),
        han_hieu_luc_ngay: TUAN_SAU,
        da_het_han: false,
      };
      expect(await getThe('truongA')).toMatchObject(mong);
      expect((await getDs('truongA').expect(200)).body).toMatchObject(mong);
      const hd = (await getHd('truongA').expect(200)).body;
      expect(hd).toMatchObject(mong);
      expect(hd.dot.han_nop).toBe(mong.han_hieu_luc);
    });

    it('ý kiến, đồng ý tất cả, xác nhận, lưu nháp → 200; nộp chỉ bị chặn bởi điều kiện khác (400); gửi đề nghị → 201', async () => {
      expect((await thaoTac.yKien('truongA', dongId.An)).status).toBe(200);
      expect((await thaoTac.dongYTatCa('truongA')).status).toBe(200);
      expect((await thaoTac.xacNhan('truongA')).status).toBe(200);
      expect((await thaoTac.luuHopDong('truongA')).status).toBe(200);
      const nop = await thaoTac.nop('truongA');
      expect(nop.status).toBe(400);
      expect(fieldsCua(nop)).not.toContain('da_het_han');
      const gui = await thaoTac.guiDeNghi('truongA');
      expect(gui.status).toBe(201);
      deNghiA = (gui.body.de_nghi as { id: string; trang_thai: string }[]).find(
        (x) => x.trang_thai === 'cho',
      ).id;
    });
  });

  describe('Sau hạn (hạn đợt = hôm qua, không hạn riêng)', () => {
    beforeAll(async () => {
      await datHanDot(HOM_QUA);
    });

    it.each([
      ['PUT ý kiến', () => thaoTac.yKien('truongA', dongId.Bình)],
      ['POST đồng ý tất cả', () => thaoTac.dongYTatCa('truongA')],
      ['POST xác nhận danh sách', () => thaoTac.xacNhan('truongA')],
      ['POST gửi đề nghị', () => thaoTac.guiDeNghi('truongA')],
      ['PUT hợp đồng (Phần 3–4)', () => thaoTac.luuHopDong('truongA')],
      ['POST nộp hợp đồng', () => thaoTac.nop('truongA')],
    ])('%s → 403 HET_HAN_DOT', async (_ten, goi) => {
      expectHetHan(await goi());
    });

    it('bị chặn thì không đổi dữ liệu (trạng thái, Phần 3, số đề nghị)', async () => {
      const h = await hopDong(ids.tA);
      expect(h.trang_thai_hop_dong).toBe('chua_nop');
      expect(h.nguoi_nhan).toBe('Người Nhận Bịa');
      expect(
        await prisma.de_nghi_sua_danh_sach.count({
          where: { dot_trien_khai_id: dotId, don_vi_id: ids.tA },
        }),
      ).toBe(1);
    });

    it('X5 xét trước hạn: trường đã nộp (C) → 409 CONFLICT, không phải 403', async () => {
      const res = await thaoTac.dongYTatCa('truongC');
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect((await thaoTac.nop('truongC')).status).toBe(409);
    });

    it('GET vẫn 200: thẻ, danh sách (không xác nhận được + lý do), hợp đồng (ly_do_chan có da_het_han)', async () => {
      const mong = {
        han_rieng: null,
        han_hieu_luc_ngay: HOM_QUA,
        da_het_han: true,
      };
      expect(await getThe('truongA')).toMatchObject(mong);
      const ds = (await getDs('truongA').expect(200)).body;
      expect(ds).toMatchObject({
        ...mong,
        co_the_xac_nhan: false,
        ly_do_khong_xac_nhan: MSG_HET_HAN,
      });
      const hd = (await getHd('truongA').expect(200)).body;
      expect(hd).toMatchObject({ ...mong, co_the_nop: false });
      expect(hd.ly_do_chan[0]).toEqual({
        ma: 'da_het_han',
        thong_diep: MSG_HET_HAN,
      });
    });

    it('Hồ sơ đơn vị KHÔNG khóa: PUT → 200', async () => {
      await http()
        .put('/cong-don-vi/ho-so-don-vi')
        .set(auth(token.truongA))
        .send(HO_SO)
        .expect(200);
    });

    it('Quản trị không bị hạn chặn: sửa dòng, áp dụng đề nghị → 200', async () => {
      await http()
        .patch(`/cong-don-vi/danh-sach-tham-gia/${dongId.Em}`)
        .set(auth(token.quanTri))
        .send({ ly_do: 'Sửa lớp bịa', lop: 'Toán 8' })
        .expect(200);
      await http()
        .post(`/cong-don-vi/de-nghi-sua/${deNghiA}/ap-dung`)
        .set(auth(token.quanTri))
        .expect(200);
    });
  });

  describe('Gia hạn cả đợt (PATCH đợt, T3)', () => {
    it('dời hạn đợt sang tuần sau → trường thao tác lại được; dời về hôm qua → chặn lại', async () => {
      await http()
        .patch(`/cong-don-vi/dot-trien-khai/${dotId}`)
        .set(auth(token.quanTri))
        .send({ han_nop_ngay: TUAN_SAU })
        .expect(200);
      expect((await thaoTac.yKien('truongB', dongId.Em)).status).toBe(200);
      expect(await getThe('truongB')).toMatchObject({ da_het_han: false });
      await datHanDot(HOM_QUA);
      expectHetHan(await thaoTac.yKien('truongB', dongId.Em));
    });
  });

  describe('Gia hạn riêng 1 trường (PUT han-rieng, T3)', () => {
    it('401 không token; trường / Sở → 403', async () => {
      await http()
        .put(urlHanRieng(ids.tA))
        .send({ han_rieng: TUAN_SAU, ly_do: 'x' })
        .expect(401);
      for (const v of ['truongA', 'so'] as const) {
        const res = await putHanRieng(
          ids.tA,
          { han_rieng: TUAN_SAU, ly_do: 'x' },
          v,
        );
        expect(res.status).toBe(403);
      }
    });

    it.each<[string, object, string]>([
      ['thiếu lý do', { han_rieng: TUAN_SAU }, 'ly_do'],
      [
        'lý do toàn khoảng trắng',
        { han_rieng: TUAN_SAU, ly_do: '   ' },
        'ly_do',
      ],
      [
        'lý do quá 500 ký tự',
        { han_rieng: TUAN_SAU, ly_do: 'x'.repeat(501) },
        'ly_do',
      ],
      ['ngày đã qua', { han_rieng: HOM_QUA, ly_do: 'Bịa' }, 'han_rieng'],
      [
        'ngày không có thật',
        { han_rieng: '2026-02-30', ly_do: 'Bịa' },
        'han_rieng',
      ],
      [
        'kèm giờ',
        { han_rieng: `${TUAN_SAU}T10:00:00Z`, ly_do: 'Bịa' },
        'han_rieng',
      ],
      ['vắng han_rieng', { ly_do: 'Bịa' }, 'han_rieng'],
    ])(
      '%s → 400 VALIDATION_ERROR field %s, không ghi',
      async (_t, body, field) => {
        const res = await putHanRieng(ids.tA, body);
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
        expect(fieldsCua(res)).toContain(field);
        expect((await hopDong(ids.tA)).han_rieng).toBeNull();
      },
    );

    it('ngày đã qua: thông điệp "Hạn riêng phải từ hôm nay trở đi"', async () => {
      const res = await putHanRieng(ids.tA, {
        han_rieng: HOM_QUA,
        ly_do: 'Bịa',
      });
      expect(res.body.error.fields).toEqual([
        { field: 'han_rieng', message: 'Hạn riêng phải từ hôm nay trở đi' },
      ]);
    });

    it('trường không có hợp đồng trong đợt → 404', async () => {
      const res = await putHanRieng(ids.so, {
        han_rieng: TUAN_SAU,
        ly_do: 'Bịa',
      });
      expect(res.status).toBe(404);
    });

    it('hạn riêng hôm nay được nhận (≥ hôm nay)', async () => {
      const res = await putHanRieng(ids.tB, {
        han_rieng: HOM_NAY,
        ly_do: 'Bịa',
      });
      expect(res.status).toBe(200);
      expect(res.body.han_hieu_luc_ngay).toBe(HOM_NAY);
      await putHanRieng(ids.tB, { han_rieng: null, ly_do: 'Bỏ' }).expect(200);
    });

    it('A gia hạn riêng tuần sau → A thao tác được, B cùng đợt vẫn bị chặn', async () => {
      const res = await putHanRieng(ids.tA, {
        han_rieng: TUAN_SAU,
        ly_do: '  Trường xin thêm thời gian bịa  ',
      });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        han_rieng: hanNopTuNgay(TUAN_SAU).toISOString(),
        han_hieu_luc: hanNopTuNgay(TUAN_SAU).toISOString(),
        han_hieu_luc_ngay: TUAN_SAU,
        da_het_han: false,
      });
      expect((await hopDong(ids.tA)).han_rieng).toEqual(hanNopTuNgay(TUAN_SAU));
      expect((await thaoTac.yKien('truongA', dongId.Bình)).status).toBe(200);
      expect((await thaoTac.luuHopDong('truongA')).status).toBe(200);
      expect(await getThe('truongA')).toMatchObject({
        han_rieng: hanNopTuNgay(TUAN_SAU).toISOString(),
        han_hieu_luc_ngay: TUAN_SAU,
        da_het_han: false,
      });
      expectHetHan(await thaoTac.yKien('truongB', dongId.Em));
      expect(await getThe('truongB')).toMatchObject({ da_het_han: true });
    });

    it('Quản trị xem hợp đồng A thấy hạn riêng + hạn hiệu lực', async () => {
      const res = await http()
        .get(urlQt(`hop-dong/${ids.tA}`))
        .set(auth(token.quanTri))
        .expect(200);
      expect(res.body).toMatchObject({
        han_rieng: hanNopTuNgay(TUAN_SAU).toISOString(),
        han_hieu_luc_ngay: TUAN_SAU,
        da_het_han: false,
      });
    });

    it('null bỏ hạn riêng → A về hạn đợt (đã qua) và bị chặn lại', async () => {
      const res = await putHanRieng(ids.tA, {
        han_rieng: null,
        ly_do: 'Hết gia hạn',
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        han_rieng: null,
        han_hieu_luc_ngay: HOM_QUA,
        da_het_han: true,
      });
      expect((await hopDong(ids.tA)).han_rieng).toBeNull();
      expectHetHan(await thaoTac.dongYTatCa('truongA'));
    });

    it('nhật ký gia_han_rieng_hop_dong: trước/sau/lý do (đã trim)', async () => {
      const nk = await prisma.nhat_ky_hoat_dong.findMany({
        where: {
          hanh_dong: 'gia_han_rieng_hop_dong',
          chi_tiet: { path: ['don_vi_id'], equals: ids.tA },
        },
        orderBy: { thoi_gian: 'asc' },
      });
      const h = await hopDong(ids.tA);
      expect(nk.map((n) => n.chi_tiet)).toEqual([
        {
          dot_trien_khai_id: dotId,
          don_vi_id: ids.tA,
          hop_dong_id: h.id,
          truoc: null,
          sau: hanNopTuNgay(TUAN_SAU).toISOString(),
          ly_do: 'Trường xin thêm thời gian bịa',
        },
        {
          dot_trien_khai_id: dotId,
          don_vi_id: ids.tA,
          hop_dong_id: h.id,
          truoc: hanNopTuNgay(TUAN_SAU).toISOString(),
          sau: null,
          ly_do: 'Hết gia hạn',
        },
      ]);
      expect(nk.every((n) => n.vai_tro === 'quan_tri')).toBe(true);
    });

    it('gia hạn riêng trường đã nộp vẫn được (vô hại)', async () => {
      const res = await putHanRieng(ids.tC, {
        han_rieng: TUAN_SAU,
        ly_do: 'Bịa',
      });
      expect(res.status).toBe(200);
      await putHanRieng(ids.tC, { han_rieng: null, ly_do: 'Bỏ' }).expect(200);
    });
  });

  describe('Tiến độ đợt — Quá hạn', () => {
    type DongTd = {
      don_vi: { id: string };
      han_rieng: string | null;
      han_hieu_luc_ngay: string;
      qua_han: boolean;
    };

    beforeAll(async () => {
      // A có hạn riêng tuần sau; B hết hạn chưa nộp; C hết hạn nhưng đã nộp.
      await putHanRieng(ids.tA, { han_rieng: TUAN_SAU, ly_do: 'Bịa' }).expect(
        200,
      );
    });

    it('dòng có hạn riêng / hạn hiệu lực / quá hạn; tong_hop.so_qua_han', async () => {
      const res = await http()
        .get(urlQt('tien-do'))
        .set(auth(token.quanTri))
        .expect(200);
      const theo = (id: string) =>
        (res.body.dong as DongTd[]).find((d) => d.don_vi.id === id);
      expect(theo(ids.tA)).toMatchObject({
        han_rieng: hanNopTuNgay(TUAN_SAU).toISOString(),
        han_hieu_luc_ngay: TUAN_SAU,
        qua_han: false,
      });
      expect(theo(ids.tB)).toMatchObject({
        han_rieng: null,
        han_hieu_luc_ngay: HOM_QUA,
        qua_han: true,
      });
      expect(theo(ids.tC)).toMatchObject({ qua_han: false });
      expect(res.body.tong_hop.so_qua_han).toBe(1);
    });

    it('loc=qua_han → chỉ B (hết hạn chưa nộp; C đã nộp bị loại)', async () => {
      const res = await http()
        .get(urlQt('tien-do'))
        .query({ loc: 'qua_han' })
        .set(auth(token.quanTri))
        .expect(200);
      expect((res.body.dong as DongTd[]).map((d) => d.don_vi.id)).toEqual([
        ids.tB,
      ]);
      expect(res.body.tong_hop.so_truong).toBe(3);
    });

    it('Excel có cột "Hạn hiệu lực" (ngày) + "Hạn riêng" sau "Trạng thái hợp đồng"', async () => {
      const res = await http()
        .get(urlQt('tien-do/xuat-excel'))
        .query({ loc: 'tat_ca' })
        .set(auth(token.quanTri))
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        });
      expect(res.status).toBe(200);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(res.body as unknown as ExcelJS.Buffer);
      const sh = wb.worksheets[0];
      const rows: unknown[][] = [];
      sh.eachRow((r) => rows.push((r.values as unknown[]).slice(1)));
      expect(rows[0].slice(9, 13)).toEqual([
        'Trạng thái hợp đồng',
        'Hạn hiệu lực',
        'Hạn riêng',
        'Thao tác gần nhất',
      ]);
      const a = rows.find((r) => String(r[2]).startsWith('Trường A Hạn'));
      const b = rows.find((r) => String(r[2]).startsWith('Trường B Hạn'));
      expect(a[10]).toEqual(new Date(`${TUAN_SAU}T00:00:00Z`));
      expect(a[11]).toBe('Có');
      expect(b[10]).toEqual(new Date(`${HOM_QUA}T00:00:00Z`));
      expect(b[11]).toBeUndefined();
      expect(sh.getRow(2).getCell(11).numFmt).toBe('dd/mm/yyyy');
    });

    it('loc không hợp lệ → 400', async () => {
      await http()
        .get(urlQt('tien-do'))
        .query({ loc: 'qua-han' })
        .set(auth(token.quanTri))
        .expect(400);
    });
  });

  describe('Quản trị mở lại hợp đồng sau hạn', () => {
    it('C đã nộp, đợt hết hạn → Mở lại 200; C chưa nộp + hết hạn → thành Quá hạn, trường C bị chặn 403', async () => {
      await http()
        .post(urlQt(`hop-dong/${ids.tC}/mo-lai`))
        .set(auth(token.quanTri))
        .send({ ly_do: 'Mở lại bịa' })
        .expect(200);
      expectHetHan(await thaoTac.dongYTatCa('truongC'));
      const res = await http()
        .get(urlQt('tien-do'))
        .query({ loc: 'qua_han' })
        .set(auth(token.quanTri))
        .expect(200);
      expect(
        (res.body.dong as { don_vi: { id: string } }[])
          .map((d) => d.don_vi.id)
          .sort(),
      ).toEqual([ids.tB, ids.tC].sort());
    });
  });
});
