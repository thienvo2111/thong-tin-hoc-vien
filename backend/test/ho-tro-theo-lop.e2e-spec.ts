import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
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

// ADR 0008: người hỗ trợ học viên được gắn vào LỚP (ngoài cụm). Phạm vi =
// cụm ∪ lớp gốc; đổi buổi không tính. Các test chạy TUẦN TỰ — test đầu gán
// lớp qua API Quản trị, test cuối gỡ.
describe('Người hỗ trợ học viên theo lớp (e2e, ADR 0008)', () => {
  let app: INestApplication;
  const suf = uniqueSuffix();
  const SUF = suf.toUpperCase();
  const MIEN = `${suf}@htlop.vn`;
  const nguoiDungIds: string[] = [];
  const hocVienIds: string[] = [];
  const khoaIds: string[] = [];
  let dv: Awaited<ReturnType<typeof taoDonViTest>>;
  let tokenQt: string;
  let hoTroLop: { id: string; token: string };
  let hoTroCum: { id: string; token: string };
  let hoTroGv: { id: string; token: string };
  let k1: string;
  let k2: string;
  let lop1: string;
  let lop2: string;
  let lopKhoa2: string;
  let cumX: string;
  const hv = { mot: '', hai: '', doiBuoi: '' };

  const http = () => request(app.getHttpServer());
  const dangNhap = async (ten: string, mk: string) =>
    (
      await http()
        .post('/auth/dang-nhap')
        .send({ ten_dang_nhap: ten, mat_khau: mk })
    ).body.token as string;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const get = (path: string, t: string) => http().get(path).set(auth(t));
  const ganLop = (khoaId: string, lopId: string, ids: string[], t = tokenQt) =>
    http()
      .put(`/khoa-boi-duong/${khoaId}/lop/${lopId}/nguoi-ho-tro`)
      .set(auth(t))
      .send({ nguoi_dung_ids: ids });
  const taiFile = (path: string, t: string) =>
    http()
      .get(path)
      .set(auth(t))
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });

  async function taoHoTro(
    vaiTro: 'ho_tro_hoc_vien' | 'ho_tro_giang_vien',
    ten: string,
  ) {
    const nd = await prisma.nguoi_dung.create({
      data: {
        ho_ten: `Hỗ trợ ${ten}`,
        ten_dang_nhap: `${ten}-${suf}`,
        email: `${ten}-${MIEN}`,
        vai_tro: vaiTro,
        mat_khau_hash: await bcrypt.hash('HoTro12345', 4),
        phai_doi_mat_khau: false,
      },
    });
    nguoiDungIds.push(nd.id);
    return { id: nd.id, token: await dangNhap(nd.ten_dang_nhap, 'HoTro12345') };
  }

  async function taoHocVien(nhan: string, hoTen: string) {
    const h = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: `HTL-${nhan}-${SUF}`,
        ho_ten: hoTen,
        ngay_sinh: 2,
        thang_sinh: 3,
        nam_sinh: 1988,
        don_vi_cong_tac_id: dv.donVi.id,
        so_dien_thoai_lien_he: '0912345678',
      },
    });
    hocVienIds.push(h.id);
    return h.id;
  }

  async function taoKhoa(nhan: string) {
    const khoa = await prisma.khoa_boi_duong.create({
      data: {
        ma_khoa: `K-HTL${nhan}-${SUF}`,
        ten_khoa: `Khóa lớp ${nhan} ${suf}`,
        don_vi_dat_hang_id: dv.donVi.id,
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
    dv = await taoDonViTest('htlop');
    const qt = await taoNguoiDungTest({
      vai_tro: 'quan_tri',
      don_vi_id: dv.donVi.id,
      mat_khau: 'QuanTri12345',
    });
    nguoiDungIds.push(qt.nguoiDung.id);
    tokenQt = await dangNhap(qt.ten_dang_nhap, 'QuanTri12345');
    hoTroLop = await taoHoTro('ho_tro_hoc_vien', 'htlop');
    hoTroCum = await taoHoTro('ho_tro_hoc_vien', 'htcum');
    hoTroGv = await taoHoTro('ho_tro_giang_vien', 'htgv');

    k1 = await taoKhoa('1');
    k2 = await taoKhoa('2');
    cumX = (
      await prisma.cum_hoc_vien.create({
        data: { khoa_id: k1, ten_cum: 'Cụm X' },
      })
    ).id;
    await prisma.phan_cong_ho_tro.create({
      data: { nguoi_dung_id: hoTroCum.id, cum_id: cumX },
    });
    const gd = await prisma.giai_doan_khoa.create({
      data: {
        khoa_id: k1,
        thu_tu: 1,
        ten_giai_doan: 'Học Zoom',
        hinh_thuc: 'truc_tuyen',
        thoi_gian_bat_dau: new Date('2026-10-01'),
        thoi_gian_ket_thuc: new Date('2027-01-31'),
      },
    });
    lop1 = (
      await prisma.lop_hoc.create({
        data: { khoa_id: k1, loai_lop: 'zoom', ten_lop: 'Zoom 01' },
      })
    ).id;
    lop2 = (
      await prisma.lop_hoc.create({
        data: { khoa_id: k1, loai_lop: 'zoom', ten_lop: 'Zoom 02' },
      })
    ).id;
    lopKhoa2 = (
      await prisma.lop_hoc.create({
        data: { khoa_id: k2, loai_lop: 'zoom', ten_lop: 'Zoom K2' },
      })
    ).id;
    const batDau = new Date(Date.now() + 3 * 24 * 3600 * 1000);
    const taoBuoi = (lopId: string) =>
      prisma.lich_hoc_lop.create({
        data: {
          lop_id: lopId,
          giai_doan_id: gd.id,
          buoi_so: 1,
          thoi_gian_bat_dau: batDau,
          thoi_gian_ket_thuc: new Date(batDau.getTime() + 3 * 3600 * 1000),
        },
      });
    const buoi1 = await taoBuoi(lop1);
    const buoi2 = await taoBuoi(lop2);

    // hv.mot: lớp Zoom 01, cụm X (cụm KHÔNG thuộc người hỗ trợ lớp).
    hv.mot = await taoHocVien('mot', 'Nguyễn Văn Một');
    // hv.hai: lớp Zoom 02 (lớp không được gắn), không cụm.
    hv.hai = await taoHocVien('hai', 'Trần Thị Hai');
    // hv.doiBuoi: lớp gốc Zoom 02, đổi buổi đã duyệt sang buổi của Zoom 01.
    hv.doiBuoi = await taoHocVien('doi', 'Lê Văn Đổi');
    const dkMot = await prisma.dang_ky_hoc.create({
      data: { hoc_vien_id: hv.mot, khoa_id: k1, cum_id: cumX },
    });
    const dkHai = await prisma.dang_ky_hoc.create({
      data: { hoc_vien_id: hv.hai, khoa_id: k1 },
    });
    const dkDoi = await prisma.dang_ky_hoc.create({
      data: { hoc_vien_id: hv.doiBuoi, khoa_id: k1 },
    });
    await prisma.phan_lop_giai_doan.createMany({
      data: [
        { dang_ky_hoc_id: dkMot.id, giai_doan_id: gd.id, lop_id: lop1 },
        { dang_ky_hoc_id: dkHai.id, giai_doan_id: gd.id, lop_id: lop2 },
        { dang_ky_hoc_id: dkDoi.id, giai_doan_id: gd.id, lop_id: lop2 },
      ],
    });
    await prisma.doi_buoi_hoc.create({
      data: {
        dang_ky_hoc_id: dkDoi.id,
        lich_nguon_id: buoi2.id,
        lich_de_nghi_id: buoi1.id,
        lich_chot_id: buoi1.id,
        ly_do: 'Trùng lịch công tác',
        trang_thai: 'da_duyet',
      },
    });
  });

  afterAll(async () => {
    await prisma.lich_su_thay_doi_ho_so.deleteMany({
      where: { hoc_vien_id: { in: hocVienIds } },
    });
    await prisma.phan_lop_giai_doan.deleteMany({
      where: { dang_ky_hoc: { khoa_id: { in: khoaIds } } },
    });
    await prisma.dang_ky_hoc.deleteMany({
      where: { khoa_id: { in: khoaIds } },
    });
    await prisma.khoa_boi_duong.deleteMany({ where: { id: { in: khoaIds } } });
    for (const id of nguoiDungIds) await xoaNguoiDungTest(id);
    await prisma.hoc_vien.deleteMany({ where: { id: { in: hocVienIds } } });
    await xoaDonViTest([dv.donVi.id], [dv.diaDanhXa.id, dv.diaDanhTinh.id]);
    await prisma.$disconnect();
    await app.close();
  });

  it('vai trò khác Quản trị gọi PUT gán lớp -> 403', async () => {
    const res = await ganLop(k1, lop1, [hoTroLop.id], hoTroLop.token);
    expect(res.status).toBe(403);
  });

  it('Quản trị gán người hỗ trợ vào lớp; chi tiết khóa có nguoi_ho_tro của lớp', async () => {
    const res = await ganLop(k1, lop1, [hoTroLop.id]);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      lop_id: lop1,
      nguoi_ho_tro: [{ id: hoTroLop.id, ho_ten: 'Hỗ trợ htlop' }],
    });
    const khoa = await get(`/khoa-boi-duong/${k1}`, tokenQt);
    const l = (
      khoa.body.lop_hoc as { id: string; nguoi_ho_tro: { id: string }[] }[]
    ).find((x) => x.id === lop1);
    expect(l?.nguoi_ho_tro.map((n) => n.id)).toEqual([hoTroLop.id]);
  });

  it('PUT từ chối tài khoản không phải ho_tro_hoc_vien -> 400', async () => {
    const res = await ganLop(k1, lop1, [hoTroGv.id]);
    expect(res.status).toBe(400);
    expect(
      await prisma.phan_cong_ho_tro_lop.count({ where: { lop_id: lop1 } }),
    ).toBe(1);
  });

  it('PUT lớp thuộc khóa khác -> 404', async () => {
    expect((await ganLop(k1, lopKhoa2, [hoTroLop.id])).status).toBe(404);
  });

  it('danh sách tài khoản hỗ trợ có lop_phu_trach', async () => {
    const res = await get(`/nguoi-dung/ho-tro?q=htlop-${suf}`, tokenQt);
    expect(res.status).toBe(200);
    const tk = (
      res.body.data as { id: string; lop_phu_trach: unknown[] }[]
    ).find((x) => x.id === hoTroLop.id);
    expect(tk?.lop_phu_trach).toEqual([
      {
        lop_id: lop1,
        ten_lop: 'Zoom 01',
        loai_lop: 'zoom',
        ma_khoa: `K-HTL1-${SUF}`,
      },
    ]);
  });

  it('lop-cua-toi chỉ trả lớp được gắn; sĩ số không tính đổi buổi', async () => {
    const res = await get('/ho-tro-hoc-vien/lop-cua-toi', hoTroLop.token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      expect.objectContaining({
        lop_id: lop1,
        ten_lop: 'Zoom 01',
        loai_lop: 'zoom',
        khoa: expect.objectContaining({ id: k1 }),
        so_hoc_vien: 1,
      }),
    ]);
    const cum = await get('/ho-tro-hoc-vien/lop-cua-toi', hoTroCum.token);
    expect(cum.body).toEqual([]);
  });

  it('lop/:id/hoc-vien trả học viên lớp gốc, có ngày sinh, mã MOET, cụm, giai đoạn, chuyên cần', async () => {
    const res = await get(
      `/ho-tro-hoc-vien/lop/${lop1}/hoc-vien`,
      hoTroLop.token,
    );
    expect(res.status).toBe(200);
    expect(res.body.lop).toEqual(expect.objectContaining({ lop_id: lop1 }));
    expect(res.body.hoc_vien).toHaveLength(1);
    expect(res.body.hoc_vien[0]).toEqual(
      expect.objectContaining({
        hoc_vien_id: hv.mot,
        ho_ten: 'Nguyễn Văn Một',
        ngay_sinh: '02/03/1988',
        // ADR 0008 L5 (sửa 2026-10-17): DS lớp có mã MOET.
        ma_dinh_danh_moet: `HTL-mot-${SUF}`,
        cum: 'Cụm X',
        giai_doan: ['Học Zoom'],
        // L8: buổi duy nhất chưa diễn ra.
        chuyen_can: { co_mat: 0, da_dien_ra: 0 },
      }),
    );
  });

  it('lop/:id/hoc-vien của lớp không được gắn -> 404', async () => {
    const res = await get(
      `/ho-tro-hoc-vien/lop/${lop2}/hoc-vien`,
      hoTroLop.token,
    );
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Không tìm thấy lớp');
  });

  it('xuất xlsx: 1 sheet/lớp, có Ngày sinh + Mã MOET + chuyên cần, không CCCD; có nhật ký', async () => {
    const truoc = await prisma.nhat_ky_hoat_dong.count({
      where: {
        hanh_dong: 'ho_tro_xuat_danh_sach_lop',
        nguoi_dung_id: hoTroLop.id,
      },
    });
    const res = await taiFile('/ho-tro-hoc-vien/lop/xuat', hoTroLop.token);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['content-disposition']).toMatch(
      /ds-lop-ho-tro-\d{8}\.xlsx/,
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body as unknown as ExcelJS.Buffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Zoom 01']);
    const ws = wb.worksheets[0];
    const tieuDe = (ws.getRow(2).values as unknown[]).filter(Boolean);
    expect(tieuDe).toContain('Ngày sinh');
    expect(tieuDe).toContain('Mã MOET');
    expect(tieuDe).toContain('Có mặt / đã diễn ra');
    expect(tieuDe.join('|')).not.toMatch(/CCCD|định danh|Nơi sinh/i);
    const dong = (ws.getRow(3).values as unknown[]).map(String);
    expect(dong).toContain('Nguyễn Văn Một');
    expect(dong).toContain(`HTL-mot-${SUF}`);
    expect(dong).toContain('02/03/1988');
    expect(dong).toContain('0/0');
    const sau = await prisma.nhat_ky_hoat_dong.count({
      where: {
        hanh_dong: 'ho_tro_xuat_danh_sach_lop',
        nguoi_dung_id: hoTroLop.id,
      },
    });
    expect(sau).toBe(truoc + 1);

    const mot = await taiFile(
      `/ho-tro-hoc-vien/lop/xuat?lop_id=${lop1}`,
      hoTroLop.token,
    );
    expect(mot.status).toBe(200);
    const khac = await get(
      `/ho-tro-hoc-vien/lop/xuat?lop_id=${lop2}`,
      hoTroLop.token,
    );
    expect(khac.status).toBe(404);
  });

  it('người hỗ trợ lớp xem chi tiết + sửa hồ sơ học viên ngoài cụm của mình', async () => {
    const ct = await get(`/ho-tro-hoc-vien/hoc-vien/${hv.mot}`, hoTroLop.token);
    expect(ct.status).toBe(200);
    expect(ct.body.ho_so.ho_ten).toBe('Nguyễn Văn Một');
    const sua = await http()
      .patch(`/ho-tro-hoc-vien/hoc-vien/${hv.mot}`)
      .set(auth(hoTroLop.token))
      .send({ chuc_vu: 'Tổ trưởng', ly_do: 'Học viên báo qua Zoom' });
    expect(sua.status).toBe(200);
  });

  it('học viên lớp không được gắn -> 404; đổi buổi đã duyệt vào lớp -> trong phạm vi (ADR 0011 P1)', async () => {
    expect(
      (await get(`/ho-tro-hoc-vien/hoc-vien/${hv.hai}`, hoTroLop.token)).status,
    ).toBe(404);
    expect(
      (await get(`/ho-tro-hoc-vien/hoc-vien/${hv.doiBuoi}`, hoTroLop.token))
        .status,
    ).toBe(200);
  });

  it('ho_tro_giang_vien không gọi được /ho-tro-hoc-vien/lop-cua-toi (403)', async () => {
    expect(
      (await get('/ho-tro-hoc-vien/lop-cua-toi', hoTroGv.token)).status,
    ).toBe(403);
  });

  it('Quản trị gỡ hết -> người hỗ trợ lớp mất phạm vi ngay', async () => {
    const res = await ganLop(k1, lop1, []);
    expect(res.status).toBe(200);
    expect(res.body.nguoi_ho_tro).toEqual([]);
    expect(
      (await get('/ho-tro-hoc-vien/lop-cua-toi', hoTroLop.token)).body,
    ).toEqual([]);
    expect(
      (await get(`/ho-tro-hoc-vien/hoc-vien/${hv.mot}`, hoTroLop.token)).status,
    ).toBe(404);
    expect(
      (await get(`/ho-tro-hoc-vien/hoc-vien/${hv.doiBuoi}`, hoTroLop.token))
        .status,
    ).toBe(404);
    // Người hỗ trợ cụm X vẫn thấy học viên một (cụm không đổi).
    expect(
      (await get(`/ho-tro-hoc-vien/hoc-vien/${hv.mot}`, hoTroCum.token)).status,
    ).toBe(200);
  });
});
