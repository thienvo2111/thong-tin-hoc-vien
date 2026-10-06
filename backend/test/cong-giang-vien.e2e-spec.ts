import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoDonViTest,
  uniqueSuffix,
  xoaNguoiDungTest,
  xoaDonViTest,
} from './utils/test-data';

const GIO = 3600 * 1000;
const NGAY = 24 * GIO;
const MIEN = '@cgv-e2e.vn';

// ADR 0004 L7 (issue #20): vai trò giang_vien chỉ đọc + cổng /cong-giang-vien.
describe('Cổng giảng viên — L7 (e2e)', () => {
  let app: INestApplication;
  const suf = uniqueSuffix();
  let dv: Awaited<ReturnType<typeof taoDonViTest>>;
  const nguoiDungIds: string[] = [];
  const gvIds: string[] = [];
  let khoaId: string;
  let gdId: string;
  let lopA: string;
  let lopB: string;
  let buoiA: string;
  let hvId: string;
  const gv: Record<string, string> = {};
  const tk: Record<string, string> = {};
  const sdtGoc = String(Date.now()).slice(-7);

  const http = () => request(app.getHttpServer());
  const auth = (ai: string) => ({ Authorization: `Bearer ${tk[ai]}` });

  async function dangNhap(ma: string, tenDangNhap: string) {
    tk[ma] = (
      await http()
        .post('/auth/dang-nhap')
        .send({ ten_dang_nhap: tenDangNhap, mat_khau: 'MatKhau123' })
        .expect(200)
    ).body.token;
  }

  async function taoNguoi(
    ma: string,
    vaiTro: 'quan_tri' | 'ho_tro_giang_vien',
  ) {
    const nd = await prisma.nguoi_dung.create({
      data: {
        ho_ten: `ND ${ma}`,
        ten_dang_nhap: `cgv-${ma}-${suf}`.toLowerCase(),
        email: `cgv-${ma}-${suf}${MIEN}`.toLowerCase(),
        vai_tro: vaiTro,
        mat_khau_hash: await bcrypt.hash('MatKhau123', 4),
        phai_doi_mat_khau: false,
      },
    });
    nguoiDungIds.push(nd.id);
    await dangNhap(ma, nd.ten_dang_nhap);
    return nd;
  }

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    dv = await taoDonViTest('cgv');
    khoaId = (
      await prisma.khoa_boi_duong.create({
        data: {
          ma_khoa: `CGV-${suf}`.slice(0, 30),
          ten_khoa: 'Khóa CGV',
          don_vi_dat_hang_id: dv.donVi.id,
          thoi_gian_bat_dau: new Date('2026-01-01'),
          thoi_gian_ket_thuc: new Date('2027-12-31'),
          trang_thai: 'da_duyet',
        },
      })
    ).id;
    gdId = (
      await prisma.giai_doan_khoa.create({
        data: {
          khoa_id: khoaId,
          thu_tu: 1,
          ten_giai_doan: 'Trực tiếp',
          hinh_thuc: 'truc_tiep',
          thoi_gian_bat_dau: new Date('2026-01-01'),
          thoi_gian_ket_thuc: new Date('2027-12-31'),
        },
      })
    ).id;
    const taoLop = async (ten: string) =>
      (
        await prisma.lop_hoc.create({
          data: { khoa_id: khoaId, loai_lop: 'truc_tiep', ten_lop: ten },
        })
      ).id;
    lopA = await taoLop('Lớp A');
    lopB = await taoLop('Lớp B');
    const bd = new Date(Date.now() + 5 * NGAY);
    const taoBuoi = async (lop: string) =>
      (
        await prisma.lich_hoc_lop.create({
          data: {
            lop_id: lop,
            giai_doan_id: gdId,
            buoi_so: 1,
            thoi_gian_bat_dau: bd,
            thoi_gian_ket_thuc: new Date(bd.getTime() + 3 * GIO),
          },
        })
      ).id;
    buoiA = await taoBuoi(lopA);
    const buoiB = await taoBuoi(lopB);

    const taoGv = async (ma: string, email: string | null, i: number) => {
      const g = await prisma.giang_vien.create({
        data: {
          ho_ten: `GV ${ma}`,
          so_dien_thoai: `08${i}${sdtGoc}`,
          email,
        },
      });
      gvIds.push(g.id);
      gv[ma] = g.id;
    };
    await taoGv('mot', `gv1-${suf}${MIEN}`, 1);
    await taoGv('hai', `gv2-${suf}${MIEN}`, 2);
    await taoGv('khongEmail', null, 3);
    await taoGv('ngoai', `gvx-${suf}${MIEN}`, 4);
    for (const ma of ['mot', 'hai', 'khongEmail']) {
      await prisma.phan_cong_giang_day.create({
        data: {
          lich_hoc_id: buoiA,
          giang_vien_id: gv[ma],
          vai_tro: 'giang_vien',
        },
      });
    }
    await prisma.phan_cong_giang_day.create({
      data: {
        lich_hoc_id: buoiB,
        giang_vien_id: gv.hai,
        vai_tro: 'giang_vien',
      },
    });
    for (const ma of ['mot', 'hai']) {
      await prisma.hau_can_giang_vien.create({
        data: {
          lop_id: lopA,
          giai_doan_id: gdId,
          giang_vien_id: gv[ma],
          noi_o_ten: `KS ${ma}`,
        },
      });
    }

    const hv = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: `CGV${suf}`,
        ho_ten: 'HV CGV',
        ngay_sinh: 1,
        thang_sinh: 1,
        nam_sinh: 1990,
        don_vi_cong_tac_id: dv.donVi.id,
        trang_thai: 'nhap',
        so_dien_thoai_lien_he: '0912345678',
        email_lien_he: `hv-${suf}${MIEN}`,
      },
    });
    hvId = hv.id;
    const dk = await prisma.dang_ky_hoc.create({
      data: { hoc_vien_id: hv.id, khoa_id: khoaId, trang_thai: 'da_duyet' },
    });
    await prisma.phan_lop_giai_doan.create({
      data: { dang_ky_hoc_id: dk.id, giai_doan_id: gdId, lop_id: lopA },
    });

    await taoNguoi('admin', 'quan_tri');
    const htgv = await taoNguoi('htgv', 'ho_tro_giang_vien');
    await prisma.phan_cong_ho_tro_gv.create({
      data: { nguoi_dung_id: htgv.id, khoa_id: khoaId },
    });
    await taoNguoi('htgvKhac', 'ho_tro_giang_vien');
  });

  afterAll(async () => {
    const gvNd = await prisma.nguoi_dung.findMany({
      where: { giang_vien_id: { in: gvIds } },
      select: { id: true },
    });
    const ids = [...nguoiDungIds, ...gvNd.map((n) => n.id)];
    await prisma.nhat_ky_dat_lai_mat_khau.deleteMany({
      where: {
        OR: [{ nguoi_dung_id: { in: ids } }, { thuc_hien_boi: { in: ids } }],
      },
    });
    await prisma.token_xac_thuc.deleteMany({
      where: { nguoi_dung_id: { in: ids } },
    });
    await prisma.hang_doi_email.deleteMany({
      where: { email_nguoi_nhan: { endsWith: MIEN } },
    });
    await prisma.nhat_ky_thong_bao.deleteMany({
      where: { email_nguoi_nhan: { endsWith: MIEN } },
    });
    for (const n of gvNd) await xoaNguoiDungTest(n.id);
    await prisma.dang_ky_hoc.deleteMany({ where: { khoa_id: khoaId } });
    await prisma.hoc_vien.deleteMany({ where: { id: hvId } });
    await prisma.lich_hoc_lop.deleteMany({
      where: { lop: { khoa_id: khoaId } },
    });
    await prisma.khoa_boi_duong.deleteMany({ where: { id: khoaId } });
    await prisma.giang_vien.deleteMany({ where: { id: { in: gvIds } } });
    for (const id of nguoiDungIds) await xoaNguoiDungTest(id);
    await xoaDonViTest([dv.donVi.id], [dv.diaDanhXa.id, dv.diaDanhTinh.id]);
    await prisma.$disconnect();
    await app.close();
  });

  describe('Cấp tài khoản (G8)', () => {
    it('hỗ trợ GV gửi link cho GV dạy trong khóa → tạo tài khoản giang_vien; gửi lại không tạo trùng', async () => {
      const r = await http()
        .post(`/ho-tro-giang-vien/giang-vien/${gv.mot}/gui-link-kich-hoat`)
        .set(auth('htgv'))
        .expect(200);
      expect(r.body).toMatchObject({ da_gui: true, tao_moi: true });
      const r2 = await http()
        .post(`/ho-tro-giang-vien/giang-vien/${gv.mot}/gui-link-kich-hoat`)
        .set(auth('htgv'))
        .expect(200);
      expect(r2.body.tao_moi).toBe(false);
      const nd = await prisma.nguoi_dung.findMany({
        where: { giang_vien_id: gv.mot },
      });
      expect(nd).toHaveLength(1);
      expect(nd[0]).toMatchObject({
        vai_tro: 'giang_vien',
        phai_doi_mat_khau: true,
      });
    });

    it('GV không email → 400; GV ngoài khóa / nhóm khóa khác → 404', async () => {
      await http()
        .post(
          `/ho-tro-giang-vien/giang-vien/${gv.khongEmail}/gui-link-kich-hoat`,
        )
        .set(auth('htgv'))
        .expect(400);
      await http()
        .post(`/ho-tro-giang-vien/giang-vien/${gv.ngoai}/gui-link-kich-hoat`)
        .set(auth('htgv'))
        .expect(404);
      await http()
        .post(`/ho-tro-giang-vien/giang-vien/${gv.mot}/gui-link-kich-hoat`)
        .set(auth('htgvKhac'))
        .expect(404);
    });

    it('bảng kiểm giang_vien_co_tai_khoan đọc tài khoản thật', async () => {
      const bk = await http()
        .get(`/ho-tro-giang-vien/lop/${lopA}/giai-doan/${gdId}/bang-kiem`)
        .set(auth('htgv'))
        .expect(200);
      const muc = bk.body.muc.find(
        (m: { ma_quy_tac: string }) =>
          m.ma_quy_tac === 'giang_vien_co_tai_khoan',
      );
      expect(muc.ly_do).toContain('Chưa cấp tài khoản: GV hai');
      expect(muc.ly_do).toContain('Chưa có email: GV khongEmail');
      expect(muc.ly_do).not.toContain('GV mot');
      const trang = await http()
        .get(`/ho-tro-giang-vien/lop/${lopA}/giai-doan/${gdId}`)
        .set(auth('htgv'))
        .expect(200);
      const ds = trang.body.buoi[0].giang_vien;
      expect(ds.find((g: { id: string }) => g.id === gv.mot).tai_khoan).toBe(
        'chua_kich_hoat',
      );
      expect(ds.find((g: { id: string }) => g.id === gv.hai).tai_khoan).toBe(
        'chua_co',
      );
    });
  });

  describe('Giảng viên đăng nhập (chỉ đọc)', () => {
    beforeAll(async () => {
      // Giả lập đã kích hoạt qua link: đặt mật khẩu.
      const nd = await prisma.nguoi_dung.update({
        where: { giang_vien_id: gv.mot },
        data: {
          mat_khau_hash: await bcrypt.hash('MatKhau123', 4),
          phai_doi_mat_khau: false,
        },
      });
      await dangNhap('gv', nd.ten_dang_nhap);
    });

    it('lịch dạy: buổi của mình + hậu cần của mình + nhóm hỗ trợ GV', async () => {
      const r = await http()
        .get('/cong-giang-vien/lich-day')
        .set(auth('gv'))
        .expect(200);
      expect(r.body).toHaveLength(1);
      expect(r.body[0]).toMatchObject({
        id: buoiA,
        vai_tro: 'giang_vien',
        lop: { id: lopA },
        hau_can: { noi_o_ten: 'KS mot' },
      });
      expect(
        r.body[0].giang_vien_khac
          .map((g: { ho_ten: string }) => g.ho_ten)
          .sort(),
      ).toEqual(['GV hai', 'GV khongEmail']);
      expect(r.body[0].nhom_ho_tro_gv).toEqual([
        expect.objectContaining({ ho_ten: 'ND htgv' }),
      ]);
    });

    it('K3: lớp không có buổi của mình → 404', async () => {
      await http()
        .get(`/cong-giang-vien/lop/${lopB}/giai-doan/${gdId}`)
        .set(auth('gv'))
        .expect(404);
    });

    it('K4: trang lớp không có SĐT/email học viên, không hậu cần GV khác, không liên hệ GV khác', async () => {
      const r = await http()
        .get(`/cong-giang-vien/lop/${lopA}/giai-doan/${gdId}`)
        .set(auth('gv'))
        .expect(200);
      const hv = r.body.hoc_vien[0];
      expect(hv.ho_ten).toBe('HV CGV');
      expect(hv.so_dien_thoai).toBeUndefined();
      expect(hv.email).toBeUndefined();
      expect(hv.cum).toBeUndefined();
      expect(
        r.body.hau_can.map((h: { giang_vien_id: string }) => h.giang_vien_id),
      ).toEqual([gv.mot]);
      for (const g of r.body.buoi[0].giang_vien) {
        expect(g.so_dien_thoai).toBeUndefined();
        expect(g.email).toBeUndefined();
        expect(g.tai_khoan).toBeUndefined();
      }
      expect(r.body.de_nghi_cho).toEqual([]);
    });

    it('K17: giảng viên gọi endpoint sửa/nạp → 403', async () => {
      await http()
        .patch(`/ho-tro-giang-vien/lich-hoc/${buoiA}`)
        .set(auth('gv'))
        .send({ ly_do: 'Thử sửa giờ' })
        .expect(403);
      await http()
        .put(
          `/ho-tro-giang-vien/lop/${lopA}/giai-doan/${gdId}/hau-can/${gv.mot}`,
        )
        .set(auth('gv'))
        .send({ noi_o_ten: 'X' })
        .expect(403);
      await http()
        .put(`/lop/${lopA}/lich-hoc/${buoiA}/giang-vien`)
        .set(auth('gv'))
        .send({ phan_cong: [] })
        .expect(403);
      await http()
        .post('/giang-vien')
        .set(auth('gv'))
        .send({ ho_ten: 'X', so_dien_thoai: '0900000000' })
        .expect(403);
    });

    it('K24: vai trò khác gọi /cong-giang-vien/* → 403; giảng viên gọi /ho-tro-giang-vien/* → 403', async () => {
      await http()
        .get('/cong-giang-vien/lich-day')
        .set(auth('htgv'))
        .expect(403);
      await http()
        .get('/cong-giang-vien/lich-day')
        .set(auth('admin'))
        .expect(403);
      await http()
        .get('/ho-tro-giang-vien/lop-cua-toi')
        .set(auth('gv'))
        .expect(403);
    });

    it('chỉ Quản trị khóa tài khoản; bị khóa → không đăng nhập được, hỗ trợ GV gửi link → 409', async () => {
      await http()
        .patch(`/giang-vien/${gv.mot}/tai-khoan`)
        .set(auth('htgv'))
        .send({ trang_thai: 'ngung' })
        .expect(403);
      await http()
        .patch(`/giang-vien/${gv.mot}/tai-khoan`)
        .set(auth('admin'))
        .send({ trang_thai: 'ngung' })
        .expect(200);
      const nd = await prisma.nguoi_dung.findUniqueOrThrow({
        where: { giang_vien_id: gv.mot },
      });
      const dn = await http()
        .post('/auth/dang-nhap')
        .send({ ten_dang_nhap: nd.ten_dang_nhap, mat_khau: 'MatKhau123' });
      expect(dn.status).not.toBe(200);
      await http()
        .post(`/ho-tro-giang-vien/giang-vien/${gv.mot}/gui-link-kich-hoat`)
        .set(auth('htgv'))
        .expect(409);
      const ds = await http()
        .get('/giang-vien')
        .query({ q: 'GV mot' })
        .set(auth('admin'))
        .expect(200);
      expect(ds.body.data[0].tai_khoan).toMatchObject({ trang_thai: 'ngung' });
    });
  });

  it('K25: CHECK nguoi_dung — giang_vien ⇔ giang_vien_id', async () => {
    const base = {
      ho_ten: 'Sai',
      mat_khau_hash: 'x',
      email: `sai-${suf}${MIEN}`,
    };
    await expect(
      prisma.nguoi_dung.create({
        data: { ...base, ten_dang_nhap: `sai1-${suf}`, vai_tro: 'giang_vien' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.nguoi_dung.create({
        data: {
          ...base,
          ten_dang_nhap: `sai2-${suf}`,
          vai_tro: 'ho_tro_giang_vien',
          giang_vien_id: gv.ngoai,
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.nguoi_dung.create({
        data: {
          ...base,
          email: undefined,
          ten_dang_nhap: `sai3-${suf}`,
          vai_tro: 'giang_vien',
          giang_vien_id: gv.ngoai,
        },
      }),
    ).rejects.toThrow();
  });
});
