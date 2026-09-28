/** Chuẩn hóa NFC mọi chuỗi trước khi gửi API (CLAUDE.md § Ngôn ngữ & định dạng). */
export function chuanHoaNfc(s: string): string {
  return s.normalize('NFC');
}

/** Áp dụng chuanHoaNfc cho mọi giá trị string của object (nông, không đệ quy) trước khi PATCH/POST. */
export function chuanHoaObjectNfc<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj };
  for (const k of Object.keys(out)) {
    const v = out[k as keyof T];
    if (typeof v === 'string') {
      (out as Record<string, unknown>)[k] = chuanHoaNfc(v);
    }
  }
  return out;
}
