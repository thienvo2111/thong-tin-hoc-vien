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
import { TrangLopService } from '../src/trang-lop/trang-lop.service';

const GIO = 60 * 60 * 1000;
const NGAY = 24 * GIO;
const MAT_KHAU = 'MatKhau123';

// ADR 0014 (bổ sung): bảng điểm danh lớp + trang lớp hiện buổi được công nhận
// từ lớp cũ sau khi chuyển lớp (tinhChuyenCan theo nấc của khóa), chỉ đọc.
describe('Bảng điểm danh / trang lớp — buổi công nhận từ lớp cũ (e2e)', () => {
  let app: INestApplication;
  const suf = uniqueSuffix();
  let dv: Awaited<ReturnType<typeof taoDonViTest>>;
  let nguoiDungId: string;
  let token: string;
  let hocVienId: string;
  let khoaId: string;
  const id: Record<string, string> = {};

  const tg = (offsetMs: number) => new Date(Date.now() + offsetMs);
  const bang = () =>
    request(app.getHttpServer())
      .get(`/lop/${id.lopB}/diem-danh?giai_doan_id=${id.gd}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .then((r) => r.body);
  const datCheDo = (
    che_do_chuyen_can:
      'theo_lop_hien_tai' | 'cong_nhan_cung_muc' | 'cong_nhan_lop_cu',
  ) =>
    prisma.khoa_boi_duong.update({
      where: { id: khoaId },
      data: { che_do_chuyen_can },
    });
  const trangLop = () =>
    app
      .get(TrangLopService)
      .layTrangLop(id.lopB, id.gd, { vai_tro: 'quan_tri' });

  async function taoBuoi(lop: string, so: number, batDau: Date) {
    return (
      await prisma.lich_hoc_lop.create({
        data: {
          lop_id: lop,
          giai_doan_id: id.gd,
          buoi_so: so,
          thoi_gian_bat_dau: batDau,
          thoi_gian_ket_thuc: new Date(batDau.getTime() + 3 * GIO),
          chot_diem_danh_luc: new Date(),
        },
      })
    ).id;
  }

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    dv = await taoDonViTest('ddlc');
    const nd = await prisma.nguoi_dung.create({
      data: {
        ho_ten: 'DDLC Quản trị',
        ten_dang_nhap: `ddlc-qt-${suf}`.toLowerCase(),
        email: `ddlc-qt-${suf}@ddlc.test.local`.toLowerCase(),
        vai_tro: 'quan_tri',
        mat_khau_hash: await bcrypt.hash(MAT_KHAU, 4),
        phai_doi_mat_khau: false,
      },
    });
    nguoiDungId = nd.id;
    token = (
      await request(app.getHttpServer())
        .post('/auth/dang-nhap')
        .send({ ten_dang_nhap: nd.ten_dang_nhap, mat_khau: MAT_KHAU })
        .expect(200)
    ).body.token;

    const khoa = await prisma.khoa_boi_duong.create({
      data: {
        ma_khoa: `DDLC-${suf}`,
        ten_khoa: 'Khóa điểm danh lớp cũ',
        don_vi_dat_hang_id: dv.donVi.id,
        thoi_gian_bat_dau: new Date('2026-01-01'),
        thoi_gian_ket_thuc: new Date('2027-12-31'),
        trang_thai: 'da_duyet',
      },
    });
    khoaId = khoa.id;
    id.gd = (
      await prisma.giai_doan_khoa.create({
        data: {
          khoa_id: khoaId,
          thu_tu: 1,
          ten_giai_doan: 'GĐ 1',
          hinh_thuc: 'truc_tuyen',
          thoi_gian_bat_dau: new Date('2026-01-01'),
          thoi_gian_ket_thuc: new Date('2027-12-31'),
        },
      })
    ).id;
    // Lớp A, B khác mức: cong_nhan_cung_muc không công nhận.
    for (const [k, ten, muc] of [
      ['lopA', 'DDLC Lớp A', 'co_ban'],
      ['lopB', 'DDLC Lớp B', 'nang_cao'],
    ] as const) {
      id[k] = (
        await prisma.lop_hoc.create({
          data: {
            khoa_id: khoaId,
            loai_lop: 'zoom',
            ten_lop: ten,
            muc_nang_luc: muc,
          },
        })
      ).id;
    }
    id.a1 = await taoBuoi(id.lopA, 1, tg(-2 * NGAY));
    id.a2 = await taoBuoi(id.lopA, 2, tg(-NGAY));
    id.b1 = await taoBuoi(id.lopB, 1, tg(-2 * NGAY + GIO));
    id.b2 = await taoBuoi(id.lopB, 2, tg(-NGAY + GIO));

    const hv = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: `DDLC-${suf}`,
        ho_ten: 'Học Viên Chuyển Lớp',
        ngay_sinh: 1,
        thang_sinh: 1,
        nam_sinh: 1990,
        don_vi_cong_tac_id: dv.donVi.id,
      },
    });
    hocVienId = hv.id;
    id.dk = (
      await prisma.dang_ky_hoc.create({
        data: { hoc_vien_id: hv.id, khoa_id: khoaId, trang_thai: 'da_duyet' },
      })
    ).id;
    // Đã chuyển A -> B: phân lớp hiện tại là B, điểm danh buổi 1–2 ở A vẫn giữ.
    await prisma.phan_lop_giai_doan.create({
      data: { dang_ky_hoc_id: id.dk, giai_doan_id: id.gd, lop_id: id.lopB },
    });
    await prisma.diem_danh.createMany({
      data: [
        {
          dang_ky_hoc_id: id.dk,
          lich_hoc_id: id.a1,
          trang_thai: 'co_mat',
          nguon: 'zoom',
        },
        {
          dang_ky_hoc_id: id.dk,
          lich_hoc_id: id.a2,
          trang_thai: 'vang_co_phep',
          nguon: 'thu_cong',
        },
      ],
    });
  });

  // Chỉ xóa theo id ĐÃ tạo (mảng rỗng -> không khớp gì). KHÔNG dùng
  // where: { x: biếnCóThểUndefined } — Prisma bỏ điều kiện undefined và xóa
  // cả bảng nếu beforeAll lỗi giữa chừng.
  afterAll(async () => {
    const khoaIds = khoaId ? [khoaId] : [];
    await prisma.dang_ky_hoc.deleteMany({
      where: { khoa_id: { in: khoaIds } },
    });
    await prisma.lich_hoc_lop.deleteMany({
      where: { lop: { khoa_id: { in: khoaIds } } },
    });
    await prisma.lop_hoc.deleteMany({ where: { khoa_id: { in: khoaIds } } });
    await prisma.giai_doan_khoa.deleteMany({
      where: { khoa_id: { in: khoaIds } },
    });
    await prisma.khoa_boi_duong.deleteMany({ where: { id: { in: khoaIds } } });
    await prisma.hoc_vien.deleteMany({
      where: { id: { in: hocVienId ? [hocVienId] : [] } },
    });
    if (nguoiDungId) await xoaNguoiDungTest(nguoiDungId);
    if (dv) {
      await xoaDonViTest([dv.donVi.id], [dv.diaDanhXa.id, dv.diaDanhTinh.id]);
    }
    await prisma.$disconnect();
    await app.close();
  });

  it('nấc cong_nhan_lop_cu: bảng lớp B hiện "Có mặt – ở lớp A" / "Vắng có phép – ở lớp A", chỉ đọc; trang lớp cũng có', async () => {
    await datCheDo('cong_nhan_lop_cu');
    const b = await bang();
    expect(b.hoc_vien).toHaveLength(1);
    const lopTinh = { id: id.lopA, ten_lop: 'DDLC Lớp A' };
    expect(b.hoc_vien[0].diem_danh[id.b1]).toMatchObject({
      trang_thai: 'co_mat',
      nhan: 'Có mặt – ở lớp DDLC Lớp A',
      nguon_tinh: 'lop_khac',
      lop_tinh: lopTinh,
      sua_duoc: false,
    });
    expect(b.hoc_vien[0].diem_danh[id.b2]).toMatchObject({
      trang_thai: 'vang_co_phep',
      nhan: 'Vắng có phép – ở lớp DDLC Lớp A',
      sua_duoc: false,
    });

    const t = await trangLop();
    expect(t.hoc_vien[0].diem_danh).toEqual({});
    expect(t.hoc_vien[0].diem_danh_lop_khac?.[id.b1]).toMatchObject({
      nhan: 'Có mặt – ở lớp DDLC Lớp A',
      lop_tinh: lopTinh,
    });
  });

  it.each(['theo_lop_hien_tai', 'cong_nhan_cung_muc'] as const)(
    'nấc %s (lớp Zoom khác mức): không hiện ô lớp khác',
    async (cheDo) => {
      await datCheDo(cheDo);
      const b = await bang();
      expect(b.hoc_vien[0].diem_danh).toEqual({});
      expect((await trangLop()).hoc_vien[0].diem_danh_lop_khac).toBeUndefined();
    },
  );

  it('PUT ô ở lớp B vẫn theo quy tắc hiện tại: ghi dòng của B, không đụng dòng lớp A; bảng hiện ô của B', async () => {
    await datCheDo('cong_nhan_lop_cu');
    await request(app.getHttpServer())
      .put(`/lop/${id.lopB}/diem-danh`)
      .set('Authorization', `Bearer ${token}`)
      .send({ dang_ky_hoc_id: id.dk, lich_hoc_id: id.b1, trang_thai: 'vang' })
      .expect(200);
    const dongA = await prisma.diem_danh.findUniqueOrThrow({
      where: {
        dang_ky_hoc_id_lich_hoc_id: {
          dang_ky_hoc_id: id.dk,
          lich_hoc_id: id.a1,
        },
      },
    });
    expect(dongA.trang_thai).toBe('co_mat');
    const o = (await bang()).hoc_vien[0].diem_danh[id.b1];
    expect(o).toMatchObject({ trang_thai: 'vang', nguon: 'thu_cong' });
    expect(o).not.toHaveProperty('nguon_tinh');
  });
});
