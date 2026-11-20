import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  chuong_trinh_boi_duong,
  hop_dong_boi_duong,
  trang_thai_danh_sach_truong,
  trang_thai_hop_dong,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NhatKyService } from '../nhat-ky/nhat-ky.service';
import {
  ConflictAppException,
  ForbiddenAppException,
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  LyDoChanNop,
  NhapHopDong,
  canPhan4,
  chuanHoaNhapHopDong,
  docDauVaoHopDong,
  giaTriTamTinh,
  kiemTraPhan3,
  lyDoChanNop,
  tongSuat,
  truongHopDongThayDoi,
} from './quy-tac-hop-dong';
import {
  DON_VI_TIEP_NHAN,
  HoSoDonViDuLieu,
  NGAN_HANG_TIEP_NHAN,
  stkChuyenKhoan,
  tinhTrangHoSo,
} from './ho-so-don-vi.quy-tac';
import { layDuLieu } from './ho-so-don-vi.service';
import {
  chuoiSangNgay,
  ngaySangChuoi,
  ngayVietNam,
} from './dot-trien-khai.service';
import { Tx, khoaTrangThaiHopDong, thaoTacCuoi } from './giao-dich-hop-dong';

/** M5: bản chụp Hồ sơ đơn vị lúc nộp — đủ mọi trường hồ sơ + thông tin chuyển khoản suy ra (U2). */
export type BanChupHoSo = HoSoDonViDuLieu & {
  stk_chuyen_khoan: string | null;
  don_vi_tiep_nhan: string;
  ngan_hang_tiep_nhan: string;
  chup_luc: string;
};

export interface ChuyenKhoan {
  stk: string;
  don_vi_tiep_nhan: string;
  ngan_hang: string;
}

export interface HopDongPhanHoi {
  dot: {
    id: string;
    ten: string;
    chuong_trinh: chuong_trinh_boi_duong;
    don_gia: number | null;
    ngay_qd_tu: string | null;
    ngay_qd_den: string | null;
    han_nop: string;
    han_nop_ngay: string;
  };
  trang_thai_danh_sach: trang_thai_danh_sach_truong;
  trang_thai_hop_dong: trang_thai_hop_dong;
  phan_3: Pick<
    NhapHopDong,
    'nguoi_nhan' | 'sdt_nguoi_nhan' | 'dia_chi_nhan' | 'ghi_chu'
  >;
  phan_4: Pick<NhapHopDong, 'so_qd' | 'ngay_qd'>;
  diem_hoc_truc_tiep: boolean;
  /** Chưa nộp: tính trực tiếp từ danh sách + đơn giá đợt. Đã nộp: số liệu lúc nộp (không tính lại). */
  so_nguoi: number;
  tong_suat: number;
  don_gia: number | null;
  gia_tri: number | null;
  can_phan_4: boolean;
  ho_so_tinh_trang: { du: boolean; so_thieu: number };
  chuyen_khoan: ChuyenKhoan | null;
  co_the_nop: boolean;
  ly_do_chan: LyDoChanNop[];
  nop_luc: string | null;
  ban_chup_ho_so: BanChupHoSo | null;
}

export interface HopDongQuanTri extends HopDongPhanHoi {
  don_vi: { id: string; ten: string };
  nop_boi: { ho_ten: string; ten_dang_nhap: string } | null;
  /** Chưa nộp: hồ sơ đơn vị hiện tại (null = chưa khai). Đã nộp: null — xem ban_chup_ho_so. */
  ho_so_hien_tai: HoSoDonViDuLieu | null;
}

export const KHONG_THAY_HOP_DONG =
  'Không tìm thấy hợp đồng của trường cho đợt này';
export const DA_NOP_LIEN_HE = 'Hợp đồng đã nộp — liên hệ HCMUE nếu cần mở lại';
const CHUA_NOP = 'Hợp đồng chưa nộp';

const KEM = {
  dot_trien_khai: {
    select: {
      id: true,
      ten: true,
      chuong_trinh: true,
      don_gia: true,
      ngay_qd_tu: true,
      ngay_qd_den: true,
      han_nop: true,
    },
  },
  don_vi: { select: { id: true, ten_don_vi: true } },
  nop_boi_user: { select: { ho_ten: true, ten_dang_nhap: true } },
} satisfies Prisma.hop_dong_boi_duongInclude;

type HopDongDayDu = Prisma.hop_dong_boi_duongGetPayload<{
  include: typeof KEM;
}>;

