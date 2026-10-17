import { gioVn } from '../nhac-lich/nhac-lich.util';
import { TrangThaiDiemDanh } from '../common/utils/diem-danh-bao-vang.util';

// ADR 0008 L8: điểm danh trên danh sách THEO BUỔI và tổng hợp chuyên cần trên
// danh sách LỚP của người hỗ trợ theo lớp. Hàm thuần — service nạp dữ liệu
// theo lô rồi gọi; nhãn tính ở backend để màn hình và file Excel dùng chung.

export type MaDiemDanh =
  TrangThaiDiemDanh | 'da_bao_vang' | 'chua_den_gio' | 'chua_diem_danh';

export interface DiemDanhDong {
  ma: MaDiemDanh;
  nhan: string;
  tu_diem_danh_luc: string | null;
}

export type TongDiemDanh = Record<MaDiemDanh, number>;

export const NHAN_NGUON_DIEM_DANH: Record<string, string> = {
  zoom: 'Zoom',
  ky_ten: 'Ký tên',
  qr: 'QR',
  thu_cong: 'Thủ công',
};

export interface DauVaoDiemDanh {
  diem_danh: {
    trang_thai: TrangThaiDiemDanh;
    nguon: string;
    tu_diem_danh_luc: Date | null;
  } | null;
  bao_vang: { ly_do: string } | null;
  bat_dau: Date;
  now: Date;
}

/** Trạng thái điểm danh của 1 học viên tại 1 buổi (dòng diem_danh thắng báo vắng). */
export function tinhDiemDanhDong(v: DauVaoDiemDanh): DiemDanhDong {
  const dd = v.diem_danh;
  if (dd) {
    const tu = dd.tu_diem_danh_luc?.toISOString() ?? null;
    if (dd.trang_thai === 'co_mat') {
      const nhan = dd.tu_diem_danh_luc
        ? `Có mặt – tự điểm danh ${gioVn(dd.tu_diem_danh_luc)}`
        : `Có mặt (${NHAN_NGUON_DIEM_DANH[dd.nguon] ?? dd.nguon})`;
      return { ma: 'co_mat', nhan, tu_diem_danh_luc: tu };
    }
    const nhan = dd.trang_thai === 'vang' ? 'Vắng' : 'Vắng có phép';
    return { ma: dd.trang_thai, nhan, tu_diem_danh_luc: tu };
  }
  if (v.bao_vang) {
    return {
      ma: 'da_bao_vang',
      nhan: `Đã báo vắng: ${v.bao_vang.ly_do}`,
      tu_diem_danh_luc: null,
    };
  }
  return v.bat_dau.getTime() > v.now.getTime()
    ? { ma: 'chua_den_gio', nhan: 'Chưa đến giờ', tu_diem_danh_luc: null }
    : { ma: 'chua_diem_danh', nhan: 'Chưa điểm danh', tu_diem_danh_luc: null };
}

/** Đếm theo mã trên danh sách buổi (không gồm người đổi ra). */
export function tongDiemDanh(ds: { ma: MaDiemDanh }[]): TongDiemDanh {
  const tong: TongDiemDanh = {
    co_mat: 0,
    vang: 0,
    vang_co_phep: 0,
    da_bao_vang: 0,
    chua_diem_danh: 0,
    chua_den_gio: 0,
  };
  for (const d of ds) tong[d.ma] += 1;
  return tong;
}

export interface BuoiChuyenCan {
  id: string;
  giai_doan_id: string;
  thoi_gian_bat_dau: Date;
}

export interface DauVaoChuyenCan {
  /** Buổi của lớp đang xem. */
  lich: readonly BuoiChuyenCan[];
  /** Giai đoạn mà đăng ký được phân vào lớp này. */
  giai_doan_ids: ReadonlySet<string>;
  /** Buổi nguồn (của lớp này) → buổi chốt, theo đổi buổi đã duyệt còn hiệu lực. */
  chot_cua_nguon: ReadonlyMap<string, { id: string; thoi_gian_bat_dau: Date }>;
  /** lich_hoc_id có điểm danh co_mat của đăng ký. */
  co_mat: ReadonlySet<string>;
  now: Date;
}

/**
 * Chuyên cần của 1 đăng ký trong lớp (ADR 0008 L8, khớp ADR 0007 "chuyên cần
 * tính điểm danh ở buổi chốt"): mỗi buổi L thuộc giai đoạn được phân vào lớp →
 * buổi hiệu dụng E = buổi chốt nếu đã đổi ra khỏi L, ngược lại L. Đã diễn ra
 * khi E đã bắt đầu; có mặt khi điểm danh ở E là co_mat.
 */
export function tinhChuyenCanLop(v: DauVaoChuyenCan): {
  co_mat: number;
  da_dien_ra: number;
} {
  let coMat = 0;
  let daDienRa = 0;
  for (const l of v.lich) {
    if (!v.giai_doan_ids.has(l.giai_doan_id)) continue;
    const e = v.chot_cua_nguon.get(l.id) ?? l;
    if (e.thoi_gian_bat_dau.getTime() > v.now.getTime()) continue;
    daDienRa += 1;
    if (v.co_mat.has(e.id)) coMat += 1;
  }
  return { co_mat: coMat, da_dien_ra: daDienRa };
}
