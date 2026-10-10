import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { khoangNgayVn } from '../common/utils/khoang-ngay-vn.util';
import { layDotLop } from '../trang-lop/trang-lop.service';
import { apDungDiemDanhZoom } from '../khoa-boi-duong/util/diem-danh-zoom.util';
import {
  TrangThaiNhac,
  gopTrangThaiNhac,
  soanTinNhanCum,
  soanTinNhanGiangVien,
  trangThaiNhac,
} from './nhac-lich.util';

type CapDot = { lop_id: string; giai_doan_id: string };

// ADR 0004 G10/G11 (issue #21): tin nhắn nhắc lịch + "Đã gửi". Nơi gọi tự
// kiểm phạm vi (hỗ trợ GV: đợt trong khóa của nhóm; hỗ trợ HV: cụm của mình).
@Injectable()
export class NhacLichService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------- Giảng viên ----------------
  async tinNhanGiangVien(lopId: string, gdId: string, giangVienId: string) {
    const dot = await layDotLop(this.prisma, lopId, gdId);
    const buoi = dot.buoi.filter((b) =>
      b.giang_vien.some((g) => g.id === giangVienId),
    );
    if (buoi.length === 0) {
      throw new NotFoundAppException(
        'Giảng viên không dạy buổi nào trong đợt này',
      );
    }
    const gv = buoi[0].giang_vien.find((g) => g.id === giangVienId)!;
    const hc = dot.hau_can.find((h) => h.giang_vien_id === giangVienId);
    const noiDung = soanTinNhanGiangVien({
      ho_ten_giang_vien: gv.ho_ten,
      ma_khoa: dot.lop.khoa.ma_khoa,
      ten_lop: dot.lop.ten_lop,
      ten_giai_doan: dot.giai_doan.ten_giai_doan,
      buoi,
      hau_can: hc ?? null,
      thuc_dia: dot.thuc_dia,
      nhom_ho_tro_gv: dot.nhom_ho_tro_gv,
    });
    const lanCuoi = await this.prisma.nhat_ky_nhac_lich.findFirst({
      where: {
        doi_tuong: 'giang_vien',
        giang_vien_id: giangVienId,
        lich_hoc_ids: { hasSome: buoi.map((b) => b.id) },
      },
      orderBy: { gui_luc: 'desc' },
      select: { gui_luc: true, nguoi: { select: { ho_ten: true } } },
    });
    return {
      giang_vien: {
        id: gv.id,
        ho_ten: gv.ho_ten,
        so_dien_thoai: gv.so_dien_thoai ?? null,
        email: gv.email ?? null,
      },
      lich_hoc_ids: buoi.map((b) => b.id),
      noi_dung: noiDung,
      trang_thai_nhac: gopTrangThaiNhac(
        buoi.map(
          (b) =>
            b.giang_vien.find((g) => g.id === giangVienId)!.nhac ?? 'chua_nhac',
        ),
      ),
      lan_gui_cuoi: lanCuoi
        ? { gui_luc: lanCuoi.gui_luc, nguoi_gui: lanCuoi.nguoi?.ho_ten ?? null }
        : null,
    };
  }

  /** "Đã gửi" cho giảng viên: mọi buổi phải thuộc phạm vi và có phân công của giảng viên đó. */
  async ghiNhacGiangVien(
    user: AuthenticatedUser,
    dto: { giang_vien_id: string; lich_hoc_ids: string[]; noi_dung: string },
    lopTrongPhamVi: Prisma.lop_hocWhereInput,
  ) {
    const ids = [...new Set(dto.lich_hoc_ids)];
    const hopLe = await this.prisma.lich_hoc_lop.count({
      where: {
        id: { in: ids },
        lop: lopTrongPhamVi,
        phan_cong: { some: { giang_vien_id: dto.giang_vien_id } },
      },
    });
    if (hopLe !== ids.length) {
      throw new NotFoundAppException(
        'Có buổi không thuộc phạm vi hoặc giảng viên không dạy',
      );
    }
    return this.prisma.nhat_ky_nhac_lich.create({
      data: {
        doi_tuong: 'giang_vien',
        giang_vien_id: dto.giang_vien_id,
        lich_hoc_ids: ids,
        noi_dung: dto.noi_dung,
        nguoi_gui: user.id,
      },
      select: { id: true, gui_luc: true },
    });
  }

  // ---------------- Cụm học viên ----------------
  /** Các (lớp, giai đoạn) có học viên của cụm được phân vào. */
  async capDotCuaCum(
    cumIds: string[],
  ): Promise<(CapDot & { cum_id: string })[]> {
    if (cumIds.length === 0) return [];
    const rows = await this.prisma.phan_lop_giai_doan.findMany({
      where: { dang_ky_hoc: { cum_id: { in: cumIds } } },
      select: {
        lop_id: true,
        giai_doan_id: true,
        dang_ky_hoc: { select: { cum_id: true } },
      },
    });
    const m = new Map<string, CapDot & { cum_id: string }>();
    for (const r of rows) {
      const cumId = r.dang_ky_hoc.cum_id!;
      m.set(`${cumId}|${r.lop_id}|${r.giai_doan_id}`, {
        cum_id: cumId,
        lop_id: r.lop_id,
        giai_doan_id: r.giai_doan_id,
      });
    }
    return [...m.values()];
  }

  private async nhatKyCum(cumIds: string[], buoiIds: string[]) {
    if (cumIds.length === 0 || buoiIds.length === 0) return [];
    return this.prisma.nhat_ky_nhac_lich.findMany({
      where: {
        doi_tuong: 'cum',
        cum_id: { in: cumIds },
        lich_hoc_ids: { hasSome: buoiIds },
      },
      select: { cum_id: true, lich_hoc_ids: true, gui_luc: true },
    });
  }

  /** Trạng thái nhắc của từng cụm liên quan tới mỗi buổi (Lịch học của hỗ trợ HV). */
  async trangThaiCumTheoBuoi(
    cumIds: string[],
    buoi: {
      id: string;
      lop_id: string;
      giai_doan_id: string;
      cap_nhat_luc: Date;
    }[],
  ): Promise<Map<string, { cum_id: string; trang_thai: TrangThaiNhac }[]>> {
    const cap = await this.capDotCuaCum(cumIds);
    const nhatKy = await this.nhatKyCum(
      cumIds,
      buoi.map((b) => b.id),
    );
    const kq = new Map<
      string,
      { cum_id: string; trang_thai: TrangThaiNhac }[]
    >();
    for (const b of buoi) {
      const cumCuaBuoi = [
        ...new Set(
          cap
            .filter(
              (c) => c.lop_id === b.lop_id && c.giai_doan_id === b.giai_doan_id,
            )
            .map((c) => c.cum_id),
        ),
      ];
      kq.set(
        b.id,
        cumCuaBuoi.map((cumId) => ({
          cum_id: cumId,
          trang_thai: trangThaiNhac(
            b,
            nhatKy.filter((n) => n.cum_id === cumId),
          ),
        })),
      );
    }
    return kq;
  }

  private async buoiCuaCum(cumId: string, tu: Date, den: Date) {
    const cap = await this.capDotCuaCum([cumId]);
    if (cap.length === 0) return { cap, buoi: [] };
    const buoi = await this.prisma.lich_hoc_lop.findMany({
      where: {
        OR: cap.map(({ lop_id, giai_doan_id }) => ({ lop_id, giai_doan_id })),
        thoi_gian_bat_dau: { gte: tu, lte: den },
      },
      select: {
        id: true,
        lop_id: true,
        giai_doan_id: true,
        buoi_so: true,
        thoi_gian_bat_dau: true,
        thoi_gian_ket_thuc: true,
        dia_diem_hoac_link: true,
        phong: true,
        cap_nhat_luc: true,
        lop: {
          select: {
            ten_lop: true,
            loai_lop: true,
            khoa: { select: { bat_diem_danh_zoom_luc: true } },
          },
        },
        diem_hoc: { select: { ten: true, dia_chi: true } },
      },
      orderBy: [{ thoi_gian_bat_dau: 'asc' }, { buoi_so: 'asc' }],
    });
    return { cap, buoi };
  }

  /** Tin nhắn nhóm Zalo cụm cho 1 ngày (giờ VN): chỉ buổi của lớp có học viên cụm. */
  async tinNhanCum(cumId: string, ngay: string) {
    const cum = await this.prisma.cum_hoc_vien.findUnique({
      where: { id: cumId },
      select: { id: true, ten_cum: true },
    });
    if (!cum) throw new NotFoundAppException('Không tìm thấy cụm hỗ trợ');
    const { tu, den } = khoangNgayVn({ tu_ngay: ngay, den_ngay: ngay });
    const { cap, buoi } = await this.buoiCuaCum(cumId, tu, den);
    const thucDia = cap.length
      ? await this.prisma.nhan_su_thuc_dia.findMany({
          where: {
            OR: cap.map(({ lop_id, giai_doan_id }) => ({
              lop_id,
              giai_doan_id,
            })),
          },
          select: {
            lop_id: true,
            giai_doan_id: true,
            ho_ten: true,
            so_dien_thoai: true,
          },
          orderBy: { created_at: 'asc' },
        })
      : [];
    const nhatKy = await this.nhatKyCum(
      [cumId],
      buoi.map((b) => b.id),
    );
    const ds = buoi.map((b) => ({
      ...b,
      ten_lop: b.lop.ten_lop,
      thuc_dia: thucDia.filter(
        (t) => t.lop_id === b.lop_id && t.giai_doan_id === b.giai_doan_id,
      ),
      trang_thai_nhac: trangThaiNhac(b, nhatKy),
    }));
    return {
      cum,
      ngay,
      buoi: ds.map((b) => ({
        id: b.id,
        buoi_so: b.buoi_so,
        ten_lop: b.ten_lop,
        thoi_gian_bat_dau: b.thoi_gian_bat_dau,
        thoi_gian_ket_thuc: b.thoi_gian_ket_thuc,
        trang_thai_nhac: b.trang_thai_nhac,
      })),
      lich_hoc_ids: ds.map((b) => b.id),
      noi_dung: ds.length
        ? soanTinNhanCum({
            ten_cum: cum.ten_cum,
            ngay: tu,
            buoi: ds,
            nhac_diem_danh_zoom: ds.some((b) =>
              apDungDiemDanhZoom(b.lop, b.lop.khoa),
            ),
          })
        : null,
      trang_thai_nhac: ds.length
        ? gopTrangThaiNhac(ds.map((b) => b.trang_thai_nhac))
        : null,
    };
  }

  async ghiNhacCum(
    user: AuthenticatedUser,
    dto: { cum_id: string; lich_hoc_ids: string[]; noi_dung: string },
  ) {
    const ids = [...new Set(dto.lich_hoc_ids)];
    const cap = await this.capDotCuaCum([dto.cum_id]);
    const hopLe = cap.length
      ? await this.prisma.lich_hoc_lop.count({
          where: {
            id: { in: ids },
            OR: cap.map(({ lop_id, giai_doan_id }) => ({
              lop_id,
              giai_doan_id,
            })),
          },
        })
      : 0;
    if (hopLe !== ids.length) {
      throw new ValidationException(
        'Có buổi không thuộc lớp của học viên cụm này',
      );
    }
    return this.prisma.nhat_ky_nhac_lich.create({
      data: {
        doi_tuong: 'cum',
        cum_id: dto.cum_id,
        lich_hoc_ids: ids,
        noi_dung: dto.noi_dung,
        nguoi_gui: user.id,
      },
      select: { id: true, gui_luc: true },
    });
  }

  /** Số (buổi, cụm) trong 2 ngày tới (giờ VN) chưa nhắc / cần nhắc lại — số đếm menu hỗ trợ HV. */
  async demCanNhacCum(cumIds: string[]): Promise<number> {
    if (cumIds.length === 0) return 0;
    const { den } = khoangNgayVn({}, 2);
    const tu = new Date();
    const cap = await this.capDotCuaCum(cumIds);
    if (cap.length === 0) return 0;
    const buoi = await this.prisma.lich_hoc_lop.findMany({
      where: {
        OR: cap.map(({ lop_id, giai_doan_id }) => ({ lop_id, giai_doan_id })),
        thoi_gian_bat_dau: { gte: tu, lte: den },
      },
      select: {
        id: true,
        lop_id: true,
        giai_doan_id: true,
        cap_nhat_luc: true,
      },
    });
    const tt = await this.trangThaiCumTheoBuoi(cumIds, buoi);
    return [...tt.values()].flat().filter((x) => x.trang_thai !== 'da_nhac')
      .length;
  }
}
