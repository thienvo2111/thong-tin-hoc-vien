import { Injectable } from '@nestjs/common';
import {
  loai_doi_buoi,
  Prisma,
  trang_thai_de_nghi,
} from '@prisma/client';
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
import { boSo0DauDeTimKiem } from '../common/utils/ma-moet.util';
import { dieuKienKhongDau } from '../common/utils/tim-kiem-khong-dau.util';
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
import { napBuoiGocCoMatLopKhac } from './hoc-bu-cong-nhan';

export interface DeNghiHocVien {
  id: string;
  trang_thai: trang_thai_de_nghi;
  /** ADR 0012: doi_buoi | hoc_bu. */
  loai: loai_doi_buoi;
  lich_nguon_id: string;
  lich_de_nghi_id: string;
  lich_chot_id: string | null;
  ly_do: string;
  tao_luc: Date;
  ghi_chu_xu_ly: string | null;
  ly_do_huy: LyDoHuy | null;
  qua_han: boolean;
  /** Vì sao quá hạn (chỉ khi qua_han) — để người duyệt biết vì sao chỉ còn từ chối. */
  ly_do_qua_han: LyDoQuaHan | null;
  thu_tu_hang: { k: number; n: number } | null;
  buoi_nguon: BuoiTomTat | null;
  buoi_de_nghi: BuoiTomTat | null;
  buoi_chot: BuoiTomTat | null;
  /** D11: đề nghị đổi lại (chờ) → buổi chốt của bản đã duyệt cùng buổi nguồn. */
  doi_lai_tu: BuoiTomTat | null;
  /** Chỉ đề nghị chờ: buổi trên lịch thực tế trùng giờ buổi đề nghị (cảnh báo, không chặn). */
  trung_lich: LichTrung[];
}

export type LyDoQuaHan =
  | 'buoi_goc_bat_dau'
  | 'buoi_de_nghi_bat_dau'
  | 'buoi_dang_hoc_bat_dau'
  | 'da_co_mat'
  | 'da_diem_danh_buoi_goc'
  | 'buoi_goc_da_duyet_khac'
  | 'da_diem_danh_buoi_dang_hoc';

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

/** GET /doi-buoi-hoc/bo-loc: chỉ khóa/cụm/lớp có đề nghị trong phạm vi người duyệt. */
export interface BoLocDoiBuoi {
  khoa: {
    id: string;
    ma_khoa: string;
    ten_khoa: string;
    thoi_gian_bat_dau: Date;
    thoi_gian_ket_thuc: Date;
  }[];
  cum: { id: string; ten_cum: string; khoa_id: string }[];
  lop: { id: string; ten_lop: string; khoa_id: string }[];
}

/** Thu hẹp quaHanThem theo đăng ký (khóa / cụm) — chỉ dùng khi tập kết quả cũng đã lọc như vậy. */
interface PhamViQuaHan {
  khoaId?: string;
  cumIds?: string[] | null;
}

interface DeNghiRow {
  id: string;
  trang_thai: trang_thai_de_nghi;
  loai?: loai_doi_buoi;
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
const TIN_HOC_BU_TAT = 'Khóa học chưa mở đăng ký học bù';
// ADR 0012: tổng quan học viên chỉ xét 30 buổi đã qua gần nhất cho học bù.
const SO_BUOI_DA_QUA = 30;
// Tab Đã xử lý: phân trang 50 dòng (?trang=).
export const TRANG_DA_XU_LY = 50;
// Ô tìm học viên: ngắn hơn thì bỏ qua.
const TIM_TOI_THIEU = 2;
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
    const cauHinh = await this.cauHinhKhoa(khoaId);
    if (cauHinh.doi <= 0 && cauHinh.hocBu <= 0)
      throw new ForbiddenAppException(TIN_KHOA_TAT);
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
    const capLop = phanLop.map((p) => ({
      lop_id: p.lop_id,
      giai_doan_id: p.giai_doan_id,
    }));
    // ADR 0012: buổi đã qua (học bù) chỉ đọc khi khóa bật học bù.
    const [lichSapToi, lichDaQua] = await Promise.all([
      capLop.length && cauHinh.doi > 0
        ? this.prisma.lich_hoc_lop.findMany({
            where: { thoi_gian_bat_dau: { gt: now }, OR: capLop },
            orderBy: { thoi_gian_bat_dau: 'asc' },
            select: LICH_TOM_TAT_SELECT,
          })
        : Promise.resolve([]),
      capLop.length && cauHinh.hocBu > 0
        ? this.prisma.lich_hoc_lop.findMany({
            where: { thoi_gian_bat_dau: { lte: now }, OR: capLop },
            orderBy: { thoi_gian_bat_dau: 'desc' },
            take: SO_BUOI_DA_QUA,
            select: LICH_TOM_TAT_SELECT,
          })
        : Promise.resolve([]),
    ]);
    const diemDanhDaQua = lichDaQua.length
      ? await this.prisma.diem_danh.findMany({
          where: {
            dang_ky_hoc_id: dangKy.id,
            lich_hoc_id: { in: lichDaQua.map((l) => l.id) },
          },
          select: { lich_hoc_id: true, trang_thai: true },
        })
      : [];
    // ADR 0014: buổi đã được công nhận có mặt từ lớp khác → không học bù.
    const coMatLopKhac = await napBuoiGocCoMatLopKhac(
      this.prisma,
      dangKy.id,
      lichDaQua,
    );

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
    const quaHanThem = coCho
      ? await this.quaHanThem(now, this.prisma, [dangKy.id])
      : new Map<string, LyDoQuaHan>();
    const deNghi = deNghiRows.map((d) =>
      this.anhXaDeNghi(d, lichMap, now, hang, chotCu, lichDk, quaHanThem),
    );
    const theoNguon = (loai: loai_doi_buoi, tt: trang_thai_de_nghi) =>
      new Map(
        deNghi
          .filter((d) => d.loai === loai && d.trang_thai === tt)
          .map((d) => [d.lich_nguon_id, d]),
      );
    const daDuyet = theoNguon('doi_buoi', 'da_duyet');
    const choDuyet = theoNguon('doi_buoi', 'cho_duyet');
    const hocBuDaDuyet = theoNguon('hoc_bu', 'da_duyet');
    const hocBuCho = theoNguon('hoc_bu', 'cho_duyet');
    const ttDiemDanh = new Map(
      diemDanhDaQua.map((d) => [d.lich_hoc_id, d.trang_thai]),
    );
    return {
      so_buoi_doi_toi_da: cauHinh.doi,
      so_luot_da_dung: soLuotDaDung(deNghiRows),
      so_buoi_hoc_bu_toi_da: cauHinh.hocBu,
      so_luot_hoc_bu_da_dung: soLuotDaDung(deNghiRows, 'hoc_bu'),
      // B2 + B6: buổi đã qua, không có mặt, không có đổi buổi đã duyệt.
      buoi_co_the_hoc_bu: lichDaQua
        .filter(
          (l) =>
            ttDiemDanh.get(l.id) !== 'co_mat' &&
            !coMatLopKhac.has(l.id) &&
            !daDuyet.has(l.id),
        )
        .map((l) => {
          const duyet = hocBuDaDuyet.get(l.id) ?? null;
          const cho = hocBuCho.get(l.id) ?? null;
          return {
            lich_nguon: l,
            trang_thai_diem_danh: ttDiemDanh.get(l.id) ?? null,
            de_nghi: duyet ?? cho,
            de_nghi_doi_lai: duyet ? cho : null,
          };
        }),
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
    loai: loai_doi_buoi = 'doi_buoi',
  ): Promise<LuaChonBuoi[]> {
    const hocVienId = this.assertHocVienId(user);
    const nguon = (await this.query.lichTomTat([lichNguonId])).get(lichNguonId);
    if (!nguon) throw new NotFoundAppException('Không tìm thấy buổi học');
    const dangKy = await this.dangKyCuaCaller(
      hocVienId,
      nguon.lop.khoa_id,
      'Không tìm thấy buổi học',
    );
    await this.luotToiDa(nguon.lop.khoa_id, loai);
    const phanLop = await this.prisma.phan_lop_giai_doan.findFirst({
      where: { dang_ky_hoc_id: dangKy.id, giai_doan_id: nguon.giai_doan_id },
      select: { lop_id: true },
    });
    if (phanLop?.lop_id !== nguon.lop_id)
      throw new NotFoundAppException('Không tìm thấy buổi học');
    const now = new Date();
    const chot =
      loai === 'hoc_bu'
        ? await this.kiemTraNguonHocBu(dangKy.id, nguon, now)
        : await this.kiemTraNguonDoiBuoi(dangKy.id, nguon, now);
    const ds = await this.luaChonTuongDuong(nguon, now, dangKy.id);
    return chot ? ds.filter((x) => x.lich.id !== chot) : ds;
  }

