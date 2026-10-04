import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { HocVienService } from '../hoc-vien/hoc-vien.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  ForbiddenAppException,
  NotFoundAppException,
  SsoMaKhongHopLeException,
} from '../common/exceptions/app.exceptions';
import { SsoTarget } from './dto/sso.dto';
import { kiemTraApiKeyKhaoSat } from './sso-api-key';
import { KetQuaKhaoSatService } from './ket-qua-khao-sat.service';

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

export interface ThongTinSso {
  hoc_vien_id: string;
  ma_dinh_danh_moet: string | null;
  vai_tro: 'giao_vien' | 'can_bo_quan_ly' | null;
  ma_don_vi: string | null;
  /** Khóa đã duyệt mới nhất học viên ghi danh (null nếu chưa ghi danh) — để bên khảo sát biết tỉnh/khóa. */
  ma_khoa: string | null;
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
    private readonly ketQuaKhaoSat: KetQuaKhaoSatService,
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

    const { url, het_han } = await this.taoMa(caller.hoc_vien_id!, target);
    return { url, het_han };
  }

  // POST /sso/ma-thu (quan_tri) — mã THỬ cho 1 học viên chọn theo mã MOET, để
  // quản trị / đội khảo sát gọi thử /sso/doi-ma khi tích hợp. Cố ý BỎ QUA điều
  // kiện kênh + hồ sơ đầy đủ (mục đích là thử). Không mở thêm quyền: quản trị
  // vốn xem được mọi hồ sơ, và đổi mã vẫn bắt buộc API key của máy chủ khảo sát.
  async taoMaThu(maDinhDanhMoet: string, target?: SsoTarget) {
    const hocVien = await this.prisma.hoc_vien.findUnique({
      where: { ma_dinh_danh_moet: maDinhDanhMoet },
      select: {
        id: true,
        ho_ten: true,
        ma_dinh_danh_moet: true,
        doi_tuong: true,
      },
    });
    if (!hocVien) {
      throw new NotFoundAppException(
        'Không tìm thấy học viên có mã định danh này',
      );
    }
    return { ...(await this.taoMa(hocVien.id, target)), hoc_vien: hocVien };
  }

  private async taoMa(hocVienId: string, target?: SsoTarget) {
    const ma = randomBytes(32).toString('base64url');
    const hetHan = new Date(Date.now() + SSO_MA_HIEU_LUC_MS);
    await this.prisma.ma_sso_mot_lan.create({
      data: {
        ma_hash: bamMa(ma),
        hoc_vien_id: hocVienId,
        target: target ?? null,
        het_han: hetHan,
      },
    });

    const url = new URL(process.env.SSO_KHAO_SAT_URL || SSO_URL_MAC_DINH);
    url.searchParams.set('code', ma);
    if (target) url.searchParams.set('target', target);
    return { url: url.toString(), code: ma, het_han: hetHan };
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
    kiemTraApiKeyKhaoSat(apiKey);

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
    // Học viên đã thực sự tới trang khảo sát -> ghi "đã mở" cho bài tương ứng.
    if (ban.target) {
      await this.ketQuaKhaoSat.ghiDaMo(hv.id, ban.target as SsoTarget);
    }
    const khoaGanNhat = hv.dang_ky_hoc
      .filter((dk) => dk.khoa.trang_thai === 'da_duyet')
      .sort(
        (a, b) =>
          (b.khoa.ngay_duyet?.getTime() ?? 0) -
          (a.khoa.ngay_duyet?.getTime() ?? 0),
      )[0]?.khoa;

    return {
      hoc_vien_id: hv.id,
      ma_dinh_danh_moet: hv.ma_dinh_danh_moet,
      vai_tro: hv.doi_tuong,
      ma_don_vi: hv.don_vi_cong_tac.ma_don_vi,
      ma_khoa: khoaGanNhat?.ma_khoa ?? null,
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
