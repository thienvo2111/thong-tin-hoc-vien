import { Outlet } from 'react-router-dom';
import { Box } from '@mantine/core';
import { TopBar } from './TopBar';
import { tokenKhac } from '@/theme';

export function ProtectedLayout() {
  return (
    <>
      <TopBar />
      <Box mih="calc(100vh - 68px)" style={{ background: tokenKhac.bg }}>
        <Outlet />
      </Box>
    </>
  );
}
