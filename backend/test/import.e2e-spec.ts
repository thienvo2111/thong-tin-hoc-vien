import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import type { Response } from 'superagent';
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

// supertest/superagent không tự nhận diện mimetype xlsx là nhị phân — tự
// đăng ký parser gom raw bytes để đọc lại bằng exceljs trong test.
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

async function buildXlsx(
  headers: string[],
  rows: (string | undefined)[][],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('data');
  sheet.addRow(headers);
  rows.forEach((r) => sheet.addRow(r));
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

describe('Import (e2e)', () => {
  let app: INestApplication;
  let donViFixture: Awaited<ReturnType<typeof taoDonViTest>>;
  let quanTri: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let truong: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let tokenQuanTri: string;
  let tokenTruong: string;

  const createdMonHocIds: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    donViFixture = await taoDonViTest('import');
    quanTri = await taoNguoiDungTest({
      vai_tro: 'quan_tri',
      don_vi_id: donViFixture.donVi.id,
      mat_khau: 'MatKhau123',
    });
    truong = await taoNguoiDungTest({
      vai_tro: 'truong',
      don_vi_id: donViFixture.donVi.id,
      mat_khau: 'MatKhau123',
    });

    tokenQuanTri = (
      await request(app.getHttpServer()).post('/auth/dang-nhap').send({
        ten_dang_nhap: quanTri.ten_dang_nhap,
        mat_khau: quanTri.mat_khau,
      })
    ).body.token;
    tokenTruong = (
      await request(app.getHttpServer()).post('/auth/dang-nhap').send({
        ten_dang_nhap: truong.ten_dang_nhap,
        mat_khau: truong.mat_khau,
      })
    ).body.token;
  });

  afterAll(async () => {
    await prisma.mon_hoc.deleteMany({
      where: { id: { in: createdMonHocIds } },
    });
    await prisma.nhat_ky_import.deleteMany({
      where: { nguoi_import_id: quanTri.nguoiDung.id },
    });
    await xoaNguoiDungTest(quanTri.nguoiDung.id);
    await xoaNguoiDungTest(truong.nguoiDung.id);
    await xoaDonViTest(
      [donViFixture.donVi.id],
      [donViFixture.diaDanhXa.id, donViFixture.diaDanhTinh.id],
    );
    await prisma.$disconnect();
    await app.close();
  });

  describe('Phân quyền', () => {
    it('truong (không phải quan_tri) gọi bất kỳ endpoint import nào -> 403', async () => {
      await request(app.getHttpServer())
        .get('/import')
        .set('Authorization', `Bearer ${tokenTruong}`)
        .expect(403);
    });
  });

  describe('GET /import/mau-excel', () => {
    it('loại không tồn tại -> 400', async () => {
      const res = await request(app.getHttpServer())
        .get('/import/mau-excel?loai=khong_ton_tai')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('mon_hoc -> trả file xlsx đúng header', async () => {
      const res = await request(app.getHttpServer())
        .get('/import/mau-excel?loai=mon_hoc')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .buffer(true)
        .parse(binaryParser)
        .expect(200);
      expect(res.headers['content-type']).toContain('spreadsheetml');

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body as unknown as ExcelJS.Buffer);
      const headerRow = workbook.worksheets[0].getRow(1).values as unknown[];
      expect(headerRow.slice(1)).toEqual(['ten_mon', 'cap_hoc']);
    });

    it('ho_so_nhan_su_moet -> trả file xlsx đúng cột theo api-contract.md', async () => {
      const res = await request(app.getHttpServer())
        .get('/import/mau-excel?loai=ho_so_nhan_su_moet')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .buffer(true)
        .parse(binaryParser)
        .expect(200);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body as unknown as ExcelJS.Buffer);
      const headerRow = workbook.worksheets[0].getRow(1).values as unknown[];
      expect(headerRow.slice(1)).toEqual([
        'Đơn vị',
        'Mã định danh (CDSL moet)',
        'Họ và tên',
        'Ngày',
        'Tháng',
        'Năm',
        'Chức vụ',
        'Chuyên môn',
        'Số điện thoại',
        'Ghi chú',
      ]);
    });
  });

  describe('Luồng import mon_hoc: preview -> file lỗi -> xác nhận', () => {
    let importId: string;
    let tenMonHopLe: string;

    it('POST /import/mon_hoc: 1 dòng hợp lệ, 1 dòng enum sai -> preview đúng số liệu', async () => {
      tenMonHopLe = `Import hợp lệ ${uniqueSuffix()}`;
      const buffer = await buildXlsx(
        ['ten_mon', 'cap_hoc'],
        [
          [tenMonHopLe, 'thpt'],
          ['Dòng lỗi', 'cap_khong_ton_tai'],
        ],
      );

      const res = await request(app.getHttpServer())
        .post('/import/mon_hoc')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach('file', buffer, 'mon-hoc.xlsx')
        .expect(201);

      expect(res.body.trang_thai).toBe('dang_xu_ly');
      importId = res.body.import_id;

      const ketQua = await request(app.getHttpServer())
        .get(`/import/${importId}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(ketQua.body.tong_so_dong).toBe(2);
      expect(ketQua.body.so_dong_thanh_cong).toBe(1);
      expect(ketQua.body.so_dong_loi).toBe(1);
      expect(ketQua.body.danh_sach_loi[0].dong).toBe(3);

      // Chưa xác nhận -> chưa có trong bảng thật
      const chuaCo = await prisma.mon_hoc.findFirst({
        where: { ten_mon: tenMonHopLe },
      });
      expect(chuaCo).toBeNull();
    });

    it('GET /import/:id/file-loi trả file chỉ chứa dòng lỗi', async () => {
      const res = await request(app.getHttpServer())
        .get(`/import/${importId}/file-loi`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .buffer(true)
        .parse(binaryParser)
        .expect(200);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body as unknown as ExcelJS.Buffer);
      const sheet = workbook.worksheets[0];
      expect(sheet.rowCount).toBe(2); // header + 1 dòng lỗi
      const headerValues = sheet.getRow(1).values as unknown[];
      expect(headerValues).toContain('Lý do');
    });

    it('POST /import/:id/xac-nhan: nạp dòng hợp lệ vào bảng thật, giữ nguyên dòng lỗi', async () => {
      const res = await request(app.getHttpServer())
        .post(`/import/${importId}/xac-nhan`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(201);

      expect(res.body.trang_thai).toBe('hoan_thanh');
      expect(res.body.so_dong_thanh_cong).toBe(1);
      expect(res.body.so_dong_loi).toBe(1);

      const daTao = await prisma.mon_hoc.findFirst({
        where: { ten_mon: tenMonHopLe },
      });
      expect(daTao).not.toBeNull();
      expect(daTao?.nguon_import_id).toBe(importId);
      if (daTao) createdMonHocIds.push(daTao.id);
    });

    it('xác nhận lần 2 -> 409 CONFLICT (không nạp trùng)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/import/${importId}/xac-nhan`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('GET /import (lịch sử) chứa lượt import vừa tạo', async () => {
      const res = await request(app.getHttpServer())
        .get('/import')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(res.body.data.some((x: { id: string }) => x.id === importId)).toBe(
        true,
      );
    });
  });

  describe('File sai cột', () => {
    it('header không khớp mẫu -> 400, ghi log trang_thai=loi', async () => {
      const buffer = await buildXlsx(['cot_sai'], [['x']]);
      const res = await request(app.getHttpServer())
        .post('/import/mon_hoc')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach('file', buffer, 'sai.xlsx')
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');

      const log = await prisma.nhat_ky_import.findFirst({
        where: {
          nguoi_import_id: quanTri.nguoiDung.id,
          ten_file_goc: 'sai.xlsx',
        },
      });
      expect(log?.trang_thai).toBe('loi');
    });
  });
});
