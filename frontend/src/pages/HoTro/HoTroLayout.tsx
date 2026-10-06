import { Outlet, useNavigate } from 'react-router-dom';
import { Box, Button, Group, Image, Text } from '@mantine/core';
import { useToi } from '@/auth/AuthContext';
import logoHcmue from '@/assets/logo-hcmue.png';
import { tokenKhac } from '@/theme';

/** Khung khu làm việc của người hỗ trợ học viên (ADR 0003) — tách hẳn layout admin để không rò quyền qua
 * menu/trang quản trị. Menu tra cứu/yêu cầu hỗ trợ bổ sung ở các lát sau (#11, #13). */
export default function HoTroLayout() {
  const { nguoiDung, dangXuat } = useToi();
  const navigate = useNavigate();

  async function xuLyDangXuat() {
    await dangXuat();
    navigate('/dang-nhap', { replace: true });
  }

  return (
    <>
      <Box component="header" bg="primary.6" style={{ boxShadow: '0 1px 2px rgba(16,24,40,.15)' }}>
        <Group h={60} px={{ base: 'md', sm: 'xl' }} justify="space-between" wrap="nowrap">
          <Group gap="md" wrap="nowrap">
            <Image src={logoHcmue} alt="Trường Đại học Sư phạm Thành phố Hồ Chí Minh" h={32} w="auto" fit="contain" />
            <Text c="white" fw={700} fz="sm" visibleFrom="xs">
              Hỗ trợ học viên
            </Text>
          </Group>
          <Group gap="sm" wrap="nowrap">
            <Text c="gray.3" fz="sm" ff="monospace" truncate maw={180}>
              {nguoiDung?.ten_dang_nhap}
            </Text>
            <Button variant="subtle" color="gray.3" size="xs" onClick={xuLyDangXuat}>
              Đăng xuất
            </Button>
          </Group>
        </Group>
      </Box>
      <Box mih="calc(100vh - 60px)" style={{ background: tokenKhac.bg }}>
        <Outlet />
      </Box>
    </>
  );
}
