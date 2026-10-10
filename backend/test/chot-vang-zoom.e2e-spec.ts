import { INestApplication } from '@nestjs/common';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoDonViTest,
  uniqueSuffix,
  xoaDonViTest,
} from './utils/test-data';
import { ChotVangZoomProcessor } from '../src/khoa-boi-duong/chot-vang-zoom.processor';

const PHUT = 60 * 1000;
const GIO = 60 * PHUT;
const LINK = 'https://zoom.us/j/123';

// ADR 0005 Z6 (issue #25): cron chốt vắng buổi Zoom. Gọi thẳng
// processor.chotVang(now) với `now` cố định. now = giờ thật + 2 ngày để mọi
// buổi fixture còn ở tương lai so với giờ thật — cron của tiến trình khác
// (dev server, e2e song song) không đụng vào fixture. DB dùng chung: assert
// chỉ trên id của fixture.
describe('Chốt vắng Zoom — Z6 (e2e)', () => {
  let app: INestApplication;
  let processor: ChotVangZoomProcessor;
  const suf = uniqueSuffix();
  const now = new Date(Math.floor((Date.now() + 48 * GIO) / 1000) * 1000);
  const truoc = (ms: number) => new Date(now.getTime() - ms);
  let dv: Awaited<ReturnType<typeof taoDonViTest>>;
  const khoaIds: string[] = [];
  const hocVienIds: string[] = [];
  const buoi: Record<string, string> = {};
  const dk: Record<string, string> = {};
  let ketQua1: { so_buoi: number; so_dong_vang: number };
  let khoaChinh: string;
  let gd1: string;
  let lopZ: string;

  async function taoKhoa(
    ma: string,
    cauHinh: { bat: Date | null; dongSau?: number },
  ) {
    const k = await prisma.khoa_boi_duong.create({
      data: {
        ma_khoa: `CVZ${ma}-${suf}`.slice(0, 30),
        ten_khoa: `Khóa CVZ ${ma}`,
        don_vi_dat_hang_id: dv.donVi.id,
        thoi_gian_bat_dau: new Date('2026-01-01'),
        thoi_gian_ket_thuc: new Date('2028-12-31'),
        trang_thai: 'da_duyet',
        bat_diem_danh_zoom_luc: cauHinh.bat,
        ...(cauHinh.dongSau
          ? { diem_danh_dong_sau_phut: cauHinh.dongSau }
          : {}),
      },
    });
    khoaIds.push(k.id);
    return k.id;
  }

  const taoGiaiDoan = async (khoaId: string, thuTu: number) =>
    (
      await prisma.giai_doan_khoa.create({
        data: {
          khoa_id: khoaId,
          thu_tu: thuTu,
          ten_giai_doan: `GĐ ${thuTu}`,
          hinh_thuc: 'truc_tuyen',
          thoi_gian_bat_dau: new Date('2026-01-01'),
          thoi_gian_ket_thuc: new Date('2028-12-31'),
        },
      })
    ).id;

  const taoLop = async (
    khoaId: string,
    ten: string,
    loai: 'zoom' | 'truc_tiep' = 'zoom',
  ) =>
    (
      await prisma.lop_hoc.create({
        data: { khoa_id: khoaId, loai_lop: loai, ten_lop: ten },
      })
    ).id;

  const taoBuoi = async (
    ten: string,
    lop: string,
    gd: string,
    so: number,
    batDau: Date,
    link: string | null = LINK,
  ) => {
    buoi[ten] = (
      await prisma.lich_hoc_lop.create({
        data: {
          lop_id: lop,
          giai_doan_id: gd,
          buoi_so: so,
          thoi_gian_bat_dau: batDau,
          thoi_gian_ket_thuc: new Date(batDau.getTime() + 2 * GIO),
          dia_diem_hoac_link: link,
        },
      })
    ).id;
  };

  async function taoHv(
    ma: string,
    khoaId: string,
    phanLop: { gd: string; lop: string }[],
  ) {
    const h = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: `CV${ma}${suf}`.slice(0, 20),
        ho_ten: `HV ${ma}`,
        ngay_sinh: 1,
        thang_sinh: 1,
        nam_sinh: 1990,
        don_vi_cong_tac_id: dv.donVi.id,
        trang_thai: 'nhap',
      },
    });
    hocVienIds.push(h.id);
    const d = await prisma.dang_ky_hoc.create({
      data: { hoc_vien_id: h.id, khoa_id: khoaId, trang_thai: 'da_duyet' },
    });
    for (const p of phanLop) {
      await prisma.phan_lop_giai_doan.create({
        data: { dang_ky_hoc_id: d.id, giai_doan_id: p.gd, lop_id: p.lop },
      });
    }
    dk[ma] = d.id;
  }

  const dongDiemDanh = (ma: string, tenBuoi: string) =>
    prisma.diem_danh.findUnique({
      where: {
        dang_ky_hoc_id_lich_hoc_id: {
          dang_ky_hoc_id: dk[ma],
          lich_hoc_id: buoi[tenBuoi],
        },
      },
    });
  const chotLuc = async (tenBuoi: string) =>
    (
      await prisma.lich_hoc_lop.findUniqueOrThrow({
        where: { id: buoi[tenBuoi] },
      })
    ).chot_diem_danh_luc;
  const demDong = (tenBuoi: string) =>
    prisma.diem_danh.count({ where: { lich_hoc_id: buoi[tenBuoi] } });
  const demDongCuaToi = () =>
    prisma.diem_danh.count({
      where: { lich_hoc_id: { in: Object.values(buoi) } },
    });

  beforeAll(async () => {
    app = await createTestApp();
    processor = app.get(ChotVangZoomProcessor);
    dv = await taoDonViTest('cvz');

    // Khóa chính: bật từ now − 10h, cửa sổ mặc định (đóng sau 120 phút).
    khoaChinh = await taoKhoa('A', { bat: truoc(10 * GIO) });
    gd1 = await taoGiaiDoan(khoaChinh, 1);
    const gd2 = await taoGiaiDoan(khoaChinh, 2);
    lopZ = await taoLop(khoaChinh, 'Zoom 1');
    const lopZ2 = await taoLop(khoaChinh, 'Zoom 2');
    const lopTT = await taoLop(khoaChinh, 'Trực tiếp', 'truc_tiep');
    await taoBuoi('dong', lopZ, gd1, 1, truoc(121 * PHUT));
    await taoBuoi('dungDong', lopZ, gd1, 2, truoc(120 * PHUT));
    await taoBuoi('dangMo', lopZ, gd1, 3, truoc(30 * PHUT));
    await taoBuoi('khongLink', lopZ, gd1, 4, truoc(3 * GIO), null);
    await taoBuoi('linkTrong', lopZ, gd1, 5, truoc(3 * GIO), '   ');
    await taoBuoi('truocMoc', lopZ, gd1, 6, truoc(11 * GIO));
    await taoBuoi('lopZ2', lopZ2, gd1, 1, truoc(3 * GIO));
    await taoBuoi('gd2', lopZ, gd2, 1, truoc(3 * GIO));
    await taoBuoi('trucTiep', lopTT, gd1, 1, truoc(3 * GIO));

    // Khóa cấu hình riêng: đóng sau 30 phút.
    const khoa30 = await taoKhoa('B', {
      bat: truoc(10 * GIO),
      dongSau: 30,
    });
    const gd30 = await taoGiaiDoan(khoa30, 1);
    const lop30 = await taoLop(khoa30, 'Zoom 30');
    await taoBuoi('dong30', lop30, gd30, 1, truoc(31 * PHUT));
    await taoBuoi('mo30', lop30, gd30, 2, truoc(30 * PHUT));

    // Khóa chưa bật.
    const khoaTat = await taoKhoa('C', { bat: null });
    const gdTat = await taoGiaiDoan(khoaTat, 1);
    const lopTat = await taoLop(khoaTat, 'Zoom tắt');
    await taoBuoi('khoaTat', lopTat, gdTat, 1, truoc(3 * GIO));

    await taoHv('vang', khoaChinh, [{ gd: gd1, lop: lopZ }]);
    await taoHv('baoVang', khoaChinh, [{ gd: gd1, lop: lopZ }]);
    await taoHv('coMat', khoaChinh, [{ gd: gd1, lop: lopZ }]);
    await taoHv('lopKhac', khoaChinh, [{ gd: gd1, lop: lopZ2 }]);
    await taoHv('gdKhac', khoaChinh, [
      { gd: gd2, lop: lopZ },
      { gd: gd1, lop: lopTT },
    ]);
    await taoHv('hv30', khoa30, [{ gd: gd30, lop: lop30 }]);
    await taoHv('hvTat', khoaTat, [{ gd: gdTat, lop: lopTat }]);

    await prisma.bao_vang.create({
      data: {
        dang_ky_hoc_id: dk.baoVang,
        lich_hoc_id: buoi.dong,
        ly_do: 'Ốm',
      },
    });
    await prisma.diem_danh.create({
      data: {
        dang_ky_hoc_id: dk.coMat,
        lich_hoc_id: buoi.dong,
        trang_thai: 'co_mat',
        nguon: 'zoom',
        tu_diem_danh_luc: truoc(150 * PHUT),
        cap_nhat_luc: truoc(150 * PHUT),
      },
    });

    ketQua1 = await processor.chotVang(now);
  });

  afterAll(async () => {
    await prisma.dang_ky_hoc.deleteMany({
      where: { khoa_id: { in: khoaIds } },
    });
    await prisma.hoc_vien.deleteMany({ where: { id: { in: hocVienIds } } });
    await prisma.lich_hoc_lop.deleteMany({
      where: { lop: { khoa_id: { in: khoaIds } } },
    });
    await prisma.khoa_boi_duong.deleteMany({ where: { id: { in: khoaIds } } });
    await xoaDonViTest([dv.donVi.id], [dv.diaDanhXa.id, dv.diaDanhTinh.id]);
    await prisma.$disconnect();
    await app.close();
  });

  it('hết cửa sổ: học viên chưa có dòng → vang (nguon zoom), có báo vắng → vang_co_phep, đã tự điểm danh giữ nguyên; đánh dấu chot_diem_danh_luc', async () => {
    const vang = await dongDiemDanh('vang', 'dong');
    expect(vang).toMatchObject({ trang_thai: 'vang', nguon: 'zoom' });
    expect(vang!.cap_nhat_luc.getTime()).toBe(now.getTime());
    expect(vang!.tu_diem_danh_luc).toBeNull();

    expect(await dongDiemDanh('baoVang', 'dong')).toMatchObject({
      trang_thai: 'vang_co_phep',
      nguon: 'zoom',
    });

    const coMat = await dongDiemDanh('coMat', 'dong');
    expect(coMat).toMatchObject({ trang_thai: 'co_mat' });
    expect(coMat!.cap_nhat_luc.getTime()).toBe(truoc(150 * PHUT).getTime());

    expect((await chotLuc('dong'))?.getTime()).toBe(now.getTime());
    expect(await demDong('dong')).toBe(3);

    // Kết quả trả về tính cả buổi của dữ liệu khác trên DB dùng chung.
    expect(ketQua1.so_buoi).toBeGreaterThanOrEqual(4);
    expect(ketQua1.so_dong_vang).toBeGreaterThanOrEqual(5);
  });

  it('học viên lớp khác cùng giai đoạn / cùng lớp giai đoạn khác → không bị chốt ở buổi này', async () => {
    expect(await dongDiemDanh('lopKhac', 'dong')).toBeNull();
    expect(await dongDiemDanh('gdKhac', 'dong')).toBeNull();
    // ...nhưng được chốt ở buổi đúng lớp/giai đoạn của mình.
    expect(await dongDiemDanh('lopKhac', 'lopZ2')).toMatchObject({
      trang_thai: 'vang',
    });
    expect(await dongDiemDanh('gdKhac', 'gd2')).toMatchObject({
      trang_thai: 'vang',
    });
    expect(await demDong('gd2')).toBe(1);
    expect(await demDong('lopZ2')).toBe(1);
  });

  it('cửa sổ còn mở (kể cả đúng mốc đóng) → không chốt', async () => {
    for (const ten of ['dungDong', 'dangMo', 'mo30']) {
      expect(await chotLuc(ten)).toBeNull();
      expect(await demDong(ten)).toBe(0);
    }
  });

  it('cấu hình riêng của khóa (đóng sau 30 phút) được tôn trọng', async () => {
    expect((await chotLuc('dong30'))?.getTime()).toBe(now.getTime());
    expect(await dongDiemDanh('hv30', 'dong30')).toMatchObject({
      trang_thai: 'vang',
      nguon: 'zoom',
    });
  });

  it('bỏ qua: buổi không link / link trống / bắt đầu trước mốc bật / khóa chưa bật / lớp không phải Zoom', async () => {
    for (const ten of [
      'khongLink',
      'linkTrong',
      'truocMoc',
      'khoaTat',
      'trucTiep',
    ]) {
      expect(await chotLuc(ten)).toBeNull();
      expect(await demDong(ten)).toBe(0);
    }
  });

  it('chạy lại → không thêm dòng (không chốt 2 lần), không mở lại buổi đã chốt', async () => {
    const truocKhi = await demDongCuaToi();
    await processor.chotVang(now);
    await processor.chotVang(new Date(now.getTime() + 5 * PHUT));
    // Lượt +5 phút chỉ thêm buổi vừa hết cửa sổ: dungDong (3 HV) + mo30 (1 HV).
    expect(await demDong('dungDong')).toBe(3);
    expect(await demDong('mo30')).toBe(1);
    expect(await demDongCuaToi()).toBe(truocKhi + 4);
    expect((await chotLuc('dong'))?.getTime()).toBe(now.getTime());
    expect(await demDong('dong')).toBe(3);
  });

  it('học viên xếp lớp sau khi buổi đã chốt → không có dòng ở lượt sau', async () => {
    await taoHv('muon', khoaChinh, [{ gd: gd1, lop: lopZ }]);
    await processor.chotVang(new Date(now.getTime() + 10 * PHUT));
    expect(await dongDiemDanh('muon', 'dong')).toBeNull();
    expect(await dongDiemDanh('muon', 'dungDong')).toBeNull();
  });

  it('2 lượt chạy song song → mỗi học viên đúng 1 dòng', async () => {
    await taoBuoi('songSong', lopZ, gd1, 7, new Date(now.getTime() + GIO));
    const sau = new Date(now.getTime() + 4 * GIO);
    const [a, b] = await Promise.all([
      processor.chotVang(sau),
      processor.chotVang(sau),
    ]);
    expect(a.so_buoi + b.so_buoi).toBeGreaterThanOrEqual(2); // songSong + dangMo
    for (const ma of ['vang', 'baoVang', 'coMat', 'muon']) {
      expect(
        await prisma.diem_danh.count({
          where: { dang_ky_hoc_id: dk[ma], lich_hoc_id: buoi.songSong },
        }),
      ).toBe(1);
    }
    expect(await demDong('songSong')).toBe(4);
    expect((await chotLuc('songSong'))?.getTime()).toBe(sau.getTime());
  });

  it('tắt tính năng ở khóa → dừng chốt buổi mới, dữ liệu đã ghi giữ nguyên', async () => {
    await taoBuoi('sauKhiTat', lopZ, gd1, 8, new Date(now.getTime() + 5 * GIO));
    const truocKhi = await demDongCuaToi();
    await prisma.khoa_boi_duong.update({
      where: { id: khoaChinh },
      data: { bat_diem_danh_zoom_luc: null },
    });
    await processor.chotVang(new Date(now.getTime() + 10 * GIO));
    expect(await chotLuc('sauKhiTat')).toBeNull();
    expect(await demDong('sauKhiTat')).toBe(0);
    expect(await demDongCuaToi()).toBe(truocKhi);
    expect(await dongDiemDanh('vang', 'dong')).toMatchObject({
      trang_thai: 'vang',
    });
  });
});
