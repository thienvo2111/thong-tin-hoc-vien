import { DiaDanhService } from './dia-danh.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ConflictAppException,
  ValidationException,
} from '../../common/exceptions/app.exceptions';

describe('DiaDanhService', () => {
  let service: DiaDanhService;
  let prisma: {
    dia_danh: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      dia_danh: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };
    service = new DiaDanhService(prisma as unknown as PrismaService);
  });

  describe('create — validation-checklist #38 (parent_id theo cap)', () => {
    it('cap=tinh_thanh kèm parent_id -> ValidationException', async () => {
      await expect(
        service.create({
          ma: 'X',
          ten: 'Test',
          cap: 'tinh_thanh',
          parent_id: 'p1',
        }),
      ).rejects.toBeInstanceOf(ValidationException);
      expect(prisma.dia_danh.create).not.toHaveBeenCalled();
    });

    it('cap=phuong_xa_dac_khu thiếu parent_id -> ValidationException', async () => {
      await expect(
        service.create({ ma: 'X', ten: 'Test', cap: 'phuong_xa_dac_khu' }),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('parent_id không tồn tại -> ValidationException', async () => {
      prisma.dia_danh.findUnique.mockResolvedValueOnce(null); // parent lookup
      await expect(
        service.create({
          ma: 'X',
          ten: 'Test',
          cap: 'phuong_xa_dac_khu',
          parent_id: 'khong-ton-tai',
        }),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('parent_id trỏ tới 1 địa danh cấp phuong_xa (không phải tinh_thanh) -> ValidationException', async () => {
      prisma.dia_danh.findUnique.mockResolvedValueOnce({
        id: 'p1',
        cap: 'phuong_xa_dac_khu',
      });
      await expect(
        service.create({
          ma: 'X',
          ten: 'Test',
          cap: 'phuong_xa_dac_khu',
          parent_id: 'p1',
        }),
      ).rejects.toBeInstanceOf(ValidationException);
    });
  });

  describe('create — validation-checklist #37 (unique ma) + #41 (NFC)', () => {
    it('ma đã tồn tại -> ConflictAppException, không insert', async () => {
      prisma.dia_danh.findUnique.mockResolvedValueOnce({
        id: 'existing',
        ma: 'X',
      });
      await expect(
        service.create({ ma: 'X', ten: 'Test', cap: 'tinh_thanh' }),
      ).rejects.toBeInstanceOf(ConflictAppException);
      expect(prisma.dia_danh.create).not.toHaveBeenCalled();
    });

    it('tạo thành công -> chuẩn hóa khoảng trắng thừa trong tên trước khi lưu', async () => {
      prisma.dia_danh.findUnique.mockResolvedValueOnce(null); // check trùng ma
      prisma.dia_danh.create.mockResolvedValueOnce({ id: 'new-id' });

      await service.create({
        ma: ' X ',
        ten: '  Tỉnh   Test  ',
        cap: 'tinh_thanh',
      });

      expect(prisma.dia_danh.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ ma: 'X', ten: 'Tỉnh Test' }),
        }),
      );
    });
  });

  describe('update', () => {
    it('id không tồn tại -> ValidationException', async () => {
      prisma.dia_danh.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.update('khong-ton-tai', { ten: 'X' }),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('đổi cap sang tinh_thanh nhưng vẫn giữ parent_id cũ -> ValidationException', async () => {
      prisma.dia_danh.findUnique.mockResolvedValueOnce({
        id: 'id1',
        ma: 'X',
        cap: 'phuong_xa_dac_khu',
        parent_id: 'p1',
      });
      await expect(
        service.update('id1', { cap: 'tinh_thanh' }),
      ).rejects.toBeInstanceOf(ValidationException);
    });
  });
});
