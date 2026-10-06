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

const NAM = new Date().getUTCFullYear() - 30;

// ADR 0004 L2 (issue #15): Trang lớp dùng chung + lịch dạy + liên thông sang
// lịch học của người hỗ trợ học viên. Kịch bản K5, K6 (phần API).
describe('Trang lớp & lịch dạy — L2 (e2e)', () => {
  let app: INestApplication;
  const suf = uniqueSuffix();
  let dv: Awaited<ReturnType<typeof taoDonViTest>>;
  const nguoiDungIds: string[] = [];
  const hocVienIds: string[] = [];
  let khoaId: string;
  let khoaKhacId: string;
  let lopId: string;
  let lopKhacId: string;
  let gdTrucTiep: string;
  let gdTrucTuyen: string;
  let tokenHtGv: string;
  let tokenHtHv: string;

  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  // Ngày mai 08:00 giờ VN — nằm trong cửa sổ mặc định 14 ngày.
  const mai = new Date(Date.now() + 24 * 3600 * 1000);
  mai.setUTCHours(1, 0, 0, 0);

  async function taoNd(
    vaiTro: 'ho_tro_giang_vien' | 'ho_tro_hoc_vien',
    ten: string,
  ) {
    const nd = await prisma.nguoi_dung.create({
      data: {
        ho_ten: ten,
        ten_dang_nhap: `${ten}-${suf}`.toLowerCase(),
        email: `${ten}-${suf}@tl.vn`.toLowerCase(),
        vai_tro: vaiTro,
        mat_khau_hash: await bcrypt.hash('MatKhau123', 4),
        phai_doi_mat_khau: false,
      },
    });
    nguoiDungIds.push(nd.id);
    const res = await http()
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap: nd.ten_dang_nhap, mat_khau: 'MatKhau123' })
      .expect(200);
    return { nd, token: res.body.token as string };
  }

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    dv = await taoDonViTest('tl');
    const taoKhoa = (ma: string) =>
      prisma.khoa_boi_duong.create({
        data: {
          ma_khoa: `${ma}-${suf}`.slice(0, 30),
          ten_khoa: ma,
          don_vi_dat_hang_id: dv.donVi.id,
          thoi_gian_bat_dau: new Date('2026-01-01'),
          thoi_gian_ket_thuc: new Date('2027-12-31'),
          trang_thai: 'da_duyet',
        },
      });
    const khoa = await taoKhoa('K-TL');
    const khoaKhac = await taoKhoa('K-TLX');
    khoaId = khoa.id;
    khoaKhacId = khoaKhac.id;
    const gd = (
      khoa_id: string,
      thu_tu: number,
      hinh_thuc: 'truc_tiep' | 'truc_tuyen',
    ) =>
      prisma.giai_doan_khoa.create({
        data: {
          khoa_id,
          thu_tu,
          ten_giai_doan: `GĐ ${thu_tu}`,
          hinh_thuc,
          thoi_gian_bat_dau: new Date('2026-01-01'),
          thoi_gian_ket_thuc: new Date('2027-12-31'),
        },
      });
    gdTrucTiep = (await gd(khoaId, 1, 'truc_tiep')).id;
    gdTrucTuyen = (await gd(khoaId, 2, 'truc_tuyen')).id;
    lopId = (
      await prisma.lop_hoc.create({
        data: { khoa_id: khoaId, loai_lop: 'truc_tiep', ten_lop: 'Lớp TL' },
      })
    ).id;
    lopKhacId = (
      await prisma.lop_hoc.create({
        data: {
          khoa_id: khoaKhacId,
          loai_lop: 'truc_tiep',
          ten_lop: 'Lớp khác',
        },
      })
    ).id;
    const dh = await prisma.diem_hoc.create({
      data: {
        ma_diem_hoc: `TL-${suf}`.slice(0, 30),
        ten: 'THPT Điểm học TL',
        dia_chi: '9 Đường TL',
        dia_ban_id: dv.diaDanhXa.id,
      },
    });
    const buoi = await prisma.lich_hoc_lop.create({
      data: {
        lop_id: lopId,
        giai_doan_id: gdTrucTiep,
        buoi_so: 1,
        thoi_gian_bat_dau: mai,
        thoi_gian_ket_thuc: new Date(mai.getTime() + 3 * 3600 * 1000),
        diem_hoc_id: dh.id,
        phong: 'P.7',
      },
    });
    await prisma.lich_hoc_lop.create({
      data: {
        lop_id: lopId,
        giai_doan_id: gdTrucTuyen,
        buoi_so: 1,
        thoi_gian_bat_dau: new Date(mai.getTime() + 2 * 24 * 3600 * 1000),
        thoi_gian_ket_thuc: new Date(
          mai.getTime() + 2 * 24 * 3600 * 1000 + 3600 * 1000,
        ),
      },
    });
    const gv = await prisma.giang_vien.create({
      data: {
        ho_ten: 'GV Trang Lớp',
        so_dien_thoai: `08${String(Date.now()).slice(-8)}`,
      },
    });
    await prisma.phan_cong_giang_day.create({
      data: {
        lich_hoc_id: buoi.id,
        giang_vien_id: gv.id,
        vai_tro: 'giang_vien',
        so_gio: 3,
      },
    });

    const htGv = await taoNd('ho_tro_giang_vien', 'tlgv');
    const htHv = await taoNd('ho_tro_hoc_vien', 'tlhv');
    tokenHtGv = htGv.token;
    tokenHtHv = htHv.token;
    await prisma.phan_cong_ho_tro_gv.create({
      data: { nguoi_dung_id: htGv.nd.id, khoa_id: khoaId },
    });
    const cum = await prisma.cum_hoc_vien.create({
      data: { khoa_id: khoaId, ten_cum: 'Cụm TL' },
    });
    await prisma.phan_cong_ho_tro.create({
      data: { nguoi_dung_id: htHv.nd.id, cum_id: cum.id },
    });
    const hv = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: `MOET-TL-${suf}`,
        ho_ten: 'Học Viên TL',
        ngay_sinh: 1,
        thang_sinh: 1,
        nam_sinh: NAM,
        don_vi_cong_tac_id: dv.donVi.id,
        so_dien_thoai_lien_he: '0912345000',
        trang_thai: 'nhap',
      },
    });
    hocVienIds.push(hv.id);
    const dk = await prisma.dang_ky_hoc.create({
      data: {
        hoc_vien_id: hv.id,
        khoa_id: khoaId,
        trang_thai: 'da_duyet',
        cum_id: cum.id,
      },
    });
    await prisma.phan_lop_giai_doan.create({
      data: { dang_ky_hoc_id: dk.id, giai_doan_id: gdTrucTiep, lop_id: lopId },
    });
  });

  afterAll(async () => {
    await prisma.phan_lop_giai_doan.deleteMany({
      where: { dang_ky_hoc: { khoa_id: { in: [khoaId, khoaKhacId] } } },
    });
    await prisma.dang_ky_hoc.deleteMany({
      where: { khoa_id: { in: [khoaId, khoaKhacId] } },
    });
    await prisma.lich_hoc_lop.deleteMany({
      where: { lop: { khoa_id: { in: [khoaId, khoaKhacId] } } },
    });
    await prisma.giang_vien.deleteMany({ where: { ho_ten: 'GV Trang Lớp' } });
    await prisma.diem_hoc.deleteMany({
      where: { ma_diem_hoc: `TL-${suf}`.slice(0, 30) },
    });
    await prisma.khoa_boi_duong.deleteMany({
      where: { id: { in: [khoaId, khoaKhacId] } },
    });
    await prisma.hoc_vien.deleteMany({ where: { id: { in: hocVienIds } } });
    for (const id of nguoiDungIds) await xoaNguoiDungTest(id);
    await xoaDonViTest([dv.donVi.id], [dv.diaDanhXa.id, dv.diaDanhTinh.id]);
    await prisma.$disconnect();
    await app.close();
  });

  it('danh sách đợt của lớp: chỉ giai đoạn trực tiếp có buổi', async () => {
    const res = await http()
      .get(`/ho-tro-giang-vien/lop/${lopId}/dot`)
      .set(auth(tokenHtGv))
      .expect(200);
    expect(res.body.dot.map((d: { id: string }) => d.id)).toEqual([gdTrucTiep]);
    expect(res.body.dot[0].so_buoi).toBe(1);
  });

  it('Hồ sơ chuẩn bị lớp: đủ buổi + điểm học + giảng viên (có SĐT) + học viên (có SĐT, cụm, người hỗ trợ HV) + nhóm hỗ trợ GV', async () => {
    const res = await http()
      .get(`/ho-tro-giang-vien/lop/${lopId}/giai-doan/${gdTrucTiep}`)
      .set(auth(tokenHtGv))
      .expect(200);
    expect(res.body.buoi).toHaveLength(1);
    expect(res.body.buoi[0].phong).toBe('P.7');
    expect(res.body.buoi[0].diem_hoc.ten).toBe('THPT Điểm học TL');
    expect(res.body.buoi[0].giang_vien[0]).toEqual(
      expect.objectContaining({
        ho_ten: 'GV Trang Lớp',
        so_gio: 3,
        so_dien_thoai: expect.any(String),
      }),
    );
    expect(res.body.hoc_vien).toHaveLength(1);
    expect(res.body.hoc_vien[0]).toEqual(
      expect.objectContaining({
        ho_ten: 'Học Viên TL',
        so_dien_thoai: '0912345000',
        cum: expect.objectContaining({
          ten_cum: 'Cụm TL',
          nguoi_ho_tro: [expect.objectContaining({ ho_ten: 'tlhv' })],
        }),
      }),
    );
    expect(res.body.nhom_ho_tro_gv).toEqual([
      expect.objectContaining({ ho_ten: 'tlgv' }),
    ]);
    expect(JSON.stringify(res.body)).not.toContain('MOET-TL');
  });

  it('giai đoạn không trực tiếp → 404; lớp của khóa ngoài nhóm → 404', async () => {
    await http()
      .get(`/ho-tro-giang-vien/lop/${lopId}/giai-doan/${gdTrucTuyen}`)
      .set(auth(tokenHtGv))
      .expect(404);
    await http()
      .get(`/ho-tro-giang-vien/lop/${lopKhacId}/dot`)
      .set(auth(tokenHtGv))
      .expect(404);
  });

  it('lịch dạy 14 ngày tới: có buổi của lớp trong phạm vi kèm điểm học + giảng viên', async () => {
    const res = await http()
      .get('/ho-tro-giang-vien/lich-day')
      .set(auth(tokenHtGv))
      .expect(200);
    const b = res.body.find((x: { lop: { id: string } }) => x.lop.id === lopId);
    expect(b.diem_hoc.ten).toBe('THPT Điểm học TL');
    expect(b.phan_cong[0].giang_vien.ho_ten).toBe('GV Trang Lớp');
    expect(
      res.body.some((x: { lop: { id: string } }) => x.lop.id === lopKhacId),
    ).toBe(false);
  });

  it('K5: lịch học của người hỗ trợ học viên có điểm học, phòng, nhóm hỗ trợ GV — không có hậu cần/SĐT giảng viên', async () => {
    const res = await http()
      .get('/ho-tro-hoc-vien/lich-hoc')
      .set(auth(tokenHtHv))
      .expect(200);
    const b = res.body.find((x: { lop: { id: string } }) => x.lop.id === lopId);
    expect(b.diem_hoc.ten).toBe('THPT Điểm học TL');
    expect(b.phong).toBe('P.7');
    expect(b.nhom_ho_tro_gv).toEqual([
      expect.objectContaining({ ho_ten: 'tlgv' }),
    ]);
    expect(b).not.toHaveProperty('hau_can');
    expect(JSON.stringify(b)).not.toContain('GV Trang Lớp');
  });
});
