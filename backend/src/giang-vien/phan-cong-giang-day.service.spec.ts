import {
  chongGio,
  PhanCongGiangDayService,
} from './phan-cong-giang-day.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConflictAppException,
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { chuanHoaEmail, chuanHoaSoDienThoai } from './lien-he.util';

const gio = (bd: string, kt: string) => ({
  thoi_gian_bat_dau: new Date(bd),
  thoi_gian_ket_thuc: new Date(kt),
});

describe('chongGio', () => {
  const a = gio('2026-11-01T01:00:00Z', '2026-11-01T04:00:00Z');
  it('chồng một phần → true', () => {
    expect(
      chongGio(a, gio('2026-11-01T03:00:00Z', '2026-11-01T05:00:00Z')),
    ).toBe(true);
  });
  it('nằm trọn trong → true', () => {
    expect(
      chongGio(a, gio('2026-11-01T02:00:00Z', '2026-11-01T03:00:00Z')),
    ).toBe(true);
  });
  it('chạm biên (buổi sau bắt đầu đúng lúc buổi trước kết thúc) → false', () => {
    expect(
      chongGio(a, gio('2026-11-01T04:00:00Z', '2026-11-01T06:00:00Z')),
    ).toBe(false);
  });
  it('tách rời → false', () => {
    expect(
      chongGio(a, gio('2026-11-02T01:00:00Z', '2026-11-02T04:00:00Z')),
    ).toBe(false);
  });
});

describe('lien-he.util', () => {
  it('SĐT: bỏ khoảng trắng/dấu chấm, tự thêm 0 khi thiếu, sai → null', () => {
    expect(chuanHoaSoDienThoai('0901 234.567')).toBe('0901234567');
    expect(chuanHoaSoDienThoai('901234567')).toBe('0901234567');
    expect(chuanHoaSoDienThoai('+84901234567')).toBe('+84901234567');
    expect(chuanHoaSoDienThoai('12345')).toBeNull();
  });
  it('email: trim + chữ thường; rỗng → undefined; sai → null', () => {
    expect(chuanHoaEmail(' A@B.VN ')).toBe('a@b.vn');
    expect(chuanHoaEmail('  ')).toBeUndefined();
    expect(chuanHoaEmail('khong-hop-le')).toBeNull();
  });
});

describe('PhanCongGiangDayService.thayPhanCongBuoi', () => {
  const lich = {
    id: 'lich-1',
    ...gio('2026-11-01T01:00:00Z', '2026-11-01T04:00:00Z'),
  };
  let prisma: {
    lich_hoc_lop: { findUnique: jest.Mock };
    giang_vien: { findMany: jest.Mock };
    phan_cong_giang_day: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
  let service: PhanCongGiangDayService;

  beforeEach(() => {
    prisma = {
      lich_hoc_lop: { findUnique: jest.fn().mockResolvedValue(lich) },
      giang_vien: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'gv-1', ho_ten: 'GV Một', trang_thai: 'active' },
          { id: 'gv-2', ho_ten: 'GV Hai', trang_thai: 'ngung' },
        ]),
      },
      phan_cong_giang_day: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
        upsert: jest.fn(),
      },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    service = new PhanCongGiangDayService(prisma as unknown as PrismaService);
  });

  it('buổi không tồn tại → 404', async () => {
    prisma.lich_hoc_lop.findUnique.mockResolvedValueOnce(null);
    await expect(service.thayPhanCongBuoi('x', [])).rejects.toBeInstanceOf(
      NotFoundAppException,
    );
  });

  it('trùng giảng viên trong danh sách → 400', async () => {
    await expect(
      service.thayPhanCongBuoi('lich-1', [
        { giang_vien_id: 'gv-1', vai_tro: 'giang_vien' },
        { giang_vien_id: 'gv-1', vai_tro: 'ho_tro' },
      ]),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('giảng viên đã ngừng → 400', async () => {
    await expect(
      service.thayPhanCongBuoi('lich-1', [
        { giang_vien_id: 'gv-2', vai_tro: 'giang_vien' },
      ]),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('giảng viên đã dạy buổi khác chồng giờ → 400, không ghi', async () => {
    prisma.phan_cong_giang_day.findFirst.mockResolvedValueOnce({
      lich_hoc: {
        id: 'lich-2',
        buoi_so: 1,
        thoi_gian_bat_dau: new Date('2026-11-01T02:00:00Z'),
        thoi_gian_ket_thuc: new Date('2026-11-01T05:00:00Z'),
        lop: { ten_lop: 'Lớp B', khoa: { ma_khoa: 'K1' } },
      },
    });
    await expect(
      service.thayPhanCongBuoi('lich-1', [
        { giang_vien_id: 'gv-1', vai_tro: 'giang_vien' },
      ]),
    ).rejects.toMatchObject({
      response: { error: { message: expect.stringContaining('trùng giờ') } },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    // Truy vấn trùng giờ loại trừ chính buổi đang phân công.
    expect(prisma.phan_cong_giang_day.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          giang_vien_id: 'gv-1',
          lich_hoc: expect.objectContaining({ id: { not: 'lich-1' } }),
        }),
      }),
    );
  });

  it('gỡ phân công đã xác nhận giờ → 409', async () => {
    prisma.phan_cong_giang_day.findMany.mockResolvedValueOnce([
      {
        id: 'pc-1',
        giang_vien_id: 'gv-1',
        da_xac_nhan_gio: true,
        so_gio: 4,
        giang_vien: { ho_ten: 'GV Một' },
      },
    ]);
    await expect(service.thayPhanCongBuoi('lich-1', [])).rejects.toBeInstanceOf(
      ConflictAppException,
    );
  });

  it('đổi số giờ của phân công đã xác nhận → 409; giữ nguyên số giờ → được', async () => {
    const daXacNhan = [
      {
        id: 'pc-1',
        giang_vien_id: 'gv-1',
        da_xac_nhan_gio: true,
        so_gio: 4,
        giang_vien: { ho_ten: 'GV Một' },
      },
    ];
    prisma.phan_cong_giang_day.findMany.mockResolvedValueOnce(daXacNhan);
    await expect(
      service.thayPhanCongBuoi('lich-1', [
        { giang_vien_id: 'gv-1', vai_tro: 'giang_vien', so_gio: 3 },
      ]),
    ).rejects.toBeInstanceOf(ConflictAppException);

    prisma.phan_cong_giang_day.findMany
      .mockResolvedValueOnce(daXacNhan)
      .mockResolvedValueOnce([]);
    await service.thayPhanCongBuoi('lich-1', [
      { giang_vien_id: 'gv-1', vai_tro: 'giang_vien', so_gio: 4 },
    ]);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('hợp lệ: gỡ phân công chưa xác nhận không còn trong danh sách + upsert phần còn lại', async () => {
    prisma.phan_cong_giang_day.findMany
      .mockResolvedValueOnce([
        {
          id: 'pc-cu',
          giang_vien_id: 'gv-cu',
          da_xac_nhan_gio: false,
          so_gio: null,
          giang_vien: { ho_ten: 'GV Cũ' },
        },
      ])
      .mockResolvedValueOnce([]);
    await service.thayPhanCongBuoi('lich-1', [
      { giang_vien_id: 'gv-1', vai_tro: 'giang_vien', so_gio: 4 },
    ]);
    expect(prisma.phan_cong_giang_day.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['pc-cu'] } },
    });
    expect(prisma.phan_cong_giang_day.upsert).toHaveBeenCalledTimes(1);
  });
});
