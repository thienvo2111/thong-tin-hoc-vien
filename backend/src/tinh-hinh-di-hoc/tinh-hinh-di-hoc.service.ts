import { Injectable } from '@nestjs/common';
import { Prisma, trang_thai_diem_danh } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  ForbiddenAppException,
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { paginate } from '../common/dto/pagination-query.dto';
import { boSo0DauDeTimKiem } from '../common/utils/ma-moet.util';
import { dieuKienKhongDau } from '../common/utils/tim-kiem-khong-dau.util';
import { chiaLo } from '../common/utils/theo-lo.util';
import { NhatKyService } from '../nhat-ky/nhat-ky.service';
import { DoiBuoiHocQueryService } from '../doi-buoi-hoc/doi-buoi-hoc-query.service';
import { LichTomTat } from '../doi-buoi-hoc/doi-buoi-hoc.rules';
import { DiemDanhService } from '../diem-danh/diem-danh.service';
import {
  LyDoKhongSua,
  quyenSuaDiemDanh,
  trangThaiSuaDuoc,
} from '../diem-danh/quyen-sua-diem-danh.util';
import {
  buoiHieuDung,
  lyDoDaCoMatLopKhac,
  tinhDiemDanhDong,
  TongDiHoc,
  tongDiHoc,
} from '../ho-tro-hoc-vien/diem-danh-lop-buoi.util';
import { khoaBuoi } from '../common/utils/chuyen-can.util';
import {
  ChuyenCanTheoDangKy,
  napChuyenCan,
} from '../doi-buoi-hoc/nap-chuyen-can';
import { LocTinhHinhDiHocDto } from './tinh-hinh-di-hoc.dto';
import { buildTinhHinhDiHocWorkbook } from './xuat-tinh-hinh-di-hoc.util';

/**
 * Phạm vi đăng ký học được xem (ADR 0010 T1, ADR 0011 P1/P4): người hỗ trợ =
 * cụm ∪ lớp (phân lớp gốc hoặc đổi buổi còn hiệu lực vào), có thể thu hẹp về
 * chỉ cụm / chỉ lớp (`HoTroHocVienScopeService.whereDangKyTrongPhamVi`), Quản
 * trị = `{}` (tất cả). `null` = chưa được gắn gì → không thấy ai.
 */
export type PhamViDiHoc = Prisma.dang_ky_hocWhereInput | null;

const CHON_DANG_KY = {
  id: true,
  hoc_vien: {
    select: {
      id: true,
      ho_ten: true,
      ma_dinh_danh_moet: true,
      don_vi_cong_tac: { select: { ten_don_vi: true } },
    },
  },
  cum: { select: { ten_cum: true } },
  phan_lop_giai_doan: {
    select: {
      giai_doan_id: true,
      lop_id: true,
      lop: { select: { ten_lop: true } },
      giai_doan: { select: { thu_tu: true, ten_giai_doan: true } },
    },
  },
} satisfies Prisma.dang_ky_hocSelect;

type DangKyDong = Prisma.dang_ky_hocGetPayload<{
  select: typeof CHON_DANG_KY;
}>;

const CHON_LICH = {
  id: true,
  lop_id: true,
  giai_doan_id: true,
  buoi_so: true,
  thoi_gian_bat_dau: true,
  thoi_gian_ket_thuc: true,
} satisfies Prisma.lich_hoc_lopSelect;

type Lich = Prisma.lich_hoc_lopGetPayload<{ select: typeof CHON_LICH }>;

/** 1 buổi hiệu dụng E của đăng ký (ADR 0010 T3). */
interface BuoiCuaDangKy {
  giai_doan: { id: string; thu_tu: number; ten_giai_doan: string };
  buoi_so: number;
  /** Buổi nguồn L của lớp gốc. */
  nguon: Lich;
  lop_nguon: { id: string; ten_lop: string };
  /** Buổi hiệu dụng E (= L, hoặc buổi chốt khi đã đổi ra). */
  e: Lich;
  lop: { id: string; ten_lop: string };
  doi_buoi: boolean;
  /** ADR 0012: buổi hiệu dụng là buổi học bù (loai = hoc_bu). */
  hoc_bu: boolean;
}

const SO_SANH_TEN = new Intl.Collator('vi');

