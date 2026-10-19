import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundAppException } from '../common/exceptions/app.exceptions';
import { DoiBuoiHocQueryService } from '../doi-buoi-hoc/doi-buoi-hoc-query.service';

/** Lọc phạm vi Tình hình đi học (ADR 0011 P4). */
export type LoaiPhamVi = 'tat_ca' | 'cum' | 'lop';

export interface LopHoTroRef {
  id: string;
  ten_lop: string;
}

// ADR 0003 H1/H3: phạm vi của người hỗ trợ học viên = các cụm được phân công
// (phan_cong_ho_tro); học viên thuộc cụm qua dang_ky_hoc.cum_id. Điểm kiểm tra
// phạm vi DUY NHẤT cho mọi /ho-tro/* — truy vấn động mỗi request (gỡ phân
// công có hiệu lực ngay), không nằm trong JWT, không dùng ScopeService của
// cây đơn vị.
// ADR 0008 L2 (sửa bởi ADR 0011 P1): phạm vi = cụm ∪ LỚP được gắn
// (phan_cong_ho_tro_lop): học viên có phan_lop_giai_doan vào lớp của tôi
// HOẶC có đổi buổi da_duyet CÒN HIỆU LỰC vào buổi của lớp của tôi (quy tắc
// hiệu lực của DoiBuoiHocQueryService). 1 học viên đổi buổi giữa 2 lớp thuộc
// phạm vi của người hỗ trợ CẢ HAI lớp.
@Injectable()
export class HoTroHocVienScopeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly doiBuoiQuery: DoiBuoiHocQueryService,
  ) {}

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

  /** dang_ky_hoc thuộc các cụm — null khi không có cụm nào. */
  whereDangKyTheoCum(cumIds: string[]): Prisma.dang_ky_hocWhereInput | null {
    return cumIds.length > 0 ? { cum_id: { in: cumIds } } : null;
  }

  /**
   * dang_ky_hoc thuộc các lớp: phân lớp gốc vào lớp HOẶC đổi buổi đã duyệt
   * còn hiệu lực vào buổi của lớp (ADR 0011 P1) — null khi không có lớp nào.
   */
  async whereDangKyTheoLop(
    lopIds: string[],
  ): Promise<Prisma.dang_ky_hocWhereInput | null> {
    if (lopIds.length === 0) return null;
    const doiVao = await this.doiBuoiQuery.doiVaoLop(lopIds);
    const or: Prisma.dang_ky_hocWhereInput[] = [
      { phan_lop_giai_doan: { some: { lop_id: { in: lopIds } } } },
    ];
    if (doiVao.length > 0)
      or.push({
        id: { in: [...new Set(doiVao.map((d) => d.dang_ky_hoc_id))] },
      });
    return { OR: or };
  }

  /**
   * Điều kiện dang_ky_hoc thuộc phạm vi (cụm ∪ lớp) — null khi tôi chưa
   * được gắn cụm/lớp nào. `loai` thu hẹp về chỉ cụm / chỉ lớp (ADR 0011 P4).
   */
  async whereDangKyTrongPhamVi(
    nguoiDungId: string,
    loai: LoaiPhamVi = 'tat_ca',
  ): Promise<Prisma.dang_ky_hocWhereInput | null> {
    const [cumIds, lopIds] = await Promise.all([
      loai === 'lop' ? [] : this.cumIdsCuaToi(nguoiDungId),
      loai === 'cum' ? [] : this.lopIdsCuaToi(nguoiDungId),
    ]);
    const or = [
      this.whereDangKyTheoCum(cumIds),
      await this.whereDangKyTheoLop(lopIds),
    ].filter((w): w is Prisma.dang_ky_hocWhereInput => w !== null);
    if (or.length === 0) return null;
    return or.length === 1 ? or[0] : { OR: or };
  }

  /** dang_ky_hoc của 1 lớp được gắn cho tôi (ngoài phạm vi → 404 "Không tìm thấy lớp"). */
  async whereDangKyCuaLop(
    nguoiDungId: string,
    lopId: string,
  ): Promise<Prisma.dang_ky_hocWhereInput> {
    await this.damBaoLopCuaToi(nguoiDungId, lopId);
    return (await this.whereDangKyTheoLop([lopId]))!;
  }

  /**
   * Với mỗi học viên: các lớp trong `lopIds` mà học viên thuộc (phân lớp gốc
   * hoặc đổi buổi còn hiệu lực vào), xếp giai đoạn MỚI NHẤT trước (ngày bắt
   * đầu giai đoạn giảm dần, rồi thứ tự giai đoạn, rồi tên lớp) — tất định.
   */
  async lopCuaHocVien(
    lopIds: string[],
    hocVienIds: string[],
  ): Promise<Map<string, LopHoTroRef[]>> {
    const ketQua = new Map<string, LopHoTroRef[]>();
    const ids = [...new Set(hocVienIds)];
    if (lopIds.length === 0 || ids.length === 0) return ketQua;
    const [phanLop, doiVao] = await Promise.all([
      this.prisma.phan_lop_giai_doan.findMany({
        where: {
          lop_id: { in: lopIds },
          dang_ky_hoc: { hoc_vien_id: { in: ids } },
        },
        select: {
          dang_ky_hoc: { select: { hoc_vien_id: true } },
          lop: { select: { id: true, ten_lop: true } },
          giai_doan: { select: { thu_tu: true, thoi_gian_bat_dau: true } },
        },
      }),
      this.doiBuoiQuery.doiVaoLop(lopIds, ids),
    ]);
    const dong = [
      ...phanLop.map((p) => ({
        hoc_vien_id: p.dang_ky_hoc.hoc_vien_id,
        lop: p.lop,
        giai_doan: p.giai_doan,
      })),
      ...doiVao,
    ].sort(
      (a, b) =>
        b.giai_doan.thoi_gian_bat_dau.getTime() -
          a.giai_doan.thoi_gian_bat_dau.getTime() ||
        b.giai_doan.thu_tu - a.giai_doan.thu_tu ||
        a.lop.ten_lop.localeCompare(b.lop.ten_lop, 'vi'),
    );
    for (const d of dong) {
      const ds = ketQua.get(d.hoc_vien_id) ?? [];
      if (!ds.some((l) => l.id === d.lop.id))
        ds.push({ id: d.lop.id, ten_lop: d.lop.ten_lop });
      ketQua.set(d.hoc_vien_id, ds);
    }
    return ketQua;
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
