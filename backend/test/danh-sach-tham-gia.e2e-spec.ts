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

// Issue #58 / ADR 0015 M3, M6, S1, S3, T7: nạp Excel danh sách HSG theo đợt.
// Mọi họ tên / mã / tên trường đều BỊA, kèm hậu tố ngẫu nhiên — không có PII thật.
describe('Danh sách tham gia HSG - Cổng đơn vị (e2e)', () => {
  let app: INestApplication;
  let fixture: Awaited<ReturnType<typeof taoDonViTest>>;
  let quanTri: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let truongUser: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let soUser: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let tokenQuanTri: string;
  let tokenTruong: string;
  let tokenSo: string;

  const suf = uniqueSuffix();
  const MA_T1 = `TR-TEST-001-${suf}`;
  const TEN_T2 = `Trường THCS&THPT Thử Nghiệm ${suf}`;
  const TEN_NGOAI = `Trường THCS Ngoài Phạm Vi ${suf}`;
  // Thứ tự tạo = thứ tự xóa ngược (con trước cha).
  const donViIds: string[] = [];
  const dotIds: string[] = [];
  const ids = {} as Record<
    'soA' | 'soB' | 't1' | 't2' | 't3' | 'phong' | 'tNgung' | 'tB1' | 'tB2',
    string
  >;
  let dotHsg: string;
  let dotNls: string;

  const http = () => request(app.getHttpServer());
  const qt = (r: request.Test) =>
    r.set('Authorization', `Bearer ${tokenQuanTri}`);
  const url = (dot: string, duoi: string) =>
    `/cong-don-vi/dot-trien-khai/${dot}/${duoi}`;

  async function dangNhap(ten_dang_nhap: string) {
    const res = await http()
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap, mat_khau: 'MatKhau123' })
      .expect(200);
    return res.body.token as string;
  }

  async function taoDonVi(
    ten: string,
    loai: 'so_gddt' | 'phong_vhxh' | 'truong',
    cha: string | null,
    over: { ma?: string; trang_thai?: 'active' | 'ngung' } = {},
  ) {
    const dv = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: over.ma ?? `DSTG-${uniqueSuffix()}`,
        ten_don_vi: ten,
        loai_don_vi: loai,
        dia_ban_id: fixture.diaDanhXa.id,
        don_vi_cha_id: cha,
        trang_thai: over.trang_thai ?? 'active',
      },
    });
    donViIds.push(dv.id);
    return dv.id;
  }

  async function taoDot(chuong_trinh: 'hsg' | 'nls', so: string) {
    const dot = await prisma.dot_trien_khai.create({
      data: {
        chuong_trinh,
        ten: `Đợt e2e ${chuong_trinh} ${suf}`,
        han_nop: new Date('2026-12-31T16:59:59Z'),
        so_gddt_id: so,
      },
    });
    dotIds.push(dot.id);
    return dot.id;
  }

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
  ];

  async function taoExcel(dong: unknown[][]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('DS');
    sh.addRow([`DANH SÁCH THỬ ${suf}`]);
    sh.addRow(TIEU_DE);
    dong.forEach((d) => sh.addRow(d));
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  const xemTruoc = (dot: string, buf: Buffer, ten = 'ds.xlsx') =>
    qt(http().post(url(dot, 'danh-sach/xem-truoc'))).attach('file', buf, ten);
  const nap = (dot: string, dong: unknown[]) =>
    qt(http().post(url(dot, 'danh-sach/nap'))).send({ dong });
  const demDong = (dot: string) =>
    prisma.danh_sach_tham_gia.count({ where: { dot_trien_khai_id: dot } });

  beforeAll(async () => {
    app = await createTestApp();
    fixture = await taoDonViTest('dstg');
    ids.soA = await taoDonVi(`Sở thử A ${suf}`, 'so_gddt', null);
    ids.soB = await taoDonVi(`Sở thử B ${suf}`, 'so_gddt', null);
    ids.phong = await taoDonVi(`Phòng thử ${suf}`, 'phong_vhxh', ids.soA);
    ids.t1 = await taoDonVi(`Trường TH Thử Một ${suf}`, 'truong', ids.soA, {
      ma: MA_T1,
    });
    ids.t2 = await taoDonVi(TEN_T2, 'truong', ids.soA);
    // Trường cấp cháu (qua Phòng) vẫn trong phạm vi Sở.
    ids.t3 = await taoDonVi(`Trường MN Thử Ba ${suf}`, 'truong', ids.phong);
    ids.tNgung = await taoDonVi(`Trường Ngưng ${suf}`, 'truong', ids.soA, {
      trang_thai: 'ngung',
    });
    // Sở khác: trùng tên T2 và một trường chỉ có ở Sở B.
    ids.tB1 = await taoDonVi(TEN_T2, 'truong', ids.soB);
    ids.tB2 = await taoDonVi(TEN_NGOAI, 'truong', ids.soB);
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
      await http().get(url(dotHsg, 'danh-sach')).expect(401);
      await http().get(url(dotHsg, 'truong-trong-pham-vi')).expect(401);
      await http().post(url(dotHsg, 'danh-sach/nap')).send({}).expect(401);
      await http()
        .post(url(dotHsg, 'danh-sach/xem-truoc'))
        .attach('file', Buffer.from('x'), 'a.xlsx')
        .expect(401);
    });

    it.each([
      ['truong', () => tokenTruong],
      ['so_gddt', () => tokenSo],
    ])('403 cho vai trò %s', async (_ten, layToken) => {
      const auth = `Bearer ${layToken()}`;
      await http()
        .get(url(dotHsg, 'danh-sach'))
        .set('Authorization', auth)
        .expect(403);
      await http()
        .get(url(dotHsg, 'truong-trong-pham-vi'))
        .set('Authorization', auth)
        .expect(403);
      await http()
        .get(url(dotHsg, 'danh-sach/mau-excel'))
        .set('Authorization', auth)
        .expect(403);
      await http()
        .post(url(dotHsg, 'danh-sach/nap'))
        .set('Authorization', auth)
        .send({ dong: [] })
        .expect(403);
      await http()
        .post(url(dotHsg, 'danh-sach/xem-truoc'))
        .set('Authorization', auth)
        .attach('file', Buffer.from('x'), 'a.xlsx')
        .expect(403);
    });
  });

  it('trường trong phạm vi: chỉ trường đang hoạt động thuộc cây Sở của đợt', async () => {
    const res = await qt(http().get(url(dotHsg, 'truong-trong-pham-vi')));
    expect(res.status).toBe(200);
    const thay = (res.body as { id: string }[]).map((t) => t.id).sort();
    expect(thay).toEqual([ids.t1, ids.t2, ids.t3].sort());
    expect(res.body.find((t: { id: string }) => t.id === ids.t1)).toEqual({
      id: ids.t1,
      ma_don_vi: MA_T1,
      ten_don_vi: `Trường TH Thử Một ${suf}`,
    });
  });

  it('tải file mẫu .xlsx', async () => {
    const res = await qt(http().get(url(dotHsg, 'danh-sach/mau-excel')));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
  });

  describe('Xem trước', () => {
    let ketQua: request.Response;
    let hocVienTruoc: number;

    beforeAll(async () => {
      hocVienTruoc = await prisma.hoc_vien.count();
      const buf = await taoExcel([
        // khớp mã thắng tên khác
        [
          'GV Bịa Một',
          '01/02/1990',
          'Nam',
          'M-1',
          'Lớp A',
          MA_T1.toLowerCase(),
          'Tên bất kỳ',
          '',
          '',
        ],
        // biến thể tên ('và' ≡ '&', không có "Trường"), chỉ GĐ2 → 0,5
        [
          'GV Bịa Hai',
          '',
          'Nữ',
          '',
          '',
          '',
          `THCS và THPT Thử Nghiệm ${suf}`,
          'Chỉ GĐ2',
          '',
        ],
        // tên chỉ có ở Sở khác → không khớp
        ['GV Bịa Ba', '', '', '', '', '', TEN_NGOAI, 'Cả 2', ''],
        // không có trường
        ['GV Bịa Bốn', '', '', '', '', '', '', 'Chỉ GĐ1', ''],
        // giai đoạn lạ
        ['GV Bịa Năm', '', '', '', '', MA_T1, '', 'Chỉ GĐ5', ''],
        // thiếu họ tên + ngày sai
        ['', '31/02/1990', '', '', '', MA_T1, '', '', ''],
      ]);
      ketQua = await xemTruoc(dotHsg, buf);
    });

    it('200, trả từng dòng kèm trạng thái khớp, số dòng Excel thật', () => {
      expect(ketQua.status).toBe(200);
      const d = ketQua.body.dong;
      expect(d.map((x: { so_dong: number }) => x.so_dong)).toEqual([
        3, 4, 5, 6, 7, 8,
      ]);
      expect(d[0]).toMatchObject({
        ho_ten: 'GV Bịa Một',
        ngay_sinh: '1990-02-01',
        trang_thai_khop: 'khop_ma',
        don_vi_id: ids.t1,
        ten_don_vi_khop: `Trường TH Thử Một ${suf}`,
        giai_doan: 'ca_hai',
        ty_le_suat: 1,
        loi: [],
      });
    });

    it('biến thể tên khớp đúng trường trong phạm vi (không phải trường cùng tên ở Sở khác), "Chỉ GĐ2" → 0,5', () => {
      expect(ketQua.body.dong[1]).toMatchObject({
        trang_thai_khop: 'khop_ten',
        don_vi_id: ids.t2,
        giai_doan: 'chi_gd2',
        ty_le_suat: 0.5,
      });
      const tatCa = ketQua.body.dong.map(
        (x: { don_vi_id: string }) => x.don_vi_id,
      );
      expect(tatCa).not.toContain(ids.tB1);
      expect(tatCa).not.toContain(ids.tB2);
    });

    it('tên chỉ có ở Sở khác → khong_khop; không có trường → thieu_truong', () => {
      expect(ketQua.body.dong[2]).toMatchObject({
        trang_thai_khop: 'khong_khop',
        don_vi_id: null,
      });
      expect(ketQua.body.dong[3]).toMatchObject({
        trang_thai_khop: 'thieu_truong',
        don_vi_id: null,
      });
    });

    it('dòng lỗi: giai đoạn lạ; thiếu họ tên + ngày sai', () => {
      expect(ketQua.body.dong[4].loi.join(' ')).toMatch(/Chỉ GĐ5/);
      expect(ketQua.body.dong[4].ty_le_suat).toBeNull();
      expect(ketQua.body.dong[5].loi).toHaveLength(2);
      expect(ketQua.body.tong_hop).toEqual({
        tong: 6,
        khop_ma: 3,
        khop_ten: 1,
        khong_khop: 1,
        thieu_truong: 1,
        nhieu_ket_qua: 0,
        loi: 2,
      });
    });

    it('xem trước không lưu gì (không danh sách, không hoc_vien)', async () => {
      expect(await demDong(dotHsg)).toBe(0);
      expect(await prisma.hoc_vien.count()).toBe(hocVienTruoc);
    });

    it('file không phải .xlsx → 400; đợt NLS → 400; đợt không tồn tại → 404', async () => {
      const buf = await taoExcel([['A', '', '', '', '', MA_T1, '', '', '']]);
      expect((await xemTruoc(dotHsg, buf, 'ds.csv')).status).toBe(400);
      const nls = await xemTruoc(dotNls, buf);
      expect(nls.status).toBe(400);
      expect(nls.body.error.message).toBe('Đợt NLS lấy danh sách từ khóa');
      expect((await xemTruoc(randomUUID(), buf)).status).toBe(404);
    });
  });

  describe('Nạp + đọc lại', () => {
    const dong = (over: Record<string, unknown>) => ({
      ho_ten: `GV Bịa ${uniqueSuffix()}`,
      giai_doan: 'ca_hai',
      ty_le_suat: 1,
      ...over,
    });

    it('dòng chưa gắn trường → 400 kèm số dòng, không ghi gì', async () => {
      const res = await nap(dotHsg, [
        dong({ so_dong: 3, don_vi_id: ids.t1 }),
        dong({ so_dong: 5 }),
      ]);
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/5/);
      expect(await demDong(dotHsg)).toBe(0);
    });

    it.each([
      ['trường ở Sở khác', () => ids.tB1],
      ['đơn vị không phải trường (Phòng)', () => ids.phong],
      ['trường đã ngưng', () => ids.tNgung],
      ['chính Sở', () => ids.soA],
    ])('don_vi_id là %s → 400, không ghi gì', async (_ten, layId) => {
      const res = await nap(dotHsg, [
        dong({ so_dong: 3, don_vi_id: ids.t1 }),
        dong({ so_dong: 4, don_vi_id: layId() }),
      ]);
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/4/);
      expect(await demDong(dotHsg)).toBe(0);
    });

    it('ty_le_suat không khớp giai đoạn → 400; giai_doan lạ → 400', async () => {
      const lech = await nap(dotHsg, [
        dong({ don_vi_id: ids.t1, giai_doan: 'chi_gd1', ty_le_suat: 1 }),
      ]);
      expect(lech.status).toBe(400);
      const la = await nap(dotHsg, [
        dong({ don_vi_id: ids.t1, giai_doan: 'ca_ba' }),
      ]);
      expect(la.status).toBe(400);
      expect(await demDong(dotHsg)).toBe(0);
    });

    it('đợt NLS → 400', async () => {
      const res = await nap(dotNls, [dong({ don_vi_id: ids.t1 })]);
      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Đợt NLS lấy danh sách từ khóa');
    });

    it('nạp (khớp tự động + chọn tay) → 200, đọc lại danh sách + tổng hợp, không ghi hoc_vien, nhật ký không PII', async () => {
      const hocVienTruoc = await prisma.hoc_vien.count();
      const res = await nap(dotHsg, [
        dong({
          so_dong: 3,
          don_vi_id: ids.t1,
          ho_ten: 'GV Bịa Một',
          ngay_sinh: '1990-02-01',
          gioi_tinh: 'Nam',
          ma_goc: 'M-1',
          lop: 'Lớp A',
          ghi_chu: 'ghi chú bịa',
        }),
        dong({
          so_dong: 4,
          don_vi_id: ids.t2,
          giai_doan: 'chi_gd2',
          ty_le_suat: 0.5,
        }),
        // chọn tay ở xem trước (dòng khong_khop)
        dong({ so_dong: 5, don_vi_id: ids.t3 }),
      ]);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ so_truong: 3, so_dong: 3, tong_suat: 2.5 });
      expect(await prisma.hoc_vien.count()).toBe(hocVienTruoc);

      const ds = await qt(http().get(url(dotHsg, 'danh-sach')));
      expect(ds.status).toBe(200);
      expect(ds.body.dong).toHaveLength(3);
      expect(
        ds.body.dong.find((d: { don_vi_id: string }) => d.don_vi_id === ids.t1),
      ).toMatchObject({
        ho_ten: 'GV Bịa Một',
        ngay_sinh: '1990-02-01',
        gioi_tinh: 'Nam',
        ma_goc: 'M-1',
        lop: 'Lớp A',
        giai_doan: 'ca_hai',
        ty_le_suat: 1,
        ghi_chu: 'ghi chú bịa',
        y_kien_truong: null,
        hoc_vien_id: null,
      });
      const tongHop = Object.fromEntries(
        ds.body.tong_hop.map(
          (t: { don_vi_id: string; so_nguoi: number; tong_suat: number }) => [
            t.don_vi_id,
            [t.so_nguoi, t.tong_suat],
          ],
        ),
      );
      expect(tongHop).toEqual({
        [ids.t1]: [1, 1],
        [ids.t2]: [1, 0.5],
        [ids.t3]: [1, 1],
      });
      expect(
        ds.body.tong_hop.find(
          (t: { don_vi_id: string }) => t.don_vi_id === ids.t1,
        ),
      ).toMatchObject({
        ma_don_vi: MA_T1,
        ten_don_vi: `Trường TH Thử Một ${suf}`,
      });

      const loc = await qt(
        http().get(url(dotHsg, 'danh-sach')).query({ don_vi_id: ids.t2 }),
      );
      expect(loc.body.dong).toHaveLength(1);
      expect(loc.body.dong[0]).toMatchObject({
        giai_doan: 'chi_gd2',
        ty_le_suat: 0.5,
      });
      expect(loc.body.tong_hop).toHaveLength(3);

      const nk = await prisma.nhat_ky_hoat_dong.findFirst({
        where: {
          hanh_dong: 'nap_danh_sach_tham_gia',
          nguoi_dung_id: quanTri.nguoiDung.id,
        },
        orderBy: { thoi_gian: 'desc' },
      });
      expect(nk?.chi_tiet).toEqual({
        dot_trien_khai_id: dotHsg,
        so_truong: 3,
        so_dong: 3,
        tong_suat: 2.5,
        don_vi_ids: expect.arrayContaining([ids.t1, ids.t2, ids.t3]),
      });
      expect(JSON.stringify(nk)).not.toMatch(/GV Bịa|1990-02-01/);
    });

    it('nạp lại 1 trường chỉ thay danh sách trường đó (không nhân đôi), trường khác giữ nguyên', async () => {
      const t2Truoc = await prisma.danh_sach_tham_gia.findMany({
        where: {
          dot_trien_khai_id: dotHsg,
          don_vi_id: { in: [ids.t2, ids.t3] },
        },
        select: { id: true },
      });
      const res = await nap(dotHsg, [
        dong({ don_vi_id: ids.t1, ho_ten: 'GV Bịa Thay 1' }),
        dong({
          don_vi_id: ids.t1,
          ho_ten: 'GV Bịa Thay 2',
          giai_doan: 'chi_gd1',
          ty_le_suat: 0.5,
        }),
      ]);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ so_truong: 1, so_dong: 2, tong_suat: 1.5 });

      const t1 = await prisma.danh_sach_tham_gia.findMany({
        where: { dot_trien_khai_id: dotHsg, don_vi_id: ids.t1 },
        orderBy: { ho_ten: 'asc' },
      });
      expect(t1.map((d) => d.ho_ten)).toEqual([
        'GV Bịa Thay 1',
        'GV Bịa Thay 2',
      ]);
      const conLai = await prisma.danh_sach_tham_gia.findMany({
        where: {
          dot_trien_khai_id: dotHsg,
          don_vi_id: { in: [ids.t2, ids.t3] },
        },
        select: { id: true },
      });
      expect(conLai.map((d) => d.id).sort()).toEqual(
        t2Truoc.map((d) => d.id).sort(),
      );
      expect(await demDong(dotHsg)).toBe(4);
    });

    it('nạp 2.000 dòng (JSON > 100kb mặc định) → 200', async () => {
      const dotLon = await taoDot('hsg', ids.soA);
      const nhieu = Array.from({ length: 2000 }, (_, i) =>
        dong({
          so_dong: i + 3,
          don_vi_id: ids.t3,
          ngay_sinh: '1991-01-01',
          lop: 'Lớp bịa',
          ghi_chu: 'ghi chú bịa',
        }),
      );
      expect(JSON.stringify({ dong: nhieu }).length).toBeGreaterThan(100_000);
      const res = await nap(dotLon, nhieu);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        so_truong: 1,
        so_dong: 2000,
        tong_suat: 2000,
      });
      expect(await demDong(dotLon)).toBe(2000);
    });
  });
});
