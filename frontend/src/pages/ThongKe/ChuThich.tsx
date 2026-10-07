import { ColorSwatch, Group, Text } from '@mantine/core';

export interface MucChuThich {
  nhan: string;
  mau: string;
}

/** Chú thích dạng HTML (recharts Legend không ổn định trong jsdom, và cần đọc được bằng screen reader). */
export function ChuThich({ muc, testId }: { muc: MucChuThich[]; testId?: string }) {
  return (
    <Group gap="md" data-testid={testId}>
      {muc.map((m) => (
        <Group key={m.nhan} gap={4} wrap="nowrap">
          <ColorSwatch color={`var(--mantine-color-${m.mau.replace('.', '-')})`} size={12} withShadow={false} />
          <Text size="xs">{m.nhan}</Text>
        </Group>
      ))}
    </Group>
  );
}