interface NguCanh {
  hopDong: HopDongDayDu;
  dong: { ty_le_suat: number }[];
  hoSo: HoSoDonViDuLieu | null;
}

const theoTruong = (dotId: string, donViId: string) => ({
  dot_trien_khai_id_don_vi_id: { dot_trien_khai_id: dotId, don_vi_id: donViId },
});

function nhapCua(h: HopDongDayDu): NhapHopDong {
  return {
    nguoi_nhan: h.nguoi_nhan,
    sdt_nguoi_nhan: h.sdt_nguoi_nhan,
    dia_chi_nhan: h.dia_chi_nhan,
    ghi_chu: h.ghi_chu,
    so_qd: h.so_qd,
    ngay_qd: ngaySangChuoi(h.ngay_qd),
    diem_hoc_truc_tiep: h.diem_hoc_truc_tiep,
  };
}

function chuyenKhoanTu(maQhns: string | null): ChuyenKhoan | null {
  const stk = stkChuyenKhoan(maQhns);
  return stk
    ? {
        stk,
        don_vi_tiep_nhan: DON_VI_TIEP_NHAN,
        ngan_hang: NGAN_HANG_TIEP_NHAN,
      }
    : null;
}

/** Các cột của hop_dong_boi_duong cần để chọn số liệu trực tiếp hay bản chụp lúc nộp. */
export type CotSoLieuHopDong = Pick<
  hop_dong_boi_duong,
  | 'trang_thai_hop_dong'
  | 'so_nguoi_luc_nop'
  | 'tong_suat_luc_nop'
  | 'don_gia_luc_nop'
  | 'gia_tri_luc_nop'
  | 'ban_chup_ho_so'
>;

/** Số liệu tính trực tiếp từ danh sách hiện tại + đơn giá đợt + hồ sơ hiện tại (dùng khi chưa nộp). */
export interface SoLieuTrucTiep {
  so_nguoi: number;
  tong_suat: number;
  don_gia: number | null;
  hoSo: HoSoDonViDuLieu | null;
}

/**
 * M5: số liệu + hồ sơ của 1 hợp đồng — chưa nộp: tính trực tiếp (giá trị tạm tính S5); đã nộp: số liệu và
 * bản chụp hồ sơ lúc nộp (không tính lại). Dùng chung cho màn hợp đồng và bảng Tiến độ đợt (issue #65).
 */
export function soLieuHopDong(h: CotSoLieuHopDong, trucTiep: SoLieuTrucTiep) {
  if (h.trang_thai_hop_dong === 'da_nop') {
    return {
      so_nguoi: h.so_nguoi_luc_nop ?? 0,
      tong_suat: Number(h.tong_suat_luc_nop ?? 0),
      don_gia: h.don_gia_luc_nop,
      gia_tri: h.gia_tri_luc_nop === null ? null : Number(h.gia_tri_luc_nop),
      hoSo: h.ban_chup_ho_so as unknown as HoSoDonViDuLieu,
    };
  }
  return {
    so_nguoi: trucTiep.so_nguoi,
    tong_suat: trucTiep.tong_suat,
    don_gia: trucTiep.don_gia,
    gia_tri: giaTriTamTinh(trucTiep.tong_suat, trucTiep.don_gia),
    hoSo: trucTiep.hoSo,
  };
}

/** Số liệu + hồ sơ dùng để hiển thị: trực tiếp khi chưa nộp, bản chụp khi đã nộp (M5). */
function soLieu(nc: NguCanh) {
  const h = nc.hopDong;
  const sl = soLieuHopDong(h, {
    so_nguoi: nc.dong.length,
    tong_suat: tongSuat(nc.dong),
    don_gia: h.dot_trien_khai.don_gia,
    hoSo: nc.hoSo,
  });
  if (h.trang_thai_hop_dong === 'da_nop') {
    const bc = h.ban_chup_ho_so as unknown as BanChupHoSo;
    return {
      ...sl,
      chuyen_khoan: bc.stk_chuyen_khoan
        ? {
            stk: bc.stk_chuyen_khoan,
            don_vi_tiep_nhan: bc.don_vi_tiep_nhan,
            ngan_hang: bc.ngan_hang_tiep_nhan,
          }
        : null,
    };
  }
  return { ...sl, chuyen_khoan: chuyenKhoanTu(nc.hoSo?.ma_qhns ?? null) };
}

