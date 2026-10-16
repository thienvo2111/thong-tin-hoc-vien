import { Injectable } from '@nestjs/common';
import {
  loai_lop_hoc,
  muc_nang_luc,
  Prisma,
  trang_thai_de_nghi,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { HoTroHocVienScopeService } from '../ho-tro-hoc-vien/ho-tro-hoc-vien-scope.service';
import { NhatKyService } from '../nhat-ky/nhat-ky.service';
import { LocThongKeDoiBuoiDto } from './dto/doi-buoi-hoc.dto';
import { DoiBuoiHocQueryService } from './doi-buoi-hoc-query.service';
import { daBatDau } from './doi-buoi-hoc.rules';
import {
  BuoiTomTat,
  GHI_CHU_HOC_VIEN_HUY,
  GHI_CHU_HOC_VIEN_SUA,
  LyDoHuy,
  lyDoHuy,
  tomTatBuoi,
} from './doi-buoi-hoc.service';
import {
  buildThongKeDoiBuoiWorkbook,
  ngayGioVn,
  NHAN_LOAI_LOP,
  NHAN_MUC,
} from './thong-ke-doi-buoi.excel';
import { gioVn, ngayVn } from '../nhac-lich/nhac-lich.util';

// Tab Thống kê đổi buổi: mỗi dòng = 1 buổi học có đề nghị đi ra (lich_nguon)
// hoặc đi vào (buổi đề nghị / buổi chốt). Số truy vấn cố định, đếm trong bộ nhớ.
//
// Lưu ý nhất quán: *_da_duyet là số bản ghi da_duyet THÔ (kể cả bản đã mất hiệu
// lực do phân lớp đổi sau khi duyệt), còn si_so lấy từ DoiBuoiHocQueryService.siSoBuoi
// — chỉ tính bản ghi còn hiệu lực. Hai số có thể lệch nhau, đúng chủ đích.

export const TOI_DA_DE_NGHI = 20_000;
export const TOI_DA_DONG = 1_000;
const MS_NGAY = 86_400_000;

const DE_NGHI_THONG_KE_SELECT = {
  id: true,
  trang_thai: true,
  lich_nguon_id: true,
  lich_de_nghi_id: true,
  lich_chot_id: true,
  dang_ky_hoc: { select: { cum: { select: { id: true, ten_cum: true } } } },
} satisfies Prisma.doi_buoi_hocSelect;

const DE_NGHI_CHI_TIET_SELECT = {
  ...DE_NGHI_THONG_KE_SELECT,
  ly_do: true,
  tao_luc: true,
  xu_ly_luc: true,
  ghi_chu_xu_ly: true,
  nguoi_xu_ly: true,
  xu_ly_boi: { select: { ho_ten: true } },
  dang_ky_hoc: {
    select: {
      cum: { select: { id: true, ten_cum: true } },
      hoc_vien: {
        select: {
          ho_ten: true,
          don_vi_cong_tac: { select: { ten_don_vi: true } },
        },
      },
    },
  },
} satisfies Prisma.doi_buoi_hocSelect;

const LICH_THONG_KE_SELECT = {
  id: true,
  lop_id: true,
  giai_doan_id: true,
  buoi_so: true,
  thoi_gian_bat_dau: true,
  thoi_gian_ket_thuc: true,
  lop: {
    select: {
      id: true,
      ten_lop: true,
      muc_nang_luc: true,
      loai_lop: true,
      si_so_toi_da: true,
      khoa: { select: { id: true, ma_khoa: true, ten_khoa: true } },
    },
  },
  giai_doan: {
    select: { id: true, khoa_id: true, thu_tu: true, ten_giai_doan: true },
  },
} satisfies Prisma.lich_hoc_lopSelect;

type DeNghiThongKe = Prisma.doi_buoi_hocGetPayload<{
  select: typeof DE_NGHI_THONG_KE_SELECT;
}>;
type DeNghiChiTiet = Prisma.doi_buoi_hocGetPayload<{
  select: typeof DE_NGHI_CHI_TIET_SELECT;
}>;
type LichThongKe = Prisma.lich_hoc_lopGetPayload<{
  select: typeof LICH_THONG_KE_SELECT;
}>;

type Nhom = 'da_duyet' | 'cho' | 'qua_han' | 'tu_choi' | 'huy';
type Dem = Record<Nhom, number>;

export interface DongThongKe {
  lich: {
    id: string;
    buoi_so: number;
    thoi_gian_bat_dau: Date;
    thoi_gian_ket_thuc: Date | null;
    lop: {
      id: string;
      ten_lop: string;
      muc_nang_luc: muc_nang_luc | null;
      loai_lop: loai_lop_hoc;
    };
    giai_doan: { id: string; thu_tu: number; ten_giai_doan: string };
    khoa: { id: string; ma_khoa: string; ten_khoa: string };
  };
  si_so_phan_lop: number;
  si_so: number;
  si_so_toi_da: number | null;
  day: boolean;
  ra_da_duyet: number;
  ra_cho: number;
  ra_qua_han: number;
  ra_tu_choi: number;
  ra_huy: number;
  vao_da_duyet: number;
  vao_cho: number;
  vao_qua_han: number;
  vao_tu_choi: number;
  vao_huy: number;
}

export interface BoLocThongKe {
  khoa: { id: string; ma_khoa: string; ten_khoa: string }[];
  giai_doan: {
    id: string;
    khoa_id: string;
    thu_tu: number;
    ten_giai_doan: string;
  }[];
  lop: {
    id: string;
    khoa_id: string;
    ten_lop: string;
    muc_nang_luc: muc_nang_luc | null;
    loai_lop: loai_lop_hoc;
  }[];
  cum: { id: string; ten_cum: string }[];
}

export interface KetQuaThongKe {
  tong: {
    de_nghi: number;
    cho_duyet: number;
    qua_han: number;
    da_duyet: number;
    tu_choi: number;
    da_huy: number;
    so_buoi_day: number;
  };
  dong: DongThongKe[];
  bo_loc: BoLocThongKe;
  gioi_han: boolean;
}

export interface HocVienDong {
  de_nghi_id: string;
  ho_ten: string;
  don_vi: string;
  cum: string | null;
  trang_thai: trang_thai_de_nghi;
  ly_do_huy: LyDoHuy | null;
  qua_han: boolean;
  buoi_kia: BuoiTomTat | null;
  tao_luc: Date;
  xu_ly_luc: Date | null;
  nguoi_xu_ly: string | null;
}

/** Buổi "đi vào" của đề nghị: đã duyệt → buổi chốt; đã hủy → chốt ?? đề nghị; còn lại → buổi đề nghị. */
export function lichVao(d: {
  trang_thai: trang_thai_de_nghi;
  lich_de_nghi_id: string;
  lich_chot_id: string | null;
}): string {
  if (d.trang_thai === 'da_duyet' || d.trang_thai === 'da_huy')
    return d.lich_chot_id ?? d.lich_de_nghi_id;
  return d.lich_de_nghi_id;
}

/** Nhãn trạng thái — khớp nhãn tab "Đã xử lý" ở giao diện (nhanDaXuLy). */
export function nhanTrangThai(d: {
  trang_thai: trang_thai_de_nghi;
  ly_do_huy: LyDoHuy | null;
  qua_han: boolean;
  nguoi_xu_ly: string | null;
}): string {
  if (d.trang_thai === 'cho_duyet')
    return d.qua_han ? 'Chờ duyệt (quá hạn)' : 'Chờ duyệt';
  if (d.trang_thai === 'da_duyet') return 'Đã duyệt';
  if (d.trang_thai === 'tu_choi') return 'Từ chối';
  if (d.ly_do_huy === 'hoc_vien_sua') return GHI_CHU_HOC_VIEN_SUA;
  if (d.ly_do_huy === 'hoc_vien_huy') return GHI_CHU_HOC_VIEN_HUY;
  return d.nguoi_xu_ly ? `Hủy duyệt bởi ${d.nguoi_xu_ly}` : 'Hủy duyệt';
}

function quaHan(
  d: {
    trang_thai: trang_thai_de_nghi;
    lich_nguon_id: string;
    lich_de_nghi_id: string;
  },
  batDau: (id: string) => Date | undefined,
  now: Date,
): boolean {
  if (d.trang_thai !== 'cho_duyet') return false;
  return [d.lich_nguon_id, d.lich_de_nghi_id].some((id) => {
    const t = batDau(id);
    return t !== undefined && daBatDau({ thoi_gian_bat_dau: t }, now);
  });
}

function nhom(d: DeNghiThongKe, qh: boolean): Nhom {
  if (d.trang_thai === 'cho_duyet') return qh ? 'qua_han' : 'cho';
  if (d.trang_thai === 'da_duyet') return 'da_duyet';
  if (d.trang_thai === 'tu_choi') return 'tu_choi';
  return 'huy';
}

/** 'YYYY-MM-DD' giờ VN → mốc UTC 00:00 VN của ngày đó. */
function dauNgayVn(ngay: string): number {
  return Date.parse(`${ngay}T00:00:00+07:00`);
}

function buoiQuaLoc(l: LichThongKe, loc: LocThongKeDoiBuoiDto): boolean {
  if (loc.khoa_id && l.lop.khoa.id !== loc.khoa_id) return false;
  if (loc.giai_doan_id && l.giai_doan_id !== loc.giai_doan_id) return false;
  if (loc.lop_id?.length && !loc.lop_id.includes(l.lop_id)) return false;
  if (
    loc.muc_nang_luc?.length &&
    (!l.lop.muc_nang_luc || !loc.muc_nang_luc.includes(l.lop.muc_nang_luc))
  )
    return false;
  if (loc.loai_lop?.length && !loc.loai_lop.includes(l.lop.loai_lop))
    return false;
  const t = l.thoi_gian_bat_dau.getTime();
  if (loc.tu_ngay && t < dauNgayVn(loc.tu_ngay)) return false;
  if (loc.den_ngay && t >= dauNgayVn(loc.den_ngay) + MS_NGAY) return false;
  return true;
}

const theoTen = (a: string, b: string) => a.localeCompare(b, 'vi');

function boLoc(ds: DeNghiThongKe[], lich: LichThongKe[]): BoLocThongKe {
  const khoa = new Map<string, BoLocThongKe['khoa'][number]>();
  const giaiDoan = new Map<string, BoLocThongKe['giai_doan'][number]>();
  const lop = new Map<string, BoLocThongKe['lop'][number]>();
  const cum = new Map<string, BoLocThongKe['cum'][number]>();
  for (const l of lich) {
    khoa.set(l.lop.khoa.id, l.lop.khoa);
    giaiDoan.set(l.giai_doan.id, l.giai_doan);
    lop.set(l.lop.id, {
      id: l.lop.id,
      khoa_id: l.lop.khoa.id,
      ten_lop: l.lop.ten_lop,
      muc_nang_luc: l.lop.muc_nang_luc,
      loai_lop: l.lop.loai_lop,
    });
  }
  for (const d of ds)
    if (d.dang_ky_hoc.cum) cum.set(d.dang_ky_hoc.cum.id, d.dang_ky_hoc.cum);
  return {
    khoa: [...khoa.values()].sort((a, b) => theoTen(a.ma_khoa, b.ma_khoa)),
    giai_doan: [...giaiDoan.values()].sort(
      (a, b) => theoTen(a.khoa_id, b.khoa_id) || a.thu_tu - b.thu_tu,
    ),
    lop: [...lop.values()].sort((a, b) => theoTen(a.ten_lop, b.ten_lop)),
    cum: [...cum.values()].sort((a, b) => theoTen(a.ten_cum, b.ten_cum)),
  };
}

function demRong(): Dem {
  return { da_duyet: 0, cho: 0, qua_han: 0, tu_choi: 0, huy: 0 };
}

const BO_LOC_RONG: BoLocThongKe = { khoa: [], giai_doan: [], lop: [], cum: [] };

function ketQuaRong(): KetQuaThongKe {
  return {
    tong: {
      de_nghi: 0,
      cho_duyet: 0,
      qua_han: 0,
      da_duyet: 0,
      tu_choi: 0,
      da_huy: 0,
      so_buoi_day: 0,
    },
    dong: [],
    bo_loc: BO_LOC_RONG,
    gioi_han: false,
  };
}

/** "Lớp 01 · Buổi 2 · Thứ hai, 20/11/2026 08:00" — dùng cho file xuất. */
function moTaBuoi(l: LichThongKe | undefined): string {
  if (!l) return '';
  return `${l.lop.ten_lop} · Buổi ${l.buoi_so} · ${ngayVn(l.thoi_gian_bat_dau)} ${gioVn(l.thoi_gian_bat_dau)}`;
}

interface KetQuaTinh<T> {
  ketQua: KetQuaThongKe;
  /** Đề nghị được tính vào tong (mỗi đề nghị 1 lần). */
  deNghi: T[];
  lichMap: Map<string, LichThongKe>;
  now: Date;
}

@Injectable()
export class ThongKeDoiBuoiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly query: DoiBuoiHocQueryService,
    private readonly scope: HoTroHocVienScopeService,
    private readonly nhatKy: NhatKyService,
  ) {}

  async thongKe(
    user: AuthenticatedUser,
    loc: LocThongKeDoiBuoiDto,
  ): Promise<KetQuaThongKe> {
    const phamVi = await this.cumPhamVi(user);
    if (phamVi?.length === 0) return ketQuaRong();
    const rows = await this.prisma.doi_buoi_hoc.findMany({
      ...this.argsDeNghi(phamVi),
      select: DE_NGHI_THONG_KE_SELECT,
    });
    return (await this.tinh(rows, loc, this.giaoCum(phamVi, loc.cum_id)))
      .ketQua;
  }

  async chiTietBuoi(
    user: AuthenticatedUser,
    lichId: string,
    loc: Pick<LocThongKeDoiBuoiDto, 'cum_id'>,
  ): Promise<{ ra: HocVienDong[]; vao: HocVienDong[] }> {
    const cum = this.giaoCum(await this.cumPhamVi(user), loc.cum_id);
    if (cum?.length === 0) return { ra: [], vao: [] };
    const rows = await this.prisma.doi_buoi_hoc.findMany({
      where: {
        OR: [
          { lich_nguon_id: lichId },
          { lich_de_nghi_id: lichId },
          { lich_chot_id: lichId },
        ],
        ...(cum ? { dang_ky_hoc: { cum_id: { in: cum } } } : {}),
      },
      orderBy: { tao_luc: 'asc' },
      select: DE_NGHI_CHI_TIET_SELECT,
    });
    const lichMap = await this.query.lichTomTat(
      rows.flatMap((d) =>
        [d.lich_nguon_id, d.lich_de_nghi_id, d.lich_chot_id].filter(
          (x): x is string => x !== null,
        ),
      ),
    );
    const now = new Date();
    const batDau = (id: string) => lichMap.get(id)?.thoi_gian_bat_dau;
    const dong = (d: DeNghiChiTiet, kia: string): HocVienDong => ({
      de_nghi_id: d.id,
      ho_ten: d.dang_ky_hoc.hoc_vien.ho_ten,
      don_vi: d.dang_ky_hoc.hoc_vien.don_vi_cong_tac.ten_don_vi,
      cum: d.dang_ky_hoc.cum?.ten_cum ?? null,
      trang_thai: d.trang_thai,
      ly_do_huy: lyDoHuy(d),
      qua_han: quaHan(d, batDau, now),
      buoi_kia: tomTatBuoi(lichMap.get(kia)),
      tao_luc: d.tao_luc,
      xu_ly_luc: d.xu_ly_luc,
      nguoi_xu_ly: d.xu_ly_boi?.ho_ten ?? null,
    });
    return {
      ra: rows
        .filter((d) => d.lich_nguon_id === lichId)
        .map((d) => dong(d, lichVao(d))),
      vao: rows
        .filter((d) => lichVao(d) === lichId)
        .map((d) => dong(d, d.lich_nguon_id)),
    };
  }

  async xuatExcel(
    user: AuthenticatedUser,
    loc: LocThongKeDoiBuoiDto,
  ): Promise<Buffer> {
    const phamVi = await this.cumPhamVi(user);
    const rows =
      phamVi?.length === 0
        ? []
        : await this.prisma.doi_buoi_hoc.findMany({
            ...this.argsDeNghi(phamVi),
            select: DE_NGHI_CHI_TIET_SELECT,
          });
    const { ketQua, deNghi, lichMap, now } = await this.tinh(
      rows,
      loc,
      this.giaoCum(phamVi, loc.cum_id),
    );
    const batDau = (id: string) => lichMap.get(id)?.thoi_gian_bat_dau;
    const ngayXuat = new Date();
    const buffer = await buildThongKeDoiBuoiWorkbook({
      mo_ta_bo_loc: this.moTaBoLoc(loc, ketQua.bo_loc, ketQua.gioi_han),
      ngay_xuat: ngayXuat,
      dong: ketQua.dong,
      hoc_vien: deNghi.map((d) => ({
        ho_ten: d.dang_ky_hoc.hoc_vien.ho_ten,
        don_vi: d.dang_ky_hoc.hoc_vien.don_vi_cong_tac.ten_don_vi,
        cum: d.dang_ky_hoc.cum?.ten_cum ?? '',
        buoi_goc: moTaBuoi(lichMap.get(d.lich_nguon_id)),
        buoi_de_nghi: moTaBuoi(lichMap.get(d.lich_de_nghi_id)),
        buoi_chot: d.lich_chot_id ? moTaBuoi(lichMap.get(d.lich_chot_id)) : '',
        trang_thai: nhanTrangThai({
          trang_thai: d.trang_thai,
          ly_do_huy: lyDoHuy(d),
          qua_han: quaHan(d, batDau, now),
          nguoi_xu_ly: d.xu_ly_boi?.ho_ten ?? null,
        }),
        gui_luc: d.tao_luc,
        xu_ly_luc: d.xu_ly_luc,
        nguoi_xu_ly: d.xu_ly_boi?.ho_ten ?? '',
        ly_do: d.ly_do,
      })),
    });
    await this.nhatKy.ghi({
      hanh_dong: 'xuat_thong_ke_doi_buoi',
      nguoi_dung: { id: user.id, vai_tro: user.vai_tro },
      chi_tiet: {
        bo_loc: { ...loc },
        so_buoi: ketQua.dong.length,
        so_de_nghi: deNghi.length,
        thoi_diem: ngayGioVn(ngayXuat),
      },
    });
    return buffer;
  }

  // ---------------------------------------------------------------------

  /** Tải đề nghị trong phạm vi cụm của người xem (không áp bộ lọc cụm chọn — để bo_loc ổn định). */
  private argsDeNghi(phamVi: string[] | null) {
    return {
      where: phamVi ? { dang_ky_hoc: { cum_id: { in: phamVi } } } : {},
      orderBy: { tao_luc: 'desc' as const },
      take: TOI_DA_DE_NGHI + 1,
    };
  }

  /** cumLoc: cụm chọn ∩ phạm vi (null = không lọc cụm). */
  private async tinh<T extends DeNghiThongKe>(
    rows: T[],
    loc: LocThongKeDoiBuoiDto,
    cumLoc: string[] | null,
  ): Promise<KetQuaTinh<T>> {
    const now = new Date();
    const gioiHanDeNghi = rows.length > TOI_DA_DE_NGHI;
    const ds = rows.slice(0, TOI_DA_DE_NGHI);
    const lichIds = [
      ...new Set(
        ds.flatMap((d) =>
          [d.lich_nguon_id, d.lich_de_nghi_id, d.lich_chot_id].filter(
            (x): x is string => x !== null,
          ),
        ),
      ),
    ];
    const lich = lichIds.length
      ? await this.prisma.lich_hoc_lop.findMany({
          where: { id: { in: lichIds } },
          select: LICH_THONG_KE_SELECT,
        })
      : [];
    const lichMap = new Map(lich.map((l) => [l.id, l]));
    const bo_loc = boLoc(ds, lich);

    // Lọc cụm trong bộ nhớ (ds tải theo phạm vi, chưa theo cụm chọn — để bo_loc.cum ổn định).
    const cumChon = cumLoc ? new Set(cumLoc) : null;
    const theoCum = cumChon
      ? ds.filter((d) => d.dang_ky_hoc.cum && cumChon.has(d.dang_ky_hoc.cum.id))
      : ds;

    const quaLoc = new Map<string, boolean>();
    const qua = (id: string) => {
      let v = quaLoc.get(id);
      if (v === undefined) {
        const l = lichMap.get(id);
        v = !!l && buoiQuaLoc(l, loc);
        quaLoc.set(id, v);
      }
      return v;
    };
    const batDau = (id: string) => lichMap.get(id)?.thoi_gian_bat_dau;
    const dem = new Map<string, { ra: Dem; vao: Dem }>();
    const o = (id: string) => {
      let x = dem.get(id);
      if (!x) dem.set(id, (x = { ra: demRong(), vao: demRong() }));
      return x;
    };
    const nhomCua = new Map<string, Nhom>();
    for (const d of theoCum) {
      const n = nhom(d, quaHan(d, batDau, now));
      nhomCua.set(d.id, n);
      if (qua(d.lich_nguon_id)) o(d.lich_nguon_id).ra[n]++;
      const vao = lichVao(d);
      if (qua(vao)) o(vao).vao[n]++;
    }

    let ids = [...dem.keys()];
    if (loc.chi_co_cho)
      ids = ids.filter((id) => {
        const x = dem.get(id)!;
        return x.ra.cho + x.vao.cho > 0;
      });
    ids.sort((a, b) => {
      const la = lichMap.get(a)!;
      const lb = lichMap.get(b)!;
      return (
        la.thoi_gian_bat_dau.getTime() - lb.thoi_gian_bat_dau.getTime() ||
        theoTen(la.lop.ten_lop, lb.lop.ten_lop)
      );
    });

    // tong & danh sách học viên: mọi đề nghị có ít nhất 1 đầu nằm ở dòng sau lọc (trước khi cắt 1000 dòng).
    const giu = new Set(ids);
    const deNghi = theoCum.filter(
      (d) => giu.has(d.lich_nguon_id) || giu.has(lichVao(d)),
    );
    const tongNhom = demRong();
    for (const d of deNghi) tongNhom[nhomCua.get(d.id)!]++;

    const gioiHanDong = ids.length > TOI_DA_DONG;
    const conLai = ids.slice(0, TOI_DA_DONG);
    const dong = await this.dongThongKe(conLai, lichMap, dem, now);
    return {
      ketQua: {
        tong: {
          de_nghi: deNghi.length,
          cho_duyet: tongNhom.cho,
          qua_han: tongNhom.qua_han,
          da_duyet: tongNhom.da_duyet,
          tu_choi: tongNhom.tu_choi,
          da_huy: tongNhom.huy,
          so_buoi_day: dong.filter((x) => x.day).length,
        },
        dong,
        bo_loc,
        gioi_han: gioiHanDeNghi || gioiHanDong,
      },
      deNghi,
      lichMap,
      now,
    };
  }

  private async dongThongKe(
    ids: string[],
    lichMap: Map<string, LichThongKe>,
    dem: Map<string, { ra: Dem; vao: Dem }>,
    now: Date,
  ): Promise<DongThongKe[]> {
    if (ids.length === 0) return [];
    const lich = ids.map((id) => lichMap.get(id)!);
    const [phanLop, siSo] = await Promise.all([
      this.prisma.phan_lop_giai_doan.groupBy({
        by: ['lop_id', 'giai_doan_id'],
        where: {
          lop_id: { in: [...new Set(lich.map((l) => l.lop_id))] },
          giai_doan_id: { in: [...new Set(lich.map((l) => l.giai_doan_id))] },
        },
        _count: { _all: true },
      }),
      this.query.siSoBuoi(ids, now),
    ]);
    const demPhanLop = new Map(
      phanLop.map((g) => [`${g.lop_id}|${g.giai_doan_id}`, g._count._all]),
    );
    return lich.map((l) => {
      const s = siSo.get(l.id);
      const si_so = s?.si_so ?? 0;
      const si_so_toi_da = s?.si_so_toi_da ?? l.lop.si_so_toi_da;
      const { ra, vao } = dem.get(l.id)!;
      return {
        lich: {
          id: l.id,
          buoi_so: l.buoi_so,
          thoi_gian_bat_dau: l.thoi_gian_bat_dau,
          thoi_gian_ket_thuc: l.thoi_gian_ket_thuc ?? null,
          lop: {
            id: l.lop.id,
            ten_lop: l.lop.ten_lop,
            muc_nang_luc: l.lop.muc_nang_luc,
            loai_lop: l.lop.loai_lop,
          },
          giai_doan: {
            id: l.giai_doan.id,
            thu_tu: l.giai_doan.thu_tu,
            ten_giai_doan: l.giai_doan.ten_giai_doan,
          },
          khoa: l.lop.khoa,
        },
        si_so_phan_lop: demPhanLop.get(`${l.lop_id}|${l.giai_doan_id}`) ?? 0,
        si_so,
        si_so_toi_da,
        day: si_so_toi_da !== null && si_so >= si_so_toi_da,
        ra_da_duyet: ra.da_duyet,
        ra_cho: ra.cho,
        ra_qua_han: ra.qua_han,
        ra_tu_choi: ra.tu_choi,
        ra_huy: ra.huy,
        vao_da_duyet: vao.da_duyet,
        vao_cho: vao.cho,
        vao_qua_han: vao.qua_han,
        vao_tu_choi: vao.tu_choi,
        vao_huy: vao.huy,
      };
    });
  }

  // null = mọi cụm (quan_tri); [] = không có cụm nào → không thấy gì.
  private async cumPhamVi(user: AuthenticatedUser): Promise<string[] | null> {
    if (user.vai_tro === 'quan_tri') return null;
    return this.scope.cumIdsCuaToi(user.id);
  }

  private giaoCum(
    phamVi: string[] | null,
    chon: string[] | undefined,
  ): string[] | null {
    if (!chon?.length) return phamVi;
    if (phamVi === null) return chon;
    return chon.filter((c) => phamVi.includes(c));
  }

  private moTaBoLoc(
    loc: LocThongKeDoiBuoiDto,
    bo: BoLocThongKe,
    gioiHan: boolean,
  ): string {
    const ten = <X extends { id: string }>(
      ds: X[],
      id: string,
      f: (x: X) => string,
    ) => {
      const x = ds.find((y) => y.id === id);
      return x ? f(x) : id;
    };
    const ngay = (s: string) => s.split('-').reverse().join('/');
    const phan: string[] = [];
    if (loc.khoa_id)
      phan.push(`Khóa: ${ten(bo.khoa, loc.khoa_id, (k) => k.ten_khoa)}`);
    if (loc.giai_doan_id)
      phan.push(
        `Giai đoạn: ${ten(bo.giai_doan, loc.giai_doan_id, (g) => `GĐ${g.thu_tu} – ${g.ten_giai_doan}`)}`,
      );
    if (loc.lop_id?.length)
      phan.push(
        `Lớp: ${loc.lop_id.map((id) => ten(bo.lop, id, (l) => l.ten_lop)).join(', ')}`,
      );
    if (loc.muc_nang_luc?.length)
      phan.push(
        `Trình độ: ${loc.muc_nang_luc.map((m) => NHAN_MUC[m]).join(', ')}`,
      );
    if (loc.loai_lop?.length)
      phan.push(
        `Hình thức: ${loc.loai_lop.map((m) => NHAN_LOAI_LOP[m]).join(', ')}`,
      );
    if (loc.cum_id?.length)
      phan.push(
        `Cụm: ${loc.cum_id.map((id) => ten(bo.cum, id, (c) => c.ten_cum)).join(', ')}`,
      );
    if (loc.tu_ngay) phan.push(`Từ ngày ${ngay(loc.tu_ngay)}`);
    if (loc.den_ngay) phan.push(`Đến ngày ${ngay(loc.den_ngay)}`);
    if (loc.chi_co_cho) phan.push('Chỉ buổi có đề nghị chờ');
    const moTa = phan.length ? phan.join(' · ') : 'Tất cả';
    return gioiHan ? `${moTa} (dữ liệu đã bị cắt bớt do vượt giới hạn)` : moTa;
  }
}
