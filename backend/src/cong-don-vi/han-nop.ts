// Issue #66 / ADR 0015 T1, T2, T3: quy tắc thuần về hạn nộp — hạn hiệu lực, hết hạn, số ngày còn lại.
// Không truy cập DB, không đọc đồng hồ: `now` luôn do người gọi truyền (server dùng new Date()).
// Giờ Việt Nam = UTC+7 cố định (không đổi giờ theo mùa).

const LECH_GIO_VN_MS = 7 * 60 * 60 * 1000;
const MOT_NGAY_MS = 24 * 60 * 60 * 1000;

/** ADR 0015 T1: hạn nộp tính đến hết ngày chọn theo giờ Việt Nam — 23:59:59 (+07:00). */
export function hanNopTuNgay(ngay: string): Date {
  return new Date(`${ngay}T23:59:59+07:00`);
}

/** T3: hạn riêng 1 trường — cùng mốc 23:59:59 giờ Việt Nam của ngày chọn. */
export function hanRiengTuNgay(ngay: string): Date {
  return hanNopTuNgay(ngay);
}

/** Ngày lịch (YYYY-MM-DD) của một thời điểm theo giờ Việt Nam. */
export function ngayVietNam(thoiDiem: Date): string {
  return new Date(thoiDiem.getTime() + LECH_GIO_VN_MS)
    .toISOString()
    .slice(0, 10);
}

/** 'YYYY-MM-DD' → 'dd/mm/yyyy' (không qua Date — không lệch múi giờ). */
function hienThi(ngay: string): string {
  const [y, m, d] = ngay.split('-');
  return `${d}/${m}/${y}`;
}

/** T1, T3: hạn hiệu lực của 1 trường = hạn riêng nếu có (kể cả sớm hơn hạn đợt), không thì hạn của đợt. */
export function hanHieuLuc(hanNop: Date, hanRieng: Date | null): Date {
  return hanRieng ?? hanNop;
}

/**
 * T2: đã hết hạn khi `now` SAU hạn (so tới mili giây). Hạn lưu 23:59:59.000 giờ VN nên 23:59:59.000 vẫn còn
 * hạn, 23:59:59.001 trở đi là hết hạn.
 */
export function daHetHan(han: Date, now: Date): boolean {
  return now.getTime() > han.getTime();
}

/**
 * Số ngày lịch (giờ Việt Nam) từ hôm nay tới ngày của hạn: 0 = hạn cuối hôm nay; âm = ngày hạn đã qua.
 * Hết hạn hay chưa phải xét bằng daHetHan (cùng ngày vẫn có thể còn/hết theo giờ).
 */
export function soNgayConLai(han: Date, now: Date): number {
  const homNay = Date.parse(`${ngayVietNam(now)}T00:00:00Z`);
  const ngayHan = Date.parse(`${ngayVietNam(han)}T00:00:00Z`);
  return Math.round((ngayHan - homNay) / MOT_NGAY_MS);
}

/** Thông điệp khi thao tác sau hạn (lỗi HET_HAN_DOT, lý do chặn nộp, lý do không xác nhận). */
export function thongDiepHetHan(han: Date): string {
  return `Đã hết hạn ngày ${hienThi(ngayVietNam(han))} — liên hệ HCMUE để được gia hạn`;
}

/** Các trường về hạn trả cho trường / Quản trị (ISO cho thời điểm, 'YYYY-MM-DD' giờ VN cho ngày). */
export interface ThongTinHan {
  han_rieng: string | null;
  han_hieu_luc: string;
  han_hieu_luc_ngay: string;
  da_het_han: boolean;
}

export function thongTinHan(
  hanNop: Date,
  hanRieng: Date | null,
  now: Date,
): ThongTinHan {
  const han = hanHieuLuc(hanNop, hanRieng);
  return {
    han_rieng: hanRieng ? hanRieng.toISOString() : null,
    han_hieu_luc: han.toISOString(),
    han_hieu_luc_ngay: ngayVietNam(han),
    da_het_han: daHetHan(han, now),
  };
}
