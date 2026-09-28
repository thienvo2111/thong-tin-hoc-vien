import { Alert } from '@mantine/core';
import type { ReactNode } from 'react';

type LoaiBanner = 'info' | 'warning' | 'error' | 'success';

const MAU: Record<LoaiBanner, string> = {
  info: 'blue',
  warning: 'yellow',
  error: 'red',
  success: 'green',
};

export function StatusBanner({
  loai,
  tieuDe,
  children,
}: {
  loai: LoaiBanner;
  tieuDe?: string;
  children: ReactNode;
}) {
  return (
    <Alert color={MAU[loai]} title={tieuDe} radius="md" variant="light">
      {children}
    </Alert>
  );
}
