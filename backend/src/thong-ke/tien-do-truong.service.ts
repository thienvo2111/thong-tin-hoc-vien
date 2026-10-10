import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ForbiddenAppException } from '../common/exceptions/app.exceptions';
import { buildTienDoTruongWorkbook } from '../bao-cao/util/report-excel.util';
import { ThongKeScopeService } from './thong-ke-scope.service';
import { ThongKeQueryDto } from './dto/thong-ke-query.dto';
import { TienDoTruongDong } from './thong-ke.types';
import { phaiKhaoSat } from '../common/utils/doi-tuong-khao-sat.util';

const NGUONG_VLE = 50;

interface Tong {
  don_vi_id: string;
  ten_don_vi: string;
  ten_don_vi_cha: string | null;
  hv: Set<string>;
  /** hv trừ nhân viên — mẫu số cho kyNangSo/dauVao/dauRa (chưa triển khai khảo sát). */
  hvKhaoSat: Set<string>;
  truyCap: Set<string>;
  kyNangSo: Set<string>;
  dauVao: Set<string>;
  dauRa: Set<string>;
  soDangKy: number;
  soDat: number;
  coMat: number;
  tongDiemDanh: number;
  // HV có dữ liệu VLE -> có đạt (mọi giai đoạn >= ngưỡng) hay không.
  vle: Map<string, boolean>;
}

const tyLe = (tu: number, mau: number): number | null =>
  mau === 0 ? null : tu / mau;

@Injectable()
export class TienDoTruongService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ThongKeScopeService,
  ) {}

  async danhSach(
    user: AuthenticatedUser,
    q: ThongKeQueryDto,
  ): Promise<TienDoTruongDong[]> {
    this.chanTruong(user);
    const phamVi = await this.scope.resolve(user, q);
    if (phamVi.rong) return [];
    return this.tinh(phamVi.where);
  }

  async xuatExcel(
    user: AuthenticatedUser,
    q: ThongKeQueryDto,
  ): Promise<Buffer> {
    return buildTienDoTruongWorkbook(await this.danhSach(user, q));
  }

  private chanTruong(user: AuthenticatedUser) {
    if (user.vai_tro === 'truong') {
      throw new ForbiddenAppException(
        'Khối tiến độ theo trường không áp dụng cho tài khoản trường',
      );
    }
  }

  private async tinh(
    where: Prisma.dang_ky_hocWhereInput,
  ): Promise<TienDoTruongDong[]> {
    const [dangKy, diemDanh, giaiDoan] = await Promise.all([
      this.prisma.dang_ky_hoc.findMany({
        where,
        select: {
          id: true,
          ket_qua: true,
          hoc_vien_id: true,
          hoc_vien: {
            select: {
              don_vi_cong_tac_id: true,
              don_vi_cong_tac: {
                select: {
                  ten_don_vi: true,
                  don_vi_cha: { select: { ten_don_vi: true } },
                },
              },
              doi_tuong: true,
              nguoi_dung_account: { select: { dang_nhap_lan_cuoi: true } },
              ket_qua_khao_sat: {
                where: { trang_thai: 'hoan_thanh' },
                select: { loai: true },
              },
            },
          },
        },
      }),
      this.prisma.diem_danh.groupBy({
        by: ['dang_ky_hoc_id', 'trang_thai'],
        where: { dang_ky_hoc: where },
        _count: true,
      }),
      this.prisma.ket_qua_giai_doan.findMany({
        where: { dang_ky_hoc: where, ty_le_hoan_thanh: { not: null } },
        select: { dang_ky_hoc_id: true, ty_le_hoan_thanh: true },
      }),
    ]);

    const theoTruong = new Map<string, Tong>();
    const dkInfo = new Map<string, { donVi: string; hv: string }>();
    for (const d of dangKy) {
      const h = d.hoc_vien;
      const donViId = h.don_vi_cong_tac_id;
      if (!donViId || !h.don_vi_cong_tac) continue;
      dkInfo.set(d.id, { donVi: donViId, hv: d.hoc_vien_id });
      let t = theoTruong.get(donViId);
      if (!t) {
        t = {
          don_vi_id: donViId,
          ten_don_vi: h.don_vi_cong_tac.ten_don_vi,
          ten_don_vi_cha: h.don_vi_cong_tac.don_vi_cha?.ten_don_vi ?? null,
          hv: new Set(),
          hvKhaoSat: new Set(),
          truyCap: new Set(),
          kyNangSo: new Set(),
          dauVao: new Set(),
          dauRa: new Set(),
          soDangKy: 0,
          soDat: 0,
          coMat: 0,
          tongDiemDanh: 0,
          vle: new Map(),
        };
        theoTruong.set(donViId, t);
      }
      t.hv.add(d.hoc_vien_id);
      if (phaiKhaoSat(h.doi_tuong)) t.hvKhaoSat.add(d.hoc_vien_id);
      t.soDangKy += 1;
      if (d.ket_qua === 'dat') t.soDat += 1;
      if (h.nguoi_dung_account?.dang_nhap_lan_cuoi) {
        t.truyCap.add(d.hoc_vien_id);
      }
      for (const ks of h.ket_qua_khao_sat) {
        if (ks.loai === 'khao-sat') t.kyNangSo.add(d.hoc_vien_id);
        else if (ks.loai === 'danh-gia') t.dauVao.add(d.hoc_vien_id);
        else if (ks.loai === 'dau-ra') t.dauRa.add(d.hoc_vien_id);
      }
    }

    for (const g of diemDanh) {
      const info = dkInfo.get(g.dang_ky_hoc_id);
      const t = info && theoTruong.get(info.donVi);
      if (!t) continue;
      const so = typeof g._count === 'number' ? g._count : 0;
      t.tongDiemDanh += so;
      if (g.trang_thai === 'co_mat') t.coMat += so;
    }

    for (const r of giaiDoan) {
      const info = dkInfo.get(r.dang_ky_hoc_id);
      const t = info && theoTruong.get(info.donVi);
      if (!info || !t) continue;
      const dat = Number(r.ty_le_hoan_thanh) >= NGUONG_VLE;
      t.vle.set(info.hv, (t.vle.get(info.hv) ?? true) && dat);
    }

    return [...theoTruong.values()]
      .map(toDong)
      .sort((a, b) => a.ten_don_vi.localeCompare(b.ten_don_vi, 'vi'));
  }
}

