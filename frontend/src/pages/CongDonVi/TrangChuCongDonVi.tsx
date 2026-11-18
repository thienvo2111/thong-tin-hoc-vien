import { Link } from 'react-router-dom';
import { Anchor, Container, Paper, Stack, Text, Title } from '@mantine/core';
import { useToi } from '@/auth/AuthContext';
import { congDonVi } from '@/content/congDonVi';

/** Trang chủ tạm của Cổng đơn vị (issue #55) — chức năng danh sách tham gia/hồ sơ đơn vị làm ở các issue sau. */
export default function TrangChuCongDonVi() {
  const { nguoiDung } = useToi();

  return (
    <Container size="sm" py="lg">
      <Stack gap="md">
        <Title order={1} size="h3">
          Xin chào, {nguoiDung?.ten_dang_nhap}
        </Title>
        <Paper withBorder radius="md" p="md">
          <Stack gap="xs">
            <Text>{congDonVi.thongDiep}</Text>
            <Text c="dimmed" size="sm">
              Chức năng xem danh sách tham gia và khai hồ sơ đơn vị sắp có. HCMUE sẽ thông báo khi mở.
            </Text>
          </Stack>
        </Paper>
        <Anchor component={Link} to="/huong-dan">
          Hướng dẫn sử dụng Cổng đơn vị
        </Anchor>
      </Stack>
    </Container>
  );
}
