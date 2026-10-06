import { Injectable } from '@nestjs/common';
import { Prisma, diem_hoc } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeService } from '../auth/scope/scope.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { paginate } from '../common/dto/pagination-query.dto';
import { normalizeNfcName } from '../common/utils/normalize-text.util';
import {
  ConflictAppException,
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import {
  CreateDiemHocDto,
  QueryDiemHocDto,
  UpdateDiemHocDto,
} from './dto/diem-hoc.dto';

// Thông tin điểm học trả kèm mỗi buổi học (lịch, cổng học viên).
export const DIEM_HOC_TOM_TAT = {
  id: true,
  ma_diem_hoc: true,
  ten: true,
  dia_chi: true,
  nguoi_lien_he: true,
  sdt_lien_he: true,
} satisfies Prisma.diem_hocSelect;

// T10 (issue #2): danh mục điểm học trực tiếp.
// - Ghi: quan_tri (người hỗ trợ giảng viên thêm sau — ADR 0004 G12).
// - Đọc: quan_tri thấy hết; so_gddt/phong_vhxh/truong thấy điểm học thuộc
//   đơn vị trong phạm vi HOẶC đang dùng cho buổi học của khóa mình xem được
//   (R1/R2, ScopeService.getKhoaIdsXemDuoc).
@Injectable()
export class DiemHocService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: ScopeService,
  ) {}

  private async wherePhamVi(
    caller: AuthenticatedUser,
  ): Promise<Prisma.diem_hocWhereInput | null> {
    // ADR 0004 G12: người hỗ trợ giảng viên chọn điểm học cho mọi buổi của
    // khóa mình — cần thấy toàn bộ danh mục.
    if (caller.vai_tro === 'ho_tro_giang_vien') return null;
    const donViIds = await this.scopeService.getAccessibleDonViIds(caller);
    if (donViIds === 'ALL') return null;
    const khoaIds = await this.scopeService.getKhoaIdsXemDuoc(caller);
    const khoaList = khoaIds === 'ALL' ? [] : khoaIds;
    return {
      OR: [
        { don_vi_id: { in: donViIds } },
        { lich_hoc: { some: { lop: { khoa_id: { in: khoaList } } } } },
      ],
    };
  }

  async findAll(query: QueryDiemHocDto, caller: AuthenticatedUser) {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const dieuKien: Prisma.diem_hocWhereInput[] = [];
    const phamVi = await this.wherePhamVi(caller);
    if (phamVi) dieuKien.push(phamVi);
    if (query.trang_thai) dieuKien.push({ trang_thai: query.trang_thai });
    if (query.dia_ban_id) dieuKien.push({ dia_ban_id: query.dia_ban_id });
    const q = query.q?.trim();
    if (q) {
      dieuKien.push({
        OR: [
          { ten: { contains: q, mode: 'insensitive' } },
          { ma_diem_hoc: { contains: q, mode: 'insensitive' } },
          { dia_chi: { contains: q, mode: 'insensitive' } },
        ],
      });
    }
    const where: Prisma.diem_hocWhereInput = { AND: dieuKien };

    const [data, total] = await Promise.all([
      this.prisma.diem_hoc.findMany({
        where,
        include: {
          dia_ban: { select: { id: true, ten: true, parent_id: true } },
          don_vi: { select: { id: true, ten_don_vi: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ trang_thai: 'asc' }, { ten: 'asc' }],
      }),
      this.prisma.diem_hoc.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async findOne(id: string, caller: AuthenticatedUser) {
    const phamVi = await this.wherePhamVi(caller);
    const diemHoc = await this.prisma.diem_hoc.findFirst({
      where: phamVi ? { AND: [{ id }, phamVi] } : { id },
      include: {
        dia_ban: { select: { id: true, ten: true, parent_id: true } },
        don_vi: { select: { id: true, ten_don_vi: true } },
      },
    });
    if (!diemHoc) throw new NotFoundAppException('Không tìm thấy điểm học');
    return diemHoc;
  }

  async create(
    dto: CreateDiemHocDto,
    caller: AuthenticatedUser,
  ): Promise<diem_hoc> {
    const ma = dto.ma_diem_hoc.trim();
    await this.assertMaChuaDung(ma);
    await this.assertDiaBanVaDonVi(dto.dia_ban_id, dto.don_vi_id);
    return this.prisma.diem_hoc.create({
      data: {
        ma_diem_hoc: ma,
        ten: normalizeNfcName(dto.ten),
        dia_chi: dto.dia_chi.trim(),
        dia_ban_id: dto.dia_ban_id,
        don_vi_id: dto.don_vi_id,
        suc_chua: dto.suc_chua,
        so_phong: dto.so_phong,
        nguoi_lien_he: dto.nguoi_lien_he?.trim() || undefined,
        sdt_lien_he: dto.sdt_lien_he?.trim() || undefined,
        ghi_chu_csvc: dto.ghi_chu_csvc?.trim() || undefined,
        tao_boi: caller.id,
      },
    });
  }

  async update(id: string, dto: UpdateDiemHocDto): Promise<diem_hoc> {
    const existing = await this.prisma.diem_hoc.findUnique({ where: { id } });
    if (!existing) throw new NotFoundAppException('Không tìm thấy điểm học');
    const coTruong = Object.values(dto).some((v) => v !== undefined);
    if (!coTruong) {
      throw new ValidationException(
        'Body rỗng — phải có ít nhất 1 trường hợp lệ để sửa',
      );
    }
    const ma = dto.ma_diem_hoc?.trim();
    if (ma && ma !== existing.ma_diem_hoc) await this.assertMaChuaDung(ma);
    if (dto.dia_ban_id || dto.don_vi_id) {
      await this.assertDiaBanVaDonVi(
        dto.dia_ban_id ?? existing.dia_ban_id,
        dto.don_vi_id ?? undefined,
      );
    }
    return this.prisma.diem_hoc.update({
      where: { id },
      data: {
        ma_diem_hoc: ma,
        ten: dto.ten !== undefined ? normalizeNfcName(dto.ten) : undefined,
        dia_chi: dto.dia_chi?.trim(),
        dia_ban_id: dto.dia_ban_id,
        don_vi_id: dto.don_vi_id,
        suc_chua: dto.suc_chua,
        so_phong: dto.so_phong,
        nguoi_lien_he: dto.nguoi_lien_he,
        sdt_lien_he: dto.sdt_lien_he,
        ghi_chu_csvc: dto.ghi_chu_csvc,
        trang_thai: dto.trang_thai,
      },
    });
  }

  // Dùng khi gán điểm học vào buổi học: phải tồn tại và đang hoạt động.
  async layDiemHocDangHoatDong(id: string): Promise<diem_hoc> {
    const diemHoc = await this.prisma.diem_hoc.findUnique({ where: { id } });
    if (!diemHoc || diemHoc.trang_thai !== 'active') {
      throw new ValidationException(
        'diem_hoc_id không tồn tại hoặc đã ngừng hoạt động',
        [{ field: 'diem_hoc_id', message: 'Không hợp lệ' }],
      );
    }
    return diemHoc;
  }

  // Rule 🟡 T10: số lớp học cùng lúc tại 1 điểm học vượt so_phong → cảnh báo,
  // không chặn. Đếm các LỚP KHÁC có buổi chồng giờ ở cùng điểm học, cộng lớp
  // đang xét. Không có so_phong → không cảnh báo.
  async canhBaoVuotSoPhong(input: {
    diem_hoc_id: string;
    lop_id: string;
    bat_dau: Date;
    ket_thuc: Date;
  }): Promise<string[]> {
    const diemHoc = await this.prisma.diem_hoc.findUnique({
      where: { id: input.diem_hoc_id },
      select: { ten: true, so_phong: true },
    });
    if (!diemHoc?.so_phong) return [];
    const trungGio = await this.prisma.lich_hoc_lop.findMany({
      where: {
        diem_hoc_id: input.diem_hoc_id,
        lop_id: { not: input.lop_id },
        thoi_gian_bat_dau: { lt: input.ket_thuc },
        thoi_gian_ket_thuc: { gt: input.bat_dau },
      },
      select: { lop_id: true },
      distinct: ['lop_id'],
    });
    const soLop = trungGio.length + 1;
    if (soLop <= diemHoc.so_phong) return [];
    return [
      `Điểm học "${diemHoc.ten}" có ${soLop} lớp học cùng lúc, vượt số phòng (${diemHoc.so_phong})`,
    ];
  }

  private async assertMaChuaDung(ma: string) {
    const trung = await this.prisma.diem_hoc.findUnique({
      where: { ma_diem_hoc: ma },
    });
    if (trung) {
      throw new ConflictAppException(`Mã điểm học "${ma}" đã tồn tại`, [
        { field: 'ma_diem_hoc', message: 'Đã tồn tại' },
      ]);
    }
  }

  private async assertDiaBanVaDonVi(diaBanId: string, donViId?: string) {
    const diaBan = await this.prisma.dia_danh.findUnique({
      where: { id: diaBanId },
    });
    if (!diaBan) {
      throw new ValidationException('dia_ban_id không tồn tại', [
        { field: 'dia_ban_id', message: 'Không tồn tại' },
      ]);
    }
    if (donViId) {
      const donVi = await this.prisma.don_vi_cong_tac.findUnique({
        where: { id: donViId },
      });
      if (!donVi) {
        throw new ValidationException('don_vi_id không tồn tại', [
          { field: 'don_vi_id', message: 'Không tồn tại' },
        ]);
      }
    }
  }
}
