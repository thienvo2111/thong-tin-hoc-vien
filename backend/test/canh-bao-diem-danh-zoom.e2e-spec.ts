import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
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

// ADR 0005 §9 (issue #28): cảnh báo vận hành cho Quản trị — buổi Zoom sắp
// diễn ra chưa có link; tạo/sửa buổi có cửa sổ điểm danh chồng buổi khác cùng
// lớp (không chặn). Khóa CHƯA bật vẫn cảnh báo (Quản trị chuẩn bị trước).
describe('Cảnh báo vận hành điểm danh Zoom (e2e)', () => {
  let app: INestApplication;
  const suf = uniqueSuffix();
  let dv: Awaited<ReturnType<typeof taoDonViTest>>;
  let quanTri: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let truong: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  const token: Record<string, string> = {};
  let khoaId: string;
  let gdId: string;
  let lopZoom: string;
  let lopVle: string;
  let buoiDau: string;

  const http = () => request(app.getHttpServer());
  const auth = (ai: string) => ({ Authorization: `Bearer ${token[ai]}` });
  // Mốc 9 ngày tới, làm tròn giờ — tương đối với now.
  const goc = new Date(Math.floor((Date.now() + 9 * NGAY) / GIO) * GIO);
  const tg = (offsetMs: number) => new Date(goc.getTime() + offsetMs);
  const dto = (buoiSo: number, batDau: Date, link?: string) => ({
    giai_doan_id: gdId,
    buoi_so: buoiSo,
    thoi_gian_bat_dau: batDau.toISOString(),
    thoi_gian_ket_thuc: new Date(batDau.getTime() + GIO).toISOString(),
    ...(link ? { dia_diem_hoac_link: link } : {}),
  });

  async function dangNhap(ten: string) {
    return (
      await http()
        .post('/auth/dang-nhap')
        .send({ ten_dang_nhap: ten, mat_khau: 'MatKhau123' })
        .expect(200)
    ).body.token as string;
  }

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    dv = await taoDonViTest('cbz');
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
    token.qt = await dangNhap(quanTri.ten_dang_nhap);
    token.truong = await dangNhap(truong.ten_dang_nhap);

    khoaId = (
      await prisma.khoa_boi_duong.create({
        data: {
          ma_khoa: `CBZ-${suf}`.slice(0, 30),
          ten_khoa: 'Khóa cảnh báo Zoom',
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
          ten_giai_doan: 'Trực tuyến',
          hinh_thuc: 'truc_tuyen',
          thoi_gian_bat_dau: new Date('2026-01-01'),
          thoi_gian_ket_thuc: new Date('2027-12-31'),
        },
      })
    ).id;
    lopZoom = (
      await prisma.lop_hoc.create({
        data: { khoa_id: khoaId, loai_lop: 'zoom', ten_lop: 'Zoom CBZ' },
      })
    ).id;
    lopVle = (
      await prisma.lop_hoc.create({
        data: { khoa_id: khoaId, loai_lop: 'vle', ten_lop: 'VLE CBZ' },
      })
    ).id;
    // Buổi đã qua (không đếm) + buổi VLE thiếu link (không đếm).
    await prisma.lich_hoc_lop.create({
      data: {
        lop_id: lopZoom,
        giai_doan_id: gdId,
        buoi_so: 9,
        thoi_gian_bat_dau: new Date(Date.now() - 2 * NGAY),
        thoi_gian_ket_thuc: new Date(Date.now() - 2 * NGAY + GIO),
        chot_diem_danh_luc: new Date(),
      },
    });
    await prisma.lich_hoc_lop.create({
      data: {
        lop_id: lopVle,
        giai_doan_id: gdId,
        buoi_so: 1,
        thoi_gian_bat_dau: tg(0),
        thoi_gian_ket_thuc: tg(GIO),
      },
    });
  });

  afterAll(async () => {
    await prisma.lich_hoc_lop.deleteMany({
      where: { lop: { khoa_id: khoaId } },
    });
    await prisma.khoa_boi_duong.deleteMany({ where: { id: khoaId } });
    await xoaNguoiDungTest(quanTri.nguoiDung.id);
    await xoaNguoiDungTest(truong.nguoiDung.id);
    await xoaDonViTest([dv.donVi.id], [dv.diaDanhXa.id, dv.diaDanhTinh.id]);
    await prisma.$disconnect();
    await app.close();
  });

  it('tạo buổi Zoom đầu tiên -> không cảnh báo chồng', async () => {
    const r = await http()
      .post(`/lop/${lopZoom}/lich-hoc`)
      .set(auth('qt'))
      .send(dto(1, tg(0)))
      .expect(201);
    buoiDau = r.body.id;
    expect(r.body.canh_bao).toEqual([]);
  });

  it('buổi cách 2 giờ (< 30 + 120 phút) -> vẫn tạo, kèm cảnh báo chồng', async () => {
    const r = await http()
      .post(`/lop/${lopZoom}/lich-hoc`)
      .set(auth('qt'))
      .send(dto(2, tg(2 * GIO)))
      .expect(201);
    expect(r.body.canh_bao).toHaveLength(1);
    expect(r.body.canh_bao[0]).toContain(
      'Cửa sổ điểm danh Zoom chồng với buổi 1',
    );
  });

  it('buổi cách 5 giờ -> không cảnh báo', async () => {
    const r = await http()
      .post(`/lop/${lopZoom}/lich-hoc`)
      .set(auth('qt'))
      .send(dto(3, tg(5 * GIO), 'https://zoom.us/j/cbz'))
      .expect(201);
    expect(r.body.canh_bao).toEqual([]);
  });

  it('sửa buổi 1 sang giờ chồng buổi 3 -> 200 kèm cảnh báo (không chặn)', async () => {
    const r = await http()
      .patch(`/lop/${lopZoom}/lich-hoc/${buoiDau}`)
      .set(auth('qt'))
      .send({
        thoi_gian_bat_dau: tg(4 * GIO).toISOString(),
        thoi_gian_ket_thuc: tg(5 * GIO).toISOString(),
      })
      .expect(200);
    expect(new Date(r.body.thoi_gian_bat_dau)).toEqual(tg(4 * GIO));
    expect(r.body.canh_bao.join(' ')).toContain('buổi 3');
  });

  it('lớp không phải Zoom -> không xét chồng', async () => {
    const r = await http()
      .post(`/lop/${lopVle}/lich-hoc`)
      .set(auth('qt'))
      .send(dto(2, tg(30 * PHUT)))
      .expect(201);
    expect(r.body.canh_bao).toEqual([]);
  });

  it('GET khóa: Quản trị thấy so_buoi_zoom_thieu_link (chỉ buổi Zoom sắp tới thiếu link); vai trò khác không có', async () => {
    const qt = await http()
      .get(`/khoa-boi-duong/${khoaId}`)
      .set(auth('qt'))
      .expect(200);
    // buổi 1 + buổi 2 thiếu link; buổi 3 có link; buổi 9 đã qua; VLE không tính.
    expect(qt.body.so_buoi_zoom_thieu_link).toBe(2);

    const tr = await http()
      .get(`/khoa-boi-duong/${khoaId}`)
      .set(auth('truong'))
      .expect((res) => expect([200, 403]).toContain(res.status));
    expect(tr.body.so_buoi_zoom_thieu_link).toBeUndefined();
  });
});
