import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const GOI_Y_LIMIT = 10;

// Gap 2 (2026-09-28, docs/api-contract.md mục 4) — KHÔNG phải danh mục quản
// lý (không có bảng riêng, không CRUD): chỉ gợi ý autocomplete từ các giá trị
// chuyen_mon đã có trong hoc_vien_chuyen_mon (bảng 1-nhiều tách ra từ đợt
// MOET), khác cột hoc_vien.chuyen_mon_dao_tao cũ đã bỏ.
@Injectable()
export class ChuyenMonDaoTaoService {
  constructor(private readonly prisma: PrismaService) {}

  async goiY(q?: string): Promise<string[]> {
    const where: Prisma.hoc_vien_chuyen_monWhereInput = q
      ? { chuyen_mon: { contains: q, mode: 'insensitive' } }
      : {};

    const rows = await this.prisma.hoc_vien_chuyen_mon.findMany({
      where,
      distinct: ['chuyen_mon'],
      select: { chuyen_mon: true },
      orderBy: { chuyen_mon: 'asc' },
      take: GOI_Y_LIMIT,
    });
    return rows.map((r) => r.chuyen_mon);
  }
}
