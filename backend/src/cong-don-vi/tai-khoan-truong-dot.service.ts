import { HttpException, Injectable, Logger } from '@nestjs/common';
import type { trang_thai_active } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NhatKyService } from '../nhat-ky/nhat-ky.service';
import { NotFoundAppException } from '../common/exceptions/app.exceptions';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { TaiKhoanDonViService } from '../nguoi-dung/tai-khoan-don-vi.service';
import { VAI_TRO_DON_VI } from '../nguoi-dung/tai-khoan-don-vi.util';
import {
  TaiKhoanDonViDaTao,
  buildMatKhauTamTruongWorkbook,
} from '../import/util/tai-khoan-don-vi-excel.util';

export interface DonViGon {
  id: string;
  ma: string | null;
  ten: string;
}

export interface TaiKhoanTruongCuaDot {
  don_vi: DonViGon;
  tai_khoan: {
    id: string;
    ten_dang_nhap: string;
    trang_thai: trang_thai_active;
    lan_dang_nhap_cuoi: Date | null;
  } | null;
}

export interface KetQuaCapTaiKhoanTruong {
  so_tao: number;
  bo_qua: { don_vi: DonViGon; ly_do: string }[];
  /** File .xlsx mật khẩu tạm (base64) — chỉ trả 1 lần trong response này, server không lưu. */
  file_mat_khau: string | null;
}

export const LY_DO_KHONG_MA =
  'Trường chưa có mã đơn vị — tạo tài khoản tay ở Đơn vị & tài khoản';
export const LY_DO_NGUNG = 'Trường đang ngưng hoạt động';
const LY_DO_KHONG_RO = 'Lỗi không xác định khi tạo tài khoản — thử lại sau';

/** Lý do bỏ qua từ lỗi của TaiKhoanDonViService (lỗi từng ô của field nếu có). */
function lyDoTuLoi(e: unknown, tenDangNhap: string): string {
  if (!(e instanceof HttpException)) return LY_DO_KHONG_RO;
  const body = e.getResponse() as {
    error?: { message?: string; fields?: { field: string; message: string }[] };
  };
  const fields = body.error?.fields ?? [];
  if (fields.length === 0) return body.error?.message ?? e.message;
  return fields
    .map((f) =>
      f.field === 'ten_dang_nhap'
        ? `Tên đăng nhập "${tenDangNhap}": ${f.message}`
        : f.message,
    )
    .join('; ');
}

// ADR 0015 T4: tài khoản trường dùng nguyên tài khoản đơn vị (ADR 0002) — tên đăng nhập = mã trường chữ
// thường, mật khẩu tạm, không email; chỉ cấp cho trường có trong danh sách của đợt (có dòng hop_dong_boi_duong).
@Injectable()
export class TaiKhoanTruongDotService {
  private readonly logger = new Logger(TaiKhoanTruongDotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nhatKy: NhatKyService,
    private readonly taiKhoanDonVi: TaiKhoanDonViService,
  ) {}

  async danhSach(dotId: string) {
    const truong = await this.truongCuaDot(dotId);
    const coTk = truong.filter((t) => t.tai_khoan);
    return {
      tong: {
        so_truong: truong.length,
        so_co_tai_khoan: coTk.length,
        so_chua_co: truong.length - coTk.length,
        so_chua_dang_nhap: coTk.filter((t) => !t.tai_khoan!.lan_dang_nhap_cuoi)
          .length,
      },
      truong: truong.map(({ don_vi, tai_khoan }) => ({ don_vi, tai_khoan })),
    };
  }

