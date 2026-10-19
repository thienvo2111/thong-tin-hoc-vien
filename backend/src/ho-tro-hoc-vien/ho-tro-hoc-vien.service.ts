import { Injectable } from '@nestjs/common';
import { NhacLichService } from '../nhac-lich/nhac-lich.service';
import { khoangNgayVn } from '../common/utils/khoang-ngay-vn.util';
import { boSo0DauDeTimKiem } from '../common/utils/ma-moet.util';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { HocVienService } from '../hoc-vien/hoc-vien.service';
import { KhoaBoiDuongService } from '../khoa-boi-duong/khoa-boi-duong.service';
import { NhatKyService } from '../nhat-ky/nhat-ky.service';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { NotFoundAppException } from '../common/exceptions/app.exceptions';
import { sinhMatKhauTam } from '../nguoi-dung/tai-khoan-don-vi.util';
import { paginate } from '../common/dto/pagination-query.dto';
import { dieuKienKhongDau } from '../common/utils/tim-kiem-khong-dau.util';
import { HoTroHocVienScopeService } from './ho-tro-hoc-vien-scope.service';
import {
  LocHocVienHoTroDto,
  LocLichHocHoTroDto,
  SuaHoSoHoTroDto,
} from './dto/ho-tro-hoc-vien.dto';
import { buildDanhSachCumWorkbook } from './xuat-danh-sach-cum.util';
import {
  buildDanhSachLopWorkbook,
  dinhDangNgaySinh,
} from './xuat-danh-sach-lop.util';
import { buildDanhSachBuoiWorkbook } from './xuat-danh-sach-buoi.util';
import { DoiBuoiHocQueryService } from '../doi-buoi-hoc/doi-buoi-hoc-query.service';
import {
  tinhChuyenCanLop,
  tinhDiemDanhDong,
  tongDiemDanh,
} from './diem-danh-lop-buoi.util';
import { khoaBuoi } from '../common/utils/chuyen-can.util';
import { napChuyenCan } from '../doi-buoi-hoc/nap-chuyen-can';

const SO_NGAY_LICH_MAC_DINH = 14;

const theoHoTen = (
  a: { ho_ten: string; hoc_vien_id: string },
  b: { ho_ten: string; hoc_vien_id: string },
) =>
  a.ho_ten.localeCompare(b.ho_ten, 'vi') ||
  a.hoc_vien_id.localeCompare(b.hoc_vien_id);

// whereDangKy: đăng ký học dùng để lấy cụm/lớp của dòng (theo cụm của tôi,
// hoặc theo lớp được gắn — ADR 0008).
const includeDong = (whereDangKy: Prisma.dang_ky_hocWhereInput) =>
  ({
    chuyen_mon: true,
    don_vi_cong_tac: { select: { ten_don_vi: true } },
    nguoi_dung_account: {
      select: { ten_dang_nhap: true, dang_nhap_lan_cuoi: true },
    },
    ket_qua_khao_sat: {
      select: { loai: true, trang_thai: true, muc: true },
      orderBy: { loai: 'asc' },
    },
    dang_ky_hoc: {
      where: whereDangKy,
      select: {
        id: true,
        khoa_id: true,
        cum: { select: { id: true, ten_cum: true } },
        phan_lop_giai_doan: {
          select: {
            giai_doan_id: true,
            lop_id: true,
            lop: { select: { ten_lop: true } },
            giai_doan: { select: { thu_tu: true, ten_giai_doan: true } },
          },
        },
      },
    },
  }) satisfies Prisma.hoc_vienInclude;

type HocVienDong = Prisma.hoc_vienGetPayload<{
  include: ReturnType<typeof includeDong>;
}>;

// Một buổi của lớp kèm điều chỉnh đổi buổi (ADR 0008 L7).
type BuoiCuaLop = Awaited<ReturnType<HoTroHocVienService['dsBuoi']>>[number];

