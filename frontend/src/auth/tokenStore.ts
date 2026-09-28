// Token chỉ ở bộ nhớ (biến module) + sessionStorage — KHÔNG BAO GIỜ localStorage.
// sessionStorage chỉ để token sống sót qua lần refresh trang, mất khi đóng tab.
const KHOA_SESSION = 'chv_token';

let token: string | null = null;

export function layToken(): string | null {
  if (token) return token;
  try {
    token = sessionStorage.getItem(KHOA_SESSION);
  } catch {
    token = null;
  }
  return token;
}

export function datToken(t: string): void {
  token = t;
  try {
    sessionStorage.setItem(KHOA_SESSION, t);
  } catch {
    // sessionStorage có thể bị chặn (chế độ ẩn danh khắt khe) — vẫn giữ token trong bộ nhớ
  }
}

export function xoaToken(): void {
  token = null;
  try {
    sessionStorage.removeItem(KHOA_SESSION);
  } catch {
    // bỏ qua
  }
}
