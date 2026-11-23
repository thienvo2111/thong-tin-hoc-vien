// Issue #66 / ADR 0015 T1–T3: nhãn hạn nộp của Cổng đơn vị (bản soi của backend han-nop.ts).
// Khóa hay không LUÔN theo `da_het_han` server tính — client chỉ định dạng "Còn N ngày" / "Hạn cuối hôm nay".
// `now` luôn truyền vào (mặc định đồng hồ máy) để test cố định được.
import { ApiError } from '@/api/client';
import { congDonVi } from '@/content/congDonVi';
import { dinhDangNgayLich } from './ngayLich';

const LECH_GIO_VN_MS = 7 * 60 * 60 * 1000;
const MOT_NGAY_MS = 24 * 60 * 60 * 1000;

/** Ngày lịch 'YYYY-MM-DD' theo giờ Việt Nam (UTC+7 cố định) của một thời điểm. */
export function ngayVietNam(thoiDiem: Date): string {
  return new Date(thoiDiem.getTime() + LECH_GIO_VN_MS).toISOString().slice(0, 10);
}

/** Đã hết hạn khi `now` SAU hạn (ISO) — như backend. Giao diện dùng `da_het_han` của server; hàm này để đối chiếu. */
export function daHetHan(hanHieuLuc: string, now: Date): boolean {
  return now.getTime() > new Date(hanHieuLuc).getTime();
}

/** Số ngày lịch (giờ VN) từ hôm nay tới ngày hạn 'YYYY-MM-DD': 0 = hạn cuối hôm nay, âm = ngày hạn đã qua. */
export function soNgayConLai(hanHieuLucNgay: string, now: Date): number {
  const homNay = Date.parse(`${ngayVietNam(now)}T00:00:00Z`);
  return Math.round((Date.parse(`${hanHieuLucNgay}T00:00:00Z`) - homNay) / MOT_NGAY_MS);
}

/** Các trường hạn server trả trên thẻ đợt / danh sách / hợp đồng của trường. */
export interface ThongTinHan {
  han_rieng: string | null;
  han_hieu_luc: string;
  han_hieu_luc_ngay: string;
  da_het_han: boolean;
}

export type TrangThaiHan = { loai: 'con_han'; soNgay: number } | { loai: 'hom_nay' } | { loai: 'het_han' };

/** Hết hạn theo server; còn hạn mà ngày hạn ≤ hôm nay (kể cả lệch đồng hồ máy) → "hôm nay". */
export function trangThaiHan(han: Pick<ThongTinHan, 'da_het_han' | 'han_hieu_luc_ngay'>, now: Date): TrangThaiHan {
  if (han.da_het_han) return { loai: 'het_han' };
  const soNgay = soNgayConLai(han.han_hieu_luc_ngay, now);
  return soNgay <= 0 ? { loai: 'hom_nay' } : { loai: 'con_han', soNgay };
}

/** "Còn N ngày" / "Hạn cuối hôm nay" / "Đã hết hạn ngày dd/mm/yyyy". */
export function nhanHan(han: Pick<ThongTinHan, 'da_het_han' | 'han_hieu_luc_ngay'>, now: Date): string {
  const tt = trangThaiHan(han, now);
  if (tt.loai === 'het_han') return `Đã hết hạn ngày ${dinhDangNgayLich(han.han_hieu_luc_ngay)}`;
  if (tt.loai === 'hom_nay') return 'Hạn cuối hôm nay';
  return `Còn ${tt.soNgay} ngày`;
}

/** Còn ≤ 3 ngày (kể cả hôm nay) → nhắc gấp (màu cam). */
export const NGUONG_GAP = 3;

/** SĐT hỗ trợ chỉ khi chuỗi cấu hình có chữ số — chuỗi tạm như "(chưa cập nhật)" coi như chưa có. */
export function sdtHoTro(giaTri: string | null | undefined): string | null {
  const s = giaTri?.trim() ?? '';
  return /\d/.test(s) ? s : null;
}

/** SĐT hỗ trợ của Cổng đơn vị (src/content/congDonVi.ts); null khi chưa cập nhật số thật. */
export const SDT_HO_TRO_CONG_DON_VI = sdtHoTro(congDonVi.soDienThoaiHoTro);

const lienHe = (sdt: string | null) => (sdt ? `liên hệ HCMUE (${sdt})` : 'liên hệ HCMUE');

/** Thẻ đợt trang chủ: "Đã hết hạn ngày dd/mm – liên hệ HCMUE (SĐT)" (không SĐT → bỏ ngoặc). */
export function nhanHetHanNgan(hanHieuLucNgay: string, sdt: string | null): string {
  const [, thang, ngay] = hanHieuLucNgay.split('-');
  return `Đã hết hạn ngày ${ngay}/${thang} – ${lienHe(sdt)}`;
}

/** Banner màn danh sách / hợp đồng khi hết hạn. */
export function thongBaoChiXemHetHan(hanHieuLucNgay: string, sdt: string | null): string {
  const lh = lienHe(sdt);
  return `Đã hết hạn ngày ${dinhDangNgayLich(hanHieuLucNgay)} — chỉ xem. ${lh[0].toUpperCase()}${lh.slice(1)} để được gia hạn.`;
}

/** Server từ chối vì hết hạn (403 HET_HAN_DOT) — hiện thông điệp server và tải lại để vào chế độ chỉ xem. */
export function laLoiHetHan(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403 && err.code === 'HET_HAN_DOT';
}
