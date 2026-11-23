// Issue #69 / ADR 0015 Y2: so thông tin cá nhân mới của dòng NLS với hồ sơ học viên hiện tại — bản sao của
// backend/src/cong-don-vi/dong-bo-ho-so-nls.ts (truongCaNhanDongBo, maGioiTinh). Sửa ở đây thì sửa cả bên backend.
// Chỉ 4 trường cá nhân; giai đoạn, suất, lớp, ghi chú, mã gốc không bao giờ đồng bộ.
import { dinhDangNgayLich } from './ngayLich';

export const TRUONG_CA_NHAN = ['ho_ten', 'ngay_sinh', 'gioi_tinh', 'don_vi_id'] as const;
export type TruongCaNhan = (typeof TRUONG_CA_NHAN)[number];

/** Giá trị mới của các trường cá nhân thao tác chạm tới (null = để trống). */
export type GiaTriCaNhanMoi = Partial<Record<TruongCaNhan, string | null>>;

/** GET /cong-don-vi/danh-sach-tham-gia/:dongId/ho-so-hoc-vien. */
export interface HoSoHocVienNls {
  hoc_vien_id: string;
  ho_ten: string;
  ngay_sinh: string | null;
  /** Mã hồ sơ: nam / nu / khac. */
  gioi_tinh: string | null;
  don_vi: { id: string; ten: string };
}

export interface TruongKhacHoSo {
  truong: TruongCaNhan;
  cu: string | null;
  moi: string;
}

export const NHAN_TRUONG_CA_NHAN: Record<TruongCaNhan, string> = {
  ho_ten: 'Họ tên',
  ngay_sinh: 'Ngày sinh',
  gioi_tinh: 'Giới tính',
  don_vi_id: 'Trường công tác',
};

const MA_GIOI_TINH = ['nam', 'nu', 'khac'];
const NHAN_GIOI_TINH: Record<string, string> = { nam: 'Nam', nu: 'Nữ', khac: 'Khác' };

/** "Nam" / "nữ" / "NU" / "Khác"… → mã hồ sơ; không nhận ra / trống → null. */
export function maGioiTinh(v: string | null | undefined): string | null {
  if (!v) return null;
  const khongDau = v.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  return MA_GIOI_TINH.includes(khongDau) ? khongDau : null;
}

const chuanTen = (v: string) => v.normalize('NFC').trim().replace(/\s+/g, ' ');

function chuanHoa(truong: TruongCaNhan, v: string): string {
  if (truong === 'ho_ten') return chuanTen(v);
  if (truong === 'gioi_tinh') return maGioiTinh(v) ?? v.normalize('NFC').trim();
  return v.trim();
}

function giaTriHoSo(hs: HoSoHocVienNls, truong: TruongCaNhan): string | null {
  if (truong === 'don_vi_id') return hs.don_vi.id;
  return hs[truong];
}

/** So với hồ sơ HIỆN TẠI; giá trị mới trống không xóa được hồ sơ → bỏ qua. Chỉ trả trường thật sự khác. */
export function truongKhacHoSo(hoSo: HoSoHocVienNls, giaTriMoi: GiaTriCaNhanMoi): TruongKhacHoSo[] {
  const ketQua: TruongKhacHoSo[] = [];
  for (const truong of TRUONG_CA_NHAN) {
    const moi = giaTriMoi[truong];
    if (moi === undefined || moi === null || moi.trim() === '') continue;
    const cu = giaTriHoSo(hoSo, truong);
    const cuChuan = cu === null ? null : truong === 'gioi_tinh' ? (maGioiTinh(cu) ?? cu.trim()) : chuanHoa(truong, cu);
    if (cuChuan === chuanHoa(truong, moi)) continue;
    ketQua.push({ truong, cu, moi: chuanHoa(truong, moi) });
  }
  return ketQua;
}

/** Chỉ các trường cá nhân có trong phần đổi (theo tên cột dòng danh sách). */
export function giaTriCaNhanTu(doi: Partial<Record<string, unknown>>): GiaTriCaNhanMoi {
  return Object.fromEntries(TRUONG_CA_NHAN.filter((k) => k in doi).map((k) => [k, (doi[k] ?? null) as string | null]));
}

/** Hiển thị 1 giá trị: ngày dd/mm/yyyy, giới tính theo nhãn, trường theo tên (nếu biết); trống → '—'. */
export function hienThiTruongCaNhan(
  truong: TruongCaNhan,
  v: string | null,
  tenTruong: (id: string) => string | undefined = () => undefined,
): string {
  if (v === null || v === '') return '—';
  if (truong === 'ngay_sinh') return dinhDangNgayLich(v);
  if (truong === 'gioi_tinh') return NHAN_GIOI_TINH[maGioiTinh(v) ?? ''] ?? v;
  if (truong === 'don_vi_id') return tenTruong(v) ?? v;
  return v;
}
