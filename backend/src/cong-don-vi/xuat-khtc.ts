// Issue #67 / ADR 0015 O1, O4, U2: quy tắc thuần (không DB) của file Excel gửi Phòng KHTC — thứ tự cột, dựng
// dòng 3 sheet, che STK cá nhân. Mọi giá trị hồ sơ lấy từ BẢN CHỤP lúc nộp (M5). Test đơn vị ở xuat-khtc.spec.ts.
import type { trang_thai_hop_dong } from '@prisma/client';
import {
  HoSoDonViDuLieu,
  TRUONG_HO_SO,
  TruongHoSo,
} from './ho-so-don-vi.quy-tac';
import type { GiaiDoanThamGia } from './quy-tac-hop-dong';
import { ngayVietNam } from './han-nop';
import { ngayTenFile, slugTenDot } from './sua-dong-danh-sach';

/**
 * O4: STK cá nhân che còn 4 ký tự cuối — giống hệt cheStk của frontend (frontend/src/lib/hoSoDonVi.ts):
 * null / '' → giữ nguyên; ≤ 4 ký tự → giữ nguyên; dài hơn → tối đa 8 dấu '•' + 4 ký tự cuối.
 */
export function cheStk(stk: string | null): string | null {
  if (!stk) return stk;
  return stk.length <= 4
    ? stk
    : `${'•'.repeat(Math.min(stk.length - 4, 8))}${stk.slice(-4)}`;
}

/** O1: mức chi hỗ trợ cố định (đồng) cho Hiệu trưởng và Kế toán của mỗi trường đã nộp hợp đồng. */
export const MUC_CHI_HO_TRO = { hieu_truong: 1_000_000, ke_toan: 500_000 };

export const TEN_SHEET_HOP_DONG = 'Hợp đồng';
export const TEN_SHEET_GIAO_VIEN = 'Danh sách GV';
export const TEN_SHEET_CHI_HO_TRO = 'Chi hỗ trợ';
/** Thứ tự sheet trong file. */
export const SHEET_KHTC = [
  TEN_SHEET_HOP_DONG,
  TEN_SHEET_GIAO_VIEN,
  TEN_SHEET_CHI_HO_TRO,
] as const;

/** Kiểu ô — quyết định định dạng cột khi ghi Excel. */
export type KieuCot =
  | 'chu'
  | 'ma' // chữ, định dạng Text (giữ số 0 đầu, không ra dạng khoa học): MST, QHNS, STK, SĐT, mã
  | 'ngay'
  | 'ngay_gio'
  | 'so'
  | 'suat'
  | 'tien';

export type KhoaCotKhac =
  | 'dau_thoi_gian'
  | 'nguoi_nhan'
  | 'sdt_nguoi_nhan'
  | 'dia_chi_nhan'
  | 'ghi_chu'
  | 'so_qd'
  | 'ngay_qd'
  | 'diem_hoc_truc_tiep'
  | 'ma_truong'
  | 'so_nguoi'
  | 'tong_suat'
  | 'don_gia'
  | 'gia_tri'
  | 'trang_thai'
  | 'ngay_nop'
  | 'stk_chuyen_khoan'
  | 'ngan_hang_tiep_nhan'
  | 'don_vi_tiep_nhan';
export type KhoaCotHopDong = TruongHoSo | KhoaCotKhac;

export interface CotKhtc<K extends string = string> {
  key: K;
  nhan: string;
  kieu: KieuCot;
}

const NHAN_HO_SO = new Map(TRUONG_HO_SO.map((t) => [t.ma, t.nhan]));
const MA_DINH_DANG = new Set(['mst', 'qhns', 'sdt']);
const MA_CHU_KHAC = new Set<TruongHoSo>([
  'so_tai_khoan',
  'ma_nguon',
  'ht_so_tai_khoan',
  'kt_so_tai_khoan',
]);

/** Cột hồ sơ: nhãn đúng TRUONG_HO_SO; MST/QHNS/SĐT/STK/mã nguồn định dạng Text. */
function cotHoSo(ma: TruongHoSo): CotKhtc<KhoaCotHopDong> {
  const t = TRUONG_HO_SO.find((x) => x.ma === ma);
  const laMa =
    MA_CHU_KHAC.has(ma) || (!!t?.dinh_dang && MA_DINH_DANG.has(t.dinh_dang));
  return { key: ma, nhan: NHAN_HO_SO.get(ma) ?? ma, kieu: laMa ? 'ma' : 'chu' };
}

