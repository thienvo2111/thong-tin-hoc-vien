import { DotXacNhanService } from './dot-xac-nhan.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConflictAppException,
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';

describe('DotXacNhanService', () => {
  let service: DotXacNhanService;
  let prisma: {
    dot_xac_nhan: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    dang_ky_hoc: { findMany: jest.Mock };
    xac_nhan_ho_so: { findFirst: jest.Mock };
    khoa_boi_duong: { findUnique: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      dot_xac_nhan: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      dang_ky_hoc: { findMany: jest.fn() },
      xac_nhan_ho_so: { findFirst: jest.fn() },
      khoa_boi_duong: { findUnique: jest.fn() },
    };
    service = new DotXacNhanService(prisma as unknown as PrismaService);
  });

  describe('taoDot', () => {
    const dto = {
      ten: 'Đợt test',
      loai: 'kiem_tra_bo_sung' as const,
      mo_luc: '2026-10-01T00:00:00.000Z',
      dong_luc: '2026-10-05T00:00:00.000Z',
    };

    it('dong_luc <= mo_luc -> ValidationException', async () => {
      await expect(
        service.taoDot(
          { ...dto, dong_luc: '2026-09-01T00:00:00.000Z' },
          'caller-1',
        ),
      ).rejects.toBeInstanceOf(ValidationException);
      expect(prisma.dot_xac_nhan.create).not.toHaveBeenCalled();
    });

    it('khoa_id không tồn tại -> NotFoundAppException', async () => {
      prisma.khoa_boi_duong.findUnique.mockResolvedValue(null);
      await expect(
        service.taoDot({ ...dto, khoa_id: 'khoa-x' }, 'caller-1'),
      ).rejects.toBeInstanceOf(NotFoundAppException);
    });

    it('chồng thời gian với đợt khác cùng khoa_id (NULL) -> ConflictAppException', async () => {
      prisma.dot_xac_nhan.findMany.mockResolvedValue([
        {
          id: 'existing',
          khoa_id: null,
          mo_luc: new Date('2026-10-03T00:00:00.000Z'),
          dong_luc: new Date('2026-10-10T00:00:00.000Z'),
        },
      ]);
      await expect(service.taoDot(dto, 'caller-1')).rejects.toBeInstanceOf(
        ConflictAppException,
      );
      expect(prisma.dot_xac_nhan.create).not.toHaveBeenCalled();
    });

    it('không chồng thời gian -> tạo thành công, created_by=callerId', async () => {
      prisma.dot_xac_nhan.findMany.mockResolvedValue([
        {
          id: 'existing',
          khoa_id: null,
          mo_luc: new Date('2026-11-01T00:00:00.000Z'),
          dong_luc: new Date('2026-11-05T00:00:00.000Z'),
        },
      ]);
      prisma.dot_xac_nhan.create.mockResolvedValue({ id: 'new-dot' });
      await service.taoDot(dto, 'caller-1');
      expect(prisma.dot_xac_nhan.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          khoa_id: null,
          created_by: 'caller-1',
        }),
      });
    });
  });

  describe('suaDot', () => {
    it('không tồn tại -> NotFoundAppException', async () => {
      prisma.dot_xac_nhan.findUnique.mockResolvedValue(null);
      await expect(
        service.suaDot('id-x', { dong_luc: '2026-10-05T00:00:00.000Z' }),
      ).rejects.toBeInstanceOf(NotFoundAppException);
    });

    it('dong_luc mới <= mo_luc -> ValidationException', async () => {
      prisma.dot_xac_nhan.findUnique.mockResolvedValue({
        id: 'id-1',
        khoa_id: null,
        mo_luc: new Date('2026-10-01T00:00:00.000Z'),
      });
      await expect(
        service.suaDot('id-1', { dong_luc: '2026-09-30T00:00:00.000Z' }),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('gia hạn hợp lệ -> update dong_luc', async () => {
      prisma.dot_xac_nhan.findUnique.mockResolvedValue({
        id: 'id-1',
        khoa_id: null,
        mo_luc: new Date('2026-10-01T00:00:00.000Z'),
      });
      prisma.dot_xac_nhan.findMany.mockResolvedValue([]);
      prisma.dot_xac_nhan.update.mockResolvedValue({ id: 'id-1' });
      await service.suaDot('id-1', { dong_luc: '2026-12-01T00:00:00.000Z' });
      expect(prisma.dot_xac_nhan.update).toHaveBeenCalledWith({
        where: { id: 'id-1' },
        data: { dong_luc: new Date('2026-12-01T00:00:00.000Z') },
      });
    });
  });

  describe('dotDangMoCuaHocVien', () => {
    it('không có đợt nào khớp thời gian -> null', async () => {
      prisma.dot_xac_nhan.findMany.mockResolvedValue([]);
      const result = await service.dotDangMoCuaHocVien('hv-1');
      expect(result).toBeNull();
    });

    it('có đợt khoa_id=NULL đang mở -> trả về đợt đó, ưu tiên hơn đợt theo khóa', async () => {
      prisma.dot_xac_nhan.findMany.mockResolvedValue([
        { id: 'dot-khoa', khoa_id: 'khoa-1' },
        { id: 'dot-toan-cuc', khoa_id: null },
      ]);
      const result = await service.dotDangMoCuaHocVien('hv-1');
      expect(result?.id).toBe('dot-toan-cuc');
      expect(prisma.dang_ky_hoc.findMany).not.toHaveBeenCalled();
    });

    it('chỉ có đợt theo khóa, học viên CHƯA ghi danh khóa đó -> null', async () => {
      prisma.dot_xac_nhan.findMany.mockResolvedValue([
        { id: 'dot-khoa', khoa_id: 'khoa-1' },
      ]);
      prisma.dang_ky_hoc.findMany.mockResolvedValue([]);
      const result = await service.dotDangMoCuaHocVien('hv-1');
      expect(result).toBeNull();
    });

    it('chỉ có đợt theo khóa, học viên ĐÃ ghi danh khóa đó -> trả về đợt', async () => {
      prisma.dot_xac_nhan.findMany.mockResolvedValue([
        { id: 'dot-khoa', khoa_id: 'khoa-1' },
      ]);
      prisma.dang_ky_hoc.findMany.mockResolvedValue([{ khoa_id: 'khoa-1' }]);
      const result = await service.dotDangMoCuaHocVien('hv-1');
      expect(result?.id).toBe('dot-khoa');
    });
  });

  describe('huyXacNhanNeuCo / taoXacNhan', () => {
    it('huyXacNhanNeuCo: có xác nhận hiệu lực -> updateMany count>0 -> true', async () => {
      const tx = {
        xac_nhan_ho_so: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };
      const result = await service.huyXacNhanNeuCo(
        tx as never,
        'dot-1',
        'hv-1',
      );
      expect(result).toBe(true);
      expect(tx.xac_nhan_ho_so.updateMany).toHaveBeenCalledWith({
        where: { dot_id: 'dot-1', hoc_vien_id: 'hv-1', con_hieu_luc: true },
        data: expect.objectContaining({ con_hieu_luc: false }),
      });
    });

    it('huyXacNhanNeuCo: không có xác nhận nào -> false', async () => {
      const tx = {
        xac_nhan_ho_so: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      };
      const result = await service.huyXacNhanNeuCo(
        tx as never,
        'dot-1',
        'hv-1',
      );
      expect(result).toBe(false);
    });

    it('taoXacNhan: tự hủy xác nhận cũ trước khi tạo mới (idempotent)', async () => {
      const tx = {
        xac_nhan_ho_so: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          create: jest.fn().mockResolvedValue({ id: 'xn-moi' }),
        },
      };
      await service.taoXacNhan(tx as never, 'dot-1', 'hv-1', { a: 1 });
      expect(tx.xac_nhan_ho_so.updateMany).toHaveBeenCalled();
      expect(tx.xac_nhan_ho_so.create).toHaveBeenCalledWith({
        data: { dot_id: 'dot-1', hoc_vien_id: 'hv-1', du_lieu: { a: 1 } },
      });
    });
  });

  describe('coXacNhanConHieuLuc', () => {
    it('có -> true', async () => {
      prisma.xac_nhan_ho_so.findFirst.mockResolvedValue({ id: 'xn-1' });
      expect(await service.coXacNhanConHieuLuc('dot-1', 'hv-1')).toBe(true);
    });

    it('không có -> false', async () => {
      prisma.xac_nhan_ho_so.findFirst.mockResolvedValue(null);
      expect(await service.coXacNhanConHieuLuc('dot-1', 'hv-1')).toBe(false);
    });
  });
});
