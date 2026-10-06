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

const NGAY = 24 * 3600 * 1000;

// ADR 0004 L4 (issue #17): bảng kiểm động theo khóa + Việc cần làm.
describe('Bảng kiểm chuẩn bị — L4 (e2e)', () => {
  let app: INestApplication;
  const suf = uniqueSuffix();
  let dv: Awaited<ReturnType<typeof taoDonViTest>>;
  let quanTri: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let tokenQT: string;
  let tokenHt: string;
  const nguoiDungIds: string[] = [];
  const khoaIds: string[] = [];
  const mucMacDinhTam: string[] = [];
  const dot: Record<
    'A' | 'B',
    { lopId: string; gdId: string; khoaId: string }
  > = {} as never;

  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const dangNhap = async (ten: string, mk: string) =>
    (
      await http()
        .post('/auth/dang-nhap')
        .send({ ten_dang_nhap: ten, mat_khau: mk })
        .expect(200)
    ).body.token as string;

  async function taoDot(nhan: 'A' | 'B') {
    const khoa = await prisma.khoa_boi_duong.create({
      data: {
        ma_khoa: `K-BK${nhan}-${suf}`.slice(0, 30),
        ten_khoa: `Khóa ${nhan}`,
        don_vi_dat_hang_id: dv.donVi.id,
        thoi_gian_bat_dau: new Date('2026-01-01'),
        thoi_gian_ket_thuc: new Date('2027-12-31'),
        trang_thai: 'da_duyet',
      },
    });
    khoaIds.push(khoa.id);
    const gd = await prisma.giai_doan_khoa.create({
      data: {
        khoa_id: khoa.id,
        thu_tu: 1,
        ten_giai_doan: 'Trực tiếp',
        hinh_thuc: 'truc_tiep',
        thoi_gian_bat_dau: new Date('2026-01-01'),
        thoi_gian_ket_thuc: new Date('2027-12-31'),
      },
    });
    const lop = await prisma.lop_hoc.create({
      data: { khoa_id: khoa.id, loai_lop: 'truc_tiep', ten_lop: `Lớp ${nhan}` },
    });
    const dh = await prisma.diem_hoc.create({
      data: {
        ma_diem_hoc: `BK${nhan}-${suf}`.slice(0, 30),
        ten: `ĐH ${nhan}`,
        dia_chi: 'x',
        dia_ban_id: dv.diaDanhXa.id,
      },
    });
    // Buổi sau 10 ngày, có điểm học, CHƯA có giảng viên (hạn mặc định 14 ngày → quá hạn).
    const bd = new Date(Date.now() + 10 * NGAY);
    await prisma.lich_hoc_lop.create({
      data: {
        lop_id: lop.id,
        giai_doan_id: gd.id,
        thoi_gian_bat_dau: bd,
        thoi_gian_ket_thuc: new Date(bd.getTime() + 3 * 3600 * 1000),
        diem_hoc_id: dh.id,
      },
    });
    dot[nhan] = { lopId: lop.id, gdId: gd.id, khoaId: khoa.id };
  }

  const bangKiem = (nhan: 'A' | 'B') =>
    http()
      .get(
        `/ho-tro-giang-vien/lop/${dot[nhan].lopId}/giai-doan/${dot[nhan].gdId}/bang-kiem`,
      )
      .set(auth(tokenHt));

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    dv = await taoDonViTest('bk');
    quanTri = await taoNguoiDungTest({
      vai_tro: 'quan_tri',
      don_vi_id: dv.donVi.id,
      mat_khau: 'MatKhau123',
    });
    tokenQT = await dangNhap(quanTri.ten_dang_nhap, 'MatKhau123');
    await taoDot('A');
    await taoDot('B');
    const nd = await prisma.nguoi_dung.create({
      data: {
        ho_ten: 'Hỗ trợ BK',
        ten_dang_nhap: `bk-${suf}`.toLowerCase(),
        email: `bk-${suf}@bk.vn`.toLowerCase(),
        vai_tro: 'ho_tro_giang_vien',
        mat_khau_hash: await bcrypt.hash('MatKhau123', 4),
        phai_doi_mat_khau: false,
      },
    });
    nguoiDungIds.push(nd.id);
    await prisma.phan_cong_ho_tro_gv.createMany({
      data: [dot.A.khoaId, dot.B.khoaId].map((khoa_id) => ({
        nguoi_dung_id: nd.id,
        khoa_id,
      })),
    });
    tokenHt = await dangNhap(nd.ten_dang_nhap, 'MatKhau123');
  });

  afterAll(async () => {
    await prisma.muc_kiem_tra.deleteMany({
      where: { id: { in: mucMacDinhTam } },
    });
    await prisma.lich_hoc_lop.deleteMany({
      where: { lop: { khoa_id: { in: khoaIds } } },
    });
    await prisma.khoa_boi_duong.deleteMany({ where: { id: { in: khoaIds } } });
    await prisma.diem_hoc.deleteMany({
      where: { dia_ban_id: dv.diaDanhXa.id },
    });
    for (const id of nguoiDungIds) await xoaNguoiDungTest(id);
    await xoaNguoiDungTest(quanTri.nguoiDung.id);
    await xoaDonViTest([dv.donVi.id], [dv.diaDanhXa.id, dv.diaDanhTinh.id]);
    await prisma.$disconnect();
    await app.close();
  });

  it('bộ mặc định có các quy tắc tự động đã seed + danh mục quy tắc', async () => {
    const res = await http()
      .get('/bang-kiem/mac-dinh')
      .set(auth(tokenQT))
      .expect(200);
    expect(res.body.nguon).toBe('mac_dinh');
    const ma = res.body.muc.map(
      (m: { ma_quy_tac: string | null }) => m.ma_quy_tac,
    );
    expect(ma).toEqual(
      expect.arrayContaining([
        'co_diem_hoc',
        'co_giang_vien',
        'hau_can_da_xac_nhan',
        'co_thuc_dia',
      ]),
    );
    const qt = await http()
      .get('/bang-kiem/quy-tac')
      .set(auth(tokenQT))
      .expect(200);
    expect(qt.body.length).toBeGreaterThanOrEqual(7);
  });

  it('K12: đợt A dùng bộ mặc định; điểm học đạt, giảng viên quá hạn → màu đỏ, kèm lý do', async () => {
    const res = await bangKiem('A').expect(200);
    expect(res.body.nguon).toBe('mac_dinh');
    expect(res.body.mau).toBe('do');
    const theoMa = (ma: string) =>
      res.body.muc.find((m: { ma_quy_tac: string }) => m.ma_quy_tac === ma);
    expect(theoMa('co_diem_hoc').trang_thai).toBe('dat');
    expect(theoMa('co_giang_vien')).toEqual(
      expect.objectContaining({
        trang_thai: 'qua_han',
        ly_do: expect.stringContaining('Buổi 1'),
      }),
    );
  });

  it('Việc cần làm: có đợt A, B (màu đỏ) sắp theo buổi đầu; số đếm đỏ ≥ 2', async () => {
    const res = await http()
      .get('/ho-tro-giang-vien/viec-can-lam')
      .set(auth(tokenHt))
      .expect(200);
    const cua = res.body.filter((d: { lop: { id: string } }) =>
      [dot.A.lopId, dot.B.lopId].includes(d.lop.id),
    );
    expect(cua).toHaveLength(2);
    expect(cua[0].mau).toBe('do');
    expect(cua[0].muc_chua_dat.length).toBeGreaterThan(0);
    const dem = await http()
      .get('/ho-tro-giang-vien/viec-can-lam/dem')
      .set(auth(tokenHt))
      .expect(200);
    expect(dem.body.do).toBeGreaterThanOrEqual(2);
  });

  it('mục thủ công: đánh dấu xong → đạt; đánh dấu mục tự động → 400', async () => {
    const res = await bangKiem('A').expect(200);
    const thuCong = res.body.muc.find(
      (m: { loai: string }) => m.loai === 'thu_cong',
    );
    const tuDong = res.body.muc.find(
      (m: { loai: string }) => m.loai === 'tu_dong',
    );
    const url = (id: string) =>
      `/ho-tro-giang-vien/lop/${dot.A.lopId}/giai-doan/${dot.A.gdId}/bang-kiem/${id}`;
    await http()
      .put(url(thuCong.muc_id))
      .set(auth(tokenHt))
      .send({ da_xong: true, ghi_chu: 'Đã gửi Zalo' })
      .expect(200);
    await http()
      .put(url(tuDong.muc_id))
      .set(auth(tokenHt))
      .send({ da_xong: true })
      .expect(400);
    const sau = await bangKiem('A').expect(200);
    expect(
      sau.body.muc.find((m: { muc_id: string }) => m.muc_id === thuCong.muc_id),
    ).toEqual(
      expect.objectContaining({
        trang_thai: 'dat',
        ghi_chu: 'Đã gửi Zalo',
        cap_nhat_boi: 'Hỗ trợ BK',
      }),
    );
  });

  it('K10b: khóa chưa tùy chỉnh thêm mục → 409; tùy chỉnh → sao chép; sửa bộ mặc định KHÔNG ảnh hưởng khóa đã tùy chỉnh', async () => {
    await http()
      .post(`/bang-kiem/khoa/${dot.A.khoaId}/muc`)
      .set(auth(tokenQT))
      .send({ ten: 'X', loai: 'thu_cong' })
      .expect(409);
    const tc = await http()
      .post(`/bang-kiem/khoa/${dot.A.khoaId}/tuy-chinh`)
      .set(auth(tokenQT))
      .expect(201);
    expect(tc.body.nguon).toBe('rieng');
    await http()
      .post(`/bang-kiem/khoa/${dot.A.khoaId}/tuy-chinh`)
      .set(auth(tokenQT))
      .expect(409);
    await http()
      .post(`/bang-kiem/khoa/${dot.A.khoaId}/muc`)
      .set(auth(tokenQT))
      .send({ ten: 'Đã in tài liệu', loai: 'thu_cong', han_truoc_ngay: 2 })
      .expect(201);

    const moi = await http()
      .post('/bang-kiem/mac-dinh/muc')
      .set(auth(tokenQT))
      .send({ ten: `Mục mặc định tạm ${suf}`, loai: 'thu_cong' })
      .expect(201);
    mucMacDinhTam.push(moi.body.id);
    const a = await bangKiem('A').expect(200);
    const b = await bangKiem('B').expect(200);
    const coMucTam = (muc: { ten: string }[]) =>
      muc.some((m) => m.ten === `Mục mặc định tạm ${suf}`);
    expect(a.body.nguon).toBe('rieng');
    expect(coMucTam(a.body.muc)).toBe(false);
    expect(
      a.body.muc.some((m: { ten: string }) => m.ten === 'Đã in tài liệu'),
    ).toBe(true);
    expect(b.body.nguon).toBe('mac_dinh');
    expect(coMucTam(b.body.muc)).toBe(true);
  });

  it('K10d: ngưng mục đã có trạng thái → ẩn khỏi bảng kiểm, dữ liệu còn trong DB', async () => {
    const a = await bangKiem('A').expect(200);
    const muc = a.body.muc.find(
      (m: { ten: string }) => m.ten === 'Đã in tài liệu',
    );
    await http()
      .put(
        `/ho-tro-giang-vien/lop/${dot.A.lopId}/giai-doan/${dot.A.gdId}/bang-kiem/${muc.muc_id}`,
      )
      .set(auth(tokenHt))
      .send({ da_xong: true })
      .expect(200);
    await http()
      .patch(`/bang-kiem/muc/${muc.muc_id}`)
      .set(auth(tokenQT))
      .send({ trang_thai: 'ngung' })
      .expect(200);
    const sau = await bangKiem('A').expect(200);
    expect(
      sau.body.muc.some((m: { muc_id: string }) => m.muc_id === muc.muc_id),
    ).toBe(false);
    expect(
      await prisma.trang_thai_muc_kiem_tra.count({
        where: { muc_id: muc.muc_id },
      }),
    ).toBe(1);
  });

  it('mục tự động với quy tắc lạ → 400; đổi loại mục → 400; người hỗ trợ GV gọi /bang-kiem → 403', async () => {
    await http()
      .post('/bang-kiem/mac-dinh/muc')
      .set(auth(tokenQT))
      .send({ ten: 'Y', loai: 'tu_dong', ma_quy_tac: 'khong_co' })
      .expect(400);
    const ds = await http()
      .get(`/bang-kiem/khoa/${dot.A.khoaId}`)
      .set(auth(tokenQT))
      .expect(200);
    await http()
      .patch(`/bang-kiem/muc/${ds.body.muc[0].id}`)
      .set(auth(tokenQT))
      .send({ loai: 'thu_cong' })
      .expect(400);
    await http().get('/bang-kiem/mac-dinh').set(auth(tokenHt)).expect(403);
  });
});
