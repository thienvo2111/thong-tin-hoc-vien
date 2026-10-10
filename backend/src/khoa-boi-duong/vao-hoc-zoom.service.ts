import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  ForbiddenAppException,
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { tinhCuaSoDiemDanh } from './util/cua-so-diem-danh.util';
import { apDungDiemDanhZoom } from './util/diem-danh-zoom.util';

// POST /lich-hoc/:id/vao-hoc — ADR 0005 Z2–Z5, spec 2026-10-09 §4. Học viên
// bấm "Điểm danh & vào Zoom": trong cửa sổ thì tạo co_mat/zoom (1 lần, không
// đè dòng đã có — kể cả dòng import/báo vắng); link chỉ trả khi đã mở cửa sổ.
@Injectable()
export class VaoHocZoomService {
  constructor(private readonly prisma: PrismaService) {}

  async vaoHoc(
    lichHocId: string,
    caller: AuthenticatedUser,
    now: Date = new Date(),
  ) {
    if (!caller.hoc_vien_id) {
      throw new ForbiddenAppException(
        'Tài khoản hiện tại không gắn với hồ sơ học viên nào',
      );
    }
    const buoi = await this.prisma.lich_hoc_lop.findUnique({
      where: { id: lichHocId },
      select: {
        id: true,
        lop_id: true,
        giai_doan_id: true,
        thoi_gian_bat_dau: true,
        dia_diem_hoac_link: true,
        lop: {
          select: {
            loai_lop: true,
            khoa_id: true,
            khoa: {
              select: {
                bat_diem_danh_zoom_luc: true,
                diem_danh_mo_truoc_phut: true,
                diem_danh_dong_sau_phut: true,
              },
            },
          },
        },
      },
    });
    if (!buoi) throw new NotFoundAppException('Không tìm thấy buổi học');
    const khoa = buoi.lop.khoa;
    if (!apDungDiemDanhZoom(buoi.lop, khoa)) {
      throw new ValidationException(
        'Buổi học này không áp dụng điểm danh qua Zoom',
      );
    }
    const link = buoi.dia_diem_hoac_link?.trim();
    if (!link) {
      throw new ValidationException('Buổi học này chưa có link Zoom');
    }

    const phanLop = await this.prisma.phan_lop_giai_doan.findFirst({
      where: {
        lop_id: buoi.lop_id,
        giai_doan_id: buoi.giai_doan_id,
        dang_ky_hoc: {
          hoc_vien_id: caller.hoc_vien_id,
          khoa_id: buoi.lop.khoa_id,
        },
      },
      select: { dang_ky_hoc_id: true },
    });
    if (!phanLop) {
      throw new ForbiddenAppException(
        'Thầy/Cô không thuộc lớp của buổi học này',
      );
    }

    const { mo, dong, pha } = tinhCuaSoDiemDanh(buoi, khoa, now);
    if (pha === 'chua_mo') return { ket_qua: 'chua_mo' as const, mo, dong };
    if (pha === 'da_dong') {
      return { ket_qua: 'qua_gio' as const, dong, mo, link };
    }

    const khoaDiemDanh = {
      dang_ky_hoc_id: phanLop.dang_ky_hoc_id,
      lich_hoc_id: buoi.id,
    };
    const cuaSo = { link, mo, dong };
    const daCo = await this.diemDanhDaCo(khoaDiemDanh);
    if (daCo) return { ...daCo, ...cuaSo };
    try {
      // Báo vắng không chặn: bấm trong cửa sổ luôn ghi có mặt (G13).
      await this.prisma.diem_danh.create({
        data: {
          ...khoaDiemDanh,
          trang_thai: 'co_mat',
          nguon: 'zoom',
          tu_diem_danh_luc: now,
          cap_nhat_luc: now,
        },
      });
      return { ket_qua: 'da_ghi_nhan' as const, luc: now, ...cuaSo };
    } catch (e) {
      // 2 tab/bấm nhanh song song: dòng đã được request kia tạo -> "đã có".
      if (
        !(e instanceof Prisma.PrismaClientKnownRequestError) ||
        e.code !== 'P2002'
      ) {
        throw e;
      }
      const vuaTao = await this.diemDanhDaCo(khoaDiemDanh);
      if (!vuaTao) throw e;
      return { ...vuaTao, ...cuaSo };
    }
  }

  private async diemDanhDaCo(khoa: {
    dang_ky_hoc_id: string;
    lich_hoc_id: string;
  }) {
    const dd = await this.prisma.diem_danh.findUnique({
      where: { dang_ky_hoc_id_lich_hoc_id: khoa },
      select: { trang_thai: true, tu_diem_danh_luc: true, cap_nhat_luc: true },
    });
    if (!dd) return null;
    return {
      ket_qua: 'da_co' as const,
      trang_thai: dd.trang_thai,
      luc: dd.tu_diem_danh_luc ?? dd.cap_nhat_luc,
    };
  }
}
