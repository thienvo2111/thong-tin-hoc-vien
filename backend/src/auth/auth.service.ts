import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { nguoi_dung } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeService, DonViScope } from './scope/scope.service';
import {
  UnauthorizedAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { DangNhapDto } from './dto/dang-nhap.dto';
import { DoiMatKhauDto } from './dto/doi-mat-khau.dto';
import {
  AuthenticatedUser,
  JwtPayload,
} from './interfaces/jwt-payload.interface';

const BCRYPT_SALT_ROUNDS = 10;

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
    const nguoiDung = await this.prisma.nguoi_dung.findUnique({
      where: { ten_dang_nhap: dto.ten_dang_nhap },
    });

    // Không tiết lộ "tài khoản không tồn tại" khác với "sai mật khẩu" —
    // cùng một thông báo chung để tránh dò tài khoản.
    if (!nguoiDung || nguoiDung.trang_thai !== 'active') {
      throw new UnauthorizedAppException();
    }

    const khop = await bcrypt.compare(dto.mat_khau, nguoiDung.mat_khau_hash);
    if (!khop) {
      throw new UnauthorizedAppException();
    }

    const token = await this.signToken(nguoiDung);

    return {
      token,
      phai_doi_mat_khau: nguoiDung.phai_doi_mat_khau,
      nguoi_dung: sanitizeNguoiDung(nguoiDung),
    };
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
    };
    return this.jwtService.signAsync(payload);
  }
}
