import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { buildCanDonDocWorkbook } from '../bao-cao/util/report-excel.util';
import { ThongKeScopeService } from './thong-ke-scope.service';
import { CanDonDocQueryDto } from './dto/thong-ke-query.dto';
import { CanDonDocDong, CanDonDocResult } from './thong-ke.types';

const PAGE_SIZE = 20;
const NGUONG_VANG = 2;
const NGUONG_VLE = 50;

const SELECT_DONG = {
  id: true,
  hoc_vien_id: true,
  khoa: { select: { ten_khoa: true } },
  hoc_vien: {
    select: {
      ho_ten: true,
      so_dien_thoai_lien_he: true,
      email_lien_he: true,
      don_vi_cong_tac: { select: { ten_don_vi: true } },
    },
  },
} satisfies Prisma.dang_ky_hocSelect;

const ORDER_BY: Prisma.dang_ky_hocOrderByWithRelationInput[] = [
  { hoc_vien: { ho_ten: 'asc' } },
  { khoa: { ten_khoa: 'asc' } },
  { id: 'asc' },
];

type DangKyRow = Prisma.dang_ky_hocGetPayload<{ select: typeof SELECT_DONG }>;

// Điều kiện phụ + chi tiết theo từng dang_ky_hoc.id; null = không có ai.
interface DieuKien {
  loc: Prisma.dang_ky_hocWhereInput;
  chiTiet: Map<string, string>;
}

@Injectable()
export class CanDonDocService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ThongKeScopeService,
  ) {}

  async danhSach(
    user: AuthenticatedUser,
    q: CanDonDocQueryDto,
  ): Promise<CanDonDocResult> {
    const page = q.page ?? 1;
    const phamVi = await this.scope.resolve(user, q);
    if (phamVi.rong) return { tong: 0, page, items: [] };
    const dk = await this.dieuKien(phamVi.where, q.loai);
    if (!dk) return { tong: 0, page, items: [] };

    const where: Prisma.dang_ky_hocWhereInput = {
      AND: [phamVi.where, dk.loc],
    };
    const [rows, tong] = await Promise.all([
      this.prisma.dang_ky_hoc.findMany({
        where,
        select: SELECT_DONG,
        orderBy: ORDER_BY,
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      this.prisma.dang_ky_hoc.count({ where }),
    ]);
    return { tong, page, items: rows.map((r) => toDong(r, dk.chiTiet)) };
  }

  async xuatExcel(
    user: AuthenticatedUser,
    q: CanDonDocQueryDto,
  ): Promise<Buffer> {
    const phamVi = await this.scope.resolve(user, q);
    if (phamVi.rong) return buildCanDonDocWorkbook([]);
    const dk = await this.dieuKien(phamVi.where, q.loai);
    if (!dk) return buildCanDonDocWorkbook([]);

    const rows = await this.prisma.dang_ky_hoc.findMany({
      where: { AND: [phamVi.where, dk.loc] },
      select: SELECT_DONG,
      orderBy: ORDER_BY,
    });
    return buildCanDonDocWorkbook(rows.map((r) => toDong(r, dk.chiTiet)));
  }

  private async dieuKien(
    where: Prisma.dang_ky_hocWhereInput,
    loai: CanDonDocQueryDto['loai'],
  ): Promise<DieuKien | null> {
    switch (loai) {
      case 'chua_truy_cap':
        return {
          loc: {
            hoc_vien: {
              OR: [
                { nguoi_dung_account: { is: null } },
                { nguoi_dung_account: { is: { dang_nhap_lan_cuoi: null } } },
              ],
            },
          },
          chiTiet: new Map(),
        };
      case 'chua_khao_sat':
        return {
          loc: {
            hoc_vien: {
              ket_qua_khao_sat: {
                none: { loai: 'danh-gia', trang_thai: 'hoan_thanh' },
              },
            },
          },
          chiTiet: new Map(),
        };
      case 'vang_nhieu':
        return this.vangNhieu(where);
      case 'vle_thap':
        return this.vleThap(where);
    }
  }

  private async vangNhieu(
    where: Prisma.dang_ky_hocWhereInput,
  ): Promise<DieuKien | null> {
    // Chỉ 'vang'; 'vang_co_phep' không tính.
    const nhom = await this.prisma.diem_danh.groupBy({
      by: ['dang_ky_hoc_id'],
      where: { trang_thai: 'vang', dang_ky_hoc: where },
      having: { dang_ky_hoc_id: { _count: { gte: NGUONG_VANG } } },
      _count: { _all: true },
    });
    if (nhom.length === 0) return null;
    const chiTiet = new Map(
      nhom.map((n) => [n.dang_ky_hoc_id, `Vắng ${n._count._all} buổi`]),
    );
    return { loc: { id: { in: [...chiTiet.keys()] } }, chiTiet };
  }

  private async vleThap(
    where: Prisma.dang_ky_hocWhereInput,
  ): Promise<DieuKien | null> {
    const rows = await this.prisma.ket_qua_giai_doan.findMany({
      where: {
        ty_le_hoan_thanh: { lt: NGUONG_VLE },
        dang_ky_hoc: where,
      },
      select: { dang_ky_hoc_id: true, ty_le_hoan_thanh: true },
    });
    const thapNhat = new Map<string, number>();
    for (const r of rows) {
      const v = Number(r.ty_le_hoan_thanh);
      const cu = thapNhat.get(r.dang_ky_hoc_id);
      if (cu === undefined || v < cu) thapNhat.set(r.dang_ky_hoc_id, v);
    }
    if (thapNhat.size === 0) return null;
    const chiTiet = new Map(
      [...thapNhat].map(([id, v]) => [id, `VLE ${dinhDangSo(v)}%`]),
    );
    return { loc: { id: { in: [...chiTiet.keys()] } }, chiTiet };
  }
}

// Tối đa 2 chữ số thập phân, bỏ số 0 thừa: 42 -> '42', 42.5 -> '42.5'.
const dinhDangSo = (v: number): string => String(Number(v.toFixed(2)));

function toDong(r: DangKyRow, chiTiet: Map<string, string>): CanDonDocDong {
  return {
    hoc_vien_id: r.hoc_vien_id,
    ho_ten: r.hoc_vien.ho_ten,
    ten_don_vi: r.hoc_vien.don_vi_cong_tac?.ten_don_vi ?? '',
    ten_khoa: r.khoa.ten_khoa,
    so_dien_thoai: r.hoc_vien.so_dien_thoai_lien_he,
    email: r.hoc_vien.email_lien_he,
    chi_tiet: chiTiet.get(r.id) ?? '',
  };
}
