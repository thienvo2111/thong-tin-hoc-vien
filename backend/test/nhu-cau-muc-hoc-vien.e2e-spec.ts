import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import type { muc_nang_luc, trang_thai_dang_ky } from '@prisma/client';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoDonViTest,
  taoNguoiDungTest,
  uniqueSuffix,
  xoaNguoiDungTest,
  xoaDonViTest,
} from './utils/test-data';

const H = 60 * 60 * 1000;
const D = 24 * H;
const NAM_HOP_LE = new Date().getUTCFullYear() - 20;
const MAT_KHAU_HV = `1207${NAM_HOP_LE}`;

// Ngày @db.Date lệch so với hôm nay (UTC date part).
const ngay = (offsetDays: number) => {
  const d = new Date(Date.now() + offsetDays * D);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
};

// ADR 0013 — học viên xem/chọn nhu cầu mức học theo đợt. Không ghi đè
// dang_ky_hoc.muc_* / phan_lop_giai_doan (D1). Chạy trên DB dev: chỉ xóa theo
// id đã tạo, đúng thứ tự FK.
describe('Nhu cầu mức học - học viên (e2e)', () => {
  let app: INestApplication;
  let donViFixture: Awaited<ReturnType<typeof taoDonViTest>>;
  let quanTri: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let tokenQuanTri: string;
  let khoaId: string;
  let khoaKhacId: string;
  let gdId: string;
  let dotMoId: string;
  let dotDongId: string;
  let dotKhacId: string;
  const lop: Record<muc_nang_luc, string> = {} as Record<muc_nang_luc, string>;

  const khoaIds: string[] = [];
  const dotIds: string[] = [];
  const gdIds: string[] = [];
  const lopIds: string[] = [];
  const hocVienIds: string[] = [];
  const nguoiDungIds: string[] = [];
  const dangKyIds: string[] = [];
  const nhatKyXoaIds: string[] = [];

  const http = () => request(app.getHttpServer());

  async function dangNhap(ten_dang_nhap: string, mat_khau: string) {
    const res = await http()
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap, mat_khau })
      .expect(200);
    return res.body.token as string;
  }

  async function taoKhoa() {
    const suf = uniqueSuffix();
    const khoa = await prisma.khoa_boi_duong.create({
      data: {
        ma_khoa: `KHOA-NCHV-${suf}`,
        ten_khoa: `Khóa nhu cầu HV ${suf}`,
        don_vi_dat_hang_id: donViFixture.donVi.id,
        thoi_gian_bat_dau: new Date(),
        thoi_gian_ket_thuc: new Date(Date.now() + 30 * D),
        trang_thai: 'da_duyet',
        created_by: quanTri.nguoiDung.id,
        nguoi_duyet_id: quanTri.nguoiDung.id,
        cap_duyet_thuc_te: 'quan_tri',
        ngay_duyet: new Date(),
      },
    });
    khoaIds.push(khoa.id);
    return khoa.id;
  }

  async function taoDot(khoa: string, moOff: number, dongOff: number) {
    const dot = await prisma.dot_nhu_cau_muc.create({
      data: {
        khoa_id: khoa,
        ten_dot: `Đợt NCHV ${uniqueSuffix()}`,
        mo_luc: new Date(Date.now() + moOff),
        dong_luc: new Date(Date.now() + dongOff),
      },
    });
    dotIds.push(dot.id);
    return dot.id;
  }

  type TuyChon = {
    lopMuc?: muc_nang_luc | null;
    mucDauVao?: muc_nang_luc | null;
    doiTuong?: 'giao_vien' | 'nhan_vien' | null;
    trangThai?: trang_thai_dang_ky;
  };

  async function taoHocVien(opts: TuyChon = {}) {
    const suf = uniqueSuffix();
    const tenDangNhap = `MOET-NCHV-${suf}`;
    const hocVien = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: tenDangNhap,
        ho_ten: 'Học Viên Nhu Cầu Mức',
        ngay_sinh: 12,
        thang_sinh: 7,
        nam_sinh: NAM_HOP_LE,
        don_vi_cong_tac_id: donViFixture.donVi.id,
        so_dien_thoai_lien_he: '0900000002',
        doi_tuong: opts.doiTuong ?? null,
      },
    });
    hocVienIds.push(hocVien.id);
    const nguoiDung = await prisma.nguoi_dung.create({
      data: {
        ho_ten: hocVien.ho_ten,
        ten_dang_nhap: tenDangNhap,
        vai_tro: 'hoc_vien',
        hoc_vien_id: hocVien.id,
        mat_khau_hash: await bcrypt.hash(MAT_KHAU_HV, 4),
        phai_doi_mat_khau: false,
      },
    });
    nguoiDungIds.push(nguoiDung.id);
    const dangKy = await prisma.dang_ky_hoc.create({
      data: {
        hoc_vien_id: hocVien.id,
        khoa_id: khoaId,
        trang_thai: opts.trangThai ?? 'da_duyet',
        muc_dau_vao: opts.mucDauVao ?? null,
      },
    });
    dangKyIds.push(dangKy.id);
    const lopMuc = opts.lopMuc === undefined ? 'nang_cao' : opts.lopMuc;
    if (lopMuc) {
      await prisma.phan_lop_giai_doan.create({
        data: {
          dang_ky_hoc_id: dangKy.id,
          giai_doan_id: gdId,
          lop_id: lop[lopMuc],
        },
      });
    }
    const token = await dangNhap(tenDangNhap, MAT_KHAU_HV);
    return { hocVien, tenDangNhap, token, dangKy };
  }

  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
  const layDs = (t: string) =>
    http().get('/hoc-vien/toi/nhu-cau-muc').set(bearer(t));
  const layDot = (t: string, dot = dotMoId) =>
    http().get(`/hoc-vien/toi/nhu-cau-muc/${dot}`).set(bearer(t));
  const chon = (t: string, muc: string, dot = dotMoId) =>
    http().put(`/hoc-vien/toi/nhu-cau-muc/${dot}`).set(bearer(t)).send({ muc });
  const demDong = (dangKyId: string) =>
    prisma.nhu_cau_muc_hoc_vien.count({ where: { dang_ky_hoc_id: dangKyId } });

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    donViFixture = await taoDonViTest('nchv');
    quanTri = await taoNguoiDungTest({
      vai_tro: 'quan_tri',
      don_vi_id: donViFixture.donVi.id,
      mat_khau: 'MatKhau123',
    });
    tokenQuanTri = await dangNhap(quanTri.ten_dang_nhap, 'MatKhau123');
    khoaId = await taoKhoa();
    khoaKhacId = await taoKhoa();
    const gd = await prisma.giai_doan_khoa.create({
      data: {
        khoa_id: khoaId,
        thu_tu: 1,
        ten_giai_doan: 'Giai đoạn 1',
        hinh_thuc: 'truc_tiep',
        thoi_gian_bat_dau: ngay(-5),
        thoi_gian_ket_thuc: ngay(5),
      },
    });
    gdId = gd.id;
    gdIds.push(gd.id);
    for (const muc of ['co_ban', 'thanh_thao', 'nang_cao'] as muc_nang_luc[]) {
      const l = await prisma.lop_hoc.create({
        data: {
          khoa_id: khoaId,
          loai_lop: 'truc_tiep',
          ten_lop: `Lớp ${muc} ${uniqueSuffix()}`,
          muc_nang_luc: muc,
        },
      });
      lop[muc] = l.id;
      lopIds.push(l.id);
    }
    dotMoId = await taoDot(khoaId, -1 * D, 1 * D);
    dotDongId = await taoDot(khoaId, -5 * D, -3 * D);
    dotKhacId = await taoDot(khoaKhacId, -1 * D, 1 * D);
  });

  afterAll(async () => {
    // Mỗi bước độc lập: 1 bước lỗi không bỏ qua các bước sau.
    const buoc = async (ten: string, fn: () => Promise<unknown>) => {
      try {
        await fn();
      } catch (e) {
        console.error(`[cleanup nhu-cau-muc-hoc-vien] ${ten} lỗi:`, e);
      }
    };
    await buoc('nhu_cau_muc_hoc_vien', () =>
      prisma.nhu_cau_muc_hoc_vien.deleteMany({
        where: {
          OR: [
            { dot_id: { in: dotIds } },
            { dang_ky_hoc_id: { in: dangKyIds } },
          ],
        },
      }),
    );
    await buoc('dot_nhu_cau_muc', () =>
      prisma.dot_nhu_cau_muc.deleteMany({ where: { id: { in: dotIds } } }),
    );
    await buoc('phan_lop_giai_doan', () =>
      prisma.phan_lop_giai_doan.deleteMany({
        where: { dang_ky_hoc_id: { in: dangKyIds } },
      }),
    );
    await buoc('dang_ky_hoc', () =>
      prisma.dang_ky_hoc.deleteMany({ where: { id: { in: dangKyIds } } }),
    );
    await buoc('lop_hoc', () =>
      prisma.lop_hoc.deleteMany({ where: { id: { in: lopIds } } }),
    );
    await buoc('giai_doan_khoa', () =>
      prisma.giai_doan_khoa.deleteMany({ where: { id: { in: gdIds } } }),
    );
    await buoc('nguoi_dung hoc vien', async () => {
      for (const id of nguoiDungIds) await xoaNguoiDungTest(id);
    });
    await buoc('hoc_vien', () =>
      prisma.hoc_vien.deleteMany({ where: { id: { in: hocVienIds } } }),
    );
    await buoc('khoa_boi_duong', () =>
      prisma.khoa_boi_duong.deleteMany({ where: { id: { in: khoaIds } } }),
    );
    await buoc('nhat_ky_xoa_hoc_vien', () =>
      prisma.nhat_ky_xoa_hoc_vien.deleteMany({
        where: { id: { in: nhatKyXoaIds } },
      }),
    );
    await buoc('quan_tri', () => xoaNguoiDungTest(quanTri.nguoiDung.id));
    await buoc('don_vi', () =>
      xoaDonViTest(
        [donViFixture.donVi.id],
        [donViFixture.diaDanhXa.id, donViFixture.diaDanhTinh.id],
      ),
    );
    await prisma.$disconnect();
    await app.close();
  });

  it('lớp nâng cao, đợt mở: list 1 phần tử, 3 mức; PUT co_ban lưu lựa chọn', async () => {
    const { token, dangKy } = await taoHocVien({ lopMuc: 'nang_cao' });
    const ds = await layDs(token).expect(200);
    expect(ds.body).toHaveLength(1);
    expect(ds.body[0]).toMatchObject({
      dot: { id: dotMoId, trang_thai: 'dang_mo' },
      khoa: { id: khoaId },
      du_dieu_kien: true,
      ly_do_khong_du: null,
      moc: {
        muc: 'nang_cao',
        nguon: 'lop',
        lop: { id: lop.nang_cao },
        giai_doan: { id: gdId },
      },
      cac_muc_duoc_chon: ['co_ban', 'thanh_thao', 'nang_cao'],
      lua_chon: null,
    });

    const res = await chon(token, 'co_ban').expect(200);
    expect(res.body.lua_chon).toMatchObject({
      muc_chon: 'co_ban',
      muc_moc: 'nang_cao',
      nguon_moc: 'lop',
      chon_luc: expect.any(String),
      cap_nhat_luc: expect.any(String),
    });
    const row = await prisma.nhu_cau_muc_hoc_vien.findFirstOrThrow({
      where: { dang_ky_hoc_id: dangKy.id },
    });
    expect(row.lop_id_luc_chon).toBe(lop.nang_cao);
    expect(row.dot_id).toBe(dotMoId);
  });

  it('lớp thành thạo: PUT nang_cao -> 400 field muc', async () => {
    const { token, dangKy } = await taoHocVien({ lopMuc: 'thanh_thao' });
    const res = await chon(token, 'nang_cao').expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('Thành thạo');
    expect(res.body.error.fields).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'muc' })]),
    );
    expect(await demDong(dangKy.id)).toBe(0);
  });

  it('muc sai giá trị / thiếu -> 400', async () => {
    const { token } = await taoHocVien({ lopMuc: 'thanh_thao' });
    await chon(token, 'xuat_sac').expect(400);
    await http()
      .put(`/hoc-vien/toi/nhu-cau-muc/${dotMoId}`)
      .set(bearer(token))
      .send({})
      .expect(400);
  });

  it('PUT 2 lần -> 1 dòng, chon_luc giữ nguyên, cap_nhat_luc tăng', async () => {
    const { token, dangKy } = await taoHocVien({ lopMuc: 'nang_cao' });
    const r1 = await chon(token, 'thanh_thao').expect(200);
    await new Promise((r) => setTimeout(r, 30));
    const r2 = await chon(token, 'co_ban').expect(200);
    expect(await demDong(dangKy.id)).toBe(1);
    expect(r2.body.lua_chon.muc_chon).toBe('co_ban');
    expect(r2.body.lua_chon.chon_luc).toBe(r1.body.lua_chon.chon_luc);
    expect(new Date(r2.body.lua_chon.cap_nhat_luc).getTime()).toBeGreaterThan(
      new Date(r1.body.lua_chon.cap_nhat_luc).getTime(),
    );
  });

  it('2 PUT đồng thời -> 1 dòng duy nhất', async () => {
    const { token, dangKy } = await taoHocVien({ lopMuc: 'nang_cao' });
    const [a, b] = await Promise.all([
      chon(token, 'thanh_thao'),
      chon(token, 'co_ban'),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(await demDong(dangKy.id)).toBe(1);
  });

  it('mốc giảm sau khi chọn: GET giữ lựa chọn cũ, PUT lại mức cũ -> 400', async () => {
    const { token, dangKy } = await taoHocVien({ lopMuc: 'thanh_thao' });
    await chon(token, 'thanh_thao').expect(200);
    await prisma.phan_lop_giai_doan.update({
      where: {
        dang_ky_hoc_id_giai_doan_id: {
          dang_ky_hoc_id: dangKy.id,
          giai_doan_id: gdId,
        },
      },
      data: { lop_id: lop.co_ban },
    });
    const res = await layDot(token).expect(200);
    expect(res.body.lua_chon.muc_chon).toBe('thanh_thao');
    expect(res.body.moc.muc).toBe('co_ban');
    expect(res.body.cac_muc_duoc_chon).toEqual(['co_ban']);
    await chon(token, 'thanh_thao').expect(400);
  });

  it('không lớp, muc_dau_vao=thanh_thao -> mốc muc_chot', async () => {
    const { token } = await taoHocVien({
      lopMuc: null,
      mucDauVao: 'thanh_thao',
    });
    const res = await layDot(token).expect(200);
    expect(res.body.du_dieu_kien).toBe(true);
    expect(res.body.moc).toMatchObject({
      muc: 'thanh_thao',
      nguon: 'muc_chot',
      lop: null,
    });
    expect(res.body.cac_muc_duoc_chon).toEqual(['co_ban', 'thanh_thao']);
    const put = await chon(token, 'thanh_thao').expect(200);
    expect(put.body.lua_chon).toMatchObject({
      muc_moc: 'thanh_thao',
      nguon_moc: 'muc_chot',
    });
  });

  it('không lớp, không muc_dau_vao -> chua_co_moc, list rỗng, PUT 400', async () => {
    const { token, dangKy } = await taoHocVien({ lopMuc: null });
    const res = await layDot(token).expect(200);
    expect(res.body).toMatchObject({
      du_dieu_kien: false,
      ly_do_khong_du: 'chua_co_moc',
      moc: null,
      cac_muc_duoc_chon: [],
    });
    expect((await layDs(token).expect(200)).body).toEqual([]);
    const put = await chon(token, 'co_ban').expect(400);
    expect(put.body.error.code).toBe('VALIDATION_ERROR');
    expect(await demDong(dangKy.id)).toBe(0);
  });

  it('nhân viên -> list rỗng, /:dotId ly_do nhan_vien, PUT 400', async () => {
    const { token } = await taoHocVien({ doiTuong: 'nhan_vien' });
    expect((await layDs(token).expect(200)).body).toEqual([]);
    const res = await layDot(token).expect(200);
    expect(res.body).toMatchObject({
      du_dieu_kien: false,
      ly_do_khong_du: 'nhan_vien',
      cac_muc_duoc_chon: [],
    });
    await chon(token, 'co_ban').expect(400);
  });

  it('doi_tuong null / giao_vien -> được tham gia', async () => {
    for (const doiTuong of [null, 'giao_vien'] as const) {
      const { token } = await taoHocVien({ doiTuong });
      const ds = await layDs(token).expect(200);
      expect(ds.body).toHaveLength(1);
      expect(ds.body[0].du_dieu_kien).toBe(true);
    }
  });

  it('dang_ky cho_duyet -> ly_do trang_thai_dang_ky; da_phan_lop -> đủ điều kiện', async () => {
    const choDuyet = await taoHocVien({ trangThai: 'cho_duyet' });
    const res = await layDot(choDuyet.token).expect(200);
    expect(res.body).toMatchObject({
      du_dieu_kien: false,
      ly_do_khong_du: 'trang_thai_dang_ky',
    });
    expect((await layDs(choDuyet.token).expect(200)).body).toEqual([]);
    await chon(choDuyet.token, 'co_ban').expect(400);

    const daPhanLop = await taoHocVien({ trangThai: 'da_phan_lop' });
    expect((await layDs(daPhanLop.token).expect(200)).body).toHaveLength(1);
  });

  it('đợt đã đóng: PUT 403 DOT_NHU_CAU_DONG, GET trả lựa chọn cũ', async () => {
    const { token, dangKy } = await taoHocVien({ lopMuc: 'nang_cao' });
    await prisma.nhu_cau_muc_hoc_vien.create({
      data: {
        dot_id: dotDongId,
        dang_ky_hoc_id: dangKy.id,
        muc_chon: 'thanh_thao',
        muc_moc: 'nang_cao',
        nguon_moc: 'lop',
        lop_id_luc_chon: lop.nang_cao,
      },
    });
    const put = await chon(token, 'co_ban', dotDongId).expect(403);
    expect(put.body.error.code).toBe('DOT_NHU_CAU_DONG');
    const res = await layDot(token, dotDongId).expect(200);
    expect(res.body.dot.trang_thai).toBe('da_dong');
    expect(res.body.lua_chon.muc_chon).toBe('thanh_thao');
    // List chỉ có đợt đang mở.
    const ds = await layDs(token).expect(200);
    expect(ds.body.map((x: { dot: { id: string } }) => x.dot.id)).toEqual([
      dotMoId,
    ]);
  });

  it('đợt của khóa khác hoặc uuid ngẫu nhiên -> 404', async () => {
    const { token } = await taoHocVien();
    for (const dot of [dotKhacId, randomUUID()]) {
      const g = await layDot(token, dot).expect(404);
      expect(g.body.error.code).toBe('NOT_FOUND');
      expect(JSON.stringify(g.body)).not.toContain('Đợt NCHV');
      await chon(token, 'co_ban', dot).expect(404);
    }
  });

  it('vai trò khác hoc_vien -> 403', async () => {
    await http()
      .get('/hoc-vien/toi/nhu-cau-muc')
      .set(bearer(tokenQuanTri))
      .expect(403);
  });

  it('không ghi đè dang_ky_hoc.muc_* (D1)', async () => {
    const { token, dangKy } = await taoHocVien({
      lopMuc: 'nang_cao',
      mucDauVao: 'nang_cao',
    });
    await prisma.dang_ky_hoc.update({
      where: { id: dangKy.id },
      data: {
        muc_hoc_chon: 'thanh_thao',
        muc_hoc_chon_luc: new Date(Date.now() - H),
      },
    });
    const truoc = await prisma.dang_ky_hoc.findUniqueOrThrow({
      where: { id: dangKy.id },
    });
    await chon(token, 'co_ban').expect(200);
    const sau = await prisma.dang_ky_hoc.findUniqueOrThrow({
      where: { id: dangKy.id },
    });
    expect(sau.muc_hoc_chon).toBe(truoc.muc_hoc_chon);
    expect(sau.muc_hoc_chon_luc?.getTime()).toBe(
      truoc.muc_hoc_chon_luc?.getTime(),
    );
    expect(sau.muc_dau_vao).toBe(truoc.muc_dau_vao);
    const pl = await prisma.phan_lop_giai_doan.findMany({
      where: { dang_ky_hoc_id: dangKy.id },
    });
    expect(pl.map((p) => p.lop_id)).toEqual([lop.nang_cao]);
  });

  it('xóa học viên -> nhu_cau_muc_hoc_vien của học viên bị xóa (D10)', async () => {
    const { token, dangKy, hocVien, tenDangNhap } = await taoHocVien({
      lopMuc: 'nang_cao',
    });
    await chon(token, 'thanh_thao').expect(200);
    expect(await demDong(dangKy.id)).toBe(1);
    const res = await http()
      .delete(`/hoc-vien/${hocVien.id}`)
      .set(bearer(tokenQuanTri))
      .send({ ly_do: 'Test e2e nhu cầu mức', xac_nhan: tenDangNhap })
      .expect(200);
    nhatKyXoaIds.push(res.body.nhat_ky_id);
    expect(await demDong(dangKy.id)).toBe(0);
    expect(await prisma.hoc_vien.count({ where: { id: hocVien.id } })).toBe(0);
  });
});
