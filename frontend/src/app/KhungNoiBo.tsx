import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Notifications } from '@mantine/notifications';
import { LamMoiCacheKhiHetPhien } from './LamMoiCacheKhiHetPhien';

// Bọc mọi route TRỪ M0: cấp TanStack Query + Notifications. Route riêng (lazy) nên module này
// (và react-query) không nằm trong chunk M0 (dac-ta-cong-hoc-vien.md § M0 "Yêu cầu kỹ thuật").
export default function KhungNoiBo() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <LamMoiCacheKhiHetPhien />
      <Notifications position="top-center" />
      <Outlet />
    </QueryClientProvider>
  );
}
