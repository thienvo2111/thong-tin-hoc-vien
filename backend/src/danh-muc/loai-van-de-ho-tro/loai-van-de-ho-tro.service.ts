import { Injectable } from '@nestjs/common';
import { Prisma, loai_van_de_ho_tro } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeNfcName } from '../../common/utils/normalize-text.util';
import { ConflictAppException } from '../../common/exceptions/app.exceptions';
import { paginate } from '../../common/dto/pagination-query.dto';
import {
  CreateLoaiVanDeHoTroDto,
  QueryLoaiVanDeHoTroDto,
  UpdateLoaiVanDeHoTroDto,
} from '../dto/loai-van-de-ho-tro.dto';

@Injectable()
export class LoaiVanDeHoTroService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryLoaiVanDeHoTroDto) {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const where: Prisma.loai_van_de_ho_troWhereInput = {};
    if (query.trang_thai) where.trang_thai = query.trang_thai;

    const [data, total] = await Promise.all([
      this.prisma.loai_van_de_ho_tro.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { ten: 'asc' },
      }),
      this.prisma.loai_van_de_ho_tro.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async create(dto: CreateLoaiVanDeHoTroDto): Promise<loai_van_de_ho_tro> {
    const ten = normalizeNfcName(dto.ten);
    await this.checkTrung(ten);
    return this.prisma.loai_van_de_ho_tro.create({
      data: { ten, noi_dung_goi_y: dto.noi_dung_goi_y },
    });
  }

  async update(id: string, dto: UpdateLoaiVanDeHoTroDto): Promise<loai_van_de_ho_tro> {
    const existing = await this.prisma.loai_van_de_ho_tro.findUniqueOrThrow({
      where: { id },
    });
    const ten = dto.ten !== undefined ? normalizeNfcName(dto.ten) : existing.ten;
    if (ten !== existing.ten) await this.checkTrung(ten, id);

    return this.prisma.loai_van_de_ho_tro.update({
      where: { id },
      data: {
        ten,
        noi_dung_goi_y: dto.noi_dung_goi_y ?? existing.noi_dung_goi_y,
        trang_thai: dto.trang_thai,
      },
    });
  }

  private async checkTrung(ten: string, excludeId?: string): Promise<void> {
    const trung = await this.prisma.loai_van_de_ho_tro.findUnique({ where: { ten } });
    if (trung && trung.id !== excludeId) {
      throw new ConflictAppException(`Loại vấn đề "${ten}" đã tồn tại`, [
        { field: 'ten', message: 'Đã tồn tại' },
      ]);
    }
  }
}
