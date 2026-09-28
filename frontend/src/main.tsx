import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { RouterProvider } from 'react-router-dom';
import '@mantine/core/styles.css';
import { theme } from './theme';
import { AuthProvider } from './auth/AuthContext';
import { router } from './router';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light">
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </MantineProvider>
  </StrictMode>,
);
