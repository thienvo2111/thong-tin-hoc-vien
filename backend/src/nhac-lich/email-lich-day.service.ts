import { Injectable } from '@nestjs/common';
import { trang_thai_hang_doi_email } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NhatKyService } from '../nhat-ky/nhat-ky.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { NotFoundAppException } from '../common/exceptions/app.exceptions';
import { layFrontendUrl } from '../common/utils/token-xac-thuc.util';
import {
  EmailDaDung,
  LopLichDay,
  mauLichGiangDay,
} from '../thong-bao/mau-email/mau-email';
import {
  TrangThaiNhac,
  gopTrangThaiNhac,
  nhacConHieuLuc,
  trangThaiNhac,
} from './nhac-lich.util';

export type LyDoBoQua = 'khong_co_email' | 'khong_co_buoi' | 'loi_he_thong';

export interface DongGiangVienEmail {
  id: string;
  ho_ten: string;
  email: string | null;
  so_buoi: number;
  so_lop: number;
  trang_thai_nhac: TrangThaiNhac;
  email_cuoi: {
    gui_luc: Date;
    trang_thai: trang_thai_hang_doi_email;
    loi: string | null;
  } | null;
}

type GiaiDoan = Awaited<ReturnType<EmailLichDayService['layGiaiDoan']>>;
type Buoi = Awaited<ReturnType<EmailLichDayService['buoiCuaGiaiDoan']>>[number];
type NhatKy = Awaited<
  ReturnType<EmailLichDayService['nhatKyGiangVien']>
>[number];
type NguCanh = {
  gd: GiaiDoan;
  buoi: Buoi[];
  nhatKy: NhatKy[];
  nhomHoTro: { hoTen: string; email: string | null }[];
};

const day = (b: Buoi, gvId: string) =>
  b.phan_cong.some((p) => p.giang_vien_id === gvId);

