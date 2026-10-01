import { LoaiVanDeHoTroService } from './loai-van-de-ho-tro.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConflictAppException } from '../../common/exceptions/app.exceptions';

describe('LoaiVanDeHoTroService', () => {
  let service: LoaiVanDeHoTroService;
  let prisma: { loai_van_de_ho_tro: { findUnique: jest.Mock; create: jest.Mock } };

  beforeEach(() => {
    prisma = {
      loai_van_de_ho_tro: { findUnique: jest.fn(), create: jest.fn() },
    };
    service = new LoaiVanDeHoTroService(prisma as unknown as PrismaService);
  });

  it('trùng ten -> ConflictAppException, không insert', async () => {
    prisma.loai_van_de_ho_tro.findUnique.mockResolvedValueOnce({ id: 'existing' });
    await expect(
      service.create({ ten: 'Quên mật khẩu', noi_dung_goi_y: 'x' }),
    ).rejects.toBeInstanceOf(ConflictAppException);
    expect(prisma.loai_van_de_ho_tro.create).not.toHaveBeenCalled();
  });

  it('tạo thành công -> chuẩn hóa NFC tên', async () => {
    prisma.loai_van_de_ho_tro.findUnique.mockResolvedValueOnce(null);
    prisma.loai_van_de_ho_tro.create.mockResolvedValueOnce({ id: 'new-id' });
    await service.create({ ten: '  Mã  định  danh  ', noi_dung_goi_y: 'x' });
    expect(prisma.loai_van_de_ho_tro.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ten: 'Mã định danh' }),
      }),
    );
  });
});
