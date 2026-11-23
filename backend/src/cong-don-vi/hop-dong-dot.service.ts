import { Injectable } from '@nestjs/common';
import type {
  chuong_trinh_boi_duong,
  trang_thai_danh_sach_truong,
  trang_thai_hop_dong,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NhatKyService } from '../nhat-ky/nhat-ky.service';
import { NotFoundAppException } from '../common/exceptions/app.exceptions';
import { layDuLieu } from './ho-so-don-vi.service';
import { soLieuHopDong } from './hop-dong.service';
import { ngaySangChuoi, ngayVietNam } from './dot-trien-khai.service';
import { thongTinHan } from './han-nop';
import { quaHan } from './tien-do-dot';
import type { GiaiDoanThamGia } from './quy-tac-hop-dong';
import { BanChupKhtc, cheStk, tenFileKhtc } from './xuat-khtc';
import { taoFileKhtc } from './xuat-khtc.excel';

export interface DotHopDong {
  id: string;
  ten: string;
  chuong_trinh: chuong_trinh_boi_duong;
  don_gia: number | null;
  han_nop: string;
  han_nop_ngay: string;
}

/** O4: 1 dòng danh sách hợp đồng của Quản trị — STK cá nhân CHỈ ở dạng đã che (tên thuộc tính *_che). */
export interface DongHopDongQuanTri {
  don_vi: { id: string; ma: string | null; ten: string };
  trang_thai_danh_sach: trang_thai_danh_sach_truong;
  trang_thai_hop_dong: trang_thai_hop_dong;
  nop_luc: string | null;
  so_nguoi: number;
  tong_suat: number;
  gia_tri: number | null;
  han_hieu_luc_ngay: string;
  qua_han: boolean;
  ht_ho_ten: string | null;
  ht_so_tai_khoan_che: string | null;
  kt_ho_ten: string | null;
  kt_so_tai_khoan_che: string | null;
}

export interface DanhSachHopDongDot {
  dot: DotHopDong;
  items: DongHopDongQuanTri[];
}

const KHONG_THAY_DOT = 'Không tìm thấy đợt triển khai';
const vi = (a: string, b: string) => a.localeCompare(b, 'vi');

