import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('vi');

const MUI_GIO = 'Asia/Ho_Chi_Minh';

/** API trả UTC ISO 8601 — luôn hiển thị theo giờ Việt Nam, định dạng dd/mm/yyyy HH:mm. */
export function dinhDangNgayGio(isoUtc: string): string {
  return dayjs.utc(isoUtc).tz(MUI_GIO).format('DD/MM/YYYY HH:mm');
}

export function dinhDangGio(isoUtc: string): string {
  return dayjs.utc(isoUtc).tz(MUI_GIO).format('HH:mm');
}

/** Chỉ ngày (không giờ), dùng cho các mốc không cần độ chính xác theo phút. */
export function dinhDangNgay(isoUtc: string): string {
  return dayjs.utc(isoUtc).tz(MUI_GIO).format('DD/MM/YYYY');
}

export function conLaiDuoi24h(isoUtc: string): boolean {
  const gio = dayjs.utc(isoUtc).diff(dayjs(), 'hour');
  return gio < 24 && gio >= 0;
}

/** Đếm ngược dạng "còn HH:mm:ss" — trả null nếu đã qua mốc. */
export function demNguoc(isoUtc: string, tuLuc: Date = new Date()): string | null {
  const giay = dayjs.utc(isoUtc).diff(dayjs(tuLuc), 'second');
  if (giay <= 0) return null;
  const h = Math.floor(giay / 3600);
  const m = Math.floor((giay % 3600) / 60);
  const s = giay % 60;
  return [h, m, s].map((x) => String(x).padStart(2, '0')).join(':');
}

export { dayjs };

/** Ngày YYYY-MM-DD theo giờ Việt Nam của 1 mốc UTC (tham số `ngay` của API). */
export function ngayIsoVn(isoUtc: string): string {
  return new Date(Date.parse(isoUtc) + 7 * 3600 * 1000).toISOString().slice(0, 10);
}