function lyDoCua(nc: NguCanh, giaTri: number | null): LyDoChanNop[] {
  const h = nc.hopDong;
  const nhap = nhapCua(h);
  return lyDoChanNop({
    trangThaiDanhSach: h.trang_thai_danh_sach,
    trangThaiHopDong: h.trang_thai_hop_dong,
    donGia: h.dot_trien_khai.don_gia,
    giaTri,
    hoSo: nc.hoSo,
    diemHocTrucTiep: nhap.diem_hoc_truc_tiep,
    phan3: nhap,
    phan4: nhap,
    qdTu: ngaySangChuoi(h.dot_trien_khai.ngay_qd_tu),
    qdDen: ngaySangChuoi(h.dot_trien_khai.ngay_qd_den),
  });
}

function phanHoi(nc: NguCanh): HopDongPhanHoi {
  const h = nc.hopDong;
  const d = h.dot_trien_khai;
  const nhap = nhapCua(h);
  const sl = soLieu(nc);
  const ly_do_chan = lyDoCua(nc, sl.gia_tri);
  const tinhTrang = tinhTrangHoSo(sl.hoSo);
  const daNop = h.trang_thai_hop_dong === 'da_nop';
  return {
    dot: {
      id: d.id,
      ten: d.ten,
      chuong_trinh: d.chuong_trinh,
      don_gia: d.don_gia,
      ngay_qd_tu: ngaySangChuoi(d.ngay_qd_tu),
      ngay_qd_den: ngaySangChuoi(d.ngay_qd_den),
      han_nop: d.han_nop.toISOString(),
      han_nop_ngay: ngayVietNam(d.han_nop),
    },
    trang_thai_danh_sach: h.trang_thai_danh_sach,
    trang_thai_hop_dong: h.trang_thai_hop_dong,
    phan_3: {
      nguoi_nhan: nhap.nguoi_nhan,
      sdt_nguoi_nhan: nhap.sdt_nguoi_nhan,
      dia_chi_nhan: nhap.dia_chi_nhan,
      ghi_chu: nhap.ghi_chu,
    },
    phan_4: { so_qd: nhap.so_qd, ngay_qd: nhap.ngay_qd },
    diem_hoc_truc_tiep: nhap.diem_hoc_truc_tiep,
    so_nguoi: sl.so_nguoi,
    tong_suat: sl.tong_suat,
    don_gia: sl.don_gia,
    gia_tri: sl.gia_tri,
    can_phan_4: canPhan4(sl.gia_tri),
    ho_so_tinh_trang: { du: tinhTrang.du, so_thieu: tinhTrang.thieu.length },
    chuyen_khoan: sl.chuyen_khoan,
    co_the_nop: ly_do_chan.length === 0,
    ly_do_chan,
    nop_luc: h.nop_luc ? h.nop_luc.toISOString() : null,
    ban_chup_ho_so: daNop ? (h.ban_chup_ho_so as unknown as BanChupHoSo) : null,
  };
}

/** Bản chụp cũ cho nhật ký Mở lại (X5): đủ để khôi phục những gì trường đã nộp. */
function banChupCu(h: HopDongDayDu) {
  const nhap = nhapCua(h);
  return {
    ban_chup_ho_so: h.ban_chup_ho_so,
    so_nguoi: h.so_nguoi_luc_nop,
    tong_suat:
      h.tong_suat_luc_nop === null ? null : Number(h.tong_suat_luc_nop),
    don_gia: h.don_gia_luc_nop,
    gia_tri: h.gia_tri_luc_nop === null ? null : Number(h.gia_tri_luc_nop),
    nop_luc: h.nop_luc ? h.nop_luc.toISOString() : null,
    nop_boi: h.nop_boi,
    phan_3: {
      nguoi_nhan: nhap.nguoi_nhan,
      sdt_nguoi_nhan: nhap.sdt_nguoi_nhan,
      dia_chi_nhan: nhap.dia_chi_nhan,
      ghi_chu: nhap.ghi_chu,
    },
    phan_4: { so_qd: nhap.so_qd, ngay_qd: nhap.ngay_qd },
    diem_hoc_truc_tiep: nhap.diem_hoc_truc_tiep,
  };
}

