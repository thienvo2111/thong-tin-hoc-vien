import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeService } from './scope/scope.service';
import {
  UnauthorizedAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    nguoi_dung: {
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock;
    };
  };
  let jwtService: { signAsync: jest.Mock };
  let scopeService: { getAccessibleDonViIds: jest.Mock };

  const baseUser = {
    id: 'user-1',
    ho_ten: 'Test User',
    email: 'test@x.com',
    ten_dang_nhap: 'test@x.com',
    vai_tro: 'truong' as const,
    don_vi_id: 'don-vi-1',
    hoc_vien_id: null,
    mat_khau_hash: '',
    phai_doi_mat_khau: false,
    trang_thai: 'active' as const,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    baseUser.mat_khau_hash = await bcrypt.hash('MatKhauGoc', 4);
    prisma = {
      nguoi_dung: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
    };
    jwtService = { signAsync: jest.fn().mockResolvedValue('fake.jwt.token') };
    scopeService = {
      getAccessibleDonViIds: jest.fn().mockResolvedValue(['don-vi-1']),
    };
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as never,
      scopeService as unknown as ScopeService,
    );
  });

  describe('dangNhap', () => {
    it('sai tên đăng nhập (không tồn tại) -> UnauthorizedAppException', async () => {
      prisma.nguoi_dung.findUnique.mockResolvedValue(null);
      await expect(
        service.dangNhap({ ten_dang_nhap: 'khong-co', mat_khau: 'x' }),
      ).rejects.toBeInstanceOf(UnauthorizedAppException);
    });

    it('tài khoản bị vô hiệu hóa (trang_thai=ngung) -> Unauthorized', async () => {
      prisma.nguoi_dung.findUnique.mockResolvedValue({
        ...baseUser,
        trang_thai: 'ngung',
      });
      await expect(
        service.dangNhap({
          ten_dang_nhap: baseUser.ten_dang_nhap,
          mat_khau: 'MatKhauGoc',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedAppException);
    });

    it('sai mật khẩu -> Unauthorized', async () => {
      prisma.nguoi_dung.findUnique.mockResolvedValue(baseUser);
      await expect(
        service.dangNhap({
          ten_dang_nhap: baseUser.ten_dang_nhap,
          mat_khau: 'sai',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedAppException);
    });

    it('đăng nhập đúng -> trả token + nguoi_dung không có mat_khau_hash', async () => {
      prisma.nguoi_dung.findUnique.mockResolvedValue(baseUser);
      const res = await service.dangNhap({
        ten_dang_nhap: baseUser.ten_dang_nhap,
        mat_khau: 'MatKhauGoc',
      });
      expect(res.token).toBe('fake.jwt.token');
      expect(res.nguoi_dung).not.toHaveProperty('mat_khau_hash');
      expect(res.phai_doi_mat_khau).toBe(false);
    });
  });

  describe('doiMatKhau', () => {
    it('sai mật khẩu cũ -> ValidationException với field mat_khau_cu', async () => {
      prisma.nguoi_dung.findUniqueOrThrow.mockResolvedValue(baseUser);
      await expect(
        service.doiMatKhau({ id: baseUser.id } as never, {
          mat_khau_cu: 'sai',
          mat_khau_moi: 'MoiMoi123',
        }),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('đúng mật khẩu cũ -> cập nhật hash mới + phai_doi_mat_khau=false', async () => {
      prisma.nguoi_dung.findUniqueOrThrow.mockResolvedValue(baseUser);
      prisma.nguoi_dung.update.mockResolvedValue({
        ...baseUser,
        phai_doi_mat_khau: false,
      });

      await service.doiMatKhau({ id: baseUser.id } as never, {
        mat_khau_cu: 'MatKhauGoc',
        mat_khau_moi: 'MoiMoi123',
      });

      expect(prisma.nguoi_dung.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: baseUser.id },
          data: expect.objectContaining({ phai_doi_mat_khau: false }),
        }),
      );
    });
  });

  describe('layThongTinHienTai', () => {
    it('quan_tri -> pham_vi.loai = toan_he_thong', async () => {
      prisma.nguoi_dung.findUniqueOrThrow.mockResolvedValue({
        ...baseUser,
        vai_tro: 'quan_tri',
      });
      scopeService.getAccessibleDonViIds.mockResolvedValue('ALL');
      const res = await service.layThongTinHienTai({
        id: baseUser.id,
        vai_tro: 'quan_tri',
        don_vi_id: null,
        hoc_vien_id: null,
      } as never);
      expect(res.pham_vi.loai).toBe('toan_he_thong');
    });

    it('hoc_vien -> pham_vi.loai = chi_ho_so_ca_nhan, không gọi ScopeService', async () => {
      prisma.nguoi_dung.findUniqueOrThrow.mockResolvedValue({
        ...baseUser,
        vai_tro: 'hoc_vien',
      });
      const res = await service.layThongTinHienTai({
        id: baseUser.id,
        vai_tro: 'hoc_vien',
        don_vi_id: null,
        hoc_vien_id: 'hv-1',
      } as never);
      expect(res.pham_vi).toEqual({
        loai: 'chi_ho_so_ca_nhan',
        hoc_vien_id: 'hv-1',
      });
      expect(scopeService.getAccessibleDonViIds).not.toHaveBeenCalled();
    });
  });
});
