import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import type { Response } from 'superagent';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoNguoiDungTest,
  uniqueSuffix,
  xoaNguoiDungTest,
} from './utils/test-data';

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

async function buildXlsx(headers: string[], rows: string[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('data');
  sheet.addRow(headers);
  rows.forEach((r) => sheet.addRow(r));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// Tài khoản đơn vị (ADR 0002) — import Excel loại tai_khoan_don_vi.
describe('Import tài khoản đơn vị (e2e)', () => {
  let app: INestApplication;
  const suf = uniqueSuffix();
  const diaDanhIds: string[] = [];
  const donViIds: string[] = [];
  let ma: Record<'t1' | 't2' | 't3' | 'p1', string>;
  let tokenQuanTri: string;
  let quanTriId: string;
  let importId: string;

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    const tinh = await prisma.dia_danh.create({
      data: { ma: `T-itkdv-${suf}`, ten: `Tỉnh ${suf}`, cap: 'tinh_thanh' },
    });
    const xa = await prisma.dia_danh.create({
      data: { ma: `X-itkdv-${suf}`, ten: `Xã ${suf}`, cap: 'phuong_xa_dac_khu', parent_id: tinh.id },
    });
    diaDanhIds.push(xa.id, tinh.id);
    const tao = async (nhan: string, loai: 'truong' | 'phong_vhxh' | 'khac') => {
      const dv = await prisma.don_vi_cong_tac.create({
        data: {
          ma_don_vi: `DV-itkdv${nhan}-${suf}`,
          ten_don_vi: `Đơn vị ${nhan} ${suf}`,
          loai_don_vi: loai,
          dia_ban_id: xa.id,
        },
      });
      donViIds.push(dv.id);
      return dv.ma_don_vi;
    };
    ma = { t1: await tao('t1', 'truong'), t2: await tao('t2', 'truong'), t3: await tao('t3', 'truong'), p1: await tao('p1', 'phong_vhxh') };
    const dvQt = await prisma.don_vi_cong_tac.findFirstOrThrow({ where: { ma_don_vi: ma.p1 } });
    const qt = await taoNguoiDungTest({ vai_tro: 'quan_tri', don_vi_id: dvQt.id, mat_khau: 'QuanTri12345' });
    quanTriId = qt.nguoiDung.id;
    tokenQuanTri = (
      await http().post('/auth/dang-nhap').send({ ten_dang_nhap: qt.ten_dang_nhap, mat_khau: 'QuanTri12345' })
    ).body.token;
  });

  afterAll(async () => {
    const tk = await prisma.nguoi_dung.findMany({ where: { don_vi_id: { in: donViIds }, vai_tro: { not: 'quan_tri' } } });
    const ids = tk.map((t) => t.id);
    await prisma.nhat_ky_dat_lai_mat_khau.deleteMany({
      where: { OR: [{ nguoi_dung_id: { in: ids } }, { thuc_hien_boi: quanTriId }] },
    });
    await prisma.token_xac_thuc.deleteMany({ where: { nguoi_dung_id: { in: ids } } });
    await prisma.hang_doi_email.deleteMany({ where: { email_nguoi_nhan: { endsWith: `${suf}@itkdv.vn` } } });
    for (const id of ids) await xoaNguoiDungTest(id);
    await prisma.nhat_ky_import.deleteMany({ where: { nguoi_import_id: quanTriId } });
    await xoaNguoiDungTest(quanTriId);
    await prisma.don_vi_cong_tac.deleteMany({ where: { id: { in: donViIds } } });
    await prisma.dia_danh.deleteMany({ where: { id: { in: diaDanhIds } } });
    await prisma.$disconnect();
    await app.close();
  });

  it('file mẫu có đúng 4 cột', async () => {
    const res = await http()
      .get('/import/mau-excel')
      .query({ loai: 'tai_khoan_don_vi' })
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .buffer(true)
      .parse(binaryParser);
    expect(res.status).toBe(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body as unknown as ExcelJS.Buffer);
    const tieuDe = (wb.worksheets[0].getRow(1).values as string[]).filter(Boolean);
    expect(tieuDe).toEqual(['ma_don_vi', 'ten_dang_nhap', 'ho_ten', 'email']);
  });

  it('bước kiểm tra: báo lỗi đúng dòng, bỏ dòng trống, trim mã có khoảng trắng', async () => {
    const buffer = await buildXlsx(
      ['ma_don_vi', 'ten_dang_nhap', 'ho_ten', 'email'],
      [
        [ma.t1, '', 'Hiệu trưởng T1', ''], // dòng 2: không email -> mật khẩu tạm
        [ma.t2, '', '', `t2-${suf}@itkdv.vn`], // dòng 3: có email -> link
        [ma.p1, `phong-x-${suf}`, '', ''], // dòng 4: tên gợi nhớ
        [`DV-khong-co-${suf}`, '', '', ''], // dòng 5: mã không tồn tại
        [ma.t1, `khac-${suf}`, '', ''], // dòng 6: trùng mã trong file
        [` ${ma.t3} `, '', '', ''], // dòng 7: mã có khoảng trắng
        ['', '', '', ''], // dòng trống -> bỏ qua
      ],
    );
    const res = await http()
      .post('/import/tai_khoan_don_vi')
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .attach('file', buffer, 'tai-khoan.xlsx');
    expect(res.status).toBe(201);
    importId = res.body.import_id;
    const kq = await http().get(`/import/${importId}`).set('Authorization', `Bearer ${tokenQuanTri}`);
    const loi = kq.body.danh_sach_loi as { dong: number; ly_do: string }[];
    expect(loi.map((l) => l.dong).sort()).toEqual([5, 6]);
    expect(loi.find((l) => l.dong === 5)!.ly_do).toContain(`DV-khong-co-${suf}`);
    expect(loi.find((l) => l.dong === 6)!.ly_do).toContain('Trùng');
    expect(kq.body.tong_so_dong).toBe(6);
  });

  it('xác nhận: trả file xlsx mật khẩu tạm, tạo tài khoản, xếp email cho dòng có email', async () => {
    const res = await http()
      .post(`/import/${importId}/xac-nhan`)
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .buffer(true)
      .parse(binaryParser);
    expect(res.status).toBe(201);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.headers['content-disposition']).toContain(`mat-khau-tam-${importId}.xlsx`);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body as unknown as ExcelJS.Buffer);
    const sheet = wb.getWorksheet('Mật khẩu tạm')!;
    const dong = (sheet.getSheetValues() as unknown[][]).slice(2).map((r) => r.slice(1) as string[]);
    expect((sheet.getRow(1).values as string[]).filter(Boolean)).toEqual([
      'Mã đơn vị', 'Tên đơn vị', 'Tên đăng nhập', 'Mật khẩu tạm', 'Cách cấp',
    ]);
    const theoMa = new Map(dong.map((r) => [r[0], r]));
    expect(theoMa.get(ma.t1)![3]).toMatch(/^[A-Za-z2-9]{10}$/);
    expect(theoMa.get(ma.t1)![4]).toBe('Mật khẩu tạm');
    expect(theoMa.get(ma.t3)![3]).toMatch(/^[A-Za-z2-9]{10}$/);
    expect(theoMa.get(ma.t2)![3] ?? '').toBe('');
    expect(theoMa.get(ma.t2)![4]).toBe('Email kích hoạt');
    expect(theoMa.get(ma.p1)![2]).toBe(`phong-x-${suf}`);

    const dn = await http()
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap: ma.t1.toLowerCase(), mat_khau: theoMa.get(ma.t1)![3] });
    expect(dn.status).toBe(200);
    expect(
      await prisma.hang_doi_email.count({ where: { email_nguoi_nhan: `t2-${suf}@itkdv.vn`, loai_su_kien: 'kich_hoat_tai_khoan' } }),
    ).toBe(1);
    const nk = await prisma.nhat_ky_import.findUniqueOrThrow({ where: { id: importId } });
    expect(nk.so_dong_thanh_cong).toBe(4);
    expect(nk.trang_thai).toBe('hoan_thanh');
    const thuMuc = path.resolve(__dirname, '../storage/import', importId);
    if (fs.existsSync(thuMuc)) {
      for (const f of fs.readdirSync(thuMuc)) expect(f).not.toMatch(/mat-khau/i);
    }
  });

  it('xác nhận lần 2 -> 409', async () => {
    const res = await http().post(`/import/${importId}/xac-nhan`).set('Authorization', `Bearer ${tokenQuanTri}`);
    expect(res.status).toBe(409);
  });
});
