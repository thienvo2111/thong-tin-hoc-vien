import { Injectable } from '@nestjs/common';
import type {
  chuong_trinh_boi_duong,
  giai_doan_tham_gia,
  trang_thai_danh_sach_truong,
  trang_thai_hop_dong,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ForbiddenAppException,
  NotFoundAppException,
} from '../common/exceptions/app.exceptions';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { giaTriTamTinh, tongSuat } from './quy-tac-hop-dong';
import { ngaySangChuoi, ngayVietNam } from './dot-trien-khai.service';

export interface DotCuaTruong {
  id: string;
  ten: string;
  chuong_trinh: chuong_trinh_boi_duong;
  han_nop: string;
  han_nop_ngay: string;
}

export interface TheDotTruong {
  dot: DotCuaTruong;
  so_nguoi: number;
  tong_suat: number;
  don_gia: number | null;
  gia_tri_tam_tinh: number | null;
  trang_thai_danh_sach: trang_thai_danh_sach_truong;
  trang_thai_hop_dong: trang_thai_hop_dong;
}

/** ADR 0015 X6: các cột trường thấy trên mỗi dòng. */
export interface DongDanhSachTruong {
  id: string;
  ho_ten: string;
  ngay_sinh: string | null;
  gioi_tinh: string | null;
  lop: string | null;
  giai_doan: giai_doan_tham_gia;
  ty_le_suat: number;
  ghi_chu: string | null;
}

export interface DanhSachCuaTruong {
  dot: DotCuaTruong;
  dong: DongDanhSachTruong[];
  tong_suat: number;
  don_gia: number | null;
  gia_tri_tam_tinh: number | null;
  trang_thai_danh_sach: trang_thai_danh_sach_truong;
}

const CHON_DOT = {
  id: true,
  ten: true,
  chuong_trinh: true,
  han_nop: true,
  don_gia: true,
} as const;

function toDot(d: {
  id: string;
  ten: string;
  chuong_trinh: chuong_trinh_boi_duong;
  han_nop: Date;
}): DotCuaTruong {
  return {
    id: d.id,
    ten: d.ten,
    chuong_trinh: d.chuong_trinh,
    han_nop: d.han_nop.toISOString(),
    han_nop_ngay: ngayVietNam(d.han_nop),
  };
}

// Issue #60 / ADR 0015 U1, X6, S5, O3: trường xem đợt + danh sách tham gia của CHÍNH MÌNH.
// Phạm vi luôn lấy từ don_vi_id trong token, không nhận tham số đơn vị từ client.
@Injectable()
export class TruongDanhSachService {
  constructor(private readonly prisma: PrismaService) {}

  /** Thẻ đợt của trường: mọi đợt có dòng hop_dong_boi_duong của trường, hạn nộp sớm trước. */
  async dotCuaTruong(user: AuthenticatedUser): Promise<TheDotTruong[]> {
    const donViId = this.donViCua(user);
    const hopDong = await this.prisma.hop_dong_boi_duong.findMany({
      where: { don_vi_id: donViId },
      include: { dot_trien_khai: { select: CHON_DOT } },
    });
    if (hopDong.length === 0) return [];

    const suatTheoDot = await this.prisma.danh_sach_tham_gia.findMany({
      where: {
        don_vi_id: donViId,
        dot_trien_khai_id: { in: hopDong.map((h) => h.dot_trien_khai_id) },
      },
      select: { dot_trien_khai_id: true, ty_le_suat: true },
    });
    const nhom = new Map<string, { ty_le_suat: number }[]>();
    for (const d of suatTheoDot) {
      const ds = nhom.get(d.dot_trien_khai_id) ?? [];
      ds.push({ ty_le_suat: Number(d.ty_le_suat) });
      nhom.set(d.dot_trien_khai_id, ds);
    }

    return hopDong
      .map((h) => {
        const dong = nhom.get(h.dot_trien_khai_id) ?? [];
        const tong_suat = tongSuat(dong);
        const don_gia = h.dot_trien_khai.don_gia;
        return {
          dot: toDot(h.dot_trien_khai),
          so_nguoi: dong.length,
          tong_suat,
          don_gia,
          gia_tri_tam_tinh: giaTriTamTinh(tong_suat, don_gia),
          trang_thai_danh_sach: h.trang_thai_danh_sach,
          trang_thai_hop_dong: h.trang_thai_hop_dong,
        };
      })
      .sort(
        (a, b) =>
          a.dot.han_nop.localeCompare(b.dot.han_nop) ||
          a.dot.id.localeCompare(b.dot.id),
      );
  }

  /** Danh sách của trường trong 1 đợt. Không có dòng hợp đồng → 404 (không lộ đợt/danh sách trường khác). */
  async danhSachCuaTruong(
    user: AuthenticatedUser,
    dotId: string,
  ): Promise<DanhSachCuaTruong> {
    const donViId = this.donViCua(user);
    const hopDong = await this.prisma.hop_dong_boi_duong.findUnique({
      where: {
        dot_trien_khai_id_don_vi_id: {
          dot_trien_khai_id: dotId,
          don_vi_id: donViId,
        },
      },
      include: { dot_trien_khai: { select: CHON_DOT } },
    });
    if (!hopDong) {
      throw new NotFoundAppException(
        'Không tìm thấy danh sách của trường cho đợt này',
      );
    }

    const ds = await this.prisma.danh_sach_tham_gia.findMany({
      where: { dot_trien_khai_id: dotId, don_vi_id: donViId },
      orderBy: [{ ho_ten: 'asc' }, { id: 'asc' }],
    });
    const dong: DongDanhSachTruong[] = ds.map((d) => ({
      id: d.id,
      ho_ten: d.ho_ten,
      ngay_sinh: ngaySangChuoi(d.ngay_sinh),
      gioi_tinh: d.gioi_tinh,
      lop: d.lop,
      giai_doan: d.giai_doan,
      ty_le_suat: Number(d.ty_le_suat),
      ghi_chu: d.ghi_chu,
    }));
    const tong_suat = tongSuat(dong);
    const don_gia = hopDong.dot_trien_khai.don_gia;
    return {
      dot: toDot(hopDong.dot_trien_khai),
      dong,
      tong_suat,
      don_gia,
      gia_tri_tam_tinh: giaTriTamTinh(tong_suat, don_gia),
      trang_thai_danh_sach: hopDong.trang_thai_danh_sach,
    };
  }

  private donViCua(user: AuthenticatedUser): string {
    if (!user.don_vi_id) {
      throw new ForbiddenAppException(
        'Tài khoản trường chưa gắn đơn vị — liên hệ HCMUE để được gắn trường',
      );
    }
    return user.don_vi_id;
  }
}
