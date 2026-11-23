import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { chuong_trinh_boi_duong } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NhatKyService } from '../nhat-ky/nhat-ky.service';
import { ScopeService } from '../auth/scope/scope.service';
import {
  ConflictAppException,
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import {
  SuaDotTrienKhaiDto,
  TaoDotTrienKhaiDto,
} from './dto/dot-trien-khai.dto';
import { hanNopTuNgay, ngayVietNam } from './han-nop';

/** Issue #68 / ADR 0015 M1: khóa NLS gắn vào đợt (ngày dạng 'YYYY-MM-DD'). */
export interface KhoaCuaDot {
  id: string;
  ma_khoa: string;
  ten_khoa: string;
  thoi_gian_bat_dau: string;
  thoi_gian_ket_thuc: string;
}

/** Khóa trong phạm vi Sở của đợt cho ô chọn — kèm đợt đang gắn (nếu có). */
export interface KhoaCoTheGan extends KhoaCuaDot {
  trang_thai: string;
  dot_trien_khai_id: string | null;
  dot_trien_khai_ten: string | null;
}

export interface DotTrienKhai {
  id: string;
  chuong_trinh: chuong_trinh_boi_duong;
  ten: string;
  don_gia: number | null;
  ngay_qd_tu: string | null;
  ngay_qd_den: string | null;
  han_nop: string;
  han_nop_ngay: string;
  so_gddt: { id: string; ten_don_vi: string };
  /** Issue #68: khóa NLS đã gắn (HSG: luôn rỗng). */
  khoa: KhoaCuaDot[];
  created_at: Date;
  updated_at: Date;
}

const CHON_KHOA = {
  id: true,
  ma_khoa: true,
  ten_khoa: true,
  thoi_gian_bat_dau: true,
  thoi_gian_ket_thuc: true,
} satisfies Prisma.khoa_boi_duongSelect;

const BAO_GOM = {
  so_gddt: { select: { id: true, ten_don_vi: true } },
  khoa_boi_duong: {
    select: CHON_KHOA,
    orderBy: [{ thoi_gian_bat_dau: 'asc' }, { ma_khoa: 'asc' }],
  },
} satisfies Prisma.dot_trien_khaiInclude;

type KhoaChon = Prisma.khoa_boi_duongGetPayload<{ select: typeof CHON_KHOA }>;

function toKhoaCuaDot(k: KhoaChon): KhoaCuaDot {
  return {
    id: k.id,
    ma_khoa: k.ma_khoa,
    ten_khoa: k.ten_khoa,
    thoi_gian_bat_dau: ngaySangChuoi(k.thoi_gian_bat_dau) as string,
    thoi_gian_ket_thuc: ngaySangChuoi(k.thoi_gian_ket_thuc) as string,
  };
}

const LOI_DOT_HSG_GAN_KHOA = 'Đợt HSG không gắn khóa NLS';

type DongDot = Prisma.dot_trien_khaiGetPayload<{ include: typeof BAO_GOM }>;

// Issue #66: hanNopTuNgay / ngayVietNam chuyển sang quy tắc thuần han-nop.ts — giữ export cũ cho nơi đang dùng.
export { hanNopTuNgay, ngayVietNam };

/** Cột DATE: Prisma đọc/ghi Date lúc 00:00Z. */
export function chuoiSangNgay(ngay: string | null): Date | null {
  return ngay === null ? null : new Date(`${ngay}T00:00:00.000Z`);
}

export function ngaySangChuoi(ngay: Date | null): string | null {
  return ngay === null ? null : ngay.toISOString().slice(0, 10);
}

/** ADR 0015 S6: khoảng ngày QĐ — cùng trống hoặc cùng có, đến ≥ từ (tính cả 2 đầu). */
export function kiemTraKhoangQd(tu: string | null, den: string | null): void {
  if (tu === null && den === null) return;
  if (tu === null || den === null) {
    const field = tu === null ? 'ngay_qd_tu' : 'ngay_qd_den';
    const message = 'Phải nhập cả ngày QĐ từ và đến, hoặc để trống cả hai ngày';
    throw new ValidationException(message, [{ field, message }]);
  }
  // Cùng dạng YYYY-MM-DD nên so chuỗi = so ngày.
  if (den < tu) {
    const message = 'Ngày QĐ đến phải bằng hoặc sau ngày QĐ từ';
    throw new ValidationException(message, [{ field: 'ngay_qd_den', message }]);
  }
}

// Các trường so sánh khi ghi nhật ký sửa (chỉ ghi trường đã đổi).
const TRUONG_NHAT_KY = [
  'ten',
  'don_gia',
  'ngay_qd_tu',
  'ngay_qd_den',
  'han_nop',
  'so_gddt_id',
] as const;
type TruongNhatKy = (typeof TRUONG_NHAT_KY)[number];

function giaTriNhatKy(d: DongDot): Record<TruongNhatKy, unknown> {
  return {
    ten: d.ten,
    don_gia: d.don_gia,
    ngay_qd_tu: ngaySangChuoi(d.ngay_qd_tu),
    ngay_qd_den: ngaySangChuoi(d.ngay_qd_den),
    han_nop: d.han_nop.toISOString(),
    so_gddt_id: d.so_gddt_id,
  };
}

// Issue #56 / ADR 0015: Quản trị tạo/sửa đợt triển khai. Chưa có xóa.
@Injectable()
export class DotTrienKhaiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nhatKy: NhatKyService,
    private readonly scope: ScopeService,
  ) {}

  async layDanhSach(): Promise<DotTrienKhai[]> {
    const ds = await this.prisma.dot_trien_khai.findMany({
      include: BAO_GOM,
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    });
    return ds.map((d) => this.toDto(d));
  }

  async layMot(id: string): Promise<DotTrienKhai> {
    return this.toDto(await this.layHoacLoi(id));
  }

  async tao(dto: TaoDotTrienKhaiDto, callerId: string): Promise<DotTrienKhai> {
    const tu = dto.ngay_qd_tu ?? null;
    const den = dto.ngay_qd_den ?? null;
    kiemTraKhoangQd(tu, den);
    await this.kiemTraSo(dto.so_gddt_id);
    const dot = await this.prisma.dot_trien_khai.create({
      data: {
        chuong_trinh: dto.chuong_trinh,
        ten: dto.ten,
        don_gia: dto.don_gia ?? null,
        ngay_qd_tu: chuoiSangNgay(tu),
        ngay_qd_den: chuoiSangNgay(den),
        han_nop: hanNopTuNgay(dto.han_nop_ngay),
        so_gddt_id: dto.so_gddt_id,
        created_by: callerId,
      },
      include: BAO_GOM,
    });
    await this.nhatKy.ghi({
      hanh_dong: 'tao_dot_trien_khai',
      chi_tiet: {
        dot_trien_khai_id: dot.id,
        chuong_trinh: dot.chuong_trinh,
        ten: dot.ten,
      },
    });
    return this.toDto(dot);
  }

  async sua(id: string, dto: SuaDotTrienKhaiDto): Promise<DotTrienKhai> {
    const cu = await this.layHoacLoi(id);
    // Kiểm khoảng QĐ trên trạng thái gộp (giá trị gửi lên, thiếu thì lấy giá trị đang lưu).
    const tu =
      dto.ngay_qd_tu !== undefined
        ? dto.ngay_qd_tu
        : ngaySangChuoi(cu.ngay_qd_tu);
    const den =
      dto.ngay_qd_den !== undefined
        ? dto.ngay_qd_den
        : ngaySangChuoi(cu.ngay_qd_den);
    kiemTraKhoangQd(tu, den);
    if (dto.so_gddt_id !== undefined && dto.so_gddt_id !== cu.so_gddt_id) {
      await this.kiemTraSo(dto.so_gddt_id);
    }

    const moi = await this.prisma.dot_trien_khai.update({
      where: { id },
      data: {
        ten: dto.ten,
        don_gia: dto.don_gia,
        ngay_qd_tu: chuoiSangNgay(tu),
        ngay_qd_den: chuoiSangNgay(den),
        han_nop: dto.han_nop_ngay ? hanNopTuNgay(dto.han_nop_ngay) : undefined,
        so_gddt_id: dto.so_gddt_id,
        updated_at: new Date(),
      },
      include: BAO_GOM,
    });
    await this.ghiNhatKySua(cu, moi);
    return this.toDto(moi);
  }

  /** Issue #68: khóa do Sở của đợt hoặc đơn vị trực thuộc đặt hàng, mới bắt đầu trước. */
  async khoaCoTheGan(id: string): Promise<KhoaCoTheGan[]> {
    const dot = await this.layHoacLoi(id);
    if (dot.chuong_trinh !== 'nls') {
      throw new ValidationException(LOI_DOT_HSG_GAN_KHOA);
    }
    const phamVi = await this.scope.collectDescendantIds(dot.so_gddt_id);
    const ds = await this.prisma.khoa_boi_duong.findMany({
      where: { don_vi_dat_hang_id: { in: phamVi } },
      select: {
        ...CHON_KHOA,
        trang_thai: true,
        dot_trien_khai: { select: { id: true, ten: true } },
      },
      orderBy: [{ thoi_gian_bat_dau: 'desc' }, { ma_khoa: 'asc' }],
    });
    return ds.map((k) => ({
      ...toKhoaCuaDot(k),
      trang_thai: k.trang_thai,
      dot_trien_khai_id: k.dot_trien_khai?.id ?? null,
      dot_trien_khai_ten: k.dot_trien_khai?.ten ?? null,
    }));
  }

  /**
   * Issue #68 / ADR 0015 M1: thay trọn tập khóa NLS của đợt. Khóa phải do Sở của đợt (hoặc đơn vị trực thuộc)
   * đặt hàng; khóa đang gắn đợt khác → 409 (gỡ ở đợt đó trước). Khóa bị bỏ → dot_trien_khai_id = NULL; danh
   * sách đã chụp không đổi (bản chụp, không đọc sống).
   */
  async ganKhoa(id: string, khoaIds: string[]): Promise<DotTrienKhai> {
    const dot = await this.layHoacLoi(id);
    if (dot.chuong_trinh !== 'nls') {
      throw new ValidationException(LOI_DOT_HSG_GAN_KHOA, [
        { field: 'khoa_ids', message: LOI_DOT_HSG_GAN_KHOA },
      ]);
    }
    const ids = [...new Set(khoaIds)];
    await this.kiemTraKhoaTrongPhamVi(dot.so_gddt_id, ids);

    const { truoc, sau } = await this.prisma.$transaction(async (tx) => {
      const cu = await tx.khoa_boi_duong.findMany({
        where: { dot_trien_khai_id: dot.id },
        select: { id: true },
      });
      const { count } = await tx.khoa_boi_duong.updateMany({
        where: {
          id: { in: ids },
          OR: [{ dot_trien_khai_id: null }, { dot_trien_khai_id: dot.id }],
        },
        data: { dot_trien_khai_id: dot.id },
      });
      if (count < ids.length) await this.chanKhoaDotKhac(tx, dot.id, ids);
      await tx.khoa_boi_duong.updateMany({
        where: { dot_trien_khai_id: dot.id, id: { notIn: ids } },
        data: { dot_trien_khai_id: null },
      });
      return { truoc: cu.map((k) => k.id).sort(), sau: [...ids].sort() };
    });
    if (truoc.join() !== sau.join()) {
      await this.nhatKy.ghi({
        hanh_dong: 'gan_khoa_dot_trien_khai',
        chi_tiet: { dot_trien_khai_id: dot.id, truoc, sau },
      });
    }
    return this.layMot(dot.id);
  }

  private async kiemTraKhoaTrongPhamVi(soId: string, ids: string[]) {
    if (ids.length === 0) return;
    const [khoa, phamVi] = await Promise.all([
      this.prisma.khoa_boi_duong.findMany({
        where: { id: { in: ids } },
        select: { id: true, ma_khoa: true, don_vi_dat_hang_id: true },
      }),
      this.scope.collectDescendantIds(soId),
    ]);
    const coSan = new Set(khoa.map((k) => k.id));
    if (ids.some((i) => !coSan.has(i))) {
      const message = 'Có khóa không tồn tại';
      throw new ValidationException(message, [{ field: 'khoa_ids', message }]);
    }
    const trongSo = new Set(phamVi);
    const ngoai = khoa
      .filter((k) => !trongSo.has(k.don_vi_dat_hang_id))
      .map((k) => k.ma_khoa)
      .sort();
    if (ngoai.length > 0) {
      const message = `Khóa không do Sở của đợt hoặc đơn vị trực thuộc đặt hàng: ${ngoai.join(', ')}`;
      throw new ValidationException(message, [{ field: 'khoa_ids', message }]);
    }
  }

  /** 409 kèm mã khóa + tên đợt đang gắn; transaction hủy. */
  private async chanKhoaDotKhac(
    tx: Prisma.TransactionClient,
    dotId: string,
    ids: string[],
  ): Promise<never> {
    const khac = await tx.khoa_boi_duong.findMany({
      where: { id: { in: ids }, dot_trien_khai_id: { not: dotId } },
      select: { ma_khoa: true, dot_trien_khai: { select: { ten: true } } },
      orderBy: { ma_khoa: 'asc' },
    });
    const moTa = khac.map(
      (k) => `${k.ma_khoa} (đợt ${k.dot_trien_khai?.ten ?? '?'})`,
    );
    throw new ConflictAppException(
      `Khóa đã gắn đợt khác — gỡ ở đợt đó trước: ${moTa.join(', ')}`,
      moTa.map((message) => ({ field: 'khoa_ids', message })),
    );
  }

  private async ghiNhatKySua(cu: DongDot, moi: DongDot) {
    const truoc = giaTriNhatKy(cu);
    const sau = giaTriNhatKy(moi);
    const doi = TRUONG_NHAT_KY.filter((k) => truoc[k] !== sau[k]);
    if (doi.length === 0) return;
    await this.nhatKy.ghi({
      hanh_dong: 'sua_dot_trien_khai',
      chi_tiet: {
        dot_trien_khai_id: moi.id,
        truoc: Object.fromEntries(doi.map((k) => [k, truoc[k]])),
        sau: Object.fromEntries(doi.map((k) => [k, sau[k]])),
      },
    });
  }

  // Sở của đợt: đơn vị loại so_gddt, đang hoạt động.
  private async kiemTraSo(soId: string) {
    const so = await this.prisma.don_vi_cong_tac.findUnique({
      where: { id: soId },
      select: { loai_don_vi: true, trang_thai: true },
    });
    if (!so || so.loai_don_vi !== 'so_gddt' || so.trang_thai !== 'active') {
      const message = 'Sở GD&ĐT không tồn tại hoặc đã ngưng hoạt động';
      throw new ValidationException(message, [
        { field: 'so_gddt_id', message },
      ]);
    }
  }

  private async layHoacLoi(id: string): Promise<DongDot> {
    const dot = await this.prisma.dot_trien_khai.findUnique({
      where: { id },
      include: BAO_GOM,
    });
    if (!dot) throw new NotFoundAppException('Không tìm thấy đợt triển khai');
    return dot;
  }

  private toDto(d: DongDot): DotTrienKhai {
    return {
      id: d.id,
      chuong_trinh: d.chuong_trinh,
      ten: d.ten,
      don_gia: d.don_gia,
      ngay_qd_tu: ngaySangChuoi(d.ngay_qd_tu),
      ngay_qd_den: ngaySangChuoi(d.ngay_qd_den),
      han_nop: d.han_nop.toISOString(),
      han_nop_ngay: ngayVietNam(d.han_nop),
      so_gddt: d.so_gddt,
      khoa: d.khoa_boi_duong.map(toKhoaCuaDot),
      created_at: d.created_at,
      updated_at: d.updated_at,
    };
  }
}
