import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundAppException } from '../common/exceptions/app.exceptions';
import { TrangThaiNhac, trangThaiNhac } from '../nhac-lich/nhac-lich.util';

// ADR 0004 G9 (issue #15): "Trang lớp" dùng chung — 1 hàm lấy đủ dữ liệu 1
// đợt (lớp × giai đoạn) + 1 hàm thuần lọc trường theo vai trò (ma trận đặc tả
// §3). Mỗi khu (hỗ trợ GV, giảng viên…) kiểm phạm vi bằng scope service của
// mình TRƯỚC khi gọi.

export type VaiTroXemLop = 'quan_tri' | 'ho_tro_giang_vien' | 'giang_vien';

export interface GiangVienBuoi {
  id: string;
  ho_ten: string;
  vai_tro: string;
  so_dien_thoai?: string;
  email?: string | null;
  so_gio?: number | null;
  da_xac_nhan_gio?: boolean;
  /** ADR 0004 G8 (issue #20): trạng thái tài khoản cổng giảng viên. */
  tai_khoan?: TrangThaiTaiKhoanGv;
  /** ADR 0004 G11 (issue #21): đã nhắc giảng viên về buổi này chưa. */
  nhac?: TrangThaiNhac;
}

export type TrangThaiTaiKhoanGv =
  'chua_co' | 'chua_kich_hoat' | 'hoat_dong' | 'bi_khoa';

export function trangThaiTaiKhoanGv(
  tk: { trang_thai: string; phai_doi_mat_khau: boolean } | null,
): TrangThaiTaiKhoanGv {
  if (!tk) return 'chua_co';
  if (tk.trang_thai !== 'active') return 'bi_khoa';
  return tk.phai_doi_mat_khau ? 'chua_kich_hoat' : 'hoat_dong';
}

export interface HocVienDot {
  dang_ky_hoc_id: string;
  hoc_vien_id: string;
  ho_ten: string;
  gioi_tinh: string | null;
  don_vi: string;
  doi_tuong: string | null;
  chuc_vu: string | null;
  muc_dau_vao: string | null;
  so_dien_thoai?: string | null;
  email?: string | null;
  cum?: {
    id: string;
    ten_cum: string;
    nguoi_ho_tro: { ho_ten: string; email: string | null }[];
  } | null;
  diem_danh: Record<string, string>;
  /** ADR 0004 G13 (issue #18): lich_hoc_id → lý do báo vắng. */
  bao_vang: Record<string, string>;
  ket_qua: { ty_le_hoan_thanh: number | null; diem: number | null } | null;
}