const cot = (
  key: KhoaCotKhac,
  nhan: string,
  kieu: KieuCot = 'chu',
): CotKhtc<KhoaCotHopDong> => ({ key, nhan, kieu });

/**
 * O1: cột sheet "Hợp đồng" — THEO ĐÚNG THỨ TỰ bảng câu trả lời Google Form "Thông tin làm hợp đồng bồi dưỡng NLS
 * An Giang 2026" (Google Forms luôn mở đầu bằng cột Dấu thời gian, rồi các câu hỏi theo thứ tự form: Phần 1 → 5,
 * trong mỗi phần theo prototype #48 / TRUONG_HO_SO), rồi Hậu cần, rồi các cột thêm (không có trong form).
 * ĐÂY LÀ NƠI DUY NHẤT để chỉnh thứ tự / nhãn cột khi đối chiếu với file câu trả lời thật.
 */
export const COT_HOP_DONG_KHTC: readonly CotKhtc<KhoaCotHopDong>[] = [
  cot('dau_thoi_gian', 'Dấu thời gian', 'ngay_gio'),
  // Phần 1 — Thông tin đơn vị
  cotHoSo('ten_truong'),
  cotHoSo('dia_chi'),
  cotHoSo('ma_so_thue'),
  cotHoSo('nguoi_dai_dien'),
  cotHoSo('sdt_dai_dien'),
  cotHoSo('email_hoa_don'),
  // Phần 2 — Thông tin thanh toán
  cotHoSo('so_tai_khoan'),
  cotHoSo('ngan_hang'),
  cotHoSo('chi_nhanh'),
  cotHoSo('kho_bac'),
  cotHoSo('mst_kho_bac'),
  cotHoSo('ma_qhns'),
  cotHoSo('ma_nguon'),
  // Phần 3 — Người nhận bản giấy hợp đồng
  cot('nguoi_nhan', 'Người nhận bản giấy hợp đồng'),
  cot('sdt_nguoi_nhan', 'SĐT người nhận', 'ma'),
  cot('dia_chi_nhan', 'Địa chỉ nhận (số, đường, ấp, xã/phường, tỉnh)'),
  cot('ghi_chu', 'Ghi chú cho HCMUE'),
  // Phần 4 — QĐ chỉ định thầu
  cot('so_qd', 'Số QĐ chỉ định thầu', 'ma'),
  cot('ngay_qd', 'Ngày QĐ', 'ngay'),
  // Phần 5 — Hiệu trưởng và kế toán
  cotHoSo('ht_ho_ten'),
  cotHoSo('ht_so_tai_khoan'),
  cotHoSo('ht_ngan_hang'),
  cotHoSo('kt_ho_ten'),
  cotHoSo('kt_sdt'),
  cotHoSo('kt_so_tai_khoan'),
  cotHoSo('kt_ngan_hang'),
  // Hậu cần cơ sở
  cot('diem_hoc_truc_tiep', 'Điểm học trực tiếp'),
  cotHoSo('dau_moi_csvc'),
  cotHoSo('muc_dap_ung_csvc'),
  cotHoSo('luu_tru'),
  cotHoSo('di_chuyen'),
  // Thêm (không có trong form)
  cot('ma_truong', 'Mã trường', 'ma'),
  cot('so_nguoi', 'Số người', 'so'),
  cot('tong_suat', 'Tổng suất', 'suat'),
  cot('don_gia', 'Đơn giá', 'tien'),
  cot('gia_tri', 'Giá trị hợp đồng', 'tien'),
  cot('trang_thai', 'Trạng thái'),
  cot('ngay_nop', 'Ngày nộp', 'ngay'),
  cot('stk_chuyen_khoan', 'STK chuyển khoản HCMUE', 'ma'),
  cot('ngan_hang_tiep_nhan', 'Ngân hàng tiếp nhận'),
  cot('don_vi_tiep_nhan', 'Đơn vị tiếp nhận'),
];

export const COT_GIAO_VIEN_KHTC: readonly CotKhtc[] = [
  { key: 'stt', nhan: 'STT', kieu: 'so' },
  { key: 'ma_truong', nhan: 'Mã trường', kieu: 'ma' },
  { key: 'truong', nhan: 'Trường', kieu: 'chu' },
  { key: 'ho_ten', nhan: 'Họ tên', kieu: 'chu' },
  { key: 'ngay_sinh', nhan: 'Ngày sinh', kieu: 'ngay' },
  { key: 'lop', nhan: 'Lớp/môn', kieu: 'chu' },
  { key: 'giai_doan', nhan: 'Giai đoạn', kieu: 'chu' },
  { key: 'suat', nhan: 'Suất', kieu: 'suat' },
];

