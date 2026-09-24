import { MonHocService } from './mon-hoc.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConflictAppException } from '../../common/exceptions/app.exceptions';

describe('MonHocService', () => {
  let service: MonHocService;
  let prisma: { mon_hoc: { findUnique: jest.Mock; create: jest.Mock } };

  beforeEach(() => {
    prisma = { mon_hoc: { findUnique: jest.fn(), create: jest.fn() } };
    service = new MonHocService(prisma as unknown as PrismaService);
  });

  it('trùng (ten_mon, cap_hoc) -> ConflictAppException, không insert', async () => {
    prisma.mon_hoc.findUnique.mockResolvedValueOnce({ id: 'existing' });
    await expect(
      service.create({ ten_mon: 'Toán', cap_hoc: 'thpt' }),
    ).rejects.toBeInstanceOf(ConflictAppException);
    expect(prisma.mon_hoc.create).not.toHaveBeenCalled();
  });

  it('cùng tên nhưng khác cap_hoc thì không xung đột (composite unique)', async () => {
    prisma.mon_hoc.findUnique.mockResolvedValueOnce(null);
    prisma.mon_hoc.create.mockResolvedValueOnce({ id: 'new-id' });
    await service.create({ ten_mon: 'Toán', cap_hoc: 'thcs' });
    expect(prisma.mon_hoc.findUnique).toHaveBeenCalledWith({
      where: { ten_mon_cap_hoc: { ten_mon: 'Toán', cap_hoc: 'thcs' } },
    });
    expect(prisma.mon_hoc.create).toHaveBeenCalled();
  });

  it('tạo thành công -> chuẩn hóa NFC tên môn', async () => {
    prisma.mon_hoc.findUnique.mockResolvedValueOnce(null);
    prisma.mon_hoc.create.mockResolvedValueOnce({ id: 'new-id' });
    await service.create({ ten_mon: '  Vật   lý  ', cap_hoc: 'thpt' });
    expect(prisma.mon_hoc.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ten_mon: 'Vật lý' }),
      }),
    );
  });
});
