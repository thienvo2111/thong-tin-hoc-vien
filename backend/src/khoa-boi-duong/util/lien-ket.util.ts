const RE_CO_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

// Admin nhập link_zalo thường thiếu scheme (vd "zalo.me/g/abc") — href như vậy
// bị trình duyệt hiểu là đường dẫn TƯƠNG ĐỐI trong app thay vì link ngoài, nên
// tự thêm "https://" nếu chưa có scheme nào. Dùng trong @Transform của DTO;
// @IsUrl({ require_protocol: true }) chạy sau sẽ chặn giá trị vẫn không hợp lệ.
export function themSchemeNeuThieu(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed || RE_CO_SCHEME.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
