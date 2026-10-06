// Chuẩn hóa liên hệ giảng viên — dùng chung cho nhập tay và import
// giang_vien (cùng 1 bộ quy tắc, validation-checklist #42).
const SO_DIEN_THOAI_REGEX = /^(0\d{9}|\+84\d{9})$/;
const SDT_THIEU_SO_0_REGEX = /^[35789]\d{8}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Bỏ khoảng trắng/dấu chấm/gạch; 9 số thiếu "0" đầu → tự thêm. null nếu sai định dạng. */
export function chuanHoaSoDienThoai(raw: string): string | null {
  const gon = raw.replace(/[\s.-]/g, '');
  const sdt = SDT_THIEU_SO_0_REGEX.test(gon) ? `0${gon}` : gon;
  return SO_DIEN_THOAI_REGEX.test(sdt) ? sdt : null;
}

/** Trim + chữ thường; chuỗi rỗng → undefined; null nếu sai định dạng. */
export function chuanHoaEmail(
  raw: string | undefined,
): string | undefined | null {
  const email = raw?.trim().toLowerCase();
  if (!email) return undefined;
  return EMAIL_REGEX.test(email) ? email : null;
}