export const COT_CHI_HO_TRO_KHTC: readonly CotKhtc[] = [
  { key: 'stt', nhan: 'STT', kieu: 'so' },
  { key: 'ma_truong', nhan: 'Mã trường', kieu: 'ma' },
  { key: 'truong', nhan: 'Trường', kieu: 'chu' },
  { key: 'vai_tro', nhan: 'Vai trò', kieu: 'chu' },
  { key: 'ho_ten', nhan: 'Họ tên', kieu: 'chu' },
  { key: 'stk', nhan: 'STK', kieu: 'ma' },
  { key: 'ngan_hang', nhan: 'Ngân hàng – chi nhánh', kieu: 'chu' },
  { key: 'so_tien', nhan: 'Số tiền', kieu: 'tien' },
];

export const NHAN_GIAI_DOAN_KHTC: Record<GiaiDoanThamGia, string> = {
  ca_hai: 'Cả 2',
  chi_gd1: 'Chỉ GĐ1',
  chi_gd2: 'Chỉ GĐ2',
};

export const NHAN_TRANG_THAI_HOP_DONG: Record<trang_thai_hop_dong, string> = {
  chua_nop: 'Chưa nộp',
  da_nop: 'Đã nộp',
};

export const TONG_CONG = 'Tổng cộng';
export const VAI_TRO_HIEU_TRUONG = 'Hiệu trưởng';
export const VAI_TRO_KE_TOAN = 'Kế toán';

/** Bản chụp hồ sơ lúc nộp (M5) — bản cũ có thể thiếu khóa, nên mọi khóa đều tùy chọn. */
export type BanChupKhtc = Partial<HoSoDonViDuLieu> & {
  stk_chuyen_khoan?: string | null;
  don_vi_tiep_nhan?: string | null;
  ngan_hang_tiep_nhan?: string | null;
};

/** 1 hợp đồng đã nộp — dữ liệu thô (không DB) để dựng dòng. Ngày dạng 'YYYY-MM-DD'. */
export interface HopDongKhtc {
  ma_truong: string | null;
  ten_don_vi: string;
  trang_thai_hop_dong: trang_thai_hop_dong;
  nop_luc: Date | null;
  ban_chup: BanChupKhtc;
  nguoi_nhan: string | null;
  sdt_nguoi_nhan: string | null;
  dia_chi_nhan: string | null;
  ghi_chu: string | null;
  so_qd: string | null;
  ngay_qd: string | null;
  diem_hoc_truc_tiep: boolean;
  so_nguoi: number;
  tong_suat: number;
  don_gia: number | null;
  gia_tri: number | null;
}

export interface GiaoVienKhtc {
  ma_truong: string | null;
  ten_truong: string;
  ho_ten: string;
  ngay_sinh: string | null;
  lop: string | null;
  giai_doan: GiaiDoanThamGia;
  ty_le_suat: number;
}

export type GiaTriO = string | number | Date | null;

const LECH_GIO_VN_MS = 7 * 60 * 60 * 1000;

/** exceljs ghi Date theo UTC → dời +7 giờ để ô hiện đúng giờ Việt Nam. */
export function oGioVietNam(luc: Date | null): Date | null {
  return luc ? new Date(luc.getTime() + LECH_GIO_VN_MS) : null;
}

/** Ô ngày: 'YYYY-MM-DD' → Date 00:00Z (exceljs ghi theo UTC → ô hiện đúng ngày). */
export function oNgay(ngay: string | null): Date | null {
  return ngay ? new Date(`${ngay}T00:00:00Z`) : null;
}

/** Ngày (không giờ) của 1 thời điểm theo giờ Việt Nam, làm ô ngày. */
function oNgayVietNam(luc: Date | null): Date | null {
  return luc ? oNgay(ngayVietNam(luc)) : null;
}

const vi = (a: string, b: string) => a.localeCompare(b, 'vi');

/** Thứ tự trường trong file: theo tên trường (tiếng Việt). */
export function sapXepHopDong<T extends { ten_don_vi: string }>(
  ds: readonly T[],
): T[] {
  return [...ds].sort((a, b) => vi(a.ten_don_vi, b.ten_don_vi));
}

