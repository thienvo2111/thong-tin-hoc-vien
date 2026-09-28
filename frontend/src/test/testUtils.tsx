import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthContext';
import { theme } from '@/theme';

/** Bọc 1 cây route (data router — cần cho useBlocker ở M4) với đủ Provider giống ứng dụng thật, cho test. */
export function renderVoiRouter(routes: RouteObject[], { initialEntries = ['/'] }: { initialEntries?: string[] } = {}) {
  const router = createMemoryRouter(routes, { initialEntries });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const utils = render(
    <MantineProvider theme={theme} defaultColorScheme="light">
      <QueryClientProvider client={queryClient}>
        <Notifications />
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>
    </MantineProvider>,
  );
  return { ...utils, router, queryClient };
}

/** Bọc 1 trang đơn giản (không cần điều hướng nội bộ / useBlocker) tại route "/". */
export function renderTrang(ui: ReactElement) {
  return renderVoiRouter([{ path: '/', element: ui }]);
}
