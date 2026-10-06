import { Injectable } from '@nestjs/common';
import { trang_thai_de_nghi } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  ConflictAppException,
  NotFoundAppException,
} from '../common/exceptions/app.exceptions';
import { NhatKyService } from '../nhat-ky/nhat-ky.service';
import { HoTroGiangVienScopeService } from './ho-tro-giang-vien-scope.service';

// ADR 0004 G14 (issue #18): nhóm hỗ trợ GV của khóa duyệt/từ chối đề nghị đổi
// lớp. Mọi chuyển trạng thái là UPDATE có điều kiện trang_thai='cho_duyet'
// (như H11) — 2 người cùng duyệt: đúng 1 thành công, người kia 409.
@Injectable()
export class DeNghiDoiLopService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: HoTroGiangVienScopeService,
    private readonly nhatKy: NhatKyService,
  ) {}

  async danhSach(
    user: AuthenticatedUser,
    trangThai: trang_thai_de_nghi | undefined,
  ) {
    const ds = await this.prisma.de_nghi_doi_lop.findMany({
      where: {
        lop_de_nghi: await this.scope.whereLopTrongPhamVi(user.id),
        ...(trangThai ? { trang_thai: trangThai } : {}),
      },
      select: {
        id: true,
        giai_doan_id: true,
        ly_do: true,
        trang_thai: true,
        tao_luc: true,
        xu_ly_luc: true,
        ghi_chu_xu_ly: true,
        dang_ky_hoc: {
          select: {
            hoc_vien: {
              select: {
                id: true,
                ho_ten: true,
                don_vi_cong_tac: { select: { ten_don_vi: true } },
              },
            },
            cum: { select: { ten_cum: true } },
          },
        },
        giai_doan: { select: { thu_tu: true, ten_giai_doan: true } },
        lop_hien_tai: { select: { id: true, ten_lop: true } },
        lop_de_nghi: {
          select: {
            id: true,
            ten_lop: true,
            si_so_toi_da: true,
            khoa: { select: { ma_khoa: true } },
          },
        },
        tao_boi: { select: { ho_ten: true } },
        xu_ly_boi: { select: { ho_ten: true } },
      },
      orderBy: { tao_luc: trangThai === 'cho_duyet' ? 'asc' : 'desc' },
      take: 500,
    });
    const siSo = ds.length
      ? await this.prisma.phan_lop_giai_doan.groupBy({
          by: ['lop_id', 'giai_doan_id'],
          where: {
            OR: ds.map((d) => ({
              lop_id: d.lop_de_nghi.id,
              giai_doan_id: d.giai_doan_id,
            })),
          },
          _count: { _all: true },
        })
      : [];
    return ds.map(({ dang_ky_hoc, tao_boi, xu_ly_boi, ...d }) => ({
      ...d,
      hoc_vien: {
        id: dang_ky_hoc.hoc_vien.id,
        ho_ten: dang_ky_hoc.hoc_vien.ho_ten,
        don_vi: dang_ky_hoc.hoc_vien.don_vi_cong_tac.ten_don_vi,
        cum: dang_ky_hoc.cum?.ten_cum ?? null,
      },
      si_so_lop_de_nghi:
        siSo.find(
          (s) =>
            s.lop_id === d.lop_de_nghi.id && s.giai_doan_id === d.giai_doan_id,
        )?._count._all ?? 0,
      nguoi_tao: tao_boi?.ho_ten ?? null,
      nguoi_xu_ly: xu_ly_boi?.ho_ten ?? null,
    }));
  }

  async demChoDuyet(user: AuthenticatedUser): Promise<number> {
    return this.prisma.de_nghi_doi_lop.count({
      where: {
        lop_de_nghi: await this.scope.whereLopTrongPhamVi(user.id),
        trang_thai: 'cho_duyet',
      },
    });
  }

  private async layTrongPhamVi(user: AuthenticatedUser, id: string) {
    const dn = await this.prisma.de_nghi_doi_lop.findUnique({
      where: { id },
      select: {
        id: true,
        dang_ky_hoc_id: true,
        giai_doan_id: true,
        lop_hien_tai_id: true,
        lop_de_nghi_id: true,
        dang_ky_hoc: { select: { hoc_vien_id: true } },
        lop_de_nghi: { select: { ten_lop: true, si_so_toi_da: true } },
      },
    });
    if (!dn) throw new NotFoundAppException('Không tìm thấy đề nghị');
    await this.scope.damBaoLopTrongPhamVi(user.id, dn.lop_de_nghi_id);
    return dn;
  }

  /** Duyệt = cập nhật phan_lop_giai_doan; phân lớp hiện tại đã khác lúc tạo → 409. Vượt sĩ số chỉ cảnh báo. */
  async duyet(user: AuthenticatedUser, id: string, ghiChu?: string) {
    const dn = await this.layTrongPhamVi(user, id);
    const siSo = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.de_nghi_doi_lop.updateMany({
        where: { id, trang_thai: 'cho_duyet' },
        data: {
          trang_thai: 'da_duyet',
          nguoi_xu_ly: user.id,
          xu_ly_luc: new Date(),
          ghi_chu_xu_ly: ghiChu?.normalize('NFC').trim() || null,
        },
      });
      if (!count) throw new ConflictAppException('Đề nghị đã được xử lý');
      const khoa = {
        dang_ky_hoc_id: dn.dang_ky_hoc_id,
        giai_doan_id: dn.giai_doan_id,
      };
      const hienTai = await tx.phan_lop_giai_doan.findUnique({
        where: { dang_ky_hoc_id_giai_doan_id: khoa },
        select: { lop_id: true },
      });
      if ((hienTai?.lop_id ?? null) !== dn.lop_hien_tai_id) {
        throw new ConflictAppException(
          'Phân lớp của học viên đã thay đổi sau khi tạo đề nghị — hãy từ chối và tạo đề nghị mới',
        );
      }
      await tx.phan_lop_giai_doan.upsert({
        where: { dang_ky_hoc_id_giai_doan_id: khoa },
        create: { ...khoa, lop_id: dn.lop_de_nghi_id },
        update: { lop_id: dn.lop_de_nghi_id },
      });
      return tx.phan_lop_giai_doan.count({
        where: { lop_id: dn.lop_de_nghi_id, giai_doan_id: dn.giai_doan_id },
      });
    });
    await this.nhatKy.ghi({
      hanh_dong: 'duyet_doi_lop',
      hoc_vien_id: dn.dang_ky_hoc.hoc_vien_id,
      mo_ta: `Duyệt đổi sang ${dn.lop_de_nghi.ten_lop}`,
      chi_tiet: {
        de_nghi_id: id,
        giai_doan_id: dn.giai_doan_id,
        tu_lop_id: dn.lop_hien_tai_id,
        den_lop_id: dn.lop_de_nghi_id,
      },
    });
    const toiDa = dn.lop_de_nghi.si_so_toi_da;
    return {
      trang_thai: 'da_duyet' as const,
      canh_bao:
        toiDa && siSo > toiDa
          ? [
              `${dn.lop_de_nghi.ten_lop} có ${siSo} học viên, vượt sĩ số tối đa ${toiDa}`,
            ]
          : [],
    };
  }

  async tuChoi(user: AuthenticatedUser, id: string, ghiChu: string) {
    const dn = await this.layTrongPhamVi(user, id);
    const { count } = await this.prisma.de_nghi_doi_lop.updateMany({
      where: { id, trang_thai: 'cho_duyet' },
      data: {
        trang_thai: 'tu_choi',
        nguoi_xu_ly: user.id,
        xu_ly_luc: new Date(),
        ghi_chu_xu_ly: ghiChu.normalize('NFC').trim(),
      },
    });
    if (!count) throw new ConflictAppException('Đề nghị đã được xử lý');
    await this.nhatKy.ghi({
      hanh_dong: 'de_nghi_doi_lop',
      hoc_vien_id: dn.dang_ky_hoc.hoc_vien_id,
      mo_ta: 'Từ chối đề nghị đổi lớp',
      chi_tiet: { de_nghi_id: id, tu_choi: true },
    });
    return { trang_thai: 'tu_choi' as const };
  }
}
