// Module thuần "Quy tắc hợp đồng" (ADR 0015, issue #58): không truy cập DB,
// không DI — chỉ hàm thuần để test đơn vị và dùng lại ở mọi lát sau.
import { isISO8601 } from 'class-validator';
import type { DongDanhSachGoc } from './sua-dong-danh-sach';

export type GiaiDoanThamGia = 'ca_hai' | 'chi_gd1' | 'chi_gd2';

/** Ngày dạng 'YYYY-MM-DD' (dùng chung DTO + kiểm giá trị đề nghị). */
export const NGAY = /^\d{4}-\d{2}-\d{2}$/;
export type TyLeSuat = 1 | 0.5;

/** ADR 0015 S1: học đủ mọi giai đoạn = 1 suất; chỉ một giai đoạn (GĐ1 hay GĐ2) = 0,5. */
export const TY_LE_SUAT: Record<GiaiDoanThamGia, TyLeSuat> = {
  ca_hai: 1,
  chi_gd1: 0.5,
  chi_gd2: 0.5,
};

/** Số nửa suất (0,5 → 1; 1 → 2) — tính bằng số nguyên để cộng dồn không lệch số thực. */
function soNuaSuat(suat: number): number {
  return Math.round(suat * 2);
}

/** ADR 0015 S1/X6: tổng suất của danh sách, chính xác tuyệt đối (0,5 + 0,5 + 1 = 2). */
export function tongSuat(dong: readonly { ty_le_suat: number }[]): number {
  return dong.reduce((t, d) => t + soNuaSuat(d.ty_le_suat), 0) / 2;
}

/**
 * ADR 0015 S5: giá trị tạm tính = tổng suất × đơn giá, làm tròn đến đồng theo quy tắc nửa lên
 * (x,5 đồng → x+1). Tính trên số nửa suất (số nguyên) nên không lệch số thực. Chưa có đơn giá → null.
 */
export function giaTriTamTinh(
  tongSuat: number,
  donGia: number | null,
): number | null {
  if (donGia === null) return null;
  return Math.round((soNuaSuat(tongSuat) * donGia) / 2);
}

export class GiaiDoanKhongHopLeError extends Error {
  constructor(public readonly giaTri: string) {
    super(
      `Giai đoạn tham gia "${giaTri}" không hợp lệ — dùng Cả 2 / Chỉ GĐ1 / Chỉ GĐ2 (để trống = Cả 2)`,
    );
    this.name = 'GiaiDoanKhongHopLeError';
  }
}

