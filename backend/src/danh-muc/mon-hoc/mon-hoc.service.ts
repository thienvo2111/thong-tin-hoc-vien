import { Injectable } from '@nestjs/common';
import { Prisma, mon_hoc } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeNfcName } from '../../common/utils/normalize-text.util';
import { ConflictAppException } from '../../common/exceptions/app.exceptions';
import { paginate } from '../../common/dto/pagination-query.dto';
import {
  CreateMonHocDto,
  QueryMonHocDto,
  UpdateMonHocDto,
} from '../dto/mon-hoc.dto';

// mon_hoc không có cột `ma` riêng — khóa duy nhất là cặp (ten_mon, cap_hoc)
// (@@unique trong schema.prisma). Áp dụng cùng tinh thần rule #37 (chặn
// 409 rõ ràng thay vì để lỗi DB thô) cho khóa duy nhất tổng hợp này —
// cải tiến ngoài chữ nghĩa checklist (chỉ nêu "ma"/"ma_don_vi"), flag lại.
@Injectable()
export class MonHocService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryMonHocDto) {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const where: Prisma.mon_hocWhereInput = {};
    if (query.cap_hoc) where.cap_hoc = query.cap_hoc;
    if (query.trang_thai) where.trang_thai = query.trang_thai;
    if (query.q) {
      where.ten_mon = { contains: query.q, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.mon_hoc.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { ten_mon: 'asc' },
      }),
      this.prisma.mon_hoc.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async create(dto: CreateMonHocDto, nguonImportId?: string): Promise<mon_hoc> {
    const ten_mon = normalizeNfcName(dto.ten_mon);
    await this.checkValid({ ten_mon, cap_hoc: dto.cap_hoc });

    return this.prisma.mon_hoc.create({
      data: { ten_mon, cap_hoc: dto.cap_hoc, nguon_import_id: nguonImportId },
    });
  }

  async update(id: string, dto: UpdateMonHocDto): Promise<mon_hoc> {
    const existing = await this.prisma.mon_hoc.findUniqueOrThrow({
      where: { id },
    });
    const merged = {
      ten_mon:
        dto.ten_mon !== undefined
          ? normalizeNfcName(dto.ten_mon)
          : existing.ten_mon,
      cap_hoc: dto.cap_hoc ?? existing.cap_hoc,
    };
    await this.checkValid(merged, id);

    return this.prisma.mon_hoc.update({
      where: { id },
      data: {
        ten_mon: merged.ten_mon,
        cap_hoc: merged.cap_hoc,
        trang_thai: dto.trang_thai,
      },
    });
  }

  async checkValid(
    dto: { ten_mon: string; cap_hoc: mon_hoc['cap_hoc'] },
    excludeId?: string,
  ) {
    const trung = await this.prisma.mon_hoc.findUnique({
      where: {
        ten_mon_cap_hoc: { ten_mon: dto.ten_mon, cap_hoc: dto.cap_hoc },
      },
    });
    if (trung && trung.id !== excludeId) {
      throw new ConflictAppException(
        `Môn học "${dto.ten_mon}" (${dto.cap_hoc}) đã tồn tại`,
        [{ field: 'ten_mon', message: 'Đã tồn tại cho cấp học này' }],
      );
    }
  }
}
