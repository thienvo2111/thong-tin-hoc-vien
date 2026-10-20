import { Injectable } from '@nestjs/common';
import {
  Prisma,
  dot_nhu_cau_muc,
  muc_nang_luc,
  nhu_cau_muc_hoc_vien,
  trang_thai_dang_ky,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DotNhuCauDongException,
  ForbiddenAppException,
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import {
  HOC_VIEN_PHAI_XEP_LOP,
  phaiXepLop,
} from '../common/utils/doi-tuong-khao-sat.util';
import { NHAN_MUC } from '../khoa-boi-duong/util/muc-hoc.util';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { TrangThaiDot, trangThaiDot } from './dot-nhu-cau-muc.service';
import {
  GiaiDoanPhanLop,
  MocNhuCau,
  cacMucNhuCauDuocChon,
  duocChonNhuCau,
  homNayVN,
  tinhMocNhuCau,
} from './util/moc-nhu-cau.util';

export type LyDoKhongDu = 'nhan_vien' | 'trang_thai_dang_ky' | 'chua_co_moc';

export interface NhuCauMucCuaToi {
  dot: {
    id: string;
    ten_dot: string;
    mo_luc: Date;
    dong_luc: Date;
    trang_thai: TrangThaiDot;
  };
  khoa: { id: string; ten_khoa: string };
  du_dieu_kien: boolean;
  ly_do_khong_du: LyDoKhongDu | null;
  moc: MocNhuCau | null;
  cac_muc_duoc_chon: muc_nang_luc[];
  lua_chon: Pick<
    nhu_cau_muc_hoc_vien,
    'muc_chon' | 'muc_moc' | 'nguon_moc' | 'chon_luc' | 'cap_nhat_luc'
  > | null;
}

export const TRANG_THAI_DU: trang_thai_dang_ky[] = ['da_duyet', 'da_phan_lop'];

const THONG_DIEP_KHONG_DU: Record<LyDoKhongDu, string> = {
  nhan_vien: 'Nhân viên không tham gia chọn nhu cầu mức học',
  trang_thai_dang_ky:
    'Đăng ký học chưa được duyệt nên chưa thể chọn nhu cầu mức học',
  chua_co_moc: 'Chưa có mức hiện tại để chọn nhu cầu mức học',
};

/** Giai đoạn active của khóa — dùng chung với thống kê theo đợt. */
export const GIAI_DOAN_MOC_ARGS = {
  where: { trang_thai: 'active' },
  orderBy: { thu_tu: 'asc' },
  select: {
    id: true,
    ten_giai_doan: true,
    thu_tu: true,
    thoi_gian_bat_dau: true,
    thoi_gian_ket_thuc: true,
  },
} satisfies Prisma.khoa_boi_duong$giai_doanArgs;

export const PHAN_LOP_MOC_ARGS = {
  select: {
    giai_doan_id: true,
    lop: { select: { id: true, ten_lop: true, muc_nang_luc: true } },
  },
} satisfies Prisma.dang_ky_hoc$phan_lop_giai_doanArgs;

const DANG_KY_INCLUDE = {
  hoc_vien: { select: { doi_tuong: true } },
  khoa: {
    select: { id: true, ten_khoa: true, giai_doan: GIAI_DOAN_MOC_ARGS },
  },
  phan_lop_giai_doan: PHAN_LOP_MOC_ARGS,
} satisfies Prisma.dang_ky_hocInclude;

type DangKyNap = Prisma.dang_ky_hocGetPayload<{
  include: typeof DANG_KY_INCLUDE;
}>;

const ngayISO = (d: Date) => d.toISOString().slice(0, 10);

type GiaiDoanNap = DangKyNap['khoa']['giai_doan'][number];
type PhanLopNap = DangKyNap['phan_lop_giai_doan'][number];

/** Giai đoạn active của khóa + phân lớp của 1 đăng ký → đầu vào tinhMocNhuCau. */
export function giaiDoanPhanLop(
  giaiDoan: GiaiDoanNap[],
  phanLop: PhanLopNap[],
): GiaiDoanPhanLop[] {
  return giaiDoan.map((gd) => ({
    giai_doan_id: gd.id,
    ten_giai_doan: gd.ten_giai_doan,
    thu_tu: gd.thu_tu,
    bat_dau: ngayISO(gd.thoi_gian_bat_dau),
    ket_thuc: ngayISO(gd.thoi_gian_ket_thuc),
    lop: phanLop.find((p) => p.giai_doan_id === gd.id)?.lop ?? null,
  }));
}

// ADR 0013 — học viên xem/chọn nhu cầu mức học theo đợt. Chỉ ghi
// nhu_cau_muc_hoc_vien; không đụng dang_ky_hoc.muc_* / phan_lop_giai_doan (D1).
@Injectable()
export class NhuCauMucHocVienService {
  constructor(private readonly prisma: PrismaService) {}

  /** Các đợt đang mở mà học viên đủ điều kiện tham gia. */
  async danhSach(caller: AuthenticatedUser): Promise<NhuCauMucCuaToi[]> {
    const hocVienId = this.assertHocVienId(caller);
    const dangKys = await this.prisma.dang_ky_hoc.findMany({
      where: {
        hoc_vien_id: hocVienId,
        trang_thai: { in: TRANG_THAI_DU },
        hoc_vien: HOC_VIEN_PHAI_XEP_LOP,
      },
      include: DANG_KY_INCLUDE,
    });
    if (!dangKys.length) return [];

    const now = new Date();
    const dots = await this.prisma.dot_nhu_cau_muc.findMany({
      where: {
        khoa_id: { in: dangKys.map((dk) => dk.khoa_id) },
        mo_luc: { lte: now },
        dong_luc: { gt: now },
      },
      orderBy: { mo_luc: 'asc' },
    });
    if (!dots.length) return [];

    const luaChons = await this.prisma.nhu_cau_muc_hoc_vien.findMany({
      where: {
        dot_id: { in: dots.map((d) => d.id) },
        dang_ky_hoc_id: { in: dangKys.map((dk) => dk.id) },
      },
    });
    const dkTheoKhoa = new Map(dangKys.map((dk) => [dk.khoa_id, dk]));
    return dots
      .map((dot) => {
        const dk = dkTheoKhoa.get(dot.khoa_id)!;
        const luaChon =
          luaChons.find(
            (l) => l.dot_id === dot.id && l.dang_ky_hoc_id === dk.id,
          ) ?? null;
        return this.xayDung(dot, dk, luaChon, now);
      })
      .filter((x) => x.du_dieu_kien);
  }

  async chiTiet(
    caller: AuthenticatedUser,
    dotId: string,
  ): Promise<NhuCauMucCuaToi> {
    const { dot, dk } = await this.napDotVaDangKy(caller, dotId);
    const luaChon = await this.timLuaChon(dot.id, dk.id);
    return this.xayDung(dot, dk, luaChon, new Date());
  }

  async chon(
    caller: AuthenticatedUser,
    dotId: string,
    muc: muc_nang_luc,
  ): Promise<NhuCauMucCuaToi> {
    const { dot, dk } = await this.napDotVaDangKy(caller, dotId);
    const now = new Date();
    if (trangThaiDot(dot, now) !== 'dang_mo') {
      throw new DotNhuCauDongException();
    }
    const { lyDo, moc } = this.danhGia(dk, now);
    if (lyDo) throw new ValidationException(THONG_DIEP_KHONG_DU[lyDo]);
    if (!duocChonNhuCau(moc!.muc, muc)) {
      const message = `Chỉ được chọn mức bằng hoặc thấp hơn mức hiện tại (${NHAN_MUC[moc!.muc]})`;
      throw new ValidationException(message, [{ field: 'muc', message }]);
    }

    const luaChon = await this.ghiLuaChon(dot.id, dk.id, muc, moc!, now);
    return this.xayDung(dot, dk, luaChon, now);
  }

  // Upsert trên UNIQUE (dot_id, dang_ky_hoc_id) — 2 request đồng thời không
  // tạo 2 dòng. P2002 (đua nhau insert) thì thử lại 1 lần, lần 2 sẽ là update.
  private async ghiLuaChon(
    dotId: string,
    dangKyId: string,
    muc: muc_nang_luc,
    moc: MocNhuCau,
    now: Date,
  ) {
    const chung = {
      muc_chon: muc,
      muc_moc: moc.muc,
      nguon_moc: moc.nguon,
      lop_id_luc_chon: moc.lop?.id ?? null,
      cap_nhat_luc: now,
    };
    const upsert = () =>
      this.prisma.nhu_cau_muc_hoc_vien.upsert({
        where: {
          dot_id_dang_ky_hoc_id: { dot_id: dotId, dang_ky_hoc_id: dangKyId },
        },
        create: {
          dot_id: dotId,
          dang_ky_hoc_id: dangKyId,
          chon_luc: now,
          ...chung,
        },
        update: chung,
      });
    try {
      return await upsert();
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        return upsert();
      }
      throw e;
    }
  }

  // 404 chung cho đợt không tồn tại và đợt của khóa học viên không học —
  // không lộ thông tin đợt (Review Focus 5).
  private async napDotVaDangKy(caller: AuthenticatedUser, dotId: string) {
    const hocVienId = this.assertHocVienId(caller);
    const dot = await this.prisma.dot_nhu_cau_muc.findUnique({
      where: { id: dotId },
    });
    const dk = dot
      ? await this.prisma.dang_ky_hoc.findUnique({
          where: {
            hoc_vien_id_khoa_id: {
              hoc_vien_id: hocVienId,
              khoa_id: dot.khoa_id,
            },
          },
          include: DANG_KY_INCLUDE,
        })
      : null;
    if (!dot || !dk) {
      throw new NotFoundAppException('Không tìm thấy đợt nhu cầu mức học');
    }
    return { dot, dk };
  }

  private timLuaChon(dotId: string, dangKyId: string) {
    return this.prisma.nhu_cau_muc_hoc_vien.findUnique({
      where: {
        dot_id_dang_ky_hoc_id: { dot_id: dotId, dang_ky_hoc_id: dangKyId },
      },
    });
  }

  private danhGia(
    dk: DangKyNap,
    now: Date,
  ): { lyDo: LyDoKhongDu | null; moc: MocNhuCau | null } {
    const gds = giaiDoanPhanLop(dk.khoa.giai_doan, dk.phan_lop_giai_doan);
    const moc = tinhMocNhuCau(gds, dk.muc_dau_vao, homNayVN(now));
    if (!phaiXepLop(dk.hoc_vien.doi_tuong)) return { lyDo: 'nhan_vien', moc };
    if (!TRANG_THAI_DU.includes(dk.trang_thai)) {
      return { lyDo: 'trang_thai_dang_ky', moc };
    }
    return { lyDo: moc ? null : 'chua_co_moc', moc };
  }

  private xayDung(
    dot: dot_nhu_cau_muc,
    dk: DangKyNap,
    luaChon: nhu_cau_muc_hoc_vien | null,
    now: Date,
  ): NhuCauMucCuaToi {
    const { lyDo, moc } = this.danhGia(dk, now);
    return {
      dot: {
        id: dot.id,
        ten_dot: dot.ten_dot,
        mo_luc: dot.mo_luc,
        dong_luc: dot.dong_luc,
        trang_thai: trangThaiDot(dot, now),
      },
      khoa: { id: dk.khoa.id, ten_khoa: dk.khoa.ten_khoa },
      du_dieu_kien: lyDo === null,
      ly_do_khong_du: lyDo,
      moc,
      cac_muc_duoc_chon:
        lyDo === null && moc ? cacMucNhuCauDuocChon(moc.muc) : [],
      lua_chon: luaChon
        ? {
            muc_chon: luaChon.muc_chon,
            muc_moc: luaChon.muc_moc,
            nguon_moc: luaChon.nguon_moc,
            chon_luc: luaChon.chon_luc,
            cap_nhat_luc: luaChon.cap_nhat_luc,
          }
        : null,
    };
  }

  private assertHocVienId(caller: AuthenticatedUser): string {
    if (!caller.hoc_vien_id) {
      throw new ForbiddenAppException(
        'Tài khoản hiện tại không gắn với hồ sơ học viên nào',
      );
    }
    return caller.hoc_vien_id;
  }
}