/** Bỏ dấu, đ→d, chữ thường, bỏ mọi ký tự không phải chữ/số: "Chỉ GĐ 1" → "chigd1". */
function rutGon(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const BIEN_THE_GIAI_DOAN: Record<string, GiaiDoanThamGia> = {
  ca2: 'ca_hai',
  cahai: 'ca_hai',
  ca2gd: 'ca_hai',
  cahaigd: 'ca_hai',
  ca2giaidoan: 'ca_hai',
  cahaigiaidoan: 'ca_hai',
  chigd1: 'chi_gd1',
  chigiaidoan1: 'chi_gd1',
  gd1: 'chi_gd1',
  giaidoan1: 'chi_gd1',
  chigd2: 'chi_gd2',
  chigiaidoan2: 'chi_gd2',
  gd2: 'chi_gd2',
  giaidoan2: 'chi_gd2',
};

/** ADR 0015 S3: cột "Giai đoạn tham gia" → giai đoạn + suất; trống = cả hai. Giá trị lạ → GiaiDoanKhongHopLeError. */
export function suatTuGiaiDoan(giaTri: string | null | undefined): {
  giai_doan: GiaiDoanThamGia;
  ty_le_suat: TyLeSuat;
} {
  const khoa = rutGon(giaTri ?? '');
  const giai_doan = khoa === '' ? 'ca_hai' : BIEN_THE_GIAI_DOAN[khoa];
  if (!giai_doan) throw new GiaiDoanKhongHopLeError(String(giaTri).trim());
  return { giai_doan, ty_le_suat: TY_LE_SUAT[giai_doan] };
}

// Kiểu bỏ dấu thanh cũ ("hoà", "thuý") → kiểu mới ("hòa", "thúy"): cùng một tên, khác mã Unicode.
const DAU_THANH_CU: [RegExp, string][] = [
  [/oà/g, 'òa'],
  [/oá/g, 'óa'],
  [/oả/g, 'ỏa'],
  [/oã/g, 'õa'],
  [/oạ/g, 'ọa'],
  [/oè/g, 'òe'],
  [/oé/g, 'óe'],
  [/oẻ/g, 'ỏe'],
  [/oẽ/g, 'õe'],
  [/oẹ/g, 'ọe'],
  [/uỳ/g, 'ùy'],
  [/uý/g, 'úy'],
  [/uỷ/g, 'ủy'],
  [/uỹ/g, 'ũy'],
  [/uỵ/g, 'ụy'],
];

// Dấu câu coi như khoảng trắng.
const DAU_CAU = /[.,;:\-–—()/\\'"“”‘’]/g;

/**
 * Khóa so khớp tên trường: NFC, chữ thường, bỏ "trường" ở đầu, '&' ≡ 'và', 'pt' ≡ 'phổ thông',
 * 'DTNT' / 'DT NT' / 'Dân tộc nội trú' ≡ 'dtnt', bỏ dấu câu, gọn khoảng trắng, đ ≡ d.
 * Các dấu tiếng Việt khác vẫn phân biệt (Mỹ Hòa ≠ Mỹ Hà).
 */
export function chuanHoaTenTruong(ten: string): string {
  let s = ten.normalize('NFC').toLowerCase().replace(/đ/g, 'd');
  for (const [cu, moi] of DAU_THANH_CU) s = s.replace(cu, moi);
  s = s.replace(/&/g, ' và ').replace(DAU_CAU, ' ');
  const tu = s.split(/\s+/).filter(Boolean);
  if (tu[0] === 'trường' && tu.length > 1) tu.shift();

  const ra: string[] = [];
  for (let i = 0; i < tu.length; i++) {
    if (tu[i] === 'dt' && tu[i + 1] === 'nt') {
      ra.push('dtnt');
      i++;
    } else if (tu.slice(i, i + 4).join(' ') === 'dân tộc nội trú') {
      ra.push('dtnt');
      i += 3;
    } else if (tu[i] === 'pt') {
      ra.push('phổ', 'thông');
    } else {
      ra.push(tu[i]);
    }
  }
  return ra.join(' ');
}

export interface TruongPhamVi {
  id: string;
  ma_don_vi: string | null;
  ten_don_vi: string;
}

export type TrangThaiKhop =
  'khop_ma' | 'khop_ten' | 'khong_khop' | 'thieu_truong' | 'nhieu_ket_qua';

export interface KetQuaKhop {
  trang_thai: TrangThaiKhop;
  don_vi_id?: string;
}

interface ChiMuc {
  theoMa: Map<string, TruongPhamVi>;
  theoTen: Map<string, TruongPhamVi[]>;
}

// Chỉ mục dựng 1 lần cho mỗi mảng phạm vi (file vài nghìn dòng × vài trăm trường).
const BO_NHO_CHI_MUC = new WeakMap<readonly TruongPhamVi[], ChiMuc>();

function chiMuc(ds: readonly TruongPhamVi[]): ChiMuc {
  const coSan = BO_NHO_CHI_MUC.get(ds);
  if (coSan) return coSan;
  const moi: ChiMuc = { theoMa: new Map(), theoTen: new Map() };
  for (const t of ds) {
    const ma = t.ma_don_vi?.trim().toLowerCase();
    if (ma) moi.theoMa.set(ma, t);
    const ten = chuanHoaTenTruong(t.ten_don_vi);
    moi.theoTen.set(ten, [...(moi.theoTen.get(ten) ?? []), t]);
  }
  BO_NHO_CHI_MUC.set(ds, moi);
  return moi;
}

/**
 * ADR 0015 T7: khớp trường của 1 dòng trong danh sách trường thuộc phạm vi Sở của đợt (người gọi chỉ
 * truyền trường trong phạm vi — hàm không bao giờ trả trường ngoài danh sách). Mã trường thắng nếu có
 * trong phạm vi; không thì so tên đã chuẩn hóa; trùng tên > 1 trường → nhieu_ket_qua (chọn tay).
 */
export function khopTruong(
  dong: { ma_truong?: string | null; ten_truong?: string | null },
  truongTrongPhamVi: readonly TruongPhamVi[],
): KetQuaKhop {
  const ma = (dong.ma_truong ?? '').trim().toLowerCase();
  const ten = (dong.ten_truong ?? '').trim();
  if (!ma && !ten) return { trang_thai: 'thieu_truong' };

  const { theoMa, theoTen } = chiMuc(truongTrongPhamVi);
  const theoMaKhop = ma ? theoMa.get(ma) : undefined;
  if (theoMaKhop) return { trang_thai: 'khop_ma', don_vi_id: theoMaKhop.id };
  if (!ten) return { trang_thai: 'khong_khop' };

  const ungVien = theoTen.get(chuanHoaTenTruong(ten)) ?? [];
  if (ungVien.length === 1) {
    return { trang_thai: 'khop_ten', don_vi_id: ungVien[0].id };
  }
  return { trang_thai: ungVien.length > 1 ? 'nhieu_ket_qua' : 'khong_khop' };
}

// Issue #61 / ADR 0015 X1, X2: ý kiến của trường trên từng dòng + trạng thái danh sách của trường.
// danh_sach_tham_gia.y_kien_truong chỉ giữ NULL (chưa có ý kiến) | 'dong_y' | 'khong_dong_y'.
export const Y_KIEN_TRUONG = ['dong_y', 'khong_dong_y'] as const;
export type YKienTruong = (typeof Y_KIEN_TRUONG)[number];
export type TrangThaiDanhSach = 'cho_xac_nhan' | 'da_xac_nhan' | 'bao_sai_lech';

/** Còn "sai lệch đang mở": có dòng Không đồng ý hoặc còn đề nghị sửa chờ HCMUE xử lý (issue #62). */
function conSaiLechMo(
  yKiens: readonly (YKienTruong | null)[],
  soDeNghiCho: number,
): boolean {
  return soDeNghiCho > 0 || yKiens.some((y) => y === 'khong_dong_y');
}

/**
 * X1: trạng thái sau khi trường đổi ý kiến 1 dòng (hoặc Đồng ý tất cả, gửi đề nghị). Có dòng Không đồng ý
 * hoặc còn đề nghị chờ (#62) → Báo sai lệch; hết → từ Báo sai lệch về Chờ xác nhận; Đã xác nhận mà có dòng
 * không còn Đồng ý → Chờ xác nhận. Còn lại giữ nguyên (mọi dòng Đồng ý vẫn phải bấm Xác nhận).
 */
export function trangThaiSauYKien(
  yKiens: readonly (YKienTruong | null)[],
  hienTai: TrangThaiDanhSach,
  soDeNghiCho = 0,
): TrangThaiDanhSach {
  if (conSaiLechMo(yKiens, soDeNghiCho)) return 'bao_sai_lech';
  if (hienTai === 'bao_sai_lech') return 'cho_xac_nhan';
  if (hienTai === 'da_xac_nhan' && !yKiens.every((y) => y === 'dong_y')) {
    return 'cho_xac_nhan';
  }
  return hienTai;
}

export type KetQuaKiemTraXacNhan =
  { hopLe: true } | { hopLe: false; lyDo: string };

/**
 * X2: Xác nhận danh sách chỉ hợp lệ khi có ≥ 1 dòng, mọi dòng Đồng ý và không còn đề nghị sửa chờ
 * (soDeNghiCho = số đề nghị 'cho' của trường trong đợt, kể cả đề nghị thêm người — issue #62).
 */
export function kiemTraXacNhan(
  yKiens: readonly (YKienTruong | null)[],
  soDeNghiCho = 0,
): KetQuaKiemTraXacNhan {
  if (yKiens.length === 0) return { hopLe: false, lyDo: 'Danh sách trống' };
  const chuaDongY = yKiens.filter((y) => y !== 'dong_y').length;
  if (chuaDongY > 0) {
    return { hopLe: false, lyDo: `Còn ${chuaDongY} dòng chưa Đồng ý` };
  }
  if (soDeNghiCho > 0) {
    return { hopLe: false, lyDo: 'Còn đề nghị sửa đang chờ' };
  }
  return { hopLe: true };
}

/**
 * X1: Quản trị tự sửa/thêm/xóa/nạp lại danh sách của 1 trường → Chờ xác nhận từ mọi trạng thái — trừ khi
 * sau thao tác trường vẫn còn dòng Không đồng ý hoặc đề nghị chờ (#62): khi đó Báo sai lệch (không bao giờ
 * hiện "Chờ xác nhận" khi còn sai lệch đang mở). yKiens = ý kiến các dòng của trường SAU thao tác.
 */
export function trangThaiSauQuanTriSua(
  yKiens: readonly (YKienTruong | null)[],
  soDeNghiCho = 0,
): TrangThaiDanhSach {
  return conSaiLechMo(yKiens, soDeNghiCho) ? 'bao_sai_lech' : 'cho_xac_nhan';
}

/**
 * X2 (issue #62): sau khi Quản trị Áp dụng / Từ chối 1 đề nghị — KHÔNG đặt lại kiểu X1 (các dòng khác giữ
 * ý kiến). Còn dòng Không đồng ý hoặc đề nghị chờ → Báo sai lệch; không → Chờ xác nhận (trường bấm Xác nhận
 * lại). yKiens / soDeNghiCho tính SAU khi xử lý.
 */
export function trangThaiSauXuLyDeNghi(
  yKiens: readonly (YKienTruong | null)[],
  soDeNghiCho: number,
): TrangThaiDanhSach {
  return conSaiLechMo(yKiens, soDeNghiCho) ? 'bao_sai_lech' : 'cho_xac_nhan';
}

// Issue #62 / ADR 0015 X2: đề nghị sửa/thêm/bớt người của trường.
export const LOAI_DE_NGHI = ['sua', 'them', 'bot'] as const;
export type LoaiDeNghi = (typeof LOAI_DE_NGHI)[number];
export const TRANG_THAI_DE_NGHI = ['cho', 'da_ap_dung', 'tu_choi'] as const;
export type TrangThaiDeNghi = (typeof TRANG_THAI_DE_NGHI)[number];

/**
 * Thông tin trường được đề nghị. Suất, trường (don_vi_id), mã gốc, ghi chú là của HCMUE — trường không đề
 * nghị được (đổi giai đoạn thì Áp dụng suy lại suất, S1/S3).
 */
export const TRUONG_DE_NGHI = [
  'ho_ten',
  'ngay_sinh',
  'gioi_tinh',
  'lop',
  'giai_doan',
] as const;
export type TruongDeNghi = (typeof TRUONG_DE_NGHI)[number];
export type GiaTriDeNghi = Partial<Pick<DongDanhSachGoc, TruongDeNghi>>;
/** Giá trị dòng hiện tại để so sánh (ngày dạng 'YYYY-MM-DD'). */
export type DongDeNghi = Pick<DongDanhSachGoc, TruongDeNghi>;

export type KetQuaGiaTriDeNghi =
  { hopLe: true; giaTri: GiaTriDeNghi } | { hopLe: false; lyDo: string };

type KetQuaTruong =
  { hopLe: true; giaTri: unknown } | { hopLe: false; lyDo: string };

const loiDeNghi = (lyDo: string) => ({ hopLe: false as const, lyDo });
const dung = (giaTri: unknown): KetQuaTruong => ({ hopLe: true, giaTri });

const MSG_HO_TEN = 'Họ tên không được trống, tối đa 255 ký tự';
const MSG_NGAY_SINH = 'Ngày sinh phải là ngày dạng YYYY-MM-DD';
const MSG_GIAI_DOAN = 'Giai đoạn phải là ca_hai, chi_gd1 hoặc chi_gd2';
const MSG_KHONG_DOI = 'Không có thay đổi nào so với dòng hiện tại';
// Giới hạn = độ dài cột danh_sach_tham_gia (VARCHAR), giống DTO Quản trị sửa dòng.
const DO_DAI: Record<'gioi_tinh' | 'lop', [number, string]> = {
  gioi_tinh: [20, 'Giới tính'],
  lop: [100, 'Lớp/môn'],
};

/** Chuỗi tùy chọn: trim, trống → null, quá dài → lỗi. */
function chuoiHoacNull(v: unknown, k: 'gioi_tinh' | 'lop'): KetQuaTruong {
  const [toiDa, nhan] = DO_DAI[k];
  if (v === null) return dung(null);
  if (typeof v !== 'string') return loiDeNghi(`${nhan} phải là chuỗi`);
  const s = v.trim();
  if (s.length > toiDa) return loiDeNghi(`${nhan} tối đa ${toiDa} ký tự`);
  return dung(s === '' ? null : s);
}

/** Cùng quy tắc ngày như DTO (NGAY + ISO 8601 strict); null / '' = để trống. */
function ngayHoacNull(v: unknown): KetQuaTruong {
  if (v === null || v === '') return dung(null);
  const hopLe =
    typeof v === 'string' && NGAY.test(v) && isISO8601(v, { strict: true });
  return hopLe ? dung(v) : loiDeNghi(MSG_NGAY_SINH);
}

function chuanHoaTruong(k: TruongDeNghi, v: unknown): KetQuaTruong {
  if (k === 'ho_ten') {
    const s = typeof v === 'string' ? v.trim() : '';
    return s.length >= 1 && s.length <= 255 ? dung(s) : loiDeNghi(MSG_HO_TEN);
  }
  if (k === 'ngay_sinh') return ngayHoacNull(v);
  if (k === 'giai_doan') {
    const hopLe = typeof v === 'string' && Object.keys(TY_LE_SUAT).includes(v);
    return hopLe ? dung(v) : loiDeNghi(MSG_GIAI_DOAN);
  }
  return chuoiHoacNull(v, k);
}

/**
 * X2: kiểm + chuẩn hóa giá trị đề nghị của trường.
 * - bot: không kèm giá trị ({}).
 * - sua: một phần của TRUONG_DE_NGHI; trả CHỈ các trường khác dòng hiện tại; không khác gì → lỗi.
 * - them: bắt buộc họ tên; ô trống → null; giai đoạn mặc định Cả 2.
 */
export function kiemTraGiaTriDeNghi(
  loai: LoaiDeNghi,
  giaTri: unknown,
  dongHienTai?: DongDeNghi,
): KetQuaGiaTriDeNghi {
  const goc = giaTri ?? {};
  if (typeof goc !== 'object' || Array.isArray(goc)) {
    return loiDeNghi('Giá trị đề nghị không hợp lệ');
  }
  const khoa = Object.keys(goc);
  if (loai === 'bot') {
    return khoa.length === 0
      ? { hopLe: true, giaTri: {} }
      : loiDeNghi('Đề nghị bớt người không kèm giá trị');
  }
  const la = khoa.find(
    (k) => !(TRUONG_DE_NGHI as readonly string[]).includes(k),
  );
  if (la !== undefined) {
    return loiDeNghi(
      `Không đề nghị được "${la}" — chỉ đề nghị họ tên, ngày sinh, giới tính, lớp/môn, giai đoạn`,
    );
  }
  const moi: Record<string, unknown> = {};
  for (const k of khoa as TruongDeNghi[]) {
    const kq = chuanHoaTruong(k, (goc as Record<string, unknown>)[k]);
    if ('lyDo' in kq) return kq;
    moi[k] = kq.giaTri;
  }

  if (loai === 'them') {
    if (moi.ho_ten === undefined) return loiDeNghi(MSG_HO_TEN);
    const giaTriThem: GiaTriDeNghi = {
      ho_ten: moi.ho_ten as string,
      ngay_sinh: (moi.ngay_sinh ?? null) as string | null,
      gioi_tinh: (moi.gioi_tinh ?? null) as string | null,
      lop: (moi.lop ?? null) as string | null,
      giai_doan: (moi.giai_doan ?? 'ca_hai') as GiaiDoanThamGia,
    };
    return { hopLe: true, giaTri: giaTriThem };
  }

  if (!dongHienTai) return loiDeNghi(MSG_KHONG_DOI);
  const doi = Object.fromEntries(
    Object.entries(moi).filter(
      ([k, v]) => v !== dongHienTai[k as TruongDeNghi],
    ),
  );
  if (Object.keys(doi).length === 0) return loiDeNghi(MSG_KHONG_DOI);
  return { hopLe: true, giaTri: doi as GiaTriDeNghi };
}
