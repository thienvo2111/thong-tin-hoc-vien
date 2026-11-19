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

// Issue #60 / ADR 0015 M5, S5, U1, X6, O3: trường xem đợt + danh sách tham gia của CHÍNH MÌNH,
// và nạp / thêm dòng (lát #58, #59) tạo kèm dòng hop_dong_boi_duong.
// Mọi họ tên / mã / tên trường đều BỊA, kèm hậu tố ngẫu nhiên — không có PII thật.
describe('Trang chủ trường + xem danh sách - Cổng đơn vị (e2e)', () => {
  let app: INestApplication;
  let fixture: Awaited<ReturnType<typeof taoDonViTest>>;
  type NguoiDungTest = Awaited<ReturnType<typeof taoNguoiDungTest>>;
  const nguoiDung: NguoiDungTest[] = [];
  const token = {} as Record<
    'quanTri' | 'truongA' | 'truongB' | 'truongC' | 'so' | 'hocVien',
    string
  >;

  const suf = uniqueSuffix();
  const MAT_KHAU = 'MatKhau123';
  // Thứ tự tạo = thứ tự xóa ngược (con trước cha).
  const donViIds: string[] = [];
  const dotIds: string[] = [];
  const ids = {} as Record<'so' | 'tA' | 'tB' | 'tC', string>;
  // dotChung: A + B, đơn giá lẻ; dotChiB: chỉ B; dotKhongGia: A, chưa có đơn giá (hạn sớm nhất).
  const dot = {} as Record<'chung' | 'chiB' | 'khongGia', string>;
  let hocVienId: string | undefined;
  let nguoiDungHocVienId: string | undefined;

  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const URL_DOT = '/cong-don-vi/truong/dot';
  const urlDs = (dotId: string) => `/cong-don-vi/truong/dot/${dotId}/danh-sach`;
  const urlQt = (dotId: string, duoi: string) =>
    `/cong-don-vi/dot-trien-khai/${dotId}/${duoi}`;

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
    return dangNhap(u.ten_dang_nhap);
  }

  async function taoDonVi(
    ten: string,
    loai: 'so_gddt' | 'truong',
    cha: string | null,
  ) {
    const dv = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `TDS-${uniqueSuffix()}`,
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

  async function taoDot(ten: string, han: string, don_gia: number | null) {
    const d = await prisma.dot_trien_khai.create({
      data: {
        chuong_trinh: 'hsg',
        ten: `${ten} ${suf}`,
        don_gia,
        han_nop: new Date(han),
        so_gddt_id: ids.so,
      },
    });
    dotIds.push(d.id);
    return d.id;
  }

  const dong = (don_vi_id: string, ho_ten: string, nua = false) => ({
    don_vi_id,
    ho_ten: `${ho_ten} ${suf}`,
    ngay_sinh: '1990-02-01',
    gioi_tinh: 'Nữ',
    lop: 'Toán 9',
    giai_doan: nua ? 'chi_gd1' : 'ca_hai',
    ty_le_suat: nua ? 0.5 : 1,
    ghi_chu: nua ? 'chỉ học GĐ1 (bịa)' : null,
  });

  const nap = (dotId: string, ds: unknown[]) =>
    http()
      .post(urlQt(dotId, 'danh-sach/nap'))
      .set(auth(token.quanTri))
      .send({ dong: ds });

  const hopDongCua = (dotId: string) =>
    prisma.hop_dong_boi_duong.findMany({
      where: { dot_trien_khai_id: dotId },
      orderBy: { don_vi_id: 'asc' },
    });

  /** Học viên bịa (đủ cột bắt buộc, quan_tri đã tạo trước) + tài khoản hoc_vien để thử 403. */
  async function taoHocVienDangNhap() {
    const ten = `MOET-TDS-${uniqueSuffix()}`;
    const hv = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: ten,
        so_dinh_danh_ca_nhan: `${Date.now()}`.padStart(12, '7').slice(-12),
        ho_ten: 'Học Viên Bịa Cổng',
        email_lien_he: `tds-${suf}@test.local`,
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
    const nd = await prisma.nguoi_dung.create({
      data: {
        ho_ten: hv.ho_ten,
        ten_dang_nhap: ten,
        vai_tro: 'hoc_vien',
        hoc_vien_id: hv.id,
        mat_khau_hash: await bcrypt.hash(MAT_KHAU, 4),
        phai_doi_mat_khau: false,
      },
    });
    nguoiDungHocVienId = nd.id;
    return dangNhap(ten);
  }

  beforeAll(async () => {
    app = await createTestApp();
    fixture = await taoDonViTest('tds');
    ids.so = await taoDonVi(`Sở thử trường xem ${suf}`, 'so_gddt', null);
    ids.tA = await taoDonVi(`Trường A Thử Xem ${suf}`, 'truong', ids.so);
    ids.tB = await taoDonVi(`Trường B Thử Xem ${suf}`, 'truong', ids.so);
    ids.tC = await taoDonVi(`Trường C Thử Xem ${suf}`, 'truong', ids.so);

    // Hạn nộp (giờ VN 23:59:59 = 16:59:59Z): khongGia < chung < chiB.
    dot.chung = await taoDot('HSG chung', '2026-12-20T16:59:59Z', 1_234_567);
    dot.chiB = await taoDot('HSG chỉ B', '2026-12-31T16:59:59Z', 2_000_000);
    dot.khongGia = await taoDot('HSG chưa giá', '2026-12-10T16:59:59Z', null);

    token.quanTri = await taoTaiKhoan('quan_tri', fixture.donVi.id);
    token.truongA = await taoTaiKhoan('truong', ids.tA);
    token.truongB = await taoTaiKhoan('truong', ids.tB);
    token.truongC = await taoTaiKhoan('truong', ids.tC);
    token.so = await taoTaiKhoan('so_gddt', ids.so);
    token.hocVien = await taoHocVienDangNhap();
  });

  afterAll(async () => {
    // Chỉ xóa đúng các dòng file này tạo (id ghi lại; mảng rỗng thì bỏ qua).
    // nhat_ky_hoat_dong chỉ cho thêm (trigger chặn xóa) — để nguyên.
    if (dotIds.length > 0) {
      await prisma.danh_sach_tham_gia.deleteMany({
        where: { dot_trien_khai_id: { in: dotIds } },
      });
      await prisma.hop_dong_boi_duong.deleteMany({
        where: { dot_trien_khai_id: { in: dotIds } },
      });
      await prisma.dot_trien_khai.deleteMany({ where: { id: { in: dotIds } } });
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

  describe('Nạp / thêm dòng tạo dòng hợp đồng (M5)', () => {
    it('nạp danh sách → mỗi trường mới trong file có đúng 1 dòng hop_dong, trạng thái mặc định', async () => {
      expect(await hopDongCua(dot.chung)).toHaveLength(0);
      const res = await nap(dot.chung, [
        dong(ids.tA, 'GV Bịa An'),
        dong(ids.tA, 'GV Bịa Bình', true),
        dong(ids.tA, 'GV Bịa Chi', true),
        dong(ids.tA, 'GV Bịa Dung', true),
        dong(ids.tB, 'GV Bịa Em'),
      ]);
      expect(res.status).toBe(200);

      const hd = await hopDongCua(dot.chung);
      expect(hd.map((h) => h.don_vi_id).sort()).toEqual(
        [ids.tA, ids.tB].sort(),
      );
      for (const h of hd) {
        expect(h.trang_thai_danh_sach).toBe('cho_xac_nhan');
        expect(h.trang_thai_hop_dong).toBe('chua_nop');
        // Issue #61 / X1: nạp là thao tác của Quản trị → người thao tác cuối.
        expect(h.thao_tac_cuoi_boi).toBe(nguoiDung[0].nguoiDung.id);
        expect(h.thao_tac_cuoi_luc).toBeInstanceOf(Date);
      }

      expect((await nap(dot.chiB, [dong(ids.tB, 'GV Bịa Giang')])).status).toBe(
        200,
      );
      expect(
        (await nap(dot.khongGia, [dong(ids.tA, 'GV Bịa Hà', true)])).status,
      ).toBe(200);
    });

    it('nạp lại cùng trường không nhân đôi dòng hop_dong', async () => {
      const res = await nap(dot.chiB, [
        dong(ids.tB, 'GV Bịa Giang'),
        dong(ids.tB, 'GV Bịa Khoa', true),
      ]);
      expect(res.status).toBe(200);
      const hd = await hopDongCua(dot.chiB);
      expect(hd).toHaveLength(1);
      expect(hd[0].don_vi_id).toBe(ids.tB);
    });

    it('thêm dòng cho trường chưa có danh sách → tạo dòng hop_dong của trường đó', async () => {
      expect(
        (await hopDongCua(dot.chung)).some((h) => h.don_vi_id === ids.tC),
      ).toBe(false);
      const res = await http()
        .post(urlQt(dot.chung, 'danh-sach'))
        .set(auth(token.quanTri))
        .send({ ...dong(ids.tC, 'GV Bịa Lan'), ly_do: 'Bổ sung (bịa)' });
      expect(res.status).toBe(201);
      const cuaC = (await hopDongCua(dot.chung)).filter(
        (h) => h.don_vi_id === ids.tC,
      );
      expect(cuaC).toHaveLength(1);
    });

    it('thêm dòng cho trường đã có hop_dong → không tạo thêm dòng; danh sách về Chờ xác nhận (X1, issue #61)', async () => {
      await prisma.hop_dong_boi_duong.update({
        where: {
          dot_trien_khai_id_don_vi_id: {
            dot_trien_khai_id: dot.chung,
            don_vi_id: ids.tC,
          },
        },
        data: { trang_thai_danh_sach: 'da_xac_nhan' },
      });
      const res = await http()
        .post(urlQt(dot.chung, 'danh-sach'))
        .set(auth(token.quanTri))
        .send({ ...dong(ids.tC, 'GV Bịa Minh'), ly_do: 'Bổ sung (bịa)' });
      expect(res.status).toBe(201);
      const cuaC = (await hopDongCua(dot.chung)).filter(
        (h) => h.don_vi_id === ids.tC,
      );
      expect(cuaC).toHaveLength(1);
      expect(cuaC[0].trang_thai_danh_sach).toBe('cho_xac_nhan');
    });
  });

  describe('Phân quyền', () => {
    it('401 khi không có token', async () => {
      await http().get(URL_DOT).expect(401);
      await http().get(urlDs(dot.chung)).expect(401);
    });

    it.each(['quanTri', 'so', 'hocVien'] as const)(
      '403 với vai trò %s trên cả 2 endpoint',
      async (vaiTro) => {
        await http().get(URL_DOT).set(auth(token[vaiTro])).expect(403);
        await http().get(urlDs(dot.chung)).set(auth(token[vaiTro])).expect(403);
      },
    );
  });

  describe('GET /cong-don-vi/truong/dot', () => {
    it('trường A chỉ thấy đợt của mình (không thấy đợt chỉ B có), hạn nộp sớm trước', async () => {
      const res = await http()
        .get(URL_DOT)
        .set(auth(token.truongA))
        .expect(200);
      expect(res.body.map((t: { dot: { id: string } }) => t.dot.id)).toEqual([
        dot.khongGia,
        dot.chung,
      ]);
    });

    it('thẻ đợt: số người, tổng suất có 0,5 chính xác, giá trị làm tròn đến đồng, trạng thái', async () => {
      const res = await http()
        .get(URL_DOT)
        .set(auth(token.truongA))
        .expect(200);
      const the = res.body.find(
        (t: { dot: { id: string } }) => t.dot.id === dot.chung,
      );
      expect(the).toEqual({
        dot: {
          id: dot.chung,
          ten: `HSG chung ${suf}`,
          chuong_trinh: 'hsg',
          han_nop: '2026-12-20T16:59:59.000Z',
          han_nop_ngay: '2026-12-20',
        },
        so_nguoi: 4,
        tong_suat: 2.5,
        don_gia: 1_234_567,
        // 2,5 × 1.234.567 = 3.086.417,5 → làm tròn nửa lên
        gia_tri_tam_tinh: 3_086_418,
        trang_thai_danh_sach: 'cho_xac_nhan',
        trang_thai_hop_dong: 'chua_nop',
      });
    });

    it('đợt chưa có đơn giá → don_gia và gia_tri_tam_tinh null', async () => {
      const res = await http()
        .get(URL_DOT)
        .set(auth(token.truongA))
        .expect(200);
      const the = res.body.find(
        (t: { dot: { id: string } }) => t.dot.id === dot.khongGia,
      );
      expect(the).toMatchObject({
        so_nguoi: 1,
        tong_suat: 0.5,
        don_gia: null,
        gia_tri_tam_tinh: null,
      });
    });

    it('trường B thấy 2 đợt của B với số liệu của riêng B', async () => {
      const res = await http()
        .get(URL_DOT)
        .set(auth(token.truongB))
        .expect(200);
      expect(
        res.body.map((t: { dot: { id: string }; so_nguoi: number }) => [
          t.dot.id,
          t.so_nguoi,
        ]),
      ).toEqual([
        [dot.chung, 1],
        [dot.chiB, 2],
      ]);
    });

    it('trường C (thêm dòng lẻ) thấy đợt chung với 2 người', async () => {
      const res = await http()
        .get(URL_DOT)
        .set(auth(token.truongC))
        .expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({
        dot: { id: dot.chung },
        so_nguoi: 2,
        tong_suat: 2,
        gia_tri_tam_tinh: 2_469_134,
        trang_thai_danh_sach: 'cho_xac_nhan',
      });
    });
  });

  describe('GET /cong-don-vi/truong/dot/:dotId/danh-sach', () => {
    it('trường A chỉ nhận dòng của A, đủ cột X6, tổng suất + giá trị', async () => {
      const res = await http()
        .get(urlDs(dot.chung))
        .set(auth(token.truongA))
        .expect(200);
      expect(res.body.dong).toHaveLength(4);
      expect(
        res.body.dong.every((d: { ho_ten: string }) =>
          /An|Bình|Chi|Dung/.test(d.ho_ten),
        ),
      ).toBe(true);
      expect(Object.keys(res.body.dong[0]).sort()).toEqual(
        [
          'ghi_chu',
          'giai_doan',
          'gioi_tinh',
          'ho_ten',
          'id',
          'lop',
          'ngay_sinh',
          'ty_le_suat',
          'y_kien_truong',
        ].sort(),
      );
      const binh = res.body.dong.find((d: { ho_ten: string }) =>
        d.ho_ten.startsWith('GV Bịa Bình'),
      );
      expect(binh).toMatchObject({
        ngay_sinh: '1990-02-01',
        lop: 'Toán 9',
        giai_doan: 'chi_gd1',
        ty_le_suat: 0.5,
        ghi_chu: 'chỉ học GĐ1 (bịa)',
      });
      expect(res.body).toMatchObject({
        dot: { id: dot.chung, chuong_trinh: 'hsg', han_nop_ngay: '2026-12-20' },
        tong_suat: 2.5,
        don_gia: 1_234_567,
        gia_tri_tam_tinh: 3_086_418,
        trang_thai_danh_sach: 'cho_xac_nhan',
        co_the_xac_nhan: false,
        ly_do_khong_xac_nhan: 'Còn 4 dòng chưa Đồng ý',
      });
      expect(binh.y_kien_truong).toBeNull();
    });

    it('đợt chưa có đơn giá → gia_tri_tam_tinh null', async () => {
      const res = await http()
        .get(urlDs(dot.khongGia))
        .set(auth(token.truongA))
        .expect(200);
      expect(res.body).toMatchObject({
        tong_suat: 0.5,
        don_gia: null,
        gia_tri_tam_tinh: null,
      });
    });

    it('trường A đọc đợt chỉ B có → 404, không lộ dữ liệu của B', async () => {
      const res = await http()
        .get(urlDs(dot.chiB))
        .set(auth(token.truongA))
        .expect(404);
      expect(JSON.stringify(res.body)).not.toContain('Giang');
      expect(res.body.error.message).toBe(
        'Không tìm thấy danh sách của trường cho đợt này',
      );
    });

    it('đợt không tồn tại → 404; id không phải UUID → 400', async () => {
      await http()
        .get(urlDs(randomUUID()))
        .set(auth(token.truongA))
        .expect(404);
      await http()
        .get(urlDs('khong-phai-uuid'))
        .set(auth(token.truongA))
        .expect(400);
    });
  });
});
