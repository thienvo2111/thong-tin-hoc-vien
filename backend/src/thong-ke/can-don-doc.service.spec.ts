import * as ExcelJS from 'exceljs';
import { CanDonDocService } from './can-don-doc.service';
import { PrismaService } from '../prisma/prisma.service';
import { ThongKeScopeService } from './thong-ke-scope.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

const user: AuthenticatedUser = {
  id: 'u-1',
  ten_dang_nhap: 'x',
  vai_tro: 'quan_tri',
  don_vi_id: null,
  hoc_vien_id: null,
  phai_doi_mat_khau: false,
  jti: 'jti-1',
  exp: 9999999999,
};

const dong = (id: string, ten = `HV ${id}`) => ({
  hoc_vien_id: id,
  hoc_vien: {
    ho_ten: ten,
    so_dien_thoai_lien_he: '0900',
    email_lien_he: `${id}@x.vn`,
    don_vi_cong_tac: { ten_don_vi: 'Trường A' },
  },
  id: `dk-${id}`,
  khoa: { ten_khoa: 'Khóa 1' },
});

describe('CanDonDocService', () => {
  let service: CanDonDocService;
  let prisma: {
    dang_ky_hoc: { findMany: jest.Mock; count: jest.Mock };
    diem_danh: { groupBy: jest.Mock };
    ket_qua_giai_doan: { findMany: jest.Mock };
  };
  let scope: { resolve: jest.Mock };

  beforeEach(() => {
    prisma = {
      dang_ky_hoc: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      diem_danh: { groupBy: jest.fn().mockResolvedValue([]) },
      ket_qua_giai_doan: { findMany: jest.fn().mockResolvedValue([]) },
    };
    scope = {
      resolve: jest
        .fn()
        .mockResolvedValue({
          where: { SCOPE: 1 },
          rong: false,
          khoaIds: 'ALL',
        }),
    };
    service = new CanDonDocService(
      prisma as unknown as PrismaService,
      scope as unknown as ThongKeScopeService,
    );
  });

  const whereDaGoi = () =>
    prisma.dang_ky_hoc.findMany.mock.calls[0][0].where as {
      AND: unknown[];
    };

  it('phạm vi rỗng: không truy vấn, trả rỗng', async () => {
    scope.resolve.mockResolvedValue({ where: {}, rong: true, khoaIds: [] });
    const r = await service.danhSach(user, { loai: 'chua_truy_cap', page: 3 });
    expect(r).toEqual({ tong: 0, page: 3, items: [] });
    expect(prisma.dang_ky_hoc.findMany).not.toHaveBeenCalled();
  });

  it('chua_truy_cap: lọc không có tài khoản hoặc chưa đăng nhập', async () => {
    prisma.dang_ky_hoc.findMany.mockResolvedValue([dong('a')]);
    prisma.dang_ky_hoc.count.mockResolvedValue(1);
    const r = await service.danhSach(user, { loai: 'chua_truy_cap' });
    expect(whereDaGoi().AND).toEqual([
      { SCOPE: 1 },
      {
        hoc_vien: {
          OR: [
            { nguoi_dung_account: { is: null } },
            { nguoi_dung_account: { is: { dang_nhap_lan_cuoi: null } } },
          ],
        },
      },
    ]);
    expect(r).toEqual({
      tong: 1,
      page: 1,
      items: [
        {
          hoc_vien_id: 'a',
          ho_ten: 'HV a',
          ten_don_vi: 'Trường A',
          ten_khoa: 'Khóa 1',
          so_dien_thoai: '0900',
          email: 'a@x.vn',
          chi_tiet: '',
        },
      ],
    });
  });

  it('chua_khao_sat: không có đánh giá đầu vào hoàn thành', async () => {
    await service.danhSach(user, { loai: 'chua_khao_sat' });
    expect(whereDaGoi().AND[1]).toEqual({
      hoc_vien: {
        ket_qua_khao_sat: {
          none: { loai: 'danh-gia', trang_thai: 'hoan_thanh' },
        },
      },
    });
  });

  it('vang_nhieu: groupBy chỉ tính "vang", ngưỡng >= 2, chi_tiết "Vắng n buổi"', async () => {
    prisma.diem_danh.groupBy.mockResolvedValue([
      { dang_ky_hoc_id: 'dk-a', _count: { _all: 3 } },
    ]);
    prisma.dang_ky_hoc.findMany.mockResolvedValue([dong('a')]);
    prisma.dang_ky_hoc.count.mockResolvedValue(1);
    const r = await service.danhSach(user, { loai: 'vang_nhieu' });
    expect(prisma.diem_danh.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['dang_ky_hoc_id'],
        where: { trang_thai: 'vang', dang_ky_hoc: { SCOPE: 1 } },
        having: { dang_ky_hoc_id: { _count: { gte: 2 } } },
      }),
    );
    expect(whereDaGoi().AND[1]).toEqual({ id: { in: ['dk-a'] } });
    expect(r.items[0].chi_tiet).toBe('Vắng 3 buổi');
  });

  it('vang_nhieu: không ai đủ ngưỡng -> rỗng, không truy vấn đăng ký', async () => {
    const r = await service.danhSach(user, { loai: 'vang_nhieu' });
    expect(r).toEqual({ tong: 0, page: 1, items: [] });
    expect(prisma.dang_ky_hoc.findMany).not.toHaveBeenCalled();
  });

  it('vle_thap: ngưỡng < 50 (49.99 có, 50 không) và lấy mức thấp nhất', async () => {
    prisma.ket_qua_giai_doan.findMany.mockResolvedValue([
      { dang_ky_hoc_id: 'dk-a', ty_le_hoan_thanh: 49.99 },
      { dang_ky_hoc_id: 'dk-a', ty_le_hoan_thanh: 42.5 },
      { dang_ky_hoc_id: 'dk-b', ty_le_hoan_thanh: '42.00' },
    ]);
    prisma.dang_ky_hoc.findMany.mockResolvedValue([dong('a'), dong('b')]);
    prisma.dang_ky_hoc.count.mockResolvedValue(2);
    const r = await service.danhSach(user, { loai: 'vle_thap' });
    expect(prisma.ket_qua_giai_doan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ty_le_hoan_thanh: { lt: 50 },
          dang_ky_hoc: { SCOPE: 1 },
        },
      }),
    );
    expect(whereDaGoi().AND[1]).toEqual({ id: { in: ['dk-a', 'dk-b'] } });
    expect(r.items.map((i) => i.chi_tiet)).toEqual(['VLE 42.5%', 'VLE 42%']);
  });

  it('page 2 -> skip 20, take 20, sắp xếp ổn định theo họ tên rồi khóa', async () => {
    await service.danhSach(user, { loai: 'chua_truy_cap', page: 2 });
    const arg = prisma.dang_ky_hoc.findMany.mock.calls[0][0];
    expect(arg.skip).toBe(20);
    expect(arg.take).toBe(20);
    expect(arg.orderBy).toEqual([
      { hoc_vien: { ho_ten: 'asc' } },
      { khoa: { ten_khoa: 'asc' } },
      { id: 'asc' },
    ]);
  });

  it('xuatExcel: Buffer có header, mọi dòng, không phân trang', async () => {
    prisma.dang_ky_hoc.findMany.mockResolvedValue([dong('a'), dong('b')]);
    const buf = await service.xuatExcel(user, { loai: 'chua_truy_cap' });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(prisma.dang_ky_hoc.findMany.mock.calls[0][0].skip).toBeUndefined();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    const sheet = wb.worksheets[0];
    expect(sheet.getRow(1).getCell(2).value).toBe('Họ tên');
    expect(sheet.rowCount).toBe(3);
    expect(sheet.getRow(2).getCell(2).value).toBe('HV a');
  });

  it('xuatExcel: phạm vi rỗng -> workbook chỉ có header', async () => {
    scope.resolve.mockResolvedValue({ where: {}, rong: true, khoaIds: [] });
    const buf = await service.xuatExcel(user, { loai: 'vle_thap' });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    expect(wb.worksheets[0].rowCount).toBe(1);
    expect(prisma.dang_ky_hoc.findMany).not.toHaveBeenCalled();
  });
});
