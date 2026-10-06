import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './mocks/server';
import { resetDb } from './mocks/db';
import { datLaiCauHinhKhaoSatMock } from './mocks/cauHinhKhaoSat';
import { datLaiThangMucMock, datLaiTinhTrangKhaoSatMock } from './mocks/sso';
import { xoaToken } from '@/auth/tokenStore';

// findBy*/waitFor mặc định chờ 1 giây — đủ khi chạy riêng 1 file, nhưng cả suite song song trên máy 4 nhân
// thì vài màn nặng (TrangChinh, Cấu hình khảo sát) render chậm hơn. Cùng lý do với testTimeout ở vite.config.ts.
configure({ asyncUtilTimeout: 3000 });

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
  datLaiCauHinhKhaoSatMock();
  datLaiTinhTrangKhaoSatMock();
  datLaiThangMucMock();
  xoaToken();
  localStorage.clear();
  cleanup();
});
afterAll(() => server.close());
