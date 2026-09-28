import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { sanitizeNguoiDung } from '../auth/auth.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { matKhauMacDinhTuNgaySinh } from '../hoc-vien/hoc-vien-validation.util';

const BCRYPT_SALT_ROUNDS = 10;

// Dịch vụ Quản lý tài khoản (nguoi_dung) — T1 mo-rong-nls-an-giang.md:
// POST /nguoi-dung/{id}/dat-lai-mat-khau + GET /nguoi-dung?q= (cả 2 chỉ
// quan_tri). Không phải 1 trong 7 dịch vụ gốc của canvas — thêm mới cho T1,
// tách khỏi AuthModule vì đây là thao tác quản trị lên tài khoản NGƯỜI KHÁC,
// khác với /auth/* (luôn thao tác lên chính tài khoản đang đăng nhập).
@Injectable()
export class NguoiDungService {
  constructor(private readonly prisma: PrismaService) {}

  // Chỉ áp dụng cho tài khoản vai_tro='hoc_vien' — "mật khẩu về ngày sinh
  // của hồ sơ" chỉ có ý nghĩa khi tài khoản gắn 1 hoc_vien có ngày sinh.
  // Tài khoản Sở/Phòng/Trường/QuảnTrị không có "hồ sơ" để suy ra mật khẩu
  // mặc định — spec (mục N4 hỗ trợ học viên) cũng chỉ nói tới ngữ cảnh này.
  // Improvised, flagged trong self-review.
  async datLaiMatKhau(id: string, caller: AuthenticatedUser) {
    const nguoiDung = await this.prisma.nguoi_dung.findUnique({
      where: { id },
    });
    if (!nguoiDung) {
      throw new NotFoundAppException('Không tìm thấy tài khoản');
    }
    if (nguoiDung.vai_tro !== 'hoc_vien' || !nguoiDung.hoc_vien_id) {
      throw new ValidationException(
        'Chỉ đặt lại được mật khẩu cho tài khoản học viên (mật khẩu mặc định suy từ ngày sinh hồ sơ)',
      );
    }

    const hocVien = await this.prisma.hoc_vien.findUniqueOrThrow({
      where: { id: nguoiDung.hoc_vien_id },
      select: { ngay_sinh: true, thang_sinh: true, nam_sinh: true },
    });
    const matKhauMoi = matKhauMacDinhTuNgaySinh(
      hocVien.ngay_sinh,
      hocVien.thang_sinh,
      hocVien.nam_sinh,
    );
    const matKhauHash = await bcrypt.hash(matKhauMoi, BCRYPT_SALT_ROUNDS);

    const [updated] = await this.prisma.$transaction([
      this.prisma.nguoi_dung.update({
        where: { id },
        data: {
          mat_khau_hash: matKhauHash,
          phai_doi_mat_khau: true,
          khoa_den: null,
          so_lan_dang_nhap_sai: 0,
        },
      }),
      this.prisma.nhat_ky_dat_lai_mat_khau.create({
        data: { nguoi_dung_id: id, thuc_hien_boi: caller.id },
      }),
    ]);

    return {
      nguoi_dung: sanitizeNguoiDung(updated),
      luu_y:
        'Mật khẩu đã đặt lại về ngày sinh (định dạng ddmmyyyy) — bắt buộc đổi khi đăng nhập lần đầu. Tài khoản đang bị khóa (nếu có) đã được mở ngay.',
    };
  }

  // GET /nguoi-dung?q= — tìm theo mã định danh (ten_dang_nhap)/họ tên/SĐT
  // (SĐT nằm ở hoc_vien, không phải nguoi_dung). Chỉ trả tối đa 20 kết quả —
  // đây là endpoint "tra cứu hỗ trợ" (N4), không phải danh sách quản lý cần
  // phân trang đầy đủ. Improvised (api-contract.md không định nghĩa response
  // shape), flagged trong self-review.
  async timKiem(q: string) {
    const data = await this.prisma.nguoi_dung.findMany({
      where: {
        OR: [
          { ten_dang_nhap: { contains: q, mode: 'insensitive' } },
          { ho_ten: { contains: q, mode: 'insensitive' } },
          { hoc_vien: { so_dien_thoai_lien_he: { contains: q } } },
        ],
      },
      take: 20,
      orderBy: { created_at: 'desc' },
      include: {
        hoc_vien: {
          select: {
            ho_ten: true,
            so_dinh_danh_ca_nhan: true,
            ngay_sinh: true,
            thang_sinh: true,
            nam_sinh: true,
            so_dien_thoai_lien_he: true,
            don_vi_cong_tac: { select: { ten_don_vi: true } },
          },
        },
      },
    });
    return { data: data.map((nd) => sanitizeNguoiDung(nd)) };
  }
}
