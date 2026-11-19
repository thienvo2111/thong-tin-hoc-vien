// Issue #59 / ADR 0015 S1, S2, S3, X1: hàm thuần cho việc Quản trị sửa từng dòng danh sách tham gia.
import { GiaiDoanThamGia, TY_LE_SUAT, TyLeSuat } from './quy-tac-hop-dong';

/** Giá trị nghiệp vụ của 1 dòng (ngày dạng 'YYYY-MM-DD', suất là số) — dùng để so sánh và ghi nhật ký. */
export interface DongDanhSachGoc {
  don_vi_id: string;
  ho_ten: string;
  ngay_sinh: string | null;
  gioi_tinh: string | null;
  ma_goc: string | null;
  lop: string | null;
  giai_doan: GiaiDoanThamGia;
  ty_le_suat: TyLeSuat;
  ghi_chu: string | null;
  y_kien_truong: string | null;
}

/** Các trường Quản trị sửa được. undefined = không đổi; null = xóa (với trường cho phép trống). */
export type SuaDong = Partial<Omit<DongDanhSachGoc, 'y_kien_truong'>>;

export const TRUONG_SUA = [
  'don_vi_id',
  'ho_ten',
  'ngay_sinh',
  'gioi_tinh',
  'ma_goc',
  'lop',
  'giai_doan',
  'ty_le_suat',
  'ghi_chu',
] as const satisfies readonly (keyof SuaDong)[];

const TRUONG_SO_SANH = [...TRUONG_SUA, 'y_kien_truong'] as const;

/**
 * Gộp phần sửa vào dòng hiện có. Đổi giai đoạn mà không gửi suất → suất theo giai đoạn (S1);
 * gửi suất tường minh → giữ suất đó dù khác giai đoạn (S2/S3, vd. thay giữa chừng mỗi người 0,5).
 * Có bất kỳ thay đổi nào → dòng mất ý kiến của trường (X1).
 */
export function apDungSua(cu: DongDanhSachGoc, sua: SuaDong): DongDanhSachGoc {
  const daGui = Object.fromEntries(
    TRUONG_SUA.filter((k) => sua[k] !== undefined).map((k) => [k, sua[k]]),
  );
  const moi: DongDanhSachGoc = { ...cu, ...daGui };
  if (
    sua.giai_doan !== undefined &&
    sua.giai_doan !== cu.giai_doan &&
    sua.ty_le_suat === undefined
  ) {
    moi.ty_le_suat = TY_LE_SUAT[sua.giai_doan];
  }
  if (TRUONG_SUA.some((k) => moi[k] !== cu[k])) moi.y_kien_truong = null;
  return moi;
}

/** Trước/sau chỉ gồm các trường đã đổi; không đổi gì → null. */
export function khacBiet(
  truoc: DongDanhSachGoc,
  sau: DongDanhSachGoc,
): { truoc: Partial<DongDanhSachGoc>; sau: Partial<DongDanhSachGoc> } | null {
  const doi = TRUONG_SO_SANH.filter((k) => truoc[k] !== sau[k]);
  if (doi.length === 0) return null;
  return {
    truoc: Object.fromEntries(doi.map((k) => [k, truoc[k]])),
    sau: Object.fromEntries(doi.map((k) => [k, sau[k]])),
  };
}

const DO_DAI_SLUG = 60;

/** Tên đợt → slug ASCII cho tên file: bỏ dấu, đ→d, chữ thường, ký tự khác → '-'. */
export function slugTenDot(ten: string): string {
  const s = ten
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, DO_DAI_SLUG)
    .replace(/-+$/, '');
  return s || 'dot';
}

const LECH_GIO_VN_MS = 7 * 60 * 60 * 1000;

/** danh-sach-<slug đợt>-<YYYYMMDD theo giờ Việt Nam>.xlsx */
export function tenFileXuatDanhSach(tenDot: string, luc: Date): string {
  const ngay = new Date(luc.getTime() + LECH_GIO_VN_MS)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '');
  return `danh-sach-${slugTenDot(tenDot)}-${ngay}.xlsx`;
}
