const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

// Mốc đầu ngày/đầu ngày mai theo giờ Việt Nam (UTC+7, không có giờ mùa hè)
// ứng với thời điểm truyền vào — trả về dạng mốc UTC để dùng trực tiếp
// trong Prisma where (các cột Timestamptz). Cộng/trừ offset cố định thay vì
// Intl/timezone database vì môi trường chạy (CI, VPS) không đảm bảo có đầy
// đủ dữ liệu múi giờ hệ thống.
export function bienNgayVietNam(thoiDiem: Date): {
  tuNgay: Date;
  denNgay: Date;
} {
  const vnThoiDiem = new Date(thoiDiem.getTime() + VN_OFFSET_MS);
  const dauNgayVnTheoUtc = Date.UTC(
    vnThoiDiem.getUTCFullYear(),
    vnThoiDiem.getUTCMonth(),
    vnThoiDiem.getUTCDate(),
  );
  const tuNgay = new Date(dauNgayVnTheoUtc - VN_OFFSET_MS);
  const denNgay = new Date(tuNgay.getTime() + 24 * 60 * 60 * 1000);
  return { tuNgay, denNgay };
}
