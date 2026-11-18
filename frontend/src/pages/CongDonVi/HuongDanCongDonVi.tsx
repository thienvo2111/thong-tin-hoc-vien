import { Link } from 'react-router-dom';
import { Anchor, Box, Container, Group, Image, Paper, Stack, Text, Title } from '@mantine/core';
import { useToi } from '@/auth/AuthContext';
import { congDonVi } from '@/content/congDonVi';
import logoHcmue from '@/assets/logo-hcmue.png';
import { tokenKhac } from '@/theme';
import { useTieuDeCongDonVi } from './useTieuDeCongDonVi';

/** Hướng dẫn Cổng đơn vị (ADR 0015 T6) — công khai, header tối giản; nội dung lấy từ src/content/congDonVi.ts. */
export default function HuongDanCongDonVi() {
  useTieuDeCongDonVi();
  const { daXacThuc } = useToi();

  return (
    <Box mih="100vh" style={{ background: tokenKhac.bg }}>
      <Box component="header" bg="primary.6">
        <Group h={56} px={{ base: 'md', sm: 'xl' }} gap="sm" wrap="nowrap">
          <Image src={logoHcmue} alt="Trường Đại học Sư phạm Thành phố Hồ Chí Minh" h={32} w="auto" fit="contain" />
          <Text c="white" fw={700} fz="sm" lh={1.3} lineClamp={2}>
            {congDonVi.tenCong}
          </Text>
        </Group>
      </Box>

      <Container component="main" size="sm" py="lg">
        <Stack gap="md">
          <Anchor component={Link} to={daXacThuc ? '/trang-chu' : '/dang-nhap'} size="sm">
            {daXacThuc ? 'Về trang chủ' : 'Về trang đăng nhập'}
          </Anchor>
          <Title order={1} size="h2">
            Hướng dẫn sử dụng
          </Title>
          <Stack component="ol" gap="sm" m={0} p={0} style={{ listStyle: 'none' }}>
            {congDonVi.huongDan.map((b, i) => (
              <Paper component="li" key={b.tieuDe} withBorder radius="md" p="md">
                <Title order={2} size="h4" mb={4}>
                  {/* <ol> đã báo số thứ tự cho trình đọc màn hình; số hiển thị chỉ để nhìn. */}
                  <span aria-hidden="true">{i + 1}. </span>
                  {b.tieuDe}
                </Title>
                <Text size="sm" lh={1.6}>
                  {b.noiDung}
                </Text>
              </Paper>
            ))}
          </Stack>
          <Text size="sm" c="dimmed">
            Số điện thoại hỗ trợ: {congDonVi.soDienThoaiHoTro}
          </Text>
        </Stack>
      </Container>
    </Box>
  );
}
