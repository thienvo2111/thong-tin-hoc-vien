import { Table, UnstyledButton } from '@mantine/core';

// Tiện ích dùng chung cho các bảng "theo trường" (Tiến độ, Chất lượng hồ sơ).

export type Chieu = 'asc' | 'desc';

/** Màu thanh tiến độ theo ngưỡng; null (không có mẫu số) → không thanh. */
export function mauTheoNguong(x: number | null): string | null {
  if (x === null) return null;
  if (x < 0.5) return 'red.6';
  if (x < 0.8) return 'yellow.6';
  return 'teal.6';
}

export const boDau = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();

/** Sắp theo cột; null luôn cuối bất kể chiều. */
export function sapXepTheoCot<T>(ds: T[], cot: keyof T, chieu: Chieu): T[] {
  const dau = chieu === 'asc' ? 1 : -1;
  return [...ds].sort((a, b) => {
    const x = a[cot];
    const y = b[cot];
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    if (typeof x === 'string' && typeof y === 'string') return dau * x.localeCompare(y, 'vi');
    return dau * ((x as number) - (y as number));
  });
}

interface TieuDeProps<K extends string> {
  nhan: string;
  cot: K;
  dangSap: K;
  chieu: Chieu;
  onSap: (cot: K) => void;
  canPhai?: boolean;
}

export function TieuDeSapXep<K extends string>({ nhan, cot, dangSap, chieu, onSap, canPhai }: TieuDeProps<K>) {
  const dang = dangSap === cot;
  const ariaSort = dang ? (chieu === 'asc' ? 'ascending' : 'descending') : 'none';
  return (
    <Table.Th aria-sort={ariaSort} ta={canPhai ? 'right' : undefined}>
      <UnstyledButton onClick={() => onSap(cot)} fw={700} fz="sm">
        {nhan}
        {dang && <span aria-hidden> {chieu === 'asc' ? '↑' : '↓'}</span>}
      </UnstyledButton>
    </Table.Th>
  );
}

export function doiChieuSapXep<K extends string>(cu: { cot: K; chieu: Chieu }, cot: K): { cot: K; chieu: Chieu } {
  return cu.cot === cot ? { cot, chieu: cu.chieu === 'asc' ? 'desc' : 'asc' } : { cot, chieu: 'asc' };
}
