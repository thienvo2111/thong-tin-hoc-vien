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

const PHUT = 60 * 1000;
const GIO = 60 * PHUT;
const NGAY = 24 * GIO;
const LINK = 'https://zoom.us/j/111';
const LINK_GD = 'https://zoom.us/j/gd';
const MAT_KHAU = '12071990';

// ADR 0005 Z2–Z5 (issue #24): học viên bấm "Điểm danh & vào Zoom"; trang lớp
// học viên giấu link Zoom khi khóa bật. Mốc thời gian tính tương đối với now.
describe('Điểm danh & vào Zoom — POST /lich-hoc/:id/vao-hoc (e2e)', () => {
  let app: INestApplication;
  const suf = uniqueSuffix();
  let dv: Awaited<ReturnType<typeof taoDonViTest>>;
  let quanTri: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let tokenQuanTri: string;
  let tokenHv: string;
  let hocVienId: string;
  let nguoiDungHvId: string;
  const khoaIds: string[] = [];
  let khoaBat: string;
  let gdZoom: string;
  let gdTatZoom: string;
  let dangKyBat: string;
  const buoi: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const tg = (offsetMs: number) => new Date(Date.now() + offsetMs);
  const vaoHoc = (id: string, token = tokenHv) =>
    http()
      .post(`/lich-hoc/${id}/vao-hoc`)
      .set('Authorization', `Bearer ${token}`);
  const soDong = (lichHocId: string) =>
    prisma.diem_danh.count({ where: { lich_hoc_id: lichHocId } });

  async function taoKhoa(bat: Date | null) {
    const khoa = await prisma.khoa_boi_duong.create({
      data: {
        ma_khoa: `VHZ-${bat ? 'B' : 'T'}-${suf}`,
        ten_khoa: 'Khóa vào học Zoom',
        don_vi_dat_hang_id: dv.donVi.id,
        thoi_gian_bat_dau: new Date('2026-01-01'),
        thoi_gian_ket_thuc: new Date('2027-12-31'),
        trang_thai: 'da_duyet',
        bat_diem_danh_zoom_luc: bat,
      },
    });
    khoaIds.push(khoa.id);
    return khoa.id;
  }

  async function taoGiaiDoan(
    khoaId: string,
    thuTu: number,
    hinhThuc: 'truc_tuyen' | 'truc_tiep',
  ) {
    return (
      await prisma.giai_doan_khoa.create({
        data: {
          khoa_id: khoaId,
          thu_tu: thuTu,
          ten_giai_doan: `GĐ ${thuTu}`,
          hinh_thuc: hinhThuc,
          thoi_gian_bat_dau: new Date('2026-01-01'),
          thoi_gian_ket_thuc: new Date('2027-12-31'),
          link_hoac_dia_diem: LINK_GD,
        },
      })
    ).id;
  }

  async function taoLop(
    khoaId: string,
    ten: string,
    loai: 'zoom' | 'truc_tiep',
  ) {
    return (
      await prisma.lop_hoc.create({
        data: { khoa_id: khoaId, loai_lop: loai, ten_lop: ten },
      })
    ).id;
  }

  async function taoBuoi(
    lop: string,
    gd: string,
    so: number,
    batDau: Date,
    link: string | null = LINK,
  ) {
    return (
      await prisma.lich_hoc_lop.create({
        data: {
          lop_id: lop,
          giai_doan_id: gd,
          buoi_so: so,
          thoi_gian_bat_dau: batDau,
          thoi_gian_ket_thuc: new Date(batDau.getTime() + 3 * GIO),
          dia_diem_hoac_link: link,
          // Đánh dấu "đã chốt" để cron chốt vắng (#25, kể cả e2e của nó chạy
          // song song trên DB dev với now tương lai) không ghi vắng vào fixture.
          // POST vào học chỉ dựa vào cửa sổ, không đọc cột này.
          chot_diem_danh_luc: new Date(),
        },
      })
    ).id;
  }

  async function dangKy(khoaId: string, gd: string, lop: string) {
    const dk = await prisma.dang_ky_hoc.create({
      data: { hoc_vien_id: hocVienId, khoa_id: khoaId, trang_thai: 'da_duyet' },
    });
    await prisma.phan_lop_giai_doan.create({
      data: { dang_ky_hoc_id: dk.id, giai_doan_id: gd, lop_id: lop },
    });
    return dk.id;
  }

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    dv = await taoDonViTest('vhz');
    quanTri = await taoNguoiDungTest({
      vai_tro: 'quan_tri',
      don_vi_id: dv.donVi.id,
      mat_khau: 'MatKhau123',
    });
    tokenQuanTri = (
      await http()
        .post('/auth/dang-nhap')
        .send({ ten_dang_nhap: quanTri.ten_dang_nhap, mat_khau: 'MatKhau123' })
        .expect(200)
    ).body.token;

    const tenDangNhap = `MOET-VHZ-${suf}`;
    const hv = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: tenDangNhap,
        ho_ten: 'Học Viên Zoom',
        ngay_sinh: 12,
        thang_sinh: 7,
        nam_sinh: 1990,
        don_vi_cong_tac_id: dv.donVi.id,
      },
    });
    hocVienId = hv.id;
    nguoiDungHvId = (
      await prisma.nguoi_dung.create({
        data: {
          ho_ten: hv.ho_ten,
          ten_dang_nhap: tenDangNhap,
          vai_tro: 'hoc_vien',
          hoc_vien_id: hv.id,
          mat_khau_hash: await bcrypt.hash(MAT_KHAU, 4),
          phai_doi_mat_khau: false,
        },
      })
    ).id;
    tokenHv = (
      await http()
        .post('/auth/dang-nhap')
        .send({ ten_dang_nhap: tenDangNhap, mat_khau: MAT_KHAU })
        .expect(200)
    ).body.token;

    // Khóa đã bật: lớp Zoom của học viên, lớp Zoom khác, lớp trực tiếp.
    khoaBat = await taoKhoa(tg(-NGAY));
    gdZoom = await taoGiaiDoan(khoaBat, 1, 'truc_tuyen');
    const gdTrucTiep = await taoGiaiDoan(khoaBat, 2, 'truc_tiep');
    const lopZoom = await taoLop(khoaBat, 'Zoom 1', 'zoom');
    const lopZoomKhac = await taoLop(khoaBat, 'Zoom 2', 'zoom');
    const lopTrucTiep = await taoLop(khoaBat, 'Trực tiếp 1', 'truc_tiep');
    buoi.som = await taoBuoi(lopZoom, gdZoom, 1, tg(3 * GIO));
    buoi.dangMo = await taoBuoi(lopZoom, gdZoom, 2, tg(10 * PHUT));
    // Sáng/chiều chung phòng Zoom: cùng link, cả 2 đang trong cửa sổ.
    buoi.sang = await taoBuoi(lopZoom, gdZoom, 3, tg(-60 * PHUT), LINK);
    buoi.chieu = await taoBuoi(lopZoom, gdZoom, 4, tg(20 * PHUT), LINK);
    buoi.muon = await taoBuoi(lopZoom, gdZoom, 5, tg(-3 * GIO), LINK);
    buoi.khongLink = await taoBuoi(lopZoom, gdZoom, 6, tg(5 * PHUT), null);
    buoi.baoVang = await taoBuoi(lopZoom, gdZoom, 7, tg(15 * PHUT));
    buoi.songSong = await taoBuoi(lopZoom, gdZoom, 8, tg(25 * PHUT));
    buoi.lopKhac = await taoBuoi(lopZoomKhac, gdZoom, 1, tg(10 * PHUT));
    buoi.trucTiep = await taoBuoi(lopTrucTiep, gdTrucTiep, 1, tg(10 * PHUT));
    dangKyBat = await dangKy(khoaBat, gdZoom, lopZoom);
    await prisma.bao_vang.create({
      data: {
        dang_ky_hoc_id: dangKyBat,
        lich_hoc_id: buoi.baoVang,
        ly_do: 'Ốm',
      },
    });

    // Khóa chưa bật: hành vi cũ.
    const khoaTat = await taoKhoa(null);
    gdTatZoom = await taoGiaiDoan(khoaTat, 1, 'truc_tuyen');
    const lopTat = await taoLop(khoaTat, 'Zoom tắt', 'zoom');
    buoi.khoaTat = await taoBuoi(lopTat, gdTatZoom, 1, tg(10 * PHUT));
    await dangKy(khoaTat, gdTatZoom, lopTat);
  });

  afterAll(async () => {
    await prisma.dang_ky_hoc.deleteMany({
      where: { khoa_id: { in: khoaIds } },
    });
    await prisma.lich_hoc_lop.deleteMany({
      where: { lop: { khoa_id: { in: khoaIds } } },
    });
    await prisma.khoa_boi_duong.deleteMany({ where: { id: { in: khoaIds } } });
    await xoaNguoiDungTest(nguoiDungHvId);
    await prisma.hoc_vien.deleteMany({ where: { id: hocVienId } });
    await xoaNguoiDungTest(quanTri.nguoiDung.id);
    await xoaDonViTest([dv.donVi.id], [dv.diaDanhXa.id, dv.diaDanhTinh.id]);
    await prisma.$disconnect();
    await app.close();
  });

  it('bấm sớm: chua_mo, không link, không ghi', async () => {
    const res = await vaoHoc(buoi.som).expect(200);
    expect(res.body.ket_qua).toBe('chua_mo');
    expect(res.body.link).toBeUndefined();
    expect(new Date(res.body.mo).getTime()).toBeGreaterThan(Date.now());
    expect(await soDong(buoi.som)).toBe(0);
  });

  it('trong cửa sổ: ghi co_mat/zoom; bấm lại -> da_co cùng mốc, không thêm dòng', async () => {
    const lan1 = await vaoHoc(buoi.dangMo).expect(200);
    expect(lan1.body).toMatchObject({ ket_qua: 'da_ghi_nhan', link: LINK });
    const dong = await prisma.diem_danh.findMany({
      where: { lich_hoc_id: buoi.dangMo },
    });
    expect(dong).toHaveLength(1);
    expect(dong[0]).toMatchObject({
      dang_ky_hoc_id: dangKyBat,
      trang_thai: 'co_mat',
      nguon: 'zoom',
    });
    expect(dong[0].tu_diem_danh_luc?.toISOString()).toBe(lan1.body.luc);

    const lan2 = await vaoHoc(buoi.dangMo).expect(200);
    expect(lan2.body).toMatchObject({
      ket_qua: 'da_co',
      trang_thai: 'co_mat',
      luc: lan1.body.luc,
      link: LINK,
    });
    expect(await soDong(buoi.dangMo)).toBe(1);
  });

  it('2 request song song: đúng 1 dòng, 1 da_ghi_nhan', async () => {
    const kq = await Promise.all([
      vaoHoc(buoi.songSong).expect(200),
      vaoHoc(buoi.songSong).expect(200),
    ]);
    const ketQua = kq.map((r) => r.body.ket_qua).sort();
    expect(ketQua).toEqual(['da_co', 'da_ghi_nhan']);
    expect(await soDong(buoi.songSong)).toBe(1);
  });

  it('quá giờ: qua_gio có link, không ghi', async () => {
    const res = await vaoHoc(buoi.muon).expect(200);
    expect(res.body).toMatchObject({ ket_qua: 'qua_gio', link: LINK });
    expect(await soDong(buoi.muon)).toBe(0);
  });

  it('có báo vắng vẫn ghi co_mat', async () => {
    const res = await vaoHoc(buoi.baoVang).expect(200);
    expect(res.body.ket_qua).toBe('da_ghi_nhan');
    const dd = await prisma.diem_danh.findFirstOrThrow({
      where: { lich_hoc_id: buoi.baoVang },
    });
    expect(dd.trang_thai).toBe('co_mat');
  });

  it('sáng/chiều chung link: điểm danh độc lập theo buổi', async () => {
    await vaoHoc(buoi.sang).expect(200);
    expect(await soDong(buoi.sang)).toBe(1);
    expect(await soDong(buoi.chieu)).toBe(0);
    const chieu = await vaoHoc(buoi.chieu).expect(200);
    expect(chieu.body.ket_qua).toBe('da_ghi_nhan');
    expect(await soDong(buoi.chieu)).toBe(1);
  });

  it('buổi của lớp khác -> 403, không ghi', async () => {
    await vaoHoc(buoi.lopKhac).expect(403);
    expect(await soDong(buoi.lopKhac)).toBe(0);
  });

  it('lớp trực tiếp / khóa chưa bật / buổi không link -> 400', async () => {
    for (const id of [buoi.trucTiep, buoi.khoaTat, buoi.khongLink]) {
      const res = await vaoHoc(id).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(await soDong(id)).toBe(0);
    }
  });

  it('buổi không tồn tại -> 404; id sai định dạng -> 400; vai trò khác -> 403', async () => {
    await vaoHoc('00000000-0000-4000-8000-000000000000').expect(404);
    await vaoHoc('khong-phai-uuid').expect(400);
    await vaoHoc(buoi.dangMo, tokenQuanTri).expect(403);
  });

  it('GET /hoc-vien/toi/khoa-hoc: khóa bật giấu link + có diem_danh_zoom; khóa tắt như cũ', async () => {
    const res = await http()
      .get('/hoc-vien/toi/khoa-hoc')
      .set('Authorization', `Bearer ${tokenHv}`)
      .expect(200);
    const dkBat = res.body.find(
      (d: { khoa_id: string }) => d.khoa_id === khoaBat,
    );
    const gd = dkBat.giai_doan.find((g: { id: string }) => g.id === gdZoom);
    expect(gd.link_hoac_dia_diem).toBeNull();
    const theoId = new Map(
      gd.lop.lich_hoc.map((b: { id: string }) => [b.id, b]),
    );
    for (const b of gd.lop.lich_hoc) {
      expect(b.dia_diem_hoac_link).toBeNull();
      expect(b.diem_danh_zoom).toBeDefined();
    }
    expect(theoId.get(buoi.som)).toMatchObject({
      diem_danh_zoom: { co_link: true, pha: 'chua_mo', trang_thai: null },
    });
    expect(theoId.get(buoi.khongLink)).toMatchObject({
      diem_danh_zoom: { co_link: false },
    });
    expect(theoId.get(buoi.muon)).toMatchObject({
      diem_danh_zoom: { pha: 'da_dong', trang_thai: null },
    });
    const dangMo = theoId.get(buoi.dangMo) as {
      trang_thai_diem_danh: string;
      diem_danh_zoom: Record<string, unknown>;
    };
    expect(dangMo.trang_thai_diem_danh).toBe('co_mat');
    expect(dangMo.diem_danh_zoom).toMatchObject({
      pha: 'dang_mo',
      trang_thai: 'co_mat',
    });
    expect(dangMo.diem_danh_zoom.tu_diem_danh_luc).toEqual(expect.any(String));
    expect(typeof dangMo.diem_danh_zoom.mo).toBe('string');
    expect(typeof dangMo.diem_danh_zoom.dong).toBe('string');

    const dkTat = res.body.find(
      (d: { khoa_id: string }) => d.khoa_id !== khoaBat,
    );
    const gdTat = dkTat.giai_doan[0];
    expect(gdTat.link_hoac_dia_diem).toBe(LINK_GD);
    expect(gdTat.lop.lich_hoc[0].dia_diem_hoac_link).toBe(LINK);
    expect(gdTat.lop.lich_hoc[0]).not.toHaveProperty('diem_danh_zoom');
  });

  it('nhân sự (Quản trị) vẫn thấy link qua GET /hoc-vien/:id/khoa-hoc', async () => {
    const res = await http()
      .get(`/hoc-vien/${hocVienId}/khoa-hoc`)
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .expect(200);
    const dkBat = res.body.find(
      (d: { khoa_id: string }) => d.khoa_id === khoaBat,
    );
    const gd = dkBat.giai_doan.find((g: { id: string }) => g.id === gdZoom);
    expect(gd.link_hoac_dia_diem).toBe(LINK_GD);
    const som = gd.lop.lich_hoc.find((b: { id: string }) => b.id === buoi.som);
    expect(som.dia_diem_hoac_link).toBe(LINK);
    expect(som).not.toHaveProperty('diem_danh_zoom');
  });

  it('GET /khoa-boi-duong/:id với học viên: giấu link buổi/giai đoạn Zoom; Quản trị vẫn thấy', async () => {
    const hv = await http()
      .get(`/khoa-boi-duong/${khoaBat}`)
      .set('Authorization', `Bearer ${tokenHv}`)
      .expect(200);
    const gdHv = hv.body.giai_doan.find((g: { id: string }) => g.id === gdZoom);
    expect(gdHv.link_hoac_dia_diem).toBeNull();
    const lopZoom = hv.body.lop_hoc.filter(
      (l: { loai_lop: string }) => l.loai_lop === 'zoom',
    );
    for (const l of lopZoom) {
      for (const b of l.lich_hoc) expect(b.dia_diem_hoac_link).toBeNull();
    }
    const lopTt = hv.body.lop_hoc.find(
      (l: { loai_lop: string }) => l.loai_lop === 'truc_tiep',
    );
    expect(lopTt.lich_hoc[0].dia_diem_hoac_link).toBe(LINK);

    const qt = await http()
      .get(`/khoa-boi-duong/${khoaBat}`)
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .expect(200);
    const gdQt = qt.body.giai_doan.find((g: { id: string }) => g.id === gdZoom);
    expect(gdQt.link_hoac_dia_diem).toBe(LINK_GD);
  });
});
