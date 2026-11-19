import { Injectable } from '@nestjs/common';
import type {
  Prisma,
  chuong_trinh_boi_duong,
  giai_doan_tham_gia,
  trang_thai_danh_sach_truong,
  trang_thai_hop_dong,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NhatKyService } from '../nhat-ky/nhat-ky.service';
import {
  ForbiddenAppException,
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  TrangThaiDanhSach,
  YKienTruong,
  giaTriTamTinh,
  kiemTraXacNhan,
  tongSuat,
  trangThaiSauYKien,
} from './quy-tac-hop-dong';
import { ngaySangChuoi, ngayVietNam } from './dot-trien-khai.service';

export interface DotCuaTruong {
  id: string;
  ten: string;
  chuong_trinh: chuong_trinh_boi_duong;
  han_nop: string;
  han_nop_ngay: string;
}

export interface TheDotTruong {
  dot: DotCuaTruong;
  so_nguoi: number;
  tong_suat: number;
  don_gia: number | null;
  gia_tri_tam_tinh: number | null;
  trang_thai_danh_sach: trang_thai_danh_sach_truong;
  trang_thai_hop_dong: trang_thai_hop_dong;
}

/** ADR 0015 X6: các cột trường thấy trên mỗi dòng. */
export interface DongDanhSachTruong {
  id: string;
  ho_ten: string;
  ngay_sinh: string | null;
  gioi_tinh: string | null;
  lop: string | null;
  giai_doan: giai_doan_tham_gia;
  ty_le_suat: number;
  ghi_chu: string | null;
  /** Issue #61 / X2: null = chưa có ý kiến. */
  y_kien_truong: YKienTruong | null;
}

export interface DanhSachCuaTruong {
  dot: DotCuaTruong;
  dong: DongDanhSachTruong[];
  tong_suat: number;
  don_gia: number | null;
  gia_tri_tam_tinh: number | null;
  trang_thai_danh_sach: trang_thai_danh_sach_truong;
  /** X2: nút "Xác nhận danh sách" bật được không; không → lý do (tiếng Việt). */
  co_the_xac_nhan: boolean;
  ly_do_khong_xac_nhan: string | null;
}

type Tx = Prisma.TransactionClient;

const KHONG_THAY_DANH_SACH = 'Không tìm thấy danh sách của trường cho đợt này';
const KHONG_THAY_DONG = 'Không tìm thấy dòng danh sách';

const CHON_DOT = {
  id: true,
  ten: true,
  chuong_trinh: true,
  han_nop: true,
  don_gia: true,
} as const;

/** X1: người + thời điểm thao tác gần nhất trên danh sách của 1 trường (trường hoặc Quản trị). */
export function thaoTacCuoi(userId: string) {
  const luc = new Date();
  return { thao_tac_cuoi_boi: userId, thao_tac_cuoi_luc: luc, updated_at: luc };
}

function toDot(d: {
  id: string;
  ten: string;
  chuong_trinh: chuong_trinh_boi_duong;
  han_nop: Date;
}): DotCuaTruong {
  return {
    id: d.id,
    ten: d.ten,
    chuong_trinh: d.chuong_trinh,
    han_nop: d.han_nop.toISOString(),
    han_nop_ngay: ngayVietNam(d.han_nop),
  };
}

const theoTruong = (dotId: string, donViId: string) => ({
  dot_trien_khai_id_don_vi_id: { dot_trien_khai_id: dotId, don_vi_id: donViId },
});

