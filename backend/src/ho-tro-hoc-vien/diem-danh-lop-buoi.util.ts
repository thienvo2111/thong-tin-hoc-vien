import { gioVn } from '../nhac-lich/nhac-lich.util';
import { TrangThaiDiemDanh } from '../common/utils/diem-danh-bao-vang.util';
import { khoaBuoi } from '../common/utils/chuyen-can.util';

// ADR 0008 L8: điểm danh trên danh sách THEO BUỔI và tổng hợp chuyên cần trên
// danh sách LỚP của người hỗ trợ theo lớp. Hàm thuần — service nạp dữ liệu
// theo lô rồi gọi; nhãn tính ở backend để màn hình và file Excel dùng chung.
// ADR 0010 T7: trạng thái 1 buổi = kết quả tinhChuyenCan (ADR 0005 Z8) của
// (giai_doan, buoi_so) — tính cả học bù / lớp cũ theo chế độ của khóa.

export type MaDiemDanh =
  TrangThaiDiemDanh | 'da_bao_vang' | 'chua_den_gio' | 'chua_diem_danh';

/**
 * Lớp của dòng điểm danh được tính (ADR 0010 T7): lop_hien_tai = lớp đang
 * được phân ở giai đoạn đó (gồm buổi chốt của đổi buổi); lop_khac = lớp khác
 * (học bù hoặc lớp cũ trước khi chuyển lớp — dữ liệu không lưu lịch sử phân
 * lớp nên không tách được hai trường hợp).
 */
export type NguonTinh = 'lop_hien_tai' | 'lop_khac';

export interface DiemDanhDong {
  ma: MaDiemDanh;
  nhan: string;
  tu_diem_danh_luc: string | null;
  /** null khi chưa có dòng điểm danh được tính. */
  nguon_tinh: NguonTinh | null;
  lop_tinh: { id: string; ten_lop: string } | null;
}

export type TongDiemDanh = Record<MaDiemDanh, number>;

export const NHAN_NGUON_DIEM_DANH: Record<string, string> = {
  zoom: 'Zoom',
  ky_ten: 'Ký tên',
  qr: 'QR',
  thu_cong: 'Thủ công',
};

/** Kết quả tinhChuyenCan của 1 buổi kèm dòng diem_danh được chọn. */
export interface KetQuaBuoiDiemDanh {
  trang_thai: TrangThaiDiemDanh;
  tu_lop_cu: boolean;
  dong: {
    lop_id: string;
    ten_lop: string;
    nguon: string;
    tu_diem_danh_luc: Date | null;
  };
}

export interface DauVaoDiemDanh {
  /** Kết quả tinhChuyenCan của (giai_doan, buoi_so) — null nếu không có. */
  ket_qua: KetQuaBuoiDiemDanh | null | undefined;
  /** Báo vắng ở buổi hiệu dụng. */
  bao_vang: { ly_do: string } | null;
  /** Giờ bắt đầu buổi hiệu dụng. */
  bat_dau: Date;
  now: Date;
}

export const nhanCoKetQua = (kq: KetQuaBuoiDiemDanh): string => {
  const { dong } = kq;
  if (kq.tu_lop_cu) {
    if (kq.trang_thai === 'co_mat') return `Có mặt – ở lớp ${dong.ten_lop}`;
    if (kq.trang_thai === 'vang_co_phep') {
      return `Vắng có phép – ở lớp ${dong.ten_lop}`;
    }
    return 'Vắng';
  }
  if (kq.trang_thai === 'co_mat') {
    return dong.tu_diem_danh_luc
      ? `Có mặt – tự điểm danh ${gioVn(dong.tu_diem_danh_luc)}`
      : `Có mặt (${NHAN_NGUON_DIEM_DANH[dong.nguon] ?? dong.nguon})`;
  }
  return kq.trang_thai === 'vang' ? 'Vắng' : 'Vắng có phép';
};

/**
 * Trạng thái điểm danh của 1 học viên tại 1 buổi: có kết quả tinhChuyenCan
 * thì dùng (thắng báo vắng); không có → báo vắng ở buổi hiệu dụng → chưa đến
 * giờ / chưa điểm danh.
 */
export function tinhDiemDanhDong(v: DauVaoDiemDanh): DiemDanhDong {
  const kq = v.ket_qua;
  if (kq) {
    return {
      ma: kq.trang_thai,
      nhan: nhanCoKetQua(kq),
      tu_diem_danh_luc: kq.dong.tu_diem_danh_luc?.toISOString() ?? null,
      nguon_tinh: kq.tu_lop_cu ? 'lop_khac' : 'lop_hien_tai',
      lop_tinh: { id: kq.dong.lop_id, ten_lop: kq.dong.ten_lop },
    };
  }
  const chuaCo = { tu_diem_danh_luc: null, nguon_tinh: null, lop_tinh: null };
  if (v.bao_vang) {
    return {
      ma: 'da_bao_vang',
      nhan: `Đã báo vắng: ${v.bao_vang.ly_do}`,
      ...chuaCo,
    };
  }
  return v.bat_dau.getTime() > v.now.getTime()
    ? { ma: 'chua_den_gio', nhan: 'Chưa đến giờ', ...chuaCo }
    : { ma: 'chua_diem_danh', nhan: 'Chưa điểm danh', ...chuaCo };
}

