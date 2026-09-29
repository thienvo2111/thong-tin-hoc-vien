import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Box, Burger, Drawer, Group, Image } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { tokenKhac } from '@/theme';
import logoHcmue from '@/assets/logo-hcmue.png';
import { AdminSidebar } from './AdminSidebar';

const NGUONG_DESKTOP = '(min-width: 1024px)';
const RONG_SIDEBAR = 248;

/** Khung layout quản trị — sidebar dọc 248px (desktop) / Drawer (< 1024px), theo
 * design/redesign-spec.md § 2. Route con render qua Outlet, mỗi trang tự có AdminPageHeader riêng. */
export default function AdminLayout() {
  const laDesktop = useMediaQuery(NGUONG_DESKTOP);
  const [drawerMo, setDrawerMo] = useState(false);

  return (
    <Box style={{ display: 'flex', minHeight: '100vh', background: tokenKhac.bg }}>
      {laDesktop && (
        <Box style={{ width: RONG_SIDEBAR, flexShrink: 0 }}>
          <AdminSidebar />
        </Box>
      )}

      <Box style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {!laDesktop && (
          <Group h={56} px="md" wrap="nowrap" justify="space-between" style={{ background: '#0F2942', flexShrink: 0 }}>
            <Burger opened={drawerMo} onClick={() => setDrawerMo((v) => !v)} color="white" size="sm" />
            <Image src={logoHcmue} alt="HCMUE" h={26} w="auto" fit="contain" />
            <Box w={30} />
          </Group>
        )}
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Outlet />
        </Box>
      </Box>

      {!laDesktop && (
        <Drawer opened={drawerMo} onClose={() => setDrawerMo(false)} withCloseButton={false} size={RONG_SIDEBAR} padding={0}>
          <AdminSidebar onNavigate={() => setDrawerMo(false)} />
        </Drawer>
      )}
    </Box>
  );
}
