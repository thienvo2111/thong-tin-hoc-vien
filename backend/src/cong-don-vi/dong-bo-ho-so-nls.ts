// Issue #69 / ADR 0015 Y2: quy tắc thuần (không DB) đồng bộ ngược THÔNG TIN CÁ NHÂN từ dòng danh sách tham gia
// NLS về hồ sơ học viên. Chỉ 4 trường cá nhân — không bao giờ giai đoạn, suất, lớp, ghi chú, mã gốc.
// Ánh xạ ngược của chụp danh sách NLS (chup-danh-sach-nls.ts): ngày 'YYYY-MM-DD' ↔ 3 cột số, giới tính chép
// nguyên giá trị hồ sơ (mã nam/nu/khac), don_vi_id ↔ don_vi_cong_tac_id.
import { normalizeNfcName } from '../common/utils/normalize-text.util';
import { ngaySinhTuHocVien } from './chup-danh-sach-nls';

export const TRUONG_CA_NHAN = [
  'ho_ten',
  'ngay_sinh',
  'gioi_tinh',
  'don_vi_id',
] as const;
export type TruongCaNhan = (typeof TRUONG_CA_NHAN)[number];
/** Giá trị mới của các trường cá nhân thao tác chạm tới (null = để trống). */
export type GiaTriCaNhanMoi = Partial<Record<TruongCaNhan, string | null>>;

/** Giá trị cá nhân theo kiểu dòng danh sách (ngày 'YYYY-MM-DD'). */
export interface GiaTriCaNhan {
  ho_ten: string;
  ngay_sinh: string | null;
  gioi_tinh: string | null;
  don_vi_id: string;
}

/** Phần hồ sơ học viên cần để so sánh. */
export interface HoSoCaNhan {
  ho_ten: string;
  ngay_sinh: number;
  thang_sinh: number;
  nam_sinh: number;
  gioi_tinh: string | null;
  don_vi_cong_tac_id: string;
}

export interface TruongDongBo {
  truong: TruongCaNhan;
  /** Giá trị hồ sơ hiện tại (kiểu dòng danh sách). */
  cu: string | null;
  moi: string;
}

/** Kết quả đồng bộ trả kèm response Áp dụng / PATCH dòng (truong rỗng = hồ sơ đã khớp, không ghi gì). */
export interface KetQuaDongBo {
  hoc_vien_id: string;
  truong: TruongCaNhan[];
  so_truong: number;
}

/** Mã giới tính của hồ sơ (như form hồ sơ: nam / nu / khac). */
export const MA_GIOI_TINH = ['nam', 'nu', 'khac'] as const;
export const MSG_GIOI_TINH = 'Giới tính phải là Nam, Nữ hoặc Khác';

/** "Nam" / "nữ" / "NU" / "Khác"… → mã hồ sơ; không nhận ra → null. Trống → null. */
export function maGioiTinh(v: string | null | undefined): string | null {
  if (!v) return null;
  const khongDau = v.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  return (MA_GIOI_TINH as readonly string[]).includes(khongDau)
    ? khongDau
    : null;
}

/** Giới tính có gửi (khác trống) nhưng không nhận ra được. */
export function gioiTinhKhongHopLe(v: string | null | undefined): boolean {
  return !!v && v.trim() !== '' && maGioiTinh(v) === null;
}

/** Y2: các trường cá nhân thao tác đã đổi trên dòng, với giá trị mới (từ "sau" của nhật ký). */
export function giaTriCaNhanDaDoi(
  sau: Record<string, unknown> | null,
): GiaTriCaNhanMoi {
  return Object.fromEntries(
    truongCaNhanBiDoi(sau).map((k) => [k, (sau?.[k] ?? null) as string | null]),
  );
}

/** Y2: thêm vào nhật ký khi Quản trị chọn đồng bộ — chỉ tên trường, không giá trị mới. */
export function nhatKyDongBo(dongBo: KetQuaDongBo | null) {
  return dongBo
    ? { dong_bo_ho_so_hoc_vien: true, truong_dong_bo: dongBo.truong }
    : {};
}

