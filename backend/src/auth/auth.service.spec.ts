import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeService } from './scope/scope.service';
import { ThongBaoService } from '../thong-bao/thong-bao.service';
import {
  AccountLockedException,
  UnauthorizedAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { NhatKyService } from '../nhat-ky/nhat-ky.service';

let nhatKy: { ghi: jest.Mock };

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
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock;
    };
    token_thu_hoi: {
      create: jest.Mock;
    };
    token_xac_thuc: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    hoc_vien: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let jwtService: { signAsync: jest.Mock };
  let scopeService: { getAccessibleDonViIds: jest.Mock };
  let thongBaoService: {
    guiDatLaiMatKhau: jest.Mock;
  };

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
        findFirst: jest.fn(),
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
      token_xac_thuc: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      hoc_vien: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    jwtService = { signAsync: jest.fn().mockResolvedValue('fake.jwt.token') };
    scopeService = {
      getAccessibleDonViIds: jest.fn().mockResolvedValue(['don-vi-1']),
    };
    thongBaoService = {
      guiDatLaiMatKhau: jest.fn().mockResolvedValue(undefined),
    };
    nhatKy = { ghi: jest.fn().mockResolvedValue(undefined) };
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as never,
      scopeService as unknown as ScopeService,
      thongBaoService as unknown as ThongBaoService,
      nhatKy as unknown as NhatKyService,
    );
  });

  describe('dangNhap', () => {
    it('sai tên đăng nhập (không tồn tại) -> UnauthorizedAppException', async () => {
      prisma.nguoi_dung.findFirst.mockResolvedValue(null);
      await expect(
        service.dangNhap({ ten_dang_nhap: 'khong-co', mat_khau: 'x' }),
      ).rejects.toBeInstanceOf(UnauthorizedAppException);
    });

    it('tài khoản bị vô hiệu hóa (trang_thai=ngung) -> Unauthorized', async () => {
      prisma.nguoi_dung.findFirst.mockResolvedValue({
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
      prisma.nguoi_dung.findFirst.mockResolvedValue(baseUser);
      await expect(
        service.dangNhap({
          ten_dang_nhap: baseUser.ten_dang_nhap,
          mat_khau: 'sai',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedAppException);
    });

    // T1 (bảo mật đăng nhập): xem mo-rong-nls-an-giang.md mục T1.
    it('sai mật khẩu lần thứ 5 (liên tiếp) -> ghi khoa_den = now+15p', async () => {
      prisma.nguoi_dung.findFirst.mockResolvedValue({
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
      prisma.nguoi_dung.findFirst.mockResolvedValue({
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
      prisma.nguoi_dung.findFirst.mockResolvedValue({
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
      prisma.nguoi_dung.findFirst.mockResolvedValue({
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
      prisma.nguoi_dung.findFirst.mockResolvedValue({
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
      prisma.nguoi_dung.findFirst.mockResolvedValue({
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
      prisma.nguoi_dung.findFirst.mockResolvedValue(baseUser);
      const res = await service.dangNhap({
        ten_dang_nhap: baseUser.ten_dang_nhap,
        mat_khau: 'MatKhauGoc',
      });
      expect(res.token).toBe('fake.jwt.token');
      expect(res.nguoi_dung).not.toHaveProperty('mat_khau_hash');
      expect(res.phai_doi_mat_khau).toBe(false);
    });

    // T4b (2026-09-29): mã CSDL MOET và CCCD không giả định trùng nhau —
    // đăng nhập phải chấp nhận CẢ ten_dang_nhap gốc LẪN CCCD của hồ sơ học
    // viên liên kết (kể cả khi tài khoản được tạo bằng mã MOET rồi CCCD mới
    // bổ sung sau qua PATCH /hoc-vien/toi).
    it('tra cứu tài khoản khớp theo ten_dang_nhap HOẶC hoc_vien.so_dinh_danh_ca_nhan (1 câu query duy nhất)', async () => {
      prisma.nguoi_dung.findFirst.mockResolvedValue(baseUser);
      await service.dangNhap({
        ten_dang_nhap: '123456789012',
        mat_khau: 'MatKhauGoc',
      });
      expect(prisma.nguoi_dung.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { ten_dang_nhap: '123456789012' },
            // ADR 0002/0003: chỉ tài khoản đơn vị + người hỗ trợ học viên
            // khớp không phân biệt hoa/thường.
            {
              vai_tro: { in: ['so_gddt', 'phong_vhxh', 'truong', 'ho_tro_hoc_vien'] },
              ten_dang_nhap: { equals: '123456789012', mode: 'insensitive' },
            },
            { hoc_vien: { so_dinh_danh_ca_nhan: '123456789012' } },
          ],
        },
        include: { hoc_vien: true },
      });
    });

    it('đăng nhập bằng CCCD của hồ sơ import_moet tự bổ sung sau -> thành công', async () => {
      // Tài khoản được tạo bằng mã MOET (ten_dang_nhap khác CCCD) nhưng học
      // viên đã tự bổ sung CCCD qua PATCH /hoc-vien/toi — findFirst (mock)
      // trả về đúng tài khoản này khi tra theo CCCD ở nhánh OR thứ 2.
      prisma.nguoi_dung.findFirst.mockResolvedValue({
        ...baseUser,
        ten_dang_nhap: 'MOET00123',
        hoc_vien_id: 'hv-1',
      });
      const res = await service.dangNhap({
        ten_dang_nhap: '123456789012', // CCCD, KHÔNG phải ten_dang_nhap gốc
        mat_khau: 'MatKhauGoc',
      });
      expect(res.token).toBe('fake.jwt.token');
    });

    it('sai cả ten_dang_nhap lẫn CCCD -> vẫn 1 thông báo lỗi chung (rule #9/#55)', async () => {
      prisma.nguoi_dung.findFirst.mockResolvedValue(null);
      await expect(
        service.dangNhap({ ten_dang_nhap: 'khong-khop-gi-ca', mat_khau: 'x' }),
      ).rejects.toBeInstanceOf(UnauthorizedAppException);
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

  // 2026-09-30: quên/đặt lại mật khẩu + xác minh email liên hệ.
  describe('quenMatKhau', () => {
    const hocVienDaXacMinh = {
      id: 'hv-1',
      ho_ten: 'Nguyễn Văn A',
      email_lien_he: 'a@example.com',
      email_da_xac_minh: true,
    };

    it('tài khoản không tồn tại -> vẫn trả da_gui:true, không tạo token', async () => {
      prisma.nguoi_dung.findFirst.mockResolvedValue(null);
      const res = await service.quenMatKhau({ ten_dang_nhap: 'khong-co' });
      expect(res).toEqual({ da_gui: true });
      expect(prisma.token_xac_thuc.create).not.toHaveBeenCalled();
    });

    // ADR 0002: tài khoản đơn vị CÓ email nay được gửi link (xem e2e
    // tai-khoan-don-vi-auth); không email thì vẫn im lặng như cũ.
    it('tài khoản đơn vị không có email -> vẫn trả da_gui:true, không tạo token (rule #9/#34b)', async () => {
      prisma.nguoi_dung.findFirst.mockResolvedValue({
        ...baseUser,
        vai_tro: 'truong',
        email: null,
      });
      const res = await service.quenMatKhau({
        ten_dang_nhap: baseUser.ten_dang_nhap,
      });
      expect(res).toEqual({ da_gui: true });
      expect(prisma.token_xac_thuc.create).not.toHaveBeenCalled();
    });

    it('hoc_vien nhưng email_lien_he chưa xác minh -> vẫn trả da_gui:true, không tạo token', async () => {
      prisma.nguoi_dung.findFirst.mockResolvedValue({
        ...baseUser,
        vai_tro: 'hoc_vien',
        hoc_vien: { ...hocVienDaXacMinh, email_da_xac_minh: false },
      });
      const res = await service.quenMatKhau({
        ten_dang_nhap: baseUser.ten_dang_nhap,
      });
      expect(res).toEqual({ da_gui: true });
      expect(prisma.token_xac_thuc.create).not.toHaveBeenCalled();
    });

    it('hoc_vien có email đã xác minh -> tạo token + gửi email + vô hiệu token cũ', async () => {
      prisma.nguoi_dung.findFirst.mockResolvedValue({
        ...baseUser,
        vai_tro: 'hoc_vien',
        hoc_vien: hocVienDaXacMinh,
      });
      const res = await service.quenMatKhau({
        ten_dang_nhap: baseUser.ten_dang_nhap,
      });
      expect(res).toEqual({ da_gui: true });
      expect(prisma.token_xac_thuc.updateMany).toHaveBeenCalledWith({
        where: {
          hoc_vien_id: 'hv-1',
          loai: 'dat_lai_mat_khau',
          da_dung_luc: null,
        },
        data: { da_dung_luc: expect.any(Date) },
      });
      expect(prisma.token_xac_thuc.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            hoc_vien_id: 'hv-1',
            loai: 'dat_lai_mat_khau',
          }),
        }),
      );
      expect(thongBaoService.guiDatLaiMatKhau).toHaveBeenCalledWith(
        'a@example.com',
        'Nguyễn Văn A',
        expect.stringContaining('/dat-lai-mat-khau?token='),
        'hv-1',
      );
    });

    it('đã có token còn hiệu lực tạo dưới 60 giây trước -> không tạo token mới (chặn spam)', async () => {
      prisma.nguoi_dung.findFirst.mockResolvedValue({
        ...baseUser,
        vai_tro: 'hoc_vien',
        hoc_vien: hocVienDaXacMinh,
      });
      prisma.token_xac_thuc.findFirst.mockResolvedValue({ id: 'tok-cu' });
      const res = await service.quenMatKhau({
        ten_dang_nhap: baseUser.ten_dang_nhap,
      });
      expect(res).toEqual({ da_gui: true });
      expect(prisma.token_xac_thuc.create).not.toHaveBeenCalled();
      expect(thongBaoService.guiDatLaiMatKhau).not.toHaveBeenCalled();
    });
  });

  describe('datLaiMatKhau', () => {
    it('token không tồn tại -> ValidationException với thông báo chung', async () => {
      prisma.token_xac_thuc.findUnique.mockResolvedValue(null);
      await expect(
        service.datLaiMatKhau({
          token: 'khong-ton-tai',
          mat_khau_moi: 'MoiMoi123',
        }),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('token đúng loại nhưng đã hết hạn -> ValidationException', async () => {
      prisma.token_xac_thuc.findUnique.mockResolvedValue({
        id: 'tok-1',
        hoc_vien_id: 'hv-1',
        loai: 'dat_lai_mat_khau',
        da_dung_luc: null,
        het_han_luc: new Date(Date.now() - 1000),
      });
      await expect(
        service.datLaiMatKhau({ token: 'het-han', mat_khau_moi: 'MoiMoi123' }),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('token đã dùng rồi -> ValidationException', async () => {
      prisma.token_xac_thuc.findUnique.mockResolvedValue({
        id: 'tok-1',
        hoc_vien_id: 'hv-1',
        loai: 'dat_lai_mat_khau',
        da_dung_luc: new Date(),
        het_han_luc: new Date(Date.now() + 1000),
      });
      await expect(
        service.datLaiMatKhau({ token: 'da-dung', mat_khau_moi: 'MoiMoi123' }),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('token đúng loại xac_minh_email (khác loại yêu cầu) -> ValidationException', async () => {
      prisma.token_xac_thuc.findUnique.mockResolvedValue({
        id: 'tok-1',
        hoc_vien_id: 'hv-1',
        loai: 'xac_minh_email',
        da_dung_luc: null,
        het_han_luc: new Date(Date.now() + 1000),
      });
      await expect(
        service.datLaiMatKhau({ token: 'sai-loai', mat_khau_moi: 'MoiMoi123' }),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('token hợp lệ + mật khẩu mới không đạt yêu cầu -> ValidationException, không cập nhật', async () => {
      prisma.token_xac_thuc.findUnique.mockResolvedValue({
        id: 'tok-1',
        hoc_vien_id: 'hv-1',
        loai: 'dat_lai_mat_khau',
        da_dung_luc: null,
        het_han_luc: new Date(Date.now() + 1000),
      });
      prisma.nguoi_dung.findUnique.mockResolvedValue(baseUser);
      await expect(
        service.datLaiMatKhau({ token: 'ok', mat_khau_moi: 'abc' }),
      ).rejects.toBeInstanceOf(ValidationException);
      expect(prisma.nguoi_dung.update).not.toHaveBeenCalled();
    });

    it('token hợp lệ + mật khẩu trùng mật khẩu hiện tại (bcrypt.compare, không cần biết chữ rõ) -> ValidationException', async () => {
      prisma.token_xac_thuc.findUnique.mockResolvedValue({
        id: 'tok-1',
        hoc_vien_id: 'hv-1',
        loai: 'dat_lai_mat_khau',
        da_dung_luc: null,
        het_han_luc: new Date(Date.now() + 1000),
      });
      // Mật khẩu hiện tại là "MoiMoi123" (khác baseUser.mat_khau_hash gốc) —
      // cô lập đúng nhánh "khác mật khẩu cũ" (kiểm bằng bcrypt.compare vì
      // không có mật khẩu cũ dạng chữ rõ ở luồng quên mật khẩu).
      prisma.nguoi_dung.findUnique.mockResolvedValue({
        ...baseUser,
        mat_khau_hash: await bcrypt.hash('MoiMoi123', 4),
      });
      await expect(
        service.datLaiMatKhau({ token: 'ok', mat_khau_moi: 'MoiMoi123' }),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('token hợp lệ + mật khẩu mới hợp lệ -> cập nhật mat_khau_hash, phai_doi_mat_khau=false, vô hiệu token', async () => {
      prisma.token_xac_thuc.findUnique.mockResolvedValue({
        id: 'tok-1',
        hoc_vien_id: 'hv-1',
        loai: 'dat_lai_mat_khau',
        da_dung_luc: null,
        het_han_luc: new Date(Date.now() + 1000),
      });
      prisma.nguoi_dung.findUnique.mockResolvedValue(baseUser);

      const res = await service.datLaiMatKhau({
        token: 'ok',
        mat_khau_moi: 'MoiMoi123',
      });
      expect(res).toEqual({ da_dat_lai: true });
      expect(prisma.nguoi_dung.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: baseUser.id },
          data: expect.objectContaining({ phai_doi_mat_khau: false }),
        }),
      );
      expect(prisma.token_xac_thuc.updateMany).toHaveBeenCalledWith({
        where: {
          hoc_vien_id: 'hv-1',
          loai: 'dat_lai_mat_khau',
          da_dung_luc: null,
        },
        data: { da_dung_luc: expect.any(Date) },
      });
    });
  });

  describe('xacMinhEmail', () => {
    it('token không tồn tại -> ValidationException', async () => {
      prisma.token_xac_thuc.findUnique.mockResolvedValue(null);
      await expect(
        service.xacMinhEmail({ token: 'khong-ton-tai' }),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('token hợp lệ -> set hoc_vien.email_da_xac_minh=true + đánh dấu token đã dùng', async () => {
      prisma.token_xac_thuc.findUnique.mockResolvedValue({
        id: 'tok-1',
        hoc_vien_id: 'hv-1',
        loai: 'xac_minh_email',
        da_dung_luc: null,
        het_han_luc: new Date(Date.now() + 1000),
      });
      const res = await service.xacMinhEmail({ token: 'ok' });
      expect(res).toEqual({ da_xac_minh: true });
      expect(prisma.hoc_vien.update).toHaveBeenCalledWith({
        where: { id: 'hv-1' },
        data: { email_da_xac_minh: true },
      });
      expect(prisma.token_xac_thuc.update).toHaveBeenCalledWith({
        where: { id: 'tok-1' },
        data: { da_dung_luc: expect.any(Date) },
      });
    });
  });

  describe('nhật ký đăng nhập', () => {
    // Hàm (không phải hằng): mat_khau_hash của baseUser chỉ có sau beforeAll.
    const hocVien = () => ({
      ...baseUser,
      vai_tro: 'hoc_vien' as const,
      hoc_vien_id: 'hv-1',
    });

    it('đăng nhập đúng -> ghi dang_nhap_thanh_cong gắn học viên + tài khoản', async () => {
      prisma.nguoi_dung.findFirst.mockResolvedValue(hocVien());
      await service.dangNhap({
        ten_dang_nhap: baseUser.ten_dang_nhap,
        mat_khau: 'MatKhauGoc',
      });
      expect(nhatKy.ghi).toHaveBeenCalledWith({
        hoc_vien_id: 'hv-1',
        nguoi_dung: { id: 'user-1', vai_tro: 'hoc_vien' },
        hanh_dong: 'dang_nhap_thanh_cong',
      });
    });

    it('sai mật khẩu -> ghi dang_nhap_sai_mat_khau kèm số lần sai', async () => {
      prisma.nguoi_dung.findFirst.mockResolvedValue({
        ...hocVien(),
        so_lan_dang_nhap_sai: 1,
      });
      await expect(
        service.dangNhap({
          ten_dang_nhap: baseUser.ten_dang_nhap,
          mat_khau: 'sai',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedAppException);
      expect(nhatKy.ghi).toHaveBeenCalledWith(
        expect.objectContaining({
          hanh_dong: 'dang_nhap_sai_mat_khau',
          mo_ta: 'Lần sai thứ 2 liên tiếp',
        }),
      );
    });

    it('sai lần thứ 5 -> mô tả ghi rõ tài khoản bị tạm khóa', async () => {
      prisma.nguoi_dung.findFirst.mockResolvedValue({
        ...hocVien(),
        so_lan_dang_nhap_sai: 4,
      });
      await expect(
        service.dangNhap({
          ten_dang_nhap: baseUser.ten_dang_nhap,
          mat_khau: 'sai',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedAppException);
      expect(nhatKy.ghi.mock.calls[0][0].mo_ta).toContain('bị tạm khóa');
    });

    it('đang bị khóa -> ghi dang_nhap_bi_khoa', async () => {
      prisma.nguoi_dung.findFirst.mockResolvedValue({
        ...hocVien(),
        khoa_den: new Date(Date.now() + 60_000),
      });
      await expect(
        service.dangNhap({
          ten_dang_nhap: baseUser.ten_dang_nhap,
          mat_khau: 'MatKhauGoc',
        }),
      ).rejects.toBeInstanceOf(AccountLockedException);
      expect(nhatKy.ghi).toHaveBeenCalledWith(
        expect.objectContaining({ hanh_dong: 'dang_nhap_bi_khoa' }),
      );
    });

    it('tên đăng nhập không tồn tại -> không ghi (không có chủ thể)', async () => {
      prisma.nguoi_dung.findFirst.mockResolvedValue(null);
      await expect(
        service.dangNhap({ ten_dang_nhap: 'khong-co', mat_khau: 'x' }),
      ).rejects.toBeInstanceOf(UnauthorizedAppException);
      expect(nhatKy.ghi).not.toHaveBeenCalled();
    });
  });
});
