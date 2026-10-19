import { Injectable } from '@nestjs/common';
import { Prisma, trang_thai_de_nghi } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  ConflictAppException,
  ForbiddenAppException,
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { NhatKyService } from '../nhat-ky/nhat-ky.service';
import { HoTroHocVienScopeService } from '../ho-tro-hoc-vien/ho-tro-hoc-vien-scope.service';
import {
  DuyetDoiBuoiDto,
  GhiChuXuLyDto,
  GuiDoiBuoiDto,
  LocDoiBuoiDto,
} from './dto/doi-buoi-hoc.dto';
import {
  Db,
  DoiBuoiHocQueryService,
  LICH_TOM_TAT_SELECT,
} from './doi-buoi-hoc-query.service';
import {
  chuanHoaLyDo,
  conChoChoDeNghi,
  daBatDau,
  HTTP_THEO_MA,
  KetQuaKiemTra,
  kiemTraGui,
  buoiTrungGio,
  laBuoiTuongDuong,
  LichTomTat,
  LichTrung,
  quyetDinhDuyet,
  soLuotDaDung,
  thuTuHang,
} from './doi-buoi-hoc.rules';

export interface DeNghiHocVien {
  id: string;
  trang_thai: trang_thai_de_nghi;
  lich_nguon_id: string;
  lich_de_nghi_id: string;
  lich_chot_id: string | null;
  ly_do: string;
  tao_luc: Date;
  ghi_chu_xu_ly: string | null;
  ly_do_huy: LyDoHuy | null;
  qua_han: boolean;
  thu_tu_hang: { k: number; n: number } | null;
  buoi_nguon: BuoiTomTat | null;
  buoi_de_nghi: BuoiTomTat | null;
  buoi_chot: BuoiTomTat | null;
  /** D11: đề nghị đổi lại (chờ) → buổi chốt của bản đã duyệt cùng buổi nguồn. */
  doi_lai_tu: BuoiTomTat | null;
  /** Chỉ đề nghị chờ: buổi trên lịch thực tế trùng giờ buổi đề nghị (cảnh báo, không chặn). */
  trung_lich: LichTrung[];
}

export interface BuoiTomTat {
  id: string;
  buoi_so: number;
  thoi_gian_bat_dau: Date;
  thoi_gian_ket_thuc: Date | null;
  lop: { ten_lop: string };
}

export function tomTatBuoi(l: LichTomTat | undefined): BuoiTomTat | null {
  if (!l) return null;
  return {
    id: l.id,
    buoi_so: l.buoi_so,
    thoi_gian_bat_dau: l.thoi_gian_bat_dau,
    thoi_gian_ket_thuc: l.thoi_gian_ket_thuc ?? null,
    lop: { ten_lop: l.lop.ten_lop },
  };
}

export interface LuaChonBuoi {
  lich: LichTomTat;
  thoi_gian_ket_thuc: Date;
  /** Buổi trực tiếp: điểm học + phòng. */
  diem_hoc: { ten: string; dia_chi: string } | null;
  phong: string | null;
  /** Buổi không phải trực tiếp/zoom (vd VLE). Zoom luôn null — không lộ link. */
  dia_diem_hoac_link: string | null;
  si_so: number;
  si_so_toi_da: number | null;
  so_cho_duyet: number;
  da_du: boolean;
  /** Buổi trên lịch thực tế của học viên trùng giờ buổi này (cảnh báo, không chặn). */
  trung_lich: LichTrung[];
}

export interface DeNghiDuyet extends DeNghiHocVien {
  hoc_vien: {
    id: string;
    ho_ten: string;
    don_vi: string;
    cum: string | null;
  };
  si_so: number;
  si_so_toi_da: number | null;
  so_cho_duyet: number;
  nguoi_xu_ly: string | null;
}

interface DeNghiRow {
  id: string;
  trang_thai: trang_thai_de_nghi;
  dang_ky_hoc_id: string;
  lich_nguon_id: string;
  lich_de_nghi_id: string;
  lich_chot_id: string | null;
  ly_do: string;
  tao_luc: Date;
  ghi_chu_xu_ly: string | null;
  nguoi_xu_ly: string | null;
}

const TRANG_THAI_HOAT_DONG: trang_thai_de_nghi[] = ['cho_duyet', 'da_duyet'];
const TIN_KHOA_TAT = 'Khóa học chưa mở đề nghị đổi buổi';
const TIN_GHI_CHU = 'Ghi chú phải từ 5 đến 500 ký tự';

