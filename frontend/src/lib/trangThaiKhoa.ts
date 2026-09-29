// Bảng nhãn + màu badge trạng thái khóa bồi dưỡng (trang_thai_khoa) — cùng bộ token màu với
// trangThaiHoSo.ts (design/redesign-spec.md § 1) nhưng tập giá trị khác (thêm dong_dang_ky).
export const NHAN_TRANG_THAI_KHOA: Record<string, string> = {
  nhap: 'Nháp',
  cho_duyet: 'Chờ duyệt',
  da_duyet: 'Đã duyệt',
  tu_choi: 'Từ chối',
  dong_dang_ky: 'Đóng đăng ký',
};

export const MAU_TRANG_THAI_KHOA: Record<string, { bg: string; mau: string }> = {
  nhap: { bg: '#EEF2F6', mau: '#667085' },
  cho_duyet: { bg: '#FEF3E6', mau: '#B54708' },
  da_duyet: { bg: '#EAF6F0', mau: '#12805C' },
  tu_choi: { bg: '#FDEEEC', mau: '#CF373D' },
  dong_dang_ky: { bg: '#EEF2F6', mau: '#667085' },
};

export function nhanTrangThaiKhoa(trangThai: string): string {
  return NHAN_TRANG_THAI_KHOA[trangThai] ?? trangThai;
}

export function mauTrangThaiKhoa(trangThai: string): { bg: string; mau: string } {
  return MAU_TRANG_THAI_KHOA[trangThai] ?? { bg: '#EEF2F6', mau: '#667085' };
}
