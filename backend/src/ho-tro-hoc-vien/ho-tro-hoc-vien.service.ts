import { Injectable } from '@nestjs/common';
import { khoangNgayVn } from '../common/utils/khoang-ngay-vn.util';
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

const SO_NGAY_LICH_MAC_DINH = 14;

const includeDong = (cumIds: string[]) =>
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
      where: { cum_id: { in: cumIds } },
      select: {
        khoa_id: true,
        cum: { select: { id: true, ten_cum: true } },
        phan_lop_giai_doan: {
          select: { giai_doan_id: true, lop: { select: { ten_lop: true } } },
        },
      },
    },
  }) satisfies Prisma.hoc_vienInclude;

type HocVienDong = Prisma.hoc_vienGetPayload<{
  include: ReturnType<typeof includeDong>;
}>;

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
    const capLop = await this.prisma.phan_lop_giai_doan.groupBy({
      by: ['lop_id', 'giai_doan_id'],
      where: { dang_ky_hoc: { cum_id: { in: cumIds } } },
      _count: { _all: true },
    });
    if (capLop.length === 0) return [];
    const soHocVien = new Map(
      capLop.map((c) => [`${c.lop_id}|${c.giai_doan_id}`, c._count._all]),
    );

    const buoi = await this.prisma.lich_hoc_lop.findMany({
      where: {
        OR: capLop.map(({ lop_id, giai_doan_id }) => ({
          lop_id,
          giai_doan_id,
        })),
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
    return buoi.map(({ lop, ...b }) => {
      const { nhan_su, khoa, ...lopGon } = lop;
      const { phan_cong_ho_tro_gv, ...khoaGon } = khoa;
      return {
        ...b,
        lop: lopGon,
        khoa: khoaGon,
        nhan_su,
        nhom_ho_tro_gv: phan_cong_ho_tro_gv.map((p) => p.nguoi_dung),
        so_hoc_vien_cum: soHocVien.get(`${b.lop_id}|${b.giai_doan_id}`) ?? 0,
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
          { ma_dinh_danh_moet: { contains: q, mode: 'insensitive' } },
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
      include: includeDong(cumIds),
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