@Injectable()
export class DoiBuoiHocService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly query: DoiBuoiHocQueryService,
    private readonly nhatKy: NhatKyService,
    private readonly scope: HoTroHocVienScopeService,
  ) {}

  // ---------------------------------------------------------------------
  // Học viên
  // ---------------------------------------------------------------------

  async tongQuanHocVien(user: AuthenticatedUser, khoaId: string) {
    const hocVienId = this.assertHocVienId(user);
    const dangKy = await this.dangKyCuaCaller(hocVienId, khoaId);
    const soBuoiToiDa = await this.soBuoiDoiToiDa(khoaId);
    const now = new Date();

    const [phanLop, deNghiRows] = await Promise.all([
      this.prisma.phan_lop_giai_doan.findMany({
        where: { dang_ky_hoc_id: dangKy.id },
        select: { giai_doan_id: true, lop_id: true },
      }),
      this.prisma.doi_buoi_hoc.findMany({
        where: { dang_ky_hoc_id: dangKy.id },
        orderBy: { tao_luc: 'desc' },
        select: DE_NGHI_SELECT,
      }),
    ]);
    const lichSapToi = phanLop.length
      ? await this.prisma.lich_hoc_lop.findMany({
          where: {
            thoi_gian_bat_dau: { gt: now },
            OR: phanLop.map((p) => ({
              lop_id: p.lop_id,
              giai_doan_id: p.giai_doan_id,
            })),
          },
          orderBy: { thoi_gian_bat_dau: 'asc' },
          select: LICH_TOM_TAT_SELECT,
        })
      : [];

    const lichMap = await this.query.lichTomTat(
      deNghiRows.flatMap((d) =>
        [d.lich_nguon_id, d.lich_de_nghi_id, d.lich_chot_id].filter(
          (x): x is string => x !== null,
        ),
      ),
    );
    const hang = await this.hangChoTheoDeNghi(deNghiRows, now);
    // Mọi đề nghị của đăng ký đã có sẵn → bản đã duyệt lấy luôn, không truy vấn thêm.
    const chotCu = chotDaDuyetTheoCap(
      deNghiRows.filter((d) => d.trang_thai === 'da_duyet'),
    );
    const coCho = deNghiRows.some((d) => d.trang_thai === 'cho_duyet');
    const lichDk = coCho
      ? await this.lichThucTe([dangKy.id])
      : new Map<string, OLich[]>();
    const quaHanThem = new Set(
      coCho ? await this.idQuaHanThem(now, this.prisma, [dangKy.id]) : [],
    );
    const deNghi = deNghiRows.map((d) =>
      this.anhXaDeNghi(d, lichMap, now, hang, chotCu, lichDk, quaHanThem),
    );
    const daDuyet = new Map(
      deNghi
        .filter((d) => d.trang_thai === 'da_duyet')
        .map((d) => [d.lich_nguon_id, d]),
    );
    const choDuyet = new Map(
      deNghi
        .filter((d) => d.trang_thai === 'cho_duyet')
        .map((d) => [d.lich_nguon_id, d]),
    );
    return {
      so_buoi_doi_toi_da: soBuoiToiDa,
      so_luot_da_dung: soLuotDaDung(deNghiRows),
      buoi_sap_toi: lichSapToi.map((l) => {
        const duyet = daDuyet.get(l.id) ?? null;
        const cho = choDuyet.get(l.id) ?? null;
        return {
          lich_nguon: l,
          // Bản đã duyệt (nếu có) ưu tiên; chờ đi kèm bản đã duyệt = đổi lại.
          de_nghi: duyet ?? cho,
          de_nghi_doi_lai: duyet ? cho : null,
        };
      }),
      de_nghi: deNghi,
    };
  }

  async luaChonHocVien(
    user: AuthenticatedUser,
    lichNguonId: string,
  ): Promise<LuaChonBuoi[]> {
    const hocVienId = this.assertHocVienId(user);
    const nguon = (await this.query.lichTomTat([lichNguonId])).get(lichNguonId);
    if (!nguon) throw new NotFoundAppException('Không tìm thấy buổi học');
    const dangKy = await this.dangKyCuaCaller(
      hocVienId,
      nguon.lop.khoa_id,
      'Không tìm thấy buổi học',
    );
    await this.soBuoiDoiToiDa(nguon.lop.khoa_id);
    const phanLop = await this.prisma.phan_lop_giai_doan.findFirst({
      where: { dang_ky_hoc_id: dangKy.id, giai_doan_id: nguon.giai_doan_id },
      select: { lop_id: true },
    });
    if (phanLop?.lop_id !== nguon.lop_id)
      throw new NotFoundAppException('Không tìm thấy buổi học');
    const now = new Date();
    if (daBatDau(nguon, now))
      this.nem({
        ok: false,
        ma: 'DA_BAT_DAU',
        thong_diep: 'Buổi đã bắt đầu, không thể đổi',
      });
    const chot = await this.chotDaDuyet(dangKy.id, nguon.id);
    // D12: đã điểm danh ở buổi nguồn (hoặc buổi đang học nếu đổi lại) → không đổi.
    const daDiemDanh = await this.prisma.diem_danh.findFirst({
      where: {
        dang_ky_hoc_id: dangKy.id,
        lich_hoc_id: { in: chot ? [nguon.id, chot] : [nguon.id] },
      },
      select: { id: true },
    });
    if (daDiemDanh)
      this.nem({
        ok: false,
        ma: 'DA_DIEM_DANH',
        thong_diep: 'Thầy/Cô đã điểm danh buổi này, không thể đổi',
      });

    const ds = await this.luaChonTuongDuong(nguon, now, dangKy.id);
    return chot ? ds.filter((x) => x.lich.id !== chot) : ds;
  }

  async gui(user: AuthenticatedUser, dto: GuiDoiBuoiDto) {
    const hocVienId = this.assertHocVienId(user);
    const { nguon, dich } = await this.taiHaiBuoi(dto);
    const dangKy = await this.dangKyCuaCaller(
      hocVienId,
      nguon.lop.khoa_id,
      'Không tìm thấy buổi học',
    );
    const soBuoiToiDa = await this.soBuoiDoiToiDa(nguon.lop.khoa_id);
    const moi = await this.taoTrongGiaoDich({
      dangKyId: dangKy.id,
      soBuoiToiDa,
      nguon,
      dich,
      dto,
      nguoiTao: user.id,
      huyId: null,
    });
    await this.ghiNhatKyGui(hocVienId, 'Gửi đề nghị đổi buổi', {
      de_nghi_id: moi.id,
      lich_nguon_id: dto.lich_nguon_id,
      lich_de_nghi_id: dto.lich_de_nghi_id,
    });
    return moi;
  }

  async sua(user: AuthenticatedUser, id: string, dto: GuiDoiBuoiDto) {
    const hocVienId = this.assertHocVienId(user);
    const cu = await this.taiDeNghiCuaCaller(hocVienId, id);
    if (cu.lich_nguon_id !== dto.lich_nguon_id)
      throw new ValidationException(
        'Không đổi được buổi nguồn khi sửa đề nghị',
      );
    const soBuoiToiDa = await this.soBuoiDoiToiDa(cu.dang_ky_hoc.khoa_id);
    const { nguon, dich } = await this.taiHaiBuoi(dto);
    const moi = await this.taoTrongGiaoDich({
      dangKyId: cu.dang_ky_hoc_id,
      soBuoiToiDa,
      nguon,
      dich,
      dto,
      nguoiTao: user.id,
      huyId: id,
    });
    await this.ghiNhatKyGui(hocVienId, 'Sửa đề nghị đổi buổi', {
      de_nghi_id: moi.id,
      de_nghi_cu_id: id,
      lich_nguon_id: dto.lich_nguon_id,
      lich_de_nghi_id: dto.lich_de_nghi_id,
    });
    return moi;
  }

  async huyHocVien(user: AuthenticatedUser, id: string) {
    const hocVienId = this.assertHocVienId(user);
    const cu = await this.taiDeNghiCuaCaller(hocVienId, id);
    await this.soBuoiDoiToiDa(cu.dang_ky_hoc.khoa_id);
    const { count } = await this.prisma.doi_buoi_hoc.updateMany({
      where: { id, trang_thai: 'cho_duyet', dang_ky_hoc_id: cu.dang_ky_hoc_id },
      data: {
        trang_thai: 'da_huy',
        xu_ly_luc: new Date(),
        ghi_chu_xu_ly: GHI_CHU_HOC_VIEN_HUY,
      },
    });
    if (!count) throw new ConflictAppException('Đề nghị đã được xử lý');
    await this.ghiNhatKyGui(hocVienId, 'Hủy đề nghị đổi buổi', {
      de_nghi_id: id,
      huy: true,
    });
    return { trang_thai: 'da_huy' as const };
  }

  // ---------------------------------------------------------------------
  // Người duyệt: quan_tri (mọi đề nghị) + ho_tro_hoc_vien (theo cụm, ADR 0003)
  // ---------------------------------------------------------------------

  async danhSach(
    user: AuthenticatedUser,
    q: LocDoiBuoiDto,
  ): Promise<DeNghiDuyet[]> {
    const cumIds = await this.cumPhamVi(user);
    if (cumIds?.length === 0) return [];
    const now = new Date();
    // Tab Chờ duyệt: đề nghị quá hạn không bao giờ tự đóng (D7) → tách riêng
    // để không chiếm 500 chỗ đầu của danh sách sắp tao_luc tăng dần.
    const choDuyet = !q.da_xu_ly && q.trang_thai === 'cho_duyet';
    const quaHan = choDuyet && q.qua_han === true;
    // Đổi lại có buổi đang học đã bắt đầu, hoặc đã điểm danh (D12), cũng quá hạn.
    const doiLaiQuaHan = choDuyet ? await this.idQuaHanThem(now) : [];
    const locHan: Prisma.doi_buoi_hocWhereInput = !choDuyet
      ? {}
      : quaHan
        ? {
            OR: [
              { lich_nguon: { thoi_gian_bat_dau: { lte: now } } },
              { lich_de_nghi: { thoi_gian_bat_dau: { lte: now } } },
              ...(doiLaiQuaHan.length ? [{ id: { in: doiLaiQuaHan } }] : []),
            ],
          }
        : {
            lich_nguon: { thoi_gian_bat_dau: { gt: now } },
            lich_de_nghi: { thoi_gian_bat_dau: { gt: now } },
            ...(doiLaiQuaHan.length ? { id: { notIn: doiLaiQuaHan } } : {}),
          };
    const rows = await this.prisma.doi_buoi_hoc.findMany({
      where: {
        ...(q.da_xu_ly
          ? { trang_thai: { in: ['da_duyet', 'tu_choi', 'da_huy'] as trang_thai_de_nghi[] } }
          : q.trang_thai
            ? { trang_thai: q.trang_thai }
            : {}),
        ...locHan,
        dang_ky_hoc: {
          ...(cumIds ? { cum_id: { in: cumIds } } : {}),
          ...(q.khoa_id ? { khoa_id: q.khoa_id } : {}),
        },
      },
      orderBy: q.da_xu_ly
        ? { xu_ly_luc: { sort: 'desc', nulls: 'last' } }
        : !q.trang_thai
          ? { tao_luc: 'desc' }
          : quaHan
            ? { tao_luc: 'desc' }
            : q.trang_thai === 'cho_duyet'
              ? { tao_luc: 'asc' }
              : { xu_ly_luc: { sort: 'desc', nulls: 'last' } },
      take: quaHan ? 100 : 500,
      select: {
        ...DE_NGHI_SELECT,
        dang_ky_hoc: {
          select: {
            hoc_vien: {
              select: {
                id: true,
                ho_ten: true,
                don_vi_cong_tac: { select: { ten_don_vi: true } },
              },
            },
            cum: { select: { ten_cum: true } },
          },
        },
        xu_ly_boi: { select: { ho_ten: true } },
      },
    });
    if (rows.length === 0) return [];
    const quaHanThem = new Set(
      choDuyet
        ? doiLaiQuaHan
        : rows.some((r) => r.trang_thai === 'cho_duyet')
          ? await this.idQuaHanThem(now)
          : [],
    );
    const chotCu = await this.chotCuChoDoiLai(rows);
    const [lichMap, hang, siSo, lichDk] = await Promise.all([
      this.query.lichTomTat([
        ...rows.flatMap((r) =>
          [r.lich_nguon_id, r.lich_de_nghi_id, r.lich_chot_id].filter(
            (x): x is string => x !== null,
          ),
        ),
        ...chotCu.values(),
      ]),
      this.hangChoTheoDeNghi(rows, now),
      this.query.siSoBuoi(
        [...new Set(rows.map((r) => r.lich_de_nghi_id))],
        now,
      ),
      // Trùng lịch chỉ cho đề nghị chờ: 1 lượt gộp mọi đăng ký của trang.
      this.lichThucTe([
        ...new Set(
          rows
            .filter((r) => r.trang_thai === 'cho_duyet')
            .map((r) => r.dang_ky_hoc_id),
        ),
      ]),
    ]);
    return rows.map(({ dang_ky_hoc, xu_ly_boi, ...r }) => {
      const s = siSo.get(r.lich_de_nghi_id);
      return {
        ...this.anhXaDeNghi(r, lichMap, now, hang, chotCu, lichDk, quaHanThem),
        hoc_vien: {
          id: dang_ky_hoc.hoc_vien.id,
          ho_ten: dang_ky_hoc.hoc_vien.ho_ten,
          don_vi: dang_ky_hoc.hoc_vien.don_vi_cong_tac.ten_don_vi,
          cum: dang_ky_hoc.cum?.ten_cum ?? null,
        },
        si_so: s?.si_so ?? 0,
        si_so_toi_da: s?.si_so_toi_da ?? null,
        so_cho_duyet: s?.so_cho_duyet ?? 0,
        nguoi_xu_ly: xu_ly_boi?.ho_ten ?? null,
      };
    });
  }

  async demChoDuyet(user: AuthenticatedUser): Promise<number> {
    const cumIds = await this.cumPhamVi(user);
    if (cumIds?.length === 0) return 0;
    const now = new Date();
    const doiLaiQuaHan = await this.idQuaHanThem(now);
    return this.prisma.doi_buoi_hoc.count({
      where: {
        trang_thai: 'cho_duyet',
        ...(doiLaiQuaHan.length ? { id: { notIn: doiLaiQuaHan } } : {}),
        ...(cumIds ? { dang_ky_hoc: { cum_id: { in: cumIds } } } : {}),
        lich_nguon: { thoi_gian_bat_dau: { gt: now } },
        lich_de_nghi: { thoi_gian_bat_dau: { gt: now } },
      },
    });
  }

  async luaChonDuyet(
    user: AuthenticatedUser,
    id: string,
  ): Promise<(LuaChonBuoi & { so_truoc: number; duyet_duoc: boolean })[]> {
    const dn = await this.taiDeNghiTrongPhamVi(user, id);
    const nguon = (await this.query.lichTomTat([dn.lich_nguon_id])).get(
      dn.lich_nguon_id,
    );
    if (!nguon) throw new NotFoundAppException('Không tìm thấy buổi học');
    const now = new Date();
    const tatCa = await this.luaChonTuongDuong(nguon, now, dn.dang_ky_hoc_id);
    // Đổi lại: không đề xuất chốt vào buổi học viên đang học (bản đã duyệt).
    const chotCu =
      dn.trang_thai === 'cho_duyet' && tatCa.length > 0
        ? await this.chotDaDuyet(dn.dang_ky_hoc_id, dn.lich_nguon_id)
        : null;
    const ds = chotCu ? tatCa.filter((x) => x.lich.id !== chotCu) : tatCa;
    if (ds.length === 0) return [];
    const truoc = await this.prisma.doi_buoi_hoc.groupBy({
      by: ['lich_de_nghi_id'],
      where: {
        ...this.whereChoTruoc(dn, now, await this.idQuaHanThem(now)),
        lich_de_nghi_id: { in: ds.map((x) => x.lich.id) },
      },
      _count: { _all: true },
    });
    const dem = new Map(truoc.map((g) => [g.lich_de_nghi_id, g._count._all]));
    const nguonDaBatDau = daBatDau(nguon, now);
    return ds.map((x) => {
      const so_truoc = dem.get(x.lich.id) ?? 0;
      return {
        ...x,
        so_truoc,
        duyet_duoc:
          !nguonDaBatDau &&
          conChoChoDeNghi({
            si_so: x.si_so,
            si_so_toi_da: x.si_so_toi_da,
            so_truoc,
          }),
      };
    });
  }

  // Spec §4: khóa theo buổi chốt TRƯỚC khi đọc sĩ số / đếm hàng chờ.
  async duyet(
    user: AuthenticatedUser,
    id: string,
    dto: DuyetDoiBuoiDto,
  ): Promise<{ trang_thai: 'da_duyet'; canh_bao: string[] }> {
    const ghiChu = this.ghiChuTuyChon(dto.ghi_chu);
    const dn = await this.taiDeNghiTrongPhamVi(user, id);
    const lichChotId = dto.lich_chot_id ?? dn.lich_de_nghi_id;
    const now = new Date();
    const kq = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'doi_buoi:' + lichChotId}))`;
      const hienTai = await tx.doi_buoi_hoc.findUnique({
        where: { id },
        select: { trang_thai: true, tao_luc: true },
      });
      if (!hienTai) throw new NotFoundAppException('Không tìm thấy đề nghị');
      // D11: bản đã duyệt cùng (đăng ký, buổi nguồn) → đề nghị này là đổi lại.
      const banCu = await tx.doi_buoi_hoc.findFirst({
        where: {
          dang_ky_hoc_id: dn.dang_ky_hoc_id,
          lich_nguon_id: dn.lich_nguon_id,
          trang_thai: 'da_duyet',
          id: { not: id },
        },
        select: { id: true, lich_chot_id: true },
      });
      // D12: đã điểm danh ở buổi nguồn / buổi chốt cũ (đổi lại) → không đổi.
      const diemDanh = await tx.diem_danh.findMany({
        where: {
          dang_ky_hoc_id: dn.dang_ky_hoc_id,
          lich_hoc_id: {
            in: [
              dn.lich_nguon_id,
              ...(banCu?.lich_chot_id ? [banCu.lich_chot_id] : []),
            ],
          },
        },
        select: { lich_hoc_id: true },
      });
      const daDiemDanh = new Set(diemDanh.map((d) => d.lich_hoc_id));
      const lichMap = await this.query.lichTomTat(
        [
          dn.lich_nguon_id,
          lichChotId,
          ...(banCu?.lich_chot_id ? [banCu.lich_chot_id] : []),
        ],
        tx,
      );
      const nguon = lichMap.get(dn.lich_nguon_id);
      const chot = lichMap.get(lichChotId);
      if (!nguon || !chot)
        throw new NotFoundAppException('Không tìm thấy buổi học');
      const phanLop = await tx.phan_lop_giai_doan.findFirst({
        where: {
          dang_ky_hoc_id: dn.dang_ky_hoc_id,
          giai_doan_id: nguon.giai_doan_id,
        },
        select: { lop_id: true },
      });
      const siSo = await this.query.siSoBuoi([lichChotId], now, tx);
      const soTruoc = await tx.doi_buoi_hoc.count({
        where: {
          ...this.whereChoTruoc(
            { id, tao_luc: hienTai.tao_luc },
            now,
            await this.idQuaHanThem(now, tx),
          ),
          lich_de_nghi_id: lichChotId,
        },
      });
      const si_so = siSo.get(lichChotId)?.si_so ?? 0;
      const quyetDinh = quyetDinhDuyet(
        {
          vai_tro: user.vai_tro === 'quan_tri' ? 'quan_tri' : 'ho_tro_hoc_vien',
          trang_thai: hienTai.trang_thai,
          buoi_nguon: nguon,
          buoi_chot: chot,
          lop_phan_hien_tai: phanLop?.lop_id ?? null,
          si_so,
          so_truoc: soTruoc,
          da_diem_danh_nguon: daDiemDanh.has(dn.lich_nguon_id),
          da_diem_danh_chot_cu:
            !!banCu?.lich_chot_id && daDiemDanh.has(banCu.lich_chot_id),
        },
        now,
      );
      if (quyetDinh.ket_qua === 'chan')
        this.nem({
          ok: false,
          ma: quyetDinh.ma!,
          thong_diep: quyetDinh.thong_diep!,
        });
      if (banCu) {
        const chotCu = banCu.lich_chot_id
          ? lichMap.get(banCu.lich_chot_id)
          : undefined;
        if (chotCu && daBatDau(chotCu, now))
          this.nem({
            ok: false,
            ma: 'DA_BAT_DAU',
            thong_diep: 'Buổi đã bắt đầu, không thể đổi',
          });
        if (banCu.lich_chot_id === lichChotId)
          this.nem({
            ok: false,
            ma: 'TRUNG_BUOI_CHOT',
            thong_diep: 'Học viên đang học buổi này rồi',
          });
        // Hạ bản cũ TRƯỚC khi nâng bản mới (unique uq_doi_buoi_da_duyet).
        // Bản mới không nâng được → throw bên dưới → rollback cả bước này.
        await tx.doi_buoi_hoc.updateMany({
          where: {
            dang_ky_hoc_id: dn.dang_ky_hoc_id,
            lich_nguon_id: dn.lich_nguon_id,
            trang_thai: 'da_duyet',
            id: { not: id },
          },
          data: {
            trang_thai: 'da_huy',
            xu_ly_luc: now,
            ghi_chu_xu_ly: GHI_CHU_THAY_THE,
            nguoi_xu_ly: null,
          },
        });
      }
      const { count } = await tx.doi_buoi_hoc.updateMany({
        where: { id, trang_thai: 'cho_duyet' },
        data: {
          trang_thai: 'da_duyet',
          lich_chot_id: lichChotId,
          nguoi_xu_ly: user.id,
          xu_ly_luc: now,
          ghi_chu_xu_ly: ghiChu,
        },
      });
      if (!count) throw new ConflictAppException('Đề nghị đã được xử lý');
      const toiDa = chot.lop.si_so_toi_da;
      const vuotSiSo = toiDa !== null && si_so >= toiDa;
      return {
        canh_bao: quyetDinh.canh_bao,
        vuot_si_so: vuotSiSo,
        vuot_thu_tu:
          !vuotSiSo &&
          !conChoChoDeNghi({ si_so, si_so_toi_da: toiDa, so_truoc: soTruoc }),
        thay_the_id: banCu?.id ?? null,
      };
    }).catch(trungLaDaXuLy);
    await this.ghiNhatKyDuyet(dn.dang_ky_hoc.hoc_vien_id, 'Duyệt đổi buổi', {
      de_nghi_id: id,
      lich_nguon_id: dn.lich_nguon_id,
      lich_de_nghi_id: dn.lich_de_nghi_id,
      lich_chot_id: lichChotId,
      vuot_si_so: kq.vuot_si_so,
      vuot_thu_tu: kq.vuot_thu_tu,
      ...(kq.thay_the_id ? { thay_the_id: kq.thay_the_id } : {}),
    });
    return { trang_thai: 'da_duyet', canh_bao: kq.canh_bao };
  }

  async tuChoi(
    user: AuthenticatedUser,
    id: string,
    dto: GhiChuXuLyDto,
  ): Promise<{ trang_thai: 'tu_choi' }> {
    const ghiChu = this.ghiChuBatBuoc(dto.ghi_chu);
    const dn = await this.taiDeNghiTrongPhamVi(user, id);
    const { count } = await this.prisma.doi_buoi_hoc.updateMany({
      where: { id, trang_thai: 'cho_duyet' },
      data: {
        trang_thai: 'tu_choi',
        nguoi_xu_ly: user.id,
        xu_ly_luc: new Date(),
        ghi_chu_xu_ly: ghiChu,
      },
    });
    if (!count) throw new ConflictAppException('Đề nghị đã được xử lý');
    await this.ghiNhatKyDuyet(
      dn.dang_ky_hoc.hoc_vien_id,
      'Từ chối đề nghị đổi buổi',
      { de_nghi_id: id, tu_choi: true },
    );
    return { trang_thai: 'tu_choi' };
  }

  async huyDuyet(
    user: AuthenticatedUser,
    id: string,
    dto: GhiChuXuLyDto,
  ): Promise<{ trang_thai: 'da_huy'; canh_bao: string[] }> {
    const ghiChu = this.ghiChuBatBuoc(dto.ghi_chu);
    const dn = await this.taiDeNghiTrongPhamVi(user, id);
    if (dn.trang_thai !== 'da_duyet' || !dn.lich_chot_id)
      throw new ConflictAppException('Đề nghị đã được xử lý');
    const lichChotId = dn.lich_chot_id;
    const now = new Date();
    // Hủy duyệt đưa học viên về buổi nguồn → khóa CÙNG namespace với duyệt
    // (doi_buoi:<lich>) theo buổi nguồn, rồi mới đọc sĩ số buổi nguồn.
    const kq = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'doi_buoi:' + dn.lich_nguon_id}))`;
      const lichMap = await this.query.lichTomTat(
        [dn.lich_nguon_id, lichChotId],
        tx,
      );
      const daBatDauMot = [dn.lich_nguon_id, lichChotId].some((lid) => {
        const l = lichMap.get(lid);
        return l !== undefined && daBatDau(l, now);
      });
      if (daBatDauMot)
        this.nem({
          ok: false,
          ma: 'DA_BAT_DAU',
          thong_diep: 'Buổi đã bắt đầu, không thể đổi',
        });
      // D12: đã điểm danh ở buổi chốt → không đưa học viên về buổi nguồn được nữa.
      const diemDanhChot = await tx.diem_danh.findFirst({
        where: { dang_ky_hoc_id: dn.dang_ky_hoc_id, lich_hoc_id: lichChotId },
        select: { id: true },
      });
      if (diemDanhChot)
        this.nem({
          ok: false,
          ma: 'DA_DIEM_DANH',
          thong_diep: 'Học viên đã điểm danh buổi chốt, không thể hủy duyệt',
        });
      const nguon = lichMap.get(dn.lich_nguon_id);
      const phanLop = nguon
        ? await tx.phan_lop_giai_doan.findFirst({
            where: {
              dang_ky_hoc_id: dn.dang_ky_hoc_id,
              giai_doan_id: nguon.giai_doan_id,
            },
            select: { lop_id: true },
          })
        : null;
      // Phân lớp đã đổi → bản ghi không còn hiệu lực, học viên không quay về buổi nguồn.
      const veBuoiNguon = !!nguon && phanLop?.lop_id === nguon.lop_id;
      const canh_bao: string[] = [];
      let vuotSiSo = false;
      if (veBuoiNguon) {
        const s = (await this.query.siSoBuoi([dn.lich_nguon_id], now, tx)).get(
          dn.lich_nguon_id,
        );
        const toiDa = s?.si_so_toi_da ?? null;
        const siSo = s?.si_so ?? 0;
        if (toiDa !== null && siSo >= toiDa) {
          const tin = `Buổi gốc đã đủ sĩ số ${siSo}/${toiDa} — không thể hủy duyệt`;
          if (user.vai_tro !== 'quan_tri') throw new ConflictAppException(tin);
          vuotSiSo = true;
          canh_bao.push(
            `Buổi gốc đã đủ sĩ số ${siSo}/${toiDa} — hủy duyệt sẽ vượt sĩ số`,
          );
        }
      }
      const { count } = await tx.doi_buoi_hoc.updateMany({
        where: { id, trang_thai: 'da_duyet' },
        data: {
          trang_thai: 'da_huy',
          nguoi_xu_ly: user.id,
          xu_ly_luc: now,
          ghi_chu_xu_ly: ghiChu,
        },
      });
      if (!count) throw new ConflictAppException('Đề nghị đã được xử lý');
      return { canh_bao, vuot_si_so: vuotSiSo };
    });
    await this.ghiNhatKyDuyet(
      dn.dang_ky_hoc.hoc_vien_id,
      'Hủy duyệt đổi buổi',
      {
        de_nghi_id: id,
        huy_duyet: true,
        vuot_si_so: kq.vuot_si_so,
      },
    );
    return { trang_thai: 'da_huy', canh_bao: kq.canh_bao };
  }

  // Buổi chốt của bản đã duyệt cùng (đăng ký, buổi nguồn); null nếu không có.
  private async chotDaDuyet(
    dangKyId: string,
    lichNguonId: string,
  ): Promise<string | null> {
    const ban = await this.prisma.doi_buoi_hoc.findFirst({
      where: {
        dang_ky_hoc_id: dangKyId,
        lich_nguon_id: lichNguonId,
        trang_thai: 'da_duyet',
      },
      select: { lich_chot_id: true },
    });
    return ban?.lich_chot_id ?? null;
  }

  // Một truy vấn gộp cho mọi đề nghị chờ của danh sách (không N+1).
  private async chotCuChoDoiLai(
    rows: DeNghiRow[],
  ): Promise<Map<string, string>> {
    const cho = rows.filter((r) => r.trang_thai === 'cho_duyet');
    if (cho.length === 0) return new Map();
    const daDuyet = await this.prisma.doi_buoi_hoc.findMany({
      where: {
        trang_thai: 'da_duyet',
        OR: cho.map((r) => ({
          dang_ky_hoc_id: r.dang_ky_hoc_id,
          lich_nguon_id: r.lich_nguon_id,
        })),
      },
      select: { dang_ky_hoc_id: true, lich_nguon_id: true, lich_chot_id: true },
    });
    return chotDaDuyetTheoCap(daDuyet);
  }

  // null = mọi cụm (quan_tri); [] = không có cụm nào → không thấy gì.
  private async cumPhamVi(user: AuthenticatedUser): Promise<string[] | null> {
    if (user.vai_tro === 'quan_tri') return null;
    return this.scope.cumIdsCuaToi(user.id);
  }

  // Ngoài phạm vi cụm hoặc không tồn tại → 404 (không lộ đề nghị cụm khác).
  private async taiDeNghiTrongPhamVi(user: AuthenticatedUser, id: string) {
    const cumIds = await this.cumPhamVi(user);
    if (cumIds?.length === 0)
      throw new NotFoundAppException('Không tìm thấy đề nghị');
    const dn = await this.prisma.doi_buoi_hoc.findFirst({
      where: {
        id,
        ...(cumIds ? { dang_ky_hoc: { cum_id: { in: cumIds } } } : {}),
      },
      select: {
        id: true,
        trang_thai: true,
        dang_ky_hoc_id: true,
        lich_nguon_id: true,
        lich_de_nghi_id: true,
        lich_chot_id: true,
        tao_luc: true,
        dang_ky_hoc: { select: { hoc_vien_id: true } },
      },
    });
    if (!dn) throw new NotFoundAppException('Không tìm thấy đề nghị');
    return dn;
  }

  // Đề nghị cho_duyet gửi trước đề nghị này, buổi nguồn & buổi đề nghị chưa bắt đầu.
  private whereChoTruoc(
    dn: { id: string; tao_luc: Date },
    now: Date,
    doiLaiQuaHan: string[],
  ): Prisma.doi_buoi_hocWhereInput {
    return {
      trang_thai: 'cho_duyet',
      tao_luc: { lt: dn.tao_luc },
      id: doiLaiQuaHan.length
        ? { not: dn.id, notIn: doiLaiQuaHan }
        : { not: dn.id },
      lich_nguon: { thoi_gian_bat_dau: { gt: now } },
      lich_de_nghi: { thoi_gian_bat_dau: { gt: now } },
    };
  }

  // Id đề nghị chờ quá hạn ngoài điều kiện thời gian của chính nó (quá hạn như
  // buổi nguồn/đề nghị đã bắt đầu): đổi lại có buổi đang học (chốt của bản đã
  // duyệt) đã bắt đầu; hoặc học viên đã có điểm danh ở buổi nguồn / buổi đang
  // học (D12). Tập nhỏ: 1 truy vấn gộp; dangKyIds để lọc khi chỉ cần 1 học viên.
  private async idQuaHanThem(
    now: Date,
    db: Db = this.prisma,
    dangKyIds?: string[],
  ): Promise<string[]> {
    const loc = dangKyIds
      ? Prisma.sql`AND c.dang_ky_hoc_id = ANY(${dangKyIds}::uuid[])`
      : Prisma.empty;
    const rows = await db.$queryRaw<{ id: string }[]>`
      SELECT c.id FROM doi_buoi_hoc c
      WHERE c.trang_thai = 'cho_duyet' ${loc} AND (
        EXISTS (SELECT 1 FROM diem_danh dd
          WHERE dd.dang_ky_hoc_id = c.dang_ky_hoc_id
            AND dd.lich_hoc_id = c.lich_nguon_id)
        OR EXISTS (SELECT 1 FROM doi_buoi_hoc d
          JOIN lich_hoc_lop l ON l.id = d.lich_chot_id
          WHERE d.dang_ky_hoc_id = c.dang_ky_hoc_id
            AND d.lich_nguon_id = c.lich_nguon_id AND d.trang_thai = 'da_duyet'
            AND (l.thoi_gian_bat_dau <= ${now} OR EXISTS (
              SELECT 1 FROM diem_danh dd
              WHERE dd.dang_ky_hoc_id = c.dang_ky_hoc_id
                AND dd.lich_hoc_id = d.lich_chot_id))))`;
    return rows.map((r) => r.id);
  }

  private ghiChuBatBuoc(s: string | undefined): string {
    const v = chuanHoaLyDo(s);
    if (v === null) throw new ValidationException(TIN_GHI_CHU);
    return v;
  }

  private ghiChuTuyChon(s: string | undefined): string | null {
    if (s === undefined || s.trim() === '') return null;
    return this.ghiChuBatBuoc(s);
  }

  private ghiNhatKyDuyet(
    hocVienId: string,
    moTa: string,
    chiTiet: Record<string, unknown>,
  ) {
    return this.nhatKy.ghi({
      hanh_dong: 'duyet_doi_buoi',
      hoc_vien_id: hocVienId,
      mo_ta: moTa,
      chi_tiet: chiTiet,
    });
  }

  // ---------------------------------------------------------------------
  // Helper dùng chung (Task 5 tái dùng: nem, anhXaDeNghi, hangChoTheoDeNghi)
  // ---------------------------------------------------------------------

  private assertHocVienId(user: AuthenticatedUser): string {
    if (!user.hoc_vien_id) {
      throw new ForbiddenAppException(
        'Tài khoản hiện tại không gắn với hồ sơ học viên nào',
      );
    }
    return user.hoc_vien_id;
  }

  // Ném exception tương ứng mã lỗi của hàm thuần (400/403/409).
  private nem(kq: KetQuaKiemTra): void {
    if (kq.ok) return;
    const loi = kq as Extract<KetQuaKiemTra, { ok: false }>;
    const status = HTTP_THEO_MA[loi.ma];
    if (status === 403) throw new ForbiddenAppException(loi.thong_diep);
    if (status === 409) throw new ConflictAppException(loi.thong_diep);
    throw new ValidationException(loi.thong_diep);
  }

  private async soBuoiDoiToiDa(khoaId: string): Promise<number> {
    const khoa = await this.prisma.khoa_boi_duong.findUnique({
      where: { id: khoaId },
      select: { so_buoi_doi_toi_da: true },
    });
    if (!khoa || khoa.so_buoi_doi_toi_da <= 0)
      throw new ForbiddenAppException(TIN_KHOA_TAT);
    return khoa.so_buoi_doi_toi_da;
  }

  private async dangKyCuaCaller(
    hocVienId: string,
    khoaId: string,
    thongDiep = 'Không tìm thấy đăng ký khóa học',
  ) {
    const dangKy = await this.prisma.dang_ky_hoc.findFirst({
      where: { hoc_vien_id: hocVienId, khoa_id: khoaId },
      select: { id: true, trang_thai: true },
    });
    if (!dangKy) throw new NotFoundAppException(thongDiep);
    // trang_thai_dang_ky: cho_duyet | da_duyet | da_phan_lop còn hiệu lực; tu_choi thì không.
    if (dangKy.trang_thai === 'tu_choi')
      throw new ValidationException('Đăng ký không còn hiệu lực');
    return { id: dangKy.id };
  }

  private async taiDeNghiCuaCaller(hocVienId: string, id: string) {
    const dn = await this.prisma.doi_buoi_hoc.findFirst({
      where: { id, dang_ky_hoc: { hoc_vien_id: hocVienId } },
      select: {
        id: true,
        dang_ky_hoc_id: true,
        lich_nguon_id: true,
        trang_thai: true,
        dang_ky_hoc: { select: { khoa_id: true } },
      },
    });
    if (!dn) throw new NotFoundAppException('Không tìm thấy đề nghị');
    return dn;
  }

  private async taiHaiBuoi(dto: GuiDoiBuoiDto) {
    const lichMap = await this.query.lichTomTat([
      dto.lich_nguon_id,
      dto.lich_de_nghi_id,
    ]);
    const nguon = lichMap.get(dto.lich_nguon_id);
    const dich = lichMap.get(dto.lich_de_nghi_id);
    if (!nguon || !dich)
      throw new NotFoundAppException('Không tìm thấy buổi học');
    return { nguon, dich };
  }

  // Khóa advisory theo đăng ký ĐẦU TIÊN (chống 2 đề nghị đồng thời vượt N lượt),
  // rồi (nếu sửa) hủy bản cũ có điều kiện, đếm lượt, kiểm, tạo.
  private async taoTrongGiaoDich(x: {
    dangKyId: string;
    soBuoiToiDa: number;
    nguon: LichTomTat;
    dich: LichTomTat;
    dto: GuiDoiBuoiDto;
    nguoiTao: string;
    huyId: string | null;
  }): Promise<{ id: string }> {
    const now = new Date();
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'doi_buoi_dk:' + x.dangKyId}))`;
        if (x.huyId) {
          const { count } = await tx.doi_buoi_hoc.updateMany({
            where: {
              id: x.huyId,
              trang_thai: 'cho_duyet',
              dang_ky_hoc_id: x.dangKyId,
            },
            data: {
              trang_thai: 'da_huy',
              xu_ly_luc: now,
              ghi_chu_xu_ly: GHI_CHU_HOC_VIEN_SUA,
            },
          });
          if (!count) throw new ConflictAppException('Đề nghị đã được xử lý');
        }
        const hoatDong = await tx.doi_buoi_hoc.findMany({
          where: {
            dang_ky_hoc_id: x.dangKyId,
            trang_thai: { in: TRANG_THAI_HOAT_DONG },
          },
          select: { lich_nguon_id: true, trang_thai: true, lich_chot_id: true },
        });
        // Buổi nguồn đang gửi không tính vào lượt đã dùng: đổi lại (D11) không
        // tốn thêm lượt; đề nghị chờ thứ 2 cùng buổi nguồn bị unique chặn (409).
        const soLuot = soLuotDaDung(
          hoatDong.filter((d) => d.lich_nguon_id !== x.nguon.id),
        );
        const chotCuId = hoatDong.find(
          (d) => d.lich_nguon_id === x.nguon.id && d.trang_thai === 'da_duyet',
        )?.lich_chot_id;
        const chotCu = chotCuId
          ? ((await this.query.lichTomTat([chotCuId], tx)).get(chotCuId) ?? null)
          : null;
        // D12: điểm danh ở buổi nguồn + buổi chốt hiện tại (đổi lại) — 1 truy vấn.
        const diemDanh = await tx.diem_danh.findMany({
          where: {
            dang_ky_hoc_id: x.dangKyId,
            lich_hoc_id: { in: chotCuId ? [x.nguon.id, chotCuId] : [x.nguon.id] },
          },
          select: { lich_hoc_id: true },
        });
        const daDiemDanh = new Set(diemDanh.map((d) => d.lich_hoc_id));
        const phanLop = await tx.phan_lop_giai_doan.findFirst({
          where: {
            dang_ky_hoc_id: x.dangKyId,
            giai_doan_id: x.nguon.giai_doan_id,
          },
          select: { lop_id: true },
        });
        const siSo = await this.query.siSoBuoi([x.dich.id], now, tx);
        this.nem(
          kiemTraGui(
            {
              so_buoi_doi_toi_da: x.soBuoiToiDa,
              so_luot_da_dung: soLuot,
              buoi_nguon: x.nguon,
              buoi_dich: x.dich,
              lop_phan_hien_tai: phanLop?.lop_id ?? null,
              si_so_dich: siSo.get(x.dich.id)?.si_so ?? 0,
              ly_do: x.dto.ly_do,
              buoi_chot_hien_tai: chotCu,
              da_diem_danh_nguon: daDiemDanh.has(x.nguon.id),
              da_diem_danh_chot: !!chotCuId && daDiemDanh.has(chotCuId),
            },
            now,
          ),
        );
        return tx.doi_buoi_hoc.create({
          data: {
            dang_ky_hoc_id: x.dangKyId,
            lich_nguon_id: x.dto.lich_nguon_id,
            lich_de_nghi_id: x.dto.lich_de_nghi_id,
            ly_do: chuanHoaLyDo(x.dto.ly_do) as string,
            nguoi_tao: x.nguoiTao,
          },
          select: { id: true },
        });
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      )
        throw new ConflictAppException('Buổi này đã có đề nghị đang chờ duyệt');
      throw e;
    }
  }

  // Buổi tương đương buổi nguồn, chưa bắt đầu, kèm sĩ số (dùng cho học viên và người duyệt).
  // Lịch thực tế của mỗi đăng ký: mọi buổi của lớp được phân ở mọi giai đoạn,
  // buổi nguồn đã đổi (da_duyet còn hiệu lực) thay bằng buổi chốt. Mỗi buổi gắn
  // `nguon_id` = buổi nguồn mà nó chiếm chỗ. Số truy vấn cố định, không N+1.
  private async lichThucTe(
    dangKyIds: string[],
  ): Promise<Map<string, OLich[]>> {
    const kq = new Map<string, OLich[]>();
    if (dangKyIds.length === 0) return kq;
    const [phanLop, doi] = await Promise.all([
      this.prisma.phan_lop_giai_doan.findMany({
        where: { dang_ky_hoc_id: { in: dangKyIds } },
        select: { dang_ky_hoc_id: true, giai_doan_id: true, lop_id: true },
      }),
      this.query.doiBuoiDaDuyetCuaDangKy(dangKyIds),
    ]);
    if (phanLop.length === 0) return kq;
    const chotIds = [...new Set(doi.map((d) => d.lich_chot_id))];
    // Nhiều đăng ký cùng lớp → 1 nhánh OR cho mỗi (lớp, giai đoạn).
    const capLop = new Map(
      phanLop.map((p) => [
        lopKey(p.lop_id, p.giai_doan_id),
        { lop_id: p.lop_id, giai_doan_id: p.giai_doan_id },
      ]),
    );
    const lich = await this.prisma.lich_hoc_lop.findMany({
      where: {
        OR: [
          ...capLop.values(),
          ...(chotIds.length ? [{ id: { in: chotIds } }] : []),
        ],
      },
      orderBy: { thoi_gian_bat_dau: 'asc' },
      select: LICH_TRUNG_SELECT,
    });
    const theoId = new Map(lich.map((l) => [l.id, l]));
    const theoLop = new Map<string, typeof lich>();
    for (const l of lich) {
      const k = lopKey(l.lop_id, l.giai_doan_id);
      const ds = theoLop.get(k);
      if (ds) ds.push(l);
      else theoLop.set(k, [l]);
    }
    const doiTheoCap = new Map(
      doi.map((d) => [capKey(d.dang_ky_hoc_id, d.lich_nguon_id), d.lich_chot_id]),
    );
    for (const p of phanLop) {
      const ds = kq.get(p.dang_ky_hoc_id) ?? [];
      for (const l of theoLop.get(lopKey(p.lop_id, p.giai_doan_id)) ?? []) {
        const chotId = doiTheoCap.get(capKey(p.dang_ky_hoc_id, l.id));
        const b = chotId ? theoId.get(chotId) : l;
        if (b) ds.push({ nguon_id: l.id, buoi: veLichTrung(b) });
      }
      kq.set(p.dang_ky_hoc_id, ds);
    }
    return kq;
  }

  // Buổi tương đương buổi nguồn, chưa bắt đầu, kèm sĩ số + trùng lịch của đăng ký
  // (dùng cho học viên và người duyệt).
  private async luaChonTuongDuong(
    nguon: LichTomTat,
    now: Date,
    dangKyId: string,
  ): Promise<LuaChonBuoi[]> {
    const ungVien = await this.prisma.lich_hoc_lop.findMany({
      where: {
        giai_doan_id: nguon.giai_doan_id,
        buoi_so: nguon.buoi_so,
        thoi_gian_bat_dau: { gt: now },
        lop: { khoa_id: nguon.lop.khoa_id, loai_lop: nguon.lop.loai_lop },
      },
      orderBy: { thoi_gian_bat_dau: 'asc' },
      select: {
        ...LICH_TOM_TAT_SELECT,
        phong: true,
        dia_diem_hoac_link: true,
        diem_hoc: { select: { ten: true, dia_chi: true } },
      },
    });
    const tuongDuong = ungVien.filter((l) => laBuoiTuongDuong(nguon, l));
    if (tuongDuong.length === 0) return [];
    const [siSo, lichDk] = await Promise.all([
      this.query.siSoBuoi(
        tuongDuong.map((l) => l.id),
        now,
      ),
      this.lichThucTe([dangKyId]),
    ]);
    const lichCuaDk = lichDk.get(dangKyId) ?? [];
    return tuongDuong.map(
      ({ phong, dia_diem_hoac_link, diem_hoc, ...lich }) => {
        const s = siSo.get(lich.id) ?? {
          si_so: 0,
          si_so_toi_da: lich.lop.si_so_toi_da,
          so_cho_duyet: 0,
        };
        return {
          lich,
          thoi_gian_ket_thuc: lich.thoi_gian_ket_thuc as Date,
          diem_hoc:
            lich.lop.loai_lop === 'truc_tiep' ? (diem_hoc ?? null) : null,
          phong: lich.lop.loai_lop === 'truc_tiep' ? (phong ?? null) : null,
          dia_diem_hoac_link:
            lich.lop.loai_lop === 'truc_tiep' || lich.lop.loai_lop === 'zoom'
              ? null
              : (dia_diem_hoac_link ?? null),
          si_so: s.si_so,
          si_so_toi_da: s.si_so_toi_da,
          so_cho_duyet: s.so_cho_duyet,
          da_du: s.si_so_toi_da !== null && s.si_so >= s.si_so_toi_da,
          trung_lich: trungLich(lichCuaDk, nguon.id, lich),
        };
      },
    );
  }

  // Thứ hạng trong hàng chờ của cùng buổi đề nghị: chỉ tính cho_duyet chưa quá hạn.
  private async hangChoTheoDeNghi(
    rows: DeNghiRow[],
    now: Date,
  ): Promise<Map<string, { k: number; n: number }>> {
    const cho = rows.filter((r) => r.trang_thai === 'cho_duyet');
    const ketQua = new Map<string, { k: number; n: number }>();
    if (cho.length === 0) return ketQua;
    const hangDoi = await this.prisma.doi_buoi_hoc.findMany({
      where: {
        trang_thai: 'cho_duyet',
        lich_de_nghi_id: {
          in: [...new Set(cho.map((r) => r.lich_de_nghi_id))],
        },
      },
      select: {
        id: true,
        tao_luc: true,
        lich_de_nghi_id: true,
        lich_nguon: { select: { thoi_gian_bat_dau: true } },
      },
    });
    const conHan = hangDoi.filter((h) => !daBatDau(h.lich_nguon, now));
    for (const r of cho) {
      const ds = conHan.filter((h) => h.lich_de_nghi_id === r.lich_de_nghi_id);
      ketQua.set(r.id, thuTuHang(r, ds));
    }
    return ketQua;
  }

  private anhXaDeNghi(
    r: DeNghiRow,
    lichMap: Map<string, LichTomTat>,
    now: Date,
    hang: Map<string, { k: number; n: number }>,
    chotCu: Map<string, string>,
    lichDk: Map<string, OLich[]>,
    quaHanThem: Set<string>,
  ): DeNghiHocVien {
    const nguon = lichMap.get(r.lich_nguon_id);
    const dich = lichMap.get(r.lich_de_nghi_id);
    const dk = lichDk.get(r.dang_ky_hoc_id);
    const doiLai = doiLaiTu(r, chotCu, lichMap);
    const quaHan =
      r.trang_thai === 'cho_duyet' &&
      ((nguon !== undefined && daBatDau(nguon, now)) ||
        (dich !== undefined && daBatDau(dich, now)) ||
        (doiLai !== null && daBatDau(doiLai, now)) ||
        quaHanThem.has(r.id));
    return {
      id: r.id,
      trang_thai: r.trang_thai,
      lich_nguon_id: r.lich_nguon_id,
      lich_de_nghi_id: r.lich_de_nghi_id,
      lich_chot_id: r.lich_chot_id,
      ly_do: r.ly_do,
      tao_luc: r.tao_luc,
      ghi_chu_xu_ly: r.ghi_chu_xu_ly,
      ly_do_huy: lyDoHuy(r),
      qua_han: quaHan,
      thu_tu_hang: quaHan ? null : (hang.get(r.id) ?? null),
      buoi_nguon: tomTatBuoi(nguon),
      buoi_de_nghi: tomTatBuoi(dich),
      buoi_chot: r.lich_chot_id
        ? tomTatBuoi(lichMap.get(r.lich_chot_id))
        : null,
      doi_lai_tu: doiLai,
      trung_lich:
        r.trang_thai === 'cho_duyet' && dk && dich?.thoi_gian_ket_thuc
          ? trungLich(dk, r.lich_nguon_id, {
              thoi_gian_bat_dau: dich.thoi_gian_bat_dau,
              thoi_gian_ket_thuc: dich.thoi_gian_ket_thuc,
            })
          : [],
    };
  }

  private ghiNhatKyGui(
    hocVienId: string,
    moTa: string,
    chiTiet: Record<string, unknown>,
  ) {
    return this.nhatKy.ghi({
      hanh_dong: 'de_nghi_doi_buoi',
      hoc_vien_id: hocVienId,
      mo_ta: moTa,
      chi_tiet: chiTiet,
    });
  }
}

const DE_NGHI_SELECT = {
  id: true,
  trang_thai: true,
  dang_ky_hoc_id: true,
  lich_nguon_id: true,
  lich_de_nghi_id: true,
  lich_chot_id: true,
  ly_do: true,
  tao_luc: true,
  ghi_chu_xu_ly: true,
  nguoi_xu_ly: true,
} satisfies Prisma.doi_buoi_hocSelect;

// Đề nghị bị hủy không do người duyệt: server tự ghi ghi_chu_xu_ly để phân biệt
// học viên sửa (bản cũ bị thay) với học viên tự hủy. Bản ghi cũ (trước khi có
// ghi chú này) được coi là tự hủy.
export const GHI_CHU_HOC_VIEN_SUA = 'Học viên đã sửa (thay bằng đề nghị mới)';
export const GHI_CHU_HOC_VIEN_HUY = 'Học viên tự hủy';
// D11: bản đã duyệt bị thay khi duyệt đề nghị đổi lại (server ghi, nguoi_xu_ly null).
export const GHI_CHU_THAY_THE = 'Đã thay bằng đề nghị đổi lại';

export type LyDoHuy = 'hoc_vien_sua' | 'hoc_vien_huy' | 'huy_duyet' | 'thay_the';

export function lyDoHuy(r: {
  trang_thai: trang_thai_de_nghi;
  nguoi_xu_ly: string | null;
  ghi_chu_xu_ly: string | null;
}): LyDoHuy | null {
  if (r.trang_thai !== 'da_huy') return null;
  if (r.ghi_chu_xu_ly === GHI_CHU_THAY_THE && !r.nguoi_xu_ly) return 'thay_the';
  if (r.nguoi_xu_ly) return 'huy_duyet';
  return r.ghi_chu_xu_ly === GHI_CHU_HOC_VIEN_SUA ? 'hoc_vien_sua' : 'hoc_vien_huy';
}

const capKey = (dangKyId: string, lichNguonId: string) =>
  `${dangKyId}|${lichNguonId}`;

const lopKey = (lopId: string, giaiDoanId: string) => `${lopId}|${giaiDoanId}`;

const LICH_TRUNG_SELECT = {
  id: true,
  lop_id: true,
  giai_doan_id: true,
  buoi_so: true,
  thoi_gian_bat_dau: true,
  thoi_gian_ket_thuc: true,
  lop: { select: { ten_lop: true } },
} satisfies Prisma.lich_hoc_lopSelect;

/** Một buổi trên lịch thực tế + buổi nguồn mà nó chiếm chỗ. */
interface OLich {
  nguon_id: string;
  buoi: LichTrung;
}

function veLichTrung(l: LichTrung): LichTrung {
  return {
    id: l.id,
    buoi_so: l.buoi_so,
    thoi_gian_bat_dau: l.thoi_gian_bat_dau,
    thoi_gian_ket_thuc: l.thoi_gian_ket_thuc,
    lop: { ten_lop: l.lop.ten_lop },
  };
}

// Bỏ ô của buổi nguồn đang xét (chính nó, hoặc buổi chốt hiện tại nếu đổi lại).
function trungLich(
  lich: OLich[],
  lichNguonId: string,
  ungVien: { thoi_gian_bat_dau: Date; thoi_gian_ket_thuc: Date },
): LichTrung[] {
  return buoiTrungGio(
    ungVien,
    lich.filter((o) => o.nguon_id !== lichNguonId).map((o) => o.buoi),
  );
}

// (đăng ký|buổi nguồn) → buổi chốt của bản đã duyệt.
function chotDaDuyetTheoCap(
  rows: {
    dang_ky_hoc_id: string;
    lich_nguon_id: string;
    lich_chot_id: string | null;
  }[],
): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of rows)
    if (r.lich_chot_id)
      m.set(capKey(r.dang_ky_hoc_id, r.lich_nguon_id), r.lich_chot_id);
  return m;
}

function doiLaiTu(
  r: { trang_thai: trang_thai_de_nghi; dang_ky_hoc_id: string; lich_nguon_id: string },
  chotCu: Map<string, string>,
  lichMap: Map<string, LichTomTat>,
): BuoiTomTat | null {
  if (r.trang_thai !== 'cho_duyet') return null;
  const id = chotCu.get(capKey(r.dang_ky_hoc_id, r.lich_nguon_id));
  return id ? tomTatBuoi(lichMap.get(id)) : null;
}

// Va chạm unique trong giao dịch duyệt (đua hiếm) → 409 thay vì 500.
function trungLaDaXuLy(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
    throw new ConflictAppException('Đề nghị đã được xử lý');
  throw e;
}