function toDong(t: Tong): TienDoTruongDong {
  const soHv = t.hv.size;
  const soHvKhaoSat = t.hvKhaoSat.size;
  const vleDat = [...t.vle.values()].filter(Boolean).length;
  return {
    don_vi_id: t.don_vi_id,
    ten_don_vi: t.ten_don_vi,
    ten_don_vi_cha: t.ten_don_vi_cha,
    so_hv: soHv,
    so_truy_cap: t.truyCap.size,
    ty_le_truy_cap: tyLe(t.truyCap.size, soHv),
    so_hv_khao_sat: soHvKhaoSat,
    so_ky_nang_so: t.kyNangSo.size,
    ty_le_ky_nang_so: tyLe(t.kyNangSo.size, soHvKhaoSat),
    so_dau_vao: t.dauVao.size,
    ty_le_dau_vao: tyLe(t.dauVao.size, soHvKhaoSat),
    so_dau_ra: t.dauRa.size,
    ty_le_dau_ra: tyLe(t.dauRa.size, soHvKhaoSat),
    so_luot_diem_danh: t.tongDiemDanh,
    so_luot_co_mat: t.coMat,
    ty_le_co_mat: tyLe(t.coMat, t.tongDiemDanh),
    so_hv_co_vle: t.vle.size,
    so_hv_vle_dat: vleDat,
    ty_le_vle_dat: tyLe(vleDat, t.vle.size),
    so_dang_ky: t.soDangKy,
    so_dat: t.soDat,
    ty_le_dat: tyLe(t.soDat, t.soDangKy),
  };
}
