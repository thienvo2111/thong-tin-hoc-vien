// Issue #63 / ADR 0015 M4, U2, X4: quy tắc Hồ sơ đơn vị — bản sao y hệt
// backend/src/cong-don-vi/ho-so-don-vi.quy-tac.ts (cùng regex, cùng thông điệp, cùng bộ trường).
// Sửa ở đây thì sửa cả bên backend.

export type NhomHoSo = 'don_vi' | 'thanh_toan' | 'ht_kt' | 'hau_can';

export const NHOM_HO_SO: readonly { ma: NhomHoSo; ten: string }[] = [
  { ma: 'don_vi', ten: 'Thông tin đơn vị' },
  { ma: 'thanh_toan', ten: 'Thông tin thanh toán' },
  { ma: 'ht_kt', ten: 'Hiệu trưởng và kế toán (nhận kinh phí hỗ trợ)' },
  { ma: 'hau_can', ten: 'Hậu cần cơ sở (dùng khi trường là điểm học trực tiếp)' },
];

export type DinhDangTruong = 'mst' | 'qhns' | 'sdt' | 'email';

export interface DinhNghiaTruong {
  ma: string;
  nhom: NhomHoSo;
  nhan: string;
  goi_y?: string;
  bat_buoc: boolean;
  kieu: 'text' | 'textarea';
  toi_da: number;
  dinh_dang?: DinhDangTruong;
}

export const TOI_DA_TEXT = 255;
export const TOI_DA_TEXTAREA = 2000;

function text<M extends string>(
  ma: M,
  nhom: NhomHoSo,
  nhan: string,
  them: Partial<Omit<DinhNghiaTruong, 'ma'>> = {},
): DinhNghiaTruong & { ma: M } {
  return { ma, nhom, nhan, bat_buoc: nhom !== 'hau_can', kieu: 'text', toi_da: TOI_DA_TEXT, ...them };
}

function textarea<M extends string>(ma: M, nhom: NhomHoSo, nhan: string): DinhNghiaTruong & { ma: M } {
  return text(ma, nhom, nhan, { kieu: 'textarea', toi_da: TOI_DA_TEXTAREA });
}

/** Thứ tự = thứ tự hiển thị trên form. Phần 1, 2, 5 bắt buộc để "đủ"; hậu cần không bắt buộc. */
export const TRUONG_HO_SO = [
  text('ten_truong', 'don_vi', 'Tên trường', { goi_y: 'Ghi đúng tên để đi kho bạc' }),
  text('dia_chi', 'don_vi', 'Địa chỉ'),
  text('ma_so_thue', 'don_vi', 'Mã số thuế', { goi_y: '10 số hoặc 13 số có gạch nối', dinh_dang: 'mst' }),
  text('nguoi_dai_dien', 'don_vi', 'Người đại diện trên hợp đồng'),
  text('sdt_dai_dien', 'don_vi', 'SĐT người đại diện', { dinh_dang: 'sdt' }),
  text('email_hoa_don', 'don_vi', 'Email nhận hóa đơn', { dinh_dang: 'email' }),
  text('so_tai_khoan', 'thanh_toan', 'Số tài khoản'),
  text('ngan_hang', 'thanh_toan', 'Ngân hàng'),
  text('chi_nhanh', 'thanh_toan', 'Chi nhánh'),
  text('kho_bac', 'thanh_toan', 'Kho bạc'),
  text('mst_kho_bac', 'thanh_toan', 'MST đăng ký tại Kho bạc', { dinh_dang: 'mst' }),
  text('ma_qhns', 'thanh_toan', 'Mã QHNS', { goi_y: 'Đúng 7 chữ số', dinh_dang: 'qhns' }),
  text('ma_nguon', 'thanh_toan', 'Mã nguồn'),
  text('ht_ho_ten', 'ht_kt', 'Họ tên Hiệu trưởng'),
  text('ht_so_tai_khoan', 'ht_kt', 'STK Hiệu trưởng'),
  text('ht_ngan_hang', 'ht_kt', 'Ngân hàng – chi nhánh (HT)'),
  text('kt_ho_ten', 'ht_kt', 'Họ tên Kế toán'),
  text('kt_sdt', 'ht_kt', 'SĐT Kế toán', { dinh_dang: 'sdt' }),
  text('kt_so_tai_khoan', 'ht_kt', 'STK Kế toán'),
  text('kt_ngan_hang', 'ht_kt', 'Ngân hàng – chi nhánh (KT)'),
  text('dau_moi_csvc', 'hau_can', 'Đầu mối CSVC/kỹ thuật (họ tên, SĐT)'),
  textarea('muc_dap_ung_csvc', 'hau_can', 'Mức đáp ứng CSVC'),
  textarea('luu_tru', 'hau_can', 'Lưu trú gần trường (kèm SĐT)'),
  textarea('di_chuyen', 'hau_can', 'Di chuyển từ TP.HCM (kèm SĐT)'),
];

export type TruongHoSo = (typeof TRUONG_HO_SO)[number]['ma'];

