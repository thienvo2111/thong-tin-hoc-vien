const MOT_NGAY_MS = 24 * 60 * 60 * 1000;
const LECH_GIO_VN_MS = 7 * 60 * 60 * 1000;

/**
 * Khoảng thời gian theo NGÀY giờ Việt Nam (tu_ngay/den_ngay dạng YYYY-MM-DD).
 * Mặc định: từ đầu hôm nay tới hết soNgayMacDinh ngày sau. Dùng chung cho
 * lịch học của người hỗ trợ học viên (ADR 0003) và lịch dạy (ADR 0004).
 */
export function khoangNgayVn(
  query: { tu_ngay?: string; den_ngay?: string },
  soNgayMacDinh = 14,
): { tu: Date; den: Date } {
  const dauHomNay = new Date(
    Math.floor((Date.now() + LECH_GIO_VN_MS) / MOT_NGAY_MS) * MOT_NGAY_MS -
      LECH_GIO_VN_MS,
  );
  const tu = query.tu_ngay
    ? new Date(`${query.tu_ngay}T00:00:00+07:00`)
    : dauHomNay;
  const den = query.den_ngay
    ? new Date(`${query.den_ngay}T23:59:59.999+07:00`)
    : new Date(tu.getTime() + (soNgayMacDinh + 1) * MOT_NGAY_MS - 1);
  return { tu, den };
}
