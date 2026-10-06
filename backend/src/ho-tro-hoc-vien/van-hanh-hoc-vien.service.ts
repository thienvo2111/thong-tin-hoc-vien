import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  ConflictAppException,
  ForbiddenAppException,
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { NhatKyService } from '../nhat-ky/nhat-ky.service';
import { HoTroHocVienScopeService } from './ho-tro-hoc-vien-scope.service';
import { BaoVangDto, TaoDeNghiDoiLopDto } from './dto/van-hanh-hoc-vien.dto';

// ADR 0004 G13/G14 (issue #18): người hỗ trợ học viên báo vắng và đề nghị
// đổi lớp cho học viên CỤM MÌNH. Ngoài phạm vi → 404 (như ADR 0003).
@Injectable()
export class VanHanhHocVienService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: HoTroHocVienScopeService,
    private readonly nhatKy: NhatKyService,
  ) {}

  /** Đăng ký học của học viên thuộc cụm của tôi, khớp điều kiện thêm. */
  private async dangKyTrongCum(
    nguoiDungId: string,
    hocVienId: string,
    them: Prisma.dang_ky_hocWhereInput,
  ) {
    const cumIds = await this.scope.cumIdsCuaToi(nguoiDungId);
    const dk = cumIds.length
      ? await this.prisma.dang_ky_hoc.findFirst({
          where: { hoc_vien_id: hocVienId, cum_id: { in: cumIds }, ...them },
          select: { id: true, khoa_id: true },
        })
      : null;
    if (!dk)
      throw new NotFoundAppException(
        'Không tìm thấy học viên trong cụm của bạn',
      );
    return dk;
  }

  // Buổi phải thuộc lớp học viên được phân ở giai đoạn đó, và chưa kết thúc.
  private async buoiCuaHocVien(
    user: AuthenticatedUser,
    hocVienId: string,
    lichHocId: string,
  ) {
    const lich = await this.prisma.lich_hoc_lop.findUnique({
      where: { id: lichHocId },
      select: {
        id: true,
        lop_id: true,
        giai_doan_id: true,
        buoi_so: true,
        thoi_gian_ket_thuc: true,
      },
    });
    if (!lich) throw new NotFoundAppException('Không tìm thấy buổi học');
    const dk = await this.dangKyTrongCum(user.id, hocVienId, {
      phan_lop_giai_doan: {
        some: { lop_id: lich.lop_id, giai_doan_id: lich.giai_doan_id },
      },
    });
    if (lich.thoi_gian_ket_thuc <= new Date()) {
      throw new ValidationException(
        'Buổi học đã kết thúc — không báo vắng được',
      );
    }
    return { lich, dk };
  }

  async baoVang(user: AuthenticatedUser, hocVienId: string, dto: BaoVangDto) {
    const { lich, dk } = await this.buoiCuaHocVien(
      user,
      hocVienId,
      dto.lich_hoc_id,
    );
    const lyDo = dto.ly_do.normalize('NFC').trim();
    const bv = await this.prisma.bao_vang.upsert({
      where: {
        dang_ky_hoc_id_lich_hoc_id: {
          dang_ky_hoc_id: dk.id,
          lich_hoc_id: lich.id,
        },
      },
      create: {
        dang_ky_hoc_id: dk.id,
        lich_hoc_id: lich.id,
        ly_do: lyDo,
        nguoi_ghi: user.id,
      },
      update: { ly_do: lyDo, nguoi_ghi: user.id, ghi_luc: new Date() },
    });
    await this.nhatKy.ghi({
      hanh_dong: 'bao_vang',
      hoc_vien_id: hocVienId,
      mo_ta: `Báo vắng buổi ${lich.buoi_so}: ${lyDo}`,
      chi_tiet: { lich_hoc_id: lich.id },
    });
    return bv;
  }

  async huyBaoVang(
    user: AuthenticatedUser,
    hocVienId: string,
    lichHocId: string,
  ) {
    const { lich, dk } = await this.buoiCuaHocVien(user, hocVienId, lichHocId);
    const { count } = await this.prisma.bao_vang.deleteMany({
      where: { dang_ky_hoc_id: dk.id, lich_hoc_id: lich.id },
    });
    if (!count) throw new NotFoundAppException('Buổi này chưa có báo vắng');
    await this.nhatKy.ghi({
      hanh_dong: 'bao_vang',
      hoc_vien_id: hocVienId,
      mo_ta: `Hủy báo vắng buổi ${lich.buoi_so}`,
      chi_tiet: { lich_hoc_id: lich.id, huy: true },
    });
  }

  private dkCoGiaiDoan(gdId: string): Prisma.dang_ky_hocWhereInput {
    return { khoa: { giai_doan: { some: { id: gdId } } } };
  }

  /** Lớp cùng khóa có buổi ở giai đoạn này (để chọn lớp đề nghị), kèm sĩ số hiện tại. */
  async lopCoTheDoi(user: AuthenticatedUser, hocVienId: string, gdId: string) {
    const dk = await this.dangKyTrongCum(
      user.id,
      hocVienId,
      this.dkCoGiaiDoan(gdId),
    );
    const [hienTai, dsLop] = await Promise.all([
      this.prisma.phan_lop_giai_doan.findUnique({
        where: {
          dang_ky_hoc_id_giai_doan_id: {
            dang_ky_hoc_id: dk.id,
            giai_doan_id: gdId,
          },
        },
        select: { lop_id: true },
      }),
      this.prisma.lop_hoc.findMany({
        where: {
          khoa_id: dk.khoa_id,
          trang_thai: 'active',
          lich_hoc: { some: { giai_doan_id: gdId } },
        },
        select: {
          id: true,
          ten_lop: true,
          loai_lop: true,
          si_so_toi_da: true,
          _count: {
            select: { phan_lop_giai_doan: { where: { giai_doan_id: gdId } } },
          },
        },
        orderBy: { ten_lop: 'asc' },
      }),
    ]);
    return {
      lop_hien_tai_id: hienTai?.lop_id ?? null,
      lop: dsLop.map(({ _count, ...l }) => ({
        ...l,
        si_so: _count.phan_lop_giai_doan,
      })),
    };
  }

  async taoDeNghi(
    user: AuthenticatedUser,
    hocVienId: string,
    dto: TaoDeNghiDoiLopDto,
  ) {
    const dk = await this.dangKyTrongCum(
      user.id,
      hocVienId,
      this.dkCoGiaiDoan(dto.giai_doan_id),
    );
    const lopHopLe = await this.prisma.lop_hoc.count({
      where: {
        id: dto.lop_de_nghi_id,
        khoa_id: dk.khoa_id,
        trang_thai: 'active',
        lich_hoc: { some: { giai_doan_id: dto.giai_doan_id } },
      },
    });
    if (!lopHopLe) {
      throw new ValidationException('Lớp đề nghị không hợp lệ', [
        {
          field: 'lop_de_nghi_id',
          message: 'Lớp phải cùng khóa và có buổi học ở giai đoạn này',
        },
      ]);
    }
    const hienTai = await this.prisma.phan_lop_giai_doan.findUnique({
      where: {
        dang_ky_hoc_id_giai_doan_id: {
          dang_ky_hoc_id: dk.id,
          giai_doan_id: dto.giai_doan_id,
        },
      },
      select: { lop_id: true },
    });
    if (hienTai?.lop_id === dto.lop_de_nghi_id) {
      throw new ValidationException('Học viên đang ở lớp này', [
        { field: 'lop_de_nghi_id', message: 'Học viên đang ở lớp này' },
      ]);
    }
    try {
      const dn = await this.prisma.de_nghi_doi_lop.create({
        data: {
          dang_ky_hoc_id: dk.id,
          giai_doan_id: dto.giai_doan_id,
          lop_hien_tai_id: hienTai?.lop_id ?? null,
          lop_de_nghi_id: dto.lop_de_nghi_id,
          ly_do: dto.ly_do.normalize('NFC').trim(),
          nguoi_tao: user.id,
        },
      });
      await this.nhatKy.ghi({
        hanh_dong: 'de_nghi_doi_lop',
        hoc_vien_id: hocVienId,
        mo_ta: 'Tạo đề nghị đổi lớp',
        chi_tiet: { de_nghi_id: dn.id, lop_de_nghi_id: dto.lop_de_nghi_id },
      });
      return dn;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictAppException(
          'Học viên đã có đề nghị đổi lớp đang chờ duyệt ở giai đoạn này',
        );
      }
      throw e;
    }
  }

  /** Hủy đề nghị do chính mình tạo, khi còn chờ duyệt. */
  async huyDeNghi(user: AuthenticatedUser, deNghiId: string) {
    const dn = await this.prisma.de_nghi_doi_lop.findUnique({
      where: { id: deNghiId },
      select: {
        nguoi_tao: true,
        dang_ky_hoc: { select: { hoc_vien_id: true } },
      },
    });
    if (!dn) throw new NotFoundAppException('Không tìm thấy đề nghị');
    await this.scope.damBaoTrongPhamVi(user.id, dn.dang_ky_hoc.hoc_vien_id);
    if (dn.nguoi_tao !== user.id) {
      throw new ForbiddenAppException('Chỉ người tạo được hủy đề nghị');
    }
    const { count } = await this.prisma.de_nghi_doi_lop.updateMany({
      where: { id: deNghiId, trang_thai: 'cho_duyet' },
      data: { trang_thai: 'da_huy', xu_ly_luc: new Date() },
    });
    if (!count) throw new ConflictAppException('Đề nghị đã được xử lý');
    await this.nhatKy.ghi({
      hanh_dong: 'de_nghi_doi_lop',
      hoc_vien_id: dn.dang_ky_hoc.hoc_vien_id,
      mo_ta: 'Hủy đề nghị đổi lớp',
      chi_tiet: { de_nghi_id: deNghiId, huy: true },
    });
  }

  /** Báo vắng + đề nghị của 1 học viên (hiện trong chi tiết học viên → Học tập). */
  async cuaHocVien(hocVienId: string) {
    const [baoVang, deNghi] = await Promise.all([
      this.prisma.bao_vang.findMany({
        where: { dang_ky_hoc: { hoc_vien_id: hocVienId } },
        select: {
          lich_hoc_id: true,
          ly_do: true,
          ghi_luc: true,
          nguoi: { select: { ho_ten: true } },
        },
      }),
      this.prisma.de_nghi_doi_lop.findMany({
        where: { dang_ky_hoc: { hoc_vien_id: hocVienId } },
        select: {
          id: true,
          giai_doan_id: true,
          ly_do: true,
          trang_thai: true,
          tao_luc: true,
          xu_ly_luc: true,
          ghi_chu_xu_ly: true,
          nguoi_tao: true,
          lop_hien_tai: { select: { id: true, ten_lop: true } },
          lop_de_nghi: { select: { id: true, ten_lop: true } },
          tao_boi: { select: { ho_ten: true } },
          xu_ly_boi: { select: { ho_ten: true } },
        },
        orderBy: { tao_luc: 'desc' },
      }),
    ]);
    return {
      bao_vang: baoVang.map(({ nguoi, ...b }) => ({
        ...b,
        nguoi_ghi: nguoi?.ho_ten ?? null,
      })),
      de_nghi_doi_lop: deNghi.map(({ tao_boi, xu_ly_boi, ...d }) => ({
        ...d,
        nguoi_tao_ten: tao_boi?.ho_ten ?? null,
        nguoi_xu_ly: xu_ly_boi?.ho_ten ?? null,
      })),
    };
  }
}