/** Hồ sơ → giá trị cá nhân kiểu dòng danh sách (ngày không có thật → null). */
export function giaTriCaNhanCuaHoSo(hs: HoSoCaNhan): GiaTriCaNhan {
  return {
    ho_ten: hs.ho_ten,
    ngay_sinh: ngaySinhTuHocVien(hs.ngay_sinh, hs.thang_sinh, hs.nam_sinh),
    gioi_tinh: hs.gioi_tinh,
    don_vi_id: hs.don_vi_cong_tac_id,
  };
}

/** Các trường cá nhân mà 1 thao tác trên dòng đã đổi (tên cột theo dòng danh sách). */
export function truongCaNhanBiDoi(
  doi: Partial<Record<string, unknown>> | null | undefined,
): TruongCaNhan[] {
  if (!doi) return [];
  return TRUONG_CA_NHAN.filter((k) => k in doi);
}

/**
 * So `giaTriMoi` (chỉ các trường thao tác chạm tới) với hồ sơ HIỆN TẠI — không so với dòng danh sách. Trả các
 * trường thật sự khác. Giá trị mới trống (null) không xóa được thông tin hồ sơ → bỏ qua. Họ tên so sau NFC +
 * gộp khoảng trắng; giới tính so theo mã (nam/nu/khac); ngày so dạng 'YYYY-MM-DD'.
 */
export function truongCaNhanDongBo(
  hoSoHienTai: HoSoCaNhan,
  giaTriMoi: GiaTriCaNhanMoi,
): TruongDongBo[] {
  const cu = giaTriCaNhanCuaHoSo(hoSoHienTai);
  const ketQua: TruongDongBo[] = [];
  for (const truong of TRUONG_CA_NHAN) {
    const moi = giaTriMoi[truong];
    if (moi === undefined || moi === null || moi.trim() === '') continue;
    if (!khacNhau(truong, cu[truong], moi)) continue;
    ketQua.push({ truong, cu: cu[truong], moi: chuanHoa(truong, moi) });
  }
  return ketQua;
}

function chuanHoa(truong: TruongCaNhan, v: string): string {
  if (truong === 'ho_ten') return normalizeNfcName(v);
  if (truong === 'gioi_tinh') return maGioiTinh(v) ?? v.normalize('NFC').trim();
  return v.trim();
}

function khacNhau(truong: TruongCaNhan, cu: string | null, moi: string) {
  if (cu === null) return true;
  if (truong === 'gioi_tinh') {
    return (maGioiTinh(cu) ?? cu.trim()) !== chuanHoa(truong, moi);
  }
  return chuanHoa(truong, cu) !== chuanHoa(truong, moi);
}

/** Phần sửa hồ sơ (UpdateHocVienDto) từ các trường đã khác. Ngày → đủ 3 cột (lịch sử chỉ ghi cột thật đổi). */
export function suaHoSoTuDongBo(ds: readonly TruongDongBo[]): {
  ho_ten?: string;
  ngay_sinh?: number;
  thang_sinh?: number;
  nam_sinh?: number;
  gioi_tinh?: string;
  don_vi_cong_tac_id?: string;
} {
  const sua: ReturnType<typeof suaHoSoTuDongBo> = {};
  for (const { truong, moi } of ds) {
    if (truong === 'ho_ten') sua.ho_ten = moi;
    if (truong === 'gioi_tinh') sua.gioi_tinh = moi;
    if (truong === 'don_vi_id') sua.don_vi_cong_tac_id = moi;
    if (truong === 'ngay_sinh') {
      const [nam, thang, ngay] = moi.split('-').map(Number);
      Object.assign(sua, { ngay_sinh: ngay, thang_sinh: thang, nam_sinh: nam });
    }
  }
  return sua;
}
