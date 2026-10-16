import { Group, Progress, Text } from '@mantine/core';

/** Mức đầy → màu: dưới 80% xanh, 80–99% vàng, đủ/vượt đỏ. */
export function mauSiSo(siSo: number, toiDa: number): string {
  if (siSo >= toiDa) return 'red';
  if (siSo >= toiDa * 0.8) return 'yellow';
  return 'teal';
}

/**
 * Thanh sĩ số buổi: phần đã có (màu theo mức đầy) + phần đang chờ duyệt (sọc nhạt) + số "28/30 · +2 chờ".
 * Không có sĩ số tối đa → chỉ hiện số, không có thanh.
 */
export function ThanhSiSo({
  siSo,
  toiDa,
  cho = 0,
  w = 140,
  anSo = false,
}: {
  siSo: number;
  toiDa: number | null;
  cho?: number;
  w?: number | string;
  /** Ẩn số bên cạnh thanh khi nơi dùng đã ghi số riêng. */
  anSo?: boolean;
}) {
  const chu = (
    <Text fz="xs" fw={600} style={{ whiteSpace: 'nowrap' }}>
      {toiDa == null ? siSo : `${siSo}/${toiDa}`}
      {cho > 0 && (
        <Text span fz="xs" c="dimmed" fw={400}>
          {` · +${cho} chờ`}
        </Text>
      )}
    </Text>
  );
  if (toiDa == null || toiDa <= 0) return anSo ? null : chu;

  const phanCo = Math.min(100, (siSo / toiDa) * 100);
  const phanCho = Math.min(100 - phanCo, (cho / toiDa) * 100);
  return (
    <Group gap={6} wrap="nowrap" data-testid="thanh-si-so">
      <Progress.Root size="md" w={w} aria-label={`Sĩ số ${siSo}/${toiDa}${cho > 0 ? `, ${cho} đang chờ` : ''}`}>
        <Progress.Section value={phanCo} color={mauSiSo(siSo, toiDa)} />
        {phanCho > 0 && <Progress.Section value={phanCho} color="gray.4" striped />}
      </Progress.Root>
      {!anSo && chu}
    </Group>
  );
}