export async function layDotLop(
  prisma: PrismaService,
  lopId: string,
  giaiDoanId: string,
) {
  const lop = await prisma.lop_hoc.findUnique({
    where: { id: lopId },
    select: {
      id: true,
      ten_lop: true,
      loai_lop: true,
      si_so_toi_da: true,
      khoa: { select: { id: true, ma_khoa: true, ten_khoa: true } },
    },
  });
  const giaiDoan = await prisma.giai_doan_khoa.findUnique({
    where: { id: giaiDoanId },
    select: {
      id: true,
      khoa_id: true,
      thu_tu: true,
      ten_giai_doan: true,
      hinh_thuc: true,
      thoi_gian_bat_dau: true,
      thoi_gian_ket_thuc: true,
    },
  });
  if (!lop || !giaiDoan || giaiDoan.khoa_id !== lop.khoa.id) {
    throw new NotFoundAppException('Không tìm thấy đợt học của lớp');
  }

  const [dsBuoi, dsPhanLop, nhom, hauCan, thucDia, deNghiCho] =
    await Promise.all([
      prisma.lich_hoc_lop.findMany({
        where: { lop_id: lopId, giai_doan_id: giaiDoanId },
        include: {
          diem_hoc: {
            select: {
              id: true,
              ma_diem_hoc: true,
              ten: true,
              dia_chi: true,
              nguoi_lien_he: true,
              sdt_lien_he: true,
              so_phong: true,
              ghi_chu_csvc: true,
            },
          },
          phan_cong: {
            include: {
              giang_vien: {
                include: {
                  tai_khoan: {
                    select: { trang_thai: true, phai_doi_mat_khau: true },
                  },
                },
              },
            },
            orderBy: { created_at: 'asc' },
          },
        },
        orderBy: [{ buoi_so: 'asc' }, { thoi_gian_bat_dau: 'asc' }],
      }),
      prisma.phan_lop_giai_doan.findMany({
        where: { lop_id: lopId, giai_doan_id: giaiDoanId },
        select: {
          dang_ky_hoc: {
            select: {
              id: true,
              muc_dau_vao: true,
              hoc_vien: {
                select: {
                  id: true,
                  ho_ten: true,
                  gioi_tinh: true,
                  doi_tuong: true,
                  chuc_vu: true,
                  so_dien_thoai_lien_he: true,
                  email_lien_he: true,
                  don_vi_cong_tac: { select: { ten_don_vi: true } },
                },
              },
              cum: {
                select: {
                  id: true,
                  ten_cum: true,
                  phan_cong_ho_tro: {
                    select: {
                      nguoi_dung: { select: { ho_ten: true, email: true } },
                    },
                  },
                },
              },
              diem_danh: {
                where: {
                  lich_hoc: { lop_id: lopId, giai_doan_id: giaiDoanId },
                },
                select: { lich_hoc_id: true, trang_thai: true },
              },
              bao_vang: {
                where: {
                  lich_hoc: { lop_id: lopId, giai_doan_id: giaiDoanId },
                },
                select: { lich_hoc_id: true, ly_do: true },
              },
              ket_qua_giai_doan: {
                where: { giai_doan_id: giaiDoanId },
                select: { ty_le_hoan_thanh: true, diem: true },
              },
            },
          },
        },
      }),
      prisma.phan_cong_ho_tro_gv.findMany({
        where: { khoa_id: lop.khoa.id },
        select: { nguoi_dung: { select: { ho_ten: true, email: true } } },
        orderBy: { created_at: 'asc' },
      }),
      // ADR 0004 L3 (issue #16): hậu cần giảng viên + thực địa của đợt.
      prisma.hau_can_giang_vien.findMany({
        where: { lop_id: lopId, giai_doan_id: giaiDoanId },
        include: { nguoi_sua: { select: { ho_ten: true } } },
      }),
      prisma.nhan_su_thuc_dia.findMany({
        where: { lop_id: lopId, giai_doan_id: giaiDoanId },
        orderBy: { created_at: 'asc' },
      }),
      // ADR 0004 G14 (issue #18): đề nghị đổi lớp đang chờ, ra hoặc vào lớp này.
      prisma.de_nghi_doi_lop.findMany({
        where: {
          giai_doan_id: giaiDoanId,
          trang_thai: 'cho_duyet',
          OR: [{ lop_hien_tai_id: lopId }, { lop_de_nghi_id: lopId }],
        },
        select: {
          id: true,
          ly_do: true,
          tao_luc: true,
          lop_hien_tai_id: true,
          lop_de_nghi_id: true,
          dang_ky_hoc: { select: { hoc_vien: { select: { ho_ten: true } } } },
          lop_hien_tai: { select: { ten_lop: true } },
          lop_de_nghi: { select: { ten_lop: true } },
        },
        orderBy: { tao_luc: 'asc' },
      }),
    ]);

  // ADR 0004 G11 (issue #21): nhật ký nhắc giảng viên chứa các buổi của đợt.
  const nhacGv = await prisma.nhat_ky_nhac_lich.findMany({
    where: {
      doi_tuong: 'giang_vien',
      giang_vien_id: {
        in: [
          ...new Set(
            dsBuoi.flatMap((b) => b.phan_cong.map((p) => p.giang_vien_id)),
          ),
        ],
      },
      lich_hoc_ids: { hasSome: dsBuoi.map((b) => b.id) },
    },
    select: { giang_vien_id: true, lich_hoc_ids: true, gui_luc: true },
  });

  const { khoa_id: _bo, ...gd } = giaiDoan;
  void _bo;
  return {
    lop,
    giai_doan: gd,
    buoi: dsBuoi.map(({ phan_cong, ...b }) => ({
      id: b.id,
      buoi_so: b.buoi_so,
      thoi_gian_bat_dau: b.thoi_gian_bat_dau,
      thoi_gian_ket_thuc: b.thoi_gian_ket_thuc,
      dia_diem_hoac_link: b.dia_diem_hoac_link,
      phong: b.phong,
      trang_thai: b.trang_thai,
      cap_nhat_luc: b.cap_nhat_luc,
      diem_hoc: b.diem_hoc,
      giang_vien: phan_cong.map((p): GiangVienBuoi => ({
        id: p.giang_vien.id,
        ho_ten: p.giang_vien.ho_ten,
        vai_tro: p.vai_tro,
        so_dien_thoai: p.giang_vien.so_dien_thoai,
        email: p.giang_vien.email,
        so_gio: p.so_gio == null ? null : Number(p.so_gio),
        da_xac_nhan_gio: p.da_xac_nhan_gio,
        tai_khoan: trangThaiTaiKhoanGv(p.giang_vien.tai_khoan),
        nhac: trangThaiNhac(
          b,
          nhacGv.filter((n) => n.giang_vien_id === p.giang_vien_id),
        ),
      })),
    })),
    hoc_vien: dsPhanLop
      .map(({ dang_ky_hoc: dk }): HocVienDot => ({
        dang_ky_hoc_id: dk.id,
        hoc_vien_id: dk.hoc_vien.id,
        ho_ten: dk.hoc_vien.ho_ten,
        gioi_tinh: dk.hoc_vien.gioi_tinh,
        don_vi: dk.hoc_vien.don_vi_cong_tac.ten_don_vi,
        doi_tuong: dk.hoc_vien.doi_tuong,
        chuc_vu: dk.hoc_vien.chuc_vu,
        muc_dau_vao: dk.muc_dau_vao,
        so_dien_thoai: dk.hoc_vien.so_dien_thoai_lien_he,
        email: dk.hoc_vien.email_lien_he,
        cum: dk.cum
          ? {
              id: dk.cum.id,
              ten_cum: dk.cum.ten_cum,
              nguoi_ho_tro: dk.cum.phan_cong_ho_tro.map((p) => p.nguoi_dung),
            }
          : null,
        diem_danh: Object.fromEntries(
          dk.diem_danh.map((d) => [d.lich_hoc_id, d.trang_thai]),
        ),
        bao_vang: Object.fromEntries(
          dk.bao_vang.map((b) => [b.lich_hoc_id, b.ly_do]),
        ),
        ket_qua: dk.ket_qua_giai_doan[0]
          ? {
              ty_le_hoan_thanh:
                dk.ket_qua_giai_doan[0].ty_le_hoan_thanh == null
                  ? null
                  : Number(dk.ket_qua_giai_doan[0].ty_le_hoan_thanh),
              diem:
                dk.ket_qua_giai_doan[0].diem == null
                  ? null
                  : Number(dk.ket_qua_giai_doan[0].diem),
            }
          : null,
      }))
      .sort((a, b) => a.ho_ten.localeCompare(b.ho_ten, 'vi')),
    nhom_ho_tro_gv: nhom.map((n) => n.nguoi_dung),
    hau_can: hauCan.map(({ nguoi_sua, ...h }) => ({
      ...h,
      nguoi_sua: nguoi_sua?.ho_ten ?? null,
    })),
    de_nghi_cho: deNghiCho.map((d) => ({
      id: d.id,
      ho_ten: d.dang_ky_hoc.hoc_vien.ho_ten,
      chieu: d.lop_de_nghi_id === lopId ? ('vao' as const) : ('ra' as const),
      tu_lop: d.lop_hien_tai?.ten_lop ?? null,
      den_lop: d.lop_de_nghi.ten_lop,
      ly_do: d.ly_do,
      tao_luc: d.tao_luc,
    })),
    thuc_dia: thucDia.map((t) => ({
      id: t.id,
      ho_ten: t.ho_ten,
      so_dien_thoai: t.so_dien_thoai,
      nhiem_vu: t.nhiem_vu,
      ghi_chu: t.ghi_chu,
    })),
  };
}