/**
 * ADR 0010 T7: buổi đã được tính có mặt nhờ dòng ở lớp khác → người hỗ trợ
 * không điểm danh bổ sung (trả lý do), null nếu không chặn.
 */
export function lyDoDaCoMatLopKhac(d: DiemDanhDong): string | null {
  return d.ma === 'co_mat' && d.nguon_tinh === 'lop_khac' && d.lop_tinh
    ? `Đã có mặt ở lớp ${d.lop_tinh.ten_lop} (học bù/lớp cũ)`
    : null;
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
  buoi_so: number;
  thoi_gian_bat_dau: Date;
}

export interface DauVaoChuyenCan {
  /** Buổi của lớp đang xem. */
  lich: readonly BuoiChuyenCan[];
  /** Giai đoạn mà đăng ký được phân vào lớp này. */
  giai_doan_ids: ReadonlySet<string>;
  /** Buổi nguồn (của lớp này) → buổi chốt, theo đổi buổi đã duyệt còn hiệu lực. */
  chot_cua_nguon: ReadonlyMap<string, { id: string; thoi_gian_bat_dau: Date }>;
  /** Kết quả tinhChuyenCan của đăng ký: khoaBuoi(giai_doan, buoi_so) → trạng thái. */
  ket_qua: ReadonlyMap<
    string,
    { trang_thai: TrangThaiDiemDanh; tu_lop_cu?: boolean }
  >;
  now: Date;
}

/** Buổi hiệu dụng của 1 buổi nguồn L (ADR 0007/0008 L8, ADR 0010 T3). */
export interface CapBuoiHieuDung<L, C> {
  nguon: L;
  /** Buổi chốt nếu đã đổi ra khỏi L (đổi buổi da_duyet còn hiệu lực), ngược lại chính L. */
  hieu_dung: L | C;
  doi_buoi: boolean;
}

/**
 * Hàm dùng chung cho chuyên cần trong lớp (L8) và tình hình đi học (ADR
 * 0010): mỗi buổi L thuộc giai đoạn được phân vào lớp → buổi hiệu dụng E =
 * buổi chốt nếu đã đổi ra khỏi L, ngược lại L.
 */
export function buoiHieuDung<
  L extends BuoiChuyenCan,
  C extends { id: string; thoi_gian_bat_dau: Date },
>(v: {
  lich: readonly L[];
  giai_doan_ids: ReadonlySet<string>;
  chot_cua_nguon: ReadonlyMap<string, C>;
}): CapBuoiHieuDung<L, C>[] {
  return v.lich
    .filter((l) => v.giai_doan_ids.has(l.giai_doan_id))
    .map((l) => {
      const chot = v.chot_cua_nguon.get(l.id);
      return { nguon: l, hieu_dung: chot ?? l, doi_buoi: !!chot };
    });
}

/**
 * Chuyên cần của 1 đăng ký trong lớp (ADR 0008 L8, ADR 0010 T7): mỗi buổi L
 * thuộc giai đoạn được phân vào lớp → buổi hiệu dụng E = buổi chốt nếu đã đổi
 * ra khỏi L, ngược lại L. Đã diễn ra khi E đã bắt đầu; có mặt khi
 * tinhChuyenCan của (giai_doan, buoi_so) của L là co_mat (buổi chốt, học bù,
 * lớp cũ theo chế độ của khóa).
 */
export function tinhChuyenCanLop(v: DauVaoChuyenCan): {
  co_mat: number;
  da_dien_ra: number;
} {
  let coMat = 0;
  let daDienRa = 0;
  for (const { nguon: l, hieu_dung: e } of buoiHieuDung(v)) {
    const kq = v.ket_qua.get(khoaBuoi(l.giai_doan_id, l.buoi_so));
    // Kết quả từ lớp cũ (đã học xong ở đó) → đã diễn ra dù E còn ở tương lai.
    if (!kq?.tu_lop_cu && e.thoi_gian_bat_dau.getTime() > v.now.getTime()) {
      continue;
    }
    daDienRa += 1;
    if (kq?.trang_thai === 'co_mat') coMat += 1;
  }
  return { co_mat: coMat, da_dien_ra: daDienRa };
}

/** Tổng tình hình đi học của 1 đăng ký (ADR 0010 T3) — buổi hiệu dụng đã bắt đầu hoặc tính từ lớp cũ. */
export interface TongDiHoc {
  da_dien_ra: number;
  co_mat: number;
  vang: number;
  vang_co_phep: number;
  da_bao_vang: number;
  chua_diem_danh: number;
}

export function tongDiHoc(
  ds: readonly {
    ma: MaDiemDanh;
    bat_dau: Date;
    nguon_tinh?: NguonTinh | null;
  }[],
  now: Date,
): TongDiHoc {
  const tong: TongDiHoc = {
    da_dien_ra: 0,
    co_mat: 0,
    vang: 0,
    vang_co_phep: 0,
    da_bao_vang: 0,
    chua_diem_danh: 0,
  };
  for (const d of ds) {
    // Kết quả từ lớp cũ (đã học xong ở đó) → đã diễn ra dù buổi hiệu dụng
    // còn ở tương lai (vd học bù chưa tới, lịch lớp mới muộn hơn).
    if (d.nguon_tinh !== 'lop_khac' && d.bat_dau.getTime() > now.getTime()) {
      continue;
    }
    tong.da_dien_ra += 1;
    if (d.ma !== 'chua_den_gio') tong[d.ma] += 1;
  }
  return tong;
}
