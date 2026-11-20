import { Injectable } from '@nestjs/common';
import type {
  chuong_trinh_boi_duong,
  trang_thai_danh_sach_truong,
  trang_thai_hop_dong,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NhatKyService } from '../nhat-ky/nhat-ky.service';
import { NotFoundAppException } from '../common/exceptions/app.exceptions';
import { tinhTrangHoSo } from './ho-so-don-vi.quy-tac';
import { layDuLieu } from './ho-so-don-vi.service';
import { soLieuHopDong } from './hop-dong.service';
import { ngayVietNam } from './dot-trien-khai.service';
import {
  LocTienDo,
  TongHopTienDo,
  chuaXong,
  khopLoc,
  locTienDo,
  mocMuonHon,
  tongHopTienDo,
} from './tien-do-dot';
import {
  DongXuatTienDo,
  TinhTrangHoSoTienDo,
  taoFileTienDo,
  tenFileTienDo,
} from './tien-do-dot.excel';

export interface DongTienDo {
  don_vi: { id: string; ma: string | null; ten: string; dia_ban: string };
  so_nguoi: number;
  tong_suat: number;
  /** null khi chưa có đơn giá (chưa nộp). Đã nộp: giá trị lúc nộp. */
  gia_tri: number | null;
  trang_thai_danh_sach: trang_thai_danh_sach_truong;
  trang_thai_hop_dong: trang_thai_hop_dong;
  nop_luc: string | null;
  so_de_nghi_cho: number;
  /** tinhTrangHoSo đủ (đã nộp: bản chụp lúc nộp); false khi chưa khai. */
  ho_so_du: boolean;
  /** false = trường chưa khai Hồ sơ đơn vị. */
  co_ho_so: boolean;
  thao_tac_cuoi_luc: string | null;
  thao_tac_cuoi_boi: { ho_ten: string; ten_dang_nhap: string } | null;
}

export interface TienDoDot {
  dot: {
    id: string;
    ten: string;
    chuong_trinh: chuong_trinh_boi_duong;
    don_gia: number | null;
    han_nop: string;
    han_nop_ngay: string;
  };
  tong_hop: TongHopTienDo;
  dong: DongTienDo[];
}

type LienHe = DongXuatTienDo['lien_he'];
interface DongNoiBo {
  dong: DongTienDo;
  thaoTacCuoi: Date | null;
  lienHe: LienHe;
}

const KHONG_THAY_DOT = 'Không tìm thấy đợt triển khai';

function tinhTrangHoSoCua(d: DongTienDo): TinhTrangHoSoTienDo {
  if (!d.co_ho_so) return 'chua_khai';
  return d.ho_so_du ? 'du' : 'con_thieu';
}

