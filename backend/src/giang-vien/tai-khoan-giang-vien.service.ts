import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { ThongBaoService } from '../thong-bao/thong-bao.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  ConflictAppException,
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { layFrontendUrl } from '../common/utils/token-xac-thuc.util';
import {
  chuanHoaTenDangNhap,
  laTenDangNhapHopLe,
  sinhMatKhauTam,
} from '../nguoi-dung/tai-khoan-don-vi.util';
import { mapLoiUniqueTaiKhoan } from '../nguoi-dung/tai-khoan.kiem-tra';

const BCRYPT_SALT_ROUNDS = 10;

// ADR 0004 G8 (issue #20): tài khoản giảng viên (chỉ đọc) gắn 1–1 với hồ sơ
// giang_vien. Cấp = gửi link kích hoạt tới email của hồ sơ (người hỗ trợ GV
// hoặc Quản trị); gửi lại = mật khẩu cũ mất hiệu lực. Chỉ Quản trị khóa.
@Injectable()
export class TaiKhoanGiangVienService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly thongBao: ThongBaoService,
  ) {}

  // Tên đăng nhập = phần trước @ của email; trùng → thêm số ngẫu nhiên.
  private async sinhTenDangNhap(email: string): Promise<string> {
    let goc = chuanHoaTenDangNhap(email.split('@')[0]).slice(0, 40);
    if (!laTenDangNhapHopLe(goc)) goc = 'gv';
    for (let i = 0; i < 20; i++) {
      const ten =
        i === 0 && goc.length >= 3 ? goc : `${goc}.${randomInt(1000, 9999)}`;
      const trung = await this.prisma.nguoi_dung.count({
        where: { ten_dang_nhap: ten },
      });
      if (!trung) return ten;
    }
    throw new ConflictAppException('Không sinh được tên đăng nhập — thử lại');
  }

  async guiLinkKichHoat(giangVienId: string, caller: AuthenticatedUser) {
    const gv = await this.prisma.giang_vien.findUnique({
      where: { id: giangVienId },
      select: {
        id: true,
        ho_ten: true,
        email: true,
        trang_thai: true,
        tai_khoan: { select: { id: true, trang_thai: true, email: true } },
      },
    });
    if (!gv) throw new NotFoundAppException('Không tìm thấy giảng viên');
    if (gv.trang_thai !== 'active') {
      throw new ValidationException(
        'Giảng viên đã ngưng — không cấp tài khoản',
      );
    }
    if (!gv.email) {
      throw new ValidationException(
        'Giảng viên chưa có email — bổ sung email trước khi gửi link',
        [{ field: 'email', message: 'Chưa có email' }],
      );
    }
    if (gv.tai_khoan && gv.tai_khoan.trang_thai !== 'active') {
      throw new ConflictAppException(
        'Tài khoản giảng viên đang bị khóa — liên hệ Quản trị',
      );
    }
    const email = gv.email;
    const hash = await bcrypt.hash(sinhMatKhauTam(), BCRYPT_SALT_ROUNDS);
    const taoMoi = !gv.tai_khoan;
    const tenDangNhap = taoMoi ? await this.sinhTenDangNhap(email) : null;

    let ketQua: { nguoiDungId: string; tenDangNhap: string; token: string };
    try {
      ketQua = await this.prisma.$transaction(async (tx) => {
        const nd = gv.tai_khoan
          ? await tx.nguoi_dung.update({
              where: { id: gv.tai_khoan.id },
              // Email hồ sơ có thể đã sửa — tài khoản theo email hiện tại.
              data: {
                mat_khau_hash: hash,
                phai_doi_mat_khau: true,
                email,
                ho_ten: gv.ho_ten,
              },
              select: { id: true, ten_dang_nhap: true },
            })
          : await tx.nguoi_dung.create({
              data: {
                ho_ten: gv.ho_ten,
                ten_dang_nhap: tenDangNhap!,
                email,
                vai_tro: 'giang_vien',
                giang_vien_id: gv.id,
                mat_khau_hash: hash,
                phai_doi_mat_khau: true,
              },
              select: { id: true, ten_dang_nhap: true },
            });
        const token = await this.authService.taoTokenChoNguoiDung(
          nd.id,
          'kich_hoat_tai_khoan',
          tx,
        );
        await tx.nhat_ky_dat_lai_mat_khau.create({
          data: { nguoi_dung_id: nd.id, thuc_hien_boi: caller.id },
        });
        return { nguoiDungId: nd.id, tenDangNhap: nd.ten_dang_nhap, token };
      });
    } catch (e) {
      throw mapLoiUniqueTaiKhoan(e, {
        field: 'email',
        message: 'Email của giảng viên đã được dùng cho tài khoản khác',
      });
    }

    await this.thongBao.guiKichHoatTaiKhoan({
      email,
      hoTen: gv.ho_ten,
      tenDonVi: null,
      tenDangNhap: ketQua.tenDangNhap,
      link: `${layFrontendUrl()}/dat-lai-mat-khau?token=${ketQua.token}`,
    });
    return { da_gui: true as const, tao_moi: taoMoi, email };
  }

  /** Chỉ Quản trị: khóa / mở khóa tài khoản giảng viên. */
  async datTrangThai(giangVienId: string, trangThai: 'active' | 'ngung') {
    const { count } = await this.prisma.nguoi_dung.updateMany({
      where: { giang_vien_id: giangVienId },
      data: { trang_thai: trangThai },
    });
    if (!count) throw new NotFoundAppException('Giảng viên chưa có tài khoản');
    return { trang_thai: trangThai };
  }
}