// Issue #67 / ADR 0015 O1, O2, O4, P2: danh sách hợp đồng của 1 đợt (STK che) + file Excel 3 sheet cho Phòng
// KHTC (chỉ hợp đồng đã nộp, mọi giá trị hồ sơ từ bản chụp lúc nộp). Chỉ Quản trị. Số truy vấn cố định.
@Injectable()
export class HopDongDotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nhatKy: NhatKyService,
  ) {}

  /** Mọi trường của đợt; đã nộp: số liệu + Phần 5 từ bản chụp; chưa nộp: trực tiếp + hồ sơ hiện tại. */
  async danhSach(dotId: string): Promise<DanhSachHopDongDot> {
    const d = await this.layDot(dotId);
    const theoDot = { dot_trien_khai_id: dotId };
    const [hopDong, soDong, hoSo] = await Promise.all([
      this.prisma.hop_dong_boi_duong.findMany({
        where: theoDot,
        include: {
          don_vi: { select: { id: true, ma_don_vi: true, ten_don_vi: true } },
        },
      }),
      this.prisma.danh_sach_tham_gia.groupBy({
        by: ['don_vi_id'],
        where: theoDot,
        _count: { _all: true },
        _sum: { ty_le_suat: true },
      }),
      this.prisma.ho_so_don_vi.findMany({
        where: { don_vi: { hop_dong_boi_duong: { some: theoDot } } },
      }),
    ]);
    const demDong = new Map(soDong.map((x) => [x.don_vi_id, x]));
    const hoSoTheo = new Map(hoSo.map((h) => [h.don_vi_id, layDuLieu(h)]));
    const now = new Date();
    const items = hopDong.map((h): DongHopDongQuanTri => {
      const dem = demDong.get(h.don_vi_id);
      const sl = soLieuHopDong(h, {
        so_nguoi: dem?._count._all ?? 0,
        tong_suat: Number(dem?._sum.ty_le_suat ?? 0),
        don_gia: d.don_gia,
        hoSo: hoSoTheo.get(h.don_vi_id) ?? null,
      });
      const han = thongTinHan(d.han_nop, h.han_rieng, now);
      const hs = sl.hoSo;
      return {
        don_vi: {
          id: h.don_vi.id,
          ma: h.don_vi.ma_don_vi,
          ten: h.don_vi.ten_don_vi,
        },
        trang_thai_danh_sach: h.trang_thai_danh_sach,
        trang_thai_hop_dong: h.trang_thai_hop_dong,
        nop_luc: h.nop_luc ? h.nop_luc.toISOString() : null,
        so_nguoi: sl.so_nguoi,
        tong_suat: sl.tong_suat,
        gia_tri: sl.gia_tri,
        han_hieu_luc_ngay: han.han_hieu_luc_ngay,
        qua_han: quaHan(han.da_het_han, h.trang_thai_hop_dong),
        ht_ho_ten: hs?.ht_ho_ten ?? null,
        ht_so_tai_khoan_che: cheStk(hs?.ht_so_tai_khoan ?? null),
        kt_ho_ten: hs?.kt_ho_ten ?? null,
        kt_so_tai_khoan_che: cheStk(hs?.kt_so_tai_khoan ?? null),
      };
    });
    items.sort(
      (a, b) =>
        vi(a.don_vi.ten, b.don_vi.ten) ||
        a.don_vi.id.localeCompare(b.don_vi.id),
    );
    return { dot: this.dotPhanHoi(d), items };
  }

  /**
   * O1: Excel cho KHTC — chỉ hợp đồng đã nộp; hồ sơ từ ban_chup_ho_so (không đọc hồ sơ hiện tại), số liệu từ
   * các cột *_luc_nop, Phần 3–4 + điểm học trực tiếp từ hop_dong. O4: mỗi lần xuất ghi nhật ký (không tên/STK).
   */
  async xuatKhtc(dotId: string) {
    const d = await this.layDot(dotId);
    const hopDong = await this.prisma.hop_dong_boi_duong.findMany({
      where: { dot_trien_khai_id: dotId, trang_thai_hop_dong: 'da_nop' },
      include: {
        don_vi: { select: { id: true, ma_don_vi: true, ten_don_vi: true } },
      },
    });
    const donViIds = hopDong.map((h) => h.don_vi_id);
    const dong = donViIds.length
      ? await this.prisma.danh_sach_tham_gia.findMany({
          where: { dot_trien_khai_id: dotId, don_vi_id: { in: donViIds } },
          select: {
            don_vi_id: true,
            ho_ten: true,
            ngay_sinh: true,
            lop: true,
            giai_doan: true,
            ty_le_suat: true,
          },
        })
      : [];
    const donVi = new Map(hopDong.map((h) => [h.don_vi_id, h.don_vi]));
    const ds = hopDong.map((h) => {
      // Chỉ hợp đồng đã nộp → soLieuHopDong luôn trả số liệu lúc nộp (phần trực tiếp không dùng tới).
      const sl = soLieuHopDong(h, {
        so_nguoi: 0,
        tong_suat: 0,
        don_gia: null,
        hoSo: null,
      });
      return {
        ma_truong: h.don_vi.ma_don_vi,
        ten_don_vi: h.don_vi.ten_don_vi,
        trang_thai_hop_dong: h.trang_thai_hop_dong,
        nop_luc: h.nop_luc,
        ban_chup: (h.ban_chup_ho_so ?? {}) as BanChupKhtc,
        nguoi_nhan: h.nguoi_nhan,
        sdt_nguoi_nhan: h.sdt_nguoi_nhan,
        dia_chi_nhan: h.dia_chi_nhan,
        ghi_chu: h.ghi_chu,
        so_qd: h.so_qd,
        ngay_qd: ngaySangChuoi(h.ngay_qd),
        diem_hoc_truc_tiep: h.diem_hoc_truc_tiep,
        so_nguoi: sl.so_nguoi,
        tong_suat: sl.tong_suat,
        don_gia: sl.don_gia,
        gia_tri: sl.gia_tri,
      };
    });
    const giaoVien = dong.map((g) => {
      const dv = donVi.get(g.don_vi_id);
      return {
        ma_truong: dv?.ma_don_vi ?? null,
        ten_truong: dv?.ten_don_vi ?? '',
        ho_ten: g.ho_ten,
        ngay_sinh: ngaySangChuoi(g.ngay_sinh),
        lop: g.lop,
        giai_doan: g.giai_doan as GiaiDoanThamGia,
        ty_le_suat: Number(g.ty_le_suat),
      };
    });
    const buffer = await taoFileKhtc(ds, giaoVien);
    // Có STK cá nhân (Phần 5) → nhật ký mỗi lần xuất; chỉ số đếm — không tên, không STK.
    await this.nhatKy.ghi({
      hanh_dong: 'xuat_khtc_hop_dong',
      chi_tiet: {
        dot_trien_khai_id: d.id,
        so_hop_dong: ds.length,
        so_giao_vien: giaoVien.length,
        co_stk_ca_nhan: true,
      },
    });
    return { buffer, tenFile: tenFileKhtc(d.ten, new Date()) };
  }

  private async layDot(dotId: string) {
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
    return d;
  }

  private dotPhanHoi(d: Awaited<ReturnType<HopDongDotService['layDot']>>) {
    return {
      id: d.id,
      ten: d.ten,
      chuong_trinh: d.chuong_trinh,
      don_gia: d.don_gia,
      han_nop: d.han_nop.toISOString(),
      han_nop_ngay: ngayVietNam(d.han_nop),
    };
  }
}
