import { Injectable } from '@nestjs/common';
import { Prisma, dot_nhu_cau_muc } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConflictAppException,
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { TaoDotNhuCauMucDto } from './dto/tao-dot-nhu-cau-muc.dto';
import { SuaDotNhuCauMucDto } from './dto/sua-dot-nhu-cau-muc.dto';

type Tx = Prisma.TransactionClient;
export type TrangThaiDot = 'chua_mo' | 'dang_mo' | 'da_dong';

export interface DotNhuCauMuc {
  id: string;
  khoa_id: string;
  ten_dot: string;
  mo_luc: Date;
  dong_luc: Date;
  trang_thai: TrangThaiDot;
  so_ban_ghi: number;
}

export function trangThaiDot(
  dot: Pick<dot_nhu_cau_muc, 'mo_luc' | 'dong_luc'>,
  now = new Date(),
): TrangThaiDot {
  if (now < dot.mo_luc) return 'chua_mo';
  return now < dot.dong_luc ? 'dang_mo' : 'da_dong';
}

// ADR 0013 — đợt nhu cầu mức học. Chỉ ghi dot_nhu_cau_muc, không đụng
// dang_ky_hoc.muc_* (D1).
@Injectable()
export class DotNhuCauMucService {
  constructor(private readonly prisma: PrismaService) {}

  async layDanhSach(khoaId: string): Promise<DotNhuCauMuc[]> {
    const dots = await this.prisma.dot_nhu_cau_muc.findMany({
      where: { khoa_id: khoaId },
      orderBy: { mo_luc: 'desc' },
      include: { _count: { select: { nhu_cau: true } } },
    });
    const now = new Date();
    return dots.map((d) => this.toDto(d, d._count.nhu_cau, now));
  }

  async taoDot(
    khoaId: string,
    dto: TaoDotNhuCauMucDto,
    callerId: string,
  ): Promise<DotNhuCauMuc> {
    const moLuc = new Date(dto.mo_luc);
    const dongLuc = new Date(dto.dong_luc);
    this.kiemTraThoiGian(moLuc, dongLuc);

    return this.prisma.$transaction(async (tx) => {
      await this.khoaKhoa(tx, khoaId);
      await this.kiemTraChongCheo(tx, khoaId, moLuc, dongLuc);
      const dot = await tx.dot_nhu_cau_muc.create({
        data: {
          khoa_id: khoaId,
          ten_dot: dto.ten_dot,
          mo_luc: moLuc,
          dong_luc: dongLuc,
          created_by: callerId,
        },
      });
      return this.toDto(dot, 0);
    });
  }

  async suaDot(id: string, dto: SuaDotNhuCauMucDto): Promise<DotNhuCauMuc> {
    const existing = await this.layDotHoacLoi(id);
    return this.prisma.$transaction(async (tx) => {
      await this.khoaKhoa(tx, existing.khoa_id);
      // Đọc lại sau khi giữ khóa để không đè giờ do request khác vừa sửa.
      const hienTai = await tx.dot_nhu_cau_muc.findUnique({ where: { id } });
      if (!hienTai) throw new NotFoundAppException('Không tìm thấy đợt');
      const moLuc = dto.mo_luc ? new Date(dto.mo_luc) : hienTai.mo_luc;
      const dongLuc = dto.dong_luc ? new Date(dto.dong_luc) : hienTai.dong_luc;
      this.kiemTraThoiGian(moLuc, dongLuc);
      await this.kiemTraChongCheo(tx, hienTai.khoa_id, moLuc, dongLuc, id);
      const dot = await tx.dot_nhu_cau_muc.update({
        where: { id },
        data: {
          ten_dot: dto.ten_dot ?? hienTai.ten_dot,
          mo_luc: moLuc,
          dong_luc: dongLuc,
          updated_at: new Date(),
        },
        include: { _count: { select: { nhu_cau: true } } },
      });
      return this.toDto(dot, dot._count.nhu_cau);
    });
  }

