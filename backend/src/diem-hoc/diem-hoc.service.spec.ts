import { DiemHocService } from './diem-hoc.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeService } from '../auth/scope/scope.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  ConflictAppException,
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';

const quanTri = {
  id: 'nd-qt',
  vai_tro: 'quan_tri',
  don_vi_id: null,
} as AuthenticatedUser;
const truong = {
  id: 'nd-tr',
  vai_tro: 'truong',
  don_vi_id: 'dv-1',
} as AuthenticatedUser;

describe('DiemHocService', () => {
  let prisma: {
    diem_hoc: Record<string, jest.Mock>;
    dia_danh: { findUnique: jest.Mock };
    don_vi_cong_tac: { findUnique: jest.Mock };
    lich_hoc_lop: { findMany: jest.Mock };
  };
  let scope: {
    getAccessibleDonViIds: jest.Mock;
    getKhoaIdsXemDuoc: jest.Mock;
  };
  let service: DiemHocService;

  beforeEach(() => {
    prisma = {
      diem_hoc: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(({ data }) => data),
        update: jest.fn().mockImplementation(({ data }) => data),
      },
      dia_danh: { findUnique: jest.fn().mockResolvedValue({ id: 'xa-1' }) },
      don_vi_cong_tac: {
        findUnique: jest.fn().mockResolvedValue({ id: 'dv-1' }),
      },
      lich_hoc_lop: { findMany: jest.fn().mockResolvedValue([]) },
    };
    scope = {
      getAccessibleDonViIds: jest.fn().mockResolvedValue('ALL'),
      getKhoaIdsXemDuoc: jest.fn().mockResolvedValue('ALL'),
    };
    service = new DiemHocService(
      prisma as unknown as PrismaService,
      scope as unknown as ScopeService,
    );
  });

  describe('create', () => {
    const dto = {
      ma_diem_hoc: ' AG-01 ',
      ten: '  THPT   Long Xuyên ',
      dia_chi: ' 1 Trần Hưng Đạo ',
      dia_ban_id: 'xa-1',
    };

    it('tạo thành công: chuẩn hóa tên, trim mã, ghi tao_boi', async () => {
      await service.create(dto, quanTri);
      expect(prisma.diem_hoc.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ma_diem_hoc: 'AG-01',
          ten: 'THPT Long Xuyên',
          dia_chi: '1 Trần Hưng Đạo',
          tao_boi: 'nd-qt',
        }),
      });
    });

    it('trùng mã → 409, không insert', async () => {
      prisma.diem_hoc.findUnique.mockResolvedValueOnce({ id: 'khac' });
      await expect(service.create(dto, quanTri)).rejects.toBeInstanceOf(
        ConflictAppException,
      );
      expect(prisma.diem_hoc.create).not.toHaveBeenCalled();
    });

    it('địa bàn không tồn tại → 400', async () => {
      prisma.dia_danh.findUnique.mockResolvedValueOnce(null);
      await expect(service.create(dto, quanTri)).rejects.toBeInstanceOf(
        ValidationException,
      );
    });
  });

  describe('update', () => {
    it('không tồn tại → 404', async () => {
      await expect(
        service.update('x', { trang_thai: 'ngung' }),
      ).rejects.toBeInstanceOf(NotFoundAppException);
    });

    it('body rỗng → 400', async () => {
      prisma.diem_hoc.findUnique.mockResolvedValueOnce({ id: 'dh-1' });
      await expect(service.update('dh-1', {})).rejects.toBeInstanceOf(
        ValidationException,
      );
    });

    it('ngưng hoạt động = PATCH trang_thai (không xóa cứng)', async () => {
      prisma.diem_hoc.findUnique.mockResolvedValueOnce({
        id: 'dh-1',
        ma_diem_hoc: 'AG-01',
      });
      await service.update('dh-1', { trang_thai: 'ngung' });
      expect(prisma.diem_hoc.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ trang_thai: 'ngung' }),
        }),
      );
    });
  });

  describe('phạm vi đọc', () => {
    it('quan_tri: không lọc phạm vi', async () => {
      await service.findAll({}, quanTri);
      expect(prisma.diem_hoc.findMany.mock.calls[0][0].where).toEqual({
        AND: [],
      });
    });

    it('truong: chỉ điểm học thuộc đơn vị trong phạm vi hoặc dùng cho khóa xem được', async () => {
      scope.getAccessibleDonViIds.mockResolvedValueOnce(['dv-1']);
      scope.getKhoaIdsXemDuoc.mockResolvedValueOnce(['khoa-1']);
      await service.findAll({}, truong);
      expect(prisma.diem_hoc.findMany.mock.calls[0][0].where).toEqual({
        AND: [
          {
            OR: [
              { don_vi_id: { in: ['dv-1'] } },
              { lich_hoc: { some: { lop: { khoa_id: { in: ['khoa-1'] } } } } },
            ],
          },
        ],
      });
    });

    it('findOne ngoài phạm vi → 404', async () => {
      scope.getAccessibleDonViIds.mockResolvedValueOnce(['dv-1']);
      scope.getKhoaIdsXemDuoc.mockResolvedValueOnce([]);
      prisma.diem_hoc.findFirst.mockResolvedValueOnce(null);
      await expect(service.findOne('dh-x', truong)).rejects.toBeInstanceOf(
        NotFoundAppException,
      );
    });
  });

  describe('layDiemHocDangHoatDong', () => {
    it('đã ngưng → 400', async () => {
      prisma.diem_hoc.findUnique.mockResolvedValueOnce({
        id: 'dh-1',
        trang_thai: 'ngung',
      });
      await expect(
        service.layDiemHocDangHoatDong('dh-1'),
      ).rejects.toBeInstanceOf(ValidationException);
    });
  });

  describe('canhBaoVuotSoPhong (rule 🟡, không chặn)', () => {
    const input = {
      diem_hoc_id: 'dh-1',
      lop_id: 'lop-1',
      bat_dau: new Date('2026-11-06T01:00:00Z'),
      ket_thuc: new Date('2026-11-06T04:00:00Z'),
    };

    it('không khai báo so_phong → không cảnh báo', async () => {
      prisma.diem_hoc.findUnique.mockResolvedValueOnce({
        ten: 'A',
        so_phong: null,
      });
      expect(await service.canhBaoVuotSoPhong(input)).toEqual([]);
    });

    it('2 lớp khác trùng giờ + lớp này = 3 > 2 phòng → cảnh báo', async () => {
      prisma.diem_hoc.findUnique.mockResolvedValueOnce({
        ten: 'THPT A',
        so_phong: 2,
      });
      prisma.lich_hoc_lop.findMany.mockResolvedValueOnce([
        { lop_id: 'lop-2' },
        { lop_id: 'lop-3' },
      ]);
      const kq = await service.canhBaoVuotSoPhong(input);
      expect(kq).toHaveLength(1);
      expect(kq[0]).toContain('3 lớp');
      expect(prisma.lich_hoc_lop.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            diem_hoc_id: 'dh-1',
            lop_id: { not: 'lop-1' },
            thoi_gian_bat_dau: { lt: input.ket_thuc },
            thoi_gian_ket_thuc: { gt: input.bat_dau },
          },
        }),
      );
    });

    it('vừa đủ số phòng → không cảnh báo', async () => {
      prisma.diem_hoc.findUnique.mockResolvedValueOnce({
        ten: 'THPT A',
        so_phong: 2,
      });
      prisma.lich_hoc_lop.findMany.mockResolvedValueOnce([{ lop_id: 'lop-2' }]);
      expect(await service.canhBaoVuotSoPhong(input)).toEqual([]);
    });
  });
});
