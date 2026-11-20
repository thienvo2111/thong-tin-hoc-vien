import { Injectable } from '@nestjs/common';
import type { ho_so_don_vi } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NhatKyService } from '../nhat-ky/nhat-ky.service';
import {
  ForbiddenAppException,
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  DON_VI_TIEP_NHAN,
  HoSoDonViDuLieu,
  NGAN_HANG_TIEP_NHAN,
  TEN_TRUONG_HO_SO,
  TruongHoSo,
  chuanHoaHoSo,
  docDauVaoHoSo,
  kiemTraHoSo,
  stkChuyenKhoan,
  tinhTrangHoSo,
  truongThayDoi,
} from './ho-so-don-vi.quy-tac';

export interface HoSoDonViPhanHoi {
  don_vi: { id: string; ten: string };
  ho_so: (HoSoDonViDuLieu & { updated_at: string }) | null;
  tinh_trang: { du: boolean; thieu: TruongHoSo[]; so_thieu: number };
  /** U2: suy ra từ mã QHNS, không lưu. null khi chưa có mã QHNS hợp lệ. */
  chuyen_khoan: {
    stk: string;
    don_vi_tiep_nhan: string;
    ngan_hang: string;
  } | null;
  goi_y: { ten_truong: string };
}

function layDuLieu(hang: ho_so_don_vi): HoSoDonViDuLieu {
  const kq = {} as HoSoDonViDuLieu;
  for (const t of TEN_TRUONG_HO_SO) kq[t] = hang[t];
  return kq;
}

// Issue #63 / ADR 0015 M4, U2, O3: Hồ sơ đơn vị — trường đọc/ghi hồ sơ của chính mình
// (đơn vị lấy từ token, không nhận id từ client); Quản trị đọc hồ sơ mọi trường.
@Injectable()
export class HoSoDonViService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nhatKy: NhatKyService,
  ) {}

  async cuaTruong(user: AuthenticatedUser): Promise<HoSoDonViPhanHoi> {
    return this.doc(this.donViCua(user), ForbiddenAppException);
  }

  async quanTriXem(donViId: string): Promise<HoSoDonViPhanHoi> {
    return this.doc(donViId, NotFoundAppException);
  }

  // T2: Hồ sơ đơn vị KHÔNG bị khóa theo hạn đợt hay theo việc nộp hợp đồng (dùng chung mọi đợt).
  async luu(user: AuthenticatedUser, body: unknown): Promise<HoSoDonViPhanHoi> {
    const donViId = this.donViCua(user);
    const { duLieu, loi: loiDauVao } = docDauVaoHoSo(body);
    const moi = chuanHoaHoSo(duLieu);
    const loi = { ...kiemTraHoSo(moi).loi, ...loiDauVao };
    const fields = Object.entries(loi).map(([field, message]) => ({
      field,
      message: message as string,
    }));
    if (fields.length) {
      throw new ValidationException('Hồ sơ đơn vị chưa hợp lệ', fields);
    }

    await this.timDonVi(donViId, ForbiddenAppException);
    const cu = await this.prisma.ho_so_don_vi.findUnique({
      where: { don_vi_id: donViId },
    });
    const thayDoi = truongThayDoi(cu, moi);
    if (thayDoi.length) {
      await this.prisma.ho_so_don_vi.upsert({
        where: { don_vi_id: donViId },
        create: { don_vi_id: donViId, ...moi, cap_nhat_boi: user.id },
        update: { ...moi, cap_nhat_boi: user.id, updated_at: new Date() },
      });
      // Chỉ TÊN trường — STK, họ tên là dữ liệu nhạy cảm, không ghi giá trị vào nhật ký.
      await this.nhatKy.ghi({
        hanh_dong: 'cap_nhat_ho_so_don_vi',
        chi_tiet: { don_vi_id: donViId, truong_thay_doi: thayDoi },
      });
    }
    return this.doc(donViId, ForbiddenAppException);
  }

  private async doc(
    donViId: string,
    LoiKhongThay: new (m: string) => Error,
  ): Promise<HoSoDonViPhanHoi> {
    const donVi = await this.timDonVi(donViId, LoiKhongThay);
    const hang = await this.prisma.ho_so_don_vi.findUnique({
      where: { don_vi_id: donViId },
    });
    const duLieu = hang ? layDuLieu(hang) : null;
    const { du, thieu } = tinhTrangHoSo(duLieu);
    const stk = stkChuyenKhoan(duLieu?.ma_qhns);
    return {
      don_vi: { id: donVi.id, ten: donVi.ten_don_vi },
      ho_so:
        hang && duLieu
          ? { ...duLieu, updated_at: hang.updated_at.toISOString() }
          : null,
      tinh_trang: { du, thieu, so_thieu: thieu.length },
      chuyen_khoan: stk
        ? {
            stk,
            don_vi_tiep_nhan: DON_VI_TIEP_NHAN,
            ngan_hang: NGAN_HANG_TIEP_NHAN,
          }
        : null,
      goi_y: { ten_truong: donVi.ten_don_vi },
    };
  }

  private async timDonVi(
    donViId: string,
    LoiKhongThay: new (m: string) => Error,
  ) {
    const donVi = await this.prisma.don_vi_cong_tac.findUnique({
      where: { id: donViId },
      select: { id: true, ten_don_vi: true },
    });
    if (!donVi) throw new LoiKhongThay('Không tìm thấy đơn vị');
    return donVi;
  }

  private donViCua(user: AuthenticatedUser): string {
    if (!user.don_vi_id) {
      throw new ForbiddenAppException(
        'Tài khoản trường chưa gắn đơn vị — liên hệ HCMUE để được gắn trường',
      );
    }
    return user.don_vi_id;
  }
}
