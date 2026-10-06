import { Container, Paper, Stack, Text, Title } from '@mantine/core';

/** Trang chủ người hỗ trợ học viên (ADR 0003). Lát 1 chỉ có khung + đăng nhập; tra cứu học viên theo cụm,
 * lịch học và yêu cầu hỗ trợ bổ sung ở issue #11–#13. */
export default function HoTroTrangChu() {
  return (
    <Container size="md" py="xl">
      <Paper withBorder radius={14} p="lg">
        <Stack gap="xs">
          <Title order={3}>Khu làm việc người hỗ trợ học viên</Title>
          <Text c="dimmed" fz="sm">
            Tài khoản đã sẵn sàng. Chức năng tra cứu học viên theo cụm, lịch học và trả lời yêu cầu hỗ trợ sẽ
            được mở trong các bản cập nhật tiếp theo.
          </Text>
        </Stack>
      </Paper>
    </Container>
  );
}
