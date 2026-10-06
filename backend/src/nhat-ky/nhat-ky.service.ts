import { Injectable, Logger } from '@nestjs/common';
import type { Prisma, vai_tro_nguoi_dung } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundAppException } from '../common/exceptions/app.exceptions';
import { nguCanhNhatKy } from './nhat-ky.context';

export type HanhDongNhatKy =
  | 'dang_nhap_thanh_cong'
  | 'dang_nhap_sai_mat_khau'
  | 'dang_nhap_bi_khoa'
  | 'doi_mat_khau'
  | 'dat_lai_mat_khau_qua_email'
  | 'chuyen_sang_khao_sat'
  | 'cap_nhat_muc_danh_gia'
  | 'cap_nhat_ket_qua_hoc'
  | 'phan_lop'
  | 'doi_cum'
  | 'ho_tro_xuat_danh_sach'
  | 'sua_tra_loi_ho_tro'
  | 'sua_lich_hoc';

const TIEU_DE: Record<HanhDongNhatKy, string> = {
  dang_nhap_thanh_cong: 'Đăng nhập thành công',
  dang_nhap_sai_mat_khau: 'Đăng nhập sai mật khẩu',
  dang_nhap_bi_khoa: 'Đăng nhập khi tài khoản đang tạm khóa',
  doi_mat_khau: 'Đổi mật khẩu',
  dat_lai_mat_khau_qua_email: 'Đặt lại mật khẩu qua email',
  chuyen_sang_khao_sat: 'Bấm chuyển sang hệ thống khảo sát',
  cap_nhat_muc_danh_gia: 'Cập nhật kết quả đánh giá năng lực',
  cap_nhat_ket_qua_hoc: 'Cập nhật kết quả khóa học',
  phan_lop: 'Phân lớp',
  doi_cum: 'Đổi cụm hỗ trợ',
  ho_tro_xuat_danh_sach: 'Người hỗ trợ xuất danh sách cụm',
  sua_tra_loi_ho_tro: 'Quản trị sửa câu trả lời yêu cầu hỗ trợ',
  sua_lich_hoc: 'Sửa giờ/địa điểm buổi học',
};

const NHOM: Record<HanhDongNhatKy, NhomDongThoiGian> = {
  dang_nhap_thanh_cong: 'tai_khoan',
  dang_nhap_sai_mat_khau: 'tai_khoan',
  dang_nhap_bi_khoa: 'tai_khoan',
  doi_mat_khau: 'tai_khoan',
  dat_lai_mat_khau_qua_email: 'tai_khoan',
  chuyen_sang_khao_sat: 'khao_sat',
  cap_nhat_muc_danh_gia: 'hoc_tap',
  cap_nhat_ket_qua_hoc: 'hoc_tap',
  phan_lop: 'hoc_tap',
  doi_cum: 'hoc_tap',
  ho_tro_xuat_danh_sach: 'tai_khoan',
  sua_tra_loi_ho_tro: 'ho_tro',
  sua_lich_hoc: 'hoc_tap',
};

const NHAN_VAI_TRO: Record<vai_tro_nguoi_dung, string> = {
  hoc_vien: 'học viên',
  quan_tri: 'quản trị',
  so_gddt: 'Sở GD&ĐT',
  phong_vhxh: 'Phòng VHXH',
  truong: 'trường',
  ho_tro_hoc_vien: 'người hỗ trợ học viên',
  ho_tro_giang_vien: 'người hỗ trợ giảng viên',
};

export type NhomDongThoiGian =
  'tai_khoan' | 'ho_so' | 'khao_sat' | 'hoc_tap' | 'thong_bao' | 'ho_tro';

export interface MucDongThoiGian {
  id: string;
  thoi_gian: Date;
  nhom: NhomDongThoiGian;
  tieu_de: string;
  noi_dung: string | null;
  /** Chỉ có ở mục "Sửa hồ sơ" — tên field backend, frontend tự đổi sang nhãn. */
  truong: string | null;
  nguoi_thuc_hien: string | null;
  ip: string | null;
  thiet_bi: string | null;
}

export interface SuKienNhatKy {
  hanh_dong: HanhDongNhatKy;
  hoc_vien_id?: string | null;
  /** Câu mô tả dựng sẵn lúc ghi (tên lớp/khóa có thể đổi về sau). */
  mo_ta?: string;
  chi_tiet?: Record<string, unknown>;
  /** Mặc định = người đang đăng nhập của request; truyền khi chưa xác thực (đăng nhập). */
  nguoi_dung?: { id: string; vai_tro: vai_tro_nguoi_dung } | null;
}

