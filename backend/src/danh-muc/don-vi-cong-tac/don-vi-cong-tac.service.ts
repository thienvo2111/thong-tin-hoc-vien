import { Injectable } from '@nestjs/common';
import { Prisma, don_vi_cong_tac } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeNfcName } from '../../common/utils/normalize-text.util';
import {
  ConflictAppException,
  ValidationException,
} from '../../common/exceptions/app.exceptions';
import { paginate } from '../../common/dto/pagination-query.dto';
import {
  CreateDonViCongTacDto,
  QueryDonViCongTacDto,
  UpdateDonViCongTacDto,
} from '../dto/don-vi-cong-tac.dto';

// Rule tham chiếu: validation-checklist.md #37, #39, #41 + comment DDL
// (database-ddl.sql dòng "dia_ban_id ... cấp phuong_xa_dac_khu").
@Injectable()
export class DonViCongTacService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryDonViCongTacDto) {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const where: Prisma.don_vi_cong_tacWhereInput = {};
    if (query.loai_don_vi) where.loai_don_vi = query.loai_don_vi;
    if (query.dia_ban_id) where.dia_ban_id = query.dia_ban_id;
    if (query.trang_thai) where.trang_thai = query.trang_thai;
    if (query.q) {
      where.ten_don_vi = { contains: query.q, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.don_vi_cong_tac.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { ten_don_vi: 'asc' },
      }),
      this.prisma.don_vi_cong_tac.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async create(
    dto: CreateDonViCongTacDto,
    nguonImportId?: string,
  ): Promise<don_vi_cong_tac> {
    const ten_don_vi = normalizeNfcName(dto.ten_don_vi);
    const ma_don_vi = dto.ma_don_vi?.trim();
    await this.checkValid({
      ma_don_vi,
      dia_ban_id: dto.dia_ban_id,
      don_vi_cha_id: dto.don_vi_cha_id ?? null,
    });

    return this.prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi,
        ten_don_vi,
        loai_don_vi: dto.loai_don_vi,
        dia_ban_id: dto.dia_ban_id,
        don_vi_cha_id: dto.don_vi_cha_id ?? null,
        nguon_import_id: nguonImportId,
      },
    });
  }

  async update(
    id: string,
    dto: UpdateDonViCongTacDto,
  ): Promise<don_vi_cong_tac> {
    const existing = await this.prisma.don_vi_cong_tac.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new ValidationException('Không tìm thấy đơn vị công tác', [
        { field: 'id', message: 'Không tồn tại' },
      ]);
    }

    const merged = {
      ma_don_vi:
        dto.ma_don_vi !== undefined
          ? dto.ma_don_vi.trim()
          : (existing.ma_don_vi ?? undefined),
      dia_ban_id: dto.dia_ban_id ?? existing.dia_ban_id,
      don_vi_cha_id:
        dto.don_vi_cha_id !== undefined
          ? dto.don_vi_cha_id
          : existing.don_vi_cha_id,
    };
    await this.checkValid(merged, id);

    return this.prisma.don_vi_cong_tac.update({
      where: { id },
      data: {
        ma_don_vi: merged.ma_don_vi,
        ten_don_vi:
          dto.ten_don_vi !== undefined
            ? normalizeNfcName(dto.ten_don_vi)
            : undefined,
        loai_don_vi: dto.loai_don_vi,
        dia_ban_id: merged.dia_ban_id,
        don_vi_cha_id: merged.don_vi_cha_id,
        trang_thai: dto.trang_thai,
      },
    });
  }

  async checkValid(
    dto: {
      ma_don_vi?: string;
      dia_ban_id: string;
      don_vi_cha_id: string | null;
    },
    excludeId?: string,
  ) {
    if (excludeId && dto.don_vi_cha_id === excludeId) {
      throw new ValidationException(
        'Đơn vị không được tự làm cha của chính nó',
        [
          {
            field: 'don_vi_cha_id',
            message: 'Không được tự tham chiếu chính nó',
          },
        ],
      );
    }

    const diaBan = await this.prisma.dia_danh.findUnique({
      where: { id: dto.dia_ban_id },
    });
    if (!diaBan) {
      throw new ValidationException('dia_ban_id không tồn tại', [
        { field: 'dia_ban_id', message: 'Không tồn tại' },
      ]);
    }
    if (diaBan.cap !== 'phuong_xa_dac_khu') {
      throw new ValidationException(
        'dia_ban_id phải là địa danh cấp phường/xã',
        [
          {
            field: 'dia_ban_id',
            message: 'Phải trỏ tới địa danh cấp phuong_xa_dac_khu',
          },
        ],
      );
    }

    if (dto.don_vi_cha_id) {
      const cha = await this.prisma.don_vi_cong_tac.findUnique({
        where: { id: dto.don_vi_cha_id },
      });
      if (!cha) {
        throw new ValidationException('don_vi_cha_id không tồn tại', [
          { field: 'don_vi_cha_id', message: 'Không tồn tại' },
        ]);
      }
    }

    if (dto.ma_don_vi) {
      const trung = await this.prisma.don_vi_cong_tac.findUnique({
        where: { ma_don_vi: dto.ma_don_vi },
      });
      if (trung && trung.id !== excludeId) {
        throw new ConflictAppException(
          `Mã đơn vị "${dto.ma_don_vi}" đã tồn tại`,
          [{ field: 'ma_don_vi', message: 'Mã đã tồn tại' }],
        );
      }
    }
  }
}
