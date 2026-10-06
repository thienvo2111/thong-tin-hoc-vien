import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundAppException } from '../common/exceptions/app.exceptions';

// ADR 0003 H1/H3: phạm vi của người hỗ trợ học viên = các cụm được phân công
// (phan_cong_ho_tro); học viên thuộc cụm qua dang_ky_hoc.cum_id. Điểm kiểm tra
// phạm vi DUY NHẤT cho mọi /ho-tro/* — truy vấn động mỗi request (gỡ phân
// công có hiệu lực ngay), không nằm trong JWT, không dùng ScopeService của
// cây đơn vị.
@Injectable()
export class HoTroHocVienScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async cumIdsCuaToi(nguoiDungId: string): Promise<string[]> {
    const rows = await this.prisma.phan_cong_ho_tro.findMany({
      where: { nguoi_dung_id: nguoiDungId },
      select: { cum_id: true },
    });
    return rows.map((r) => r.cum_id);
  }

  /** Cụm dùng để lọc: 1 cụm cụ thể (phải thuộc phạm vi, ngoài phạm vi → 404) hoặc mọi cụm của tôi. */
  async cumLoc(nguoiDungId: string, cumId?: string): Promise<string[]> {
    const cumIds = await this.cumIdsCuaToi(nguoiDungId);
    if (!cumId) return cumIds;
    if (!cumIds.includes(cumId)) {
      throw new NotFoundAppException('Không tìm thấy cụm hỗ trợ');
    }
    return [cumId];
  }

  whereHocVienTrongCum(cumIds: string[]): Prisma.hoc_vienWhereInput {
    return { dang_ky_hoc: { some: { cum_id: { in: cumIds } } } };
  }

  /** 404 (không 403) khi học viên ngoài phạm vi — không lộ việc hồ sơ tồn tại ở cụm khác. */
  async damBaoTrongPhamVi(
    nguoiDungId: string,
    hocVienId: string,
  ): Promise<void> {
    const cumIds = await this.cumIdsCuaToi(nguoiDungId);
    const co =
      cumIds.length > 0 &&
      (await this.prisma.dang_ky_hoc.count({
        where: { hoc_vien_id: hocVienId, cum_id: { in: cumIds } },
      })) > 0;
    if (!co) throw new NotFoundAppException('Không tìm thấy hồ sơ học viên');
  }
}
