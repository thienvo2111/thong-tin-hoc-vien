/** Liên kết Google Maps tìm theo địa chỉ (mở tab mới) — cổng giảng viên (ADR 0004 G8). */
export function lienKetBanDo(diaChi: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(diaChi)}`;
}