  /**
   * Tạo tài khoản cho mọi trường của đợt CHƯA có (chạy lại chỉ tạo phần còn thiếu). Lỗi 1 trường không
   * dừng các trường khác. Mật khẩu tạm chỉ nằm trong file trả về — không lưu, không ghi nhật ký.
   */
  async cap(
    dotId: string,
    caller: AuthenticatedUser,
  ): Promise<KetQuaCapTaiKhoanTruong> {
    const truong = await this.truongCuaDot(dotId);
    const daTao: TaiKhoanDonViDaTao[] = [];
    const bo_qua: KetQuaCapTaiKhoanTruong['bo_qua'] = [];
    for (const { don_vi, tai_khoan, trang_thai_don_vi } of truong) {
      if (tai_khoan) continue;
      if (!don_vi.ma?.trim()) {
        bo_qua.push({ don_vi, ly_do: LY_DO_KHONG_MA });
        continue;
      }
      if (trang_thai_don_vi !== 'active') {
        bo_qua.push({ don_vi, ly_do: LY_DO_NGUNG });
        continue;
      }
      try {
        const kq = await this.taiKhoanDonVi.taoTaiKhoan(
          { don_vi_id: don_vi.id, cach_cap: 'mat_khau_tam' },
          caller,
        );
        daTao.push({
          ma_don_vi: don_vi.ma,
          ten_don_vi: don_vi.ten,
          ten_dang_nhap: kq.tai_khoan.ten_dang_nhap,
          mat_khau_tam: kq.mat_khau_tam,
          cach_cap: 'mat_khau_tam',
        });
      } catch (e) {
        if (!(e instanceof HttpException)) {
          this.logger.error(
            `Cấp tài khoản trường ${don_vi.id} lỗi: ${(e as Error)?.message}`,
          );
        }
        bo_qua.push({
          don_vi,
          ly_do: lyDoTuLoi(e, don_vi.ma.trim().toLowerCase()),
        });
      }
    }

    // Không ghi tên đăng nhập / mật khẩu vào nhật ký.
    await this.nhatKy.ghi({
      hanh_dong: 'cap_tai_khoan_truong_theo_dot',
      chi_tiet: {
        dot_trien_khai_id: dotId,
        so_tao: daTao.length,
        so_bo_qua: bo_qua.length,
      },
    });
    return {
      so_tao: daTao.length,
      bo_qua,
      file_mat_khau:
        daTao.length > 0
          ? (await buildMatKhauTamTruongWorkbook(daTao)).toString('base64')
          : null,
    };
  }

  /** Trường có dòng hợp đồng trong đợt (= trường trong danh sách của đợt), theo tên (vi). */
  private async truongCuaDot(dotId: string) {
    const dot = await this.prisma.dot_trien_khai.findUnique({
      where: { id: dotId },
      select: { id: true },
    });
    if (!dot) throw new NotFoundAppException('Không tìm thấy đợt triển khai');
    const hopDong = await this.prisma.hop_dong_boi_duong.findMany({
      where: { dot_trien_khai_id: dot.id },
      select: {
        don_vi: {
          select: {
            id: true,
            ma_don_vi: true,
            ten_don_vi: true,
            trang_thai: true,
            // 1 tài khoản / đơn vị (cùng điều kiện TaiKhoanDonViService.chuanBiTao).
            nguoi_dung: {
              where: { vai_tro: { in: VAI_TRO_DON_VI } },
              select: {
                id: true,
                ten_dang_nhap: true,
                trang_thai: true,
                dang_nhap_lan_cuoi: true,
              },
              orderBy: { created_at: 'asc' },
              take: 1,
            },
          },
        },
      },
    });
    return hopDong
      .map(({ don_vi: d }) => {
        const tk = d.nguoi_dung[0];
        return {
          don_vi: { id: d.id, ma: d.ma_don_vi, ten: d.ten_don_vi },
          trang_thai_don_vi: d.trang_thai,
          tai_khoan: tk
            ? {
                id: tk.id,
                ten_dang_nhap: tk.ten_dang_nhap,
                trang_thai: tk.trang_thai,
                lan_dang_nhap_cuoi: tk.dang_nhap_lan_cuoi,
              }
            : null,
        };
      })
      .sort((a, b) => a.don_vi.ten.localeCompare(b.don_vi.ten, 'vi'));
  }
}
