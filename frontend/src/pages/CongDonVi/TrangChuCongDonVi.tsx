import { Link } from 'react-router-dom';
import { Anchor, Center, Container, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { useToi } from '@/auth/AuthContext';
import { congDonVi } from '@/content/congDonVi';
import TrangChuTruong from './TrangChuTruong';

/** Trang chủ Cổng đơn vị: trường → bố cục U1 (issue #60); vai trò khác giữ trang tạm (issue #55) tới lát sau (#71). */
export default function TrangChuCongDonVi() {
  const { dangTai, nguoiDung } = useToi();
  if (dangTai) {
    return (
      <Center mih="40vh">
        <Loader />
      </Center>
    );
  }
  if (nguoiDung?.vai_tro === 'truong') return <TrangChuTruong />;

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
