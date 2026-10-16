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
  laBuoiTuongDuong,
  LichTomTat,
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
}

export interface BuoiTomTat {
  id: string;
  buoi_so: number;
  thoi_gian_bat_dau: Date;
  thoi_gian_ket_thuc: Date | null;
  lop: { ten_lop: string };
}

function tomTatBuoi(l: LichTomTat | undefined): BuoiTomTat | null {
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
    const deNghi = deNghiRows.map((d) =>
      this.anhXaDeNghi(d, lichMap, now, hang),
    );
    const hoatDong = new Map(
      deNghi
        .filter((d) => TRANG_THAI_HOAT_DONG.includes(d.trang_thai))
        .map((d) => [d.lich_nguon_id, d]),
    );
    return {
      so_buoi_doi_toi_da: soBuoiToiDa,
      so_luot_da_dung: soLuotDaDung(deNghiRows),
      buoi_sap_toi: lichSapToi.map((l) => ({
        lich_nguon: l,
        de_nghi: hoatDong.get(l.id) ?? null,
      })),
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

    return this.luaChonTuongDuong(nguon, now);
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
    const locHan: Prisma.doi_buoi_hocWhereInput = !choDuyet
      ? {}
      : quaHan
        ? {
            OR: [
              { lich_nguon: { thoi_gian_bat_dau: { lte: now } } },
              { lich_de_nghi: { thoi_gian_bat_dau: { lte: now } } },
            ],
          }
        : {
            lich_nguon: { thoi_gian_bat_dau: { gt: now } },
            lich_de_nghi: { thoi_gian_bat_dau: { gt: now } },
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
    const [lichMap, hang, siSo] = await Promise.all([
      this.query.lichTomTat(
        rows.flatMap((r) =>
          [r.lich_nguon_id, r.lich_de_nghi_id, r.lich_chot_id].filter(
            (x): x is string => x !== null,
          ),
        ),
      ),
      this.hangChoTheoDeNghi(rows, now),
      this.query.siSoBuoi(
        [...new Set(rows.map((r) => r.lich_de_nghi_id))],
        now,
      ),
    ]);
    return rows.map(({ dang_ky_hoc, xu_ly_boi, ...r }) => {
      const s = siSo.get(r.lich_de_nghi_id);
      return {
        ...this.anhXaDeNghi(r, lichMap, now, hang),
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
    return this.prisma.doi_buoi_hoc.count({
      where: {
        trang_thai: 'cho_duyet',
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
    const ds = await this.luaChonTuongDuong(nguon, now);
    if (ds.length === 0) return [];
    const truoc = await this.prisma.doi_buoi_hoc.groupBy({
      by: ['lich_de_nghi_id'],
      where: {
        ...this.whereChoTruoc(dn, now),
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
      const lichMap = await this.query.lichTomTat(
        [dn.lich_nguon_id, lichChotId],
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
          ...this.whereChoTruoc({ id, tao_luc: hienTai.tao_luc }, now),
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
        },
        now,
      );
      if (quyetDinh.ket_qua === 'chan')
        this.nem({
          ok: false,
          ma: quyetDinh.ma!,
          thong_diep: quyetDinh.thong_diep!,
        });
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
      };
    });
    await this.ghiNhatKyDuyet(dn.dang_ky_hoc.hoc_vien_id, 'Duyệt đổi buổi', {
      de_nghi_id: id,
      lich_nguon_id: dn.lich_nguon_id,
      lich_de_nghi_id: dn.lich_de_nghi_id,
      lich_chot_id: lichChotId,
      vuot_si_so: kq.vuot_si_so,
      vuot_thu_tu: kq.vuot_thu_tu,
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
  ): Prisma.doi_buoi_hocWhereInput {
    return {
      trang_thai: 'cho_duyet',
      tao_luc: { lt: dn.tao_luc },
      id: { not: dn.id },
      lich_nguon: { thoi_gian_bat_dau: { gt: now } },
      lich_de_nghi: { thoi_gian_bat_dau: { gt: now } },
    };
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
        const soLuot = await tx.doi_buoi_hoc.count({
          where: {
            dang_ky_hoc_id: x.dangKyId,
            trang_thai: { in: TRANG_THAI_HOAT_DONG },
          },
        });
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
        throw new ConflictAppException(
          'Buổi này đã có đề nghị đang chờ hoặc đã duyệt',
        );
      throw e;
    }
  }

  // Buổi tương đương buổi nguồn, chưa bắt đầu, kèm sĩ số (dùng cho học viên và người duyệt).
  private async luaChonTuongDuong(
    nguon: LichTomTat,
    now: Date,
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
    const siSo = await this.query.siSoBuoi(
      tuongDuong.map((l) => l.id),
      now,
    );
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
  ): DeNghiHocVien {
    const nguon = lichMap.get(r.lich_nguon_id);
    const dich = lichMap.get(r.lich_de_nghi_id);
    const quaHan =
      r.trang_thai === 'cho_duyet' &&
      ((nguon !== undefined && daBatDau(nguon, now)) ||
        (dich !== undefined && daBatDau(dich, now)));
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

export type LyDoHuy = 'hoc_vien_sua' | 'hoc_vien_huy' | 'huy_duyet';

function lyDoHuy(r: {
  trang_thai: trang_thai_de_nghi;
  nguoi_xu_ly: string | null;
  ghi_chu_xu_ly: string | null;
}): LyDoHuy | null {
  if (r.trang_thai !== 'da_huy') return null;
  if (r.nguoi_xu_ly) return 'huy_duyet';
  return r.ghi_chu_xu_ly === GHI_CHU_HOC_VIEN_SUA ? 'hoc_vien_sua' : 'hoc_vien_huy';
}
