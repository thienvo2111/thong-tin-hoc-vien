import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
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

// Issue #71 / ADR 0015 P1, O3: Sở/Phòng xem tiến độ các trường TRONG PHẠM VI theo đợt + danh sách GV, KHÔNG
// Phần 2/3/4/5, liên hệ hồ sơ, người thao tác. Dữ liệu dựng thẳng bằng prisma. Mọi tên, STK, SĐT đều BỊA.
//
// Cây: S1 (Sở) ─ P1 (Phòng) ─ A;  S1 ─ B;  S2 (Sở) ─ C.  D1: A (đã nộp), B (báo sai lệch, quá hạn), C;  D2: C.
describe('Tiến độ Sở/Phòng - Cổng đơn vị (e2e)', () => {
  let app: INestApplication;
  let fixture: Awaited<ReturnType<typeof taoDonViTest>>;
  type VaiTro = 'so1' | 'phong1' | 'so2' | 'truongA' | 'quanTri' | 'hocVien';
  const token = {} as Record<VaiTro, string>;
  const nguoiDungIds: string[] = [];
  const donViIds: string[] = [];
  const dotIds: string[] = [];
  const deNghiIds: string[] = [];
  const hoSoDonViIds: string[] = [];
  const hocVienIds: string[] = [];

  const suf = uniqueSuffix();
  const MAT_KHAU = 'MatKhau123';
  const DON_GIA = 1_000_000;
  const dv = {} as Record<'S1' | 'P1' | 'A' | 'B' | 'S2' | 'C', string>;
  let d1 = '';
  let d2 = '';
  let nguoiNopId = '';

  // Giá trị BỊA đặc trưng của Phần 2/3/4/5 + liên hệ — không được xuất hiện ở bất kỳ response nào.
  const STK = {
    truong: '1111222233334444',
    ht: '5555666677778888',
    kt: '9999000011112222',
    chuyenKhoan: '3713.0.7654321',
  };
  const HO_SO_DAY_DU = {
    ten_truong: 'Trường A Bịa',
    dia_chi: 'Ấp Bịa, xã Thử',
    ma_so_thue: '0000000009',
    nguoi_dai_dien: 'Người Đại Diện Bịa',
    sdt_dai_dien: '0900000091',
    email_hoa_don: `hoadon-${suf}@mau.test`,
    so_tai_khoan: STK.truong,
    ngan_hang: 'Ngân hàng Giả Định',
    chi_nhanh: 'Chi nhánh Giả Định',
    kho_bac: 'Kho bạc Giả Định',
    mst_kho_bac: '0000000009-001',
    ma_qhns: '7654321',
    ma_nguon: '13',
    ht_ho_ten: 'Hiệu Trưởng Giả Định',
    ht_so_tai_khoan: STK.ht,
    ht_ngan_hang: 'Ngân hàng Giả Định',
    kt_ho_ten: 'Kế Toán Giả Định',
    kt_sdt: '0900000092',
    kt_so_tai_khoan: STK.kt,
    kt_ngan_hang: 'Ngân hàng Giả Định',
    dau_moi_csvc: 'Đầu Mối Giả Định',
  };
  const PHAN_3_4 = {
    nguoi_nhan: 'Người Nhận Giả Định',
    sdt_nguoi_nhan: '0900000093',
    dia_chi_nhan: 'Số 1 Đường Giả Định',
    so_qd: 'QĐ-BIA-123',
    ngay_qd: new Date('2026-11-01T00:00:00Z'),
  };
  const GIA_TRI_A = 6_500_000;

  const KHOA_CAM = [
    'so_tai_khoan',
    'ngan_hang',
    'chi_nhanh',
    'kho_bac',
    'mst_kho_bac',
    'ma_qhns',
    'ma_nguon',
    'ht_ho_ten',
    'ht_so_tai_khoan',
    'kt_ho_ten',
    'kt_sdt',
    'kt_so_tai_khoan',
    'nguoi_nhan',
    'sdt_nguoi_nhan',
    'dia_chi_nhan',
    'so_qd',
    'ngay_qd',
    'ban_chup_ho_so',
    'stk_chuyen_khoan',
    'chuyen_khoan',
    'nguoi_dai_dien',
    'sdt_dai_dien',
    'email_hoa_don',
    'ma_goc',
    'hoc_vien_id',
    'thao_tac_cuoi_boi',
  ];
  const GIA_TRI_CAM = [
    STK.truong,
    STK.ht,
    STK.kt,
    STK.chuyenKhoan,
    HO_SO_DAY_DU.nguoi_dai_dien,
    HO_SO_DAY_DU.sdt_dai_dien,
    HO_SO_DAY_DU.email_hoa_don,
    HO_SO_DAY_DU.ht_ho_ten,
    HO_SO_DAY_DU.kt_ho_ten,
    HO_SO_DAY_DU.kt_sdt,
    PHAN_3_4.nguoi_nhan,
    PHAN_3_4.sdt_nguoi_nhan,
    PHAN_3_4.dia_chi_nhan,
    PHAN_3_4.so_qd,
    `MA-GOC-${suf}`,
  ];

  /** Mọi khóa (đệ quy) trong JSON. */
  function moiKhoa(x: unknown, tap = new Set<string>()): Set<string> {
    if (Array.isArray(x)) x.forEach((y) => moiKhoa(y, tap));
    else if (x && typeof x === 'object') {
      for (const [k, v] of Object.entries(x)) {
        tap.add(k);
        moiKhoa(v, tap);
      }
    }
    return tap;
  }
  function khongLoDuLieuCam(body: unknown) {
    const khoa = moiKhoa(body);
    expect(KHOA_CAM.filter((k) => khoa.has(k))).toEqual([]);
    const json = JSON.stringify(body);
    expect(GIA_TRI_CAM.filter((g) => json.includes(g))).toEqual([]);
  }

  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const URL_DOT = '/cong-don-vi/don-vi/dot';
  const urlTienDo = (dotId: string) => `${URL_DOT}/${dotId}/tien-do`;
  const urlDanhSach = (dotId: string, donViId: string) =>
    `${URL_DOT}/${dotId}/truong/${donViId}/danh-sach`;
  const get = (url: string, vaiTro: VaiTro, query: object = {}) =>
    http().get(url).query(query).set(auth(token[vaiTro]));

  async function dangNhap(ten_dang_nhap: string) {
    const res = await http()
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap, mat_khau: MAT_KHAU })
      .expect(200);
    return res.body.token as string;
  }

  async function taoTaiKhoan(
    vaiTro: VaiTro,
    vai_tro: 'quan_tri' | 'truong' | 'so_gddt' | 'phong_vhxh',
    don_vi_id: string,
  ) {
    const u = await taoNguoiDungTest({
      vai_tro,
      don_vi_id,
      mat_khau: MAT_KHAU,
    });
    nguoiDungIds.push(u.nguoiDung.id);
    token[vaiTro] = await dangNhap(u.ten_dang_nhap);
    return u.nguoiDung.id;
  }

  async function taoDonVi(
    ten: string,
    loai: 'so_gddt' | 'phong_vhxh' | 'truong',
    cha: string | null,
  ) {
    const d = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DVTD-${uniqueSuffix()}`,
        ten_don_vi: `${ten} ${suf}`,
        loai_don_vi: loai,
        dia_ban_id: fixture.diaDanhXa.id,
        don_vi_cha_id: cha,
        trang_thai: 'active',
      },
    });
    donViIds.push(d.id);
    return d.id;
  }

  async function taoDot(ten: string, hanNop: string) {
    const d = await prisma.dot_trien_khai.create({
      data: {
        chuong_trinh: 'hsg',
        ten: `${ten} ${suf}`,
        don_gia: DON_GIA,
        han_nop: new Date(hanNop),
        so_gddt_id: dv.S1,
      },
    });
    dotIds.push(d.id);
    return d.id;
  }

  async function taoDong(
    dotId: string,
    donViId: string,
    suat: (1 | 0.5)[],
    them: Partial<Prisma.danh_sach_tham_giaUncheckedCreateInput> = {},
  ) {
    for (const [i, s] of suat.entries()) {
      await prisma.danh_sach_tham_gia.create({
        data: {
          dot_trien_khai_id: dotId,
          don_vi_id: donViId,
          ho_ten: `GV Bịa ${i + 1} ${suf}`,
          giai_doan: s === 1 ? 'ca_hai' : 'chi_gd1',
          ty_le_suat: s,
          ...them,
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

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    fixture = await taoDonViTest('dvtd');
    dv.S1 = await taoDonVi('Sở Một Bịa', 'so_gddt', null);
    dv.P1 = await taoDonVi('Phòng Một Bịa', 'phong_vhxh', dv.S1);
    dv.A = await taoDonVi('Trường A Bịa', 'truong', dv.P1);
    dv.B = await taoDonVi('Trường B Bịa', 'truong', dv.S1);
    dv.S2 = await taoDonVi('Sở Hai Bịa', 'so_gddt', null);
    dv.C = await taoDonVi('Trường C Bịa', 'truong', dv.S2);

    await taoTaiKhoan('quanTri', 'quan_tri', fixture.donVi.id);
    nguoiNopId = await taoTaiKhoan('truongA', 'truong', dv.A);
    await taoTaiKhoan('so1', 'so_gddt', dv.S1);
    await taoTaiKhoan('phong1', 'phong_vhxh', dv.P1);
    await taoTaiKhoan('so2', 'so_gddt', dv.S2);

    const hv = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: `MOET-DVTD-${suf}`,
        ho_ten: 'Học Viên Bịa Tiến Độ',
        ngay_sinh: 1,
        thang_sinh: 2,
        nam_sinh: 1990,
        trinh_do_chuyen_mon: 'dai_hoc',
        doi_tuong: 'giao_vien',
        don_vi_cong_tac_id: dv.A,
      },
    });
    hocVienIds.push(hv.id);
    const uHv = await prisma.nguoi_dung.create({
      data: {
        ho_ten: hv.ho_ten,
        ten_dang_nhap: hv.ma_dinh_danh_moet as string,
        vai_tro: 'hoc_vien',
        hoc_vien_id: hv.id,
        mat_khau_hash: await bcrypt.hash(MAT_KHAU, 4),
        phai_doi_mat_khau: false,
      },
    });
    nguoiDungIds.push(uHv.id);
    token.hocVien = await dangNhap(uHv.ten_dang_nhap);

    d1 = await taoDot('HSG Sở Phòng', '2027-06-30T16:59:59Z');
    d2 = await taoDot('HSG chỉ C', '2027-09-30T16:59:59Z');

    // A: đã nộp. Danh sách hiện tại 2 người / 1,5 suất (có ma_goc, hoc_vien_id) KHÁC bản chụp 7 người / 6,5 suất.
    await taoDong(d1, dv.A, [1, 0.5], {
      ma_goc: `MA-GOC-${suf}`,
      hoc_vien_id: hv.id,
      lop: '6A',
      gioi_tinh: 'Nữ',
      ngay_sinh: new Date('1990-02-01T00:00:00Z'),
      ghi_chu: 'Ghi chú bịa',
      y_kien_truong: 'dong_y',
    });
    await taoHopDong(d1, dv.A, {
      trang_thai_danh_sach: 'da_xac_nhan',
      trang_thai_hop_dong: 'da_nop',
      ...PHAN_3_4,
      diem_hoc_truc_tiep: true,
      thao_tac_cuoi_boi: nguoiNopId,
      thao_tac_cuoi_luc: new Date('2026-11-19T03:00:00Z'),
      nop_luc: new Date('2026-11-19T03:04:00Z'),
      nop_boi: nguoiNopId,
      ban_chup_ho_so: {
        ...HO_SO_DAY_DU,
        stk_chuyen_khoan: STK.chuyenKhoan,
        don_vi_tiep_nhan: 'Đơn vị Bịa',
        ngan_hang_tiep_nhan: 'Kho bạc Bịa',
      },
      so_nguoi_luc_nop: 7,
      tong_suat_luc_nop: 6.5,
      don_gia_luc_nop: DON_GIA,
      gia_tri_luc_nop: BigInt(GIA_TRI_A),
    });
    await prisma.ho_so_don_vi.create({
      data: { don_vi_id: dv.A, ...HO_SO_DAY_DU },
    });
    hoSoDonViIds.push(dv.A);

    // B: báo sai lệch, 1 đề nghị chờ, hạn riêng đã qua → quá hạn. 2 người / 2 suất.
    await taoDong(d1, dv.B, [1, 1]);
    await taoHopDong(d1, dv.B, {
      trang_thai_danh_sach: 'bao_sai_lech',
      han_rieng: new Date('2026-01-01T16:59:59Z'),
    });
    const dn = await prisma.de_nghi_sua_danh_sach.create({
      data: {
        dot_trien_khai_id: d1,
        don_vi_id: dv.B,
        loai: 'them',
        gia_tri: { ho_ten: `GV Bịa Thêm ${suf}` },
        trang_thai: 'cho',
        gui_boi: nguoiNopId,
      },
    });
    deNghiIds.push(dn.id);

    // C (Sở 2): chờ xác nhận ở D1 (1 người) và D2 (0,5 suất).
    await taoDong(d1, dv.C, [1]);
    await taoHopDong(d1, dv.C);
    await taoDong(d2, dv.C, [0.5]);
    await taoHopDong(d2, dv.C);
  });

  afterAll(async () => {
    // Chỉ xóa đúng id file này tạo, con trước cha; mảng rỗng thì bỏ qua. nhat_ky_hoat_dong để nguyên.
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
    if (hoSoDonViIds.length > 0) {
      await prisma.ho_so_don_vi.deleteMany({
        where: { don_vi_id: { in: hoSoDonViIds } },
      });
    }
    for (const id of nguoiDungIds) await xoaNguoiDungTest(id);
    if (hocVienIds.length > 0) {
      await prisma.hoc_vien.deleteMany({ where: { id: { in: hocVienIds } } });
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

  type The = {
    dot: { id: string; ten: string; han_nop_ngay: string };
    so_truong: number;
    so_da_xac_nhan_ds: number;
    so_bao_sai_lech: number;
    so_da_nop: number;
    so_qua_han: number;
    tong_nguoi: number;
    tong_suat: number;
    tong_gia_tri: number | null;
  };
  type Dong = {
    don_vi: { id: string };
    so_nguoi: number;
    tong_suat: number;
    gia_tri: number | null;
  } & Record<string, unknown>;
  const idTruong = (dong: Dong[]) => dong.map((d) => d.don_vi.id);

  describe('GET /cong-don-vi/don-vi/dot — thẻ đợt trong phạm vi', () => {
    it('Sở 1: chỉ D1, đếm trên A + B (không C); A theo bản chụp lúc nộp', async () => {
      const res = await get(URL_DOT, 'so1').expect(200);
      const ds = res.body as The[];
      expect(ds.map((t) => t.dot.id)).toEqual([d1]);
      expect(ds[0]).toEqual({
        dot: {
          id: d1,
          ten: `HSG Sở Phòng ${suf}`,
          chuong_trinh: 'hsg',
          don_gia: DON_GIA,
          han_nop: '2027-06-30T16:59:59.000Z',
          han_nop_ngay: '2027-06-30',
        },
        so_truong: 2,
        so_da_xac_nhan_ds: 1,
        so_bao_sai_lech: 1,
        so_da_nop: 1,
        so_qua_han: 1,
        tong_nguoi: 9,
        tong_suat: 8.5,
        tong_gia_tri: GIA_TRI_A + 2 * DON_GIA,
      });
      khongLoDuLieuCam(res.body);
    });

    it('Phòng 1: D1 chỉ với A', async () => {
      const res = await get(URL_DOT, 'phong1').expect(200);
      const ds = res.body as The[];
      expect(ds.map((t) => t.dot.id)).toEqual([d1]);
      expect(ds[0]).toMatchObject({
        so_truong: 1,
        so_da_nop: 1,
        so_bao_sai_lech: 0,
        so_qua_han: 0,
        tong_nguoi: 7,
        tong_suat: 6.5,
        tong_gia_tri: GIA_TRI_A,
      });
      khongLoDuLieuCam(res.body);
    });

    it('Sở 2: D2 rồi D1 (hạn nộp muộn trước), mỗi đợt chỉ C', async () => {
      const res = await get(URL_DOT, 'so2').expect(200);
      const ds = res.body as The[];
      expect(ds.map((t) => t.dot.id)).toEqual([d2, d1]);
      expect(ds[0]).toMatchObject({
        so_truong: 1,
        tong_nguoi: 1,
        tong_suat: 0.5,
        tong_gia_tri: 500_000,
      });
      expect(ds[1]).toMatchObject({
        so_truong: 1,
        so_da_xac_nhan_ds: 0,
        tong_nguoi: 1,
        tong_suat: 1,
        tong_gia_tri: DON_GIA,
      });
      khongLoDuLieuCam(res.body);
    });
  });

  describe('GET /cong-don-vi/don-vi/dot/:dotId/tien-do', () => {
    it('Sở 1: dòng A, B (không C), đúng tập khóa; A số liệu bản chụp, B đề nghị chờ + quá hạn', async () => {
      const res = await get(urlTienDo(d1), 'so1').expect(200);
      const dong = res.body.dong as Dong[];
      expect(idTruong(dong)).toEqual([dv.A, dv.B]);
      expect(res.body.tong_hop).toMatchObject({
        so_truong: 2,
        tong_nguoi: 9,
        tong_suat: 8.5,
      });
      for (const d of dong) {
        expect(Object.keys(d).sort()).toEqual(
          [
            'don_vi',
            'so_nguoi',
            'tong_suat',
            'gia_tri',
            'trang_thai_danh_sach',
            'trang_thai_hop_dong',
            'nop_luc',
            'han_hieu_luc_ngay',
            'qua_han',
            'so_de_nghi_cho',
            'thao_tac_cuoi_luc',
          ].sort(),
        );
        expect(Object.keys(d.don_vi).sort()).toEqual([
          'dia_ban',
          'id',
          'ma',
          'ten',
        ]);
      }
      expect(dong[0]).toMatchObject({
        so_nguoi: 7,
        tong_suat: 6.5,
        gia_tri: GIA_TRI_A,
        trang_thai_danh_sach: 'da_xac_nhan',
        trang_thai_hop_dong: 'da_nop',
        nop_luc: '2026-11-19T03:04:00.000Z',
        qua_han: false,
        thao_tac_cuoi_luc: '2026-11-19T03:04:00.000Z',
      });
      expect(dong[1]).toMatchObject({
        so_nguoi: 2,
        tong_suat: 2,
        gia_tri: 2 * DON_GIA,
        trang_thai_danh_sach: 'bao_sai_lech',
        trang_thai_hop_dong: 'chua_nop',
        so_de_nghi_cho: 1,
        qua_han: true,
        han_hieu_luc_ngay: '2026-01-01',
        thao_tac_cuoi_luc: null,
      });
      khongLoDuLieuCam(res.body);
    });

    it.each<[string, string[]]>([
      ['tat_ca', ['A', 'B']],
      ['chua_xac_nhan_ds', ['B']],
      ['bao_sai_lech', ['B']],
      ['chua_nop_hd', ['B']],
      ['qua_han', ['B']],
    ])(
      'Sở 1 loc=%s → %j (trong phạm vi), tong_hop không đổi',
      async (loc, mong) => {
        const res = await get(urlTienDo(d1), 'so1', { loc }).expect(200);
        expect(idTruong(res.body.dong)).toEqual(
          mong.map((t) => dv[t as 'A' | 'B']),
        );
        expect(res.body.tong_hop.so_truong).toBe(2);
        khongLoDuLieuCam(res.body);
      },
    );

    it('Sở 2 loc=chua_xac_nhan_ds → chỉ C', async () => {
      const res = await get(urlTienDo(d1), 'so2', {
        loc: 'chua_xac_nhan_ds',
      }).expect(200);
      expect(idTruong(res.body.dong)).toEqual([dv.C]);
    });

    it('Phòng 1: chỉ A', async () => {
      const res = await get(urlTienDo(d1), 'phong1').expect(200);
      expect(idTruong(res.body.dong)).toEqual([dv.A]);
      expect(res.body.tong_hop.so_truong).toBe(1);
      khongLoDuLieuCam(res.body);
    });

    it('loc không hợp lệ → 400', async () => {
      await get(urlTienDo(d1), 'so1', { loc: 'bua' }).expect(400);
    });

    it('Sở 1 xin D2 (không trường nào trong phạm vi) → 404 như đợt không tồn tại', async () => {
      const r1 = await get(urlTienDo(d2), 'so1').expect(404);
      const r2 = await get(
        urlTienDo('00000000-0000-4000-8000-000000000000'),
        'so1',
      ).expect(404);
      expect(r1.body.error.message).toBe(r2.body.error.message);
    });

    it('dotId không phải UUID → 400', async () => {
      await get(urlTienDo('khong-phai-uuid'), 'so1').expect(400);
    });
  });

  describe('GET .../dot/:dotId/truong/:donViId/danh-sach', () => {
    it('Phòng 1 xem A → 200: dòng chỉ đọc đúng 9 cột, số liệu từ bản chụp', async () => {
      const res = await get(urlDanhSach(d1, dv.A), 'phong1').expect(200);
      expect(res.body).toMatchObject({
        dot: { id: d1, chuong_trinh: 'hsg', han_nop_ngay: '2027-06-30' },
        truong: { id: dv.A, ten: `Trường A Bịa ${suf}` },
        trang_thai_danh_sach: 'da_xac_nhan',
        trang_thai_hop_dong: 'da_nop',
        so_nguoi: 7,
        tong_suat: 6.5,
        gia_tri: GIA_TRI_A,
      });
      expect(Object.keys(res.body.truong).sort()).toEqual(['id', 'ma', 'ten']);
      expect(res.body.dong).toHaveLength(2);
      for (const d of res.body.dong as Record<string, unknown>[]) {
        expect(Object.keys(d).sort()).toEqual(
          [
            'id',
            'ho_ten',
            'ngay_sinh',
            'gioi_tinh',
            'lop',
            'giai_doan',
            'ty_le_suat',
            'ghi_chu',
            'y_kien_truong',
          ].sort(),
        );
      }
      expect(res.body.dong[0]).toMatchObject({
        ho_ten: `GV Bịa 1 ${suf}`,
        ngay_sinh: '1990-02-01',
        gioi_tinh: 'Nữ',
        lop: '6A',
        giai_doan: 'ca_hai',
        ty_le_suat: 1,
        ghi_chu: 'Ghi chú bịa',
        y_kien_truong: 'dong_y',
      });
      expect(res.body.dong[1]).toMatchObject({
        giai_doan: 'chi_gd1',
        ty_le_suat: 0.5,
      });
      khongLoDuLieuCam(res.body);
    });

    it('Sở 1 xem B (chưa nộp) → số liệu trực tiếp', async () => {
      const res = await get(urlDanhSach(d1, dv.B), 'so1').expect(200);
      expect(res.body).toMatchObject({
        trang_thai_danh_sach: 'bao_sai_lech',
        trang_thai_hop_dong: 'chua_nop',
        so_nguoi: 2,
        tong_suat: 2,
        gia_tri: 2 * DON_GIA,
      });
      khongLoDuLieuCam(res.body);
    });

    it('Sở 2 xem C ở D2 → 200', async () => {
      const res = await get(urlDanhSach(d2, dv.C), 'so2').expect(200);
      expect(res.body.dong).toHaveLength(1);
      khongLoDuLieuCam(res.body);
    });

    it.each<[VaiTro, 'd1' | 'd2', 'A' | 'B' | 'C']>([
      ['so1', 'd1', 'C'],
      ['phong1', 'd1', 'B'],
      ['so2', 'd1', 'A'],
      ['so1', 'd2', 'A'],
    ])(
      '%s xem %s/%s (ngoài phạm vi hoặc không có danh sách) → 404',
      async (vaiTro, dot, truong) => {
        await get(
          urlDanhSach(dot === 'd1' ? d1 : d2, dv[truong]),
          vaiTro,
        ).expect(404);
      },
    );
  });

  describe('Phân quyền', () => {
    const cacUrl = () => [URL_DOT, urlTienDo(d1), urlDanhSach(d1, dv.A)];

    it('không có token → 401 (cả 3 endpoint)', async () => {
      for (const url of cacUrl()) await http().get(url).expect(401);
    });

    it.each<VaiTro>(['truongA', 'quanTri', 'hocVien'])(
      '%s → 403 (cả 3 endpoint)',
      async (vaiTro) => {
        for (const url of cacUrl()) await get(url, vaiTro).expect(403);
      },
    );
  });
});
