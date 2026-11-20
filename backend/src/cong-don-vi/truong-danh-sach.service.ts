import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  chuong_trinh_boi_duong,
  danh_sach_tham_gia,
  giai_doan_tham_gia,
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
  GiaTriDeNghi,
  LoaiDeNghi,
  TrangThaiDanhSach,
  TrangThaiDeNghi,
  YKienTruong,
  giaTriTamTinh,
  kiemTraGiaTriDeNghi,
  kiemTraXacNhan,
  tongSuat,
  trangThaiSauYKien,
} from './quy-tac-hop-dong';
import { ngaySangChuoi, ngayVietNam } from './dot-trien-khai.service';
import {
  KHONG_THAY_DANH_SACH,
  Tx,
  khoaHopDong,
  saiLechCuaTruong,
  thaoTacCuoi,
} from './giao-dich-hop-dong';
import { GuiDeNghiDto } from './dto/truong-danh-sach.dto';

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

/** Issue #62 / X2: bản chụp dòng lúc trường gửi đề nghị sửa/bớt (còn lại dù dòng bị xóa). */
export interface BanChupDongDeNghi {
  ho_ten: string;
  ngay_sinh: string | null;
  gioi_tinh: string | null;
  lop: string | null;
  giai_doan: giai_doan_tham_gia;
  ty_le_suat: number;
}

/** Issue #62 / X2: đề nghị của trường như trường thấy. */
export interface DeNghiCuaTruong {
  id: string;
  loai: LoaiDeNghi;
  dong_id: string | null;
  gia_tri: GiaTriDeNghi;
  gia_tri_cu: BanChupDongDeNghi | null;
  ly_do: string | null;
  trang_thai: TrangThaiDeNghi;
  ly_do_tu_choi: string | null;
  gui_luc: string;
  xu_ly_luc: string | null;
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
  /** Issue #62: đề nghị của trường trong đợt, mới nhất trước. */
  de_nghi: DeNghiCuaTruong[];
  so_de_nghi_cho: number;
}

const KHONG_THAY_DONG = 'Không tìm thấy dòng danh sách';
export const DONG_DA_CO_DE_NGHI = 'Dòng này đã có đề nghị đang chờ HCMUE xử lý';
const DONG_DANG_CHO_DE_NGHI = 'Dòng đang có đề nghị chờ HCMUE xử lý';

const CHON_DOT = {
  id: true,
  ten: true,
  chuong_trinh: true,
  han_nop: true,
  don_gia: true,
} as const;

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

/** Bản chụp dòng cho gia_tri_cu của đề nghị sửa/bớt. */
export function banChupDongDeNghi(d: danh_sach_tham_gia): BanChupDongDeNghi {
  return {
    ho_ten: d.ho_ten,
    ngay_sinh: ngaySangChuoi(d.ngay_sinh),
    gioi_tinh: d.gioi_tinh,
    lop: d.lop,
    giai_doan: d.giai_doan,
    ty_le_suat: Number(d.ty_le_suat),
  };
}

const theoTruong = (dotId: string, donViId: string) => ({
  dot_trien_khai_id_don_vi_id: { dot_trien_khai_id: dotId, don_vi_id: donViId },
});

/** Va chạm UNIQUE uq_de_nghi_cho_theo_dong (gửi đồng thời) → 409 như kiểm tra trước. */
function trungDeNghiCho(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    throw new ConflictAppException(DONG_DA_CO_DE_NGHI);
  }
  throw e;
}

