import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { chuong_trinh_boi_duong } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NhatKyService } from '../nhat-ky/nhat-ky.service';
import {
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import {
  SuaDotTrienKhaiDto,
  TaoDotTrienKhaiDto,
} from './dto/dot-trien-khai.dto';
import { hanNopTuNgay, ngayVietNam } from './han-nop';

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
  created_at: Date;
  updated_at: Date;
}

const BAO_GOM = {
  so_gddt: { select: { id: true, ten_don_vi: true } },
} satisfies Prisma.dot_trien_khaiInclude;

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
      created_at: d.created_at,
      updated_at: d.updated_at,
    };
  }
}
