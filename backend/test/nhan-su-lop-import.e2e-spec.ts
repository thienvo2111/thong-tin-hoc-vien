import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as ExcelJS from 'exceljs';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoDonViTest,
  taoNguoiDungTest,
  uniqueSuffix,
  xoaNguoiDungTest,
  xoaDonViTest,
} from './utils/test-data';

const COLUMNS_NHAN_SU = [
  'ma_khoa',
  'ten_lop',
  'loai_lop',
  'ho_ten',
  'vai_tro',
  'so_dien_thoai',
];

type Cell = string | number | undefined;

async function buildXlsx(columns: string[], rows: Cell[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('data');
  sheet.addRow(columns);
  rows.forEach((r) => sheet.addRow(r));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// Import nhan_su_lop (giảng viên/hỗ trợ của lớp) + tham số ?ma_khoa= dùng
// khi import từ trang chi tiết khóa.
describe('Import nhan_su_lop + ?ma_khoa= (e2e)', () => {
  let app: INestApplication;
  let donViFixture: Awaited<ReturnType<typeof taoDonViTest>>;
  let quanTri: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let tokenQuanTri: string;
  let khoa: { id: string; ma_khoa: string };
  let khoaKhac: { id: string; ma_khoa: string };
  let lopId: string;
  const TEN_LOP = 'Lớp zoom 1';

  const khoaIds: string[] = [];
  const importIds: string[] = [];

  async function taoKhoa() {
    const suf = uniqueSuffix();
    const res = await request(app.getHttpServer())
      .post('/khoa-boi-duong')
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .send({
        ma_khoa: `K-NS-${suf}`,
        ten_khoa: `Khóa test nhân sự ${suf}`,
        don_vi_dat_hang_id: donViFixture.donVi.id,
        thoi_gian_bat_dau: '2026-01-01',
        thoi_gian_ket_thuc: '2026-12-31',
      })
      .expect(201);
    khoaIds.push(res.body.id);
    return res.body as { id: string; ma_khoa: string };
  }

  async function taiLen(loai: string, buffer: Buffer, maKhoa?: string) {
    const url = maKhoa
      ? `/import/${loai}?ma_khoa=${encodeURIComponent(maKhoa)}`
      : `/import/${loai}`;
    return request(app.getHttpServer())
      .post(url)
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .attach('file', buffer, `${loai}.xlsx`);
  }

  async function importVaKetQua(
    loai: string,
    columns: string[],
    rows: Cell[][],
    maKhoa?: string,
  ) {
    const res = await taiLen(loai, await buildXlsx(columns, rows), maKhoa);
    expect(res.status).toBe(201);
    importIds.push(res.body.import_id);
    const ketQua = await request(app.getHttpServer())
      .get(`/import/${res.body.import_id}`)
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .expect(200);
    return {
      importId: res.body.import_id as string,
      ketQua: ketQua.body as {
        so_dong_thanh_cong: number;
        so_dong_loi: number;
        danh_sach_loi: { dong: number; ly_do: string }[];
      },
    };
  }

  async function xacNhan(importId: string) {
    await request(app.getHttpServer())
      .post(`/import/${importId}/xac-nhan`)
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .expect(201);
  }

  function nhanSuCuaLop() {
    return prisma.lop_hoc_nhan_su.findMany({
      where: { lop_id: lopId },
      orderBy: { ho_ten: 'asc' },
    });
  }

  beforeAll(async () => {
    app = await createTestApp();
    donViFixture = await taoDonViTest('ns');
    quanTri = await taoNguoiDungTest({
      vai_tro: 'quan_tri',
      don_vi_id: donViFixture.donVi.id,
      mat_khau: 'MatKhau123',
    });
    const dn = await request(app.getHttpServer())
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap: quanTri.ten_dang_nhap, mat_khau: 'MatKhau123' })
      .expect(200);
    tokenQuanTri = dn.body.token;

    khoa = await taoKhoa();
    khoaKhac = await taoKhoa();
    const lop = await request(app.getHttpServer())
      .post(`/khoa-boi-duong/${khoa.id}/lop`)
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .send({ loai_lop: 'zoom', ten_lop: TEN_LOP })
      .expect(201);
    lopId = lop.body.id;
  });

  afterAll(async () => {
    await prisma.lop_hoc_nhan_su.deleteMany({
      where: { lop: { khoa_id: { in: khoaIds } } },
    });
    await prisma.lich_hoc_lop.deleteMany({
      where: { giai_doan: { khoa_id: { in: khoaIds } } },
    });
    await prisma.lop_hoc.deleteMany({ where: { khoa_id: { in: khoaIds } } });
    await prisma.giai_doan_khoa.deleteMany({
      where: { khoa_id: { in: khoaIds } },
    });
    await prisma.nhat_ky_import.deleteMany({
      where: { id: { in: importIds } },
    });
    await prisma.khoa_boi_duong.deleteMany({ where: { id: { in: khoaIds } } });
    await xoaNguoiDungTest(quanTri.nguoiDung.id);
    await xoaDonViTest(
      [donViFixture.donVi.id],
      [donViFixture.diaDanhXa.id, donViFixture.diaDanhTinh.id],
    );
    await prisma.$disconnect();
    await app.close();
  });

  describe('GET /import/mau-excel?loai=nhan_su_lop', () => {
    it('trả file mẫu đúng 6 cột theo thứ tự', async () => {
      const res = await request(app.getHttpServer())
        .get('/import/mau-excel?loai=nhan_su_lop')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(res.body as unknown as ExcelJS.Buffer);
      const header = (wb.worksheets[0].getRow(1).values as unknown[]).slice(1);
      expect(header).toEqual(COLUMNS_NHAN_SU);
    });
  });

  describe('Luồng import nhan_su_lop', () => {
    it('happy path: tạo giảng viên + hỗ trợ cho lớp đã tồn tại', async () => {
      const { importId, ketQua } = await importVaKetQua(
        'nhan_su_lop',
        COLUMNS_NHAN_SU,
        [
          [
            khoa.ma_khoa,
            TEN_LOP,
            'zoom',
            'Trần Văn A',
            'giang_vien',
            '0901111111',
          ],
          [khoa.ma_khoa, TEN_LOP, 'zoom', 'Nguyễn Thị B', 'ho_tro', undefined],
        ],
      );
      expect(ketQua.so_dong_loi).toBe(0);
      expect(ketQua.so_dong_thanh_cong).toBe(2);
      await xacNhan(importId);

      const ds = await nhanSuCuaLop();
      expect(ds.map((n) => [n.ho_ten, n.vai_tro, n.so_dien_thoai])).toEqual([
        ['Nguyễn Thị B', 'ho_tro', null],
        ['Trần Văn A', 'giang_vien', '0901111111'],
      ]);
    });

    it('chạy lại (khác hoa thường) -> cập nhật vai trò/SĐT, không tạo trùng; SĐT trống giữ số cũ', async () => {
      const { importId } = await importVaKetQua(
        'nhan_su_lop',
        COLUMNS_NHAN_SU,
        [
          [khoa.ma_khoa, TEN_LOP, 'zoom', 'TRẦN VĂN A', 'ho_tro', undefined],
          [
            khoa.ma_khoa,
            TEN_LOP,
            'zoom',
            'nguyễn thị b',
            'giang_vien',
            '0902222222',
          ],
        ],
      );
      await xacNhan(importId);

      const ds = await nhanSuCuaLop();
      expect(ds).toHaveLength(2);
      const a = ds.find((n) => n.ho_ten === 'Trần Văn A');
      const b = ds.find((n) => n.ho_ten === 'Nguyễn Thị B');
      expect(a?.vai_tro).toBe('ho_tro');
      expect(a?.so_dien_thoai).toBe('0901111111');
      expect(b?.vai_tro).toBe('giang_vien');
      expect(b?.so_dien_thoai).toBe('0902222222');
    });

    it.each([
      ['thiếu loai_lop', [TEN_LOP, '', 'X', 'giang_vien', ''], 'loai_lop'],
      ['loai_lop sai', [TEN_LOP, 'online', 'X', 'giang_vien', ''], 'loai_lop'],
      ['vai_tro sai', [TEN_LOP, 'zoom', 'X', 'tro_giang', ''], 'vai_tro'],
      ['thiếu ho_ten', [TEN_LOP, 'zoom', '', 'giang_vien', ''], 'ho_ten'],
      [
        'lớp không tồn tại',
        ['Lớp ma', 'zoom', 'X', 'giang_vien', ''],
        'không tồn tại',
      ],
      [
        'đúng tên nhưng sai loại lớp',
        [TEN_LOP, 'vle', 'X', 'giang_vien', ''],
        'không tồn tại',
      ],
      [
        'SĐT > 20 ký tự',
        [TEN_LOP, 'zoom', 'X', 'giang_vien', '0'.repeat(21)],
        'so_dien_thoai',
      ],
    ])('%s -> dòng lỗi', async (_ten, cot, chuoiLoi) => {
      const { ketQua } = await importVaKetQua('nhan_su_lop', COLUMNS_NHAN_SU, [
        [khoa.ma_khoa, ...(cot as string[])],
      ]);
      expect(ketQua.so_dong_loi).toBe(1);
      expect(ketQua.danh_sach_loi[0].ly_do).toEqual(
        expect.stringContaining(chuoiLoi as string),
      );
    });

    it('khóa không tồn tại -> dòng lỗi', async () => {
      const { ketQua } = await importVaKetQua('nhan_su_lop', COLUMNS_NHAN_SU, [
        ['KHONG-CO-KHOA', TEN_LOP, 'zoom', 'X', 'giang_vien', ''],
      ]);
      expect(ketQua.so_dong_loi).toBe(1);
      expect(ketQua.danh_sach_loi[0].ly_do).toEqual(
        expect.stringContaining('KHONG-CO-KHOA'),
      );
    });

    it('2 dòng cùng (lớp, họ tên) trong 1 file -> dòng sau lỗi trùng', async () => {
      const { ketQua } = await importVaKetQua('nhan_su_lop', COLUMNS_NHAN_SU, [
        [khoa.ma_khoa, TEN_LOP, 'zoom', 'Lê Văn C', 'giang_vien', ''],
        [khoa.ma_khoa, TEN_LOP, 'zoom', 'lê văn c', 'ho_tro', ''],
      ]);
      expect(ketQua.so_dong_thanh_cong).toBe(1);
      expect(ketQua.so_dong_loi).toBe(1);
      expect(ketQua.danh_sach_loi[0].ly_do).toEqual(
        expect.stringContaining('trùng'),
      );
    });
  });

  describe('POST /import/{loai}?ma_khoa=', () => {
    it('dòng để trống ma_khoa -> tự gán khóa, xác nhận ghi vào đúng khóa', async () => {
      const { importId, ketQua } = await importVaKetQua(
        'nhan_su_lop',
        COLUMNS_NHAN_SU,
        [['', TEN_LOP, 'zoom', 'Phạm Văn D', 'giang_vien', '']],
        khoa.ma_khoa,
      );
      expect(ketQua.so_dong_loi).toBe(0);
      await xacNhan(importId);
      const ds = await nhanSuCuaLop();
      expect(ds.some((n) => n.ho_ten === 'Phạm Văn D')).toBe(true);
    });

    it('lop_va_lich_hoc: ma_khoa trống được gán khóa mặc định khi xác nhận', async () => {
      await request(app.getHttpServer())
        .post(`/khoa-boi-duong/${khoa.id}/giai-doan`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .send({
          thu_tu: 1,
          ten_giai_doan: 'Giai đoạn 1',
          hinh_thuc: 'truc_tuyen',
          thoi_gian_bat_dau: '2026-01-01',
          thoi_gian_ket_thuc: '2026-12-31',
        })
        .expect(201);
      const { importId, ketQua } = await importVaKetQua(
        'lop_va_lich_hoc',
        [
          'ma_khoa',
          'ten_lop',
          'loai_lop',
          'nhom_hoc_vien',
          'muc_nang_luc',
          'si_so_toi_da',
          'giai_doan_thu_tu',
          'buoi_so',
          'bat_dau',
          'ket_thuc',
          'dia_diem_hoac_link',
          'ma_diem_hoc',
        ],
        [
          [
            '',
            'Lớp VLE từ trang khóa',
            'vle',
            undefined,
            undefined,
            500,
            1,
            1,
            '10/10/2026 08:00',
            '10/10/2026 11:00',
            undefined,
            undefined,
          ],
        ],
        khoa.ma_khoa,
      );
      expect(ketQua.so_dong_loi).toBe(0);
      await xacNhan(importId);
      const lop = await prisma.lop_hoc.findFirst({
        where: { khoa_id: khoa.id, ten_lop: 'Lớp VLE từ trang khóa' },
        include: { lich_hoc: true },
      });
      expect(lop?.lich_hoc).toHaveLength(1);
    });

    it('dòng ghi khóa khác khóa đang import -> dòng lỗi, không ghi gì', async () => {
      const { ketQua } = await importVaKetQua(
        'nhan_su_lop',
        COLUMNS_NHAN_SU,
        [[khoaKhac.ma_khoa, TEN_LOP, 'zoom', 'Võ Văn E', 'giang_vien', '']],
        khoa.ma_khoa,
      );
      expect(ketQua.so_dong_loi).toBe(1);
      expect(ketQua.danh_sach_loi[0].ly_do).toEqual(
        expect.stringContaining('khác khóa đang import'),
      );
    });

    it('khóa trong ?ma_khoa= không tồn tại -> 404', async () => {
      const res = await taiLen(
        'nhan_su_lop',
        await buildXlsx(COLUMNS_NHAN_SU, [
          ['', TEN_LOP, 'zoom', 'X', 'giang_vien', ''],
        ]),
        'KHONG-CO-KHOA',
      );
      expect(res.status).toBe(404);
    });

    it('loại import không có cột ma_khoa (dia_danh) -> 400', async () => {
      const res = await taiLen(
        'dia_danh',
        await buildXlsx(
          ['ma', 'ten', 'cap', 'parent_ma'],
          [['X', 'Y', 'tinh', '']],
        ),
        khoa.ma_khoa,
      );
      expect(res.status).toBe(400);
    });
  });
});