// Issue #60 / ADR 0015 U1, X6, S5, O3: trường xem đợt + danh sách tham gia của CHÍNH MÌNH.
// Issue #61 / X1, X2: trường Đồng ý / Không đồng ý từng dòng và Xác nhận danh sách.
// Phạm vi luôn lấy từ don_vi_id trong token, không nhận tham số đơn vị từ client.
// TODO(ADR 0015 X5): chặn ý kiến/xác nhận khi trường đã nộp hợp đồng — lát hợp đồng.
// TODO(ADR 0015 T2): chặn ý kiến/xác nhận khi đã quá hạn nộp của đợt — lát hạn nộp.
@Injectable()
export class TruongDanhSachService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nhatKy: NhatKyService,
  ) {}

  /** Thẻ đợt của trường: mọi đợt có dòng hop_dong_boi_duong của trường, hạn nộp sớm trước. */
  async dotCuaTruong(user: AuthenticatedUser): Promise<TheDotTruong[]> {
    const donViId = this.donViCua(user);
    const hopDong = await this.prisma.hop_dong_boi_duong.findMany({
      where: { don_vi_id: donViId },
      include: { dot_trien_khai: { select: CHON_DOT } },
    });
    if (hopDong.length === 0) return [];

    const suatTheoDot = await this.prisma.danh_sach_tham_gia.findMany({
      where: {
        don_vi_id: donViId,
        dot_trien_khai_id: { in: hopDong.map((h) => h.dot_trien_khai_id) },
      },
      select: { dot_trien_khai_id: true, ty_le_suat: true },
    });
    const nhom = new Map<string, { ty_le_suat: number }[]>();
    for (const d of suatTheoDot) {
      const ds = nhom.get(d.dot_trien_khai_id) ?? [];
      ds.push({ ty_le_suat: Number(d.ty_le_suat) });
      nhom.set(d.dot_trien_khai_id, ds);
    }

    return hopDong
      .map((h) => {
        const dong = nhom.get(h.dot_trien_khai_id) ?? [];
        const tong_suat = tongSuat(dong);
        const don_gia = h.dot_trien_khai.don_gia;
        return {
          dot: toDot(h.dot_trien_khai),
          so_nguoi: dong.length,
          tong_suat,
          don_gia,
          gia_tri_tam_tinh: giaTriTamTinh(tong_suat, don_gia),
          trang_thai_danh_sach: h.trang_thai_danh_sach,
          trang_thai_hop_dong: h.trang_thai_hop_dong,
        };
      })
      .sort(
        (a, b) =>
          a.dot.han_nop.localeCompare(b.dot.han_nop) ||
          a.dot.id.localeCompare(b.dot.id),
      );
  }

  /** Danh sách của trường trong 1 đợt. Không có dòng hợp đồng → 404 (không lộ đợt/danh sách trường khác). */
  async danhSachCuaTruong(
    user: AuthenticatedUser,
    dotId: string,
  ): Promise<DanhSachCuaTruong> {
    const donViId = this.donViCua(user);
    const hopDong = await this.prisma.hop_dong_boi_duong.findUnique({
      where: theoTruong(dotId, donViId),
      include: { dot_trien_khai: { select: CHON_DOT } },
    });
    if (!hopDong) throw new NotFoundAppException(KHONG_THAY_DANH_SACH);

    const ds = await this.prisma.danh_sach_tham_gia.findMany({
      where: { dot_trien_khai_id: dotId, don_vi_id: donViId },
      orderBy: [{ ho_ten: 'asc' }, { id: 'asc' }],
    });
    const dong: DongDanhSachTruong[] = ds.map((d) => ({
      id: d.id,
      ho_ten: d.ho_ten,
      ngay_sinh: ngaySangChuoi(d.ngay_sinh),
      gioi_tinh: d.gioi_tinh,
      lop: d.lop,
      giai_doan: d.giai_doan,
      ty_le_suat: Number(d.ty_le_suat),
      ghi_chu: d.ghi_chu,
      y_kien_truong: d.y_kien_truong as YKienTruong | null,
    }));
    const tong_suat = tongSuat(dong);
    const don_gia = hopDong.dot_trien_khai.don_gia;
    // TODO(#62): truyền số đề nghị sửa đang chờ của trường.
    const kiemTra = kiemTraXacNhan(dong.map((d) => d.y_kien_truong));
    return {
      dot: toDot(hopDong.dot_trien_khai),
      dong,
      tong_suat,
      don_gia,
      gia_tri_tam_tinh: giaTriTamTinh(tong_suat, don_gia),
      trang_thai_danh_sach: hopDong.trang_thai_danh_sach,
      co_the_xac_nhan: kiemTra.hopLe,
      // strictNullChecks tắt → thu hẹp union bằng 'in', không bằng hopLe.
      ly_do_khong_xac_nhan: 'lyDo' in kiemTra ? kiemTra.lyDo : null,
    };
  }

  /** X2: Đồng ý / Không đồng ý / bỏ ý kiến (null) 1 dòng của trường; tính lại trạng thái (X1). */
  async datYKien(
    user: AuthenticatedUser,
    dotId: string,
    dongId: string,
    yKien: YKienTruong | null,
  ): Promise<DanhSachCuaTruong> {
    const donViId = this.donViCua(user);
    // undefined = không đổi gì (gửi lại đúng ý kiến đang có) → không ghi, không nhật ký.
    const truoc = await this.prisma.$transaction(async (tx) => {
      const hienTai = await this.khoaHopDong(tx, dotId, donViId);
      const dong = await tx.danh_sach_tham_gia.findFirst({
        where: { id: dongId, dot_trien_khai_id: dotId, don_vi_id: donViId },
        select: { y_kien_truong: true },
      });
      if (!dong) throw new NotFoundAppException(KHONG_THAY_DONG);
      if (dong.y_kien_truong === yKien) return undefined;
      await tx.danh_sach_tham_gia.update({
        where: { id: dongId },
        data: { y_kien_truong: yKien, updated_at: new Date() },
      });
      await this.capNhatTrangThai(tx, dotId, donViId, hienTai, user.id);
      return dong.y_kien_truong;
    });
    if (truoc !== undefined) {
      await this.nhatKy.ghi({
        hanh_dong: 'y_kien_dong_danh_sach',
        chi_tiet: {
          dot_trien_khai_id: dotId,
          don_vi_id: donViId,
          dong_id: dongId,
          truoc,
          sau: yKien,
        },
      });
    }
    return this.danhSachCuaTruong(user, dotId);
  }

  /** X2: Đồng ý mọi dòng CHƯA có ý kiến; dòng Không đồng ý giữ nguyên (trường đổi từng dòng). */
  async dongYTatCa(
    user: AuthenticatedUser,
    dotId: string,
  ): Promise<DanhSachCuaTruong> {
    const donViId = this.donViCua(user);
    const soDong = await this.prisma.$transaction(async (tx) => {
      const hienTai = await this.khoaHopDong(tx, dotId, donViId);
      const { count } = await tx.danh_sach_tham_gia.updateMany({
        where: {
          dot_trien_khai_id: dotId,
          don_vi_id: donViId,
          y_kien_truong: null,
        },
        data: { y_kien_truong: 'dong_y', updated_at: new Date() },
      });
      if (count > 0) {
        await this.capNhatTrangThai(tx, dotId, donViId, hienTai, user.id);
      }
      return count;
    });
    if (soDong > 0) {
      await this.nhatKy.ghi({
        hanh_dong: 'dong_y_tat_ca_danh_sach',
        chi_tiet: {
          dot_trien_khai_id: dotId,
          don_vi_id: donViId,
          so_dong: soDong,
        },
      });
    }
    return this.danhSachCuaTruong(user, dotId);
  }

  /**
   * X1/X2: Xác nhận danh sách — chỉ khi có ≥ 1 dòng và mọi dòng Đồng ý; không thì 400 VALIDATION_ERROR
   * kèm lý do (cùng kiểu chặn nghiệp vụ "Đợt NLS lấy danh sách từ khóa" trong module). Đã xác nhận → trả nguyên.
   */
  async xacNhan(
    user: AuthenticatedUser,
    dotId: string,
  ): Promise<DanhSachCuaTruong> {
    const donViId = this.donViCua(user);
    const ketQua = await this.prisma.$transaction(async (tx) => {
      const hienTai = await this.khoaHopDong(tx, dotId, donViId);
      const ds = await tx.danh_sach_tham_gia.findMany({
        where: { dot_trien_khai_id: dotId, don_vi_id: donViId },
        select: { y_kien_truong: true, ty_le_suat: true },
      });
      // TODO(#62): truyền số đề nghị sửa đang chờ của trường.
      const kiemTra = kiemTraXacNhan(
        ds.map((d) => d.y_kien_truong as YKienTruong | null),
      );
      if ('lyDo' in kiemTra) throw new ValidationException(kiemTra.lyDo);
      if (hienTai === 'da_xac_nhan') return null;
      await tx.hop_dong_boi_duong.update({
        where: theoTruong(dotId, donViId),
        data: { trang_thai_danh_sach: 'da_xac_nhan', ...thaoTacCuoi(user.id) },
      });
      return {
        so_dong: ds.length,
        tong_suat: tongSuat(
          ds.map((d) => ({ ty_le_suat: Number(d.ty_le_suat) })),
        ),
      };
    });
    if (ketQua) {
      await this.nhatKy.ghi({
        hanh_dong: 'xac_nhan_danh_sach',
        chi_tiet: { dot_trien_khai_id: dotId, don_vi_id: donViId, ...ketQua },
      });
    }
    return this.danhSachCuaTruong(user, dotId);
  }

  /**
   * Khóa dòng hop_dong_boi_duong của (đợt, trường) tới hết transaction — thao tác đồng thời của cùng
   * trường chạy lần lượt, trạng thái tính trên dữ liệu mới nhất. Không có → 404.
   */
  private async khoaHopDong(
    tx: Tx,
    dotId: string,
    donViId: string,
  ): Promise<TrangThaiDanhSach> {
    const rows = await tx.$queryRaw<{ trang_thai: TrangThaiDanhSach }[]>`
      SELECT trang_thai_danh_sach::text AS trang_thai FROM hop_dong_boi_duong
      WHERE dot_trien_khai_id = ${dotId}::uuid AND don_vi_id = ${donViId}::uuid
      FOR UPDATE`;
    if (rows.length === 0) throw new NotFoundAppException(KHONG_THAY_DANH_SACH);
    return rows[0].trang_thai;
  }

  /** Sau khi đổi ý kiến: tính lại trạng thái (X1) + người/lúc thao tác cuối. */
  private async capNhatTrangThai(
    tx: Tx,
    dotId: string,
    donViId: string,
    hienTai: TrangThaiDanhSach,
    userId: string,
  ) {
    const ds = await tx.danh_sach_tham_gia.findMany({
      where: { dot_trien_khai_id: dotId, don_vi_id: donViId },
      select: { y_kien_truong: true },
    });
    const moi = trangThaiSauYKien(
      ds.map((d) => d.y_kien_truong as YKienTruong | null),
      hienTai,
    );
    await tx.hop_dong_boi_duong.update({
      where: theoTruong(dotId, donViId),
      data: { trang_thai_danh_sach: moi, ...thaoTacCuoi(userId) },
    });
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
