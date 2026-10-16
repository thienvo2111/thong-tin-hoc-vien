import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DoiBuoiHocQueryService } from '../doi-buoi-hoc/doi-buoi-hoc-query.service';
import { hopNhatDiemDanh } from '../common/utils/diem-danh-bao-vang.util';
import { tinhCuaSoDiemDanh } from './util/cua-so-diem-danh.util';

const SO_BUOI_MOI_LUOT = 200;

type BuoiUngVien = {
  id: string;
  lop_id: string;
  giai_doan_id: string;
  thoi_gian_bat_dau: Date;
  diem_danh_mo_truoc_phut: number;
  diem_danh_dong_sau_phut: number;
};

// ADR 0005 Z6 (issue #25): hết cửa sổ điểm danh buổi Zoom → chốt vắng học
// viên của lớp ở giai đoạn đó chưa có dòng (vang / vang_co_phep nếu có báo
// vắng), đánh dấu lich_hoc_lop.chot_diem_danh_luc. Như HangDoiEmailProcessor:
// lượt cron KHÔNG BAO GIỜ throw — log rồi chạy lượt sau.
@Injectable()
export class ChotVangZoomProcessor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly doiBuoi: DoiBuoiHocQueryService,
  ) {}

  @Cron('0 */5 * * * *')
  async chayDinhKy(): Promise<void> {
    // e2e dùng chung DB dev: lượt cron nền sẽ chốt nhầm fixture của spec
    // khác — test gọi chotVang() trực tiếp.
    if (process.env.NODE_ENV === 'test') return;
    try {
      await this.chotVang(new Date());
    } catch (e) {
      console.error('[chot-vang-zoom] Lỗi chốt vắng', e);
    }
  }

  async chotVang(
    now: Date,
  ): Promise<{ so_buoi: number; so_dong_vang: number }> {
    // Lọc cấu trúc bằng SQL (so cột với cột, link trống sau trim — Prisma
    // không biểu diễn được); pha cửa sổ để tinhCuaSoDiemDanh quyết định.
    const ungVien = await this.prisma.$queryRaw<BuoiUngVien[]>`
      SELECT l.id, l.lop_id, l.giai_doan_id, l.thoi_gian_bat_dau,
             k.diem_danh_mo_truoc_phut, k.diem_danh_dong_sau_phut
      FROM lich_hoc_lop l
      JOIN lop_hoc lp ON lp.id = l.lop_id
      JOIN khoa_boi_duong k ON k.id = lp.khoa_id
      WHERE l.chot_diem_danh_luc IS NULL
        AND lp.loai_lop = 'zoom'
        AND k.bat_diem_danh_zoom_luc IS NOT NULL
        AND l.thoi_gian_bat_dau >= k.bat_diem_danh_zoom_luc
        AND btrim(coalesce(l.dia_diem_hoac_link, '')) <> ''
        AND l.thoi_gian_bat_dau < ${now.toISOString()}::timestamptz
      ORDER BY l.thoi_gian_bat_dau
      LIMIT ${SO_BUOI_MOI_LUOT}`;

    let soBuoi = 0;
    let soDongVang = 0;
    for (const buoi of ungVien) {
      if (tinhCuaSoDiemDanh(buoi, buoi, now).pha !== 'da_dong') continue;
      const soDong = await this.chotMotBuoi(buoi, now);
      if (soDong === null) continue;
      soBuoi++;
      soDongVang += soDong;
    }
    if (soBuoi > 0) {
      console.log(
        `[chot-vang-zoom] Đã chốt ${soBuoi} buổi, ghi ${soDongVang} dòng vắng`,
      );
    }
    return { so_buoi: soBuoi, so_dong_vang: soDongVang };
  }

  /** null = buổi đã bị lượt khác chốt trước. */
  private chotMotBuoi(buoi: BuoiUngVien, now: Date): Promise<number | null> {
    return this.prisma.$transaction(async (tx) => {
      // Giành quyền chốt trước: UPDATE có điều kiện IS NULL — lượt song song
      // chờ khóa dòng rồi thấy count = 0.
      const giu = await tx.lich_hoc_lop.updateMany({
        where: { id: buoi.id, chot_diem_danh_luc: null },
        data: { chot_diem_danh_luc: now },
      });
      if (giu.count === 0) return null;

      // Spec đổi buổi (R11): nghĩa vụ điểm danh đi theo đổi buổi đã duyệt còn
      // hiệu lực — bỏ người đổi ra khỏi buổi này, thêm người đổi vào buổi này.
      const { ra, vao } = await this.doiBuoiCuaBuoi(tx, buoi.id);
      const phanLop = await tx.phan_lop_giai_doan.findMany({
        where: {
          lop_id: buoi.lop_id,
          giai_doan_id: buoi.giai_doan_id,
          dang_ky_hoc: { diem_danh: { none: { lich_hoc_id: buoi.id } } },
        },
        select: {
          dang_ky_hoc_id: true,
          dang_ky_hoc: {
            select: {
              bao_vang: {
                where: { lich_hoc_id: buoi.id },
                select: { id: true },
              },
            },
          },
        },
      });
      const doiVao = vao.size
        ? await tx.dang_ky_hoc.findMany({
            where: {
              id: { in: [...vao] },
              diem_danh: { none: { lich_hoc_id: buoi.id } },
            },
            select: {
              id: true,
              bao_vang: {
                where: { lich_hoc_id: buoi.id },
                select: { id: true },
              },
            },
          })
        : [];
      const chuaCoDong = [
        ...phanLop
          .filter((p) => !ra.has(p.dang_ky_hoc_id))
          .map((p) => ({
            dang_ky_hoc_id: p.dang_ky_hoc_id,
            co_bao_vang: p.dang_ky_hoc.bao_vang.length > 0,
          })),
        ...doiVao.map((d) => ({
          dang_ky_hoc_id: d.id,
          co_bao_vang: d.bao_vang.length > 0,
        })),
      ];
      if (chuaCoDong.length === 0) return 0;

      // skipDuplicates: học viên bấm điểm danh đúng lúc chốt không bị ghi đè.
      const kq = await tx.diem_danh.createMany({
        data: chuaCoDong.map((p) => ({
          dang_ky_hoc_id: p.dang_ky_hoc_id,
          lich_hoc_id: buoi.id,
          trang_thai: hopNhatDiemDanh('vang', p.co_bao_vang),
          nguon: 'zoom' as const,
          cap_nhat_luc: now,
        })),
        skipDuplicates: true,
      });
      return kq.count;
    });
  }

  /** Đăng ký đổi ra / đổi vào buổi này (đã duyệt, còn hiệu lực) — 1 lượt tra mỗi buổi. */
  private async doiBuoiCuaBuoi(tx: Prisma.TransactionClient, lichId: string) {
    const ungVien = await tx.doi_buoi_hoc.findMany({
      where: {
        trang_thai: 'da_duyet',
        OR: [{ lich_nguon_id: lichId }, { lich_chot_id: lichId }],
      },
      select: { dang_ky_hoc_id: true },
    });
    if (ungVien.length === 0) {
      return { ra: new Set<string>(), vao: new Set<string>() };
    }
    const hieuLuc = await this.doiBuoi.doiBuoiDaDuyetCuaDangKy([
      ...new Set(ungVien.map((u) => u.dang_ky_hoc_id)),
    ]);
    const cua = (loc: (d: (typeof hieuLuc)[number]) => boolean) =>
      new Set(hieuLuc.filter(loc).map((d) => d.dang_ky_hoc_id));
    return {
      ra: cua((d) => d.lich_nguon_id === lichId),
      vao: cua((d) => d.lich_chot_id === lichId),
    };
  }
}
