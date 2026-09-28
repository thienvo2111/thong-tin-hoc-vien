import { Outlet } from 'react-router-dom';
import { Divider } from '@mantine/core';
import { TopBar } from './TopBar';

export function ProtectedLayout() {
  return (
    <>
      <TopBar />
      <Divider />
      <Outlet />
    </>
  );
}
