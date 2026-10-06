import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoDonViTest,
  taoNguoiDungTest,
  uniqueSuffix,
  xoaNguoiDungTest,
  xoaDonViTest,
} from './utils/test-data';

// ADR 0004 L1 (issue #14): tài khoản ho_tro_giang_vien + nhóm hỗ trợ GV theo
// khóa + phạm vi lớp. Kịch bản K1, K2, K24 của đặc tả.
describe('Người hỗ trợ giảng viên — L1 (e2e)', () => {
  let app: INestApplication;
  const suf = uniqueSuffix();
  const MIEN = `${suf}@htgv.vn`;
  let dv: Awaited<ReturnType<typeof taoDonViTest>>;
  let quanTri: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let truong: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let tokenQT: string;
  let tokenTruong: string;
  const nguoiDungIds: string[] = [];
  const khoaIds: string[] = [];
  const lopA: string[] = [];
  const lopB: string[] = [];

  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const dangNhap = async (ten: string, mk: string) =>
    (
      await http()
        .post('/auth/dang-nhap')
        .send({ ten_dang_nhap: ten, mat_khau: mk })
        .expect(200)
    ).body.token as string;

  async function taoKhoaCoLop(nhan: string, dsLop: string[]) {
    const khoa = await prisma.khoa_boi_duong.create({
      data: {
        ma_khoa: `K-HTGV${nhan}-${suf}`.slice(0, 30),
        ten_khoa: `Khóa ${nhan}`,
        don_vi_dat_hang_id: dv.donVi.id,
        thoi_gian_bat_dau: new Date('2026-11-01'),
        thoi_gian_ket_thuc: new Date('2026-12-01'),
        trang_thai: 'da_duyet',
      },
    });
    khoaIds.push(khoa.id);
    for (const ten of [`Lớp ${nhan}1`, `Lớp ${nhan}2`]) {
      const lop = await prisma.lop_hoc.create({
        data: { khoa_id: khoa.id, loai_lop: 'truc_tiep', ten_lop: ten },
      });
      dsLop.push(lop.id);
    }
    return khoa;
  }

  // Tài khoản người hỗ trợ đã đổi mật khẩu — dùng gọi API trực tiếp.
  async function taoHoTroSanSang(
    vaiTro: 'ho_tro_giang_vien' | 'ho_tro_hoc_vien',
    ten: string,
  ) {
    const nd = await prisma.nguoi_dung.create({
      data: {
        ho_ten: ten,
        ten_dang_nhap: `${ten}-${suf}`.toLowerCase(),
        email: `${ten}-${MIEN}`.toLowerCase(),
        vai_tro: vaiTro,
        mat_khau_hash: await bcrypt.hash('MatKhau123', 4),
        phai_doi_mat_khau: false,
      },
    });
    nguoiDungIds.push(nd.id);
    return { nd, token: await dangNhap(nd.ten_dang_nhap, 'MatKhau123') };
  }

  let khoaA: { id: string };
  let khoaB: { id: string };
  let hoTroGv: Awaited<ReturnType<typeof taoHoTroSanSang>>;
  let hoTroHv: Awaited<ReturnType<typeof taoHoTroSanSang>>;

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    dv = await taoDonViTest('htgv');
    quanTri = await taoNguoiDungTest({
      vai_tro: 'quan_tri',
      don_vi_id: dv.donVi.id,
      mat_khau: 'MatKhau123',
    });
    truong = await taoNguoiDungTest({
      vai_tro: 'truong',
      don_vi_id: dv.donVi.id,
      mat_khau: 'MatKhau123',
    });
    tokenQT = await dangNhap(quanTri.ten_dang_nhap, 'MatKhau123');
    tokenTruong = await dangNhap(truong.ten_dang_nhap, 'MatKhau123');
    khoaA = await taoKhoaCoLop('A', lopA);
    khoaB = await taoKhoaCoLop('B', lopB);
    hoTroGv = await taoHoTroSanSang('ho_tro_giang_vien', 'htgv1');
    hoTroHv = await taoHoTroSanSang('ho_tro_hoc_vien', 'hthv1');
  });

  afterAll(async () => {
    const ids = [...new Set(nguoiDungIds)];
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
    await prisma.khoa_boi_duong.deleteMany({ where: { id: { in: khoaIds } } });
    for (const id of ids) await xoaNguoiDungTest(id);
    await xoaNguoiDungTest(quanTri.nguoiDung.id);
    await xoaNguoiDungTest(truong.nguoiDung.id);
    await xoaDonViTest([dv.donVi.id], [dv.diaDanhXa.id, dv.diaDanhTinh.id]);
    await prisma.$disconnect();
    await app.close();
  });

  describe('Tài khoản', () => {
    it('Quản trị tạo tài khoản vai_tro=ho_tro_giang_vien; danh sách mặc định (hỗ trợ học viên) không lẫn', async () => {
      const res = await http()
        .post('/nguoi-dung/ho-tro')
        .set(auth(tokenQT))
        .send({
          ho_ten: 'Cán bộ GV',
          email: `canbo-${MIEN}`,
          vai_tro: 'ho_tro_giang_vien',
          cach_cap: 'mat_khau_tam',
        })
        .expect(201);
      nguoiDungIds.push(res.body.tai_khoan.id);
      expect(res.body.tai_khoan.vai_tro).toBe('ho_tro_giang_vien');
      expect(res.body.tai_khoan.khoa).toEqual([]);

      const macDinh = await http()
        .get('/nguoi-dung/ho-tro')
        .query({ page_size: 200 })
        .set(auth(tokenQT))
        .expect(200);
      expect(
        macDinh.body.data.some(
          (t: { id: string }) => t.id === res.body.tai_khoan.id,
        ),
      ).toBe(false);
      const loaiGv = await http()
        .get('/nguoi-dung/ho-tro')
        .query({ vai_tro: 'ho_tro_giang_vien', page_size: 200 })
        .set(auth(tokenQT))
        .expect(200);
      expect(
        loaiGv.body.data.some(
          (t: { id: string }) => t.id === res.body.tai_khoan.id,
        ),
      ).toBe(true);
    });

    it('CHECK: ho_tro_giang_vien gắn đơn vị hoặc thiếu email → DB chặn', async () => {
      await expect(
        prisma.nguoi_dung.create({
          data: {
            ho_ten: 'Sai',
            ten_dang_nhap: `sai1-${suf}`,
            email: `sai1-${MIEN}`,
            vai_tro: 'ho_tro_giang_vien',
            don_vi_id: dv.donVi.id,
            mat_khau_hash: 'x',
          },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.nguoi_dung.create({
          data: {
            ho_ten: 'Sai',
            ten_dang_nhap: `sai2-${suf}`,
            vai_tro: 'ho_tro_giang_vien',
            mat_khau_hash: 'x',
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('Nhóm hỗ trợ GV theo khóa + phạm vi lớp', () => {
    it('phân công tài khoản hỗ trợ HỌC VIÊN vào nhóm GV → 400; Trường gọi → 403', async () => {
      await http()
        .put(`/khoa-boi-duong/${khoaA.id}/nhom-ho-tro-gv`)
        .set(auth(tokenQT))
        .send({ nguoi_dung_ids: [hoTroHv.nd.id] })
        .expect(400);
      await http()
        .put(`/khoa-boi-duong/${khoaA.id}/nhom-ho-tro-gv`)
        .set(auth(tokenTruong))
        .send({ nguoi_dung_ids: [hoTroGv.nd.id] })
        .expect(403);
    });

    it('chưa có phân công → danh sách lớp rỗng (không lỗi)', async () => {
      const res = await http()
        .get('/ho-tro-giang-vien/lop-cua-toi')
        .set(auth(hoTroGv.token))
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it('K1: gán vào khóa A → thấy đúng 2 lớp của A, không thấy lớp khóa B; chi tiết khóa (QT) có nhom_ho_tro_gv', async () => {
      const gan = await http()
        .put(`/khoa-boi-duong/${khoaA.id}/nhom-ho-tro-gv`)
        .set(auth(tokenQT))
        .send({ nguoi_dung_ids: [hoTroGv.nd.id] })
        .expect(200);
      expect(gan.body.nhom_ho_tro_gv).toEqual([
        { id: hoTroGv.nd.id, ho_ten: 'htgv1' },
      ]);
      const res = await http()
        .get('/ho-tro-giang-vien/lop-cua-toi')
        .set(auth(hoTroGv.token))
        .expect(200);
      const ids = res.body.map((l: { id: string }) => l.id).sort();
      expect(ids).toEqual([...lopA].sort());
      const chiTiet = await http()
        .get(`/khoa-boi-duong/${khoaA.id}`)
        .set(auth(tokenQT))
        .expect(200);
      expect(chiTiet.body.nhom_ho_tro_gv).toHaveLength(1);
    });

    it('K2: gỡ khỏi nhóm khi đang đăng nhập → request kế tiếp không còn lớp nào', async () => {
      await http()
        .put(`/khoa-boi-duong/${khoaA.id}/nhom-ho-tro-gv`)
        .set(auth(tokenQT))
        .send({ nguoi_dung_ids: [] })
        .expect(200);
      const res = await http()
        .get('/ho-tro-giang-vien/lop-cua-toi')
        .set(auth(hoTroGv.token))
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it('K24: Trường và người hỗ trợ học viên gọi /ho-tro-giang-vien/* → 403', async () => {
      await http()
        .get('/ho-tro-giang-vien/lop-cua-toi')
        .set(auth(tokenTruong))
        .expect(403);
      await http()
        .get('/ho-tro-giang-vien/lop-cua-toi')
        .set(auth(hoTroHv.token))
        .expect(403);
    });

    it('người hỗ trợ giảng viên không vào được khu hỗ trợ học viên', async () => {
      await http()
        .get('/ho-tro-hoc-vien/cum-cua-toi')
        .set(auth(hoTroGv.token))
        .expect(403);
    });
  });
});
