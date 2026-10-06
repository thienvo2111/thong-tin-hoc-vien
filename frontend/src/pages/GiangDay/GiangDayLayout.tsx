import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Box, Button, Group, Image, Text } from '@mantine/core';
import { useToi } from '@/auth/AuthContext';
import logoHcmue from '@/assets/logo-hcmue.png';
import { tokenKhac } from '@/theme';

/** Khung cổng giảng viên (ADR 0004 G8) — chỉ đọc, 1 mục Lịch dạy. */
export default function GiangDayLayout() {
  const { nguoiDung, dangXuat } = useToi();
  const navigate = useNavigate();

  async function xuLyDangXuat() {
    await dangXuat();
    navigate('/dang-nhap', { replace: true });
  }

  return (
    <>
      <Box component="header" bg="primary.6" style={{ boxShadow: '0 1px 2px rgba(16,24,40,.15)' }}>
        <Group h={56} px={{ base: 'md', sm: 'xl' }} justify="space-between" wrap="nowrap">
          <Group gap="md" wrap="nowrap">
            <Image src={logoHcmue} alt="Trường Đại học Sư phạm Thành phố Hồ Chí Minh" h={32} w="auto" fit="contain" />
            <NavLink to="/giang-day" style={{ textDecoration: 'none' }}>
              <Text c="white" fw={700} fz="sm">
                Lịch dạy
              </Text>
            </NavLink>
          </Group>
          <Group gap="sm" wrap="nowrap">
            <Text c="gray.3" fz="sm" ff="monospace" truncate maw={180} visibleFrom="xs">
              {nguoiDung?.ten_dang_nhap}
            </Text>
            <Button variant="subtle" color="gray.3" size="xs" onClick={xuLyDangXuat}>
              Đăng xuất
            </Button>
          </Group>
        </Group>
      </Box>
      <Box mih="calc(100vh - 56px)" style={{ background: tokenKhac.bg }}>
        <Outlet />
      </Box>
    </>
  );
}
