import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeService, DonViScope } from '../auth/scope/scope.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { TongHopQueryDto } from './dto/tong-hop-query.dto';
import {
  CAP_GIANG_DAY,
  CHUA_CO_KET_QUA,
  KET_QUA_HOC,
  KHONG_XAC_DINH,
  TRANG_THAI_DANG_KY,
  TRANG_THAI_HO_SO,
  TongHopDiaBanRow,
  TongHopDonViRow,
  TongHopKhoaRow,
  TongHopResult,
} from './bao-cao.types';

// Dịch vụ Báo cáo — docs/api-contract.md mục 7 CHỈ có 2 dòng mô tả endpoint,
// không mô tả response shape hay field ngày lọc theo report nào. Toàn bộ
// dưới đây là suy luận có lý do, PROVISIONAL (giống GET /auth/toi):
//
// - Trường ngày lọc: theo=don_vi/dia_ban dùng hoc_vien.created_at (thời điểm
//   hồ sơ được tạo — phản ánh "có bao nhiêu hồ sơ phát sinh trong kỳ", đúng ý
//   nghĩa báo cáo tiến độ thu thập dữ liệu). theo=khoa dùng
//   khoa_boi_duong.thoi_gian_bat_dau (báo cáo "khóa nào diễn ra trong kỳ",
//   không phải khóa nào được TẠO trong kỳ — đúng ý nghĩa README "theo dõi
//   tiến độ khóa bồi dưỡng").
// - Nhóm theo=dia_ban dùng dia_ban_id của ĐƠN VỊ CÔNG TÁC (don_vi_cong_tac.
//   dia_ban_id), KHÔNG dùng hoc_vien.phuong_xa_id (nơi cư trú). Lý do:
//   dia_ban_id của đơn vị là NOT NULL, có ngay từ khi tạo don_vi_cong_tac;
//   phuong_xa_id của hoc_vien là optional, thường NULL với hồ sơ
//   nguon_tao='import_moet' chưa bổ sung. Dùng nơi công tác cho ra báo cáo
//   đầy đủ hơn, và khớp với cách phạm vi Phòng VHXH được định nghĩa theo cây
//   don_vi (không theo nơi cư trú của từng học viên).
// - theo=don_vi/dia_ban CHỈ liệt kê nhóm có ít nhất 1 hoc_vien khớp bộ lọc
//   (không liệt kê toàn bộ đơn vị/địa bàn trong phạm vi kèm số 0) — tránh
//   response phình to với hàng loạt dòng toàn số 0. theo=khoa liệt kê TOÀN
//   BỘ khóa trong phạm vi + khớp bộ lọc ngày kể cả khóa 0 đăng ký — vì đây
//   đúng là ý nghĩa "theo dõi tiến độ", khóa chưa có ai đăng ký vẫn là tín
//   hiệu cần thấy.
// - Response shape: { theo, tu_ngay, den_ngay, rows: [...] } — xem
//   bao-cao.types.ts cho shape từng loại row.
@Injectable()
export class BaoCaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: ScopeService,
  ) {}

  async tongHop(
    query: TongHopQueryDto,
    user: AuthenticatedUser,
  ): Promise<TongHopResult> {
    const scope = await this.scopeService.getAccessibleDonViIds(user);
    let rows: TongHopResult['rows'];
    if (query.theo === 'don_vi') {
      rows = await this.tongHopTheoDonVi(scope, query);
    } else if (query.theo === 'dia_ban') {
      rows = await this.tongHopTheoDiaBan(scope, query);
    } else {
      rows = await this.tongHopTheoKhoa(scope, query);
    }
    return {
      theo: query.theo,
      tu_ngay: query.tu_ngay ?? null,
      den_ngay: query.den_ngay ?? null,
      rows,
    };
  }

  private hocVienWhere(
    scope: DonViScope,
    query: TongHopQueryDto,
  ): Prisma.hoc_vienWhereInput {
    const where: Prisma.hoc_vienWhereInput = {};
    if (scope !== 'ALL') {
      where.don_vi_cong_tac_id = { in: scope };
    }
    if (query.tu_ngay || query.den_ngay) {
      where.created_at = {};
      if (query.tu_ngay)
        where.created_at.gte = new Date(`${query.tu_ngay}T00:00:00.000Z`);
      if (query.den_ngay)
        where.created_at.lte = new Date(`${query.den_ngay}T23:59:59.999Z`);
    }
    return where;
  }

  private emptyTheoTrangThai(): Record<string, number> {
    return Object.fromEntries(TRANG_THAI_HO_SO.map((t) => [t, 0]));
  }

  private emptyTheoCapGiangDay(): Record<string, number> {
    return {
      ...Object.fromEntries(CAP_GIANG_DAY.map((c) => [c, 0])),
      [KHONG_XAC_DINH]: 0,
    };
  }

  private async tongHopTheoDonVi(
    scope: DonViScope,
    query: TongHopQueryDto,
  ): Promise<TongHopDonViRow[]> {
    if (scope !== 'ALL' && scope.length === 0) return [];
    const hocViens = await this.prisma.hoc_vien.findMany({
      where: this.hocVienWhere(scope, query),
      select: {
        trang_thai: true,
        cap_giang_day: true,
        don_vi_cong_tac_id: true,
        don_vi_cong_tac: { select: { ten_don_vi: true } },
      },
    });

    const byDonVi = new Map<string, TongHopDonViRow>();
    for (const hv of hocViens) {
      let row = byDonVi.get(hv.don_vi_cong_tac_id);
      if (!row) {
        row = {
          don_vi_id: hv.don_vi_cong_tac_id,
          ten_don_vi: hv.don_vi_cong_tac.ten_don_vi,
          tong_so: 0,
          theo_trang_thai: this.emptyTheoTrangThai(),
          theo_cap_giang_day: this.emptyTheoCapGiangDay(),
        };
        byDonVi.set(hv.don_vi_cong_tac_id, row);
      }
      row.tong_so += 1;
      row.theo_trang_thai[hv.trang_thai] += 1;
      row.theo_cap_giang_day[hv.cap_giang_day ?? KHONG_XAC_DINH] += 1;
    }

    return Array.from(byDonVi.values()).sort((a, b) =>
      a.ten_don_vi.localeCompare(b.ten_don_vi, 'vi'),
    );
  }

  private async tongHopTheoDiaBan(
    scope: DonViScope,
    query: TongHopQueryDto,
  ): Promise<TongHopDiaBanRow[]> {
    if (scope !== 'ALL' && scope.length === 0) return [];
    const hocViens = await this.prisma.hoc_vien.findMany({
      where: this.hocVienWhere(scope, query),
      select: {
        trang_thai: true,
        cap_giang_day: true,
        don_vi_cong_tac: {
          select: { dia_ban_id: true, dia_ban: { select: { ten: true } } },
        },
      },
    });

    const byDiaBan = new Map<string, TongHopDiaBanRow>();
    for (const hv of hocViens) {
      const diaBanId = hv.don_vi_cong_tac.dia_ban_id;
      let row = byDiaBan.get(diaBanId);
      if (!row) {
        row = {
          dia_ban_id: diaBanId,
          ten_dia_ban: hv.don_vi_cong_tac.dia_ban.ten,
          tong_so: 0,
          theo_trang_thai: this.emptyTheoTrangThai(),
          theo_cap_giang_day: this.emptyTheoCapGiangDay(),
        };
        byDiaBan.set(diaBanId, row);
      }
      row.tong_so += 1;
      row.theo_trang_thai[hv.trang_thai] += 1;
      row.theo_cap_giang_day[hv.cap_giang_day ?? KHONG_XAC_DINH] += 1;
    }

    return Array.from(byDiaBan.values()).sort((a, b) =>
      a.ten_dia_ban.localeCompare(b.ten_dia_ban, 'vi'),
    );
  }

  private async tongHopTheoKhoa(
    scope: DonViScope,
    query: TongHopQueryDto,
  ): Promise<TongHopKhoaRow[]> {
    if (scope !== 'ALL' && scope.length === 0) return [];
    const where: Prisma.khoa_boi_duongWhereInput = {};
    if (scope !== 'ALL') {
      where.don_vi_to_chuc_id = { in: scope };
    }
    if (query.tu_ngay || query.den_ngay) {
      where.thoi_gian_bat_dau = {};
      if (query.tu_ngay) where.thoi_gian_bat_dau.gte = new Date(query.tu_ngay);
      if (query.den_ngay)
        where.thoi_gian_bat_dau.lte = new Date(query.den_ngay);
    }

    const khoas = await this.prisma.khoa_boi_duong.findMany({
      where,
      select: {
        id: true,
        ma_khoa: true,
        ten_khoa: true,
        trang_thai: true,
        don_vi_to_chuc: { select: { ten_don_vi: true } },
        dang_ky_hoc: { select: { trang_thai: true, ket_qua: true } },
      },
      orderBy: { ma_khoa: 'asc' },
    });

    return khoas.map((k) => {
      const theo_trang_thai_dang_ky = Object.fromEntries(
        TRANG_THAI_DANG_KY.map((t) => [t, 0]),
      ) as Record<string, number>;
      const theo_ket_qua = {
        ...Object.fromEntries(KET_QUA_HOC.map((kq) => [kq, 0])),
        [CHUA_CO_KET_QUA]: 0,
      } as Record<string, number>;

      for (const dk of k.dang_ky_hoc) {
        theo_trang_thai_dang_ky[dk.trang_thai] += 1;
        theo_ket_qua[dk.ket_qua ?? CHUA_CO_KET_QUA] += 1;
      }

      return {
        khoa_id: k.id,
        ma_khoa: k.ma_khoa,
        ten_khoa: k.ten_khoa,
        don_vi_to_chuc: k.don_vi_to_chuc.ten_don_vi,
        trang_thai_khoa: k.trang_thai,
        tong_dang_ky: k.dang_ky_hoc.length,
        theo_trang_thai_dang_ky,
        theo_ket_qua,
      };
    });
  }
}
