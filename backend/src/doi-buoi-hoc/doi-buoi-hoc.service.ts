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
import { GuiDoiBuoiDto } from './dto/doi-buoi-hoc.dto';
import {
  DoiBuoiHocQueryService,
  LICH_TOM_TAT_SELECT,
} from './doi-buoi-hoc-query.service';
import {
  chuanHoaLyDo,
  daBatDau,
  HTTP_THEO_MA,
  KetQuaKiemTra,
  kiemTraGui,
  laBuoiTuongDuong,
  LichTomTat,
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
  qua_han: boolean;
  thu_tu_hang: { k: number; n: number } | null;
}

export interface LuaChonBuoi {
  lich: LichTomTat;
  si_so: number;
  si_so_toi_da: number | null;
  so_cho_duyet: number;
  da_du: boolean;
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
}

const TRANG_THAI_HOAT_DONG: trang_thai_de_nghi[] = ['cho_duyet', 'da_duyet'];
const TIN_KHOA_TAT = 'Khóa học chưa mở đề nghị đổi buổi';

@Injectable()
export class DoiBuoiHocService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly query: DoiBuoiHocQueryService,
    private readonly nhatKy: NhatKyService,
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
      deNghiRows.flatMap((d) => [d.lich_nguon_id, d.lich_de_nghi_id]),
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

    const ungVien = await this.prisma.lich_hoc_lop.findMany({
      where: {
        giai_doan_id: nguon.giai_doan_id,
        buoi_so: nguon.buoi_so,
        thoi_gian_bat_dau: { gt: now },
        lop: { khoa_id: nguon.lop.khoa_id, loai_lop: nguon.lop.loai_lop },
      },
      orderBy: { thoi_gian_bat_dau: 'asc' },
      select: LICH_TOM_TAT_SELECT,
    });
    const tuongDuong = ungVien.filter((l) => laBuoiTuongDuong(nguon, l));
    const siSo = await this.query.siSoBuoi(
      tuongDuong.map((l) => l.id),
      now,
    );
    return tuongDuong.map((lich) => {
      const s = siSo.get(lich.id) ?? {
        si_so: 0,
        si_so_toi_da: lich.lop.si_so_toi_da,
        so_cho_duyet: 0,
      };
      return {
        lich,
        si_so: s.si_so,
        si_so_toi_da: s.si_so_toi_da,
        so_cho_duyet: s.so_cho_duyet,
        da_du: s.si_so_toi_da !== null && s.si_so >= s.si_so_toi_da,
      };
    });
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
      data: { trang_thai: 'da_huy' },
    });
    if (!count) throw new ConflictAppException('Đề nghị đã được xử lý');
    await this.ghiNhatKyGui(hocVienId, 'Hủy đề nghị đổi buổi', {
      de_nghi_id: id,
      huy: true,
    });
    return { trang_thai: 'da_huy' as const };
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
      select: { id: true },
    });
    if (!dangKy) throw new NotFoundAppException(thongDiep);
    return dangKy;
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
            data: { trang_thai: 'da_huy' },
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
      qua_han: quaHan,
      thu_tu_hang: quaHan ? null : (hang.get(r.id) ?? null),
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
} satisfies Prisma.doi_buoi_hocSelect;
