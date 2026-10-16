import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundAppException } from '../common/exceptions/app.exceptions';

// ADR 0003 H1/H3: phạm vi của người hỗ trợ học viên = các cụm được phân công
// (phan_cong_ho_tro); học viên thuộc cụm qua dang_ky_hoc.cum_id. Điểm kiểm tra
// phạm vi DUY NHẤT cho mọi /ho-tro/* — truy vấn động mỗi request (gỡ phân
// công có hiệu lực ngay), không nằm trong JWT, không dùng ScopeService của
// cây đơn vị.
// ADR 0008 L2: phạm vi mở rộng = cụm ∪ LỚP GỐC được gắn (phan_cong_ho_tro_lop):
// học viên có phan_lop_giai_doan vào lớp của tôi. Đổi buổi KHÔNG tính (ADR
// 0007 — đọc theo lớp giữ lớp gốc).
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

  async lopIdsCuaToi(nguoiDungId: string): Promise<string[]> {
    const rows = await this.prisma.phan_cong_ho_tro_lop.findMany({
      where: { nguoi_dung_id: nguoiDungId },
      select: { lop_id: true },
    });
    return rows.map((r) => r.lop_id);
  }

  /**
   * Điều kiện dang_ky_hoc thuộc phạm vi (cụm ∪ lớp gốc) — null khi tôi chưa
   * được gắn cụm/lớp nào.
   */
  async whereDangKyTrongPhamVi(
    nguoiDungId: string,
  ): Promise<Prisma.dang_ky_hocWhereInput | null> {
    const [cumIds, lopIds] = await Promise.all([
      this.cumIdsCuaToi(nguoiDungId),
      this.lopIdsCuaToi(nguoiDungId),
    ]);
    const or: Prisma.dang_ky_hocWhereInput[] = [];
    if (cumIds.length > 0) or.push({ cum_id: { in: cumIds } });
    if (lopIds.length > 0)
      or.push({ phan_lop_giai_doan: { some: { lop_id: { in: lopIds } } } });
    return or.length > 0 ? { OR: or } : null;
  }

  /** Lớp được gắn cho tôi — ngoài phạm vi → 404. */
  async damBaoLopCuaToi(nguoiDungId: string, lopId: string): Promise<void> {
    const co = await this.prisma.phan_cong_ho_tro_lop.count({
      where: { nguoi_dung_id: nguoiDungId, lop_id: lopId },
    });
    if (co === 0) throw new NotFoundAppException('Không tìm thấy lớp');
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
    const phamVi = await this.whereDangKyTrongPhamVi(nguoiDungId);
    const co =
      phamVi !== null &&
      (await this.prisma.dang_ky_hoc.count({
        where: { AND: [{ hoc_vien_id: hocVienId }, phamVi] },
      })) > 0;
    if (!co) throw new NotFoundAppException('Không tìm thấy hồ sơ học viên');
  }
}
