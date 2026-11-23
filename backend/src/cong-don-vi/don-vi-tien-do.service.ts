import { Injectable } from '@nestjs/common';
import type {
  trang_thai_danh_sach_truong,
  trang_thai_hop_dong,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeService } from '../auth/scope/scope.service';
import {
  ForbiddenAppException,
  NotFoundAppException,
} from '../common/exceptions/app.exceptions';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { soLieuHopDong } from './hop-dong.service';
import { tongSuat } from './quy-tac-hop-dong';
import { KHONG_THAY_DANH_SACH } from './giao-dich-hop-dong';
import {
  LocTienDo,
  TongHopTienDo,
  locTienDo,
  tongHopTienDo,
} from './tien-do-dot';
import {
  CHON_DOT_TIEN_DO,
  DotTienDo,
  KHONG_THAY_DOT,
  TienDoDotService,
  dotTienDo,
} from './tien-do-dot.service';
import {
  DongDanhSachSoPhong,
  DongTienDoSoPhong,
  chieuDongDanhSachSoPhong,
  chieuSoPhong,
} from './don-vi-tien-do';

/** Thẻ đợt của Sở/Phòng: số liệu chỉ trên các trường trong phạm vi. */
export interface TheDotSoPhong extends TongHopTienDo {
  dot: DotTienDo;
}

export interface TienDoSoPhong {
  dot: DotTienDo;
  /** Trên mọi trường TRONG PHẠM VI của đợt (không phụ thuộc bộ lọc). */
  tong_hop: TongHopTienDo;
  dong: DongTienDoSoPhong[];
}

export interface DanhSachGvSoPhong {
  dot: DotTienDo;
  truong: { id: string; ma: string | null; ten: string };
  trang_thai_danh_sach: trang_thai_danh_sach_truong;
  trang_thai_hop_dong: trang_thai_hop_dong;
  so_nguoi: number;
  tong_suat: number;
  gia_tri: number | null;
  dong: DongDanhSachSoPhong[];
}

