// Quy tắc chung #4 (mo-rong-nls-an-giang.md): thời gian trong file import
// nhập theo giờ Việt Nam (dd/mm/yyyy hh:mm, UTC+7, không DST), lưu UTC.
const VN_DATETIME_REGEX = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/;

export function parseVnDateTime(raw: string): Date | undefined {
  const m = VN_DATETIME_REGEX.exec(raw.trim());
  if (!m) return undefined;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  if (month < 1 || month > 12 || hour > 23 || minute > 59) return undefined;

  // Xác thực ngày hợp lệ (vd 31/02) — Date.UTC() tự "tràn" sang tháng kế tiếp
  // thay vì báo lỗi, nên phải so lại các thành phần sau khi dựng.
  const dateOnly = new Date(Date.UTC(year, month - 1, day));
  if (
    dateOnly.getUTCFullYear() !== year ||
    dateOnly.getUTCMonth() !== month - 1 ||
    dateOnly.getUTCDate() !== day
  ) {
    return undefined;
  }

  return new Date(Date.UTC(year, month - 1, day, hour - 7, minute));
}

// Ngược của parseVnDateTime: Date (UTC) → "dd/mm/yyyy hh:mm" giờ Việt Nam.
export function formatVnDateTime(d: Date): string {
  const vn = new Date(d.getTime() + 7 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(vn.getUTCDate())}/${p(vn.getUTCMonth() + 1)}/${vn.getUTCFullYear()} ${p(vn.getUTCHours())}:${p(vn.getUTCMinutes())}`;
}