const GIOI_HAN_MOI_NGUON = 300;

@Injectable()
export class NhatKyService {
  private readonly logger = new Logger(NhatKyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Ghi 1 sự kiện. KHÔNG BAO GIỜ ném lỗi — lỗi ghi log không được làm hỏng thao tác chính. */
  async ghi(su: SuKienNhatKy): Promise<void> {
    const ctx = nguCanhNhatKy.getStore();
    const nd = su.nguoi_dung ?? ctx?.nguoiDung ?? null;
    const chiTiet = su.mo_ta
      ? { mo_ta: su.mo_ta, ...su.chi_tiet }
      : su.chi_tiet;
    try {
      await this.prisma.nhat_ky_hoat_dong.create({
        data: {
          hanh_dong: su.hanh_dong,
          hoc_vien_id: su.hoc_vien_id ?? null,
          nguoi_dung_id: nd?.id ?? null,
          vai_tro: nd?.vai_tro ?? null,
          chi_tiet: chiTiet as Prisma.InputJsonValue | undefined,
          ip: ctx?.ip ?? null,
          thiet_bi: ctx?.thietBi ?? null,
        },
      });
    } catch (e) {
      this.logger.error(`Không ghi được nhật ký ${su.hanh_dong}: ${String(e)}`);
    }
  }

  /** GET /hoc-vien/{id}/nhat-ky — gộp mọi nguồn lịch sử của 1 học viên, mới nhất trước. */
  async dongThoiGian(hocVienId: string) {
    const hocVien = await this.prisma.hoc_vien.findUnique({
      where: { id: hocVienId },
      select: { id: true, ho_ten: true },
    });
    if (!hocVien) throw new NotFoundAppException('Không tìm thấy học viên');

    const take = GIOI_HAN_MOI_NGUON;
    const [nhatKy, suaHoSo, xacNhan, sso, vle, email, datLaiMk, hoTro] =
      await Promise.all([
        this.prisma.nhat_ky_hoat_dong.findMany({
          where: { hoc_vien_id: hocVienId },
          orderBy: { thoi_gian: 'desc' },
          take,
        }),
        this.prisma.lich_su_thay_doi_ho_so.findMany({
          where: { hoc_vien_id: hocVienId },
          include: { nguoi_sua: { select: { ho_ten: true, vai_tro: true } } },
          orderBy: { sua_luc: 'desc' },
          take,
        }),
        this.prisma.xac_nhan_ho_so.findMany({
          where: { hoc_vien_id: hocVienId },
          include: { dot: { select: { ten: true } } },
          orderBy: { xac_nhan_luc: 'desc' },
          take,
        }),
        this.prisma.ma_sso_mot_lan.findMany({
          where: { hoc_vien_id: hocVienId, da_dung_luc: { not: null } },
          orderBy: { da_dung_luc: 'desc' },
          take,
        }),
        this.prisma.tai_khoan_vle.findUnique({
          where: { hoc_vien_id: hocVienId },
          select: { lan_dau_xem_luc: true },
        }),
        this.prisma.nhat_ky_thong_bao.findMany({
          where: { hoc_vien_id: hocVienId },
          orderBy: { gui_luc: 'desc' },
          take,
        }),
        this.prisma.nhat_ky_dat_lai_mat_khau.findMany({
          where: { nguoi_dung: { hoc_vien_id: hocVienId } },
          include: { thuc_hien: { select: { ho_ten: true, vai_tro: true } } },
          orderBy: { created_at: 'desc' },
          take,
        }),
        this.prisma.yeu_cau_ho_tro.findMany({
          where: { hoc_vien_id: hocVienId },
          orderBy: { thoi_gian_tao: 'desc' },
          take,
        }),
      ]);

    const tenNguoi = await this.tenNguoiDung(
      nhatKy.flatMap((n) => (n.nguoi_dung_id ? [n.nguoi_dung_id] : [])),
    );
    const muc: MucDongThoiGian[] = [];
    const them = (
      m: Partial<MucDongThoiGian> &
        Pick<MucDongThoiGian, 'id' | 'thoi_gian' | 'nhom' | 'tieu_de'>,
    ) =>
      muc.push({
        noi_dung: null,
        truong: null,
        nguoi_thuc_hien: null,
        ip: null,
        thiet_bi: null,
        ...m,
      });

    for (const n of nhatKy) {
      const hd = n.hanh_dong as HanhDongNhatKy;
      const chiTiet = (n.chi_tiet ?? {}) as { mo_ta?: string };
      them({
        id: n.id,
        thoi_gian: n.thoi_gian,
        nhom: NHOM[hd] ?? 'tai_khoan',
        tieu_de: TIEU_DE[hd] ?? n.hanh_dong,
        noi_dung: chiTiet.mo_ta ?? null,
        nguoi_thuc_hien: n.nguoi_dung_id
          ? (tenNguoi.get(n.nguoi_dung_id) ?? null)
          : null,
        ip: n.ip,
        thiet_bi: n.thiet_bi,
      });
    }
    for (const s of suaHoSo) {
      them({
        id: s.id,
        thoi_gian: s.sua_luc,
        nhom: 'ho_so',
        tieu_de: 'Sửa hồ sơ',
        truong: s.truong,
        noi_dung: `${s.gia_tri_cu || '(trống)'} → ${s.gia_tri_moi || '(trống)'}`,
        nguoi_thuc_hien: moTaNguoi(s.nguoi_sua),
      });
    }
    for (const x of xacNhan) {
      them({
        id: x.id,
        thoi_gian: x.xac_nhan_luc,
        nhom: 'ho_so',
        tieu_de: 'Xác nhận hồ sơ',
        noi_dung: `Đợt "${x.dot.ten}"${x.con_hieu_luc ? '' : ' — đã hết hiệu lực do hồ sơ được sửa sau đó'}`,
      });
    }
    for (const s of sso) {
      them({
        id: s.id,
        thoi_gian: s.da_dung_luc!,
        nhom: 'khao_sat',
        tieu_de: 'Hệ thống khảo sát đã tiếp nhận học viên',
        noi_dung:
          s.target === 'dau-ra'
            ? 'Khảo sát đầu ra'
            : 'Khảo sát / đánh giá đầu vào',
      });
    }
    if (vle?.lan_dau_xem_luc) {
      them({
        id: `vle-${hocVienId}`,
        thoi_gian: vle.lan_dau_xem_luc,
        nhom: 'khao_sat',
        tieu_de: 'Xem tài khoản VLE (đánh giá đầu vào) lần đầu',
      });
    }
    for (const e of email) {
      them({
        id: e.id,
        thoi_gian: e.gui_luc,
        nhom: 'thong_bao',
        tieu_de:
          e.trang_thai === 'thanh_cong' ? 'Đã gửi email' : 'Gửi email thất bại',
        noi_dung: `"${e.tieu_de}" tới ${e.email_nguoi_nhan}${e.loi ? ` — lỗi: ${e.loi}` : ''}`,
      });
    }
    for (const d of datLaiMk) {
      them({
        id: d.id,
        thoi_gian: d.created_at,
        nhom: 'tai_khoan',
        tieu_de: 'Được đặt lại mật khẩu',
        nguoi_thuc_hien: moTaNguoi(d.thuc_hien),
      });
    }
    for (const y of hoTro) {
      const tomTat = y.tinh_huong ?? y.noi_dung_hoi.slice(0, 120);
      them({
        id: `${y.id}-tao`,
        thoi_gian: y.thoi_gian_tao,
        nhom: 'ho_tro',
        tieu_de: 'Gửi yêu cầu hỗ trợ',
        noi_dung: tomTat,
      });
      if (y.thoi_gian_phan_hoi) {
        them({
          id: `${y.id}-tra-loi`,
          thoi_gian: y.thoi_gian_phan_hoi,
          nhom: 'ho_tro',
          tieu_de: 'Yêu cầu hỗ trợ được trả lời',
          noi_dung: tomTat,
        });
      }
      if (y.thoi_gian_dong) {
        them({
          id: `${y.id}-dong`,
          thoi_gian: y.thoi_gian_dong,
          nhom: 'ho_tro',
          tieu_de: 'Đóng yêu cầu hỗ trợ',
          noi_dung: tomTat,
        });
      }
    }

    muc.sort((a, b) => b.thoi_gian.getTime() - a.thoi_gian.getTime());
    return { hoc_vien: hocVien, muc };
  }

  private async tenNguoiDung(ids: string[]) {
    if (ids.length === 0) return new Map<string, string>();
    const ds = await this.prisma.nguoi_dung.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, ho_ten: true, vai_tro: true },
    });
    return new Map(ds.map((n) => [n.id, moTaNguoi(n)]));
  }
}

function moTaNguoi(n: { ho_ten: string; vai_tro: vai_tro_nguoi_dung }) {
  return `${n.ho_ten} (${NHAN_VAI_TRO[n.vai_tro]})`;
}