// ADR 0003 Lát 2 — tra cứu của người hỗ trợ học viên. Mọi hàm nhận caller.id
// và lọc qua HoTroHocVienScopeService (chỉ đọc ở lát này).
@Injectable()
export class HoTroHocVienService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: HoTroHocVienScopeService,
    private readonly hocVienService: HocVienService,
    private readonly khoaBoiDuongService: KhoaBoiDuongService,
    private readonly nhatKy: NhatKyService,
    private readonly authService: AuthService,
    private readonly nhacLich: NhacLichService,
    private readonly doiBuoiQuery: DoiBuoiHocQueryService,
  ) {}

  async cumCuaToi(nguoiDungId: string) {
    const cumIds = await this.scope.cumIdsCuaToi(nguoiDungId);
    if (cumIds.length === 0) return [];
    const cums = await this.prisma.cum_hoc_vien.findMany({
      where: { id: { in: cumIds } },
      include: {
        khoa: { select: { id: true, ma_khoa: true, ten_khoa: true } },
        _count: { select: { dang_ky_hoc: true } },
      },
      orderBy: [{ khoa: { ma_khoa: 'asc' } }, { ten_cum: 'asc' }],
    });
    return cums.map((c) => ({
      cum_id: c.id,
      ten_cum: c.ten_cum,
      link_zalo: c.link_zalo,
      trang_thai: c.trang_thai,
      khoa_id: c.khoa.id,
      ma_khoa: c.khoa.ma_khoa,
      ten_khoa: c.khoa.ten_khoa,
      so_hoc_vien: c._count.dang_ky_hoc,
    }));
  }

  async danhSachHocVien(nguoiDungId: string, query: LocHocVienHoTroDto) {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const cumIds = await this.scope.cumLoc(nguoiDungId, query.cum_id);
    if (cumIds.length === 0) return paginate([], 0, page, pageSize);
    const where = await this.xayWhere(cumIds, query);

    // day_du không phải cột DB (tính lại bằng danhGiaDayDu) — có lọc thì lọc
    // trong bộ nhớ như GET /hoc-vien (quy mô 1 cụm vài trăm học viên).
    if (query.day_du !== undefined) {
      const tatCa = await this.layDong(cumIds, where);
      const loc = tatCa.filter((d) => d.day_du === query.day_du);
      const start = (page - 1) * pageSize;
      return paginate(
        loc.slice(start, start + pageSize),
        loc.length,
        page,
        pageSize,
      );
    }
    const [rows, total] = await Promise.all([
      this.layDong(cumIds, where, {
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.hoc_vien.count({ where }),
    ]);
    return paginate(rows, total, page, pageSize);
  }

  async chiTietHocVien(nguoiDungId: string, hocVienId: string) {
    await this.scope.damBaoTrongPhamVi(nguoiDungId, hocVienId);
    const [hoSo, hocTap, taiKhoan, khaoSat, yeuCau, lichSu] = await Promise.all(
      [
        this.hocVienService.hoSoVoiTenKhongKiemPhamVi(hocVienId),
        this.khoaBoiDuongService.khoaHocTheoHocVienId(hocVienId),
        this.prisma.nguoi_dung.findUnique({
          where: { hoc_vien_id: hocVienId },
          select: {
            id: true,
            ten_dang_nhap: true,
            trang_thai: true,
            dang_nhap_lan_cuoi: true,
            phai_doi_mat_khau: true,
            khoa_den: true,
          },
        }),
        this.prisma.ket_qua_khao_sat.findMany({
          where: { hoc_vien_id: hocVienId },
          select: {
            loai: true,
            trang_thai: true,
            muc: true,
            hoan_thanh_luc: true,
            cap_nhat_luc: true,
          },
          orderBy: { loai: 'asc' },
        }),
        this.prisma.yeu_cau_ho_tro.findMany({
          where: { hoc_vien_id: hocVienId },
          select: {
            id: true,
            tinh_huong: true,
            noi_dung_hoi: true,
            trang_thai: true,
            thoi_gian_tao: true,
            thoi_gian_phan_hoi: true,
          },
          orderBy: { thoi_gian_tao: 'desc' },
          take: 20,
        }),
        this.prisma.lich_su_thay_doi_ho_so.findMany({
          where: { hoc_vien_id: hocVienId },
          select: {
            truong: true,
            gia_tri_cu: true,
            gia_tri_moi: true,
            vai_tro_nguoi_sua: true,
            sua_luc: true,
            ly_do: true,
            nguoi_sua: { select: { ho_ten: true } },
          },
          orderBy: { sua_luc: 'desc' },
          take: 50,
        }),
      ],
    );
    return {
      ho_so: hoSo,
      tai_khoan: taiKhoan && {
        ...taiKhoan,
        dang_bi_khoa:
          !!taiKhoan.khoa_den && taiKhoan.khoa_den.getTime() > Date.now(),
        email_da_xac_minh: hoSo.email_da_xac_minh,
      },
      hoc_tap: hocTap,
      khao_sat: khaoSat,
      yeu_cau_ho_tro: yeuCau,
      lich_su_thay_doi: lichSu.map(({ nguoi_sua, ...r }) => ({
        ...r,
        nguoi_sua_ten: nguoi_sua.ho_ten,
      })),
    };
  }

  async lichHoc(nguoiDungId: string, query: LocLichHocHoTroDto) {
    const cumIds = await this.scope.cumLoc(nguoiDungId, query.cum_id);
    if (cumIds.length === 0) return [];
    const { tu, den } = khoangNgayVn(query, SO_NGAY_LICH_MAC_DINH);

    // Các cặp (lớp, giai đoạn) có học viên của cụm được gán — buổi chỉ "của
    // cụm" khi học viên cụm được phân vào đúng lớp ở đúng giai đoạn của buổi.
    // Spec đổi buổi §5: buổi chốt của học viên cụm cũng là buổi của cụm.
    const [capLop, doi] = await Promise.all([
      this.prisma.phan_lop_giai_doan.groupBy({
        by: ['lop_id', 'giai_doan_id'],
        where: { dang_ky_hoc: { cum_id: { in: cumIds } } },
        _count: { _all: true },
      }),
      this.nhacLich.doiBuoiCuaCum(cumIds, tu),
    ]);
    if (capLop.length === 0 && doi.length === 0) return [];
    const soHocVien = new Map(
      capLop.map((c) => [`${c.lop_id}|${c.giai_doan_id}`, c._count._all]),
    );

    const buoi = await this.prisma.lich_hoc_lop.findMany({
      where: {
        OR: [
          ...capLop.map(({ lop_id, giai_doan_id }) => ({
            lop_id,
            giai_doan_id,
          })),
          { id: { in: doi.map((d) => d.lich_chot_id) } },
        ],
        thoi_gian_bat_dau: { gte: tu, lte: den },
      },
      include: {
        lop: {
          select: {
            id: true,
            ten_lop: true,
            loai_lop: true,
            khoa: {
              select: {
                id: true,
                ma_khoa: true,
                ten_khoa: true,
                // ADR 0004 G9 (issue #15): nhóm hỗ trợ giảng viên của khóa.
                phan_cong_ho_tro_gv: {
                  select: {
                    nguoi_dung: { select: { ho_ten: true, email: true } },
                  },
                },
              },
            },
            nhan_su: {
              select: { ho_ten: true, vai_tro: true, so_dien_thoai: true },
            },
          },
        },
        giai_doan: { select: { id: true, thu_tu: true, ten_giai_doan: true } },
        // ADR 0004 G9: điểm học của buổi (không kèm hậu cần giảng viên).
        diem_hoc: {
          select: {
            id: true,
            ten: true,
            dia_chi: true,
            nguoi_lien_he: true,
            sdt_lien_he: true,
          },
        },
      },
      orderBy: [{ thoi_gian_bat_dau: 'asc' }, { buoi_so: 'asc' }],
      take: 500,
    });
    // ADR 0004 G4 (issue #16): người hỗ trợ thực địa của đợt (lớp × giai đoạn).
    const thucDia = await this.prisma.nhan_su_thuc_dia.findMany({
      where: {
        OR: buoi.map(({ lop_id, giai_doan_id }) => ({
          lop_id,
          giai_doan_id,
        })),
      },
      select: {
        lop_id: true,
        giai_doan_id: true,
        ho_ten: true,
        so_dien_thoai: true,
        nhiem_vu: true,
      },
      orderBy: { created_at: 'asc' },
    });
    const nhacCum = await this.nhacLich.trangThaiCumTheoBuoi(cumIds, buoi, doi);
    return buoi.map(({ lop, ...b }) => {
      const { nhan_su, khoa, ...lopGon } = lop;
      const { phan_cong_ho_tro_gv, ...khoaGon } = khoa;
      return {
        ...b,
        lop: lopGon,
        khoa: khoaGon,
        nhan_su,
        nhom_ho_tro_gv: phan_cong_ho_tro_gv.map((p) => p.nguoi_dung),
        thuc_dia: thucDia
          .filter(
            (t) => t.lop_id === b.lop_id && t.giai_doan_id === b.giai_doan_id,
          )
          .map(({ ho_ten, so_dien_thoai, nhiem_vu }) => ({
            ho_ten,
            so_dien_thoai,
            nhiem_vu,
          })),
        // Theo buổi: học viên cụm phân vào lớp − đổi ra + đổi vào buổi này.
        so_hoc_vien_cum:
          (soHocVien.get(`${b.lop_id}|${b.giai_doan_id}`) ?? 0) -
          doi.filter((d) => d.lich_nguon_id === b.id).length +
          doi.filter((d) => d.lich_chot_id === b.id).length,
        hoc_vien_doi_buoi: doi
          .filter((d) => d.lich_chot_id === b.id)
          .map((d) => d.ho_ten),
        // ADR 0004 G11 (issue #21): trạng thái nhắc từng cụm có học viên trong lớp.
        nhac_cum: nhacCum.get(b.id) ?? [],
      };
    });
  }

  async xuatDanhSach(
    nguoiDungId: string,
    vaiTro: 'ho_tro_hoc_vien',
    query: LocHocVienHoTroDto,
  ): Promise<Buffer> {
    const cumIds = await this.scope.cumLoc(nguoiDungId, query.cum_id);
    const cums = await this.prisma.cum_hoc_vien.findMany({
      where: { id: { in: cumIds } },
      include: {
        khoa: {
          select: {
            giai_doan: {
              where: { trang_thai: 'active' },
              select: { id: true, thu_tu: true, ten_giai_doan: true },
              orderBy: { thu_tu: 'asc' },
            },
          },
        },
      },
      orderBy: { ten_cum: 'asc' },
    });
    let dong: Awaited<ReturnType<HoTroHocVienService['layDong']>> = [];
    if (cumIds.length > 0) {
      dong = await this.layDong(cumIds, await this.xayWhere(cumIds, query));
      if (query.day_du !== undefined)
        dong = dong.filter((d) => d.day_du === query.day_du);
    }

    const buffer = await buildDanhSachCumWorkbook(
      cums.map((c) => ({
        ten_cum: c.ten_cum,
        giai_doan: c.khoa.giai_doan,
        hoc_vien: dong.filter((d) => d.cum.some((x) => x.cum_id === c.id)),
      })),
    );
    await this.nhatKy.ghi({
      hanh_dong: 'ho_tro_xuat_danh_sach',
      nguoi_dung: { id: nguoiDungId, vai_tro: vaiTro },
      chi_tiet: {
        cum_ids: cumIds,
        bo_loc: { ...query, page: undefined, page_size: undefined },
        so_dong: dong.length,
      },
    });
    return buffer;
  }

  // ---------------------------------------------------------------------
  // ADR 0008 — người hỗ trợ theo LỚP (lớp gốc qua phan_lop_giai_doan; đổi
  // buổi không tính). Lớp không được gắn → 404.
  // ---------------------------------------------------------------------

  async lopCuaToi(nguoiDungId: string) {
    const lopIds = await this.scope.lopIdsCuaToi(nguoiDungId);
    return lopIds.length === 0 ? [] : this.dauLop(lopIds);
  }

  async hocVienCuaLop(nguoiDungId: string, lopId: string) {
    await this.scope.damBaoLopCuaToi(nguoiDungId, lopId);
    const [[lop], dong] = await Promise.all([
      this.dauLop([lopId]),
      this.layDongLop(lopId),
    ]);
    return { lop, hoc_vien: dong };
  }

  async xuatDanhSachLop(
    nguoiDungId: string,
    vaiTro: 'ho_tro_hoc_vien',
    lopId?: string,
  ): Promise<Buffer> {
    let lopIds: string[];
    if (lopId) {
      await this.scope.damBaoLopCuaToi(nguoiDungId, lopId);
      lopIds = [lopId];
    } else {
      lopIds = await this.scope.lopIdsCuaToi(nguoiDungId);
    }
    const lops = lopIds.length > 0 ? await this.dauLop(lopIds) : [];
    const sheets = [];
    let soDong = 0;
    for (const l of lops) {
      const hocVien = await this.layDongLop(l.lop_id);
      soDong += hocVien.length;
      sheets.push({ ...l, hoc_vien: hocVien });
    }
    const buffer = await buildDanhSachLopWorkbook(sheets);
    await this.nhatKy.ghi({
      hanh_dong: 'ho_tro_xuat_danh_sach_lop',
      nguoi_dung: { id: nguoiDungId, vai_tro: vaiTro },
      chi_tiet: { lop_ids: lopIds, so_dong: soDong },
    });
    return buffer;
  }

  /** Thông tin đầu lớp + sĩ số (số đăng ký khác nhau phân vào lớp). */
  private async dauLop(lopIds: string[]) {
    const [lops, cap] = await Promise.all([
      this.prisma.lop_hoc.findMany({
        where: { id: { in: lopIds } },
        select: {
          id: true,
          ten_lop: true,
          loai_lop: true,
          muc_nang_luc: true,
          nhom_hoc_vien: true,
          khoa: { select: { id: true, ma_khoa: true, ten_khoa: true } },
        },
        orderBy: [
          { khoa: { ma_khoa: 'asc' } },
          { loai_lop: 'asc' },
          { ten_lop: 'asc' },
        ],
      }),
      this.prisma.phan_lop_giai_doan.groupBy({
        by: ['lop_id', 'dang_ky_hoc_id'],
        where: { lop_id: { in: lopIds } },
      }),
    ]);
    const siSo = new Map<string, number>();
    for (const c of cap) siSo.set(c.lop_id, (siSo.get(c.lop_id) ?? 0) + 1);
    return lops.map(({ id, ...l }) => ({
      lop_id: id,
      ...l,
      so_hoc_vien: siSo.get(id) ?? 0,
    }));
  }

  /**
   * Học viên có phân lớp gốc vào lớp (mọi giai đoạn), xếp theo họ tên; kèm
   * chuyên cần "có mặt / đã diễn ra" (ADR 0008 L8).
   */
  private async layDongLop(lopId: string) {
    const ds = await this.layDongTheoDangKy({
      phan_lop_giai_doan: { some: { lop_id: lopId } },
    });
    const chuyenCan = await this.chuyenCanTrongLop(
      lopId,
      ds.flatMap(({ r }) => r.dang_ky_hoc),
    );
    return ds
      .map(({ r, dong }) => ({
        ...dong,
        chuyen_can: r.dang_ky_hoc.reduce(
          (t, dk) => {
            const c = chuyenCan.get(dk.id);
            return c
              ? {
                  co_mat: t.co_mat + c.co_mat,
                  da_dien_ra: t.da_dien_ra + c.da_dien_ra,
                }
              : t;
          },
          { co_mat: 0, da_dien_ra: 0 },
        ),
        giai_doan: r.dang_ky_hoc
          .flatMap((dk) => dk.phan_lop_giai_doan)
          .filter((p) => p.lop_id === lopId)
          .sort((a, b) => a.giai_doan.thu_tu - b.giai_doan.thu_tu)
          .map((p) => p.giai_doan.ten_giai_doan),
      }))
      .sort(theoHoTen);
  }

  /**
   * ADR 0008 L8 — chuyên cần theo đăng ký trong lớp: buổi của lớp ở giai đoạn
   * được phân vào lớp; đổi ra khỏi buổi thì "đã diễn ra" theo buổi chốt (ADR
   * 0007); có mặt theo tinhChuyenCan (ADR 0010 T7 — gồm học bù / lớp cũ theo
   * chế độ của khóa, như dashboard). Nạp theo lô: buổi của lớp, đổi buổi hiệu
   * lực, buổi chốt, điểm danh mọi lớp của các đăng ký.
   */
  private async chuyenCanTrongLop(
    lopId: string,
    dangKy: HocVienDong['dang_ky_hoc'],
  ) {
    const kq = new Map<string, { co_mat: number; da_dien_ra: number }>();
    if (dangKy.length === 0) return kq;
    const ids = dangKy.map((dk) => dk.id);
    const [lich, doi, chuyenCan] = await Promise.all([
      this.prisma.lich_hoc_lop.findMany({
        where: { lop_id: lopId },
        select: {
          id: true,
          giai_doan_id: true,
          buoi_so: true,
          thoi_gian_bat_dau: true,
        },
      }),
      this.doiBuoiQuery.doiBuoiDaDuyetCuaDangKy(ids),
      napChuyenCan(this.prisma, this.doiBuoiQuery, ids),
    ]);
    const lichCuaLop = new Set(lich.map((l) => l.id));
    const doiRa = doi.filter((d) => lichCuaLop.has(d.lich_nguon_id));
    const chot = await this.doiBuoiQuery.lichTomTat(
      doiRa.map((d) => d.lich_chot_id),
    );
    const now = new Date();
    for (const dk of dangKy) {
      const chotCuaNguon = new Map<
        string,
        { id: string; thoi_gian_bat_dau: Date }
      >();
      for (const d of doiRa) {
        const c = chot.get(d.lich_chot_id);
        if (d.dang_ky_hoc_id === dk.id && c) {
          chotCuaNguon.set(d.lich_nguon_id, c);
        }
      }
      kq.set(
        dk.id,
        tinhChuyenCanLop({
          lich,
          giai_doan_ids: new Set(
            dk.phan_lop_giai_doan
              .filter((p) => p.lop_id === lopId)
              .map((p) => p.giai_doan_id),
          ),
          chot_cua_nguon: chotCuaNguon,
          ket_qua: chuyenCan.get(dk.id) ?? new Map(),
          now,
        }),
      );
    }
    return kq;
  }

  /**
   * Dòng học viên (cột của danh sách lớp) cho các đăng ký khớp whereDangKy —
   * dùng chung cho danh sách lớp và danh sách theo buổi. Kèm bản ghi gốc để
   * nơi gọi lấy thêm giai đoạn / id đăng ký.
   */
  private async layDongTheoDangKy(whereDangKy: Prisma.dang_ky_hocWhereInput) {
    const rows = await this.prisma.hoc_vien.findMany({
      where: { dang_ky_hoc: { some: whereDangKy } },
      include: includeDong(whereDangKy),
    });
    return Promise.all(
      rows.map(async (r) => {
        const d = await this.toDong(r);
        return {
          r,
          dong: {
            hoc_vien_id: r.id,
            ho_ten: r.ho_ten,
            ma_dinh_danh_moet: r.ma_dinh_danh_moet,
            ngay_sinh: dinhDangNgaySinh(r.ngay_sinh, r.thang_sinh, r.nam_sinh),
            don_vi_cong_tac_ten: d.don_vi_cong_tac_ten,
            doi_tuong: d.doi_tuong,
            so_dien_thoai_lien_he: d.so_dien_thoai_lien_he,
            email_lien_he: d.email_lien_he,
            cum: d.cum[0]?.ten_cum ?? null,
            day_du: d.day_du,
            dang_nhap_lan_cuoi: d.dang_nhap_lan_cuoi,
            khao_sat: d.khao_sat,
          },
        };
      }),
    );
  }

  // ---------------------------------------------------------------------
  // ADR 0008 L7 — danh sách THEO BUỔI của lớp được gắn. Đọc theo buổi đi qua
  // DoiBuoiHocQueryService (CONTEXT.md "Đổi buổi"): phân lớp − đổi ra + đổi
  // vào. Người đổi vào vẫn NGOÀI phạm vi sửa (L2); người đổi ra liệt kê riêng.
  // ---------------------------------------------------------------------

  async buoiCuaLop(nguoiDungId: string, lopId: string) {
    await this.scope.damBaoLopCuaToi(nguoiDungId, lopId);
    return (await this.dsBuoi(lopId)).map((b) => b.item);
  }

  async hocVienCuaBuoi(nguoiDungId: string, lopId: string, lichId: string) {
    await this.scope.damBaoLopCuaToi(nguoiDungId, lopId);
    const [[lop], [buoi]] = await Promise.all([
      this.dauLop([lopId]),
      this.dsBuoi(lopId, lichId),
    ]);
    const { ds, tong } = await this.layDongBuoi(lopId, buoi);
    return { lop, buoi: { ...buoi.item, tong_diem_danh: tong }, ...ds };
  }

  async xuatDanhSachBuoi(
    nguoiDungId: string,
    vaiTro: 'ho_tro_hoc_vien',
    lopId: string,
    lichId?: string,
  ): Promise<Buffer> {
    await this.scope.damBaoLopCuaToi(nguoiDungId, lopId);
    const [[lop], dsBuoi] = await Promise.all([
      this.dauLop([lopId]),
      this.dsBuoi(lopId, lichId),
    ]);
    const sheets = [];
    let soDong = 0;
    for (const b of dsBuoi) {
      const { ds, tong } = await this.layDongBuoi(lopId, b);
      soDong += ds.hoc_vien.length + ds.doi_ra.length;
      sheets.push({ lop, buoi: { ...b.item, tong_diem_danh: tong }, ...ds });
    }
    const buffer = await buildDanhSachBuoiWorkbook(sheets);
    await this.nhatKy.ghi({
      hanh_dong: 'ho_tro_xuat_danh_sach_buoi',
      nguoi_dung: { id: nguoiDungId, vai_tro: vaiTro },
      chi_tiet: {
        lop_id: lopId,
        lich_ids: dsBuoi.map((b) => b.item.lich_id),
        so_dong: soDong,
      },
    });
    return buffer;
  }

  /**
   * Buổi của lớp (chỉ 1 buổi khi có lichId — không thuộc lớp → 404), kèm sĩ
   * số buổi = phân lớp (lớp, giai đoạn) − đổi ra + đổi vào.
   */
  private async dsBuoi(lopId: string, lichId?: string) {
    const lich = await this.prisma.lich_hoc_lop.findMany({
      where: { lop_id: lopId, ...(lichId ? { id: lichId } : {}) },
      select: {
        id: true,
        giai_doan_id: true,
        buoi_so: true,
        thoi_gian_bat_dau: true,
        thoi_gian_ket_thuc: true,
        giai_doan: { select: { id: true, thu_tu: true, ten_giai_doan: true } },
      },
      orderBy: [
        { giai_doan: { thu_tu: 'asc' } },
        { buoi_so: 'asc' },
        { thoi_gian_bat_dau: 'asc' },
      ],
    });
    if (lichId && lich.length === 0) {
      throw new NotFoundAppException('Không tìm thấy buổi học');
    }
    if (lich.length === 0) return [];
    const [phanLop, dieuChinh] = await Promise.all([
      this.prisma.phan_lop_giai_doan.groupBy({
        by: ['giai_doan_id'],
        where: { lop_id: lopId },
        _count: { _all: true },
      }),
      this.doiBuoiQuery.dieuChinhTheoBuoi(lich.map((l) => l.id)),
    ]);
    const demPhanLop = new Map(
      phanLop.map((p) => [p.giai_doan_id, p._count._all]),
    );
    return lich.map((l) => {
      const dc = dieuChinh.get(l.id) ?? { ra: [], vao: [] };
      return {
        giai_doan_id: l.giai_doan_id,
        dieu_chinh: dc,
        item: {
          lich_id: l.id,
          giai_doan: l.giai_doan,
          buoi_so: l.buoi_so,
          thoi_gian_bat_dau: l.thoi_gian_bat_dau,
          thoi_gian_ket_thuc: l.thoi_gian_ket_thuc,
          si_so:
            (demPhanLop.get(l.giai_doan_id) ?? 0) -
            dc.ra.length +
            dc.vao.length,
          so_doi_vao: dc.vao.length,
          so_doi_ra: dc.ra.length,
        },
      };
    });
  }

  /**
   * Danh sách 1 buổi: phân lớp (lớp, giai đoạn) − đổi ra + đổi vào (ghi chú
   * lớp nguồn); người đổi ra trả riêng ở doi_ra (ghi chú lớp chốt).
   * ADR 0008 L8: mỗi dòng của danh sách có diem_danh tại CHÍNH buổi này theo
   * đăng ký của dòng (người đổi vào: đăng ký của họ); đổi ra: diem_danh null.
   */
  private async layDongBuoi(lopId: string, b: BuoiCuaLop) {
    const ra = new Map(
      b.dieu_chinh.ra.map((x) => [x.dang_ky_hoc_id, x.lop_chot.ten_lop]),
    );
    const vao = new Map(
      b.dieu_chinh.vao.map((x) => [x.dang_ky_hoc_id, x.lop_nguon.ten_lop]),
    );
    const boQua = [...ra.keys(), ...vao.keys()];
    const theoIds = (ids: string[]) =>
      ids.length
        ? this.layDongTheoDangKy({ id: { in: ids } })
        : Promise.resolve([]);
    const [thuong, dsVao, dsRa] = await Promise.all([
      this.layDongTheoDangKy({
        phan_lop_giai_doan: {
          some: { lop_id: lopId, giai_doan_id: b.giai_doan_id },
        },
        ...(boQua.length ? { id: { notIn: boQua } } : {}),
      }),
      theoIds([...vao.keys()]),
      theoIds([...ra.keys()]),
    ]);
    // Tên lớp nguồn/chốt theo đăng ký của dòng (1 học viên có thể nhiều khóa).
    const tenLop = (m: Map<string, string>, r: HocVienDong) =>
      m.get(r.dang_ky_hoc.find((dk) => m.has(dk.id))?.id ?? '') ?? '';
    const diemDanhCua = await this.diemDanhTaiBuoi(
      b,
      [...thuong, ...dsVao].flatMap(({ r }) =>
        r.dang_ky_hoc.map((dk) => dk.id),
      ),
    );
    const hocVien = [
      ...thuong.map(({ r, dong }) => ({
        ...dong,
        doi_buoi: null as 'vao' | 'ra' | null,
        ghi_chu: null as string | null,
        diem_danh: diemDanhCua(r),
      })),
      ...dsVao.map(({ r, dong }) => ({
        ...dong,
        doi_buoi: 'vao' as const,
        ghi_chu: `Đổi buổi – từ lớp ${tenLop(vao, r)}`,
        diem_danh: diemDanhCua(r),
      })),
    ].sort(theoHoTen);
    return {
      tong: tongDiemDanh(hocVien.map((h) => h.diem_danh)),
      ds: {
        hoc_vien: hocVien,
        doi_ra: dsRa
          .map(({ r, dong }) => ({
            ...dong,
            doi_buoi: 'ra' as const,
            ghi_chu: `Đã chuyển sang lớp ${tenLop(ra, r)} – không học buổi này`,
            diem_danh: null,
          }))
          .sort(theoHoTen),
      },
    };
  }

  /**
   * Điểm danh tại 1 buổi cho các đăng ký: trạng thái theo tinhChuyenCan của
   * (giai đoạn, buổi số) của buổi (ADR 0010 T7 — đổi buổi bắt buộc cùng giai
   * đoạn + buổi số nên người đổi vào dùng cùng khóa), báo vắng tại buổi này.
   * Trả hàm tính diem_danh của 1 dòng theo đăng ký khớp danh sách của dòng đó.
   */
  private async diemDanhTaiBuoi(b: BuoiCuaLop, dangKyIds: string[]) {
    const lichId = b.item.lich_id;
    const [chuyenCan, baoVang] = await Promise.all([
      napChuyenCan(this.prisma, this.doiBuoiQuery, dangKyIds),
      dangKyIds.length
        ? this.prisma.bao_vang.findMany({
            where: { lich_hoc_id: lichId, dang_ky_hoc_id: { in: dangKyIds } },
            select: { dang_ky_hoc_id: true, ly_do: true },
          })
        : Promise.resolve([] as { dang_ky_hoc_id: string; ly_do: string }[]),
    ]);
    const k = khoaBuoi(b.giai_doan_id, b.item.buoi_so);
    const bvMap = new Map(baoVang.map((v) => [v.dang_ky_hoc_id, v]));
    const now = new Date();
    return (r: HocVienDong) => {
      const ids = r.dang_ky_hoc.map((dk) => dk.id);
      const kq = ids.map((x) => chuyenCan.get(x)?.get(k)).find(Boolean);
      const bv = ids.map((x) => bvMap.get(x)).find(Boolean);
      return tinhDiemDanhDong({
        ket_qua: kq ?? null,
        bao_vang: bv ?? null,
        bat_dau: b.item.thoi_gian_bat_dau,
        now,
      });
    };
  }

  // ---------------------------------------------------------------------
  // Lát 3 — can thiệp hồ sơ & tài khoản (ADR 0003 H7–H9). Mọi thao tác kiểm
  // tra phạm vi cụm TRƯỚC (ngoài phạm vi -> 404).
  // ---------------------------------------------------------------------

  async suaHoSo(
    caller: AuthenticatedUser,
    hocVienId: string,
    dto: SuaHoSoHoTroDto,
  ) {
    await this.scope.damBaoTrongPhamVi(caller.id, hocVienId);
    const { ly_do, ...thayDoi } = dto;
    return this.hocVienService.suaHoSoBoiHoTro(
      hocVienId,
      thayDoi,
      caller,
      ly_do,
    );
  }

  async guiLinkDatLaiMatKhau(nguoiDungId: string, hocVienId: string) {
    await this.scope.damBaoTrongPhamVi(nguoiDungId, hocVienId);
    return this.authService.guiLinkDatLaiMatKhauHocVien(hocVienId);
  }

  // H9(2): mật khẩu tạm hiện 1 lần cho người hỗ trợ nhắn Zalo; buộc đổi ở lần
  // đăng nhập đầu; link đặt lại còn hạn mất hiệu lực. Không có "về ngày sinh".
  async capMatKhauTam(nguoiDungId: string, hocVienId: string) {
    await this.scope.damBaoTrongPhamVi(nguoiDungId, hocVienId);
    const tk = await this.layTaiKhoanHocVien(hocVienId);
    const matKhau = sinhMatKhauTam();
    const hash = await bcrypt.hash(matKhau, 10);
    await this.prisma.$transaction([
      this.prisma.nguoi_dung.update({
        where: { id: tk.id },
        data: {
          mat_khau_hash: hash,
          phai_doi_mat_khau: true,
          khoa_den: null,
          so_lan_dang_nhap_sai: 0,
        },
      }),
      this.prisma.token_xac_thuc.updateMany({
        where: {
          hoc_vien_id: hocVienId,
          loai: 'dat_lai_mat_khau',
          da_dung_luc: null,
        },
        data: { da_dung_luc: new Date() },
      }),
      this.prisma.nhat_ky_dat_lai_mat_khau.create({
        data: { nguoi_dung_id: tk.id, thuc_hien_boi: nguoiDungId },
      }),
    ]);
    return { ten_dang_nhap: tk.ten_dang_nhap, mat_khau_tam: matKhau };
  }

  async moKhoaTam(nguoiDungId: string, hocVienId: string) {
    await this.scope.damBaoTrongPhamVi(nguoiDungId, hocVienId);
    const tk = await this.layTaiKhoanHocVien(hocVienId);
    await this.prisma.nguoi_dung.update({
      where: { id: tk.id },
      data: { khoa_den: null, so_lan_dang_nhap_sai: 0 },
    });
    return { ten_dang_nhap: tk.ten_dang_nhap, dang_bi_khoa: false };
  }

  private async layTaiKhoanHocVien(hocVienId: string) {
    const tk = await this.prisma.nguoi_dung.findUnique({
      where: { hoc_vien_id: hocVienId },
      select: { id: true, ten_dang_nhap: true },
    });
    if (!tk) {
      throw new NotFoundAppException('Học viên chưa có tài khoản đăng nhập');
    }
    return tk;
  }

  private async xayWhere(
    cumIds: string[],
    query: LocHocVienHoTroDto,
  ): Promise<Prisma.hoc_vienWhereInput> {
    const and: Prisma.hoc_vienWhereInput[] = [
      this.scope.whereHocVienTrongCum(cumIds),
    ];
    if (query.don_vi_cong_tac_id)
      and.push({ don_vi_cong_tac_id: query.don_vi_cong_tac_id });
    if (query.da_dang_nhap === true) {
      and.push({ nguoi_dung_account: { dang_nhap_lan_cuoi: { not: null } } });
    } else if (query.da_dang_nhap === false) {
      and.push({
        OR: [
          { nguoi_dung_account: null },
          { nguoi_dung_account: { dang_nhap_lan_cuoi: null } },
        ],
      });
    }
    const q = query.q?.trim();
    if (q) {
      const dk = dieuKienKhongDau(Prisma.sql`ho_ten`, q);
      const idsTheoTen = dk
        ? (
            await this.prisma.$queryRaw<{ id: string }[]>(
              Prisma.sql`SELECT id FROM "hoc_vien" WHERE ${dk}`,
            )
          ).map((r) => r.id)
        : [];
      and.push({
        OR: [
          { id: { in: idsTheoTen } },
          { so_dinh_danh_ca_nhan: { contains: q } },
          // Spec 2026-10-09 Q-A: gõ mã có/không số 0 đầu đều thấy.
          {
            ma_dinh_danh_moet: {
              contains: boSo0DauDeTimKiem(q),
              mode: 'insensitive',
            },
          },
          {
            nguoi_dung_account: {
              ten_dang_nhap: { contains: q, mode: 'insensitive' },
            },
          },
        ],
      });
    }
    return { AND: and };
  }

  private async layDong(
    cumIds: string[],
    where: Prisma.hoc_vienWhereInput,
    trang?: { skip: number; take: number },
  ) {
    const rows = await this.prisma.hoc_vien.findMany({
      where,
      include: includeDong({ cum_id: { in: cumIds } }),
      orderBy: [{ ho_ten: 'asc' }, { id: 'asc' }],
      ...trang,
    });
    return Promise.all(rows.map((r) => this.toDong(r)));
  }

  private async toDong(r: HocVienDong) {
    const { day_du } = await this.hocVienService.danhGiaDayDu(r);
    return {
      id: r.id,
      ho_ten: r.ho_ten,
      ma_dinh_danh_moet: r.ma_dinh_danh_moet,
      ten_dang_nhap: r.nguoi_dung_account?.ten_dang_nhap ?? null,
      dang_nhap_lan_cuoi: r.nguoi_dung_account?.dang_nhap_lan_cuoi ?? null,
      don_vi_cong_tac_ten: r.don_vi_cong_tac.ten_don_vi,
      doi_tuong: r.doi_tuong,
      so_dien_thoai_lien_he: r.so_dien_thoai_lien_he,
      email_lien_he: r.email_lien_he,
      day_du,
      cum: r.dang_ky_hoc.flatMap((d) =>
        d.cum ? [{ cum_id: d.cum.id, ten_cum: d.cum.ten_cum }] : [],
      ),
      // Lớp theo giai đoạn — chỉ dùng cho file xuất (giai_doan_id -> tên lớp).
      lop_theo_giai_doan: Object.fromEntries(
        r.dang_ky_hoc.flatMap((d) =>
          d.phan_lop_giai_doan.map((p) => [p.giai_doan_id, p.lop.ten_lop]),
        ),
      ) as Record<string, string>,
      khao_sat: r.ket_qua_khao_sat,
    };
  }
}
