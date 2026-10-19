import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import * as ExcelJS from 'exceljs';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoDonViTest,
  uniqueSuffix,
  xoaDonViTest,
  xoaNguoiDungTest,
} from './utils/test-data';

// ADR 0008 L8: điểm danh trên DS THEO BUỔI (đọc tại chính buổi theo đăng ký
// của dòng — người đổi vào dùng đăng ký của họ) + chuyên cần "có mặt / đã diễn
// ra" trên DS LỚP (đổi ra khỏi buổi -> tính điểm danh ở buổi chốt).
//
// Lớp A (được gắn), lớp B. G1: A1 (−6 ngày), A2 (−3), A3 (+5); G2: A4 (−1).
// B1 (−4, G1), B2 (−2, G2).
// - An: A ở G1+G2. A1 có mặt tự điểm danh; A2 vắng; A4 có mặt thủ công → 2/3.
// - Bình: A ở G1+G2. Báo vắng A1; đổi ra A2 → B1, có mặt B1 → 1/3.
// - Cường: A ở G1, B ở G2. A1 có mặt (Zoom, không tự điểm danh); có mặt B2
//   (lớp khác, không tính) → 1/2.
// - Dũng: B ở G1, đổi vào A1 từ B1; có mặt A1 (Ký tên) theo đăng ký của Dũng.
// - Em: A ở G1, không có gì → 0/2.
describe('Người hỗ trợ lớp — điểm danh theo buổi & chuyên cần (e2e, ADR 0008 L8)', () => {
  let app: INestApplication;
  const suf = uniqueSuffix();
  const SUF = suf.toUpperCase();
  const hocVienIds: string[] = [];
  const dangKyIds: string[] = [];
  let khoaId: string;
  let ndId: string;
  let token: string;
  let dv: Awaited<ReturnType<typeof taoDonViTest>>;
  const lop = { a: '', b: '' };
  const lich: Record<'a1' | 'a2' | 'a3' | 'a4' | 'b1' | 'b2', string> = {
    a1: '',
    a2: '',
    a3: '',
    a4: '',
    b1: '',
    b2: '',
  };
  const batDau: Record<string, Date> = {};
  const dk = { an: '', binh: '', cuong: '', dung: '', em: '' };
  let gdG1 = '';
  let tuDiemDanhAn: Date;

  const http = () => request(app.getHttpServer());
  const get = (path: string) =>
    http()
      .get(path)
      .set({ Authorization: `Bearer ${token}` });
  const taiFile = (path: string) =>
    get(path)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
  const docFile = async (buf: Buffer) => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    return wb.worksheets[0];
  };
  const hang = (ws: ExcelJS.Worksheet, i: number) =>
    (ws.getRow(i).values as unknown[])
      .slice(1)
      .map((v) => (v == null ? '' : String(v)));
  const p2 = (n: number) => String(n).padStart(2, '0');
  const vn = (d: Date) => new Date(d.getTime() + 7 * 3600 * 1000);
  const gioVn = (d: Date) =>
    `${p2(vn(d).getUTCHours())}:${p2(vn(d).getUTCMinutes())}`;
  const ngayGioVn = (d: Date) => {
    const v = vn(d);
    return `${p2(v.getUTCDate())}/${p2(v.getUTCMonth() + 1)}/${v.getUTCFullYear()} ${gioVn(d)}`;
  };

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    dv = await taoDonViTest('htdd');
    const nd = await prisma.nguoi_dung.create({
      data: {
        ho_ten: 'Hỗ trợ điểm danh',
        ten_dang_nhap: `htdd-${suf}`,
        email: `htdd-${suf}@htdd.vn`,
        vai_tro: 'ho_tro_hoc_vien',
        mat_khau_hash: await bcrypt.hash('HoTro12345', 4),
        phai_doi_mat_khau: false,
      },
    });
    ndId = nd.id;
    const dn = await http()
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap: nd.ten_dang_nhap, mat_khau: 'HoTro12345' });
    token = dn.body.token as string;

    khoaId = (
      await prisma.khoa_boi_duong.create({
        data: {
          ma_khoa: `K-HTDD-${SUF}`,
          ten_khoa: `Khóa điểm danh ${suf}`,
          don_vi_dat_hang_id: dv.donVi.id,
          thoi_gian_bat_dau: new Date('2026-09-01'),
          thoi_gian_ket_thuc: new Date('2027-02-01'),
          trang_thai: 'da_duyet',
        },
      })
    ).id;
    const taoGd = async (thuTu: number) =>
      prisma.giai_doan_khoa.create({
        data: {
          khoa_id: khoaId,
          thu_tu: thuTu,
          ten_giai_doan: `Giai đoạn ${thuTu}`,
          hinh_thuc: 'truc_tuyen',
          thoi_gian_bat_dau: new Date('2026-09-01'),
          thoi_gian_ket_thuc: new Date('2027-01-31'),
        },
      });
    const g1 = await taoGd(1);
    gdG1 = g1.id;
    const g2 = await taoGd(2);
    const taoLop = async (ten: string) =>
      (
        await prisma.lop_hoc.create({
          data: { khoa_id: khoaId, loai_lop: 'zoom', ten_lop: ten },
        })
      ).id;
    lop.a = await taoLop('Zoom A');
    lop.b = await taoLop('Zoom B');
    await prisma.phan_cong_ho_tro_lop.create({
      data: { nguoi_dung_id: ndId, lop_id: lop.a },
    });
    const ngay = (n: number) => new Date(Date.now() + n * 24 * 3600 * 1000);
    const taoBuoi = async (
      k: keyof typeof lich,
      lopId: string,
      gdId: string,
      buoiSo: number,
      n: number,
    ) => {
      batDau[k] = ngay(n);
      lich[k] = (
        await prisma.lich_hoc_lop.create({
          data: {
            lop_id: lopId,
            giai_doan_id: gdId,
            buoi_so: buoiSo,
            thoi_gian_bat_dau: batDau[k],
            thoi_gian_ket_thuc: new Date(batDau[k].getTime() + 3 * 3600000),
          },
        })
      ).id;
    };
    await taoBuoi('a1', lop.a, g1.id, 1, -6);
    await taoBuoi('a2', lop.a, g1.id, 2, -3);
    await taoBuoi('a3', lop.a, g1.id, 3, 5);
    await taoBuoi('a4', lop.a, g2.id, 1, -1);
    await taoBuoi('b1', lop.b, g1.id, 1, -4);
    await taoBuoi('b2', lop.b, g2.id, 1, -2);

    const phanLop: [keyof typeof dk, string, [string, string][]][] = [
      [
        'an',
        'Nguyễn An',
        [
          [g1.id, lop.a],
          [g2.id, lop.a],
        ],
      ],
      [
        'binh',
        'Trần Bình',
        [
          [g1.id, lop.a],
          [g2.id, lop.a],
        ],
      ],
      [
        'cuong',
        'Lê Cường',
        [
          [g1.id, lop.a],
          [g2.id, lop.b],
        ],
      ],
      ['dung', 'Phạm Dũng', [[g1.id, lop.b]]],
      ['em', 'Võ Em', [[g1.id, lop.a]]],
    ];
    for (const [k, hoTen, cap] of phanLop) {
      const h = await prisma.hoc_vien.create({
        data: {
          nguon_tao: 'import_moet',
          ma_dinh_danh_moet: `0HTDD-${k}-${SUF}`,
          ho_ten: hoTen,
          ngay_sinh: 2,
          thang_sinh: 3,
          nam_sinh: 1988,
          don_vi_cong_tac_id: dv.donVi.id,
        },
      });
      hocVienIds.push(h.id);
      const d = await prisma.dang_ky_hoc.create({
        data: { hoc_vien_id: h.id, khoa_id: khoaId },
      });
      dk[k] = d.id;
      dangKyIds.push(d.id);
      await prisma.phan_lop_giai_doan.createMany({
        data: cap.map(([gdId, lopId]) => ({
          dang_ky_hoc_id: d.id,
          giai_doan_id: gdId,
          lop_id: lopId,
        })),
      });
    }
    const doi = (k: keyof typeof dk, nguon: string, chot: string) =>
      prisma.doi_buoi_hoc.create({
        data: {
          dang_ky_hoc_id: dk[k],
          lich_nguon_id: nguon,
          lich_de_nghi_id: chot,
          lich_chot_id: chot,
          ly_do: 'Trùng lịch công tác',
          trang_thai: 'da_duyet',
        },
      });
    await doi('binh', lich.a2, lich.b1);
    await doi('dung', lich.b1, lich.a1);

    tuDiemDanhAn = new Date(batDau.a1.getTime() + 5 * 60000);
    const diemDanh = (
      k: keyof typeof dk,
      l: keyof typeof lich,
      trang_thai: 'co_mat' | 'vang' | 'vang_co_phep',
      nguon: 'zoom' | 'ky_ten' | 'qr' | 'thu_cong',
      tu_diem_danh_luc: Date | null = null,
    ) => ({
      dang_ky_hoc_id: dk[k],
      lich_hoc_id: lich[l],
      trang_thai,
      nguon,
      tu_diem_danh_luc,
    });
    await prisma.diem_danh.createMany({
      data: [
        diemDanh('an', 'a1', 'co_mat', 'zoom', tuDiemDanhAn),
        diemDanh('an', 'a2', 'vang', 'zoom'),
        diemDanh('an', 'a4', 'co_mat', 'thu_cong'),
        diemDanh('binh', 'b1', 'co_mat', 'zoom'),
        diemDanh('cuong', 'a1', 'co_mat', 'zoom'),
        diemDanh('cuong', 'b2', 'co_mat', 'zoom'),
        diemDanh('dung', 'a1', 'co_mat', 'ky_ten'),
      ],
    });
    await prisma.bao_vang.create({
      data: { dang_ky_hoc_id: dk.binh, lich_hoc_id: lich.a1, ly_do: 'Ốm' },
    });
  });

  afterAll(async () => {
    await prisma.doi_buoi_hoc.deleteMany({
      where: { dang_ky_hoc_id: { in: dangKyIds } },
    });
    await prisma.diem_danh.deleteMany({
      where: { dang_ky_hoc_id: { in: dangKyIds } },
    });
    await prisma.bao_vang.deleteMany({
      where: { dang_ky_hoc_id: { in: dangKyIds } },
    });
    await prisma.phan_cong_ho_tro_lop.deleteMany({
      where: { nguoi_dung_id: ndId },
    });
    await prisma.phan_lop_giai_doan.deleteMany({
      where: { dang_ky_hoc_id: { in: dangKyIds } },
    });
    await prisma.dang_ky_hoc.deleteMany({ where: { id: { in: dangKyIds } } });
    await prisma.khoa_boi_duong.deleteMany({ where: { id: khoaId } });
    await xoaNguoiDungTest(ndId);
    await prisma.hoc_vien.deleteMany({ where: { id: { in: hocVienIds } } });
    await xoaDonViTest([dv.donVi.id], [dv.diaDanhXa.id, dv.diaDanhTinh.id]);
    await prisma.$disconnect();
    await app.close();
  });

  type Dong = {
    ho_ten: string;
    ma_dinh_danh_moet: string | null;
    diem_danh: { ma: string; nhan: string; tu_diem_danh_luc: string | null };
  };
  const theoTen = (ds: Dong[]) =>
    Object.fromEntries(ds.map((h) => [h.ho_ten, h.diem_danh]));

  it('DS buổi A1: điểm danh dòng thường + đổi vào, báo vắng, chưa điểm danh; tổng hợp', async () => {
    const res = await get(
      `/ho-tro-hoc-vien/lop/${lop.a}/buoi/${lich.a1}/hoc-vien`,
    );
    expect(res.status).toBe(200);
    const dd = theoTen(res.body.hoc_vien as Dong[]);
    expect(Object.keys(dd)).toEqual([
      'Lê Cường',
      'Nguyễn An',
      'Phạm Dũng',
      'Trần Bình',
      'Võ Em',
    ]);
    const lopA = {
      nguon_tinh: 'lop_hien_tai',
      lop_tinh: { id: lop.a, ten_lop: 'Zoom A' },
    };
    expect(dd['Nguyễn An']).toEqual({
      ma: 'co_mat',
      nhan: `Có mặt – tự điểm danh ${gioVn(tuDiemDanhAn)}`,
      tu_diem_danh_luc: tuDiemDanhAn.toISOString(),
      ...lopA,
    });
    expect(dd['Lê Cường']).toEqual({
      ma: 'co_mat',
      nhan: 'Có mặt (Zoom)',
      tu_diem_danh_luc: null,
      ...lopA,
    });
    // Đổi vào: điểm danh theo đăng ký của chính Dũng tại A1.
    expect(dd['Phạm Dũng']).toEqual(
      expect.objectContaining({ ma: 'co_mat', nhan: 'Có mặt (Ký tên)' }),
    );
    expect(dd['Trần Bình']).toEqual(
      expect.objectContaining({ ma: 'da_bao_vang', nhan: 'Đã báo vắng: Ốm' }),
    );
    expect(dd['Võ Em']).toEqual(
      expect.objectContaining({ ma: 'chua_diem_danh', nhan: 'Chưa điểm danh' }),
    );
    expect(
      (res.body.hoc_vien as Dong[]).find((h) => h.ho_ten === 'Nguyễn An')
        ?.ma_dinh_danh_moet,
    ).toBe(`0HTDD-an-${SUF}`);
    expect(res.body.buoi.tong_diem_danh).toEqual({
      co_mat: 3,
      vang: 0,
      vang_co_phep: 0,
      da_bao_vang: 1,
      chua_diem_danh: 1,
      chua_den_gio: 0,
    });
  });

  it('DS buổi A2: vắng; người đổi ra nằm ở doi_ra với diem_danh null', async () => {
    const res = await get(
      `/ho-tro-hoc-vien/lop/${lop.a}/buoi/${lich.a2}/hoc-vien`,
    );
    const dd = theoTen(res.body.hoc_vien as Dong[]);
    expect(dd['Nguyễn An']).toEqual(
      expect.objectContaining({ ma: 'vang', nhan: 'Vắng' }),
    );
    expect(dd['Lê Cường'].ma).toBe('chua_diem_danh');
    expect(res.body.doi_ra).toEqual([
      expect.objectContaining({ ho_ten: 'Trần Bình', diem_danh: null }),
    ]);
    expect(res.body.buoi.tong_diem_danh).toEqual(
      expect.objectContaining({ vang: 1, chua_diem_danh: 2 }),
    );
  });

  it('DS buổi tương lai A3: Chưa đến giờ', async () => {
    const res = await get(
      `/ho-tro-hoc-vien/lop/${lop.a}/buoi/${lich.a3}/hoc-vien`,
    );
    expect(
      (res.body.hoc_vien as Dong[]).every(
        (h) => h.diem_danh.ma === 'chua_den_gio',
      ),
    ).toBe(true);
    expect(res.body.buoi.tong_diem_danh.chua_den_gio).toBe(4);
  });

  it('DS lớp: chuyen_can x/y theo giai đoạn phân vào lớp, đổi ra tính buổi chốt; có mã MOET', async () => {
    const res = await get(`/ho-tro-hoc-vien/lop/${lop.a}/hoc-vien`);
    expect(res.status).toBe(200);
    const ds = res.body.hoc_vien as {
      ho_ten: string;
      ma_dinh_danh_moet: string;
      chuyen_can: { co_mat: number; da_dien_ra: number };
    }[];
    expect(ds.map((h) => [h.ho_ten, h.chuyen_can])).toEqual([
      ['Lê Cường', { co_mat: 1, da_dien_ra: 2 }],
      ['Nguyễn An', { co_mat: 2, da_dien_ra: 3 }],
      ['Trần Bình', { co_mat: 1, da_dien_ra: 3 }],
      ['Võ Em', { co_mat: 0, da_dien_ra: 2 }],
    ]);
    expect(ds[1].ma_dinh_danh_moet).toBe(`0HTDD-an-${SUF}`);
  });

  it('file lớp: cột Mã MOET + "Có mặt / đã diễn ra" dạng x/y', async () => {
    const res = await taiFile(`/ho-tro-hoc-vien/lop/xuat?lop_id=${lop.a}`);
    expect(res.status).toBe(200);
    const ws = await docFile(res.body as Buffer);
    const tieuDe = hang(ws, 2);
    expect(tieuDe.slice(1, 3)).toEqual(['Họ tên', 'Mã MOET']);
    expect(tieuDe.at(-1)).toBe('Có mặt / đã diễn ra');
    const an = hang(ws, 4);
    expect(an[1]).toBe('Nguyễn An');
    expect(an[2]).toBe(`0HTDD-an-${SUF}`);
    expect(an.at(-1)).toBe('2/3');
  });

  it('file buổi A1: dòng tổng hợp + cột Điểm danh, Giờ tự điểm danh', async () => {
    const res = await taiFile(
      `/ho-tro-hoc-vien/lop/${lop.a}/buoi/xuat?lich_id=${lich.a1}`,
    );
    expect(res.status).toBe(200);
    const ws = await docFile(res.body as Buffer);
    expect(hang(ws, 3)[0]).toBe(
      'Điểm danh: Có mặt 3 · Vắng 0 · Có phép 0 · Báo vắng 1 · Chưa điểm danh 1',
    );
    const tieuDe = hang(ws, 4);
    const iDd = tieuDe.indexOf('Điểm danh');
    expect(tieuDe[iDd + 1]).toBe('Giờ tự điểm danh');
    expect(tieuDe[2]).toBe('Mã MOET');
    const an = hang(ws, 6);
    expect(an[1]).toBe('Nguyễn An');
    expect(an[iDd]).toBe(`Có mặt – tự điểm danh ${gioVn(tuDiemDanhAn)}`);
    expect(an[iDd + 1]).toBe(ngayGioVn(tuDiemDanhAn));
    expect(hang(ws, 8)[iDd]).toBe('Đã báo vắng: Ốm');
  });

  // ADR 0010 T7: Em học bù buổi 1 (G1) ở lớp trực tiếp khác -> DS buổi A1 ghi
  // nguồn, tổng có mặt + chuyên cần trên DS lớp tính như dashboard.
  describe('học bù ở lớp khác (ADR 0010 T7)', () => {
    let lopT = '';
    beforeAll(async () => {
      lopT = (
        await prisma.lop_hoc.create({
          data: {
            khoa_id: khoaId,
            loai_lop: 'truc_tiep',
            ten_lop: 'Trực tiếp T',
          },
        })
      ).id;
      const t1 = await prisma.lich_hoc_lop.create({
        data: {
          lop_id: lopT,
          giai_doan_id: gdG1,
          buoi_so: 1,
          thoi_gian_bat_dau: new Date(Date.now() - 5 * 24 * 3600 * 1000),
          thoi_gian_ket_thuc: new Date(
            Date.now() - 5 * 24 * 3600 * 1000 + 3 * 3600000,
          ),
        },
      });
      await prisma.diem_danh.create({
        data: {
          dang_ky_hoc_id: dk.em,
          lich_hoc_id: t1.id,
          trang_thai: 'co_mat',
          nguon: 'ky_ten',
        },
      });
    });

    it('DS buổi A1: Em "Có mặt – ở lớp Trực tiếp T", nguon_tinh lop_khac; tổng có mặt tính cả', async () => {
      const res = await get(
        `/ho-tro-hoc-vien/lop/${lop.a}/buoi/${lich.a1}/hoc-vien`,
      );
      expect(theoTen(res.body.hoc_vien as Dong[])['Võ Em']).toEqual({
        ma: 'co_mat',
        nhan: 'Có mặt – ở lớp Trực tiếp T',
        tu_diem_danh_luc: null,
        nguon_tinh: 'lop_khac',
        lop_tinh: { id: lopT, ten_lop: 'Trực tiếp T' },
      });
      expect(res.body.buoi.tong_diem_danh).toMatchObject({
        co_mat: 4,
        chua_diem_danh: 0,
      });
    });

    it('DS lớp: chuyên cần Em tính buổi học bù (1/2)', async () => {
      const res = await get(`/ho-tro-hoc-vien/lop/${lop.a}/hoc-vien`);
      const em = (
        res.body.hoc_vien as { ho_ten: string; chuyen_can: unknown }[]
      ).find((h) => h.ho_ten === 'Võ Em');
      expect(em?.chuyen_can).toEqual({ co_mat: 1, da_dien_ra: 2 });
    });

    it('file buổi A1: cột Điểm danh ghi nhãn kèm lớp học bù', async () => {
      const res = await taiFile(
        `/ho-tro-hoc-vien/lop/${lop.a}/buoi/xuat?lich_id=${lich.a1}`,
      );
      const ws = await docFile(res.body as Buffer);
      const iDd = hang(ws, 4).indexOf('Điểm danh');
      const em = Array.from({ length: ws.rowCount }, (_, i) =>
        hang(ws, i + 1),
      ).find((r) => r[1] === 'Võ Em');
      expect(em?.[iDd]).toBe('Có mặt – ở lớp Trực tiếp T');
    });
  });
});
