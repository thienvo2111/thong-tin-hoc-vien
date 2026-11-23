import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as ExcelJS from 'exceljs';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoDonViTest,
  taoNguoiDungTest,
  uniqueSuffix,
  xoaDonViTest,
  xoaNguoiDungTest,
} from './utils/test-data';
import { COT_HOP_DONG_KHTC } from '../src/cong-don-vi/xuat-khtc';

// Issue #67 / ADR 0015 O1, O2, O4: Excel 3 sheet cho Phòng KHTC (chỉ hợp đồng đã nộp, từ bản chụp hồ sơ),
// danh sách hợp đồng của Quản trị (STK cá nhân đã che), nhật ký mỗi lần xuất. A, B nộp qua luồng THẬT
// (PUT hồ sơ → PUT hợp đồng → POST nộp); C chưa nộp; đợt 2 có 1 hợp đồng đã nộp không được lẫn vào.
// Mọi tên, MST, STK, SĐT, số QĐ đều BỊA — không có thông tin thật.
describe('Xuất Excel KHTC + danh sách hợp đồng - Cổng đơn vị (e2e)', () => {
  let app: INestApplication;
  let fixture: Awaited<ReturnType<typeof taoDonViTest>>;
  type NguoiDungTest = Awaited<ReturnType<typeof taoNguoiDungTest>>;
  const nguoiDung: NguoiDungTest[] = [];
  type VaiTro = 'quanTri' | 'truongA' | 'truongB' | 'so';
  const token = {} as Record<VaiTro, string>;
  const userId = {} as Record<VaiTro, string>;

  const suf = uniqueSuffix();
  const MAT_KHAU = 'MatKhau123';
  const DON_GIA = 1_200_000;
  const donViIds: string[] = [];
  const dotIds: string[] = [];
  type Truong = 'A' | 'B' | 'C' | 'D';
  const tr = {} as Record<Truong, string>;
  const ten = {} as Record<Truong, string>;
  const ma = {} as Record<Truong, string>;
  let soId = '';
  let dot1 = '';
  let dot2 = '';
  let dotRong = '';

  const hoSo = (chu: string, qhns: string) => ({
    ten_truong: `Trường ${chu} Bịa Theo Hồ Sơ`,
    dia_chi: `Ấp Bịa ${chu}, xã Thử, tỉnh Giả`,
    ma_so_thue: '0123456789',
    nguoi_dai_dien: `Đại Diện ${chu} Bịa`,
    sdt_dai_dien: '0900000101',
    email_hoa_don: `hoadon-${chu.toLowerCase()}-${suf}@mau.test`,
    so_tai_khoan: '0011223344',
    ngan_hang: 'Ngân hàng Giả',
    chi_nhanh: 'Chi nhánh Giả',
    kho_bac: 'Kho bạc Giả',
    mst_kho_bac: '0123456789-001',
    ma_qhns: qhns,
    ma_nguon: '013',
    ht_ho_ten: `Hiệu Trưởng ${chu} Bịa`,
    ht_ngan_hang: `Ngân hàng Giả – CN ${chu}`,
    kt_ho_ten: `Kế Toán ${chu} Bịa`,
    kt_sdt: '0900000102',
    kt_ngan_hang: `Ngân hàng Giả – CN ${chu} KT`,
  });
  const STK = {
    A_HT: '0099887766551111',
    A_KT: '0055443322112222',
    B_HT: '0099887766553333',
    B_KT: '0055443322114444',
    C_HT: '0099887766555555',
    C_KT: '0055443322116666',
    A_HT_SAU_NOP: '0099887766557777',
  };
  const HO_SO_A = {
    ...hoSo('A', '0123456'),
    ht_so_tai_khoan: STK.A_HT,
    kt_so_tai_khoan: STK.A_KT,
    dau_moi_csvc: 'Đầu Mối A Bịa 0900000103',
    muc_dap_ung_csvc: 'Phòng máy Bịa',
    luu_tru: 'Nhà khách Bịa 0900000104',
    di_chuyen: 'Xe khách Bịa 0900000105',
  };
  const HO_SO_B = {
    ...hoSo('B', '7654321'),
    ht_so_tai_khoan: STK.B_HT,
    kt_so_tai_khoan: STK.B_KT,
  };
  const HO_SO_C = {
    ...hoSo('C', '1111111'),
    ht_so_tai_khoan: STK.C_HT,
    kt_so_tai_khoan: STK.C_KT,
  };
  const PHAN_3 = (chu: string) => ({
    nguoi_nhan: `Người Nhận ${chu} Bịa`,
    sdt_nguoi_nhan: '0900000109',
    dia_chi_nhan: `Số 1, đường Bịa ${chu}, xã Thử, tỉnh Giả`,
    ghi_chu: null,
  });

  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const urlDsHd = (dotId: string) =>
    `/cong-don-vi/dot-trien-khai/${dotId}/hop-dong`;
  const urlXuat = (dotId: string) => `${urlDsHd(dotId)}/xuat-khtc`;
  const urlHdTruong = (dotId: string) =>
    `/cong-don-vi/truong/dot/${dotId}/hop-dong`;
  const taiExcel = (dotId: string, vaiTro: VaiTro = 'quanTri') =>
    http()
      .get(urlXuat(dotId))
      .set(auth(token[vaiTro]))
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });

  async function docFile(buf: Buffer) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    const dongCua = (ten: string) => {
      const sh = wb.getWorksheet(ten) as ExcelJS.Worksheet;
      const dong: unknown[][] = [];
      sh.eachRow((r) => dong.push((r.values as unknown[]).slice(1)));
      return dong;
    };
    return { wb, dongCua };
  }

  const nhatKyXuat = (dotId: string) =>
    prisma.nhat_ky_hoat_dong.findMany({
      where: {
        hanh_dong: 'xuat_khtc_hop_dong',
        chi_tiet: { path: ['dot_trien_khai_id'], equals: dotId },
      },
      orderBy: { thoi_gian: 'desc' },
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
    userId[vaiTro] = u.nguoiDung.id;
    token[vaiTro] = await dangNhap(u.ten_dang_nhap);
  }

  async function taoDonVi(
    tenDv: string,
    loai: 'so_gddt' | 'truong',
    cha: string | null,
    maDv = `XKT-${uniqueSuffix()}`,
  ) {
    const dv = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: maDv,
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
        ngay_qd_tu: new Date('2026-11-01T00:00:00Z'),
        ngay_qd_den: new Date('2026-11-30T00:00:00Z'),
        han_nop: new Date('2026-12-31T16:59:59Z'),
        so_gddt_id: soId,
      },
    });
    dotIds.push(d.id);
    return d.id;
  }

  async function taoDong(
    dotId: string,
    donViId: string,
    ds: [string, 'ca_hai' | 'chi_gd1' | 'chi_gd2'][],
  ) {
    for (const [hoTen, giai_doan] of ds) {
      await prisma.danh_sach_tham_gia.create({
        data: {
          dot_trien_khai_id: dotId,
          don_vi_id: donViId,
          ho_ten: `${hoTen} ${suf}`,
          ngay_sinh: new Date('1990-01-31T00:00:00Z'),
          lop: 'Toán 9',
          giai_doan,
          ty_le_suat: giai_doan === 'ca_hai' ? 1 : 0.5,
        },
      });
    }
  }

  async function nopThat(vaiTro: 'truongA' | 'truongB', body: object) {
    await http()
      .put(urlHdTruong(dot1))
      .set(auth(token[vaiTro]))
      .send(body)
      .expect(200);
    const res = await http()
      .post(`${urlHdTruong(dot1)}/nop`)
      .set(auth(token[vaiTro]));
    expect(res.status).toBe(200);
    expect(res.body.trang_thai_hop_dong).toBe('da_nop');
  }

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    fixture = await taoDonViTest('xkhtc');
    soId = (await taoDonVi(`Sở thử KHTC ${suf}`, 'so_gddt', null)).id;
    for (const t of ['A', 'B', 'C', 'D'] as Truong[]) {
      ten[t] = `Trường ${t} KHTC Bịa ${suf}`;
      // Mã trường có số 0 đầu — phải giữ nguyên trong ô Text.
      ma[t] = `0${t}${uniqueSuffix()}`;
      tr[t] = (await taoDonVi(ten[t], 'truong', soId, ma[t])).id;
    }
    await taoTaiKhoan('quanTri', 'quan_tri', fixture.donVi.id);
    await taoTaiKhoan('truongA', 'truong', tr.A);
    await taoTaiKhoan('truongB', 'truong', tr.B);
    await taoTaiKhoan('so', 'so_gddt', soId);

    dot1 = await taoDot('HSG KHTC – Đợt 1');
    dot2 = await taoDot('HSG KHTC đợt khác');
    dotRong = await taoDot('HSG KHTC chưa ai nộp');

    // A: 1 + 0,5 + 0,5 = 2 suất; B: 1 + 1 = 2 suất; C: 1 suất (chưa nộp).
    await taoDong(dot1, tr.A, [
      ['Võ Bịa', 'ca_hai'],
      ['Bùi Bịa', 'chi_gd1'],
      ['Lê Bịa', 'chi_gd2'],
    ]);
    await taoDong(dot1, tr.B, [
      ['Nguyễn Bịa', 'ca_hai'],
      ['Đặng Bịa', 'ca_hai'],
    ]);
    await taoDong(dot1, tr.C, [['Trần Bịa', 'ca_hai']]);
    for (const t of ['A', 'B'] as Truong[]) {
      await prisma.hop_dong_boi_duong.create({
        data: {
          dot_trien_khai_id: dot1,
          don_vi_id: tr[t],
          trang_thai_danh_sach: 'da_xac_nhan',
        },
      });
    }
    await prisma.hop_dong_boi_duong.create({
      data: { dot_trien_khai_id: dot1, don_vi_id: tr.C },
    });
    await prisma.ho_so_don_vi.create({ data: { don_vi_id: tr.C, ...HO_SO_C } });

    // Luồng thật: trường khai hồ sơ, Phần 3 (+ Phần 4 tùy chọn, điểm học trực tiếp), Nộp.
    for (const [vaiTro, body] of [
      ['truongA', HO_SO_A],
      ['truongB', HO_SO_B],
    ] as const) {
      await http()
        .put('/cong-don-vi/ho-so-don-vi')
        .set(auth(token[vaiTro]))
        .send(body)
        .expect(200);
    }
    await nopThat('truongA', {
      ...PHAN_3('A'),
      so_qd: '01/QĐ-BIA',
      ngay_qd: '2026-11-05',
      diem_hoc_truc_tiep: true,
    });
    await nopThat('truongB', { ...PHAN_3('B'), diem_hoc_truc_tiep: false });

    // Sau khi nộp, A sửa hồ sơ hiện tại → file vẫn phải theo bản chụp lúc nộp.
    await prisma.ho_so_don_vi.update({
      where: { don_vi_id: tr.A },
      data: {
        ma_so_thue: '0999999999',
        ht_ho_ten: 'Hiệu Trưởng Đổi Sau Nộp',
        ht_so_tai_khoan: STK.A_HT_SAU_NOP,
      },
    });

    // Đợt 2: D đã nộp (dựng thẳng) — không được lẫn vào file của đợt 1.
    await taoDong(dot2, tr.D, [['Phạm Bịa Đợt Hai', 'ca_hai']]);
    await prisma.hop_dong_boi_duong.create({
      data: {
        dot_trien_khai_id: dot2,
        don_vi_id: tr.D,
        trang_thai_danh_sach: 'da_xac_nhan',
        trang_thai_hop_dong: 'da_nop',
        nop_luc: new Date('2026-11-20T03:00:00Z'),
        nop_boi: userId.quanTri,
        ban_chup_ho_so: { ...HO_SO_C, ten_truong: 'Bản chụp D Bịa' },
        so_nguoi_luc_nop: 1,
        tong_suat_luc_nop: 1,
        don_gia_luc_nop: DON_GIA,
        gia_tri_luc_nop: BigInt(DON_GIA),
      },
    });
  });

  afterAll(async () => {
    // Chỉ xóa đúng các dòng file này tạo (mảng rỗng thì bỏ qua). nhat_ky_hoat_dong chỉ cho thêm — để nguyên.
    if (dotIds.length > 0) {
      await prisma.danh_sach_tham_gia.deleteMany({
        where: { dot_trien_khai_id: { in: dotIds } },
      });
      await prisma.hop_dong_boi_duong.deleteMany({
        where: { dot_trien_khai_id: { in: dotIds } },
      });
      await prisma.dot_trien_khai.deleteMany({ where: { id: { in: dotIds } } });
    }
    for (const id of [tr.A, tr.B, tr.C]) {
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
    it('401 khi không có token (danh sách + xuất)', async () => {
      await http().get(urlDsHd(dot1)).expect(401);
      await http().get(urlXuat(dot1)).expect(401);
    });

    it.each<VaiTro>(['truongA', 'so'])(
      '%s → 403 trên danh sách và xuất, không ghi nhật ký',
      async (vaiTro) => {
        const truoc = (await nhatKyXuat(dot1)).length;
        const r1 = await http().get(urlDsHd(dot1)).set(auth(token[vaiTro]));
        expect(r1.status).toBe(403);
        const r2 = await taiExcel(dot1, vaiTro);
        expect(r2.status).toBe(403);
        expect(await nhatKyXuat(dot1)).toHaveLength(truoc);
      },
    );

    it('404 với đợt không tồn tại (danh sách + xuất)', async () => {
      const khong = '00000000-0000-4000-8000-000000000067';
      const r1 = await http().get(urlDsHd(khong)).set(auth(token.quanTri));
      expect(r1.status).toBe(404);
      const r2 = await taiExcel(khong);
      expect(r2.status).toBe(404);
      expect(await nhatKyXuat(khong)).toHaveLength(0);
    });
  });

  describe('GET xuat-khtc — file Excel 3 sheet', () => {
    let res: request.Response;
    let doc: Awaited<ReturnType<typeof docFile>>;

    beforeAll(async () => {
      res = await taiExcel(dot1);
      doc = await docFile(res.body as Buffer);
    });

    it('200, xlsx, no-store, tên file khtc-<slug>-<YYYYMMDD>.xlsx', () => {
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['content-disposition']).toMatch(
        /^attachment; filename="khtc-hsg-khtc-dot-1-[a-z0-9-]+-\d{8}\.xlsx"$/,
      );
    });

    it('đúng 3 sheet, đúng tên và thứ tự', () => {
      expect(doc.wb.worksheets.map((s) => s.name)).toEqual([
        'Hợp đồng',
        'Danh sách GV',
        'Chi hỗ trợ',
      ]);
    });

    it('"Hợp đồng": tiêu đề = COT_HOP_DONG_KHTC; 2 dòng (A, B đã nộp) theo tên trường; C và đợt khác không có', () => {
      const dong = doc.dongCua('Hợp đồng');
      expect(dong[0]).toEqual(COT_HOP_DONG_KHTC.map((c) => c.nhan));
      expect(dong).toHaveLength(3);
      const cotMa = COT_HOP_DONG_KHTC.findIndex((c) => c.key === 'ma_truong');
      expect(dong.slice(1).map((d) => d[cotMa])).toEqual([ma.A, ma.B]);
      const text = JSON.stringify(dong);
      expect(text).not.toContain(ma.C);
      expect(text).not.toContain('Bản chụp D Bịa');
    });

    it('"Hợp đồng": giá trị từ bản chụp lúc nộp (không theo hồ sơ đã sửa), MST giữ số 0 đầu dạng chữ, STK HCMUE+QHNS, giá trị', () => {
      const ws = doc.wb.getWorksheet('Hợp đồng') as ExcelJS.Worksheet;
      const o = (dong: number, key: string) =>
        ws
          .getRow(dong)
          .getCell(COT_HOP_DONG_KHTC.findIndex((c) => c.key === key) + 1).value;
      // A (dòng 2)
      expect(o(2, 'ten_truong')).toBe('Trường A Bịa Theo Hồ Sơ');
      expect(o(2, 'ma_so_thue')).toBe('0123456789');
      expect(o(2, 'ma_qhns')).toBe('0123456');
      expect(o(2, 'ht_ho_ten')).toBe('Hiệu Trưởng A Bịa');
      expect(o(2, 'ht_so_tai_khoan')).toBe(STK.A_HT);
      expect(o(2, 'stk_chuyen_khoan')).toBe('HCMUE0123456');
      expect(o(2, 'nguoi_nhan')).toBe('Người Nhận A Bịa');
      expect(o(2, 'so_qd')).toBe('01/QĐ-BIA');
      expect(o(2, 'ngay_qd')).toEqual(new Date('2026-11-05T00:00:00Z'));
      expect(o(2, 'diem_hoc_truc_tiep')).toBe('Có');
      expect(o(2, 'luu_tru')).toBe('Nhà khách Bịa 0900000104');
      expect(o(2, 'so_nguoi')).toBe(3);
      expect(o(2, 'tong_suat')).toBe(2);
      expect(o(2, 'don_gia')).toBe(DON_GIA);
      expect(o(2, 'gia_tri')).toBe(2_400_000);
      expect(o(2, 'trang_thai')).toBe('Đã nộp');
      expect(o(2, 'dau_thoi_gian')).toBeInstanceOf(Date);
      expect(o(2, 'ngay_nop')).toBeInstanceOf(Date);
      // B (dòng 3)
      expect(o(3, 'stk_chuyen_khoan')).toBe('HCMUE7654321');
      expect(o(3, 'diem_hoc_truc_tiep')).toBe('Không');
      expect(o(3, 'so_qd')).toBeNull();
      expect(o(3, 'gia_tri')).toBe(2_400_000);
      // Không lẫn giá trị hồ sơ đã sửa sau khi nộp.
      const text = JSON.stringify(doc.dongCua('Hợp đồng'));
      expect(text).not.toContain('0999999999');
      expect(text).not.toContain(STK.A_HT_SAU_NOP);
      expect(text).not.toContain('Đổi Sau Nộp');
      // Ô mã là Text (không dạng khoa học).
      const cotMst =
        COT_HOP_DONG_KHTC.findIndex((c) => c.key === 'ma_so_thue') + 1;
      expect(ws.getColumn(cotMst).numFmt).toBe('@');
    });

    it('"Danh sách GV": 5 dòng (A 3 + B 2) theo trường rồi họ tên, nhãn giai đoạn, suất, ngày sinh', () => {
      const dong = doc.dongCua('Danh sách GV');
      expect(dong[0]).toEqual([
        'STT',
        'Mã trường',
        'Trường',
        'Họ tên',
        'Ngày sinh',
        'Lớp/môn',
        'Giai đoạn',
        'Suất',
      ]);
      expect(dong.slice(1)).toEqual([
        [
          1,
          ma.A,
          ten.A,
          `Bùi Bịa ${suf}`,
          new Date('1990-01-31T00:00:00Z'),
          'Toán 9',
          'Chỉ GĐ1',
          0.5,
        ],
        [
          2,
          ma.A,
          ten.A,
          `Lê Bịa ${suf}`,
          new Date('1990-01-31T00:00:00Z'),
          'Toán 9',
          'Chỉ GĐ2',
          0.5,
        ],
        [
          3,
          ma.A,
          ten.A,
          `Võ Bịa ${suf}`,
          new Date('1990-01-31T00:00:00Z'),
          'Toán 9',
          'Cả 2',
          1,
        ],
        [
          4,
          ma.B,
          ten.B,
          `Đặng Bịa ${suf}`,
          new Date('1990-01-31T00:00:00Z'),
          'Toán 9',
          'Cả 2',
          1,
        ],
        [
          5,
          ma.B,
          ten.B,
          `Nguyễn Bịa ${suf}`,
          new Date('1990-01-31T00:00:00Z'),
          'Toán 9',
          'Cả 2',
          1,
        ],
      ]);
    });

    it('"Chi hỗ trợ": 4 dòng (HT 1.000.000 / KT 500.000, STK ĐẦY ĐỦ từ bản chụp) + dòng Tổng cộng 3.000.000', () => {
      const dong = doc.dongCua('Chi hỗ trợ');
      expect(dong[0]).toEqual([
        'STT',
        'Mã trường',
        'Trường',
        'Vai trò',
        'Họ tên',
        'STK',
        'Ngân hàng – chi nhánh',
        'Số tiền',
      ]);
      expect(dong.slice(1, 5)).toEqual([
        [
          1,
          ma.A,
          ten.A,
          'Hiệu trưởng',
          'Hiệu Trưởng A Bịa',
          STK.A_HT,
          'Ngân hàng Giả – CN A',
          1_000_000,
        ],
        [
          2,
          ma.A,
          ten.A,
          'Kế toán',
          'Kế Toán A Bịa',
          STK.A_KT,
          'Ngân hàng Giả – CN A KT',
          500_000,
        ],
        [
          3,
          ma.B,
          ten.B,
          'Hiệu trưởng',
          'Hiệu Trưởng B Bịa',
          STK.B_HT,
          'Ngân hàng Giả – CN B',
          1_000_000,
        ],
        [
          4,
          ma.B,
          ten.B,
          'Kế toán',
          'Kế Toán B Bịa',
          STK.B_KT,
          'Ngân hàng Giả – CN B KT',
          500_000,
        ],
      ]);
      expect(dong).toHaveLength(6);
      const tong = dong[5];
      expect(tong[0]).toBe('Tổng cộng');
      expect(tong[7]).toBe(3_000_000);
    });

    it('đợt chưa ai nộp → file hợp lệ, 3 sheet chỉ có tiêu đề', async () => {
      const r = await taiExcel(dotRong);
      expect(r.status).toBe(200);
      const { wb } = await docFile(r.body as Buffer);
      expect(wb.worksheets.map((s) => s.name)).toEqual([
        'Hợp đồng',
        'Danh sách GV',
        'Chi hỗ trợ',
      ]);
      for (const sh of wb.worksheets) expect(sh.rowCount).toBe(1);
    });

    it('mỗi lần xuất ghi ĐÚNG 1 nhật ký xuat_khtc_hop_dong {đợt, số HĐ, số GV, co_stk_ca_nhan} — không tên/STK', async () => {
      const truoc = (await nhatKyXuat(dot1)).length;
      expect((await taiExcel(dot1)).status).toBe(200);
      expect(await nhatKyXuat(dot1)).toHaveLength(truoc + 1);
      expect((await taiExcel(dot1)).status).toBe(200);
      const nk = await nhatKyXuat(dot1);
      expect(nk).toHaveLength(truoc + 2);
      for (const n of nk.slice(0, 2)) {
        expect(n.vai_tro).toBe('quan_tri');
        expect(n.chi_tiet).toEqual({
          dot_trien_khai_id: dot1,
          so_hop_dong: 2,
          so_giao_vien: 5,
          co_stk_ca_nhan: true,
        });
      }
      const chiTiet = JSON.stringify(nk.map((n) => n.chi_tiet));
      expect(chiTiet).not.toMatch(/Bịa|HCMUE/);
      for (const stk of Object.values(STK)) expect(chiTiet).not.toContain(stk);
    });
  });

  describe('GET danh sách hợp đồng của đợt — STK che (O4)', () => {
    type Item = {
      don_vi: { id: string; ma: string; ten: string };
      trang_thai_danh_sach: string;
      trang_thai_hop_dong: string;
      nop_luc: string | null;
      so_nguoi: number;
      tong_suat: number;
      gia_tri: number | null;
      han_hieu_luc_ngay: string;
      qua_han: boolean;
      ht_ho_ten: string | null;
      ht_so_tai_khoan_che: string | null;
      kt_ho_ten: string | null;
      kt_so_tai_khoan_che: string | null;
    };
    let res: request.Response;
    let items: Item[];

    beforeAll(async () => {
      res = await http().get(urlDsHd(dot1)).set(auth(token.quanTri));
      items = res.body.items as Item[];
    });

    it('mọi trường của đợt theo tên (A, B nộp; C chưa nộp), số liệu + hạn', () => {
      expect(res.status).toBe(200);
      expect(res.body.dot).toMatchObject({
        id: dot1,
        don_gia: DON_GIA,
        han_nop_ngay: '2026-12-31',
      });
      expect(items.map((i) => i.don_vi.id)).toEqual([tr.A, tr.B, tr.C]);
      const [a, b, c] = items;
      expect(a).toMatchObject({
        don_vi: { id: tr.A, ma: ma.A, ten: ten.A },
        trang_thai_danh_sach: 'da_xac_nhan',
        trang_thai_hop_dong: 'da_nop',
        so_nguoi: 3,
        tong_suat: 2,
        gia_tri: 2_400_000,
        han_hieu_luc_ngay: '2026-12-31',
        qua_han: false,
      });
      expect(a.nop_luc).toEqual(expect.any(String));
      expect(b.trang_thai_hop_dong).toBe('da_nop');
      expect(c).toMatchObject({
        trang_thai_danh_sach: 'cho_xac_nhan',
        trang_thai_hop_dong: 'chua_nop',
        nop_luc: null,
        so_nguoi: 1,
        tong_suat: 1,
        gia_tri: DON_GIA,
      });
    });

    it('Phần 5: đã nộp lấy từ bản chụp, chưa nộp từ hồ sơ hiện tại; STK CHỈ dạng che (còn 4 số cuối)', () => {
      const [a, b, c] = items;
      expect(a.ht_ho_ten).toBe('Hiệu Trưởng A Bịa');
      expect(a.ht_so_tai_khoan_che).toBe('••••••••1111');
      expect(a.kt_so_tai_khoan_che).toBe('••••••••2222');
      expect(b.ht_so_tai_khoan_che).toBe('••••••••3333');
      expect(c.ht_ho_ten).toBe('Hiệu Trưởng C Bịa');
      expect(c.kt_ho_ten).toBe('Kế Toán C Bịa');
      expect(c.ht_so_tai_khoan_che).toBe('••••••••5555');
      expect(c.kt_so_tai_khoan_che).toBe('••••••••6666');
      for (const it of items) {
        expect(it).not.toHaveProperty('ht_so_tai_khoan');
        expect(it).not.toHaveProperty('kt_so_tai_khoan');
      }
    });

    it('không STK đầy đủ nào xuất hiện ở bất kỳ đâu trong thân phản hồi', () => {
      const body = JSON.stringify(res.body);
      for (const stk of Object.values(STK)) expect(body).not.toContain(stk);
    });

    it('API chi tiết 1 trường vẫn trả STK ĐẦY ĐỦ (O4: đầy đủ chỉ ở chi tiết)', async () => {
      const r = await http()
        .get(`${urlDsHd(dot1)}/${tr.A}`)
        .set(auth(token.quanTri))
        .expect(200);
      expect(r.body.ban_chup_ho_so.ht_so_tai_khoan).toBe(STK.A_HT);
      expect(r.body.ban_chup_ho_so.kt_so_tai_khoan).toBe(STK.A_KT);
      const rc = await http()
        .get(`${urlDsHd(dot1)}/${tr.C}`)
        .set(auth(token.quanTri))
        .expect(200);
      expect(rc.body.ho_so_hien_tai.ht_so_tai_khoan).toBe(STK.C_HT);
    });
  });
});