  async dongDot(id: string): Promise<DotNhuCauMuc> {
    const existing = await this.layDotHoacLoi(id);
    return this.prisma.$transaction(async (tx) => {
      await this.khoaKhoa(tx, existing.khoa_id);
      const dot = await tx.dot_nhu_cau_muc.findUnique({ where: { id } });
      if (!dot) throw new NotFoundAppException('Không tìm thấy đợt');
      const now = new Date();
      const trangThai = trangThaiDot(dot, now);
      if (trangThai !== 'dang_mo') {
        throw new ValidationException(
          trangThai === 'chua_mo'
            ? 'Đợt chưa mở, không thể đóng'
            : 'Đợt đã đóng',
        );
      }
      const capNhat = await tx.dot_nhu_cau_muc.update({
        where: { id },
        data: { dong_luc: now, updated_at: now },
        include: { _count: { select: { nhu_cau: true } } },
      });
      return this.toDto(capNhat, capNhat._count.nhu_cau, now);
    });
  }

  async xoaDot(id: string): Promise<void> {
    const existing = await this.layDotHoacLoi(id);
    await this.prisma.$transaction(async (tx) => {
      await this.khoaKhoa(tx, existing.khoa_id);
      const soBanGhi = await tx.nhu_cau_muc_hoc_vien.count({
        where: { dot_id: id },
      });
      if (soBanGhi > 0) {
        throw new ConflictAppException(
          'Đợt đã có dữ liệu nhu cầu, không thể xóa',
        );
      }
      await tx.dot_nhu_cau_muc.deleteMany({ where: { id } });
    });
  }

  // Các đợt của CÙNG khóa không được chồng thời gian (mẫu dot-xac-nhan).
  // Gọi trong $transaction sau khoaKhoa() để 2 request đồng thời tuần tự hóa.
  async kiemTraChongCheo(
    tx: Tx,
    khoaId: string,
    moLuc: Date,
    dongLuc: Date,
    excludeId?: string,
  ): Promise<void> {
    const chong = await tx.dot_nhu_cau_muc.findFirst({
      where: {
        khoa_id: khoaId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        mo_luc: { lt: dongLuc },
        dong_luc: { gt: moLuc },
      },
    });
    if (chong) {
      throw new ConflictAppException(
        `Thời gian trùng với đợt "${chong.ten_dot}"`,
        [{ field: 'mo_luc', message: `Trùng với đợt "${chong.ten_dot}"` }],
      );
    }
  }

  private kiemTraThoiGian(moLuc: Date, dongLuc: Date) {
    if (!(dongLuc > moLuc)) {
      throw new ValidationException('dong_luc phải sau mo_luc', [
        { field: 'dong_luc', message: 'Phải sau mo_luc' },
      ]);
    }
  }

  // Khóa dòng khoa_boi_duong; 404 nếu khóa không tồn tại.
  private async khoaKhoa(tx: Tx, khoaId: string) {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM khoa_boi_duong WHERE id = ${khoaId}::uuid FOR UPDATE`;
    if (rows.length === 0) {
      throw new NotFoundAppException('Không tìm thấy khóa bồi dưỡng');
    }
  }

  private async layDotHoacLoi(id: string) {
    const dot = await this.prisma.dot_nhu_cau_muc.findUnique({ where: { id } });
    if (!dot) throw new NotFoundAppException('Không tìm thấy đợt nhu cầu');
    return dot;
  }

  private toDto(
    d: dot_nhu_cau_muc,
    soBanGhi: number,
    now = new Date(),
  ): DotNhuCauMuc {
    return {
      id: d.id,
      khoa_id: d.khoa_id,
      ten_dot: d.ten_dot,
      mo_luc: d.mo_luc,
      dong_luc: d.dong_luc,
      trang_thai: trangThaiDot(d, now),
      so_ban_ghi: soBanGhi,
    };
  }
}
