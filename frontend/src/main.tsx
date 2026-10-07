import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider, type CSSVariablesResolver } from '@mantine/core';
import { RouterProvider } from 'react-router-dom';
import '@mantine/core/styles.css';
import '@mantine/charts/styles.css';
import { theme, tokenKhac } from './theme';
import { AuthProvider } from './auth/AuthContext';
import { router } from './router';

// Áp nền trang + màu chữ phụ toàn cục theo design/redesign-spec.md § 1 (không có biến theme riêng cho 2 giá trị này).
const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    '--mantine-color-body': tokenKhac.bg,
    '--mantine-color-dimmed': tokenKhac.textSecondary,
  },
  dark: {},
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light" cssVariablesResolver={cssVariablesResolver}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </MantineProvider>
  </StrictMode>,
);
