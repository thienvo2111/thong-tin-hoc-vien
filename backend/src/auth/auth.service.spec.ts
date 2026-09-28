import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeService } from './scope/scope.service';
import {
  AccountLockedException,
  UnauthorizedAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';

// Lỗi unique violation giả lập P2002 của Prisma — dùng để test nhánh
// idempotent của dangXuat() (gọi 2 lần cùng jti không được throw).
function p2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '6.19.3',
  });
}

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    nguoi_dung: {
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock;
    };
    token_thu_hoi: {
      create: jest.Mock;
    };
    hoc_vien: {
      findUnique: jest.Mock;
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
    hoc_vien_id: null as string | null,
    mat_khau_hash: '',
    phai_doi_mat_khau: false,
    trang_thai: 'active' as const,
    so_lan_dang_nhap_sai: 0,
    khoa_den: null as Date | null,
    dang_nhap_lan_cuoi: null as Date | null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    baseUser.mat_khau_hash = await bcrypt.hash('MatKhauGoc', 4);
    baseUser.hoc_vien_id = null;
    baseUser.so_lan_dang_nhap_sai = 0;
    baseUser.khoa_den = null;
    prisma = {
      nguoi_dung: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn().mockImplementation(({ data }) => ({
          ...baseUser,
          ...data,
        })),
      },
      token_thu_hoi: {
        create: jest.fn(),
      },
      hoc_vien: {
        findUnique: jest.fn(),
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

    // T1 (bảo mật đăng nhập): xem mo-rong-nls-an-giang.md mục T1.
    it('sai mật khẩu lần thứ 5 (liên tiếp) -> ghi khoa_den = now+15p', async () => {
      prisma.nguoi_dung.findUnique.mockResolvedValue({
        ...baseUser,
        so_lan_dang_nhap_sai: 4,
      });
      await expect(
        service.dangNhap({
          ten_dang_nhap: baseUser.ten_dang_nhap,
          mat_khau: 'sai',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedAppException);

      expect(prisma.nguoi_dung.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ so_lan_dang_nhap_sai: 5 }),
        }),
      );
      const call = prisma.nguoi_dung.update.mock.calls[0][0];
      expect(call.data.khoa_den).toBeInstanceOf(Date);
      expect(call.data.khoa_den.getTime()).toBeGreaterThan(Date.now());
    });

    it('sai mật khẩu lần 1-4 -> chỉ tăng bộ đếm, KHÔNG đặt khoa_den', async () => {
      prisma.nguoi_dung.findUnique.mockResolvedValue({
        ...baseUser,
        so_lan_dang_nhap_sai: 2,
      });
      await expect(
        service.dangNhap({
          ten_dang_nhap: baseUser.ten_dang_nhap,
          mat_khau: 'sai',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedAppException);

      expect(prisma.nguoi_dung.update).toHaveBeenCalledWith({
        where: { id: baseUser.id },
        data: { so_lan_dang_nhap_sai: 3, khoa_den: null },
      });
    });

    it('đang trong thời gian khóa -> 423 ACCOUNT_LOCKED dù mật khẩu ĐÚNG, không gọi bcrypt.compare', async () => {
      const khoaDen = new Date(Date.now() + 5 * 60 * 1000);
      prisma.nguoi_dung.findUnique.mockResolvedValue({
        ...baseUser,
        so_lan_dang_nhap_sai: 5,
        khoa_den: khoaDen,
      });
      const compareSpy = jest.spyOn(bcrypt, 'compare');

      await expect(
        service.dangNhap({
          ten_dang_nhap: baseUser.ten_dang_nhap,
          mat_khau: 'MatKhauGoc',
        }),
      ).rejects.toBeInstanceOf(AccountLockedException);
      expect(compareSpy).not.toHaveBeenCalled();
      expect(prisma.nguoi_dung.update).not.toHaveBeenCalled();
    });

    it('khoa_den đã hết hạn (đã qua 15 phút) + mật khẩu đúng -> đăng nhập thành công, reset bộ đếm', async () => {
      const khoaDenDaQua = new Date(Date.now() - 1000);
      prisma.nguoi_dung.findUnique.mockResolvedValue({
        ...baseUser,
        so_lan_dang_nhap_sai: 5,
        khoa_den: khoaDenDaQua,
      });
      const res = await service.dangNhap({
        ten_dang_nhap: baseUser.ten_dang_nhap,
        mat_khau: 'MatKhauGoc',
      });
      expect(res.token).toBe('fake.jwt.token');
      expect(prisma.nguoi_dung.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            so_lan_dang_nhap_sai: 0,
            khoa_den: null,
          }),
        }),
      );
    });

    it('khoa_den đã hết hạn + mật khẩu vẫn sai -> đếm lại từ 1, không cộng dồn số cũ', async () => {
      const khoaDenDaQua = new Date(Date.now() - 1000);
      prisma.nguoi_dung.findUnique.mockResolvedValue({
        ...baseUser,
        so_lan_dang_nhap_sai: 5,
        khoa_den: khoaDenDaQua,
      });
      await expect(
        service.dangNhap({
          ten_dang_nhap: baseUser.ten_dang_nhap,
          mat_khau: 'sai',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedAppException);
      expect(prisma.nguoi_dung.update).toHaveBeenCalledWith({
        where: { id: baseUser.id },
        data: { so_lan_dang_nhap_sai: 1, khoa_den: null },
      });
    });

    it('đăng nhập đúng -> cập nhật dang_nhap_lan_cuoi và reset bộ đếm sai', async () => {
      prisma.nguoi_dung.findUnique.mockResolvedValue({
        ...baseUser,
        so_lan_dang_nhap_sai: 3,
      });
      await service.dangNhap({
        ten_dang_nhap: baseUser.ten_dang_nhap,
        mat_khau: 'MatKhauGoc',
      });
      expect(prisma.nguoi_dung.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            so_lan_dang_nhap_sai: 0,
            khoa_den: null,
            dang_nhap_lan_cuoi: expect.any(Date),
          }),
        }),
      );
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

  describe('dangXuat', () => {
    const user = {
      id: 'user-1',
      jti: 'jti-abc',
      exp: 1_800_000_000,
    };

    it('ghi token_thu_hoi với jti/nguoi_dung_id/het_han suy từ exp (giây -> ms)', async () => {
      prisma.token_thu_hoi.create.mockResolvedValue({});
      const res = await service.dangXuat(user as never);

      expect(prisma.token_thu_hoi.create).toHaveBeenCalledWith({
        data: {
          jti: user.jti,
          nguoi_dung_id: user.id,
          het_han: new Date(user.exp * 1000),
        },
      });
      expect(res).toEqual({ da_dang_xuat: true });
    });

    it('gọi lại với jti đã tồn tại (P2002) -> không throw, vẫn trả về thành công (idempotent)', async () => {
      prisma.token_thu_hoi.create.mockRejectedValue(p2002());
      await expect(service.dangXuat(user as never)).resolves.toEqual({
        da_dang_xuat: true,
      });
    });

    it('lỗi khác P2002 -> ném lại nguyên lỗi', async () => {
      prisma.token_thu_hoi.create.mockRejectedValue(new Error('DB sập'));
      await expect(service.dangXuat(user as never)).rejects.toThrow('DB sập');
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

    // T1: mật khẩu mới >=8 ký tự, có cả chữ và số, khác mật khẩu cũ, khác
    // ngày sinh ddmmyyyy (nếu tài khoản gắn hồ sơ học viên).
    it.each([
      ['Ab1', 'quá ngắn (<8 ký tự)'],
      ['abcdefgh', 'không có số'],
      ['12345678', 'không có chữ'],
      ['MatKhauGoc', 'trùng mật khẩu cũ'],
    ])('mật khẩu mới "%s" (%s) -> ValidationException', async (matKhauMoi) => {
      prisma.nguoi_dung.findUniqueOrThrow.mockResolvedValue(baseUser);
      await expect(
        service.doiMatKhau({ id: baseUser.id } as never, {
          mat_khau_cu: 'MatKhauGoc',
          mat_khau_moi: matKhauMoi,
        }),
      ).rejects.toBeInstanceOf(ValidationException);
      expect(prisma.nguoi_dung.update).not.toHaveBeenCalled();
    });

    it('mật khẩu mới trùng ngày sinh (ddmmyyyy) của hồ sơ học viên liên kết -> ValidationException', async () => {
      prisma.nguoi_dung.findUniqueOrThrow.mockResolvedValue({
        ...baseUser,
        vai_tro: 'hoc_vien',
        hoc_vien_id: 'hv-1',
      });
      prisma.hoc_vien.findUnique.mockResolvedValue({
        ngay_sinh: 5,
        thang_sinh: 9,
        nam_sinh: 2000,
      });
      await expect(
        service.doiMatKhau({ id: baseUser.id } as never, {
          mat_khau_cu: 'MatKhauGoc',
          mat_khau_moi: '05092000',
        }),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('không gắn hoc_vien -> không tra hoc_vien, mật khẩu hợp lệ được chấp nhận', async () => {
      prisma.nguoi_dung.findUniqueOrThrow.mockResolvedValue(baseUser);
      prisma.nguoi_dung.update.mockResolvedValue({
        ...baseUser,
        phai_doi_mat_khau: false,
      });
      await service.doiMatKhau({ id: baseUser.id } as never, {
        mat_khau_cu: 'MatKhauGoc',
        mat_khau_moi: 'MoiMoi123',
      });
      expect(prisma.hoc_vien.findUnique).not.toHaveBeenCalled();
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
