import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { HocVienService } from '../hoc-vien/hoc-vien.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  ForbiddenAppException,
  SsoChuaCauHinhException,
  SsoMaKhongHopLeException,
  UnauthorizedAppException,
} from '../common/exceptions/app.exceptions';
import { SsoTarget } from './dto/sso.dto';

// SSO sang hệ thống khảo sát (2026-10-02, docs/api-contract.md mục 10).
// Luồng: học viên đã đăng nhập cổng bấm nút -> cổng cấp mã ngẫu nhiên dùng 1
// lần, chuyển hướng tới SSO_KHAO_SAT_URL?code=..&target=.. -> máy chủ khảo
// sát gọi POST /sso/doi-ma (kèm X-API-Key) đổi mã lấy thông tin tối thiểu.
// Không đưa CCCD/mật khẩu lên URL; DB chỉ lưu SHA-256 của mã.

export const SSO_MA_HIEU_LUC_MS = 5 * 60 * 1000;
const SSO_URL_MAC_DINH = 'https://khaosatnls.hcmue.edu.vn/sso/start';

function bamMa(ma: string): string {
  return createHash('sha256').update(ma).digest('hex');
}

/** So khớp API key thời gian hằng (băm trước để 2 buffer luôn cùng độ dài). */
function khopApiKey(guiLen: string, dung: string): boolean {
  const a = createHash('sha256').update(guiLen).digest();
  const b = createHash('sha256').update(dung).digest();
  return timingSafeEqual(a, b);
}

export interface ThongTinSso {
  hoc_vien_id: string;
  ma_dinh_danh_moet: string | null;
  vai_tro: 'giao_vien' | 'can_bo_quan_ly' | null;
  ma_don_vi: string | null;
  ten_don_vi: string;
  target: SsoTarget | null;
  lop: {
    ma_khoa: string;
    ten_lop: string;
    loai_lop: string;
    giai_doan: string;
  }[];
}

@Injectable()
export class SsoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hocVienService: HocVienService,
  ) {}

  async capMa(
    caller: AuthenticatedUser,
    target?: SsoTarget,
  ): Promise<{ url: string; het_han: Date }> {
    if (target === 'dau-ra') {
      await this.kiemTraKhaoSatDauRa(caller);
    } else {
      await this.kiemTraDanhGiaDauVao(caller);
    }

    const ma = randomBytes(32).toString('base64url');
    const hetHan = new Date(Date.now() + SSO_MA_HIEU_LUC_MS);
    await this.prisma.ma_sso_mot_lan.create({
      data: {
        ma_hash: bamMa(ma),
        hoc_vien_id: caller.hoc_vien_id!,
        target: target ?? null,
        het_han: hetHan,
      },
    });

    const url = new URL(process.env.SSO_KHAO_SAT_URL || SSO_URL_MAC_DINH);
    url.searchParams.set('code', ma);
    if (target) url.searchParams.set('target', target);
    return { url: url.toString(), het_han: hetHan };
  }

  // Khảo sát đầu ra: quản trị đã bật + hồ sơ đầy đủ (không phụ thuộc kênh đầu vào).
  private async kiemTraKhaoSatDauRa(caller: AuthenticatedUser) {
    const dauRa = await this.hocVienService.khaoSatDauRaCuaToi(caller);
    if (!dauRa.mo) {
      throw new ForbiddenAppException('Khảo sát đầu ra chưa mở');
    }
    if (!dauRa.du_dieu_kien) {
      throw new ForbiddenAppException(
        'Hồ sơ chưa đầy đủ, chưa thể chuyển sang trang khảo sát',
      );
    }
  }

  // Tái dùng đúng cổng điều kiện M6 — 1 nơi quyết định "đủ điều kiện".
  private async kiemTraDanhGiaDauVao(caller: AuthenticatedUser) {
    const dieuKien = await this.hocVienService.danhGiaDauVaoCuaToi(caller);
    if (dieuKien.kenh !== 'sso') {
      throw new ForbiddenAppException(
        'Hiện không dùng trang khảo sát cho bài đánh giá đầu vào',
      );
    }
    if (!dieuKien.du_dieu_kien) {
      throw new ForbiddenAppException(
        'Hồ sơ chưa đầy đủ, chưa thể chuyển sang trang khảo sát',
      );
    }
  }

  async doiMa(apiKey: string | undefined, ma: string): Promise<ThongTinSso> {
    const khoaDung = process.env.SSO_KHAO_SAT_API_KEY;
    if (!khoaDung) throw new SsoChuaCauHinhException();
    if (!apiKey || !khopApiKey(apiKey, khoaDung)) {
      throw new UnauthorizedAppException('API key không hợp lệ');
    }

    // Đánh dấu đã dùng NGUYÊN TỬ: 2 lần đổi cùng mã đồng thời chỉ 1 lần thắng.
    const now = new Date();
    const maHash = bamMa(ma);
    const { count } = await this.prisma.ma_sso_mot_lan.updateMany({
      where: { ma_hash: maHash, da_dung_luc: null, het_han: { gt: now } },
      data: { da_dung_luc: now },
    });
    if (count !== 1) throw new SsoMaKhongHopLeException();

    const ban = await this.prisma.ma_sso_mot_lan.findUnique({
      where: { ma_hash: maHash },
      include: {
        hoc_vien: {
          include: {
            don_vi_cong_tac: true,
            dang_ky_hoc: {
              include: {
                khoa: true,
                phan_lop_giai_doan: {
                  include: { lop: true, giai_doan: true },
                },
              },
            },
          },
        },
      },
    });
    if (!ban) throw new SsoMaKhongHopLeException();
    const hv = ban.hoc_vien;

    return {
      hoc_vien_id: hv.id,
      ma_dinh_danh_moet: hv.ma_dinh_danh_moet,
      vai_tro: hv.doi_tuong,
      ma_don_vi: hv.don_vi_cong_tac.ma_don_vi,
      ten_don_vi: hv.don_vi_cong_tac.ten_don_vi,
      target: (ban.target as SsoTarget | null) ?? null,
      lop: hv.dang_ky_hoc.flatMap((dk) =>
        dk.phan_lop_giai_doan.map((pl) => ({
          ma_khoa: dk.khoa.ma_khoa,
          ten_lop: pl.lop.ten_lop,
          loai_lop: pl.lop.loai_lop,
          giai_doan: pl.giai_doan.ten_giai_doan,
        })),
      ),
    };
  }
}