// Issue #64 / ADR 0015 M5, S4–S6, X4, X5, U2, O3: Phần 3–4 hợp đồng, Nộp (kèm điều kiện chặn + bản chụp hồ
// sơ), Quản trị xem / Mở lại. Trường: đơn vị luôn lấy từ token. Mọi ghi đều khóa hop_dong FOR UPDATE.
// TODO(ADR 0015 T2): chặn lưu nháp / nộp khi đã quá hạn nộp của đợt (hạn riêng) — lát hạn nộp (#66).
@Injectable()
export class HopDongService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nhatKy: NhatKyService,
  ) {}

  async cuaTruong(
    user: AuthenticatedUser,
    dotId: string,
  ): Promise<HopDongPhanHoi> {
    return phanHoi(
      await this.taiNguCanh(this.prisma, dotId, this.donViCua(user)),
    );
  }

  /** X4: lưu nháp Phần 3–4 + cờ điểm học trực tiếp (thay toàn bộ; chỉ chặn sai định dạng). */
  async luuNhap(
    user: AuthenticatedUser,
    dotId: string,
    body: unknown,
  ): Promise<HopDongPhanHoi> {
    const donViId = this.donViCua(user);
    const { duLieu, loi: loiDauVao } = docDauVaoHopDong(body);
    const moi = chuanHoaNhapHopDong(duLieu);
    const loi = { ...kiemTraPhan3(moi).loi, ...loiDauVao };
    const fields = Object.entries(loi).map(([field, message]) => ({
      field,
      message: message as string,
    }));
    if (fields.length) {
      throw new ValidationException('Thông tin hợp đồng chưa hợp lệ', fields);
    }

    const thayDoi = await this.prisma.$transaction(async (tx) => {
      const nc = await this.khoaVaTai(tx, dotId, donViId);
      if (nc.hopDong.trang_thai_hop_dong === 'da_nop') {
        throw new ConflictAppException(DA_NOP_LIEN_HE);
      }
      const doi = truongHopDongThayDoi(nhapCua(nc.hopDong), moi);
      if (doi.length) {
        await tx.hop_dong_boi_duong.update({
          where: theoTruong(dotId, donViId),
          data: {
            ...moi,
            ngay_qd: chuoiSangNgay(moi.ngay_qd),
            updated_at: new Date(),
          },
        });
      }
      return doi;
    });
    if (thayDoi.length) {
      // Chỉ TÊN trường — người nhận, SĐT, địa chỉ là dữ liệu cá nhân, không ghi giá trị.
      await this.nhatKy.ghi({
        hanh_dong: 'luu_nhap_hop_dong',
        chi_tiet: {
          dot_trien_khai_id: dotId,
          don_vi_id: donViId,
          truong_thay_doi: thayDoi,
        },
      });
    }
    return this.cuaTruong(user, dotId);
  }

  /**
   * X4, S4–S6, M5: Nộp hợp đồng — tính lại mọi điều kiện từ DB dưới khóa; còn lý do chặn → 400 kèm danh sách
   * (fields[].field = mã lý do). Nộp được → chụp hồ sơ đơn vị + số người/suất/đơn giá/giá trị.
   */
  async nop(user: AuthenticatedUser, dotId: string): Promise<HopDongPhanHoi> {
    const donViId = this.donViCua(user);
    const ketQua = await this.prisma.$transaction(async (tx) => {
      const nc = await this.khoaVaTai(tx, dotId, donViId);
      const h = nc.hopDong;
      if (h.trang_thai_hop_dong === 'da_nop') {
        throw new ConflictAppException(DA_NOP_LIEN_HE);
      }
      const sl = soLieu(nc);
      const lyDo = lyDoCua(nc, sl.gia_tri);
      if (lyDo.length) {
        throw new ValidationException(
          'Chưa nộp được hợp đồng',
          lyDo.map((l) => ({ field: l.ma, message: l.thong_diep })),
        );
      }
      const luc = new Date();
      const banChup: BanChupHoSo = {
        ...nc.hoSo,
        stk_chuyen_khoan: stkChuyenKhoan(nc.hoSo.ma_qhns),
        don_vi_tiep_nhan: DON_VI_TIEP_NHAN,
        ngan_hang_tiep_nhan: NGAN_HANG_TIEP_NHAN,
        chup_luc: luc.toISOString(),
      };
      await tx.hop_dong_boi_duong.update({
        where: { id: h.id },
        data: {
          trang_thai_hop_dong: 'da_nop',
          nop_luc: luc,
          nop_boi: user.id,
          ban_chup_ho_so: banChup as unknown as Prisma.InputJsonObject,
          so_nguoi_luc_nop: sl.so_nguoi,
          tong_suat_luc_nop: sl.tong_suat,
          don_gia_luc_nop: sl.don_gia,
          gia_tri_luc_nop: BigInt(sl.gia_tri),
          ...thaoTacCuoi(user.id),
        },
      });
      return {
        hop_dong_id: h.id,
        so_nguoi: sl.so_nguoi,
        tong_suat: sl.tong_suat,
        gia_tri: sl.gia_tri,
      };
    });
    await this.nhatKy.ghi({
      hanh_dong: 'nop_hop_dong',
      chi_tiet: { dot_trien_khai_id: dotId, don_vi_id: donViId, ...ketQua },
    });
    return this.cuaTruong(user, dotId);
  }

  /** O3/O4: Quản trị xem hợp đồng 1 trường — đủ giá trị (che STK là việc của giao diện). */
  async quanTriXem(dotId: string, donViId: string): Promise<HopDongQuanTri> {
    const nc = await this.taiNguCanh(this.prisma, dotId, donViId);
    const h = nc.hopDong;
    return {
      ...phanHoi(nc),
      don_vi: { id: h.don_vi.id, ten: h.don_vi.ten_don_vi },
      nop_boi: h.nop_boi_user,
      ho_so_hien_tai: h.trang_thai_hop_dong === 'da_nop' ? null : nc.hoSo,
    };
  }

  /**
   * X5: Mở lại hợp đồng (lý do bắt buộc) → chưa nộp; xóa bản chụp + số liệu lúc nộp (Phần 3–4 nháp giữ nguyên).
   * Bản chụp cũ vào nhật ký mo_lai_hop_dong.
   */
  async moLai(
    adminId: string,
    dotId: string,
    donViId: string,
    lyDo: string,
  ): Promise<HopDongQuanTri> {
    const cu = await this.prisma.$transaction(async (tx) => {
      const nc = await this.khoaVaTai(tx, dotId, donViId);
      const h = nc.hopDong;
      if (h.trang_thai_hop_dong !== 'da_nop') {
        throw new ConflictAppException(CHUA_NOP);
      }
      await tx.hop_dong_boi_duong.update({
        where: { id: h.id },
        data: {
          trang_thai_hop_dong: 'chua_nop',
          nop_luc: null,
          nop_boi: null,
          ban_chup_ho_so: Prisma.DbNull,
          so_nguoi_luc_nop: null,
          tong_suat_luc_nop: null,
          don_gia_luc_nop: null,
          gia_tri_luc_nop: null,
          ...thaoTacCuoi(adminId),
        },
      });
      return { hop_dong_id: h.id, ban_chup_cu: banChupCu(h) };
    });
    await this.nhatKy.ghi({
      hanh_dong: 'mo_lai_hop_dong',
      chi_tiet: {
        dot_trien_khai_id: dotId,
        don_vi_id: donViId,
        hop_dong_id: cu.hop_dong_id,
        ly_do: lyDo,
        ban_chup_cu: cu.ban_chup_cu,
      },
    });
    return this.quanTriXem(dotId, donViId);
  }

  /** Khóa FOR UPDATE dòng hop_dong rồi đọc ngữ cảnh mới nhất trong cùng transaction. */
  private async khoaVaTai(tx: Tx, dotId: string, donViId: string) {
    await khoaTrangThaiHopDong(tx, dotId, donViId);
    return this.taiNguCanh(tx, dotId, donViId);
  }

  private async taiNguCanh(
    db: Tx | PrismaService,
    dotId: string,
    donViId: string,
  ): Promise<NguCanh> {
    const hopDong = await db.hop_dong_boi_duong.findUnique({
      where: theoTruong(dotId, donViId),
      include: KEM,
    });
    if (!hopDong) throw new NotFoundAppException(KHONG_THAY_HOP_DONG);
    const [dong, hoSo] = await Promise.all([
      db.danh_sach_tham_gia.findMany({
        where: { dot_trien_khai_id: dotId, don_vi_id: donViId },
        select: { ty_le_suat: true },
      }),
      db.ho_so_don_vi.findUnique({ where: { don_vi_id: donViId } }),
    ]);
    return {
      hopDong,
      dong: dong.map((d) => ({ ty_le_suat: Number(d.ty_le_suat) })),
      hoSo: hoSo ? layDuLieu(hoSo) : null,
    };
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
