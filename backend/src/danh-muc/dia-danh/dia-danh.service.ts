import { Injectable } from '@nestjs/common';
import { Prisma, dia_danh } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeNfcName } from '../../common/utils/normalize-text.util';
import {
  ConflictAppException,
  ValidationException,
} from '../../common/exceptions/app.exceptions';
import { paginate } from '../../common/dto/pagination-query.dto';
import {
  CreateDiaDanhDto,
  QueryDiaDanhDto,
  UpdateDiaDanhDto,
} from '../dto/dia-danh.dto';

// Rule tham chiếu: validation-checklist.md #37, #38, #41.
// Dùng chung bởi DiaDanhController (nhập tay) VÀ ImportService (nhập hàng
// loạt) — validate() tách riêng khỏi create() để import có thể chạy dry-run
// (preview) mà không ghi DB.
@Injectable()
export class DiaDanhService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryDiaDanhDto) {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const where: Prisma.dia_danhWhereInput = {};
    if (query.cap) where.cap = query.cap;
    if (query.parent_id) where.parent_id = query.parent_id;
    if (query.trang_thai) where.trang_thai = query.trang_thai;
    if (query.q) {
      where.ten = { contains: query.q, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.dia_danh.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { ten: 'asc' },
      }),
      this.prisma.dia_danh.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async create(
    dto: CreateDiaDanhDto,
    nguonImportId?: string,
  ): Promise<dia_danh> {
    const ma = dto.ma.trim();
    const ten = normalizeNfcName(dto.ten);
    await this.checkValid({
      ma,
      cap: dto.cap,
      parent_id: dto.parent_id ?? null,
    });

    return this.prisma.dia_danh.create({
      data: {
        ma,
        ten,
        cap: dto.cap,
        parent_id: dto.parent_id ?? null,
        nguon_import_id: nguonImportId,
      },
    });
  }

  async update(id: string, dto: UpdateDiaDanhDto): Promise<dia_danh> {
    const existing = await this.prisma.dia_danh.findUnique({ where: { id } });
    if (!existing) {
      throw new ValidationException('Không tìm thấy địa danh', [
        { field: 'id', message: 'Không tồn tại' },
      ]);
    }

    const merged = {
      ma: dto.ma !== undefined ? dto.ma.trim() : existing.ma,
      cap: dto.cap ?? existing.cap,
      parent_id:
        dto.parent_id !== undefined ? dto.parent_id : existing.parent_id,
    };
    await this.checkValid(merged, id);

    return this.prisma.dia_danh.update({
      where: { id },
      data: {
        ma: merged.ma,
        ten: dto.ten !== undefined ? normalizeNfcName(dto.ten) : undefined,
        cap: merged.cap,
        parent_id: merged.parent_id,
        trang_thai: dto.trang_thai,
      },
    });
  }

  // Rule #37 (unique ma) + #38 (parent_id bắt buộc/cấm theo cap). excludeId
  // dùng khi update để không tự đụng chính bản ghi đang sửa lúc kiểm tra
  // trùng mã.
  async checkValid(
    dto: { ma: string; cap: dia_danh['cap']; parent_id: string | null },
    excludeId?: string,
  ) {
    if (dto.cap === 'tinh_thanh' && dto.parent_id) {
      throw new ValidationException(
        'Địa danh cấp tỉnh/thành không được có parent_id',
        [{ field: 'parent_id', message: 'Phải để trống khi cap=tinh_thanh' }],
      );
    }
    if (dto.cap === 'phuong_xa_dac_khu' && !dto.parent_id) {
      throw new ValidationException(
        'Địa danh cấp phường/xã bắt buộc có parent_id',
        [{ field: 'parent_id', message: 'Bắt buộc khi cap=phuong_xa_dac_khu' }],
      );
    }
    if (dto.parent_id) {
      const parent = await this.prisma.dia_danh.findUnique({
        where: { id: dto.parent_id },
      });
      if (!parent) {
        throw new ValidationException('parent_id không tồn tại', [
          { field: 'parent_id', message: 'Không tồn tại' },
        ]);
      }
      if (parent.cap !== 'tinh_thanh') {
        throw new ValidationException(
          'parent_id phải là địa danh cấp tỉnh/thành',
          [
            {
              field: 'parent_id',
              message: 'Phải trỏ tới địa danh cấp tinh_thanh',
            },
          ],
        );
      }
    }

    const trung = await this.prisma.dia_danh.findUnique({
      where: { ma: dto.ma },
    });
    if (trung && trung.id !== excludeId) {
      throw new ConflictAppException(`Mã "${dto.ma}" đã tồn tại`, [
        { field: 'ma', message: 'Mã đã tồn tại' },
      ]);
    }
  }
}
