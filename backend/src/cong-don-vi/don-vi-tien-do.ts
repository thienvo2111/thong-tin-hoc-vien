// Issue #71 / ADR 0015 O3, P1: chiếu dữ liệu tiến độ cho Sở/Phòng qua DANH SÁCH TRẮNG — chỉ trạng thái, danh
// sách GV, suất, giá trị. Không Phần 2/5 (tài khoản, kho bạc, HT/KT + STK), không Phần 3 (người nhận), không
// Phần 4 (QĐ), không liên hệ hồ sơ, không người thao tác, không ma_goc/hoc_vien_id. Luôn dựng object mới từ
// từng khóa được phép — KHÔNG spread dòng DB/dòng nội bộ (thêm cột sau này không tự lộ ra). Hàm thuần.
import type {
  giai_doan_tham_gia,
  trang_thai_danh_sach_truong,
  trang_thai_hop_dong,
} from '@prisma/client';
import type { DongTienDo } from './tien-do-dot.service';

export interface DongTienDoSoPhong {
  don_vi: { id: string; ma: string | null; ten: string; dia_ban: string };
  so_nguoi: number;
  tong_suat: number;
  gia_tri: number | null;
  trang_thai_danh_sach: trang_thai_danh_sach_truong;
  trang_thai_hop_dong: trang_thai_hop_dong;
  nop_luc: string | null;
  han_hieu_luc_ngay: string;
  qua_han: boolean;
  so_de_nghi_cho: number;
  thao_tac_cuoi_luc: string | null;
}

/** Khóa được phép của 1 dòng tiến độ Sở/Phòng (unit test so khớp đúng tập này). */
export const KHOA_DONG_TIEN_DO_SO_PHONG = [
  'don_vi',
  'so_nguoi',
  'tong_suat',
  'gia_tri',
  'trang_thai_danh_sach',
  'trang_thai_hop_dong',
  'nop_luc',
  'han_hieu_luc_ngay',
  'qua_han',
  'so_de_nghi_cho',
  'thao_tac_cuoi_luc',
] as const;

export function chieuSoPhong(d: DongTienDo): DongTienDoSoPhong {
  return {
    don_vi: {
      id: d.don_vi.id,
      ma: d.don_vi.ma,
      ten: d.don_vi.ten,
      dia_ban: d.don_vi.dia_ban,
    },
    so_nguoi: d.so_nguoi,
    tong_suat: d.tong_suat,
    gia_tri: d.gia_tri,
    trang_thai_danh_sach: d.trang_thai_danh_sach,
    trang_thai_hop_dong: d.trang_thai_hop_dong,
    nop_luc: d.nop_luc,
    han_hieu_luc_ngay: d.han_hieu_luc_ngay,
    qua_han: d.qua_han,
    so_de_nghi_cho: d.so_de_nghi_cho,
    thao_tac_cuoi_luc: d.thao_tac_cuoi_luc,
  };
}

/** Cột danh sách GV Sở/Phòng thấy (như trường thấy, ADR 0015 X6) — không ma_goc, hoc_vien_id, người tạo. */
export interface DongDanhSachSoPhong {
  id: string;
  ho_ten: string;
  ngay_sinh: string | null;
  gioi_tinh: string | null;
  lop: string | null;
  giai_doan: giai_doan_tham_gia;
  ty_le_suat: number;
  ghi_chu: string | null;
  y_kien_truong: string | null;
}

export const KHOA_DONG_DANH_SACH_SO_PHONG = [
  'id',
  'ho_ten',
  'ngay_sinh',
  'gioi_tinh',
  'lop',
  'giai_doan',
  'ty_le_suat',
  'ghi_chu',
  'y_kien_truong',
] as const;

/** Dòng danh_sach_tham_gia (đủ cột hoặc chỉ cột cần) → dòng Sở/Phòng. */
export function chieuDongDanhSachSoPhong(d: {
  id: string;
  ho_ten: string;
  ngay_sinh: Date | null;
  gioi_tinh: string | null;
  lop: string | null;
  giai_doan: giai_doan_tham_gia;
  ty_le_suat: { toString(): string } | number;
  ghi_chu: string | null;
  y_kien_truong: string | null;
}): DongDanhSachSoPhong {
  return {
    id: d.id,
    ho_ten: d.ho_ten,
    ngay_sinh: d.ngay_sinh ? d.ngay_sinh.toISOString().slice(0, 10) : null,
    gioi_tinh: d.gioi_tinh,
    lop: d.lop,
    giai_doan: d.giai_doan,
    ty_le_suat: Number(d.ty_le_suat),
    ghi_chu: d.ghi_chu,
    y_kien_truong: d.y_kien_truong,
  };
}
