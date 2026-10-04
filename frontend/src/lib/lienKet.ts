// Chặn lỗi link admin/học viên nhập thiếu scheme (vd "google.com") bị trình duyệt
// hiểu là đường dẫn TƯƠNG ĐỐI khi gắn vào href -> điều hướng sai trang trong app
// (vd https://domain/toi/google.com). Chỉ chấp nhận http/https; mọi scheme khác
// (javascript:, data:, mailto:...) bị chặn vì không phải link an toàn để mở.
const RE_HTTP_HTTPS = /^https?:\/\//i;
const RE_SCHEME_KHAC = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

function laNhanHopLe(nhan: string): boolean {
  return nhan.length > 0 && /^[a-zA-Z0-9-]+$/.test(nhan);
}

function coVeLaHost(chuoi: string): boolean {
  const viTriHet = chuoi.search(/[/?#]/);
  const hostPort = viTriHet === -1 ? chuoi : chuoi.slice(0, viTriHet);
  const host = hostPort.split(':')[0];
  const nhan = host.split('.');
  if (nhan.length < 2) return false;
  const tld = nhan[nhan.length - 1];
  if (!/^[a-zA-Z]{2,}$/.test(tld)) return false;
  return nhan.every(laNhanHopLe);
}

/**
 * Chuẩn hóa chuỗi link do người dùng nhập thành URL tuyệt đối an toàn để gắn vào
 * href, hoặc null nếu không phải link (vd địa điểm bằng chữ) hoặc không an toàn.
 */
export function chuanHoaLienKet(s: string | null | undefined): string | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (!trimmed) return null;

  if (RE_HTTP_HTTPS.test(trimmed)) return trimmed;
  if (RE_SCHEME_KHAC.test(trimmed)) return null;
  if (/\s/.test(trimmed)) return null;

  if (trimmed.startsWith('//')) return `https:${trimmed}`;

  return coVeLaHost(trimmed) ? `https://${trimmed}` : null;
}
