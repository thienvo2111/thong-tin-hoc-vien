import { DonViCongTacService } from './don-vi-cong-tac.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ConflictAppException,
  ValidationException,
} from '../../common/exceptions/app.exceptions';

describe('DonViCongTacService', () => {
  let service: DonViCongTacService;
  let prisma: {
    dia_danh: { findUnique: jest.Mock };
    don_vi_cong_tac: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      dia_danh: { findUnique: jest.fn() },
      don_vi_cong_tac: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new DonViCongTacService(prisma as unknown as PrismaService);
  });

  const validInput = {
    ma_don_vi: 'DV1',
    ten_don_vi: 'Trường Test',
    loai_don_vi: 'truong' as const,
    dia_ban_id: 'xa-1',
  };

  it('dia_ban_id không tồn tại -> ValidationException', async () => {
    prisma.dia_danh.findUnique.mockResolvedValueOnce(null);
    await expect(service.create(validInput)).rejects.toBeInstanceOf(
      ValidationException,
    );
    expect(prisma.don_vi_cong_tac.create).not.toHaveBeenCalled();
  });

  it('dia_ban_id trỏ tới địa danh cấp tinh_thanh (phải là phuong_xa_dac_khu) -> ValidationException', async () => {
    prisma.dia_danh.findUnique.mockResolvedValueOnce({
      id: 'xa-1',
      cap: 'tinh_thanh',
    });
    await expect(service.create(validInput)).rejects.toBeInstanceOf(
      ValidationException,
    );
  });

  it('don_vi_cha_id không tồn tại -> ValidationException', async () => {
    prisma.dia_danh.findUnique.mockResolvedValueOnce({
      id: 'xa-1',
      cap: 'phuong_xa_dac_khu',
    });
    prisma.don_vi_cong_tac.findUnique.mockResolvedValueOnce(null); // cha lookup
    await expect(
      service.create({ ...validInput, don_vi_cha_id: 'cha-khong-ton-tai' }),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('ma_don_vi trùng -> ConflictAppException', async () => {
    prisma.dia_danh.findUnique.mockResolvedValueOnce({
      id: 'xa-1',
      cap: 'phuong_xa_dac_khu',
    });
    prisma.don_vi_cong_tac.findUnique.mockResolvedValueOnce({
      id: 'existing',
      ma_don_vi: 'DV1',
    });
    await expect(service.create(validInput)).rejects.toBeInstanceOf(
      ConflictAppException,
    );
    expect(prisma.don_vi_cong_tac.create).not.toHaveBeenCalled();
  });

  it('validation-checklist #39: PATCH tự làm cha của chính nó -> ValidationException', async () => {
    prisma.don_vi_cong_tac.findUnique.mockResolvedValueOnce({
      id: 'dv-1',
      ma_don_vi: 'DV1',
      dia_ban_id: 'xa-1',
      don_vi_cha_id: null,
    });
    await expect(
      service.update('dv-1', { don_vi_cha_id: 'dv-1' }),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('tạo thành công -> chuẩn hóa NFC tên đơn vị', async () => {
    prisma.dia_danh.findUnique.mockResolvedValueOnce({
      id: 'xa-1',
      cap: 'phuong_xa_dac_khu',
    });
    prisma.don_vi_cong_tac.findUnique.mockResolvedValueOnce(null); // check trùng ma
    prisma.don_vi_cong_tac.create.mockResolvedValueOnce({ id: 'new-id' });

    await service.create({ ...validInput, ten_don_vi: '  Trường   Test  ' });

    expect(prisma.don_vi_cong_tac.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ten_don_vi: 'Trường Test' }),
      }),
    );
  });
});
