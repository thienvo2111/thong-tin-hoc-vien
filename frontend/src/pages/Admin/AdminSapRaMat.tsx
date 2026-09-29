import { Container, Stack, Text, Title } from '@mantine/core';
import { AdminPageHeader } from './AdminPageHeader';

/** Placeholder cho các mục sidebar chưa có màn hình trong phase này (Khóa bồi dưỡng, Đợt xác nhận,
 * Báo cáo, Nhập dữ liệu, Người dùng) — route thật, không phải link chết 404 (yêu cầu phase 3 mục 1). */
export function AdminSapRaMat({ title }: { title: string }) {
  return (
    <>
      <AdminPageHeader title={title} />
      <Container size="sm" py={60}>
        <Stack align="center" gap="xs">
          <Title order={2} size="h3">
            Sắp ra mắt
          </Title>
          <Text c="dimmed" ta="center">
            Màn hình "{title}" sẽ có ở giai đoạn tiếp theo.
          </Text>
        </Stack>
      </Container>
    </>
  );
}
