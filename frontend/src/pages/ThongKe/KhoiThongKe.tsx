import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { Alert, Button, Group, Paper, Skeleton, Stack, Text, Title, VisuallyHidden } from '@mantine/core';
import type { UseQueryResult } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { thongDiepLoiChung } from '@/lib/loiApi';

/** Dashboard cung cấp hàm xử lý khi bất kỳ khối nào trả 403 (bộ lọc ngoài phạm vi). */
export const NgoaiPhamViContext = createContext<() => void>(() => undefined);

interface Props {
  tieu_de: string;
  query: UseQueryResult<unknown>;
  rong: boolean;
  thong_bao_rong?: string;
  children: ReactNode;
}

/** Khung chung mỗi khối: tiêu đề + trạng thái tải / lỗi (Thử lại) / rỗng. */
export function KhoiThongKe({ tieu_de, query, rong, thong_bao_rong, children }: Props) {
  const khiNgoaiPhamVi = useContext(NgoaiPhamViContext);
  const ngoaiPhamVi = query.error instanceof ApiError && query.error.status === 403;

  useEffect(() => {
    if (ngoaiPhamVi) khiNgoaiPhamVi();
  }, [ngoaiPhamVi, khiNgoaiPhamVi]);

  let noiDung: ReactNode;
  if (query.isLoading) {
    noiDung = (
      <Stack gap="xs" aria-busy="true" role="status">
        <VisuallyHidden>Đang tải…</VisuallyHidden>
        <Skeleton height={20} width="40%" />
        <Skeleton height={120} />
      </Stack>
    );
  } else if (query.isError) {
    noiDung = (
      <Alert color="red" title="Không tải được">
        <Group justify="space-between" wrap="nowrap">
          <Text size="sm">{thongDiepLoiChung(query.error)}</Text>
          <Button size="xs" variant="light" color="red" onClick={() => void query.refetch()}>
            Thử lại
          </Button>
        </Group>
      </Alert>
    );
  } else if (rong) {
    noiDung = (
      <Text c="dimmed" size="sm">
        {thong_bao_rong ?? 'Chưa có dữ liệu'}
      </Text>
    );
  } else {
    noiDung = children;
  }

  return (
    <Paper withBorder p="md" radius="md" component="section" aria-label={tieu_de}>
      <Stack gap="sm">
        <Title order={3} size="h4">
          {tieu_de}
        </Title>
        {noiDung}
      </Stack>
    </Paper>
  );
}