const NHAN_TRANG_THAI: Record<trang_thai_diem_danh, string> = {
  co_mat: 'Có mặt',
  vang: 'Vắng',
  vang_co_phep: 'Vắng có phép',
};

const LY_DO_KHONG: Record<LyDoKhongSua, string> = {
  chua_dien_ra: 'Buổi học chưa diễn ra',
  qua_han: 'Đã quá hạn sửa điểm danh',
  khong_co_quyen: 'Không có quyền sửa điểm danh',
};

const ngayVn = (d: Date) => {
  const v = new Date(d.getTime() + 7 * 3600 * 1000);
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${p2(v.getUTCDate())}/${p2(v.getUTCMonth() + 1)}/${v.getUTCFullYear()}`;
};

// ADR 0010 — Tình hình đi học + điểm danh bổ sung. Dùng chung cho người hỗ
// trợ học viên (/ho-tro-hoc-vien/di-hoc*) và Quản trị (/thong-ke/di-hoc*);
// nơi gọi truyền phạm vi đã giải quyết. Luật buổi hiệu dụng + nhãn điểm danh
// dùng lại diem-danh-lop-buoi.util (ADR 0008 L8), trạng thái mỗi buổi theo
// tinhChuyenCan (ADR 0010 T7, nạp qua napChuyenCan), quyền ghi dùng lại
// quyenSuaDiemDanh, ghi dùng lại DiemDanhService.ghiThuCong.
@Injectable()
export class TinhHinhDiHocService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly doiBuoi: DoiBuoiHocQueryService,
    private readonly diemDanh: DiemDanhService,
    private readonly nhatKy: NhatKyService,
  ) {}

  /** Khóa (kèm cụm, lớp) cho ô lọc — chỉ khóa có học viên trong phạm vi. */
  async khoaChoLoc(phamVi: PhamViDiHoc, cumIds: string[] | null) {
    if (phamVi === null) return [];
    const nhom = await this.prisma.dang_ky_hoc.groupBy({
      by: ['khoa_id'],
      where: phamVi,
    });
    const khoaIds = nhom.map((n) => n.khoa_id);
    if (khoaIds.length === 0) return [];
    const [khoas, cums, lopNhom] = await Promise.all([
      this.prisma.khoa_boi_duong.findMany({
        where: { id: { in: khoaIds } },
        select: { id: true, ma_khoa: true, ten_khoa: true },
        orderBy: { ma_khoa: 'asc' },
      }),
      this.prisma.cum_hoc_vien.findMany({
        where: {
          khoa_id: { in: khoaIds },
          ...(cumIds ? { id: { in: cumIds } } : {}),
        },
        select: { id: true, ten_cum: true, khoa_id: true },
        orderBy: { ten_cum: 'asc' },
      }),
      this.prisma.phan_lop_giai_doan.groupBy({
        by: ['lop_id'],
        where: { dang_ky_hoc: { AND: [phamVi, { khoa_id: { in: khoaIds } }] } },
      }),
    ]);
    const lops = await this.prisma.lop_hoc.findMany({
      where: { id: { in: lopNhom.map((l) => l.lop_id) } },
      select: { id: true, ten_lop: true, loai_lop: true, khoa_id: true },
      orderBy: [{ loai_lop: 'asc' }, { ten_lop: 'asc' }],
    });
    return khoas.map((k) => ({
      khoa_id: k.id,
      ma_khoa: k.ma_khoa,
      ten_khoa: k.ten_khoa,
      cum: cums
        .filter((c) => c.khoa_id === k.id)
        .map(({ id, ten_cum }) => ({ id, ten_cum })),
      lop: lops
        .filter((l) => l.khoa_id === k.id)
        .map(({ id, ten_lop, loai_lop }) => ({ id, ten_lop, loai_lop })),
    }));
  }

  /**
   * ADR 0010 T2: lọc + phân trang ở server. Lọc theo số đếm (co_vang,
   * chua_diem_danh) cần tính cho MỌI đăng ký khớp rồi mới cắt trang; không
   * có thì chỉ tính cho trang đang xem (sắp xếp chỉ cần họ tên).
   */
  async danhSach(
    phamVi: PhamViDiHoc,
    loc: LocTinhHinhDiHocDto,
    now: Date = new Date(),
  ) {
    const page = loc.page ?? 1;
    const pageSize = loc.page_size ?? 20;
    const ds = await this.locDangKy(phamVi, loc);
    const cat = <T>(x: T[]) => x.slice((page - 1) * pageSize, page * pageSize);
    if (!loc.co_vang && !loc.chua_diem_danh) {
      return paginate(
        await this.tinhDong(cat(ds), now),
        ds.length,
        page,
        pageSize,
      );
    }
    const loc2 = this.locTheoTong(await this.tinhDong(ds, now), loc);
    return paginate(cat(loc2), loc2.length, page, pageSize);
  }

  async xuat(
    phamVi: PhamViDiHoc,
    loc: LocTinhHinhDiHocDto,
    nguoiDung: Pick<AuthenticatedUser, 'id' | 'vai_tro'>,
    now: Date = new Date(),
  ): Promise<Buffer> {
    const dong = this.locTheoTong(
      await this.tinhDong(await this.locDangKy(phamVi, loc), now),
      loc,
    );
    const khoa = await this.prisma.khoa_boi_duong.findUnique({
      where: { id: loc.khoa_id },
      select: { ma_khoa: true, ten_khoa: true },
    });
    const buffer = await buildTinhHinhDiHocWorkbook(
      `Tình hình đi học – Khóa ${khoa?.ma_khoa ?? ''} – ${khoa?.ten_khoa ?? ''} (đến ${ngayVn(now)})`,
      dong,
    );
    await this.nhatKy.ghi({
      hanh_dong:
        nguoiDung.vai_tro === 'ho_tro_hoc_vien'
          ? 'ho_tro_xuat_tinh_hinh_di_hoc'
          : 'xuat_tinh_hinh_di_hoc',
      nguoi_dung: { id: nguoiDung.id, vai_tro: nguoiDung.vai_tro },
      chi_tiet: {
        bo_loc: { ...loc, page: undefined, page_size: undefined },
        so_dong: dong.length,
      },
    });
    return buffer;
  }

  /**
   * Tổng đi học theo đăng ký (cùng cách tính danh sách ADR 0010) cho nơi
   * khác dùng lại, vd Excel nhu cầu mức theo đợt. Id không tồn tại → không có
   * trong Map. Nạp theo lô: không N+1.
   */
  async tongTheoDangKy(
    dangKyIds: string[],
    now: Date = new Date(),
  ): Promise<Map<string, TongDiHoc>> {
    const ds: DangKyDong[] = [];
    for (const lo of chiaLo([...new Set(dangKyIds)])) {
      ds.push(
        ...(await this.prisma.dang_ky_hoc.findMany({
          where: { id: { in: lo } },
          select: CHON_DANG_KY,
        })),
      );
    }
    const dong = await this.tinhDong(ds, now);
    return new Map(dong.map((d) => [d.dang_ky_hoc_id, d.tong]));
  }

  /** Chi tiết từng buổi hiệu dụng của 1 đăng ký (ngoài phạm vi → 404). */
  async chiTiet(
    phamVi: PhamViDiHoc,
    dangKyHocId: string,
    user: Pick<AuthenticatedUser, 'vai_tro'>,
    now: Date = new Date(),
  ) {
    const dk = await this.layDangKy(phamVi, dangKyHocId);
    const buoi = (await this.buoiTheoDangKy([dk])).get(dk.id) ?? [];
    const where = { dang_ky_hoc_id: dk.id };
    const [chuyenCan, dds, bvs] = await Promise.all([
      napChuyenCan(this.prisma, this.doiBuoi, [dk.id]),
      this.prisma.diem_danh.findMany({
        where,
        select: {
          lich_hoc_id: true,
          trang_thai: true,
          nguon: true,
          ghi_chu: true,
          tu_diem_danh_luc: true,
          cap_nhat_luc: true,
          sua_boi: { select: { ho_ten: true } },
        },
      }),
      this.prisma.bao_vang.findMany({
        where,
        select: { lich_hoc_id: true, ly_do: true },
      }),
    ]);
    const ddMap = new Map(dds.map((d) => [d.lich_hoc_id, d]));
    const bvMap = new Map(bvs.map((b) => [b.lich_hoc_id, b]));
    const dongBuoi = buoi.map((b) => {
      const dd = ddMap.get(b.e.id) ?? null;
      const nhan = tinhDiemDanhDong({
        ket_qua: this.ketQuaSlot(chuyenCan, dk.id, b),
        bao_vang: bvMap.get(b.e.id) ?? null,
        bat_dau: b.e.thoi_gian_bat_dau,
        now,
      });
      const quyen = quyenSuaDiemDanh(user.vai_tro, b.e.thoi_gian_bat_dau, now);
      // ADR 0010 T7: đã có mặt nhờ lớp khác → người hỗ trợ không bổ sung
      // (Quản trị giữ toàn quyền Z7).
      const chan =
        user.vai_tro === 'ho_tro_hoc_vien' ? lyDoDaCoMatLopKhac(nhan) : null;
      return {
        lich_hoc_id: b.e.id,
        lich_nguon_id: b.nguon.id,
        giai_doan: b.giai_doan,
        buoi_so: b.buoi_so,
        lop: b.lop,
        doi_buoi: b.doi_buoi
          ? { tu_lop: b.lop_nguon, sang_lop: b.lop, hoc_bu: b.hoc_bu }
          : null,
        thoi_gian_bat_dau: b.e.thoi_gian_bat_dau,
        thoi_gian_ket_thuc: b.e.thoi_gian_ket_thuc,
        diem_danh: {
          ma: nhan.ma,
          nhan: nhan.nhan,
          nguon_tinh: nhan.nguon_tinh,
          lop_tinh: nhan.lop_tinh,
          trang_thai: dd?.trang_thai ?? null,
          nguon: dd?.nguon ?? null,
          ghi_chu: dd?.ghi_chu ?? null,
          nguoi_sua: dd?.sua_boi?.ho_ten ?? null,
          cap_nhat_luc: dd?.cap_nhat_luc ?? null,
          tu_diem_danh_luc: dd?.tu_diem_danh_luc ?? null,
        },
        bo_sung_duoc: quyen.sua_duoc && !chan,
        ly_do_khong: chan ?? (quyen.ly_do ? LY_DO_KHONG[quyen.ly_do] : null),
      };
    });
    const khoa = await this.prisma.dang_ky_hoc.findUnique({
      where: { id: dk.id },
      select: { khoa: { select: { id: true, ma_khoa: true, ten_khoa: true } } },
    });
    return {
      ...this.dauDong(dk),
      khoa: khoa!.khoa,
      tong: tongDiHoc(
        dongBuoi.map((b) => ({
          ma: b.diem_danh.ma,
          bat_dau: b.thoi_gian_bat_dau,
        })),
        now,
      ),
      trang_thai_duoc: trangThaiSuaDuoc(user.vai_tro),
      buoi: dongBuoi,
    };
  }

  /**
   * ADR 0010 T4/T5: điểm danh bổ sung 1 buổi hiệu dụng của đăng ký. Quyền
   * thời gian theo quyenSuaDiemDanh (hỗ trợ HV: buổi đã bắt đầu, không giới
   * hạn; Quản trị: mọi lúc); trạng thái theo trangThaiSuaDuoc.
   */
  async diemDanhBoSung(
    phamVi: PhamViDiHoc,
    dangKyHocId: string,
    user: Pick<AuthenticatedUser, 'id' | 'vai_tro'>,
    dto: {
      lich_hoc_id: string;
      trang_thai: trang_thai_diem_danh;
      ly_do?: string;
    },
    now: Date = new Date(),
  ) {
    const dk = await this.layDangKy(phamVi, dangKyHocId);
    const buoi = (await this.buoiTheoDangKy([dk])).get(dk.id) ?? [];
    const b = buoi.find((x) => x.e.id === dto.lich_hoc_id);
    if (!b) {
      throw new ValidationException(
        'Buổi học không thuộc lịch học của học viên',
      );
    }
    if (user.vai_tro === 'ho_tro_hoc_vien') {
      const chuyenCan = await napChuyenCan(this.prisma, this.doiBuoi, [dk.id]);
      const chan = lyDoDaCoMatLopKhac(
        tinhDiemDanhDong({
          ket_qua: this.ketQuaSlot(chuyenCan, dk.id, b),
          bao_vang: null,
          bat_dau: b.e.thoi_gian_bat_dau,
          now,
        }),
      );
      if (chan) throw new ValidationException(chan);
    }
    const quyen = quyenSuaDiemDanh(user.vai_tro, b.e.thoi_gian_bat_dau, now);
    if (quyen.ly_do === 'chua_dien_ra') {
      throw new ValidationException('Buổi học chưa diễn ra');
    }
    if (!quyen.sua_duoc) throw new ForbiddenAppException();
    if (!trangThaiSuaDuoc(user.vai_tro).includes(dto.trang_thai)) {
      throw new ValidationException('Trạng thái điểm danh không được phép');
    }
    const cu = await this.prisma.diem_danh.findUnique({
      where: {
        dang_ky_hoc_id_lich_hoc_id: {
          dang_ky_hoc_id: dk.id,
          lich_hoc_id: b.e.id,
        },
      },
      select: { trang_thai: true },
    });
    const o = await this.diemDanh.ghiThuCong(
      user,
      {
        dang_ky_hoc_id: dk.id,
        lich_hoc_id: b.e.id,
        trang_thai: dto.trang_thai,
        ghi_chu: dto.ly_do,
      },
      now,
    );
    if (user.vai_tro === 'ho_tro_hoc_vien') {
      await this.nhatKy.ghi({
        hanh_dong: 'ho_tro_diem_danh_bo_sung',
        hoc_vien_id: dk.hoc_vien.id,
        mo_ta: `${b.giai_doan.ten_giai_doan} – buổi ${b.buoi_so} (${b.lop.ten_lop}, ${ngayVn(b.e.thoi_gian_bat_dau)}): ${cu ? NHAN_TRANG_THAI[cu.trang_thai] : 'chưa có'} → ${NHAN_TRANG_THAI[dto.trang_thai]}. Lý do: ${o.ghi_chu ?? ''}`,
        chi_tiet: {
          dang_ky_hoc_id: dk.id,
          lich_hoc_id: b.e.id,
          trang_thai_cu: cu?.trang_thai ?? null,
          trang_thai_moi: dto.trang_thai,
        },
      });
    }
    return o;
  }

  // ---------------------------------------------------------------------

  private async layDangKy(phamVi: PhamViDiHoc, dangKyHocId: string) {
    const dk =
      phamVi === null
        ? null
        : await this.prisma.dang_ky_hoc.findFirst({
            where: { AND: [{ id: dangKyHocId }, phamVi] },
            select: CHON_DANG_KY,
          });
    if (!dk) throw new NotFoundAppException('Không tìm thấy hồ sơ học viên');
    return dk;
  }

  /** Đăng ký khớp phạm vi + bộ lọc (trừ lọc theo số đếm), xếp họ tên (vi) rồi id. */
  private async locDangKy(
    phamVi: PhamViDiHoc,
    loc: LocTinhHinhDiHocDto,
  ): Promise<DangKyDong[]> {
    if (phamVi === null) return [];
    const and: Prisma.dang_ky_hocWhereInput[] = [
      phamVi,
      { khoa_id: loc.khoa_id },
    ];
    if (loc.don_vi_cong_tac_id) {
      and.push({ hoc_vien: { don_vi_cong_tac_id: loc.don_vi_cong_tac_id } });
    }
    if (loc.cum_id) and.push({ cum_id: loc.cum_id });
    if (loc.lop_id) {
      and.push({ phan_lop_giai_doan: { some: { lop_id: loc.lop_id } } });
    }
    const q = loc.q?.trim();
    if (q) and.push(await this.dieuKienTimKiem(loc.khoa_id, q));
    const ds = await this.prisma.dang_ky_hoc.findMany({
      where: { AND: and },
      select: CHON_DANG_KY,
    });
    return ds.sort(
      (a, b) =>
        SO_SANH_TEN.compare(a.hoc_vien.ho_ten, b.hoc_vien.ho_ten) ||
        a.id.localeCompare(b.id),
    );
  }

  /** Họ tên (không dấu, như ô tìm kiếm khác) HOẶC mã MOET (chấp nhận thiếu số 0 đầu). */
  private async dieuKienTimKiem(
    khoaId: string,
    q: string,
  ): Promise<Prisma.dang_ky_hocWhereInput> {
    const dk = dieuKienKhongDau(Prisma.sql`h.ho_ten`, q);
    const idsTheoTen = dk
      ? (
          await this.prisma.$queryRaw<{ id: string }[]>(
            Prisma.sql`SELECT h.id FROM "hoc_vien" h
              JOIN "dang_ky_hoc" d ON d.hoc_vien_id = h.id
              WHERE d.khoa_id = ${khoaId}::uuid AND ${dk}`,
          )
        ).map((r) => r.id)
      : [];
    return {
      OR: [
        { hoc_vien_id: { in: idsTheoTen } },
        {
          hoc_vien: {
            ma_dinh_danh_moet: {
              contains: boSo0DauDeTimKiem(q),
              mode: 'insensitive',
            },
          },
        },
      ],
    };
  }

  private locTheoTong<
    T extends { tong: { vang: number; chua_diem_danh: number } },
  >(ds: T[], loc: LocTinhHinhDiHocDto): T[] {
    return ds.filter(
      (d) =>
        (!loc.co_vang || d.tong.vang > 0) &&
        (!loc.chua_diem_danh || d.tong.chua_diem_danh > 0),
    );
  }

  private dauDong(dk: DangKyDong) {
    return {
      hoc_vien_id: dk.hoc_vien.id,
      dang_ky_hoc_id: dk.id,
      ho_ten: dk.hoc_vien.ho_ten,
      ma_dinh_danh_moet: dk.hoc_vien.ma_dinh_danh_moet,
      don_vi_cong_tac_ten: dk.hoc_vien.don_vi_cong_tac.ten_don_vi,
      cum: dk.cum?.ten_cum ?? null,
      lop_theo_giai_doan: dk.phan_lop_giai_doan
        .map((p) => ({
          giai_doan_id: p.giai_doan_id,
          thu_tu: p.giai_doan.thu_tu,
          ten_giai_doan: p.giai_doan.ten_giai_doan,
          lop_id: p.lop_id,
          ten_lop: p.lop.ten_lop,
        }))
        .sort((a, b) => a.thu_tu - b.thu_tu),
    };
  }

  /** Dòng danh sách + tổng (ADR 0010 T3, T7). Nạp theo lô: không N+1. */
  private async tinhDong(ds: DangKyDong[], now: Date) {
    if (ds.length === 0) return [];
    const ids = ds.map((d) => d.id);
    const [buoi, chuyenCan] = await Promise.all([
      this.buoiTheoDangKy(ds),
      // Đăng ký chưa phân lớp không có buổi nào → không cần nạp.
      napChuyenCan(
        this.prisma,
        this.doiBuoi,
        ds.filter((d) => d.phan_lop_giai_doan.length > 0).map((d) => d.id),
      ),
    ]);
    const bvMap = new Map<string, { ly_do: string }>();
    for (const lo of chiaLo(ids)) {
      const bvs = await this.prisma.bao_vang.findMany({
        where: { dang_ky_hoc_id: { in: lo } },
        select: { dang_ky_hoc_id: true, lich_hoc_id: true, ly_do: true },
      });
      for (const b of bvs) bvMap.set(`${b.dang_ky_hoc_id}|${b.lich_hoc_id}`, b);
    }
    return ds.map((dk) => ({
      ...this.dauDong(dk),
      tong: tongDiHoc(
        (buoi.get(dk.id) ?? []).map((b) => ({
          ma: tinhDiemDanhDong({
            ket_qua: this.ketQuaSlot(chuyenCan, dk.id, b),
            bao_vang: bvMap.get(`${dk.id}|${b.e.id}`) ?? null,
            bat_dau: b.e.thoi_gian_bat_dau,
            now,
          }).ma,
          bat_dau: b.e.thoi_gian_bat_dau,
        })),
        now,
      ),
    }));
  }

  /** Kết quả tinhChuyenCan của buổi (giai đoạn, buổi số của buổi nguồn L). */
  private ketQuaSlot(
    chuyenCan: ChuyenCanTheoDangKy,
    dangKyId: string,
    b: BuoiCuaDangKy,
  ) {
    return chuyenCan
      .get(dangKyId)
      ?.get(khoaBuoi(b.nguon.giai_doan_id, b.nguon.buoi_so));
  }

  /**
   * Buổi hiệu dụng theo đăng ký (ADR 0010 T3, = ADR 0008 L8 mở rộng ra mọi
   * giai đoạn): với mỗi phân lớp (giai đoạn G, lớp C), mỗi buổi L của C ở G →
   * E = buổi chốt nếu có đổi buổi da_duyet còn hiệu lực ra khỏi L, ngược lại L.
   * Nạp theo lô: buổi của các lớp, đổi buổi, buổi chốt.
   */
  private async buoiTheoDangKy(
    ds: DangKyDong[],
  ): Promise<Map<string, BuoiCuaDangKy[]>> {
    const kq = new Map<string, BuoiCuaDangKy[]>(ds.map((d) => [d.id, []]));
    const lopIds = [
      ...new Set(ds.flatMap((d) => d.phan_lop_giai_doan.map((p) => p.lop_id))),
    ];
    if (lopIds.length === 0) return kq;
    const [lich, doi] = await Promise.all([
      this.prisma.lich_hoc_lop.findMany({
        where: { lop_id: { in: lopIds } },
        select: CHON_LICH,
      }),
      this.doiBuoi.doiBuoiDaDuyetCuaDangKy(ds.map((d) => d.id)),
    ]);
    const lichTheoLop = new Map<string, Lich[]>();
    for (const l of lich) {
      lichTheoLop.set(l.lop_id, [...(lichTheoLop.get(l.lop_id) ?? []), l]);
    }
    const coLich = new Set(lich.map((l) => l.id));
    const doiRa = doi.filter((d) => coLich.has(d.lich_nguon_id));
    const hocBu = new Set(
      doiRa
        .filter((d) => d.loai === 'hoc_bu')
        .map((d) => `${d.dang_ky_hoc_id}|${d.lich_nguon_id}`),
    );
    const chot = await this.doiBuoi.lichTomTat(
      doiRa.map((d) => d.lich_chot_id),
    );
    const chotTheoDangKy = new Map<string, Map<string, LichTomTat>>();
    for (const d of doiRa) {
      const c = chot.get(d.lich_chot_id);
      if (!c) continue;
      const m = chotTheoDangKy.get(d.dang_ky_hoc_id) ?? new Map();
      m.set(d.lich_nguon_id, c);
      chotTheoDangKy.set(d.dang_ky_hoc_id, m);
    }
    for (const dk of ds) {
      const ra = kq.get(dk.id)!;
      for (const p of dk.phan_lop_giai_doan) {
        const lopNguon = { id: p.lop_id, ten_lop: p.lop.ten_lop };
        for (const cap of buoiHieuDung({
          lich: lichTheoLop.get(p.lop_id) ?? [],
          giai_doan_ids: new Set([p.giai_doan_id]),
          chot_cua_nguon:
            chotTheoDangKy.get(dk.id) ?? new Map<string, LichTomTat>(),
        })) {
          const c = cap.doi_buoi ? (cap.hieu_dung as LichTomTat) : null;
          ra.push({
            giai_doan: { id: p.giai_doan_id, ...p.giai_doan },
            buoi_so: cap.nguon.buoi_so,
            nguon: cap.nguon,
            lop_nguon: lopNguon,
            e: c
              ? {
                  id: c.id,
                  lop_id: c.lop_id,
                  giai_doan_id: c.giai_doan_id,
                  buoi_so: c.buoi_so,
                  thoi_gian_bat_dau: c.thoi_gian_bat_dau,
                  thoi_gian_ket_thuc:
                    c.thoi_gian_ket_thuc ?? c.thoi_gian_bat_dau,
                }
              : cap.nguon,
            lop: c ? { id: c.lop_id, ten_lop: c.lop.ten_lop } : lopNguon,
            doi_buoi: cap.doi_buoi,
            hoc_bu: cap.doi_buoi && hocBu.has(`${dk.id}|${cap.nguon.id}`),
          });
        }
      }
      ra.sort(
        (a, b) =>
          a.giai_doan.thu_tu - b.giai_doan.thu_tu ||
          a.buoi_so - b.buoi_so ||
          a.nguon.thoi_gian_bat_dau.getTime() -
            b.nguon.thoi_gian_bat_dau.getTime(),
      );
    }
    return kq;
  }
}
