import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { Prisma, nguoi_dung } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeService, DonViScope } from './scope/scope.service';
import {
  AccountLockedException,
  UnauthorizedAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { DangNhapDto } from './dto/dang-nhap.dto';
import { DoiMatKhauDto } from './dto/doi-mat-khau.dto';
import {
  AuthenticatedUser,
  JwtPayload,
} from './interfaces/jwt-payload.interface';
import {
  FieldMessage,
  matKhauMacDinhTuNgaySinh,
} from '../hoc-vien/hoc-vien-validation.util';

const BCRYPT_SALT_ROUNDS = 10;

// T1 (bảo mật đăng nhập, mo-rong-nls-an-giang.md): sai 5 lần liên tiếp ->
// khóa 15 phút.
const NGUONG_SO_LAN_SAI_KHOA = 5;
const THOI_GIAN_KHOA_MS = 15 * 60 * 1000;

export type SafeNguoiDung = Omit<nguoi_dung, 'mat_khau_hash'>;

export function sanitizeNguoiDung(user: nguoi_dung): SafeNguoiDung {
  const safe: Partial<nguoi_dung> = { ...user };
  delete safe.mat_khau_hash;
  return safe as SafeNguoiDung;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly scopeService: ScopeService,
  ) {}

  async dangNhap(dto: DangNhapDto) {
    // T4b (2026-09-29): mã định danh CSDL MOET và CCCD KHÔNG giả định trùng
    // nhau — chấp nhận đăng nhập bằng ten_dang_nhap GỐC hoặc bằng CCCD của
    // hồ sơ học viên liên kết (hoc_vien.so_dinh_danh_ca_nhan), kể cả khi tài
    // khoản được tạo bằng mã MOET rồi CCCD mới bổ sung sau qua PATCH
    // /hoc-vien/toi. Không tiết lộ trong response/log việc khớp theo trường
    // nào — dùng chung 1 thông báo lỗi như trước (rule #9/#34b).
    const nguoiDung = await this.prisma.nguoi_dung.findFirst({
      where: {
        OR: [
          { ten_dang_nhap: dto.ten_dang_nhap },
          { hoc_vien: { so_dinh_danh_ca_nhan: dto.ten_dang_nhap } },
        ],
      },
    });

    // Không tiết lộ "tài khoản không tồn tại" khác với "sai mật khẩu" —
    // cùng một thông báo chung để tránh dò tài khoản.
    if (!nguoiDung || nguoiDung.trang_thai !== 'active') {
      throw new UnauthorizedAppException();
    }

    const now = new Date();
    // T1: đang trong thời gian khóa -> 423, KHÔNG kiểm tra mật khẩu (đúng
    // hay sai cũng bị chặn như nhau — spec mo-rong-nls-an-giang.md mục T1).
    if (nguoiDung.khoa_den && nguoiDung.khoa_den > now) {
      throw new AccountLockedException(nguoiDung.khoa_den);
    }

    const khop = await bcrypt.compare(dto.mat_khau, nguoiDung.mat_khau_hash);
    if (!khop) {
      // Nếu từng có khoa_den nhưng đã hết hạn (đã "hết 15 phút"), coi như
      // bắt đầu đếm lại từ 0 trước khi cộng lần sai này — không cộng dồn lên
      // bộ đếm cũ đã hết hiệu lực.
      const soLanTruoc =
        nguoiDung.khoa_den && nguoiDung.khoa_den <= now
          ? 0
          : nguoiDung.so_lan_dang_nhap_sai;
      const soLanMoi = soLanTruoc + 1;
      await this.prisma.nguoi_dung.update({
        where: { id: nguoiDung.id },
        data: {
          so_lan_dang_nhap_sai: soLanMoi,
          khoa_den:
            soLanMoi >= NGUONG_SO_LAN_SAI_KHOA
              ? new Date(now.getTime() + THOI_GIAN_KHOA_MS)
              : null,
        },
      });
      throw new UnauthorizedAppException();
    }

    const updated = await this.prisma.nguoi_dung.update({
      where: { id: nguoiDung.id },
      data: {
        so_lan_dang_nhap_sai: 0,
        khoa_den: null,
        dang_nhap_lan_cuoi: now,
      },
    });

    const token = await this.signToken(updated);

    return {
      token,
      phai_doi_mat_khau: updated.phai_doi_mat_khau,
      nguoi_dung: sanitizeNguoiDung(updated),
    };
  }

  // POST /auth/dang-xuat (gap 1, 2026-09-28) — xem docs/api-contract.md mục 1
  // + docs/database-ddl.sql (token_thu_hoi). Ghi jti hiện tại vào bảng thu
  // hồi, het_han = hạn gốc của token (từ payload.exp, KHÔNG phải thời điểm
  // đăng xuất) để JwtAuthGuard từ chối đúng tới khi token hết hạn tự nhiên.
  // Idempotent: gọi lại với cùng token (đã bị thu hồi) không được ném lỗi.
  async dangXuat(user: AuthenticatedUser): Promise<{ da_dang_xuat: true }> {
    try {
      await this.prisma.token_thu_hoi.create({
        data: {
          jti: user.jti,
          nguoi_dung_id: user.id,
          het_han: new Date(user.exp * 1000),
        },
      });
    } catch (e) {
      if (!(
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
      )) {
        throw e;
      }
    }
    return { da_dang_xuat: true };
  }

  async doiMatKhau(user: AuthenticatedUser, dto: DoiMatKhauDto) {
    const nguoiDung = await this.prisma.nguoi_dung.findUniqueOrThrow({
      where: { id: user.id },
    });

    const khop = await bcrypt.compare(dto.mat_khau_cu, nguoiDung.mat_khau_hash);
    if (!khop) {
      throw new ValidationException('Mật khẩu cũ không đúng', [
        { field: 'mat_khau_cu', message: 'Mật khẩu cũ không đúng' },
      ]);
    }

    const loiPhucTap = await this.kiemTraDoPhucTapMatKhauMoi(nguoiDung, dto);
    if (loiPhucTap.length > 0) {
      throw new ValidationException(
        'Mật khẩu mới không đạt yêu cầu',
        loiPhucTap,
      );
    }

    const matKhauHashMoi = await bcrypt.hash(
      dto.mat_khau_moi,
      BCRYPT_SALT_ROUNDS,
    );

    const updated = await this.prisma.nguoi_dung.update({
      where: { id: user.id },
      data: { mat_khau_hash: matKhauHashMoi, phai_doi_mat_khau: false },
    });

    return { nguoi_dung: sanitizeNguoiDung(updated) };
  }

  // T1: mật khẩu mới >= 8 ký tự, có cả chữ và số, khác mật khẩu cũ, và (nếu
  // tài khoản gắn hồ sơ học viên) khác chuỗi ngày sinh ddmmyyyy — chính là
  // mật khẩu mặc định lúc tạo tài khoản, xem hoc-vien-validation.util.ts.
  private async kiemTraDoPhucTapMatKhauMoi(
    nguoiDung: nguoi_dung,
    dto: DoiMatKhauDto,
  ): Promise<FieldMessage[]> {
    const loi: FieldMessage[] = [];
    const mk = dto.mat_khau_moi;

    if (mk.length < 8) {
      loi.push({ field: 'mat_khau_moi', message: 'Phải có ít nhất 8 ký tự' });
    }
    if (!/\d/.test(mk) || !/\p{L}/u.test(mk)) {
      loi.push({
        field: 'mat_khau_moi',
        message: 'Phải có cả chữ và số',
      });
    }
    if (mk === dto.mat_khau_cu) {
      loi.push({
        field: 'mat_khau_moi',
        message: 'Phải khác mật khẩu cũ',
      });
    }

    if (nguoiDung.hoc_vien_id) {
      const hocVien = await this.prisma.hoc_vien.findUnique({
        where: { id: nguoiDung.hoc_vien_id },
        select: { ngay_sinh: true, thang_sinh: true, nam_sinh: true },
      });
      if (hocVien) {
        const ngaySinhStr = matKhauMacDinhTuNgaySinh(
          hocVien.ngay_sinh,
          hocVien.thang_sinh,
          hocVien.nam_sinh,
        );
        if (mk === ngaySinhStr) {
          loi.push({
            field: 'mat_khau_moi',
            message: 'Không được trùng ngày sinh (định dạng ddmmyyyy)',
          });
        }
      }
    }

    return loi;
  }

  async layThongTinHienTai(user: AuthenticatedUser) {
    const nguoiDung = await this.prisma.nguoi_dung.findUniqueOrThrow({
      where: { id: user.id },
    });
    const phamVi = await this.moTaPhamVi(user);
    return { nguoi_dung: sanitizeNguoiDung(nguoiDung), pham_vi: phamVi };
  }

  // Đáp ứng cột "phạm vi quyền suy ra" của GET /auth/toi trong
  // docs/api-contract.md. Hình dạng response cụ thể không được spec định
  // nghĩa chi tiết — improvise: trả loại phạm vi + danh sách don_vi_id (nếu
  // không phải ALL/rỗng) để FE/module khác tham khảo.
  private async moTaPhamVi(user: AuthenticatedUser) {
    if (user.vai_tro === 'hoc_vien') {
      return {
        loai: 'chi_ho_so_ca_nhan' as const,
        hoc_vien_id: user.hoc_vien_id,
      };
    }
    const scope: DonViScope =
      await this.scopeService.getAccessibleDonViIds(user);
    if (scope === 'ALL') {
      return { loai: 'toan_he_thong' as const };
    }
    return { loai: 'don_vi_va_con' as const, don_vi_ids: scope };
  }

  private async signToken(nguoiDung: nguoi_dung): Promise<string> {
    const payload: JwtPayload = {
      sub: nguoiDung.id,
      ten_dang_nhap: nguoiDung.ten_dang_nhap,
      vai_tro: nguoiDung.vai_tro,
      don_vi_id: nguoiDung.don_vi_id,
      hoc_vien_id: nguoiDung.hoc_vien_id,
      jti: randomUUID(),
    };
    return this.jwtService.signAsync(payload);
  }
}
