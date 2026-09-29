// Bảng nhãn + màu badge trạng thái hồ sơ học viên — dùng chung các màn quản trị
// (design/redesign-spec.md § 1: success/warning/danger token). Không dùng Mantine Badge color-mix
// mặc định vì theme.ts đã "hack" shade 0/6 cho đúng hex thiết kế — ở đây style trực tiếp cho chắc.
export const NHAN_TRANG_THAI_HO_SO: Record<string, string> = {
  nhap: 'Nháp',
  cho_duyet: 'Chờ duyệt',
  da_duyet: 'Đã duyệt',
  tu_choi: 'Từ chối',
};

export const MAU_TRANG_THAI_HO_SO: Record<string, { bg: string; mau: string }> = {
  nhap: { bg: '#EEF2F6', mau: '#667085' },
  cho_duyet: { bg: '#FEF3E6', mau: '#B54708' },
  da_duyet: { bg: '#EAF6F0', mau: '#12805C' },
  tu_choi: { bg: '#FDEEEC', mau: '#CF373D' },
};

export function nhanTrangThaiHoSo(trangThai: string): string {
  return NHAN_TRANG_THAI_HO_SO[trangThai] ?? trangThai;
}

export function mauTrangThaiHoSo(trangThai: string): { bg: string; mau: string } {
  return MAU_TRANG_THAI_HO_SO[trangThai] ?? { bg: '#EEF2F6', mau: '#667085' };
}
