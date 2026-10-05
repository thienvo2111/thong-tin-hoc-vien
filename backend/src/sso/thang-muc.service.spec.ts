import {
  THANG_MUC_MAC_DINH,
  ThangMucService,
  nhanMucGoc,
} from './thang-muc.service';
import { PrismaService } from '../prisma/prisma.service';
import { ValidationException } from '../common/exceptions/app.exceptions';

describe('ThangMucService', () => {
  let prisma: {
    cau_hinh_he_thong: { findUnique: jest.Mock; upsert: jest.Mock };
  };
  let service: ThangMucService;

  beforeEach(() => {
    prisma = {
      cau_hinh_he_thong: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    service = new ThangMucService(prisma as unknown as PrismaService);
  });

  it('chưa cấu hình -> thang mặc định M1–M4', async () => {
    const kq = await service.lay();
    expect(kq.thang).toEqual(THANG_MUC_MAC_DINH);
    expect(kq.cap_nhat_luc).toBeNull();
  });

  it('đã cấu hình -> dùng thang trong DB', async () => {
    prisma.cau_hinh_he_thong.findUnique.mockResolvedValue({
      gia_tri: [{ ma: 'A', nhan: 'Tốt' }],
      cap_nhat_luc: new Date(),
    });
    expect(await service.thang()).toEqual([{ ma: 'A', nhan: 'Tốt' }]);
  });

  it('lưu: chuẩn hóa mã (hoa, bỏ khoảng trắng) + nhãn, ghi người cập nhật', async () => {
    const kq = await service.luu(
      [
        { ma: ' m1 ', nhan: ' Chưa đạt ' },
        { ma: 'M2', nhan: 'Cơ bản' },
      ],
      'nd-1',
    );
    expect(kq.thang).toEqual([
      { ma: 'M1', nhan: 'Chưa đạt' },
      { ma: 'M2', nhan: 'Cơ bản' },
    ]);
    const { create } = prisma.cau_hinh_he_thong.upsert.mock.calls[0][0];
    expect(create).toMatchObject({
      khoa: 'thang_muc_khao_sat',
      cap_nhat_boi: 'nd-1',
    });
  });

  it('lưu: mã trùng (kể cả khác hoa/thường) -> 400, không ghi', async () => {
    await expect(
      service.luu(
        [
          { ma: 'M1', nhan: 'A' },
          { ma: 'm1', nhan: 'B' },
        ],
        'nd-1',
      ),
    ).rejects.toBeInstanceOf(ValidationException);
    expect(prisma.cau_hinh_he_thong.upsert).not.toHaveBeenCalled();
  });

  it('kiemTraMa: mã ngoài thang -> 400 kèm danh sách mã hợp lệ', async () => {
    await expect(service.kiemTraMa('M5')).rejects.toBeInstanceOf(
      ValidationException,
    );
    await expect(service.kiemTraMa('M4')).resolves.toBeUndefined();
  });

  it('nhanMucGoc: ghép "mã – nhãn"; mã đã bị xóa khỏi thang -> giữ nguyên mã; null -> null', () => {
    expect(nhanMucGoc('M1', THANG_MUC_MAC_DINH)).toBe('M1 – Chưa đạt');
    expect(nhanMucGoc('X9', THANG_MUC_MAC_DINH)).toBe('X9');
    expect(nhanMucGoc(null, THANG_MUC_MAC_DINH)).toBeNull();
  });
});