// ADR 0009: email lịch giảng dạy — 1 email / (khóa × giai đoạn × giảng viên),
// gom mọi buổi có phân công qua mọi lớp. Nơi gọi tự kiểm phạm vi khóa.
@Injectable()
export class EmailLichDayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nhatKy: NhatKyService,
  ) {}

  async danhSach(khoaId: string, gdId: string) {
    const gd = await this.layGiaiDoan(khoaId, gdId);
    const buoi = await this.buoiCuaGiaiDoan(khoaId, gdId);
    const gvs = new Map<string, Buoi['phan_cong'][number]['giang_vien']>();
    for (const b of buoi) {
      for (const p of b.phan_cong) gvs.set(p.giang_vien_id, p.giang_vien);
    }
    const nhatKy = await this.nhatKyGiangVien([...gvs.keys()], buoi);
    const giang_vien: DongGiangVienEmail[] = [...gvs.values()].map((g) => {
      const cua = buoi.filter((b) => day(b, g.id));
      const nk = nhatKy.filter((n) => n.giang_vien_id === g.id);
      const email = nk.find((n) => n.hang_doi_email);
      const hieuLuc = nk.filter(nhacConHieuLuc);
      // Buổi có trong email cuối nhưng nay không dạy (đã gỡ) cũng là thay đổi cần báo.
      const emailCuoi = hieuLuc.find((n) => n.hang_doi_email_id);
      const biGo = !!emailCuoi?.lich_hoc_ids.some((id) =>
        buoi.some((b) => b.id === id && !day(b, g.id)),
      );
      return {
        id: g.id,
        ho_ten: g.ho_ten,
        email: g.email,
        so_buoi: cua.length,
        so_lop: new Set(cua.map((b) => b.lop_id)).size,
        trang_thai_nhac: biGo
          ? 'can_nhac_lai'
          : gopTrangThaiNhac(cua.map((b) => trangThaiNhac(b, hieuLuc))),
        email_cuoi: email?.hang_doi_email
          ? {
              gui_luc: email.gui_luc,
              trang_thai: email.hang_doi_email.trang_thai,
              loi: email.hang_doi_email.loi,
            }
          : null,
      };
    });
    giang_vien.sort((a, b) => a.ho_ten.localeCompare(b.ho_ten, 'vi'));
    return {
      giai_doan: {
        id: gd.id,
        ten_giai_doan: gd.ten_giai_doan,
        hinh_thuc: gd.hinh_thuc,
        thoi_gian_bat_dau: gd.thoi_gian_bat_dau,
        thoi_gian_ket_thuc: gd.thoi_gian_ket_thuc,
      },
      giang_vien,
    };
  }

  async xemTruoc(khoaId: string, gdId: string, gvId: string) {
    const nc = await this.nguCanh(khoaId, gdId, [gvId]);
    const d = await this.dungEmail(nc, gvId);
    if (!d) {
      throw new NotFoundAppException(
        'Giảng viên không dạy buổi nào trong giai đoạn này',
      );
    }
    return {
      tieu_de: d.mau.tieuDe,
      html: d.mau.html,
      la_cap_nhat: d.la_cap_nhat,
      email: d.gv.email,
    };
  }

  async gui(
    user: AuthenticatedUser,
    khoaId: string,
    gdId: string,
    gvIds: string[],
  ) {
    const nc = await this.nguCanh(khoaId, gdId, gvIds);
    const bo_qua: {
      giang_vien_id: string;
      ho_ten: string;
      ly_do: LyDoBoQua;
    }[] = [];
    const khongBuoi = gvIds.filter((id) => !nc.buoi.some((b) => day(b, id)));
    const tenKhongBuoi = khongBuoi.length
      ? await this.prisma.giang_vien.findMany({
          where: { id: { in: khongBuoi } },
          select: { id: true, ho_ten: true },
        })
      : [];
    let da_xep_hang = 0;
    for (const id of gvIds) {
      const d = await this.dungEmail(nc, id);
      if (!d) {
        const ten = tenKhongBuoi.find((g) => g.id === id)?.ho_ten ?? '';
        bo_qua.push({ giang_vien_id: id, ho_ten: ten, ly_do: 'khong_co_buoi' });
        continue;
      }
      const email = d.gv.email?.trim();
      if (!email) {
        bo_qua.push({
          giang_vien_id: id,
          ho_ten: d.gv.ho_ten,
          ly_do: 'khong_co_email',
        });
        continue;
      }
      try {
        // Hàng đợi + nhật ký cùng transaction: nhật ký lỗi thì không sót email "mồ côi".
        await this.prisma.$transaction(async (tx) => {
          const hd = await tx.hang_doi_email.create({
            data: {
              loai_su_kien: 'nhac_lich_giang_vien',
              hoc_vien_id: null,
              email_nguoi_nhan: email,
              tieu_de: d.mau.tieuDe,
              noi_dung_html: d.mau.html,
            },
            select: { id: true },
          });
          await tx.nhat_ky_nhac_lich.create({
            data: {
              doi_tuong: 'giang_vien',
              giang_vien_id: id,
              lich_hoc_ids: d.lich_hoc_ids,
              noi_dung: `${d.mau.tieuDe}\n${d.mau.tomTat}`,
              nguoi_gui: user.id,
              hang_doi_email_id: hd.id,
            },
          });
        });
        da_xep_hang++;
      } catch (e) {
        console.error('[email-lich-day] Không xếp hàng được email', id, e);
        bo_qua.push({
          giang_vien_id: id,
          ho_ten: d.gv.ho_ten,
          ly_do: 'loi_he_thong',
        });
      }
    }
    if (da_xep_hang > 0) {
      await this.nhatKy.ghi({
        hanh_dong: 'ho_tro_gv_gui_email_lich_day',
        mo_ta: `Gửi email lịch giảng dạy ${nc.gd.ten_giai_doan} – khóa ${nc.gd.khoa.ma_khoa} cho ${da_xep_hang} giảng viên`,
        chi_tiet: {
          khoa_id: khoaId,
          giai_doan_id: gdId,
          so_nguoi: da_xep_hang,
        },
      });
    }
    return { da_xep_hang, bo_qua };
  }

  // ---------------- Truy vấn ----------------
  async layGiaiDoan(khoaId: string, gdId: string) {
    const gd = await this.prisma.giai_doan_khoa.findUnique({
      where: { id: gdId },
      select: {
        id: true,
        khoa_id: true,
        ten_giai_doan: true,
        hinh_thuc: true,
        thoi_gian_bat_dau: true,
        thoi_gian_ket_thuc: true,
        khoa: { select: { ma_khoa: true, ten_khoa: true } },
      },
    });
    if (!gd || gd.khoa_id !== khoaId) {
      throw new NotFoundAppException('Không tìm thấy giai đoạn của khóa');
    }
    return gd;
  }

  /** Mọi buổi của giai đoạn (lớp đang hoạt động) — cả buổi của giảng viên khác, để tìm buổi bị gỡ. */
  buoiCuaGiaiDoan(khoaId: string, gdId: string) {
    return this.prisma.lich_hoc_lop.findMany({
      where: {
        giai_doan_id: gdId,
        lop: { khoa_id: khoaId, trang_thai: 'active' },
      },
      select: {
        id: true,
        lop_id: true,
        buoi_so: true,
        thoi_gian_bat_dau: true,
        thoi_gian_ket_thuc: true,
        dia_diem_hoac_link: true,
        phong: true,
        cap_nhat_luc: true,
        lop: { select: { ten_lop: true, loai_lop: true } },
        diem_hoc: { select: { ten: true, dia_chi: true } },
        phan_cong: {
          select: {
            giang_vien_id: true,
            vai_tro: true,
            giang_vien: {
              select: {
                id: true,
                ho_ten: true,
                email: true,
                tai_khoan: { select: { trang_thai: true } },
              },
            },
          },
        },
      },
      orderBy: [{ thoi_gian_bat_dau: 'asc' }, { buoi_so: 'asc' }],
    });
  }

  /** Nhật ký nhắc (mọi kênh) của các giảng viên có chạm buổi giai đoạn này, mới nhất trước. */
  nhatKyGiangVien(gvIds: string[], buoi: { id: string }[]) {
    if (gvIds.length === 0 || buoi.length === 0) return Promise.resolve([]);
    return this.prisma.nhat_ky_nhac_lich.findMany({
      where: {
        doi_tuong: 'giang_vien',
        giang_vien_id: { in: gvIds },
        lich_hoc_ids: { hasSome: buoi.map((b) => b.id) },
      },
      select: {
        giang_vien_id: true,
        lich_hoc_ids: true,
        gui_luc: true,
        hang_doi_email_id: true,
        hang_doi_email: { select: { trang_thai: true, loi: true } },
      },
      orderBy: { gui_luc: 'desc' },
    });
  }

  private async nguCanh(
    khoaId: string,
    gdId: string,
    gvIds: string[],
  ): Promise<NguCanh> {
    const gd = await this.layGiaiDoan(khoaId, gdId);
    const [buoi, nhom] = await Promise.all([
      this.buoiCuaGiaiDoan(khoaId, gdId),
      this.prisma.phan_cong_ho_tro_gv.findMany({
        where: { khoa_id: khoaId },
        select: { nguoi_dung: { select: { ho_ten: true, email: true } } },
        orderBy: { created_at: 'asc' },
      }),
    ]);
    const nhatKy = await this.nhatKyGiangVien(gvIds, buoi);
    return {
      gd,
      buoi,
      nhatKy,
      nhomHoTro: nhom.map((n) => ({
        hoTen: n.nguoi_dung.ho_ten,
        email: n.nguoi_dung.email,
      })),
    };
  }

  private async dungEmail(nc: NguCanh, gvId: string) {
    const cua = nc.buoi.filter((b) => day(b, gvId));
    if (cua.length === 0) return null;
    const gv = cua[0].phan_cong.find(
      (p) => p.giang_vien_id === gvId,
    )!.giang_vien;
    const lanCuoi = nc.nhatKy.find(
      (n) =>
        n.giang_vien_id === gvId && n.hang_doi_email_id && nhacConHieuLuc(n),
    );
    const lopIds = [...new Set(cua.map((b) => b.lop_id))];
    const [hauCan, thucDia] = await Promise.all([
      this.prisma.hau_can_giang_vien.findMany({
        where: {
          giai_doan_id: nc.gd.id,
          giang_vien_id: gvId,
          lop_id: { in: lopIds },
        },
      }),
      this.prisma.nhan_su_thuc_dia.findMany({
        where: { giai_doan_id: nc.gd.id, lop_id: { in: lopIds } },
        select: { lop_id: true, ho_ten: true, so_dien_thoai: true },
        orderBy: { created_at: 'asc' },
      }),
    ]);

    // Thứ tự lớp = buổi sớm nhất (buổi đã sắp theo giờ từ truy vấn).
    const lop: LopLichDay[] = lopIds.map((lopId) => {
      const ds = cua.filter((b) => b.lop_id === lopId);
      const h = hauCan.find((x) => x.lop_id === lopId);
      return {
        tenLop: ds[0].lop.ten_lop,
        loaiLop: ds[0].lop.loai_lop,
        vaiTro: ds[0].phan_cong.find((p) => p.giang_vien_id === gvId)!.vai_tro,
        buoi: ds.map((b) => ({
          buoiSo: b.buoi_so,
          batDau: b.thoi_gian_bat_dau,
          ketThuc: b.thoi_gian_ket_thuc,
          diemHoc: b.diem_hoc
            ? { ten: b.diem_hoc.ten, diaChi: b.diem_hoc.dia_chi }
            : null,
          phong: b.phong,
          diaDiemHoacLink: b.dia_diem_hoac_link,
          coThayDoi:
            !!lanCuoi &&
            (b.cap_nhat_luc > lanCuoi.gui_luc ||
              !lanCuoi.lich_hoc_ids.includes(b.id)),
        })),
        hauCan: h
          ? {
              noiOTen: h.noi_o_ten,
              noiODiaChi: h.noi_o_dia_chi,
              nhanPhong: h.nhan_phong,
              traPhong: h.tra_phong,
              phuongTien: h.phuong_tien,
              donLuc: h.don_luc,
              diemDon: h.diem_don,
              lienHeDon: h.lien_he_don,
            }
          : null,
        thucDia: thucDia
          .filter((x) => x.lop_id === lopId)
          .map((x) => ({ hoTen: x.ho_ten, soDienThoai: x.so_dien_thoai })),
      };
    });

    const mau: EmailDaDung & { tomTat: string } = mauLichGiangDay({
      hoTen: gv.ho_ten,
      tenKhoa: nc.gd.khoa.ten_khoa,
      maKhoa: nc.gd.khoa.ma_khoa,
      giaiDoan: {
        ten: nc.gd.ten_giai_doan,
        hinhThuc: nc.gd.hinh_thuc,
        tuNgay: nc.gd.thoi_gian_bat_dau,
        denNgay: nc.gd.thoi_gian_ket_thuc,
      },
      lop,
      nhomHoTro: nc.nhomHoTro,
      linkCongGiangVien:
        gv.tai_khoan?.trang_thai === 'active'
          ? `${layFrontendUrl()}/giang-day`
          : null,
      capNhat: lanCuoi
        ? {
            guiLucTruoc: lanCuoi.gui_luc,
            buoiGo: nc.buoi
              .filter(
                (b) => lanCuoi.lich_hoc_ids.includes(b.id) && !day(b, gvId),
              )
              .map((b) => ({
                tenLop: b.lop.ten_lop,
                buoiSo: b.buoi_so,
                batDau: b.thoi_gian_bat_dau,
              })),
          }
        : null,
    });
    return {
      gv,
      lich_hoc_ids: cua.map((b) => b.id),
      mau,
      la_cap_nhat: !!lanCuoi,
    };
  }
}
