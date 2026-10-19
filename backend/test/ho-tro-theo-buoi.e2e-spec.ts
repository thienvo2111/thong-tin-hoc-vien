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

// ADR 0008 L7: danh sách THEO BUỔI của người hỗ trợ lớp = phân lớp − đổi ra +
// đổi vào (đổi buổi da_duyet còn hiệu lực). Người đổi vào thuộc phạm vi (ADR 0011 P1).
describe('Người hỗ trợ lớp — danh sách theo buổi (e2e, ADR 0008 L7)', () => {
  let app: INestApplication;
  const suf = uniqueSuffix();
  const SUF = suf.toUpperCase();
  const nguoiDungIds: string[] = [];
  const hocVienIds: string[] = [];
  const dangKyIds: string[] = [];
  let khoaId: string;
  let dv: Awaited<ReturnType<typeof taoDonViTest>>;
  let hoTro: { id: string; token: string };
  const lop = { a: '', b: '', c: '' };
  const lich = { a1: '', a2: '', b1: '', c1: '' };
  const hv = { an: '', binh: '', cuong: '', dung: '', em: '', giang: '' };

  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const get = (path: string) => http().get(path).set(auth(hoTro.token));
  const taiFile = (path: string) =>
    http()
      .get(path)
      .set(auth(hoTro.token))
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
  const docFile = async (buf: Buffer) => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    return wb;
  };
  const vanBan = (ws: ExcelJS.Worksheet) =>
    Array.from({ length: ws.rowCount }, (_, i) =>
      (ws.getRow(i + 1).values as unknown[])
        .slice(1)
        .map((v) => (v == null ? '' : String(v)))
        .join('|'),
    );

  async function taoHocVien(nhan: string, hoTen: string) {
    const h = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: `HTB-${nhan}-${SUF}`,
        ho_ten: hoTen,
        ngay_sinh: 2,
        thang_sinh: 3,
        nam_sinh: 1988,
        don_vi_cong_tac_id: dv.donVi.id,
      },
    });
    hocVienIds.push(h.id);
    return h.id;
  }

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    dv = await taoDonViTest('htbuoi');
    const qt = await taoNguoiDungTest({
      vai_tro: 'quan_tri',
      don_vi_id: dv.donVi.id,
      mat_khau: 'QuanTri12345',
    });
    nguoiDungIds.push(qt.nguoiDung.id);
    const nd = await prisma.nguoi_dung.create({
      data: {
        ho_ten: 'Hỗ trợ buổi',
        ten_dang_nhap: `htbuoi-${suf}`,
        email: `htbuoi-${suf}@htbuoi.vn`,
        vai_tro: 'ho_tro_hoc_vien',
        mat_khau_hash: await bcrypt.hash('HoTro12345', 4),
        phai_doi_mat_khau: false,
      },
    });
    nguoiDungIds.push(nd.id);
    const dn = await http()
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap: nd.ten_dang_nhap, mat_khau: 'HoTro12345' });
    hoTro = { id: nd.id, token: dn.body.token as string };

    khoaId = (
      await prisma.khoa_boi_duong.create({
        data: {
          ma_khoa: `K-HTB-${SUF}`,
          ten_khoa: `Khóa buổi ${suf}`,
          don_vi_dat_hang_id: dv.donVi.id,
          thoi_gian_bat_dau: new Date('2026-10-01'),
          thoi_gian_ket_thuc: new Date('2027-02-01'),
          trang_thai: 'da_duyet',
        },
      })
    ).id;
    const gd = await prisma.giai_doan_khoa.create({
      data: {
        khoa_id: khoaId,
        thu_tu: 1,
        ten_giai_doan: 'Học Zoom',
        hinh_thuc: 'truc_tuyen',
        thoi_gian_bat_dau: new Date('2026-10-01'),
        thoi_gian_ket_thuc: new Date('2027-01-31'),
      },
    });
    const taoLop = async (ten: string) =>
      (
        await prisma.lop_hoc.create({
          data: { khoa_id: khoaId, loai_lop: 'zoom', ten_lop: ten },
        })
      ).id;
    lop.a = await taoLop('Zoom A');
    lop.b = await taoLop('Zoom B');
    lop.c = await taoLop('Zoom C');
    await prisma.phan_cong_ho_tro_lop.create({
      data: { nguoi_dung_id: hoTro.id, lop_id: lop.a },
    });
    const ngay = (n: number) => new Date(Date.now() + n * 24 * 3600 * 1000);
    const taoBuoi = async (lopId: string, buoiSo: number, n: number) =>
      (
        await prisma.lich_hoc_lop.create({
          data: {
            lop_id: lopId,
            giai_doan_id: gd.id,
            buoi_so: buoiSo,
            thoi_gian_bat_dau: ngay(n),
            thoi_gian_ket_thuc: new Date(ngay(n).getTime() + 3 * 3600 * 1000),
          },
        })
      ).id;
    // Tạo buổi 2 trước để kiểm tra thứ tự trả về theo buoi_so.
    lich.a2 = await taoBuoi(lop.a, 2, 10);
    lich.a1 = await taoBuoi(lop.a, 1, 3);
    lich.b1 = await taoBuoi(lop.b, 1, 4);
    lich.c1 = await taoBuoi(lop.c, 1, 5);

    hv.an = await taoHocVien('an', 'Nguyễn An');
    hv.binh = await taoHocVien('binh', 'Trần Bình');
    hv.cuong = await taoHocVien('cuong', 'Lê Cường');
    hv.dung = await taoHocVien('dung', 'Phạm Dũng');
    hv.em = await taoHocVien('em', 'Võ Em');
    hv.giang = await taoHocVien('giang', 'Đỗ Giang');
    const dk: Record<keyof typeof hv, string> = { ...hv };
    const phanLop: [keyof typeof hv, string][] = [
      ['an', lop.a],
      ['binh', lop.a],
      ['cuong', lop.b],
      ['dung', lop.b],
      ['em', lop.b],
      ['giang', lop.b],
    ];
    for (const [k, lopId] of phanLop) {
      const d = await prisma.dang_ky_hoc.create({
        data: { hoc_vien_id: hv[k], khoa_id: khoaId },
      });
      dk[k] = d.id;
      dangKyIds.push(d.id);
      await prisma.phan_lop_giai_doan.create({
        data: { dang_ky_hoc_id: d.id, giai_doan_id: gd.id, lop_id: lopId },
      });
    }
    const doi = (
      k: keyof typeof hv,
      nguon: string,
      chot: string,
      trangThai: 'da_duyet' | 'cho_duyet' | 'tu_choi',
    ) =>
      prisma.doi_buoi_hoc.create({
        data: {
          dang_ky_hoc_id: dk[k],
          lich_nguon_id: nguon,
          lich_de_nghi_id: chot,
          lich_chot_id: trangThai === 'da_duyet' ? chot : null,
          ly_do: 'Trùng lịch công tác',
          trang_thai: trangThai,
        },
      });
    // Bình: lớp A, đổi ra buổi A1 sang C1 (đã duyệt).
    await doi('binh', lich.a1, lich.c1, 'da_duyet');
    // Cường: lớp B, đổi vào A1 (đã duyệt).
    await doi('cuong', lich.b1, lich.a1, 'da_duyet');
    // Dũng chờ duyệt, Em bị từ chối — không làm đổi danh sách.
    await doi('dung', lich.b1, lich.a1, 'cho_duyet');
    await doi('em', lich.b1, lich.a1, 'tu_choi');
    // Giang: bản ghi đã duyệt từ C1 nhưng phân lớp hiện tại là B → mất hiệu lực.
    await doi('giang', lich.c1, lich.a1, 'da_duyet');
  });

  afterAll(async () => {
    await prisma.doi_buoi_hoc.deleteMany({
      where: { dang_ky_hoc_id: { in: dangKyIds } },
    });
    await prisma.phan_cong_ho_tro_lop.deleteMany({
      where: { nguoi_dung_id: hoTro.id },
    });
    await prisma.phan_lop_giai_doan.deleteMany({
      where: { dang_ky_hoc_id: { in: dangKyIds } },
    });
    await prisma.dang_ky_hoc.deleteMany({ where: { id: { in: dangKyIds } } });
    await prisma.khoa_boi_duong.deleteMany({ where: { id: khoaId } });
    for (const id of nguoiDungIds) await xoaNguoiDungTest(id);
    await prisma.hoc_vien.deleteMany({ where: { id: { in: hocVienIds } } });
    await xoaDonViTest([dv.donVi.id], [dv.diaDanhXa.id, dv.diaDanhTinh.id]);
    await prisma.$disconnect();
    await app.close();
  });

  it('GET lop/:id/buoi: buổi theo thứ tự, sĩ số = phân lớp − ra + vào', async () => {
    const res = await get(`/ho-tro-hoc-vien/lop/${lop.a}/buoi`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      expect.objectContaining({
        lich_id: lich.a1,
        buoi_so: 1,
        giai_doan: expect.objectContaining({ thu_tu: 1 }),
        si_so: 2,
        so_doi_vao: 1,
        so_doi_ra: 1,
      }),
      expect.objectContaining({
        lich_id: lich.a2,
        buoi_so: 2,
        si_so: 2,
        so_doi_vao: 0,
        so_doi_ra: 0,
      }),
    ]);
  });

  it('DS buổi có người đổi vào (ghi chú lớp nguồn), không có người đổi ra (nằm ở doi_ra)', async () => {
    const res = await get(
      `/ho-tro-hoc-vien/lop/${lop.a}/buoi/${lich.a1}/hoc-vien`,
    );
    expect(res.status).toBe(200);
    expect(res.body.lop).toEqual(
      expect.objectContaining({ lop_id: lop.a, so_hoc_vien: 2 }),
    );
    expect(res.body.buoi).toEqual(
      expect.objectContaining({ lich_id: lich.a1, si_so: 2 }),
    );
    const ten = (res.body.hoc_vien as { ho_ten: string }[]).map(
      (h) => h.ho_ten,
    );
    expect(ten).toEqual(['Lê Cường', 'Nguyễn An']);
    expect(res.body.hoc_vien).toContainEqual(
      expect.objectContaining({
        hoc_vien_id: hv.cuong,
        ngay_sinh: '02/03/1988',
        doi_buoi: 'vao',
        ghi_chu: 'Đổi buổi – từ lớp Zoom B',
      }),
    );
    expect(res.body.hoc_vien).toContainEqual(
      expect.objectContaining({ hoc_vien_id: hv.an, ghi_chu: null }),
    );
    expect(res.body.doi_ra).toEqual([
      expect.objectContaining({
        hoc_vien_id: hv.binh,
        doi_buoi: 'ra',
        ghi_chu: 'Đã chuyển sang lớp Zoom C – không học buổi này',
      }),
    ]);
  });

  it('đề nghị chờ duyệt / bị từ chối / mất hiệu lực không làm đổi danh sách', async () => {
    const res = await get(
      `/ho-tro-hoc-vien/lop/${lop.a}/buoi/${lich.a1}/hoc-vien`,
    );
    const ids = [
      ...(res.body.hoc_vien as { hoc_vien_id: string }[]),
      ...(res.body.doi_ra as { hoc_vien_id: string }[]),
    ].map((h) => h.hoc_vien_id);
    expect(ids).not.toContain(hv.dung);
    expect(ids).not.toContain(hv.em);
    expect(ids).not.toContain(hv.giang);
    // Buổi 2 không có đổi buổi → đúng phân lớp.
    const a2 = await get(
      `/ho-tro-hoc-vien/lop/${lop.a}/buoi/${lich.a2}/hoc-vien`,
    );
    expect(
      (a2.body.hoc_vien as { hoc_vien_id: string }[]).map((h) => h.hoc_vien_id),
    ).toEqual([hv.an, hv.binh]);
    expect(a2.body.doi_ra).toEqual([]);
  });

  it('buổi của lớp khác -> 404 Không tìm thấy buổi học', async () => {
    const res = await get(
      `/ho-tro-hoc-vien/lop/${lop.a}/buoi/${lich.b1}/hoc-vien`,
    );
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Không tìm thấy buổi học');
    const xuat = await get(
      `/ho-tro-hoc-vien/lop/${lop.a}/buoi/xuat?lich_id=${lich.b1}`,
    );
    expect(xuat.status).toBe(404);
  });

  it('lớp không được gắn -> 404 Không tìm thấy lớp', async () => {
    for (const path of [
      `/ho-tro-hoc-vien/lop/${lop.b}/buoi`,
      `/ho-tro-hoc-vien/lop/${lop.b}/buoi/${lich.b1}/hoc-vien`,
      `/ho-tro-hoc-vien/lop/${lop.b}/buoi/xuat`,
    ]) {
      const res = await get(path);
      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe('Không tìm thấy lớp');
    }
  });

  it('xuất 1 buổi: 1 sheet, cột Ghi chú, mục người đổi ra; có nhật ký', async () => {
    const dem = () =>
      prisma.nhat_ky_hoat_dong.count({
        where: {
          hanh_dong: 'ho_tro_xuat_danh_sach_buoi',
          nguoi_dung_id: hoTro.id,
        },
      });
    const truoc = await dem();
    const res = await taiFile(
      `/ho-tro-hoc-vien/lop/${lop.a}/buoi/xuat?lich_id=${lich.a1}`,
    );
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['content-disposition']).toMatch(/ds-buoi-\d{8}\.xlsx/);
    const wb = await docFile(res.body as Buffer);
    expect(wb.worksheets).toHaveLength(1);
    expect(wb.worksheets[0].name).toMatch(/^GĐ1 B1 \d{2}-\d{2}$/);
    const dong = vanBan(wb.worksheets[0]);
    // Dòng 3 = tổng hợp điểm danh (ADR 0008 L8), dòng 4 = tiêu đề cột.
    expect(dong[2]).toMatch(/^Điểm danh: Có mặt 0 · /);
    expect(dong[3].split('|')).toEqual(
      expect.arrayContaining([
        'Mã MOET',
        'Điểm danh',
        'Giờ tự điểm danh',
        'Ghi chú',
      ]),
    );
    expect(dong.join('\n')).toContain('Đổi buổi – từ lớp Zoom B');
    expect(dong).toContain('Đã chuyển sang lớp khác (không học buổi này)');
    expect(dong.join('\n')).toContain(
      'Đã chuyển sang lớp Zoom C – không học buổi này',
    );
    expect(await dem()).toBe(truoc + 1);
  });

  it('xuất tất cả buổi: 1 sheet/buổi', async () => {
    const res = await taiFile(`/ho-tro-hoc-vien/lop/${lop.a}/buoi/xuat`);
    expect(res.status).toBe(200);
    const wb = await docFile(res.body as Buffer);
    expect(wb.worksheets.map((w) => w.name.slice(0, 6))).toEqual([
      'GĐ1 B1',
      'GĐ1 B2',
    ]);
    expect(vanBan(wb.worksheets[1]).join('\n')).not.toContain(
      'Đã chuyển sang lớp khác',
    );
  });

  it('ADR 0011 P1: người đổi vào từ lớp khác thuộc phạm vi: chi tiết -> 200', async () => {
    expect((await get(`/ho-tro-hoc-vien/hoc-vien/${hv.cuong}`)).status).toBe(
      200,
    );
    expect((await get(`/ho-tro-hoc-vien/hoc-vien/${hv.an}`)).status).toBe(200);
  });
});
