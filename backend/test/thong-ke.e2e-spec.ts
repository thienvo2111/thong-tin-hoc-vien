import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoNguoiDungTest,
  uniqueSuffix,
  xoaNguoiDungTest,
} from './utils/test-data';

// Dashboard thống kê: phạm vi theo vai trò + số liệu thật trên Postgres dev.
// Fixture: Sở -> Phòng -> {T1 (6 HV), T2 (5), T3 (3)}; Sở -> Khác (5).
// Khóa A do Phòng đặt (14 HV của T1/T2/T3); khóa B do Khác đặt (5 HV của
// Khác + 1 HV của T1 cũng học A). Mọi assertion đều lọc bằng khóa/đơn vị
// fixture để không phụ thuộc dữ liệu khác trong DB.
describe('Thống kê dashboard (e2e)', () => {
  let app: INestApplication;
  const suf = uniqueSuffix();
  const SUF = suf.toUpperCase();
  const diaDanhIds: string[] = [];
  const donViIds: string[] = [];
  const nguoiDungIds: string[] = [];
  const hocVienIds: string[] = [];
  const khoaIds: string[] = [];

  const dv = {} as Record<'so' | 'phong' | 't1' | 't2' | 't3' | 'khac', string>;
  const tok = {} as Record<
    'quanTri' | 'truong1' | 'phong' | 'hoTro' | 'hocVien',
    string
  >;
  let khoaA: string;
  let khoaB: string;
  let cumC1: string;
  let cumC2: string;

  const http = () => request(app.getHttpServer());
  const get = (path: string, t: string) =>
    http()
      .get(path)
      .set({ Authorization: `Bearer ${t}` });
  const dangNhap = async (ten: string, mk: string) =>
    (
      await http()
        .post('/auth/dang-nhap')
        .send({ ten_dang_nhap: ten, mat_khau: mk })
        .expect(200)
    ).body.token as string;

  async function taoDonVi(
    nhan: string,
    loai: 'so_gddt' | 'phong_vhxh' | 'truong',
    xaId: string,
    cha?: string,
  ) {
    const d = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-tk-${nhan}-${suf}`,
        ten_don_vi: `Đơn vị TK ${nhan} ${suf}`,
        loai_don_vi: loai,
        dia_ban_id: xaId,
        don_vi_cha_id: cha,
      },
    });
    donViIds.push(d.id);
    return d.id;
  }

  async function taoHocVien(nhan: string, donViId: string, daDangNhap = false) {
    const h = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: `TK-${nhan}-${SUF}`,
        ho_ten: `HV TK ${nhan}`,
        ngay_sinh: 2,
        thang_sinh: 3,
        nam_sinh: 1988,
        don_vi_cong_tac_id: donViId,
        so_dien_thoai_lien_he: '0912345678',
      },
    });
    hocVienIds.push(h.id);
    const nd = await prisma.nguoi_dung.create({
      data: {
        ho_ten: h.ho_ten,
        ten_dang_nhap: `TK-${nhan}-${SUF}`,
        vai_tro: 'hoc_vien',
        hoc_vien_id: h.id,
        mat_khau_hash: 'x',
        dang_nhap_lan_cuoi: daDangNhap ? new Date() : null,
      },
    });
    nguoiDungIds.push(nd.id);
    return h.id;
  }

  async function taoKhoa(nhan: string, donViDatHang: string) {
    const k = await prisma.khoa_boi_duong.create({
      data: {
        ma_khoa: `K-TK${nhan}-${SUF}`,
        ten_khoa: `Khóa TK ${nhan} ${suf}`,
        don_vi_dat_hang_id: donViDatHang,
        thoi_gian_bat_dau: new Date('2026-10-01'),
        thoi_gian_ket_thuc: new Date('2027-02-01'),
        trang_thai: 'da_duyet',
      },
    });
    khoaIds.push(k.id);
    return k.id;
  }

  const dangKy = (hocVienId: string, khoaId: string, cumId?: string) =>
    prisma.dang_ky_hoc.create({
      data: { hoc_vien_id: hocVienId, khoa_id: khoaId, cum_id: cumId },
    });

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    const tinh = await prisma.dia_danh.create({
      data: { ma: `T-tk-${suf}`, ten: `Tỉnh TK ${suf}`, cap: 'tinh_thanh' },
    });
    const xa = await prisma.dia_danh.create({
      data: {
        ma: `X-tk-${suf}`,
        ten: `Xã TK ${suf}`,
        cap: 'phuong_xa_dac_khu',
        parent_id: tinh.id,
      },
    });
    diaDanhIds.push(xa.id, tinh.id);

    dv.so = await taoDonVi('so', 'so_gddt', xa.id);
    dv.phong = await taoDonVi('phong', 'phong_vhxh', xa.id, dv.so);
    dv.t1 = await taoDonVi('t1', 'truong', xa.id, dv.phong);
    dv.t2 = await taoDonVi('t2', 'truong', xa.id, dv.phong);
    dv.t3 = await taoDonVi('t3', 'truong', xa.id, dv.phong);
    dv.khac = await taoDonVi('khac', 'truong', xa.id, dv.so);

    const taoTk = async (
      vai_tro: 'quan_tri' | 'truong' | 'phong_vhxh',
      donViId: string,
    ) => {
      const u = await taoNguoiDungTest({
        vai_tro,
        don_vi_id: donViId,
        mat_khau: 'MatKhau123',
      });
      nguoiDungIds.push(u.nguoiDung.id);
      return dangNhap(u.ten_dang_nhap, 'MatKhau123');
    };
    tok.quanTri = await taoTk('quan_tri', dv.t1);
    tok.truong1 = await taoTk('truong', dv.t1);
    tok.phong = await taoTk('phong_vhxh', dv.phong);

    const hoTro = await prisma.nguoi_dung.create({
      data: {
        ho_ten: 'Hỗ trợ TK',
        ten_dang_nhap: `ht-tk-${suf}`,
        email: `tk-${suf}@hthv.vn`,
        vai_tro: 'ho_tro_hoc_vien',
        mat_khau_hash: await bcrypt.hash('HoTro12345', 4),
        phai_doi_mat_khau: false,
      },
    });
    nguoiDungIds.push(hoTro.id);
    tok.hoTro = await dangNhap(hoTro.ten_dang_nhap, 'HoTro12345');

    khoaA = await taoKhoa('A', dv.phong);
    khoaB = await taoKhoa('B', dv.khac);
    cumC1 = (
      await prisma.cum_hoc_vien.create({
        data: { khoa_id: khoaA, ten_cum: 'Cụm C1' },
      })
    ).id;
    cumC2 = (
      await prisma.cum_hoc_vien.create({
        data: { khoa_id: khoaA, ten_cum: 'Cụm C2' },
      })
    ).id;
    await prisma.phan_cong_ho_tro.create({
      data: { nguoi_dung_id: hoTro.id, cum_id: cumC1 },
    });

    // Khóa A: 14 HV. Cụm C1 gồm t1-1, t1-2 (học cả B), t2-1, t3-1.
    // 3 HV của T1 đã đăng nhập.
    for (let i = 1; i <= 6; i++) {
      const id = await taoHocVien(`t1-${i}`, dv.t1, i <= 3);
      await dangKy(id, khoaA, i <= 2 ? cumC1 : cumC2);
      if (i === 2) await dangKy(id, khoaB);
    }
    let dkVangHai = '';
    let dkVangMot = '';
    for (let i = 1; i <= 5; i++) {
      const id = await taoHocVien(`t2-${i}`, dv.t2);
      const dk = await dangKy(id, khoaA, i === 1 ? cumC1 : cumC2);
      if (i === 2) dkVangHai = dk.id;
      if (i === 3) dkVangMot = dk.id;
    }
    for (let i = 1; i <= 3; i++) {
      const id = await taoHocVien(`t3-${i}`, dv.t3);
      await dangKy(id, khoaA, i === 1 ? cumC1 : cumC2);
    }
    // Tài khoản học viên thật (t1-6) để kiểm 403.
    await prisma.nguoi_dung.update({
      where: { ten_dang_nhap: `TK-t1-6-${SUF}` },
      data: { mat_khau_hash: await bcrypt.hash('HocVien12345', 4) },
    });
    tok.hocVien = await dangNhap(`TK-t1-6-${SUF}`, 'HocVien12345');
    // Khóa B: 5 HV của đơn vị Khác.
    for (let i = 1; i <= 5; i++) {
      await dangKy(await taoHocVien(`khac-${i}`, dv.khac), khoaB);
    }

    // Điểm danh: t2-2 vắng 2 buổi; t2-3 vắng 1 + vắng có phép 1.
    const gd = await prisma.giai_doan_khoa.create({
      data: {
        khoa_id: khoaA,
        thu_tu: 1,
        ten_giai_doan: 'Zoom TK',
        hinh_thuc: 'truc_tuyen',
        thoi_gian_bat_dau: new Date('2026-10-01'),
        thoi_gian_ket_thuc: new Date('2027-01-31'),
      },
    });
    const lop = await prisma.lop_hoc.create({
      data: { khoa_id: khoaA, loai_lop: 'zoom', ten_lop: 'Zoom TK' },
    });
    const lich: string[] = [];
    for (const buoi of [1, 2]) {
      const bd = new Date(Date.now() - (10 - buoi) * 24 * 3600 * 1000);
      const l = await prisma.lich_hoc_lop.create({
        data: {
          lop_id: lop.id,
          giai_doan_id: gd.id,
          buoi_so: buoi,
          thoi_gian_bat_dau: bd,
          thoi_gian_ket_thuc: new Date(bd.getTime() + 3 * 3600 * 1000),
        },
      });
      lich.push(l.id);
    }
    const diemDanh = (
      dang_ky_hoc_id: string,
      lich_hoc_id: string,
      trang_thai: 'vang' | 'vang_co_phep',
    ) => ({
      dang_ky_hoc_id,
      lich_hoc_id,
      trang_thai,
      nguon: 'thu_cong' as const,
    });
    await prisma.diem_danh.createMany({
      data: [
        diemDanh(dkVangHai, lich[0], 'vang'),
        diemDanh(dkVangHai, lich[1], 'vang'),
        diemDanh(dkVangMot, lich[0], 'vang'),
        diemDanh(dkVangMot, lich[1], 'vang_co_phep'),
      ],
    });
  });

  afterAll(async () => {
    // dang_ky_hoc cascade diem_danh; xóa khóa cascade lớp/giai đoạn/cụm.
    await prisma.dang_ky_hoc.deleteMany({
      where: { khoa_id: { in: khoaIds } },
    });
    await prisma.khoa_boi_duong.deleteMany({ where: { id: { in: khoaIds } } });
    for (const id of nguoiDungIds) await xoaNguoiDungTest(id);
    await prisma.hoc_vien.deleteMany({ where: { id: { in: hocVienIds } } });
    // Con trước cha để không vướng FK don_vi_cha_id.
    for (const id of [...donViIds].reverse()) {
      await prisma.don_vi_cong_tac.deleteMany({ where: { id } });
    }
    await prisma.dia_danh.deleteMany({ where: { id: { in: diaDanhIds } } });
    await prisma.$disconnect();
    await app.close();
  });

  describe('phễu theo vai trò', () => {
    it('quan_tri lọc theo Sở: 19 HV phân biệt (HV học 2 khóa đếm 1)', async () => {
      const res = await get(`/thong-ke/pheu?don_vi_id=${dv.so}`, tok.quanTri);
      expect(res.status).toBe(200);
      expect(res.body.tham_gia).toBe(19);
      // 3 HV seed + t1-6 vừa đăng nhập ở beforeAll.
      expect(res.body.da_truy_cap).toBe(4);
    });

    it('truong T1 xem khóa B của đơn vị khác: chỉ 1 HV của mình (R2)', async () => {
      const res = await get(`/thong-ke/pheu?khoa_id=${khoaB}`, tok.truong1);
      expect(res.status).toBe(200);
      expect(res.body.tham_gia).toBe(1);
    });

    it('phong xem khóa A do phòng đặt: toàn bộ 14 HV (R1)', async () => {
      const res = await get(`/thong-ke/pheu?khoa_id=${khoaA}`, tok.phong);
      expect(res.status).toBe(200);
      expect(res.body.tham_gia).toBe(14);
    });

    it('truong T1 lọc đơn vị T2 (ngoài phạm vi) -> 403', async () => {
      const res = await get(`/thong-ke/pheu?don_vi_id=${dv.t2}`, tok.truong1);
      expect(res.status).toBe(403);
    });

    it('truong T1 lọc theo cụm -> 400', async () => {
      const res = await get(
        `/thong-ke/pheu?khoa_id=${khoaA}&cum_id=${cumC1}`,
        tok.truong1,
      );
      expect(res.status).toBe(400);
    });

    it('ho_tro H: chỉ HV cụm C1 (4 HV)', async () => {
      const res = await get('/thong-ke/pheu', tok.hoTro);
      expect(res.status).toBe(200);
      expect(res.body.tham_gia).toBe(4);
    });

    it('ho_tro H lọc cụm không được phân công -> 403', async () => {
      const res = await get(
        `/thong-ke/pheu?khoa_id=${khoaA}&cum_id=${cumC2}`,
        tok.hoTro,
      );
      expect(res.status).toBe(403);
    });

    it('ho_tro H xem xếp hạng -> 403', async () => {
      const res = await get('/thong-ke/xep-hang?chi_so=truy_cap', tok.hoTro);
      expect(res.status).toBe(403);
    });

    it('hoc_vien gọi /thong-ke/pheu -> 403', async () => {
      const res = await get('/thong-ke/pheu', tok.hocVien);
      expect(res.status).toBe(403);
    });
  });

  describe('xếp hạng', () => {
    it('truong T1: kiểu vi_tri, tong_so = 2 (T3 < 5 HV bị loại), không lộ đơn vị khác', async () => {
      const res = await get('/thong-ke/xep-hang?chi_so=truy_cap', tok.truong1);
      expect(res.status).toBe(200);
      expect(res.body.kieu).toBe('vi_tri');
      expect(res.body.tong_so).toBe(2);
      const raw = JSON.stringify(res.body);
      for (const id of [dv.t2, dv.t3, dv.khac]) {
        expect(raw).not.toContain(id);
      }
    });

    it('phong: bảng xếp hạng trường trong cây, tong_so = 2', async () => {
      const res = await get('/thong-ke/xep-hang?chi_so=dat', tok.phong);
      expect(res.status).toBe(200);
      expect(res.body.kieu).toBe('bang');
      expect(res.body.tong_so).toBe(2);
    });
  });

  describe('cần đôn đốc', () => {
    const duongDan = (loai: string) =>
      `/thong-ke/can-don-doc?loai=${loai}&khoa_id=${khoaA}&don_vi_id=${dv.so}`;

    it('vang_nhieu: vắng đúng 2 buổi được liệt kê; 1 vắng + 1 có phép thì không', async () => {
      const res = await get(duongDan('vang_nhieu'), tok.quanTri);
      expect(res.status).toBe(200);
      expect(res.body.tong).toBe(1);
      expect(res.body.items[0].ho_ten).toBe('HV TK t2-2');
      expect(res.body.items[0].chi_tiet).toBe('Vắng 2 buổi');
    });

    it('loai không hợp lệ -> 400', async () => {
      const res = await get(duongDan('xyz'), tok.quanTri);
      expect(res.status).toBe(400);
    });

    it('xuất Excel -> 200, content-type xlsx', async () => {
      const res = await get(
        `/thong-ke/can-don-doc/xuat-excel?loai=chua_truy_cap&don_vi_id=${dv.so}`,
        tok.quanTri,
      );
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    });
  });

  describe('tiến độ theo trường', () => {
    type Dong = {
      don_vi_id: string;
      so_hv: number;
      ten_don_vi_cha: string | null;
    };
    const timDong = (body: Dong[], id: string) =>
      body.find((r) => r.don_vi_id === id);

    it('quan_tri lọc theo Sở: có T1/T2/T3/Khác với so_hv đúng', async () => {
      const res = await get(
        `/thong-ke/tien-do-truong?don_vi_id=${dv.so}`,
        tok.quanTri,
      );
      expect(res.status).toBe(200);
      const body = res.body as Dong[];
      expect(timDong(body, dv.t1)?.so_hv).toBe(6);
      expect(timDong(body, dv.t2)?.so_hv).toBe(5);
      expect(timDong(body, dv.t3)?.so_hv).toBe(3);
      expect(timDong(body, dv.khac)?.so_hv).toBe(5);
      expect(timDong(body, dv.t1)?.ten_don_vi_cha).toBe(
        `Đơn vị TK phong ${suf}`,
      );
      expect(timDong(body, dv.khac)?.ten_don_vi_cha).toBe(
        `Đơn vị TK so ${suf}`,
      );
    });

    it('phong: không có dòng của trường đơn vị khác', async () => {
      const res = await get('/thong-ke/tien-do-truong', tok.phong);
      expect(res.status).toBe(200);
      const body = res.body as Dong[];
      expect(timDong(body, dv.t1)).toBeDefined();
      expect(timDong(body, dv.khac)).toBeUndefined();
    });

    it('truong T1 -> 403', async () => {
      const res = await get('/thong-ke/tien-do-truong', tok.truong1);
      expect(res.status).toBe(403);
    });

    it('ho_tro H: chỉ trường có HV trong cụm C1, so_hv chỉ đếm cụm C1', async () => {
      const res = await get('/thong-ke/tien-do-truong', tok.hoTro);
      expect(res.status).toBe(200);
      const body = res.body as Dong[];
      expect(timDong(body, dv.t1)?.so_hv).toBe(2);
      expect(timDong(body, dv.t2)?.so_hv).toBe(1);
      expect(timDong(body, dv.t3)?.so_hv).toBe(1);
      expect(timDong(body, dv.khac)).toBeUndefined();
    });

    it('xuất Excel -> 200, content-type xlsx', async () => {
      const res = await get(
        `/thong-ke/tien-do-truong/xuat-excel?don_vi_id=${dv.so}`,
        tok.quanTri,
      );
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(res.headers['content-disposition']).toContain(
        'tien-do-theo-truong.xlsx',
      );
    });
  });
});
