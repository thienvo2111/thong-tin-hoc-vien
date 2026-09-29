import type { ReactNode } from 'react';
import { Group, Text } from '@mantine/core';
import { tokenKhac } from '@/theme';

/** Topbar của 1 trang quản trị — tiêu đề trái + (tùy trang) bộ lọc/nút hành động phải.
 * design/redesign-spec.md § 2 "Topbar ngang trên cùng vùng nội dung". */
export function AdminPageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <Group
      justify="space-between"
      align="center"
      wrap="wrap"
      gap="sm"
      px={{ base: 'md', md: 28 }}
      py="sm"
      mih={64}
      style={{ borderBottom: `1px solid ${tokenKhac.border}`, background: tokenKhac.surface }}
    >
      <Text fz={16} fw={700}>
        {title}
      </Text>
      {actions}
    </Group>
  );
}
