import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import * as ExcelJS from 'exceljs';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoNguoiDungTest,
  uniqueSuffix,
  xoaNguoiDungTest,
} from './utils/test-data';

// Người hỗ trợ học viên — Lát 2 (ADR 0003 H1/H3/H5/H6, đặc tả 2026-10-06 mục
// 2): tra cứu học viên theo cụm, lịch học theo cụm, xuất danh sách.
// Kịch bản T1 (phần đọc), T2, T3, T4, T16, T19.
describe('Người hỗ trợ học viên — tra cứu theo cụm (e2e)', () => {
  let app: INestApplication;
  const suf = uniqueSuffix();
  const SUF = suf.toUpperCase();
  const diaDanhIds: string[] = [];
  const donViIds: string[] = [];
  const nguoiDungIds: string[] = [];
  const hocVienIds: string[] = [];
  const khoaIds: string[] = [];
  let donViId: string;
  let tokenQuanTri: string;
  const token: Record<'s1' | 's2' | 's3', string> = { s1: '', s2: '', s3: '' };
  const hoTroId: Record<'s1' | 's2' | 's3', string> = {
    s1: '',
    s2: '',
    s3: '',
  };
  let cumA: string;
  let cumB: string;
  let cumC: string;
  const hv: Record<'mot' | 'hai' | 'ba', string> = { mot: '', hai: '', ba: '' };
  const cccdMot = `0${Date.now()}`.slice(-12).padStart(12, '7');

  const http = () => request(app.getHttpServer());
  const dangNhap = async (ten: string, mk: string) =>
    (
      await http()
        .post('/auth/dang-nhap')
        .send({ ten_dang_nhap: ten, mat_khau: mk })
    ).body.token as string;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const get = (path: string, t: string) => http().get(path).set(auth(t));

  async function taoHoTro(nhan: 's1' | 's2' | 's3') {
    const nd = await prisma.nguoi_dung.create({
      data: {
        ho_ten: `Hỗ trợ ${nhan}`,
        ten_dang_nhap: `ht-${nhan}-${suf}`,
        email: `${nhan}-${suf}@hthv.vn`,
        vai_tro: 'ho_tro_hoc_vien',
        mat_khau_hash: await bcrypt.hash('HoTro12345', 4),
        phai_doi_mat_khau: false,
      },
    });
    nguoiDungIds.push(nd.id);
    hoTroId[nhan] = nd.id;
    token[nhan] = await dangNhap(nd.ten_dang_nhap, 'HoTro12345');
  }

  async function taoHocVien(nhan: string, hoTen: string, cccd?: string) {
    const h = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: `HT-${nhan}-${SUF}`,
        so_dinh_danh_ca_nhan: cccd,
        ho_ten: hoTen,
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
        ho_ten: hoTen,
        ten_dang_nhap: `HT-${nhan}-${SUF}`,
        vai_tro: 'hoc_vien',
        hoc_vien_id: h.id,
        mat_khau_hash: 'x',
      },
    });
    nguoiDungIds.push(nd.id);
    return h.id;
  }

  async function taoKhoa(nhan: string) {
    const khoa = await prisma.khoa_boi_duong.create({
      data: {
        ma_khoa: `K-HTHV${nhan}-${SUF}`,
        ten_khoa: `Khóa ${nhan} ${suf}`,
        don_vi_dat_hang_id: donViId,
        thoi_gian_bat_dau: new Date('2026-10-01'),
        thoi_gian_ket_thuc: new Date('2027-02-01'),
        trang_thai: 'da_duyet',
      },
    });
    khoaIds.push(khoa.id);
    return khoa.id;
  }

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    const tinh = await prisma.dia_danh.create({
      data: { ma: `T-hthv-${suf}`, ten: `Tỉnh ${suf}`, cap: 'tinh_thanh' },
    });
    const xa = await prisma.dia_danh.create({
      data: {
        ma: `X-hthv-${suf}`,
        ten: `Xã ${suf}`,
        cap: 'phuong_xa_dac_khu',
        parent_id: tinh.id,
      },
    });
    diaDanhIds.push(xa.id, tinh.id);
    const dv = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-hthv-${suf}`,
        ten_don_vi: `Trường Hỗ Trợ ${suf}`,
        loai_don_vi: 'truong',
        dia_ban_id: xa.id,
      },
    });
    donViIds.push(dv.id);
    donViId = dv.id;

    const qt = await taoNguoiDungTest({
      vai_tro: 'quan_tri',
      don_vi_id: dv.id,
      mat_khau: 'QuanTri12345',
    });
    nguoiDungIds.push(qt.nguoiDung.id);
    tokenQuanTri = await dangNhap(qt.ten_dang_nhap, 'QuanTri12345');
    await taoHoTro('s1');
    await taoHoTro('s2');
    await taoHoTro('s3');

    const k1 = await taoKhoa('1');
    const k2 = await taoKhoa('2');
    cumA = (
      await prisma.cum_hoc_vien.create({
        data: {
          khoa_id: k1,
          ten_cum: 'Cụm A',
          link_zalo: 'https://zalo.me/g/a',
        },
      })
    ).id;
    cumB = (
      await prisma.cum_hoc_vien.create({
        data: { khoa_id: k1, ten_cum: 'Cụm B' },
      })
    ).id;
    cumC = (
      await prisma.cum_hoc_vien.create({
        data: { khoa_id: k2, ten_cum: 'Cụm C' },
      })
    ).id;

    hv.mot = await taoHocVien('mot', 'Nguyễn Văn Một', cccdMot);
    hv.hai = await taoHocVien('hai', 'Trần Thị Hai');
    hv.ba = await taoHocVien('ba', 'Lê Văn Ba');
    const dkMot = await prisma.dang_ky_hoc.create({
      data: { hoc_vien_id: hv.mot, khoa_id: k1, cum_id: cumA },
    });
    await prisma.dang_ky_hoc.create({
      data: { hoc_vien_id: hv.hai, khoa_id: k1, cum_id: cumB },
    });
    // T4: học viên ba ở 2 khóa, 2 cụm (B của khóa 1, C của khóa 2).
    await prisma.dang_ky_hoc.create({
      data: { hoc_vien_id: hv.ba, khoa_id: k1, cum_id: cumB },
    });
    await prisma.dang_ky_hoc.create({
      data: { hoc_vien_id: hv.ba, khoa_id: k2, cum_id: cumC },
    });

    await prisma.phan_cong_ho_tro.createMany({
      data: [
        { nguoi_dung_id: hoTroId.s1, cum_id: cumA },
        { nguoi_dung_id: hoTroId.s2, cum_id: cumB },
      ],
    });

    // Lớp zoom của khóa 1, giai đoạn 1, 1 buổi trong 14 ngày tới; chỉ học viên một được gán.
    const gd = await prisma.giai_doan_khoa.create({
      data: {
        khoa_id: k1,
        thu_tu: 1,
        ten_giai_doan: 'Zoom – nhóm 1',
        hinh_thuc: 'truc_tuyen',
        thoi_gian_bat_dau: new Date('2026-10-01'),
        thoi_gian_ket_thuc: new Date('2027-01-31'),
      },
    });
    const lop = await prisma.lop_hoc.create({
      data: { khoa_id: k1, loai_lop: 'zoom', ten_lop: 'Zoom 01' },
    });
    await prisma.lop_hoc_nhan_su.create({
      data: {
        lop_id: lop.id,
        ho_ten: 'TS. Giảng Viên',
        vai_tro: 'giang_vien',
        so_dien_thoai: '0900000000',
      },
    });
    const batDau = new Date(Date.now() + 3 * 24 * 3600 * 1000);
    await prisma.lich_hoc_lop.create({
      data: {
        lop_id: lop.id,
        giai_doan_id: gd.id,
        buoi_so: 1,
        thoi_gian_bat_dau: batDau,
        thoi_gian_ket_thuc: new Date(batDau.getTime() + 3 * 3600 * 1000),
        dia_diem_hoac_link: 'https://zoom.us/j/123',
      },
    });
    await prisma.phan_lop_giai_doan.create({
      data: { dang_ky_hoc_id: dkMot.id, giai_doan_id: gd.id, lop_id: lop.id },
    });

    await prisma.ket_qua_khao_sat.create({
      data: {
        hoc_vien_id: hv.mot,
        loai: 'danh-gia',
        trang_thai: 'hoan_thanh',
        muc: 'thanh_thao',
        nguon: 'import',
      },
    });
  });

  afterAll(async () => {
    await prisma.phan_lop_giai_doan.deleteMany({
      where: { dang_ky_hoc: { khoa_id: { in: khoaIds } } },
    });
    await prisma.dang_ky_hoc.deleteMany({
      where: { khoa_id: { in: khoaIds } },
    });
    await prisma.khoa_boi_duong.deleteMany({ where: { id: { in: khoaIds } } });
    await prisma.ket_qua_khao_sat.deleteMany({
      where: { hoc_vien_id: { in: hocVienIds } },
    });
    for (const id of nguoiDungIds) await xoaNguoiDungTest(id);
    await prisma.hoc_vien.deleteMany({ where: { id: { in: hocVienIds } } });
    await prisma.don_vi_cong_tac.deleteMany({
      where: { id: { in: donViIds } },
    });
    await prisma.dia_danh.deleteMany({ where: { id: { in: diaDanhIds } } });
    await prisma.$disconnect();
    await app.close();
  });

  it('T19: vai trò khác ho_tro_hoc_vien gọi /ho-tro/* -> 403', async () => {
    for (const path of [
      '/ho-tro/cum-cua-toi',
      '/ho-tro/hoc-vien',
      `/ho-tro/hoc-vien/${hv.mot}`,
      '/ho-tro/lich-hoc',
    ]) {
      expect((await get(path, tokenQuanTri)).status).toBe(403);
    }
  });

  it('T2: người hỗ trợ chưa được phân công -> danh sách rỗng, không lỗi', async () => {
    const cum = await get('/ho-tro/cum-cua-toi', token.s3);
    expect(cum.status).toBe(200);
    expect(cum.body).toEqual([]);
    const ds = await get('/ho-tro/hoc-vien', token.s3);
    expect(ds.status).toBe(200);
    expect(ds.body.total).toBe(0);
    const lich = await get('/ho-tro/lich-hoc', token.s3);
    expect(lich.body).toEqual([]);
  });

  it('cụm của tôi: tên cụm, link Zalo, khóa, số học viên', async () => {
    const res = await get('/ho-tro/cum-cua-toi', token.s2);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      expect.objectContaining({
        cum_id: cumB,
        ten_cum: 'Cụm B',
        ma_khoa: `K-HTHV1-${SUF}`,
        so_hoc_vien: 2,
      }),
    ]);
  });

  describe('GET /ho-tro/hoc-vien', () => {
    it('chỉ trả học viên trong cụm của mình, kèm đơn vị, cụm, trạng thái đăng nhập, hồ sơ đầy đủ', async () => {
      const res = await get('/ho-tro/hoc-vien', token.s1);
      expect(res.status).toBe(200);
      expect(res.body.data.map((x: { id: string }) => x.id)).toEqual([hv.mot]);
      const dong = res.body.data[0];
      expect(dong).toMatchObject({
        ho_ten: 'Nguyễn Văn Một',
        ten_dang_nhap: `HT-mot-${SUF}`,
        don_vi_cong_tac_ten: `Trường Hỗ Trợ ${suf}`,
        so_dien_thoai_lien_he: '0912345678',
        dang_nhap_lan_cuoi: null,
        day_du: false,
      });
      expect(dong.cum).toEqual([{ cum_id: cumA, ten_cum: 'Cụm A' }]);
      expect(dong.khao_sat).toEqual([
        { loai: 'danh-gia', trang_thai: 'hoan_thanh', muc: 'thanh_thao' },
      ]);
    });

    it('tìm không dấu theo họ tên, theo CCCD, theo tên đăng nhập', async () => {
      const r1 = await get('/ho-tro/hoc-vien?q=van mot', token.s1);
      expect(r1.body.data.map((x: { id: string }) => x.id)).toEqual([hv.mot]);
      const r2 = await get(
        `/ho-tro/hoc-vien?q=${cccdMot.slice(2, 9)}`,
        token.s1,
      );
      expect(r2.body.total).toBe(1);
      const r3 = await get(`/ho-tro/hoc-vien?q=ht-mot-${suf}`, token.s1);
      expect(r3.body.total).toBe(1);
      const r4 = await get('/ho-tro/hoc-vien?q=tran thi hai', token.s1);
      expect(r4.body.total).toBe(0);
    });

    it('lọc theo cụm ngoài phạm vi -> 404', async () => {
      expect(
        (await get(`/ho-tro/hoc-vien?cum_id=${cumB}`, token.s1)).status,
      ).toBe(404);
      expect(
        (await get(`/ho-tro/hoc-vien?cum_id=${cumA}`, token.s1)).body.total,
      ).toBe(1);
    });

    it('lọc da_dang_nhap', async () => {
      expect(
        (await get('/ho-tro/hoc-vien?da_dang_nhap=false', token.s1)).body.total,
      ).toBe(1);
      expect(
        (await get('/ho-tro/hoc-vien?da_dang_nhap=true', token.s1)).body.total,
      ).toBe(0);
    });
  });

  describe('GET /ho-tro/hoc-vien/{id}', () => {
    it('T1: học viên ngoài cụm -> 404 (không 403, không lộ tồn tại)', async () => {
      expect((await get(`/ho-tro/hoc-vien/${hv.hai}`, token.s1)).status).toBe(
        404,
      );
    });

    it('chi tiết: hồ sơ kèm tên, tài khoản, học tập (lớp + lịch + giảng viên), khảo sát', async () => {
      const res = await get(`/ho-tro/hoc-vien/${hv.mot}`, token.s1);
      expect(res.status).toBe(200);
      expect(res.body.ho_so).toMatchObject({
        id: hv.mot,
        ho_ten: 'Nguyễn Văn Một',
        don_vi_cong_tac_ten: `Trường Hỗ Trợ ${suf}`,
      });
      expect(res.body.ho_so).toHaveProperty('day_du', false);
      expect(Array.isArray(res.body.ho_so.thieu)).toBe(true);
      expect(res.body.tai_khoan).toMatchObject({
        ten_dang_nhap: `HT-mot-${SUF}`,
        email_da_xac_minh: false,
        dang_bi_khoa: false,
        phai_doi_mat_khau: true,
      });
      expect(res.body.tai_khoan).not.toHaveProperty('mat_khau_hash');
      const dk = res.body.hoc_tap[0];
      expect(dk.cum.ten_cum).toBe('Cụm A');
      expect(dk.giai_doan[0].lop.ten_lop).toBe('Zoom 01');
      expect(dk.giai_doan[0].lop.nhan_su[0].ho_ten).toBe('TS. Giảng Viên');
      expect(dk.giai_doan[0].lop.lich_hoc[0].dia_diem_hoac_link).toBe(
        'https://zoom.us/j/123',
      );
      expect(res.body.khao_sat[0]).toMatchObject({
        loai: 'danh-gia',
        trang_thai: 'hoan_thanh',
      });
      expect(res.body).toHaveProperty('yeu_cau_ho_tro');
      expect(res.body).toHaveProperty('lich_su_thay_doi');
    });

    it('T4: học viên ở 2 cụm — người hỗ trợ của cả 2 cụm đều thấy', async () => {
      await prisma.phan_cong_ho_tro.create({
        data: { nguoi_dung_id: hoTroId.s3, cum_id: cumC },
      });
      expect((await get(`/ho-tro/hoc-vien/${hv.ba}`, token.s2)).status).toBe(
        200,
      );
      expect((await get(`/ho-tro/hoc-vien/${hv.ba}`, token.s3)).status).toBe(
        200,
      );
      const ds = await get('/ho-tro/hoc-vien', token.s3);
      expect(ds.body.data.map((x: { id: string }) => x.id)).toEqual([hv.ba]);
      await prisma.phan_cong_ho_tro.deleteMany({
        where: { nguoi_dung_id: hoTroId.s3 },
      });
    });

    it('T3: gỡ phân công khi đang đăng nhập -> request kế tiếp 404', async () => {
      expect((await get(`/ho-tro/hoc-vien/${hv.hai}`, token.s2)).status).toBe(
        200,
      );
      await prisma.phan_cong_ho_tro.deleteMany({
        where: { nguoi_dung_id: hoTroId.s2 },
      });
      expect((await get(`/ho-tro/hoc-vien/${hv.hai}`, token.s2)).status).toBe(
        404,
      );
      await prisma.phan_cong_ho_tro.create({
        data: { nguoi_dung_id: hoTroId.s2, cum_id: cumB },
      });
    });
  });

  describe('GET /ho-tro/lich-hoc', () => {
    it('buổi sắp tới của lớp có học viên trong cụm, kèm giảng viên và số học viên của cụm', async () => {
      const res = await get('/ho-tro/lich-hoc', token.s1);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({
        buoi_so: 1,
        dia_diem_hoac_link: 'https://zoom.us/j/123',
        lop: { ten_lop: 'Zoom 01', loai_lop: 'zoom' },
        giai_doan: { ten_giai_doan: 'Zoom – nhóm 1' },
        so_hoc_vien_cum: 1,
      });
      expect(res.body[0].nhan_su[0]).toMatchObject({
        ho_ten: 'TS. Giảng Viên',
        vai_tro: 'giang_vien',
      });
    });

    it('cụm không có học viên nào trong lớp -> không thấy buổi đó', async () => {
      expect((await get('/ho-tro/lich-hoc', token.s2)).body).toEqual([]);
    });

    it('ngoài khoảng ngày -> không thấy', async () => {
      const res = await get(
        '/ho-tro/lich-hoc?tu_ngay=2027-06-01&den_ngay=2027-06-30',
        token.s1,
      );
      expect(res.body).toEqual([]);
    });
  });

  describe('GET /ho-tro/hoc-vien/xuat', () => {
    it('T16: xlsx 1 sheet/cụm, không có CCCD/ngày sinh/mã MOET, có nhật ký', async () => {
      const truoc = await prisma.nhat_ky_hoat_dong.count({
        where: {
          hanh_dong: 'ho_tro_xuat_danh_sach',
          nguoi_dung_id: hoTroId.s1,
        },
      });
      const res = await http()
        .get('/ho-tro/hoc-vien/xuat')
        .set(auth(token.s1))
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        });
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml');
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(res.body as unknown as ExcelJS.Buffer);
      expect(wb.worksheets.map((w) => w.name)).toEqual(['Cụm A']);
      const ws = wb.worksheets[0];
      const tieuDe = (ws.getRow(1).values as unknown[])
        .filter(Boolean)
        .map(String);
      expect(tieuDe).toEqual(
        expect.arrayContaining([
          'Họ tên',
          'Đơn vị công tác',
          'Số điện thoại',
          'Email',
        ]),
      );
      expect(tieuDe.join('|')).not.toMatch(
        /CCCD|định danh|Ngày sinh|MOET|Nơi sinh/i,
      );
      expect(tieuDe).toContain('GĐ1 - Zoom – nhóm 1');
      const dong2 = (ws.getRow(2).values as unknown[]).map(String);
      expect(dong2).toContain('Nguyễn Văn Một');
      expect(dong2).toContain('Zoom 01');
      expect(dong2.join('|')).not.toContain(cccdMot);
      const sau = await prisma.nhat_ky_hoat_dong.count({
        where: {
          hanh_dong: 'ho_tro_xuat_danh_sach',
          nguoi_dung_id: hoTroId.s1,
        },
      });
      expect(sau).toBe(truoc + 1);
    });
  });
});