// Issue #60 / ADR 0015 U1, X6, S5, O3: trường xem đợt + danh sách tham gia của CHÍNH MÌNH.
// Issue #61 / X1, X2: trường Đồng ý / Không đồng ý từng dòng và Xác nhận danh sách.
// Issue #62 / X2: trường gửi đề nghị sửa/thêm/bớt người — không sửa trực tiếp dữ liệu nào.
// Phạm vi luôn lấy từ don_vi_id trong token, không nhận tham số đơn vị từ client.
// TODO(ADR 0015 X5): chặn ý kiến/xác nhận/gửi đề nghị khi trường đã nộp hợp đồng — lát hợp đồng.
// TODO(ADR 0015 T2): chặn ý kiến/xác nhận/gửi đề nghị khi đã quá hạn nộp của đợt — lát hạn nộp.
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

    const [ds, deNghi] = await Promise.all([
      this.prisma.danh_sach_tham_gia.findMany({
        where: { dot_trien_khai_id: dotId, don_vi_id: donViId },
        orderBy: [{ ho_ten: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.de_nghi_sua_danh_sach.findMany({
        where: { dot_trien_khai_id: dotId, don_vi_id: donViId },
        orderBy: [{ gui_luc: 'desc' }, { id: 'asc' }],
      }),
    ]);
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
    const so_de_nghi_cho = deNghi.filter((d) => d.trang_thai === 'cho').length;
    const kiemTra = kiemTraXacNhan(
      dong.map((d) => d.y_kien_truong),
      so_de_nghi_cho,
    );
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
      de_nghi: deNghi.map((d) => ({
        id: d.id,
        loai: d.loai,
        dong_id: d.dong_id,
        gia_tri: d.gia_tri as GiaTriDeNghi,
        gia_tri_cu: d.gia_tri_cu as unknown as BanChupDongDeNghi | null,
        ly_do: d.ly_do,
        trang_thai: d.trang_thai,
        ly_do_tu_choi: d.ly_do_tu_choi,
        gui_luc: d.gui_luc.toISOString(),
        xu_ly_luc: d.xu_ly_luc ? d.xu_ly_luc.toISOString() : null,
      })),
      so_de_nghi_cho,
    };
  }

  /**
   * X2: Đồng ý / Không đồng ý / bỏ ý kiến (null) 1 dòng của trường; tính lại trạng thái (X1).
   * Dòng đang có đề nghị chờ → 409 (ý kiến "Không đồng ý" của dòng gắn với đề nghị tới khi HCMUE xử lý).
   */
  async datYKien(
    user: AuthenticatedUser,
    dotId: string,
    dongId: string,
    yKien: YKienTruong | null,
  ): Promise<DanhSachCuaTruong> {
    const donViId = this.donViCua(user);
    // undefined = không đổi gì (gửi lại đúng ý kiến đang có) → không ghi, không nhật ký.
    const truoc = await this.prisma.$transaction(async (tx) => {
      const hienTai = await khoaHopDong(tx, dotId, donViId);
      const dong = await tx.danh_sach_tham_gia.findFirst({
        where: { id: dongId, dot_trien_khai_id: dotId, don_vi_id: donViId },
        select: { y_kien_truong: true },
      });
      if (!dong) throw new NotFoundAppException(KHONG_THAY_DONG);
      const dangCho = await tx.de_nghi_sua_danh_sach.count({
        where: { dong_id: dongId, trang_thai: 'cho' },
      });
      if (dangCho > 0) throw new ConflictAppException(DONG_DANG_CHO_DE_NGHI);
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

  /** X2: Đồng ý mọi dòng CHƯA có ý kiến; dòng Không đồng ý (kể cả dòng có đề nghị chờ) giữ nguyên. */
  async dongYTatCa(
    user: AuthenticatedUser,
    dotId: string,
  ): Promise<DanhSachCuaTruong> {
    const donViId = this.donViCua(user);
    const soDong = await this.prisma.$transaction(async (tx) => {
      const hienTai = await khoaHopDong(tx, dotId, donViId);
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
   * X1/X2: Xác nhận danh sách — chỉ khi có ≥ 1 dòng, mọi dòng Đồng ý và không còn đề nghị chờ; không thì 400
   * VALIDATION_ERROR kèm lý do (cùng kiểu chặn nghiệp vụ "Đợt NLS lấy danh sách từ khóa"). Đã xác nhận → trả nguyên.
   */
  async xacNhan(
    user: AuthenticatedUser,
    dotId: string,
  ): Promise<DanhSachCuaTruong> {
    const donViId = this.donViCua(user);
    const ketQua = await this.prisma.$transaction(async (tx) => {
      const hienTai = await khoaHopDong(tx, dotId, donViId);
      const [ds, soDeNghiCho] = await Promise.all([
        tx.danh_sach_tham_gia.findMany({
          where: { dot_trien_khai_id: dotId, don_vi_id: donViId },
          select: { y_kien_truong: true, ty_le_suat: true },
        }),
        tx.de_nghi_sua_danh_sach.count({
          where: {
            dot_trien_khai_id: dotId,
            don_vi_id: donViId,
            trang_thai: 'cho',
          },
        }),
      ]);
      const kiemTra = kiemTraXacNhan(
        ds.map((d) => d.y_kien_truong as YKienTruong | null),
        soDeNghiCho,
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
   * Issue #62 / X2: trường gửi đề nghị sửa / thêm / bớt người. Sửa/bớt → dòng thành Không đồng ý (gắn với
   * đề nghị tới khi HCMUE xử lý), mỗi dòng tối đa 1 đề nghị chờ (409). Trạng thái → Báo sai lệch.
   */
  async guiDeNghi(
    user: AuthenticatedUser,
    dotId: string,
    dto: GuiDeNghiDto,
  ): Promise<DanhSachCuaTruong> {
    const donViId = this.donViCua(user);
    const dongId = this.kiemTraLoaiDeNghi(dto);
    const deNghi = await this.prisma
      .$transaction(async (tx) => {
        const hienTai = await khoaHopDong(tx, dotId, donViId);
        let dong: danh_sach_tham_gia | null = null;
        if (dongId) {
          dong = await tx.danh_sach_tham_gia.findFirst({
            where: { id: dongId, dot_trien_khai_id: dotId, don_vi_id: donViId },
          });
          if (!dong) throw new NotFoundAppException(KHONG_THAY_DONG);
          const dangCho = await tx.de_nghi_sua_danh_sach.count({
            where: { dong_id: dongId, trang_thai: 'cho' },
          });
          if (dangCho > 0) throw new ConflictAppException(DONG_DA_CO_DE_NGHI);
        }
        const banChup = dong ? banChupDongDeNghi(dong) : null;
        const kq = kiemTraGiaTriDeNghi(
          dto.loai,
          dto.gia_tri,
          banChup ?? undefined,
        );
        if ('lyDo' in kq) {
          throw new ValidationException(kq.lyDo, [
            { field: 'gia_tri', message: kq.lyDo },
          ]);
        }
        const moi = await tx.de_nghi_sua_danh_sach.create({
          data: {
            dot_trien_khai_id: dotId,
            don_vi_id: donViId,
            dong_id: dongId,
            loai: dto.loai,
            gia_tri: kq.giaTri as Prisma.InputJsonObject,
            ...(banChup
              ? { gia_tri_cu: banChup as unknown as Prisma.InputJsonObject }
              : {}),
            ly_do: dto.ly_do ?? null,
            gui_boi: user.id,
          },
        });
        if (dongId) {
          await tx.danh_sach_tham_gia.update({
            where: { id: dongId },
            data: { y_kien_truong: 'khong_dong_y', updated_at: new Date() },
          });
        }
        await this.capNhatTrangThai(tx, dotId, donViId, hienTai, user.id);
        return moi;
      })
      .catch(trungDeNghiCho);
    // Không ghi giá trị đề nghị / họ tên / ngày sinh vào nhật ký (PII).
    await this.nhatKy.ghi({
      hanh_dong: 'gui_de_nghi_sua_danh_sach',
      chi_tiet: {
        dot_trien_khai_id: dotId,
        don_vi_id: donViId,
        de_nghi_id: deNghi.id,
        loai: deNghi.loai,
        dong_id: deNghi.dong_id,
      },
    });
    return this.danhSachCuaTruong(user, dotId);
  }

  /** Quy tắc theo loại (không cần DB): trả dong_id (null khi thêm người). */
  private kiemTraLoaiDeNghi(dto: GuiDeNghiDto): string | null {
    if (dto.loai === 'them') {
      if (dto.dong_id) {
        const message = 'Đề nghị thêm người không gắn với dòng có sẵn';
        throw new ValidationException(message, [{ field: 'dong_id', message }]);
      }
      return null;
    }
    if (!dto.dong_id) {
      const message = 'Chọn dòng cần đề nghị';
      throw new ValidationException(message, [{ field: 'dong_id', message }]);
    }
    if (dto.loai === 'bot' && !dto.ly_do) {
      const message = 'Nhập lý do bớt người';
      throw new ValidationException(message, [{ field: 'ly_do', message }]);
    }
    return dto.dong_id;
  }

  /** Sau khi đổi ý kiến / gửi đề nghị: tính lại trạng thái (X1, kể cả đề nghị chờ) + người/lúc thao tác cuối. */
  private async capNhatTrangThai(
    tx: Tx,
    dotId: string,
    donViId: string,
    hienTai: TrangThaiDanhSach,
    userId: string,
  ) {
    const { yKiens, soDeNghiCho } = await saiLechCuaTruong(tx, dotId, donViId);
    const moi = trangThaiSauYKien(yKiens, hienTai, soDeNghiCho);
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
