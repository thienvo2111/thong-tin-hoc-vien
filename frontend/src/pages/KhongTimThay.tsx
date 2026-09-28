import { Button, Container, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';

export default function KhongTimThay() {
  return (
    <Container size="xs" py="xl">
      <Stack align="center" gap="sm">
        <Title order={1} size="h2">
          Không tìm thấy trang
        </Title>
        <Text c="dimmed">Đường dẫn không tồn tại hoặc đã thay đổi.</Text>
        <Button component={Link} to="/">
          Về trang chủ
        </Button>
      </Stack>
    </Container>
  );
}
