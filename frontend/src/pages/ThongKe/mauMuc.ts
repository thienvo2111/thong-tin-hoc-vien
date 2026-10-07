/** Màu mức M1→M4 cố định cho toàn dashboard (token Mantine). */
export const MAU_MUC: Record<'M1' | 'M2' | 'M3' | 'M4', string> = {
  M1: 'red.6',
  M2: 'orange.6',
  M3: 'blue.6',
  M4: 'green.7',
};

/** Tỷ lệ 0..1 → "78,3%"; null (mẫu số 0) → "—". */
export function dinhDangTyLe(x: number | null): string {
  if (x === null || !Number.isFinite(x)) return '—';
  return `${(x * 100).toFixed(1).replace('.', ',')}%`;
}

/** Màu cho chuỗi KHÔNG phải mức M1→M4 — không dùng lại các sắc của MAU_MUC để tránh nhầm nghĩa. */
export const MAU_SERIES = {
  chinh: 'indigo.6',
  thu_hai: 'teal.6',
  thu_ba: 'grape.6',
  trung_tinh: 'gray.6',
} as const;