/** Sheet "Hợp đồng": 1 dòng / hợp đồng, giá trị theo đúng thứ tự COT_HOP_DONG_KHTC. */
export function dongHopDongKhtc(h: HopDongKhtc): GiaTriO[] {
  const bc = h.ban_chup;
  const khac: Record<KhoaCotKhac, GiaTriO> = {
    dau_thoi_gian: oGioVietNam(h.nop_luc),
    nguoi_nhan: h.nguoi_nhan,
    sdt_nguoi_nhan: h.sdt_nguoi_nhan,
    dia_chi_nhan: h.dia_chi_nhan,
    ghi_chu: h.ghi_chu,
    so_qd: h.so_qd,
    ngay_qd: oNgay(h.ngay_qd),
    diem_hoc_truc_tiep: h.diem_hoc_truc_tiep ? 'Có' : 'Không',
    ma_truong: h.ma_truong,
    so_nguoi: h.so_nguoi,
    tong_suat: h.tong_suat,
    don_gia: h.don_gia,
    gia_tri: h.gia_tri,
    trang_thai: NHAN_TRANG_THAI_HOP_DONG[h.trang_thai_hop_dong],
    ngay_nop: oNgayVietNam(h.nop_luc),
    stk_chuyen_khoan: bc.stk_chuyen_khoan ?? null,
    ngan_hang_tiep_nhan: bc.ngan_hang_tiep_nhan ?? null,
    don_vi_tiep_nhan: bc.don_vi_tiep_nhan ?? null,
  };
  return COT_HOP_DONG_KHTC.map((c) =>
    c.key in khac
      ? khac[c.key as KhoaCotKhac]
      : (bc[c.key as TruongHoSo] ?? null),
  );
}

/** Sheet "Danh sách GV": theo trường rồi họ tên (tiếng Việt), đánh STT từ 1. */
export function dongGiaoVienKhtc(ds: readonly GiaoVienKhtc[]): GiaTriO[][] {
  return [...ds]
    .sort((a, b) => vi(a.ten_truong, b.ten_truong) || vi(a.ho_ten, b.ho_ten))
    .map((g, i) => [
      i + 1,
      g.ma_truong,
      g.ten_truong,
      g.ho_ten,
      oNgay(g.ngay_sinh),
      g.lop,
      NHAN_GIAI_DOAN_KHTC[g.giai_doan],
      g.ty_le_suat,
    ]);
}

/**
 * Sheet "Chi hỗ trợ": mỗi trường 2 dòng (Hiệu trưởng 1.000.000 đ, Kế toán 500.000 đ) — STK ĐẦY ĐỦ (KHTC chuyển
 * tiền vào đó). Bản chụp thiếu tên vẫn ra dòng (ô trống) để KHTC thấy chỗ hụt. Dòng cuối "Tổng cộng".
 */
export function dongChiHoTroKhtc(
  ds: readonly Pick<HopDongKhtc, 'ma_truong' | 'ten_don_vi' | 'ban_chup'>[],
): { dong: GiaTriO[][]; tong: number } {
  const dong: GiaTriO[][] = [];
  let tong = 0;
  for (const h of sapXepHopDong(ds)) {
    const bc = h.ban_chup;
    const vaiTro: [string, GiaTriO, GiaTriO, GiaTriO, number][] = [
      [
        VAI_TRO_HIEU_TRUONG,
        bc.ht_ho_ten ?? null,
        bc.ht_so_tai_khoan ?? null,
        bc.ht_ngan_hang ?? null,
        MUC_CHI_HO_TRO.hieu_truong,
      ],
      [
        VAI_TRO_KE_TOAN,
        bc.kt_ho_ten ?? null,
        bc.kt_so_tai_khoan ?? null,
        bc.kt_ngan_hang ?? null,
        MUC_CHI_HO_TRO.ke_toan,
      ],
    ];
    for (const [ten, hoTen, stk, nganHang, soTien] of vaiTro) {
      dong.push([
        dong.length + 1,
        h.ma_truong,
        h.ten_don_vi,
        ten,
        hoTen,
        stk,
        nganHang,
        soTien,
      ]);
      tong += soTien;
    }
  }
  return { dong, tong };
}

/** khtc-<slug đợt>-<YYYYMMDD theo giờ Việt Nam>.xlsx */
export function tenFileKhtc(tenDot: string, luc: Date): string {
  return `khtc-${slugTenDot(tenDot)}-${ngayTenFile(luc)}.xlsx`;
}
