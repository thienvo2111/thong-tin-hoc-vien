// Module thuần "Quy tắc hợp đồng" (ADR 0015, issue #58): không truy cập DB,
// không DI — chỉ hàm thuần để test đơn vị và dùng lại ở mọi lát sau.

export type GiaiDoanThamGia = 'ca_hai' | 'chi_gd1' | 'chi_gd2';
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