// Issue #71 / ADR 0015 P1, O3: Sở/Phòng xem tiến độ các trường TRONG PHẠM VI (cây đơn vị con, cùng ScopeService
// với dữ liệu NLS) theo đợt + danh sách GV 1 trường, chỉ đọc. Dòng tiến độ dùng chung phép tính của bảng Quản
// trị (TienDoDotService.taiDong) rồi chiếu qua danh sách trắng (don-vi-tien-do.ts). Ngoài phạm vi → 404, không
// lộ đợt/trường tồn tại.
@Injectable()
export class DonViTienDoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly tienDo: TienDoDotService,
  ) {}

  /** Mọi đợt có ≥ 1 trường trong phạm vi, hạn nộp muộn trước. Số truy vấn cố định (không theo số đợt). */
  async dsDot(user: AuthenticatedUser): Promise<TheDotSoPhong[]> {
    const phamVi = await this.phamVi(user);
    const dots = await this.prisma.dot_trien_khai.findMany({
      where: { hop_dong_boi_duong: { some: { don_vi_id: { in: phamVi } } } },
      select: CHON_DOT_TIEN_DO,
      orderBy: [{ han_nop: 'desc' }, { id: 'asc' }],
    });
    const theoDot = await this.tienDo.taiDong(dots, phamVi);
    return dots.map((d) => ({
      dot: dotTienDo(d),
      ...tongHopTienDo((theoDot.get(d.id) ?? []).map((x) => x.dong)),
    }));
  }

  async tienDoDot(
    user: AuthenticatedUser,
    dotId: string,
    loc: LocTienDo = 'tat_ca',
  ): Promise<TienDoSoPhong> {
    const phamVi = await this.phamVi(user);
    const d = await this.prisma.dot_trien_khai.findUnique({
      where: { id: dotId },
      select: CHON_DOT_TIEN_DO,
    });
    if (!d) throw new NotFoundAppException(KHONG_THAY_DOT);
    const dong = ((await this.tienDo.taiDong([d], phamVi)).get(d.id) ?? []).map(
      (x) => x.dong,
    );
    // Đợt không có trường nào trong phạm vi: cùng 404 như đợt không tồn tại.
    if (dong.length === 0) throw new NotFoundAppException(KHONG_THAY_DOT);
    return {
      dot: dotTienDo(d),
      tong_hop: tongHopTienDo(dong),
      dong: locTienDo(dong, loc).map(chieuSoPhong),
    };
  }

  /** Danh sách GV của 1 trường trong phạm vi (chỉ đọc). Đã nộp: số liệu từ bản chụp lúc nộp (M5). */
  async danhSachTruong(
    user: AuthenticatedUser,
    dotId: string,
    donViId: string,
  ): Promise<DanhSachGvSoPhong> {
    const phamVi = await this.phamVi(user);
    if (!phamVi.includes(donViId)) {
      throw new NotFoundAppException(KHONG_THAY_DANH_SACH);
    }
    // Chỉ chọn cột cần — không đọc Phần 3/4, bản chụp hồ sơ hay người thao tác.
    const h = await this.prisma.hop_dong_boi_duong.findUnique({
      where: {
        dot_trien_khai_id_don_vi_id: {
          dot_trien_khai_id: dotId,
          don_vi_id: donViId,
        },
      },
      select: {
        trang_thai_danh_sach: true,
        trang_thai_hop_dong: true,
        so_nguoi_luc_nop: true,
        tong_suat_luc_nop: true,
        don_gia_luc_nop: true,
        gia_tri_luc_nop: true,
        dot_trien_khai: { select: CHON_DOT_TIEN_DO },
        don_vi: { select: { id: true, ma_don_vi: true, ten_don_vi: true } },
      },
    });
    if (!h) throw new NotFoundAppException(KHONG_THAY_DANH_SACH);
    const ds = await this.prisma.danh_sach_tham_gia.findMany({
      where: { dot_trien_khai_id: dotId, don_vi_id: donViId },
      orderBy: [{ ho_ten: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        ho_ten: true,
        ngay_sinh: true,
        gioi_tinh: true,
        lop: true,
        giai_doan: true,
        ty_le_suat: true,
        ghi_chu: true,
        y_kien_truong: true,
      },
    });
    const dong = ds.map(chieuDongDanhSachSoPhong);
    const sl = soLieuHopDong(
      { ...h, ban_chup_ho_so: null },
      {
        so_nguoi: dong.length,
        tong_suat: tongSuat(dong),
        don_gia: h.dot_trien_khai.don_gia,
        hoSo: null,
      },
    );
    return {
      dot: dotTienDo(h.dot_trien_khai),
      truong: {
        id: h.don_vi.id,
        ma: h.don_vi.ma_don_vi,
        ten: h.don_vi.ten_don_vi,
      },
      trang_thai_danh_sach: h.trang_thai_danh_sach,
      trang_thai_hop_dong: h.trang_thai_hop_dong,
      so_nguoi: sl.so_nguoi,
      tong_suat: sl.tong_suat,
      gia_tri: sl.gia_tri,
      dong,
    };
  }

  /** Cây đơn vị con của Sở/Phòng (gồm chính nó). Không gắn đơn vị → 403 như các API khác của cổng. */
  private async phamVi(user: AuthenticatedUser): Promise<string[]> {
    if (!user.don_vi_id) {
      throw new ForbiddenAppException(
        'Tài khoản chưa gắn đơn vị — liên hệ HCMUE để được gắn đơn vị',
      );
    }
    const phamVi = await this.scope.getAccessibleDonViIds(user);
    // Controller chỉ cho so_gddt/phong_vhxh — 'ALL' (quan_tri) không bao giờ tới đây.
    if (phamVi === 'ALL') throw new ForbiddenAppException('Không có quyền');
    return phamVi;
  }
}
