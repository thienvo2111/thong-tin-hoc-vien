import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as ExcelJS from 'exceljs';
import type { Response } from 'superagent';
import { randomUUID } from 'crypto';
import type { muc_nang_luc, trang_thai_dang_ky } from '@prisma/client';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoDonViTest,
  taoNguoiDungTest,
  uniqueSuffix,
  xoaNguoiDungTest,
  xoaDonViTest,
} from './utils/test-data';

const H = 60 * 60 * 1000;
const D = 24 * H;
const NAM_HOP_LE = new Date().getUTCFullYear() - 20;

const ngay = (offsetDays: number) => {
  const d = new Date(Date.now() + offsetDays * D);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
};

function binaryParser(
  res: Response,
  callback: (err: Error | null, body: Buffer) => void,
) {
  res.setEncoding('binary');
  let data = '';
  res.on('data', (chunk: string) => {
    data += chunk;
  });
  res.on('end', () => callback(null, Buffer.from(data, 'binary')));
}

// ADR 0013 — thống kê nhu cầu mức học theo đợt + Excel từng người. Chạy trên
// DB dev: fixture uniqueSuffix(), chỉ xóa theo id đã tạo, đúng thứ tự FK.
describe('Thống kê nhu cầu mức theo đợt (e2e)', () => {
  let app: INestApplication;
  let t1: Awaited<ReturnType<typeof taoDonViTest>>;
  let t2: Awaited<ReturnType<typeof taoDonViTest>>;
  let quanTri: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let token: string;
  let khoaId: string;
  let maKhoa: string;
  let gdId: string;
  let dotId: string;
  let dotCuId: string;
  const lop: Record<muc_nang_luc, string> = {} as Record<muc_nang_luc, string>;

  const khoaIds: string[] = [];
  const dotIds: string[] = [];
  const gdIds: string[] = [];
  const lopIds: string[] = [];
  const hocVienIds: string[] = [];
  const dangKyIds: string[] = [];
  const ten: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const bearer = () => ({ Authorization: `Bearer ${token}` });

  type TuyChon = {
    donViId: string;
    lopMuc?: muc_nang_luc | null;
    doiTuong?: 'giao_vien' | 'nhan_vien' | null;
    trangThai?: trang_thai_dang_ky;
    chon?: { dot: string; muc_chon: muc_nang_luc; muc_moc: muc_nang_luc };
  };

  async function taoHocVien(nhan: string, o: TuyChon) {
    const suf = uniqueSuffix();
    const hocVien = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: `MOET-TKNC-${suf}`,
        ho_ten: `HV TKNC ${nhan} ${suf}`,
        ngay_sinh: 12,
        thang_sinh: 7,
        nam_sinh: NAM_HOP_LE,
        don_vi_cong_tac_id: o.donViId,
        so_dien_thoai_lien_he: '0900000003',
        doi_tuong: o.doiTuong ?? null,
      },
    });
    hocVienIds.push(hocVien.id);
    ten[nhan] = hocVien.ho_ten;
    const dangKy = await prisma.dang_ky_hoc.create({
      data: {
        hoc_vien_id: hocVien.id,
        khoa_id: khoaId,
        trang_thai: o.trangThai ?? 'da_duyet',
      },
    });
    dangKyIds.push(dangKy.id);
    if (o.lopMuc) {
      await prisma.phan_lop_giai_doan.create({
        data: {
          dang_ky_hoc_id: dangKy.id,
          giai_doan_id: gdId,
          lop_id: lop[o.lopMuc],
        },
      });
    }
    if (o.chon) {
      await prisma.nhu_cau_muc_hoc_vien.create({
        data: {
          dot_id: o.chon.dot,
          dang_ky_hoc_id: dangKy.id,
          muc_chon: o.chon.muc_chon,
          muc_moc: o.chon.muc_moc,
          nguon_moc: 'lop',
          lop_id_luc_chon: lop[o.chon.muc_moc],
        },
      });
    }
  }

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    t1 = await taoDonViTest('tknc1');
    t2 = await taoDonViTest('tknc2');
    quanTri = await taoNguoiDungTest({
      vai_tro: 'quan_tri',
      don_vi_id: t1.donVi.id,
      mat_khau: 'MatKhau123',
    });
    const dn = await http()
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap: quanTri.ten_dang_nhap, mat_khau: 'MatKhau123' })
      .expect(200);
    token = dn.body.token;

    const suf = uniqueSuffix();
    maKhoa = `KHOA-TKNC-${suf}`;
    const khoa = await prisma.khoa_boi_duong.create({
      data: {
        ma_khoa: maKhoa,
        ten_khoa: `Khóa TK nhu cầu ${suf}`,
        don_vi_dat_hang_id: t1.donVi.id,
        thoi_gian_bat_dau: new Date(),
        thoi_gian_ket_thuc: new Date(Date.now() + 30 * D),
        trang_thai: 'da_duyet',
        created_by: quanTri.nguoiDung.id,
        nguoi_duyet_id: quanTri.nguoiDung.id,
        cap_duyet_thuc_te: 'quan_tri',
        ngay_duyet: new Date(),
      },
    });
    khoaId = khoa.id;
    khoaIds.push(khoa.id);
    const gd = await prisma.giai_doan_khoa.create({
      data: {
        khoa_id: khoaId,
        thu_tu: 1,
        ten_giai_doan: 'Giai đoạn 1',
        hinh_thuc: 'truc_tiep',
        thoi_gian_bat_dau: ngay(-5),
        thoi_gian_ket_thuc: ngay(5),
      },
    });
    gdId = gd.id;
    gdIds.push(gd.id);
    for (const muc of ['co_ban', 'thanh_thao', 'nang_cao'] as muc_nang_luc[]) {
      const l = await prisma.lop_hoc.create({
        data: {
          khoa_id: khoaId,
          loai_lop: 'truc_tiep',
          ten_lop: `Lớp TKNC ${muc} ${uniqueSuffix()}`,
          muc_nang_luc: muc,
        },
      });
      lop[muc] = l.id;
      lopIds.push(l.id);
    }
    const dot = await prisma.dot_nhu_cau_muc.create({
      data: {
        khoa_id: khoaId,
        ten_dot: `Đợt TKNC ${uniqueSuffix()}`,
        mo_luc: new Date(Date.now() - D),
        dong_luc: new Date(Date.now() + D),
      },
    });
    dotId = dot.id;
    dotIds.push(dot.id);
    const dotCu = await prisma.dot_nhu_cau_muc.create({
      data: {
        khoa_id: khoaId,
        ten_dot: `Đợt TKNC cũ ${uniqueSuffix()}`,
        mo_luc: new Date(Date.now() - 5 * D),
        dong_luc: new Date(Date.now() - 3 * D),
      },
    });
    dotCuId = dotCu.id;
    dotIds.push(dotCu.id);

    const T1 = t1.donVi.id;
    const T2 = t2.donVi.id;
    // Đủ điều kiện:
    await taoHocVien('A', {
      donViId: T1,
      lopMuc: 'nang_cao',
      chon: { dot: dotId, muc_chon: 'co_ban', muc_moc: 'nang_cao' },
    });
    await taoHocVien('B', {
      donViId: T1,
      lopMuc: 'thanh_thao',
      doiTuong: 'giao_vien',
      chon: { dot: dotId, muc_chon: 'thanh_thao', muc_moc: 'thanh_thao' },
    });
    // C chỉ chọn ở đợt cũ → đợt này vẫn "chưa chọn".
    await taoHocVien('C', {
      donViId: T2,
      lopMuc: 'co_ban',
      chon: { dot: dotCuId, muc_chon: 'co_ban', muc_moc: 'co_ban' },
    });
    // Không đủ điều kiện nhưng đã có lựa chọn ở đợt này → vẫn tính.
    await taoHocVien('G', {
      donViId: T2,
      lopMuc: null,
      trangThai: 'cho_duyet',
      chon: { dot: dotId, muc_chon: 'co_ban', muc_moc: 'thanh_thao' },
    });
    // Loại: nhân viên, chưa duyệt, chưa có mốc.
    // Nhân viên đã có lựa chọn ở đợt này vẫn bị loại (R4).
    await taoHocVien('NV', {
      donViId: T1,
      lopMuc: 'nang_cao',
      doiTuong: 'nhan_vien',
      chon: { dot: dotId, muc_chon: 'co_ban', muc_moc: 'nang_cao' },
    });
    await taoHocVien('CD', {
      donViId: T2,
      lopMuc: 'nang_cao',
      trangThai: 'cho_duyet',
    });
    await taoHocVien('KM', { donViId: T1, lopMuc: null });
  });

  afterAll(async () => {
    // Mỗi bước độc lập: 1 bước lỗi không bỏ qua các bước sau.
    const buoc = async (tenBuoc: string, fn: () => Promise<unknown>) => {
      try {
        await fn();
      } catch (e) {
        console.error(`[cleanup thong-ke-nhu-cau-muc-dot] ${tenBuoc} lỗi:`, e);
      }
    };
    await buoc('nhu_cau_muc_hoc_vien', () =>
      prisma.nhu_cau_muc_hoc_vien.deleteMany({
        where: {
          OR: [
            { dot_id: { in: dotIds } },
            { dang_ky_hoc_id: { in: dangKyIds } },
          ],
        },
      }),
    );
    await buoc('dot_nhu_cau_muc', () =>
      prisma.dot_nhu_cau_muc.deleteMany({ where: { id: { in: dotIds } } }),
    );
    await buoc('phan_lop_giai_doan', () =>
      prisma.phan_lop_giai_doan.deleteMany({
        where: { dang_ky_hoc_id: { in: dangKyIds } },
      }),
    );
    await buoc('dang_ky_hoc', () =>
      prisma.dang_ky_hoc.deleteMany({ where: { id: { in: dangKyIds } } }),
    );
    await buoc('lop_hoc', () =>
      prisma.lop_hoc.deleteMany({ where: { id: { in: lopIds } } }),
    );
    await buoc('giai_doan_khoa', () =>
      prisma.giai_doan_khoa.deleteMany({ where: { id: { in: gdIds } } }),
    );
    await buoc('hoc_vien', () =>
      prisma.hoc_vien.deleteMany({ where: { id: { in: hocVienIds } } }),
    );
    await buoc('khoa_boi_duong', () =>
      prisma.khoa_boi_duong.deleteMany({ where: { id: { in: khoaIds } } }),
    );
    await buoc('quan_tri', () => xoaNguoiDungTest(quanTri.nguoiDung.id));
    await buoc('don_vi', () =>
      xoaDonViTest(
        [t1.donVi.id, t2.donVi.id],
        [
          t1.diaDanhXa.id,
          t1.diaDanhTinh.id,
          t2.diaDanhXa.id,
          t2.diaDanhTinh.id,
        ],
      ),
    );
    await buoc('disconnect', () => prisma.$disconnect());
    await buoc('app.close', () => app.close());
  });

  it('quan_tri GET theo dot_id → số liệu khớp fixture (loại nhân viên, chưa duyệt, chưa có mốc)', async () => {
    const res = await http()
      .get('/thong-ke/nhu-cau-muc-dot')
      .query({ dot_id: dotId })
      .set(bearer())
      .expect(200);
    expect(res.body.dot).toMatchObject({
      id: dotId,
      khoa_id: khoaId,
      ma_khoa: maKhoa,
      trang_thai: 'dang_mo',
    });
    expect(res.body).toMatchObject({
      tong_du_dieu_kien: 4,
      da_chon: 3,
      chua_chon: 1,
      ty_le_da_chon: 75,
    });
    expect(res.body.ma_tran).toEqual(
      expect.arrayContaining([
        { muc_moc: 'nang_cao', muc_chon: 'co_ban', so_luong: 1 },
        { muc_moc: 'thanh_thao', muc_chon: 'thanh_thao', so_luong: 1 },
        { muc_moc: 'thanh_thao', muc_chon: 'co_ban', so_luong: 1 },
      ]),
    );
    expect(res.body.ma_tran).toHaveLength(3);
    const theo = Object.fromEntries(
      res.body.theo_truong.map((t: { don_vi_id: string }) => [t.don_vi_id, t]),
    );
    expect(theo[t1.donVi.id]).toMatchObject({
      tong: 2,
      da_chon: 2,
      chua_chon: 0,
      ha_muc: 1,
    });
    expect(theo[t2.donVi.id]).toMatchObject({
      tong: 2,
      da_chon: 1,
      chua_chon: 1,
      ha_muc: 1,
    });
  });

  it('khoa_id client gửi bị bỏ qua — luôn theo khóa của đợt', async () => {
    const res = await http()
      .get('/thong-ke/nhu-cau-muc-dot')
      .query({ dot_id: dotId, khoa_id: randomUUID() })
      .set(bearer())
      .expect(200);
    expect(res.body.tong_du_dieu_kien).toBe(4);
  });

  it('dot_id không tồn tại → 404; thiếu/sai dạng → 400', async () => {
    const r = await http()
      .get('/thong-ke/nhu-cau-muc-dot')
      .query({ dot_id: randomUUID() })
      .set(bearer())
      .expect(404);
    expect(r.body.error.code).toBe('NOT_FOUND');
    await http()
      .get('/thong-ke/nhu-cau-muc-dot/xuat-excel')
      .query({ dot_id: randomUUID() })
      .set(bearer())
      .expect(404);
    await http().get('/thong-ke/nhu-cau-muc-dot').set(bearer()).expect(400);
    await http()
      .get('/thong-ke/nhu-cau-muc-dot')
      .query({ dot_id: 'abc' })
      .set(bearer())
      .expect(400);
  });

  it('xuất Excel don_vi_ids=<T2> → chỉ học viên của T2, chưa chọn ghi "Chưa chọn"', async () => {
    const res = await http()
      .get('/thong-ke/nhu-cau-muc-dot/xuat-excel')
      .query({ dot_id: dotId, don_vi_ids: t2.donVi.id })
      .set(bearer())
      .buffer(true)
      .parse(binaryParser)
      .expect(200);
    expect(res.headers['content-disposition']).toMatch(
      new RegExp(`nhu-cau-muc-${maKhoa}-\\d{8}\\.xlsx`),
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body as unknown as ArrayBuffer);
    const ws = wb.getWorksheet('Danh sách')!;
    let rHeader = -1;
    for (let r = 1; r <= ws.rowCount; r++) {
      if (ws.getCell(r, 1).value === 'STT') rHeader = r;
    }
    expect(rHeader).toBeGreaterThan(0);
    const tenCot = (n: string) => {
      for (let c = 1; c <= 20; c++)
        if (ws.getCell(rHeader, c).value === n) return c;
      return -1;
    };
    const cTen = tenCot('Họ tên');
    const cNc = tenCot('Nhu cầu chọn');
    const dong: Record<string, unknown> = {};
    for (let r = rHeader + 1; r <= ws.rowCount; r++) {
      dong[String(ws.getCell(r, cTen).value)] = ws.getCell(r, cNc).value;
    }
    expect(Object.keys(dong).sort()).toEqual([ten.C, ten.G].sort());
    expect(dong[ten.C]).toBe('Chưa chọn');
    expect(dong[ten.G]).toBe('Cơ bản');
  });

  it('xuất Excel không lọc → đủ 4 dòng, không có nhân viên', async () => {
    const res = await http()
      .get('/thong-ke/nhu-cau-muc-dot/xuat-excel')
      .query({ dot_id: dotId })
      .set(bearer())
      .buffer(true)
      .parse(binaryParser)
      .expect(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body as unknown as ArrayBuffer);
    const ws = wb.getWorksheet('Danh sách')!;
    const tatCa: string[] = [];
    ws.eachRow((row) => row.eachCell((c) => tatCa.push(String(c.value))));
    for (const n of ['A', 'B', 'C', 'G']) expect(tatCa).toContain(ten[n]);
    for (const n of ['NV', 'CD', 'KM']) expect(tatCa).not.toContain(ten[n]);

    const nk = await prisma.nhat_ky_hoat_dong.findMany({
      where: {
        hanh_dong: 'xuat_nhu_cau_muc_dot',
        nguoi_dung_id: quanTri.nguoiDung.id,
      },
    });
    // 2 lần xuất trong file: lọc T2 (2 dòng) và không lọc (4 dòng).
    expect(nk).toHaveLength(2);
    const chiTiet = nk.map((n) => n.chi_tiet as Record<string, unknown>);
    expect(chiTiet).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dot_id: dotId,
          khoa_id: khoaId,
          don_vi_ids: [t2.donVi.id],
          doi_tuong: null,
          so_dong: 2,
        }),
        expect.objectContaining({ dot_id: dotId, don_vi_ids: [], so_dong: 4 }),
      ]),
    );
  });
});
