import { NguoiDungService } from './nguoi-dung.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

describe('NguoiDungService', () => {
  let service: NguoiDungService;
  let prisma: {
    nguoi_dung: {
      findUnique: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
    };
    hoc_vien: { findUniqueOrThrow: jest.Mock };
    nhat_ky_dat_lai_mat_khau: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  const caller = { id: 'admin-1' } as AuthenticatedUser;

  beforeEach(() => {
    prisma = {
      nguoi_dung: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      hoc_vien: { findUniqueOrThrow: jest.fn() },
      nhat_ky_dat_lai_mat_khau: { create: jest.fn() },
      // Prisma $transaction([p1, p2]): các promise đã được TẠO (side effect
      // đã chạy) trước khi truyền vào — mock chỉ cần Promise.all lại chúng.
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    service = new NguoiDungService(prisma as unknown as PrismaService);
  });

  describe('datLaiMatKhau', () => {
    it('không tìm thấy tài khoản -> NotFoundAppException', async () => {
      prisma.nguoi_dung.findUnique.mockResolvedValue(null);
      await expect(
        service.datLaiMatKhau('khong-co', caller),
      ).rejects.toBeInstanceOf(NotFoundAppException);
    });

    it('tài khoản không phải hoc_vien -> ValidationException', async () => {
      prisma.nguoi_dung.findUnique.mockResolvedValue({
        id: 'nd-1',
        vai_tro: 'truong',
        hoc_vien_id: null,
      });
      await expect(
        service.datLaiMatKhau('nd-1', caller),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('tài khoản hoc_vien -> đặt lại mật khẩu theo ngày sinh, mở khóa, ghi nhật ký', async () => {
      prisma.nguoi_dung.findUnique.mockResolvedValue({
        id: 'nd-1',
        vai_tro: 'hoc_vien',
        hoc_vien_id: 'hv-1',
        ho_ten: 'A',
        ten_dang_nhap: 'x',
        mat_khau_hash: 'old-hash',
      });
      prisma.hoc_vien.findUniqueOrThrow.mockResolvedValue({
        ngay_sinh: 5,
        thang_sinh: 9,
        nam_sinh: 2000,
      });
      prisma.nguoi_dung.update.mockResolvedValue({
        id: 'nd-1',
        mat_khau_hash: 'new-hash',
        phai_doi_mat_khau: true,
      });
      prisma.nhat_ky_dat_lai_mat_khau.create.mockResolvedValue({});

      const res = await service.datLaiMatKhau('nd-1', caller);

      expect(res.nguoi_dung).not.toHaveProperty('mat_khau_hash');
      expect(prisma.nguoi_dung.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'nd-1' },
          data: expect.objectContaining({
            phai_doi_mat_khau: true,
            khoa_den: null,
            so_lan_dang_nhap_sai: 0,
          }),
        }),
      );
      expect(prisma.nhat_ky_dat_lai_mat_khau.create).toHaveBeenCalledWith({
        data: { nguoi_dung_id: 'nd-1', thuc_hien_boi: 'admin-1' },
      });
    });
  });

  describe('timKiem', () => {
    it('tìm theo q -> OR ten_dang_nhap/ho_ten/hoc_vien.so_dien_thoai_lien_he, ẩn mat_khau_hash', async () => {
      prisma.nguoi_dung.findMany.mockResolvedValue([
        { id: 'nd-1', mat_khau_hash: 'x', ho_ten: 'A' },
      ]);
      const res = await service.timKiem('0912345678');
      expect(prisma.nguoi_dung.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              {
                ten_dang_nhap: { contains: '0912345678', mode: 'insensitive' },
              },
              { ho_ten: { contains: '0912345678', mode: 'insensitive' } },
              {
                hoc_vien: {
                  so_dien_thoai_lien_he: { contains: '0912345678' },
                },
              },
            ],
          },
          take: 20,
        }),
      );
      expect(res.data).toHaveLength(1);
      expect(res.data[0]).not.toHaveProperty('mat_khau_hash');
    });
  });
});
