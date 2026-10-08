import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeService } from '../auth/scope/scope.service';
import { HoTroHocVienScopeService } from '../ho-tro-hoc-vien/ho-tro-hoc-vien-scope.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  ForbiddenAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { DoiTuongLoc, ThongKeQueryDto } from './dto/thong-ke-query.dto';
import { BoLocResult, PhamViThongKe } from './thong-ke.types';

type CumRow = { id: string; khoa_id: string };

// Điều kiện đối tượng học viên; chỉ thu hẹp nên không ảnh hưởng phân quyền.
export function locDoiTuong(
  doiTuong: DoiTuongLoc,
): Prisma.dang_ky_hocWhereInput {
  return {
    hoc_vien: { doi_tuong: doiTuong === 'chua_xac_dinh' ? null : doiTuong },
  };
}

// Fail-closed: nhánh rong=true vẫn mang where không khớp dòng nào, để endpoint
// quên kiểm rong cũng không rò dữ liệu.
const PHAM_VI_RONG: PhamViThongKe = {
  where: { id: { in: [] } },
  rong: true,
  khoaIds: [],
};

// Điểm duy nhất suy ra phạm vi dữ liệu của mọi endpoint /thong-ke/*:
// where = (phạm vi theo vai trò) AND (bộ lọc khoa/đơn vị/cụm đã kiểm quyền).
@Injectable()
export class ThongKeScopeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: ScopeService,
    private readonly hoTroScope: HoTroHocVienScopeService,
  ) {}

  async resolve(
    user: AuthenticatedUser,
    q: ThongKeQueryDto,
  ): Promise<PhamViThongKe> {
    this.kiemTraHinhDang(user, q);
    if (user.vai_tro === 'quan_tri') return this.resolveQuanTri(q);
    if (user.vai_tro === 'ho_tro_hoc_vien') return this.resolveHoTro(user, q);
    return this.resolveDonVi(user, q);
  }

  async boLoc(user: AuthenticatedUser): Promise<BoLocResult> {
    if (user.vai_tro === 'quan_tri') return this.boLocQuanTri();
    if (user.vai_tro === 'ho_tro_hoc_vien') return this.boLocHoTro(user);
    return this.boLocDonVi(user);
  }

  private kiemTraHinhDang(user: AuthenticatedUser, q: ThongKeQueryDto): void {
    const vt = user.vai_tro;
    const duocDung =
      vt === 'quan_tri' ||
      vt === 'ho_tro_hoc_vien' ||
      vt === 'truong' ||
      vt === 'phong_vhxh' ||
      vt === 'so_gddt';
    if (!duocDung) {
      throw new ForbiddenAppException('Không có quyền xem thống kê');
    }
    if (q.cum_id && !q.khoa_id) {
      throw new ValidationException('Lọc theo cụm cần chọn khóa');
    }
    if (q.don_vi_id && q.cum_id) {
      throw new ValidationException(
        'Không thể lọc đồng thời theo đơn vị và theo cụm',
      );
    }
    if (vt === 'ho_tro_hoc_vien' && q.don_vi_id) {
      throw new ValidationException(
        'Người hỗ trợ học viên không lọc theo đơn vị',
      );
    }
    if (vt !== 'quan_tri' && vt !== 'ho_tro_hoc_vien' && q.cum_id) {
      throw new ValidationException('Vai trò này không lọc theo cụm');
    }
  }

  private async resolveQuanTri(q: ThongKeQueryDto): Promise<PhamViThongKe> {
    const loc: Prisma.dang_ky_hocWhereInput[] = [];
    if (q.doi_tuong) loc.push(locDoiTuong(q.doi_tuong));
    if (q.khoa_id) loc.push({ khoa_id: q.khoa_id });
    if (q.don_vi_id) loc.push(await this.locDonVi(q.don_vi_id));
    if (q.cum_id) {
      const cum = await this.prisma.cum_hoc_vien.findUnique({
        where: { id: q.cum_id },
        select: { id: true, khoa_id: true },
      });
      if (!cum || cum.khoa_id !== q.khoa_id) {
        throw new ForbiddenAppException('Cụm không thuộc khóa đã chọn');
      }
      loc.push({ cum_id: q.cum_id });
    }
    return {
      where: loc.length ? { AND: loc } : {},
      rong: false,
      khoaIds: q.khoa_id ? [q.khoa_id] : 'ALL',
    };
  }

  private async resolveDonVi(
    user: AuthenticatedUser,
    q: ThongKeQueryDto,
  ): Promise<PhamViThongKe> {
    const scope = await this.scopeService.getAccessibleDonViIds(user);
    if (scope === 'ALL' || scope.length === 0) {
      return { ...PHAM_VI_RONG };
    }
    const khoaXem = await this.scopeService.getKhoaIdsXemDuoc(user);
    const khoaIds = khoaXem === 'ALL' ? [] : khoaXem;
    if (q.khoa_id && !khoaIds.includes(q.khoa_id)) {
      throw new ForbiddenAppException('Không có quyền xem khóa này');
    }
    const loc: Prisma.dang_ky_hocWhereInput[] = [];
    if (q.doi_tuong) loc.push(locDoiTuong(q.doi_tuong));
    if (q.khoa_id) loc.push({ khoa_id: q.khoa_id });
    if (q.don_vi_id) {
      if (!scope.includes(q.don_vi_id)) {
        throw new ForbiddenAppException('Đơn vị nằm ngoài phạm vi của bạn');
      }
      loc.push(await this.locDonVi(q.don_vi_id));
    }
    // R1: khóa do đơn vị trong phạm vi đặt hàng; R2: học viên thuộc phạm vi.
    const where: Prisma.dang_ky_hocWhereInput = {
      OR: [
        { khoa: { don_vi_dat_hang_id: { in: scope } } },
        { hoc_vien: { don_vi_cong_tac_id: { in: scope } } },
      ],
    };
    if (loc.length) where.AND = loc;
    return {
      where,
      rong: false,
      khoaIds: q.khoa_id ? [q.khoa_id] : khoaIds,
    };
  }

  private async resolveHoTro(
    user: AuthenticatedUser,
    q: ThongKeQueryDto,
  ): Promise<PhamViThongKe> {
    const cumIds = await this.hoTroScope.cumIdsCuaToi(user.id);
    if (cumIds.length === 0) {
      return { ...PHAM_VI_RONG };
    }
    const cums = await this.cumPhanCong(cumIds);
    const khoaIds = [...new Set(cums.map((c) => c.khoa_id))];
    if (q.khoa_id && !khoaIds.includes(q.khoa_id)) {
      throw new ForbiddenAppException('Không có quyền xem khóa này');
    }
    const loc: Prisma.dang_ky_hocWhereInput[] = [];
    if (q.doi_tuong) loc.push(locDoiTuong(q.doi_tuong));
    if (q.khoa_id) loc.push({ khoa_id: q.khoa_id });
    if (q.cum_id) {
      const cum = cums.find((c) => c.id === q.cum_id);
      if (!cum || cum.khoa_id !== q.khoa_id) {
        throw new ForbiddenAppException('Cụm không thuộc phạm vi của bạn');
      }
      loc.push({ cum_id: q.cum_id });
    }
    const where: Prisma.dang_ky_hocWhereInput = { cum_id: { in: cumIds } };
    if (loc.length) where.AND = loc;
    return {
      where,
      rong: false,
      khoaIds: q.khoa_id ? [q.khoa_id] : khoaIds,
    };
  }

  // Cây con của don_vi_id (tái dùng cách duyệt cây của ScopeService).
  private async locDonVi(
    donViId: string,
  ): Promise<Prisma.dang_ky_hocWhereInput> {
    const cay = await this.scopeService.getAccessibleDonViIds({
      vai_tro: 'so_gddt',
      don_vi_id: donViId,
    });
    return { hoc_vien: { don_vi_cong_tac_id: { in: cay as string[] } } };
  }

  private cumPhanCong(cumIds: string[]): Promise<CumRow[]> {
    return this.prisma.cum_hoc_vien.findMany({
      where: { id: { in: cumIds } },
      select: { id: true, khoa_id: true },
    });
  }

  private async boLocQuanTri(): Promise<BoLocResult> {
    const [khoa, don_vi, cum] = await Promise.all([
      this.prisma.khoa_boi_duong.findMany({
        where: {},
        select: { id: true, ten_khoa: true },
        orderBy: { thoi_gian_bat_dau: 'desc' },
      }),
      this.prisma.don_vi_cong_tac.findMany({
        where: { loai_don_vi: { not: 'khac' } },
        select: { id: true, ten_don_vi: true, loai_don_vi: true },
        orderBy: { ten_don_vi: 'asc' },
      }),
      this.prisma.cum_hoc_vien.findMany({
        select: { id: true, ten_cum: true, khoa_id: true },
        orderBy: { ten_cum: 'asc' },
      }),
    ]);
    return { khoa, don_vi, cum, don_vi_co_dinh: null };
  }

  private async boLocDonVi(user: AuthenticatedUser): Promise<BoLocResult> {
    const scope = await this.scopeService.getAccessibleDonViIds(user);
    const donViIds = scope === 'ALL' ? [] : scope;
    const khoaXem = await this.scopeService.getKhoaIdsXemDuoc(user);
    const khoaIds = khoaXem === 'ALL' ? [] : khoaXem;
    const khoa = khoaIds.length
      ? await this.prisma.khoa_boi_duong.findMany({
          where: { id: { in: khoaIds } },
          select: { id: true, ten_khoa: true },
          orderBy: { thoi_gian_bat_dau: 'desc' },
        })
      : [];
    if (user.vai_tro === 'truong') {
      const dv = user.don_vi_id
        ? await this.prisma.don_vi_cong_tac.findUnique({
            where: { id: user.don_vi_id },
            select: { id: true, ten_don_vi: true },
          })
        : null;
      return { khoa, don_vi: null, cum: null, don_vi_co_dinh: dv };
    }
    const don_vi = donViIds.length
      ? await this.prisma.don_vi_cong_tac.findMany({
          where: { id: { in: donViIds }, loai_don_vi: { not: 'khac' } },
          select: { id: true, ten_don_vi: true, loai_don_vi: true },
          orderBy: { ten_don_vi: 'asc' },
        })
      : [];
    return { khoa, don_vi, cum: null, don_vi_co_dinh: null };
  }

  private async boLocHoTro(user: AuthenticatedUser): Promise<BoLocResult> {
    const cumIds = await this.hoTroScope.cumIdsCuaToi(user.id);
    if (cumIds.length === 0) {
      return { khoa: [], don_vi: null, cum: [], don_vi_co_dinh: null };
    }
    const cum = await this.prisma.cum_hoc_vien.findMany({
      where: { id: { in: cumIds } },
      select: { id: true, ten_cum: true, khoa_id: true },
      orderBy: { ten_cum: 'asc' },
    });
    const khoaIds = [...new Set(cum.map((c) => c.khoa_id))];
    const khoa = await this.prisma.khoa_boi_duong.findMany({
      where: { id: { in: khoaIds } },
      select: { id: true, ten_khoa: true },
      orderBy: { thoi_gian_bat_dau: 'desc' },
    });
    return { khoa, don_vi: null, cum, don_vi_co_dinh: null };
  }
}
