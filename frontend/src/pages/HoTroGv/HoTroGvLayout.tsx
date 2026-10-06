import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Box, Button, Group, Image, ScrollArea, Text } from '@mantine/core';
import { useToi } from '@/auth/AuthContext';
import logoHcmue from '@/assets/logo-hcmue.png';
import { tokenKhac } from '@/theme';

const MENU = [{ to: '/ho-tro-gv', nhan: 'Lớp', end: true }];

/** Khung khu làm việc người hỗ trợ giảng viên (ADR 0004) — tách hẳn layout admin, như khu hỗ trợ học viên. */
export default function HoTroGvLayout() {
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
            <Text c="white" fw={700} fz="sm" visibleFrom="xs">
              Hỗ trợ giảng viên
            </Text>
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
        <ScrollArea type="never">
          <Group component="nav" aria-label="Menu hỗ trợ giảng viên" gap={4} px={{ base: 'sm', sm: 'xl' }} pb={8} wrap="nowrap">
            {MENU.map((m) => (
              <NavLink key={m.to} to={m.to} end={m.end} style={{ textDecoration: 'none' }}>
                {({ isActive }) => (
                  <Text
                    component="span"
                    px="md"
                    py={6}
                    fw={600}
                    fz="sm"
                    c={isActive ? 'white' : 'gray.4'}
                    style={{ display: 'inline-flex', borderRadius: 8, background: isActive ? 'rgba(255,255,255,.14)' : 'transparent' }}
                  >
                    {m.nhan}
                  </Text>
                )}
              </NavLink>
            ))}
          </Group>
        </ScrollArea>
      </Box>
      <Box mih="calc(100vh - 96px)" style={{ background: tokenKhac.bg }}>
        <Outlet />
      </Box>
    </>
  );
}