  // Đổi buổi: buổi nguồn chưa bắt đầu, chưa điểm danh (D2, D12). Trả buổi chốt hiện tại.
  private async kiemTraNguonDoiBuoi(
    dangKyId: string,
    nguon: LichTomTat,
    now: Date,
  ): Promise<string | null> {
    if (daBatDau(nguon, now))
      this.nem({
        ok: false,
        ma: 'DA_BAT_DAU',
        thong_diep: 'Buổi đã bắt đầu, không thể đổi',
      });
    const chot = await this.chotDaDuyet(dangKyId, nguon.id);
    // D12: đã điểm danh ở buổi nguồn (hoặc buổi đang học nếu đổi lại) → không đổi.
    const daDiemDanh = await this.prisma.diem_danh.findFirst({
      where: {
        dang_ky_hoc_id: dangKyId,
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
    return chot;
  }

  // ADR 0012 B2/B6: buổi gốc đã bắt đầu, không có mặt, chưa có đổi buổi đã
  // duyệt; đổi lại học bù → D12 ở buổi chốt hiện tại. Trả buổi chốt hiện tại.
  private async kiemTraNguonHocBu(
    dangKyId: string,
    nguon: LichTomTat,
    now: Date,
  ): Promise<string | null> {
    if (!daBatDau(nguon, now))
      this.nem({
        ok: false,
        ma: 'CHUA_DIEN_RA',
        thong_diep: 'Buổi này chưa diễn ra — hãy dùng đổi buổi',
      });
    const ban = await this.prisma.doi_buoi_hoc.findFirst({
      where: {
        dang_ky_hoc_id: dangKyId,
        lich_nguon_id: nguon.id,
        trang_thai: 'da_duyet',
      },
      select: { loai: true, lich_chot_id: true },
    });
    const laHocBu = ban?.loai === 'hoc_bu';
    const chot = laHocBu ? ban.lich_chot_id : null;
    const diemDanh = await this.prisma.diem_danh.findMany({
      where: {
        dang_ky_hoc_id: dangKyId,
        lich_hoc_id: { in: chot ? [nguon.id, chot] : [nguon.id] },
      },
      select: { lich_hoc_id: true, trang_thai: true },
    });
    if (diemDanh.some((d) => d.lich_hoc_id === nguon.id && d.trang_thai === 'co_mat'))
      this.nem({
        ok: false,
        ma: 'DA_CO_MAT',
        thong_diep: 'Thầy/Cô đã có mặt buổi này, không cần học bù',
      });
    if (ban && !laHocBu)
      this.nem({
        ok: false,
        ma: 'DA_DOI_BUOI',
        thong_diep: 'Buổi này đã được đổi, liên hệ người hỗ trợ',
      });
    if (chot && diemDanh.some((d) => d.lich_hoc_id === chot))
      this.nem({
        ok: false,
        ma: 'DA_DIEM_DANH',
        thong_diep: 'Thầy/Cô đã điểm danh buổi này, không thể đổi',
      });
    return chot;
  }

  async gui(user: AuthenticatedUser, dto: GuiDoiBuoiDto) {
    const hocVienId = this.assertHocVienId(user);
    const { nguon, dich } = await this.taiHaiBuoi(dto);
    const dangKy = await this.dangKyCuaCaller(
      hocVienId,
      nguon.lop.khoa_id,
      'Không tìm thấy buổi học',
    );
    const loai = dto.loai ?? 'doi_buoi';
    const soBuoiToiDa = await this.luotToiDa(nguon.lop.khoa_id, loai);
    const { moi, tuHuyId } = await this.taoTrongGiaoDich({
      dangKyId: dangKy.id,
      loai,
      soBuoiToiDa,
      nguon,
      dich,
      dto,
      nguoiTao: user.id,
      huyId: null,
    });
    await this.ghiNhatKyGui(hocVienId, moTaTheoLoai(loai, 'Gửi'), {
      de_nghi_id: moi.id,
      lich_nguon_id: dto.lich_nguon_id,
      lich_de_nghi_id: dto.lich_de_nghi_id,
      ...chiTietLoai(loai),
    });
    await this.ghiNhatKyTuHuy(hocVienId, tuHuyId);
    return moi;
  }

  async sua(user: AuthenticatedUser, id: string, dto: GuiDoiBuoiDto) {
    const hocVienId = this.assertHocVienId(user);
    const cu = await this.taiDeNghiCuaCaller(hocVienId, id);
    if (cu.lich_nguon_id !== dto.lich_nguon_id)
      throw new ValidationException(
        'Không đổi được buổi nguồn khi sửa đề nghị',
      );
    const loai = cu.loai ?? 'doi_buoi';
    if (dto.loai && dto.loai !== loai)
      throw new ValidationException('Không đổi được loại đề nghị khi sửa');
    const soBuoiToiDa = await this.luotToiDa(cu.dang_ky_hoc.khoa_id, loai);
    const { nguon, dich } = await this.taiHaiBuoi(dto);
    const { moi, tuHuyId } = await this.taoTrongGiaoDich({
      dangKyId: cu.dang_ky_hoc_id,
      loai,
      soBuoiToiDa,
      nguon,
      dich,
      dto,
      nguoiTao: user.id,
      huyId: id,
    });
    await this.ghiNhatKyGui(hocVienId, moTaTheoLoai(loai, 'Sửa'), {
      de_nghi_id: moi.id,
      de_nghi_cu_id: id,
      lich_nguon_id: dto.lich_nguon_id,
      lich_de_nghi_id: dto.lich_de_nghi_id,
      ...chiTietLoai(loai),
    });
    await this.ghiNhatKyTuHuy(hocVienId, tuHuyId);
    return moi;
  }

  async huyHocVien(user: AuthenticatedUser, id: string) {
    const hocVienId = this.assertHocVienId(user);
    const cu = await this.taiDeNghiCuaCaller(hocVienId, id);
    const loai = cu.loai ?? 'doi_buoi';
    await this.luotToiDa(cu.dang_ky_hoc.khoa_id, loai);
    const { count } = await this.prisma.doi_buoi_hoc.updateMany({
      where: { id, trang_thai: 'cho_duyet', dang_ky_hoc_id: cu.dang_ky_hoc_id },
      data: {
        trang_thai: 'da_huy',
        xu_ly_luc: new Date(),
        ghi_chu_xu_ly: GHI_CHU_HOC_VIEN_HUY,
      },
    });
    if (!count) throw new ConflictAppException('Đề nghị đã được xử lý');
    await this.ghiNhatKyGui(hocVienId, moTaTheoLoai(loai, 'Hủy'), {
      de_nghi_id: id,
      huy: true,
      ...chiTietLoai(loai),
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
    // cum_id ngoài phạm vi cụm của ho_tro → rỗng (không lộ cụm khác).
    if (q.cum_id && cumIds && !cumIds.includes(q.cum_id)) return [];
    const cumLoc = q.cum_id ? [q.cum_id] : cumIds;
    // Tập quá hạn chỉ dùng để loại/gắn nhãn dòng của chính danh sách này → thu
    // hẹp cùng khóa/cụm, không quét cho_duyet toàn hệ thống.
    const phamVi: PhamViQuaHan = { khoaId: q.khoa_id, cumIds: cumLoc };
    const now = new Date();
    // Tab Chờ duyệt: đề nghị quá hạn không bao giờ tự đóng (D7) → tách riêng
    // để không chiếm 500 chỗ đầu của danh sách sắp tao_luc tăng dần.
    const choDuyet = !q.da_xu_ly && q.trang_thai === 'cho_duyet';
    const quaHan = choDuyet && q.qua_han === true;
    // Đổi lại có buổi đang học đã bắt đầu, hoặc đã điểm danh (D12), cũng quá hạn.
    const quaHanCho = choDuyet
      ? await this.quaHanThem(now, this.prisma, undefined, phamVi)
      : new Map<string, LyDoQuaHan>();
    const doiLaiQuaHan = [...quaHanCho.keys()];
    const locHan: Prisma.doi_buoi_hocWhereInput = !choDuyet
      ? {}
      : quaHan
        ? {
            OR: [
              // ADR 0012: buổi gốc đã bắt đầu chỉ làm quá hạn đổi buổi.
              {
                loai: 'doi_buoi',
                lich_nguon: { thoi_gian_bat_dau: { lte: now } },
              },
              { lich_de_nghi: { thoi_gian_bat_dau: { lte: now } } },
              ...(doiLaiQuaHan.length ? [{ id: { in: doiLaiQuaHan } }] : []),
            ],
          }
        : {
            ...nguonConHan(now),
            lich_de_nghi: { thoi_gian_bat_dau: { gt: now } },
            ...(doiLaiQuaHan.length ? { id: { notIn: doiLaiQuaHan } } : {}),
          };
    const locThem = await this.locLopVaHocVien(q);
    const trang = q.trang ?? 1;
    const rows = await this.prisma.doi_buoi_hoc.findMany({
      where: {
        ...(q.da_xu_ly
          ? { trang_thai: { in: ['da_duyet', 'tu_choi', 'da_huy'] as trang_thai_de_nghi[] } }
          : q.trang_thai
            ? { trang_thai: q.trang_thai }
            : {}),
        ...(q.loai ? { loai: q.loai } : {}),
        ...locHan,
        dang_ky_hoc: {
          ...(cumLoc ? { cum_id: { in: cumLoc } } : {}),
          ...(q.khoa_id ? { khoa_id: q.khoa_id } : {}),
        },
        ...(locThem.length ? { AND: locThem } : {}),
      },
      // Chờ duyệt (còn hạn lẫn quá hạn): gửi trước lên đầu. Đã xử lý: thêm id
      // để phân trang ổn định.
      orderBy: q.da_xu_ly
        ? [{ xu_ly_luc: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }]
        : !q.trang_thai
          ? { tao_luc: 'desc' }
          : q.trang_thai === 'cho_duyet'
            ? { tao_luc: 'asc' }
            : { xu_ly_luc: { sort: 'desc', nulls: 'last' } },
      take: q.da_xu_ly ? TRANG_DA_XU_LY : quaHan ? 100 : 500,
      ...(q.da_xu_ly && trang > 1
        ? { skip: (trang - 1) * TRANG_DA_XU_LY }
        : {}),
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
    const quaHanThem = choDuyet
      ? quaHanCho
      : rows.some((r) => r.trang_thai === 'cho_duyet')
        ? await this.quaHanThem(now, this.prisma, undefined, phamVi)
        : new Map<string, LyDoQuaHan>();
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

  async demChoDuyet(
    user: AuthenticatedUser,
    loai?: loai_doi_buoi,
  ): Promise<number> {
    const cumIds = await this.cumPhamVi(user);
    if (cumIds?.length === 0) return 0;
    const now = new Date();
    // Badge giữ phạm vi người dùng; quá hạn thêm chỉ xét cụm của mình.
    const doiLaiQuaHan = await this.idQuaHanThem(
      now,
      this.prisma,
      undefined,
      cumIds ? { cumIds } : undefined,
    );
    return this.prisma.doi_buoi_hoc.count({
      where: {
        trang_thai: 'cho_duyet',
        ...(loai ? { loai } : {}),
        ...(doiLaiQuaHan.length ? { id: { notIn: doiLaiQuaHan } } : {}),
        ...(cumIds ? { dang_ky_hoc: { cum_id: { in: cumIds } } } : {}),
        ...nguonConHan(now),
        lich_de_nghi: { thoi_gian_bat_dau: { gt: now } },
      },
    });
  }

  // Bộ lọc màn duyệt: 3 truy vấn cố định (không N+1), cùng phạm vi cụm với danhSach.
  async boLoc(user: AuthenticatedUser): Promise<BoLocDoiBuoi> {
    const cumIds = await this.cumPhamVi(user);
    if (cumIds?.length === 0) return { khoa: [], cum: [], lop: [] };
    const dangKy: Prisma.dang_ky_hocWhereInput = cumIds
      ? { cum_id: { in: cumIds } }
      : {};
    const deNghi: Prisma.Doi_buoi_hocListRelationFilter = {
      some: cumIds ? { dang_ky_hoc: dangKy } : {},
    };
    const [khoa, cum, lop] = await Promise.all([
      this.prisma.khoa_boi_duong.findMany({
        where: {
          dang_ky_hoc: { some: { ...dangKy, doi_buoi_hoc: { some: {} } } },
        },
        select: {
          id: true,
          ma_khoa: true,
          ten_khoa: true,
          thoi_gian_bat_dau: true,
          thoi_gian_ket_thuc: true,
        },
        orderBy: { thoi_gian_bat_dau: 'desc' },
      }),
      this.prisma.cum_hoc_vien.findMany({
        where: {
          ...(cumIds ? { id: { in: cumIds } } : {}),
          dang_ky_hoc: { some: { doi_buoi_hoc: { some: {} } } },
        },
        select: { id: true, ten_cum: true, khoa_id: true },
        orderBy: { ten_cum: 'asc' },
      }),
      this.prisma.lop_hoc.findMany({
        where: {
          lich_hoc: {
            some: {
              OR: [{ doi_buoi_nguon: deNghi }, { doi_buoi_de_nghi: deNghi }],
            },
          },
        },
        select: { id: true, ten_lop: true, khoa_id: true },
        orderBy: { ten_lop: 'asc' },
      }),
    ]);
    return { khoa, cum, lop };
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
    // ADR 0012: học bù không đòi buổi gốc chưa bắt đầu.
    const nguonConHanDuyet = dn.loai === 'hoc_bu' || !daBatDau(nguon, now);
    return ds.map((x) => {
      const so_truoc = dem.get(x.lich.id) ?? 0;
      return {
        ...x,
        so_truoc,
        duyet_duoc:
          nguonConHanDuyet &&
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
    const loai = dn.loai ?? 'doi_buoi';
    const now = new Date();
    const kq = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'doi_buoi:' + lichChotId}))`;
      const hienTai = await tx.doi_buoi_hoc.findUnique({
        where: { id },
        select: { trang_thai: true, tao_luc: true },
      });
      if (!hienTai) throw new NotFoundAppException('Không tìm thấy đề nghị');
      // D11: bản đã duyệt cùng (đăng ký, buổi nguồn) → đề nghị này là đổi lại.
      const banTruoc = await tx.doi_buoi_hoc.findFirst({
        where: {
          dang_ky_hoc_id: dn.dang_ky_hoc_id,
          lich_nguon_id: dn.lich_nguon_id,
          trang_thai: 'da_duyet',
          id: { not: id },
        },
        select: { id: true, lich_chot_id: true, loai: true },
      });
      // ADR 0012 B6: bản đã duyệt KHÁC loại không bị thay (học bù → DA_DOI_BUOI).
      const banCu =
        banTruoc && (banTruoc.loai ?? 'doi_buoi') === loai ? banTruoc : null;
      // D12: đã điểm danh ở buổi nguồn / buổi chốt cũ (đổi lại) → không đổi.
      // Học bù: trạng thái ở buổi gốc đọc lại trong tx (DA_CO_MAT).
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
        select: { lich_hoc_id: true, trang_thai: true },
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
      const coMatLopKhac =
        loai === 'hoc_bu'
          ? await napBuoiGocCoMatLopKhac(tx, dn.dang_ky_hoc_id, [nguon])
          : new Set<string>();
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
          loai,
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
          trang_thai_diem_danh_nguon: coMatLopKhac.has(dn.lich_nguon_id)
            ? 'co_mat'
            : (diemDanh.find((d) => d.lich_hoc_id === dn.lich_nguon_id)
                ?.trang_thai ?? null),
          nguon_co_doi_buoi_da_duyet: !!banTruoc && !banCu,
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
    await this.ghiNhatKyDuyet(
      dn.dang_ky_hoc.hoc_vien_id,
      loai === 'hoc_bu' ? 'Duyệt học bù' : 'Duyệt đổi buổi',
      {
        de_nghi_id: id,
        lich_nguon_id: dn.lich_nguon_id,
        lich_de_nghi_id: dn.lich_de_nghi_id,
        lich_chot_id: lichChotId,
        vuot_si_so: kq.vuot_si_so,
        vuot_thu_tu: kq.vuot_thu_tu,
        ...(kq.thay_the_id ? { thay_the_id: kq.thay_the_id } : {}),
        ...chiTietLoai(loai),
      },
    );
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
    const loai = dn.loai ?? 'doi_buoi';
    await this.ghiNhatKyDuyet(
      dn.dang_ky_hoc.hoc_vien_id,
      moTaTheoLoai(loai, 'Từ chối'),
      { de_nghi_id: id, tu_choi: true, ...chiTietLoai(loai) },
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
    const loai = dn.loai ?? 'doi_buoi';
    // ADR 0012: học bù — buổi gốc đã qua, học viên vẫn thuộc buổi gốc (spec §5)
    // → chỉ xét buổi chốt, không đọc sĩ số buổi gốc.
    const hocBu = loai === 'hoc_bu';
    const now = new Date();
    // Hủy duyệt đưa học viên về buổi nguồn → khóa CÙNG namespace với duyệt
    // (doi_buoi:<lich>) theo buổi nguồn, rồi mới đọc sĩ số buổi nguồn.
    const kq = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'doi_buoi:' + dn.lich_nguon_id}))`;
      const lichMap = await this.query.lichTomTat(
        [dn.lich_nguon_id, lichChotId],
        tx,
      );
      const xet = hocBu ? [lichChotId] : [dn.lich_nguon_id, lichChotId];
      const daBatDauMot = xet.some((lid) => {
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
      const nguon = hocBu ? undefined : lichMap.get(dn.lich_nguon_id);
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
      hocBu ? 'Hủy duyệt học bù' : 'Hủy duyệt đổi buổi',
      {
        de_nghi_id: id,
        huy_duyet: true,
        vuot_si_so: kq.vuot_si_so,
        ...chiTietLoai(loai),
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
        loai: true,
        dang_ky_hoc: { select: { hoc_vien_id: true } },
      },
    });
    if (!dn) throw new NotFoundAppException('Không tìm thấy đề nghị');
    return dn;
  }

  // Đề nghị cho_duyet gửi trước đề nghị này, buổi đề nghị chưa bắt đầu; buổi
  // nguồn chưa bắt đầu (đổi buổi) — học bù không xét buổi gốc (ADR 0012).
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
      ...nguonConHan(now),
      lich_de_nghi: { thoi_gian_bat_dau: { gt: now } },
    };
  }

  // Id đề nghị chờ quá hạn ngoài điều kiện thời gian của chính nó (quá hạn như
  // buổi nguồn/đề nghị đã bắt đầu): đổi lại có buổi đang học (chốt của bản đã
  // duyệt) đã bắt đầu; hoặc học viên đã có điểm danh ở buổi nguồn / buổi đang
  // học (D12). Chỉ xét đề nghị có buổi nguồn và buổi đề nghị CHƯA bắt đầu: đề
  // nghị đã bắt đầu đã quá hạn theo thời gian → tập id nhỏ, không phình theo thời
  // gian. 1 truy vấn gộp; dangKyIds để lọc khi chỉ cần 1 học viên.
  // ADR 0012 — nhánh học bù (c.loai = 'hoc_bu'): chỉ đòi buổi học bù CHƯA bắt
  // đầu (buổi gốc luôn đã qua, không xét giờ buổi gốc); quá hạn thêm khi học
  // viên đã được ghi co_mat ở buổi gốc (DA_CO_MAT), khi cùng buổi gốc có bản
  // da_duyet KHÁC loại (đổi buổi → DA_DOI_BUOI), hoặc đổi lại có buổi học bù
  // đang giữ đã bắt đầu / đã điểm danh. Nhánh đổi buổi giữ nguyên như trên.
  // phamVi (khóa/cụm của đăng ký) chỉ dùng khi tập kết quả cũng lọc như vậy;
  // whereChoTruoc (hàng chờ của 1 buổi, mọi cụm) phải dùng tập không thu hẹp.
  private async idQuaHanThem(
    now: Date,
    db: Db = this.prisma,
    dangKyIds?: string[],
    phamVi?: PhamViQuaHan,
  ): Promise<string[]> {
    return [...(await this.quaHanThem(now, db, dangKyIds, phamVi)).keys()];
  }

  // Như idQuaHanThem, kèm lý do: CASE xét lần lượt điểm danh buổi gốc → bản đã
  // duyệt khác loại → buổi đang học đã bắt đầu → còn lại (đã điểm danh buổi đang học).
  private async quaHanThem(
    now: Date,
    db: Db = this.prisma,
    dangKyIds?: string[],
    phamVi?: PhamViQuaHan,
  ): Promise<Map<string, LyDoQuaHan>> {
    const loc = dangKyIds
      ? Prisma.sql`AND c.dang_ky_hoc_id = ANY(${dangKyIds}::uuid[])`
      : Prisma.empty;
    const joinPhamVi =
      phamVi?.khoaId || phamVi?.cumIds
        ? Prisma.sql`JOIN dang_ky_hoc k ON k.id = c.dang_ky_hoc_id${
            phamVi.khoaId
              ? Prisma.sql` AND k.khoa_id = ${phamVi.khoaId}::uuid`
              : Prisma.empty
          }${
            phamVi.cumIds
              ? Prisma.sql` AND k.cum_id = ANY(${phamVi.cumIds}::uuid[])`
              : Prisma.empty
          }`
        : Prisma.empty;
    const rows = await db.$queryRaw<{ id: string; ly_do?: LyDoQuaHan }[]>`
      SELECT c.id, CASE
        WHEN EXISTS (SELECT 1 FROM diem_danh dd
          WHERE dd.dang_ky_hoc_id = c.dang_ky_hoc_id
            AND dd.lich_hoc_id = c.lich_nguon_id
            AND (c.loai = 'doi_buoi' OR dd.trang_thai = 'co_mat'))
          THEN CASE WHEN c.loai = 'hoc_bu' THEN 'da_co_mat'
            ELSE 'da_diem_danh_buoi_goc' END
        WHEN EXISTS (SELECT 1 FROM doi_buoi_hoc d
          WHERE d.dang_ky_hoc_id = c.dang_ky_hoc_id
            AND d.lich_nguon_id = c.lich_nguon_id AND d.trang_thai = 'da_duyet'
            AND d.loai <> c.loai)
          THEN 'buoi_goc_da_duyet_khac'
        WHEN EXISTS (SELECT 1 FROM doi_buoi_hoc d
          JOIN lich_hoc_lop l ON l.id = d.lich_chot_id
          WHERE d.dang_ky_hoc_id = c.dang_ky_hoc_id
            AND d.lich_nguon_id = c.lich_nguon_id AND d.trang_thai = 'da_duyet'
            AND l.thoi_gian_bat_dau <= ${now})
          THEN 'buoi_dang_hoc_bat_dau'
        ELSE 'da_diem_danh_buoi_dang_hoc'
      END AS ly_do
      FROM doi_buoi_hoc c
      JOIN lich_hoc_lop ln ON ln.id = c.lich_nguon_id
      JOIN lich_hoc_lop ld ON ld.id = c.lich_de_nghi_id
      ${joinPhamVi}
      WHERE c.trang_thai = 'cho_duyet' ${loc}
        AND (c.loai = 'hoc_bu' OR ln.thoi_gian_bat_dau > ${now})
        AND ld.thoi_gian_bat_dau > ${now} AND (
        EXISTS (SELECT 1 FROM diem_danh dd
          WHERE dd.dang_ky_hoc_id = c.dang_ky_hoc_id
            AND dd.lich_hoc_id = c.lich_nguon_id
            AND (c.loai = 'doi_buoi' OR dd.trang_thai = 'co_mat'))
        OR EXISTS (SELECT 1 FROM doi_buoi_hoc d
          JOIN lich_hoc_lop l ON l.id = d.lich_chot_id
          WHERE d.dang_ky_hoc_id = c.dang_ky_hoc_id
            AND d.lich_nguon_id = c.lich_nguon_id AND d.trang_thai = 'da_duyet'
            AND (d.loai <> c.loai OR l.thoi_gian_bat_dau <= ${now} OR EXISTS (
              SELECT 1 FROM diem_danh dd
              WHERE dd.dang_ky_hoc_id = c.dang_ky_hoc_id
                AND dd.lich_hoc_id = d.lich_chot_id))))`;
    return new Map(
      rows.map((r) => [r.id, r.ly_do ?? 'da_diem_danh_buoi_dang_hoc']),
    );
  }

  // Lọc thêm của danhSach: lớp (gốc HOẶC đề nghị) + tìm học viên (họ tên không
  // dấu hoặc mã MOET thiếu số 0 đầu — cùng cách Tình hình đi học).
  private async locLopVaHocVien(
    q: LocDoiBuoiDto,
  ): Promise<Prisma.doi_buoi_hocWhereInput[]> {
    const loc: Prisma.doi_buoi_hocWhereInput[] = [];
    if (q.lop_id)
      loc.push({
        OR: [
          { lich_nguon: { lop_id: q.lop_id } },
          { lich_de_nghi: { lop_id: q.lop_id } },
        ],
      });
    const tu = q.q?.trim() ?? '';
    if (tu.length < TIM_TOI_THIEU) return loc;
    // Tìm theo tên chỉ khi có khoa_id (không quét toàn bảng hoc_vien); mã MOET luôn xét.
    const dk = q.khoa_id ? dieuKienKhongDau(Prisma.sql`h.ho_ten`, tu) : null;
    const idsTheoTen = dk
      ? (
          await this.prisma.$queryRaw<{ id: string }[]>(
            Prisma.sql`SELECT h.id FROM "hoc_vien" h
              JOIN "dang_ky_hoc" d ON d.hoc_vien_id = h.id
              WHERE d.khoa_id = ${q.khoa_id}::uuid AND ${dk}`,
          )
        ).map((r) => r.id)
      : [];
    loc.push({
      dang_ky_hoc: {
        OR: [
          { hoc_vien_id: { in: idsTheoTen } },
          {
            hoc_vien: {
              ma_dinh_danh_moet: {
                contains: boSo0DauDeTimKiem(tu),
                mode: 'insensitive',
              },
            },
          },
        ],
      },
    });
    return loc;
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

  private async cauHinhKhoa(
    khoaId: string,
  ): Promise<{ doi: number; hocBu: number }> {
    const khoa = await this.prisma.khoa_boi_duong.findUnique({
      where: { id: khoaId },
      select: { so_buoi_doi_toi_da: true, so_buoi_hoc_bu_toi_da: true },
    });
    return {
      doi: khoa?.so_buoi_doi_toi_da ?? 0,
      hocBu: khoa?.so_buoi_hoc_bu_toi_da ?? 0,
    };
  }

  // Công tắc + lượt tối đa theo loại (ADR 0012 B4); 0 → 403.
  private async luotToiDa(
    khoaId: string,
    loai: loai_doi_buoi,
  ): Promise<number> {
    const cauHinh = await this.cauHinhKhoa(khoaId);
    const toiDa = loai === 'hoc_bu' ? cauHinh.hocBu : cauHinh.doi;
    if (toiDa <= 0)
      throw new ForbiddenAppException(
        loai === 'hoc_bu' ? TIN_HOC_BU_TAT : TIN_KHOA_TAT,
      );
    return toiDa;
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
        loai: true,
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
    loai: loai_doi_buoi;
    /** Lượt tối đa của đúng loại x.loai. */
    soBuoiToiDa: number;
    nguon: LichTomTat;
    dich: LichTomTat;
    dto: GuiDoiBuoiDto;
    nguoiTao: string;
    huyId: string | null;
  }): Promise<{ moi: { id: string }; tuHuyId: string | null }> {
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
          select: {
            id: true,
            lich_nguon_id: true,
            trang_thai: true,
            lich_chot_id: true,
            loai: true,
          },
        });
        // Buổi nguồn đang gửi không tính vào lượt đã dùng: đổi lại (D11) không
        // tốn thêm lượt; đề nghị chờ thứ 2 cùng buổi nguồn bị unique chặn (409).
        // ADR 0012 B4: lượt đếm theo loại.
        const soLuot = soLuotDaDung(
          hoatDong.filter((d) => d.lich_nguon_id !== x.nguon.id),
          x.loai,
        );
        const cungLoai = (d: { loai?: loai_doi_buoi }) =>
          (d.loai ?? 'doi_buoi') === x.loai;
        const banNguon = hoatDong.filter(
          (d) => d.lich_nguon_id === x.nguon.id && d.trang_thai === 'da_duyet',
        );
        const chotCuId = banNguon.find(cungLoai)?.lich_chot_id;
        const chotCu = chotCuId
          ? ((await this.query.lichTomTat([chotCuId], tx)).get(chotCuId) ?? null)
          : null;
        // D12: điểm danh ở buổi nguồn + buổi chốt hiện tại (đổi lại) — 1 truy vấn.
        const diemDanh = await tx.diem_danh.findMany({
          where: {
            dang_ky_hoc_id: x.dangKyId,
            lich_hoc_id: { in: chotCuId ? [x.nguon.id, chotCuId] : [x.nguon.id] },
          },
          select: { lich_hoc_id: true, trang_thai: true },
        });
        const daDiemDanh = new Set(diemDanh.map((d) => d.lich_hoc_id));
        const coMatLopKhac =
          x.loai === 'hoc_bu'
            ? await napBuoiGocCoMatLopKhac(tx, x.dangKyId, [x.nguon])
            : new Set<string>();
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
              loai: x.loai,
              // soBuoiToiDa + soLuot đã là giá trị của đúng loại x.loai; hàm
              // thuần chỉ đọc cặp trường của loại đó.
              so_buoi_doi_toi_da: x.soBuoiToiDa,
              so_luot_da_dung: soLuot,
              so_buoi_hoc_bu_toi_da: x.soBuoiToiDa,
              so_luot_hoc_bu_da_dung: soLuot,
              buoi_nguon: x.nguon,
              buoi_dich: x.dich,
              lop_phan_hien_tai: phanLop?.lop_id ?? null,
              si_so_dich: siSo.get(x.dich.id)?.si_so ?? 0,
              ly_do: x.dto.ly_do,
              buoi_chot_hien_tai: chotCu,
              da_diem_danh_nguon: daDiemDanh.has(x.nguon.id),
              da_diem_danh_chot: !!chotCuId && daDiemDanh.has(chotCuId),
              trang_thai_diem_danh_nguon: coMatLopKhac.has(x.nguon.id)
                ? 'co_mat'
                : (diemDanh.find((d) => d.lich_hoc_id === x.nguon.id)
                    ?.trang_thai ?? null),
              // B6: kiểm TRƯỚC khi chạm unique uq_doi_buoi_* → 400, không 409/500.
              nguon_co_doi_buoi_da_duyet: banNguon.some((d) => !cungLoai(d)),
            },
            now,
          ),
        );
        // Học bù: đổi buổi cho_duyet cùng buổi gốc (đã quá hạn vì buổi gốc đã
        // bắt đầu — bất biến do CHUA_DIEN_RA của kiemTraGui ở trên bảo đảm) bị
        // tự hủy để không vướng unique uq_doi_buoi_cho (409).
        const doiBuoiCho =
          x.loai === 'hoc_bu'
            ? hoatDong.find(
                (d) =>
                  d.lich_nguon_id === x.nguon.id &&
                  d.trang_thai === 'cho_duyet' &&
                  (d.loai ?? 'doi_buoi') === 'doi_buoi',
              )
            : undefined;
        if (doiBuoiCho) {
          const { count } = await tx.doi_buoi_hoc.updateMany({
            where: {
              id: doiBuoiCho.id,
              trang_thai: 'cho_duyet',
              loai: 'doi_buoi',
              dang_ky_hoc_id: x.dangKyId,
            },
            data: {
              trang_thai: 'da_huy',
              xu_ly_luc: now,
              ghi_chu_xu_ly: GHI_CHU_TU_HUY_QUA_HAN,
              nguoi_xu_ly: null,
            },
          });
          if (!count)
            throw new ConflictAppException(
              'Đề nghị đổi buổi của buổi này vừa thay đổi, vui lòng thử lại',
            );
        }
        const moi = await tx.doi_buoi_hoc.create({
          data: {
            dang_ky_hoc_id: x.dangKyId,
            lich_nguon_id: x.dto.lich_nguon_id,
            lich_de_nghi_id: x.dto.lich_de_nghi_id,
            ly_do: chuanHoaLyDo(x.dto.ly_do) as string,
            nguoi_tao: x.nguoiTao,
            loai: x.loai,
          },
          select: { id: true },
        });
        return { moi, tuHuyId: doiBuoiCho?.id ?? null };
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
  // buổi nguồn đã đổi (da_duyet còn hiệu lực) thay bằng buổi chốt; học bù thêm
  // buổi chốt bên cạnh buổi nguồn. Mỗi buổi gắn
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
      doi.map((d) => [capKey(d.dang_ky_hoc_id, d.lich_nguon_id), d]),
    );
    for (const p of phanLop) {
      const ds = kq.get(p.dang_ky_hoc_id) ?? [];
      for (const l of theoLop.get(lopKey(p.lop_id, p.giai_doan_id)) ?? []) {
        const d = doiTheoCap.get(capKey(p.dang_ky_hoc_id, l.id));
        // Đổi buổi: buổi chốt THAY buổi nguồn. Học bù: buổi nguồn giữ nguyên,
        // buổi chốt là ô THÊM (cùng nguon_id để đổi lại bỏ qua được nó).
        const cacBuoi = !d
          ? [l]
          : d.loai === 'hoc_bu'
            ? [l, theoId.get(d.lich_chot_id)]
            : [theoId.get(d.lich_chot_id)];
        for (const b of cacBuoi) {
          if (b) ds.push({ nguon_id: l.id, buoi: veLichTrung(b) });
        }
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
        loai: true,
        lich_nguon: { select: { thoi_gian_bat_dau: true } },
      },
    });
    // ADR 0012: học bù không quá hạn vì buổi gốc đã qua.
    const conHan = hangDoi.filter(
      (h) => h.loai === 'hoc_bu' || !daBatDau(h.lich_nguon, now),
    );
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
    quaHanThem: Map<string, LyDoQuaHan>,
  ): DeNghiHocVien {
    const nguon = lichMap.get(r.lich_nguon_id);
    const dich = lichMap.get(r.lich_de_nghi_id);
    const dk = lichDk.get(r.dang_ky_hoc_id);
    const doiLai = doiLaiTu(r, chotCu, lichMap);
    const loai = r.loai ?? 'doi_buoi';
    // ADR 0012: buổi gốc đã bắt đầu chỉ làm quá hạn đổi buổi.
    const lyDoQuaHan: LyDoQuaHan | null =
      r.trang_thai !== 'cho_duyet'
        ? null
        : loai === 'doi_buoi' && nguon !== undefined && daBatDau(nguon, now)
          ? 'buoi_goc_bat_dau'
          : dich !== undefined && daBatDau(dich, now)
            ? 'buoi_de_nghi_bat_dau'
            : doiLai !== null && daBatDau(doiLai, now)
              ? 'buoi_dang_hoc_bat_dau'
              : (quaHanThem.get(r.id) ?? null);
    const quaHan = lyDoQuaHan !== null;
    return {
      id: r.id,
      trang_thai: r.trang_thai,
      loai,
      lich_nguon_id: r.lich_nguon_id,
      lich_de_nghi_id: r.lich_de_nghi_id,
      lich_chot_id: r.lich_chot_id,
      ly_do: r.ly_do,
      tao_luc: r.tao_luc,
      ghi_chu_xu_ly: r.ghi_chu_xu_ly,
      ly_do_huy: lyDoHuy(r),
      qua_han: quaHan,
      ly_do_qua_han: lyDoQuaHan,
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

  // Review fix: đổi buổi chờ quá hạn bị tự hủy khi gửi học bù cùng buổi gốc.
  private async ghiNhatKyTuHuy(hocVienId: string, tuHuyId: string | null) {
    if (!tuHuyId) return;
    await this.nhatKy.ghi({
      hanh_dong: 'de_nghi_doi_buoi',
      hoc_vien_id: hocVienId,
      mo_ta: 'Tự hủy đổi buổi quá hạn khi đăng ký học bù',
      chi_tiet: { de_nghi_id: tuHuyId, tu_dong: true },
    });
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
  loai: true,
} satisfies Prisma.doi_buoi_hocSelect;

// ADR 0012: đề nghị chờ còn hạn — buổi nguồn chưa bắt đầu chỉ áp cho đổi buổi
// (buổi gốc của học bù luôn đã qua).
function nguonConHan(now: Date): Prisma.doi_buoi_hocWhereInput {
  return {
    OR: [
      { loai: 'hoc_bu' },
      { lich_nguon: { thoi_gian_bat_dau: { gt: now } } },
    ],
  };
}

// Nhật ký: chỉ ghi `loai` cho học bù — dòng không có `loai` = doi_buoi (giữ
// nguyên chi_tiet nhật ký đổi buổi).
function chiTietLoai(loai: loai_doi_buoi): { loai?: 'hoc_bu' } {
  return loai === 'hoc_bu' ? { loai } : {};
}

function moTaTheoLoai(loai: loai_doi_buoi, hanhDong: string): string {
  return loai === 'hoc_bu'
    ? `${hanhDong} đăng ký học bù`
    : `${hanhDong} đề nghị đổi buổi`;
}

// Đề nghị bị hủy không do người duyệt: server tự ghi ghi_chu_xu_ly để phân biệt
// học viên sửa (bản cũ bị thay) với học viên tự hủy. Bản ghi cũ (trước khi có
// ghi chú này) được coi là tự hủy.
export const GHI_CHU_HOC_VIEN_SUA = 'Học viên đã sửa (thay bằng đề nghị mới)';
export const GHI_CHU_HOC_VIEN_HUY = 'Học viên tự hủy';
// ADR 0012: đổi buổi chờ quá hạn tự hủy khi học viên gửi học bù cùng buổi gốc
// (lyDoHuy xếp vào hoc_vien_huy — server ghi thay học viên, nguoi_xu_ly null).
export const GHI_CHU_TU_HUY_QUA_HAN =
  'Tự hủy: đã quá hạn, học viên chuyển sang đăng ký học bù';
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