export const TEN_TRUONG_HO_SO: readonly TruongHoSo[] = TRUONG_HO_SO.map((t) => t.ma);

/** Nhãn theo tên trường — để hiện danh sách "còn thiếu". */
export const NHAN_TRUONG_HO_SO = Object.fromEntries(TRUONG_HO_SO.map((t) => [t.ma, t.nhan])) as Record<
  TruongHoSo,
  string
>;

/** Một hồ sơ đầy đủ khóa; giá trị null = chưa khai. */
export type HoSoDonViDuLieu = Record<TruongHoSo, string | null>;
export type HoSoDauVao = Partial<Record<TruongHoSo, string | null | undefined>>;

export const LOI_MST = 'Mã số thuế gồm 10 số, hoặc dạng 0123456789-001';
export const LOI_QHNS = 'Mã QHNS gồm đúng 7 chữ số';
export const LOI_SDT = 'SĐT gồm 10 số, bắt đầu bằng 0';
export const LOI_EMAIL = 'Email không hợp lệ';
export const loiDoDai = (toiDa: number) => `Tối đa ${toiDa} ký tự`;

/** SĐT 10 số bắt đầu bằng 0 — dùng chung hồ sơ đơn vị và Phần 3 hợp đồng (issue #64). */
export const MAU_SDT = /^0\d{9}$/;

const MAU: Record<DinhDangTruong, { mau: RegExp; loi: string }> = {
  mst: { mau: /^\d{10}(-\d{3})?$/, loi: LOI_MST },
  qhns: { mau: /^\d{7}$/, loi: LOI_QHNS },
  sdt: { mau: MAU_SDT, loi: LOI_SDT },
  email: { mau: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, loi: LOI_EMAIL },
};

/** 1 ô chữ: trim (+ NFC); '' / không phải chuỗi → null; SĐT bỏ dấu cách/dấu chấm. Dùng chung với hợp đồng. */
export function chuanHoaChuoi(tho: unknown, laSdt = false): string | null {
  let v = typeof tho === 'string' ? tho.normalize('NFC').trim() : '';
  if (laSdt) v = v.replace(/[\s.]/g, '');
  return v === '' ? null : v;
}

/** chuanHoaChuoi từng ô. Khóa vắng → null. */
export function chuanHoaHoSo(input: HoSoDauVao): HoSoDonViDuLieu {
  const kq = {} as HoSoDonViDuLieu;
  for (const t of TRUONG_HO_SO) kq[t.ma] = chuanHoaChuoi(input[t.ma], t.dinh_dang === 'sdt');
  return kq;
}

/** Lỗi định dạng/độ dài — chỉ xét ô CÓ giá trị (cho phép lưu nháp, X4). Đầu vào đã chuẩn hóa. */
export function kiemTraHoSo(hoSo: HoSoDauVao): { loi: Partial<Record<TruongHoSo, string>> } {
  const loi: Partial<Record<TruongHoSo, string>> = {};
  for (const t of TRUONG_HO_SO) {
    const v = hoSo[t.ma];
    if (v == null || v === '') continue;
    if (v.length > t.toi_da) {
      loi[t.ma] = loiDoDai(t.toi_da);
      continue;
    }
    const dd = t.dinh_dang ? MAU[t.dinh_dang] : null;
    if (dd && !dd.mau.test(v)) loi[t.ma] = dd.loi;
  }
  return { loi };
}

/** du = mọi ô bắt buộc có giá trị VÀ không ô nào sai định dạng. thieu theo thứ tự form. */
export function tinhTrangHoSo(hoSo: HoSoDauVao | null): { du: boolean; thieu: TruongHoSo[] } {
  const duLieu = hoSo ?? {};
  const { loi } = kiemTraHoSo(duLieu);
  const thieu = TRUONG_HO_SO.filter((t) => {
    const v = duLieu[t.ma];
    const trong = v == null || v.trim() === '';
    return (t.bat_buoc && trong) || loi[t.ma] !== undefined;
  }).map((t) => t.ma);
  return { du: thieu.length === 0, thieu };
}

export const DON_VI_TIEP_NHAN = 'Trường Đại học Sư phạm Thành phố Hồ Chí Minh';
export const NGAN_HANG_TIEP_NHAN = 'Ngân hàng TMCP Đại Chúng Việt Nam (PVcomBank)';

/** U2: STK chuyển khoản cho HCMUE = 'HCMUE' + 7 số QHNS — suy ra, không lưu. */
export function stkChuyenKhoan(maQhns: string | null | undefined): string | null {
  const v = (maQhns ?? '').trim();
  return /^\d{7}$/.test(v) ? `HCMUE${v}` : null;
}

/** O4: STK cá nhân che còn 4 số cuối. */
export function cheStk(stk: string | null): string | null {
  if (!stk) return stk;
  return stk.length <= 4 ? stk : `${'•'.repeat(Math.min(stk.length - 4, 8))}${stk.slice(-4)}`;
}