export type DotLop = Awaited<ReturnType<typeof layDotLop>>;

/**
 * Hàm thuần — lọc trường theo vai trò người xem (ma trận đặc tả §3, test K6).
 * Quản trị và người hỗ trợ GV thấy đủ (trừ CCCD/ngày sinh/mã MOET vốn không
 * lấy). Giảng viên: không thấy SĐT/email học viên, liên hệ/số giờ giảng viên
 * khác, cụm hỗ trợ của học viên.
 */
export function locTheoVaiTro(
  dot: DotLop,
  vaiTro: VaiTroXemLop,
  giangVienId?: string,
): DotLop {
  if (vaiTro !== 'giang_vien') return dot;
  return {
    ...dot,
    // Đề nghị đổi lớp là việc nội bộ giữa 2 nhóm hỗ trợ (ma trận §3: GV "—").
    de_nghi_cho: [],
    // Hậu cần là dữ liệu cá nhân — giảng viên chỉ thấy của chính mình.
    hau_can: dot.hau_can.filter((h) => h.giang_vien_id === giangVienId),
    buoi: dot.buoi.map((b) => ({
      ...b,
      giang_vien: b.giang_vien.map((g) => ({
        id: g.id,
        ho_ten: g.ho_ten,
        vai_tro: g.vai_tro,
      })),
    })),
    hoc_vien: dot.hoc_vien.map((h) => {
      const { so_dien_thoai: _s, email: _e, cum: _c, ...con } = h;
      void _s;
      void _e;
      void _c;
      return con;
    }),
  };
}

@Injectable()
export class TrangLopService {
  constructor(private readonly prisma: PrismaService) {}

  async layTrangLop(
    lopId: string,
    giaiDoanId: string,
    nguoiXem: { vai_tro: VaiTroXemLop; giang_vien_id?: string },
  ) {
    return locTheoVaiTro(
      await layDotLop(this.prisma, lopId, giaiDoanId),
      nguoiXem.vai_tro,
      nguoiXem.giang_vien_id,
    );
  }
}
