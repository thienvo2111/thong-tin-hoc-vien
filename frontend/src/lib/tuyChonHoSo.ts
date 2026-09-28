// Nhãn tiếng Việt cho các enum của hồ sơ học viên — dùng chung M4 (Select) và M5 (bảng xem lại).
export const TRINH_DO_OPTIONS = [
  { value: 'trung_cap', label: 'Trung cấp' },
  { value: 'cao_dang', label: 'Cao đẳng' },
  { value: 'dai_hoc', label: 'Đại học' },
  { value: 'thac_si', label: 'Thạc sĩ' },
  { value: 'tien_si', label: 'Tiến sĩ' },
  { value: 'khac', label: 'Khác' },
];

export const CAP_GIANG_DAY_OPTIONS = [
  { value: 'mam_non', label: 'Mầm non' },
  { value: 'tieu_hoc', label: 'Tiểu học' },
  { value: 'thcs', label: 'THCS' },
  { value: 'thpt', label: 'THPT' },
];

export const GIOI_TINH_OPTIONS = [
  { value: 'nam', label: 'Nam' },
  { value: 'nu', label: 'Nữ' },
  { value: 'khac', label: 'Khác' },
];

export function nhanTuTuyChon(options: { value: string; label: string }[], value: string | null | undefined): string {
  if (!value) return '';
  return options.find((o) => o.value === value)?.label ?? value;
}