// Issue #65 / ADR 0015 X7, T5, M5: bảng Tiến độ đợt cho Quản trị — mỗi trường (1 dòng hop_dong_boi_duong
// của đợt) 1 dòng; xuất Excel trường chưa xong kèm người liên hệ. Số truy vấn cố định (không N+1):
// đợt, hop_dong (kèm đơn vị + người thao tác), groupBy danh sách, groupBy đề nghị chờ, hồ sơ đơn vị.
@Injectable()
export class TienDoDotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nhatKy: NhatKyService,
  ) {}

  async layTienDo(
    dotId: string,
    loc: LocTienDo = 'tat_ca',
  ): Promise<TienDoDot> {
    const { dot, ds } = await this.tai(dotId);
    const dong = ds.map((x) => x.dong);
    return {
      dot,
      tong_hop: tongHopTienDo(dong),
      dong: locTienDo(dong, loc),
    };
  }

  /** T5: Excel các trường vừa khớp bộ lọc vừa chưa xong (chưa nộp hợp đồng). */
  async xuatExcel(dotId: string, loc: LocTienDo = 'tat_ca') {
    const { dot, ds } = await this.tai(dotId);
    const chon = ds.filter((x) => chuaXong(x.dong) && khopLoc(x.dong, loc));
    const buffer = await taoFileTienDo(
      chon.map(({ dong: d, thaoTacCuoi, lienHe }) => ({
        ma: d.don_vi.ma,
        ten: d.don_vi.ten,
        so_nguoi: d.so_nguoi,
        tong_suat: d.tong_suat,
        gia_tri: d.gia_tri,
        trang_thai_danh_sach: d.trang_thai_danh_sach,
        so_de_nghi_cho: d.so_de_nghi_cho,
        ho_so: tinhTrangHoSoCua(d),
        trang_thai_hop_dong: d.trang_thai_hop_dong,
        thao_tac_cuoi_luc: thaoTacCuoi,
        lien_he: lienHe,
      })),
    );
    // Có SĐT/email liên hệ → ghi nhật ký (chỉ đợt, bộ lọc, số trường — không tên/SĐT).
    await this.nhatKy.ghi({
      hanh_dong: 'xuat_tien_do_dot',
      chi_tiet: { dot_trien_khai_id: dot.id, loc, so_truong: chon.length },
    });
    return { buffer, tenFile: tenFileTienDo(dot.ten, new Date()) };
  }

  private async tai(dotId: string) {
    const d = await this.prisma.dot_trien_khai.findUnique({
      where: { id: dotId },
      select: {
        id: true,
        ten: true,
        chuong_trinh: true,
        don_gia: true,
        han_nop: true,
      },
    });
    if (!d) throw new NotFoundAppException(KHONG_THAY_DOT);
    const theoDot = { dot_trien_khai_id: dotId };
    const [hopDong, soDong, deNghi, hoSo] = await Promise.all([
      this.prisma.hop_dong_boi_duong.findMany({
        where: theoDot,
        include: {
          don_vi: {
            select: {
              id: true,
              ma_don_vi: true,
              ten_don_vi: true,
              dia_ban: { select: { ten: true } },
            },
          },
          thao_tac_cuoi_user: { select: { ho_ten: true, ten_dang_nhap: true } },
          nop_boi_user: { select: { ho_ten: true, ten_dang_nhap: true } },
        },
      }),
      this.prisma.danh_sach_tham_gia.groupBy({
        by: ['don_vi_id'],
        where: theoDot,
        _count: { _all: true },
        _sum: { ty_le_suat: true },
      }),
      this.prisma.de_nghi_sua_danh_sach.groupBy({
        by: ['don_vi_id'],
        where: { ...theoDot, trang_thai: 'cho' },
        _count: { _all: true },
      }),
      this.prisma.ho_so_don_vi.findMany({
        where: { don_vi: { hop_dong_boi_duong: { some: theoDot } } },
      }),
    ]);
    const demDong = new Map(soDong.map((x) => [x.don_vi_id, x]));
    const demDeNghi = new Map(deNghi.map((x) => [x.don_vi_id, x._count._all]));
    const hoSoTheo = new Map(hoSo.map((h) => [h.don_vi_id, layDuLieu(h)]));

    const ds: DongNoiBo[] = hopDong.map((h) => {
      const dem = demDong.get(h.don_vi_id);
      const hoSoHienTai = hoSoTheo.get(h.don_vi_id) ?? null;
      const sl = soLieuHopDong(h, {
        so_nguoi: dem?._count._all ?? 0,
        tong_suat: Number(dem?._sum.ty_le_suat ?? 0),
        don_gia: d.don_gia,
        hoSo: hoSoHienTai,
      });
      const thaoTacCuoi = mocMuonHon(h.thao_tac_cuoi_luc, h.nop_luc);
      const nguoi =
        thaoTacCuoi && h.nop_luc && thaoTacCuoi === h.nop_luc
          ? (h.nop_boi_user ?? h.thao_tac_cuoi_user)
          : h.thao_tac_cuoi_user;
      const dong: DongTienDo = {
        don_vi: {
          id: h.don_vi.id,
          ma: h.don_vi.ma_don_vi,
          ten: h.don_vi.ten_don_vi,
          dia_ban: h.don_vi.dia_ban.ten,
        },
        so_nguoi: sl.so_nguoi,
        tong_suat: sl.tong_suat,
        gia_tri: sl.gia_tri,
        trang_thai_danh_sach: h.trang_thai_danh_sach,
        trang_thai_hop_dong: h.trang_thai_hop_dong,
        nop_luc: h.nop_luc ? h.nop_luc.toISOString() : null,
        so_de_nghi_cho: demDeNghi.get(h.don_vi_id) ?? 0,
        ho_so_du: sl.hoSo ? tinhTrangHoSo(sl.hoSo).du : false,
        co_ho_so: sl.hoSo !== null,
        thao_tac_cuoi_luc: thaoTacCuoi ? thaoTacCuoi.toISOString() : null,
        thao_tac_cuoi_boi: thaoTacCuoi ? nguoi : null,
      };
      const lienHe: LienHe = hoSoHienTai
        ? {
            nguoi: hoSoHienTai.nguoi_dai_dien,
            sdt: hoSoHienTai.sdt_dai_dien,
            email: hoSoHienTai.email_hoa_don,
          }
        : null;
      return { dong, thaoTacCuoi, lienHe };
    });
    ds.sort(
      (a, b) =>
        a.dong.don_vi.ten.localeCompare(b.dong.don_vi.ten, 'vi') ||
        a.dong.don_vi.id.localeCompare(b.dong.don_vi.id),
    );
    return {
      dot: {
        id: d.id,
        ten: d.ten,
        chuong_trinh: d.chuong_trinh,
        don_gia: d.don_gia,
        han_nop: d.han_nop.toISOString(),
        han_nop_ngay: ngayVietNam(d.han_nop),
      },
      ds,
    };
  }
}
