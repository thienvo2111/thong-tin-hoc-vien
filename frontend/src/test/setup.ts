import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './mocks/server';
import { resetDb } from './mocks/db';
import { datCauHinhKhaoSatMock } from './mocks/cauHinhKhaoSat';
import { xoaToken } from '@/auth/tokenStore';

// Polyfill cần cho các component Mantine (Combobox/Select/Popover…) chạy trong jsdom.
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
Element.prototype.scrollIntoView = vi.fn();
// jsdom không cài URL.createObjectURL/revokeObjectURL — cần cho các nút "Xuất Excel"/"Tải file lỗi"
// (Phase 5, src/lib/taiFile.ts) dùng Blob + createObjectURL để tải file qua trình duyệt.
if (!window.URL.createObjectURL) {
  window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
}
if (!window.URL.revokeObjectURL) {
  window.URL.revokeObjectURL = vi.fn();
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  resetDb();
  datCauHinhKhaoSatMock(null);
  xoaToken();
  cleanup();
});
afterAll(() => server.close());
